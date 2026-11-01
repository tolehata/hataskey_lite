/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, defineComponent, h, nextTick, onUnmounted, provide, ref } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { notificationTypes } from 'cherrypick-js';
import Notifications from './notifications.vue';
import { hataNotificationView, readHataNotificationView, setHataNotificationView } from '@/utility/hatasaba-device-prefs.js';
import { miLocalStorage } from '@/local-storage.js';
import { createNavbarPullRefresh, navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';
import { prefer } from '@/preferences.js';
import type { App, PropType, WritableComputedRef } from 'vue';

const mocks = vi.hoisted(() => ({ popupMenu: vi.fn(), apiWithDialog: vi.fn(), refreshUnread: vi.fn(), brandReload: vi.fn().mockResolvedValue(undefined), notesReload: vi.fn().mockResolvedValue(undefined), navbarReload: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	filter: 'filter', reload: 'reload', markAllAsRead: 'markAllAsRead', notifications: 'notifications',
	pullDownToRefresh: 'Pull to refresh', releaseToRefresh: 'Release to refresh', refreshing: 'Refreshing',
	mentions: 'Mentions', directNotes: 'Direct notes',
	_notification: { _types: new Proxy({}, { get: (_, key) => String(key) }) },
	_hata: {
		_notificationBrands: { all: 'All', standard: 'Standard', hatady: 'Hatady', hatask: 'Hatask', hataFeed: 'HataFeed' },
		_hatady: { _notification: new Proxy({}, { get: (_, key) => String(key) }) },
		_notificationFilter: { botNotifications: 'bots', types: 'types', hatadyTypes: 'hatadyTypes', otherHatask: 'otherHatask', selectAll: 'selectAll', clearSelection: 'clearSelection' },
	},
} } }));
vi.mock('@/os.js', () => ({ popupMenu: mocks.popupMenu, apiWithDialog: mocks.apiWithDialog }));
vi.mock('@/i.js', () => ({ $i: { id: 'owner-a' } }));
vi.mock('@/utility/notification-unread-sync.js', () => ({ refreshNotificationUnreadState: mocks.refreshUnread }));
vi.mock('@/preferences.js', async () => { const { ref } = await import('vue'); return { prefer: { r: { notificationExcludeBots: ref(false) }, s: { enablePullToRefresh: true } } }; });
vi.mock('@/utility/touch.js', async () => ({ isHorizontalSwipeSwiping: (await import('vue')).ref(false) }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/events.js', () => ({ globalEvents: { emit: vi.fn() } }));
vi.mock('@/utility/paginator.js', () => ({ Paginator: class {
	constructor(public endpoint: string, public options: { limit: number; params?: { visibility: string } }) {}
	reload() { return mocks.notesReload(this.endpoint, this.options.params?.visibility); }
} }));
vi.mock('@/components/MkStreamingNotificationsTimeline.vue', async () => {
	const { default: MkPullToRefresh } = await import('@/components/MkPullToRefresh.vue');
	const { prefer } = await import('@/preferences.js');
	return { default: defineComponent({
	props: ['brand', 'includeBrands', 'includeHataskApp', 'excludeBots', 'excludeTypes', 'includeHatadySubtypes'],
	setup(props) {
		const content = () => h('div', {
			'data-timeline': '', 'data-brand': props.brand, 'data-bots': String(props.excludeBots),
			'data-brands': JSON.stringify(props.includeBrands), 'data-hatask-app': String(props.includeHataskApp),
			'data-exclude-types': JSON.stringify(props.excludeTypes),
			'data-hatady-subtypes': JSON.stringify(props.includeHatadySubtypes),
		});
		return () => prefer.s.enablePullToRefresh
			? h(MkPullToRefresh, { refresher: mocks.brandReload }, { default: content })
			: h('div', [content()]);
	},
}) }; });
vi.mock('@/components/MkNotesTimeline.vue', async () => {
	const { default: MkPullToRefresh } = await import('@/components/MkPullToRefresh.vue');
	const { prefer } = await import('@/preferences.js');
	return { default: defineComponent({
	props: ['paginator', 'notification'],
	setup(props) {
		const content = () => h('div', {
			'data-notes-timeline': '', 'data-endpoint': props.paginator.endpoint,
			'data-limit': String(props.paginator.options.limit),
			'data-visibility': props.paginator.options.params?.visibility ?? '',
			'data-notification': String(props.notification),
		});
		return () => prefer.s.enablePullToRefresh
			? h(MkPullToRefresh, { refresher: () => props.paginator.reload() }, { default: content })
			: h('div', [content()]);
	},
}) }; });

type HeaderAction = { text: string; handler: (ev: MouseEvent) => void };
type FilterItem = { text?: string; type?: string; ref?: WritableComputedRef<boolean>; action?: () => void };
const PageWithHeader = defineComponent({
	props: { actions: { type: Array as PropType<HeaderAction[]>, required: true } },
	setup(props, { slots }) {
		return () => h('div', [
			...props.actions.map(action => h('button', { 'data-action': action.text, onClick: action.handler }, action.text)),
			slots.default?.(),
		]);
	},
});
const mounted: Array<{ app: App; container: HTMLDivElement }> = [];

function mountPage() {
	const app = createApp({ setup() {
		const navbarPull = createNavbarPullRefresh(ref(false), ref(false), { refresher: mocks.navbarReload });
		provide(navbarPullRefreshKey, navbarPull);
		onUnmounted(navbarPull.dispose);
		return () => h(Notifications, { disableRefreshButton: true });
	} });
	app.component('PageWithHeader', PageWithHeader);
	app.component('MkLoading', { template: '<span>Refreshing</span>' });
	const container = window.document.createElement('div');
	container.style.overflowY = 'auto';
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return {
		container,
		get timeline() { return container.querySelector<HTMLElement>('[data-timeline]')!; },
		get notesTimeline() { return container.querySelector<HTMLElement>('[data-notes-timeline]'); },
		get tabs() { return [...container.querySelectorAll<HTMLButtonElement>('button[aria-label]')]; },
		menu(): FilterItem[] {
			container.querySelector<HTMLButtonElement>('[data-action="filter"]')!.click();
			return mocks.popupMenu.mock.calls.at(-1)![0] as FilterItem[];
		},
	};
}

function switchFor(page: ReturnType<typeof mountPage>, text: string) {
	return page.menu().find(item => item.text === text)!.ref!;
}

beforeEach(() => {
	mocks.apiWithDialog.mockReset().mockResolvedValue(undefined);
	mocks.refreshUnread.mockReset().mockResolvedValue(undefined);
	prefer.s.enablePullToRefresh = true;
	setHataNotificationView({ brand: 'all', includeBrands: null, includeTypes: null, includeHatadySubtypes: null, includeHataskApp: true, excludeBots: false });
});

test('mark all as read refreshes the captured account count only after a successful request', async () => {
	const page = mountPage();
	page.container.querySelector<HTMLButtonElement>('[data-action="markAllAsRead"]')!.click();
	await nextTick();
	expect(mocks.apiWithDialog).toHaveBeenCalledExactlyOnceWith('notifications/mark-all-as-read', {});
	expect(mocks.refreshUnread).toHaveBeenCalledExactlyOnceWith('owner-a');
});

test('a failed mark all as read request leaves the unread count untouched', async () => {
	mocks.apiWithDialog.mockRejectedValue(new Error('failed'));
	const page = mountPage();
	page.container.querySelector<HTMLButtonElement>('[data-action="markAllAsRead"]')!.click();
	await nextTick();
	expect(mocks.refreshUnread).not.toHaveBeenCalled();
});
afterEach(() => {
	for (const { app, container } of mounted.splice(0)) { app.unmount(); container.remove(); }
	miLocalStorage.removeItem('hataNotificationView');
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.clearAllMocks();
});

function touch(target: EventTarget, type: string, y: number) {
	const event = new Event(type, { bubbles: true });
	Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [{ screenX: 0, screenY: y, identifier: 1 }] });
	target.dispatchEvent(event);
}

async function pull(root: HTMLElement) {
	touch(root, 'touchstart', 0);
	touch(window, 'touchmove', 220);
	touch(window, 'touchend', 220);
	await vi.advanceTimersByTimeAsync(250);
}

test('a branded notification pull refreshes once through the page timeline and preserves its filters', async () => {
	vi.useFakeTimers();
	let finish!: () => void;
	mocks.brandReload.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
	const page = mountPage();
	page.tabs[4].click(); await nextTick();
	switchFor(page, 'bots').value = false; await nextTick();
	const saved = miLocalStorage.getItem('hataNotificationView');
	const root = page.timeline.parentElement!;
	await pull(root);
	expect(mocks.brandReload).toHaveBeenCalledOnce();
	expect(mocks.navbarReload).not.toHaveBeenCalled();
	// A second pull while the first request is pending must not start another request.
	await pull(root);
	expect(mocks.brandReload).toHaveBeenCalledOnce();
	finish();
	await vi.advanceTimersByTimeAsync(250);
	expect(page.timeline.dataset.brand).toBe('hatady');
	expect(page.timeline.dataset.bots).toBe('true');
	expect(miLocalStorage.getItem('hataNotificationView')).toBe(saved);
});

test.each([['Mentions', ''], ['Direct notes', 'specified']])('%s pull refreshes its own paginator with a disabled ancestor controller', async (label, visibility) => {
	vi.useFakeTimers();
	const page = mountPage();
	page.tabs.find(button => button.getAttribute('aria-label') === label)!.click(); await nextTick();
	await pull(page.notesTimeline!.parentElement!);
	expect(mocks.notesReload).toHaveBeenCalledOnce();
	expect(mocks.notesReload).toHaveBeenCalledWith('notes/mentions', visibility || undefined);
	expect(mocks.brandReload).not.toHaveBeenCalled();
	expect(mocks.navbarReload).not.toHaveBeenCalled();
});

test('disabling pull refresh leaves notification and note timelines inert', async () => {
	vi.useFakeTimers();
	prefer.s.enablePullToRefresh = false;
	const page = mountPage();
	await pull(page.timeline.parentElement!);
	page.tabs[1].click(); await nextTick();
	await pull(page.notesTimeline!.parentElement!);
	expect(mocks.brandReload).not.toHaveBeenCalled();
	expect(mocks.notesReload).not.toHaveBeenCalled();
	expect(mocks.navbarReload).not.toHaveBeenCalled();
});

test('seven capsules show only the selected label and persist the selected brand on this device', async () => {
	const page = mountPage();
	const buttons = page.tabs;
	expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['All', 'Mentions', 'Direct notes', 'Standard', 'Hatady', 'Hatask', 'HataFeed']);
	expect(buttons.filter(button => button.textContent?.trim())).toHaveLength(1);
	buttons[4].click(); await nextTick();
	expect(page.timeline.dataset.brand).toBe('hatady');
	expect(buttons.filter(button => button.textContent?.trim()).map(button => button.textContent?.trim())).toEqual(['Hatady']);
	expect(buttons.filter(button => button.getAttribute('aria-current') === 'page')).toEqual([buttons[4]]);
	expect(JSON.parse(miLocalStorage.getItem('hataNotificationView')!).brand).toBe('hatady');
	expect(mountPage().timeline.dataset.brand).toBe('hatady');
});

test('mention and direct note tabs use their own paginator and preserve the saved brand and filters', async () => {
	const page = mountPage();
	page.tabs[4].click(); await nextTick();
	switchFor(page, 'bots').value = false;
	await nextTick();
	const savedBeforeNotes = miLocalStorage.getItem('hataNotificationView');
	page.tabs[1].click(); await nextTick();
	expect(page.timeline).toBeNull();
	expect(page.notesTimeline?.dataset).toMatchObject({ endpoint: 'notes/mentions', limit: '10', notification: 'false' });
	expect(page.notesTimeline?.getAttribute('data-visibility')).toBe('');
	expect(page.tabs.filter(button => button.textContent?.trim()).map(button => button.textContent?.trim())).toEqual(['Mentions']);
	expect(page.tabs[1].getAttribute('aria-current')).toBe('page');
	expect(page.container.querySelector('[data-action="filter"]')).toBeNull();
	expect(page.container.querySelector('[data-action="markAllAsRead"]')).toBeNull();
	expect(miLocalStorage.getItem('hataNotificationView')).toBe(savedBeforeNotes);
	page.tabs[2].click(); await nextTick();
	expect(page.notesTimeline?.dataset).toMatchObject({ endpoint: 'notes/mentions', limit: '10', notification: 'true' });
	expect(page.notesTimeline?.getAttribute('data-visibility')).toBe('specified');
	expect(page.tabs.filter(button => button.textContent?.trim()).map(button => button.textContent?.trim())).toEqual(['Direct notes']);
	expect(page.container.querySelector('[data-action="filter"]')).toBeNull();
	expect(page.container.querySelector('[data-action="markAllAsRead"]')).toBeNull();
	expect(miLocalStorage.getItem('hataNotificationView')).toBe(savedBeforeNotes);
	page.tabs[4].click(); await nextTick();
	expect(page.timeline.dataset.brand).toBe('hatady');
	expect(page.timeline.dataset.bots).toBe('true');
	expect(page.container.querySelector('[data-action="filter"]')).not.toBeNull();
	expect(page.container.querySelector('[data-action="markAllAsRead"]')).not.toBeNull();
	page.tabs[1].click(); await nextTick();
	expect(mountPage().timeline.dataset.brand).toBe('hatady');
});

test('bot, standard type, and Hatady subtype switches persist together and preserve unknown saved fields', async () => {
	miLocalStorage.setItem('hataNotificationView', JSON.stringify({ futureOption: 'keep' }));
	const page = mountPage();
	switchFor(page, 'bots').value = false;
	switchFor(page, 'reaction').value = false;
	switchFor(page, 'mediaReaction').value = false;
	await nextTick();
	expect(page.timeline.dataset.bots).toBe('true');
	expect(JSON.parse(page.timeline.dataset.excludeTypes!)).toEqual(['reaction']);
	expect(JSON.parse(page.timeline.dataset.hatadySubtypes!)).not.toContain('mediaReaction');
	const saved = JSON.parse(miLocalStorage.getItem('hataNotificationView')!);
	expect(saved.futureOption).toBe('keep');
	expect(saved.excludeBots).toBe(true);
	expect(saved.includeTypes).not.toContain('reaction');
	expect(saved.includeHatadySubtypes).not.toContain('mediaReaction');
	expect(hataNotificationView.value.excludeBots).toBe(true);
});

test('select all and clear selection act on saved device filters', async () => {
	const page = mountPage();
	page.menu().find(item => item.text === 'clearSelection')!.action!();
	await nextTick();
	expect(page.timeline.dataset.excludeTypes).toBe(JSON.stringify(notificationTypes.filter(type => type !== 'hatady')));
	expect(page.timeline.dataset.hatadySubtypes).toBe('[]');
	expect(page.timeline.dataset.brands).toBe('[]');
	expect(page.timeline.dataset.hataskApp).toBe('false');
	page.menu().find(item => item.text === 'selectAll')!.action!();
	await nextTick();
	expect(page.timeline.dataset.excludeTypes).toBe('null');
	expect(page.timeline.dataset.hatadySubtypes).toBe('null');
	expect(page.timeline.dataset.brands).toBe('null');
	expect(page.timeline.dataset.hataskApp).toBe('true');
});

test('four category switches precede their own children and restore child choices after parent re-enable', async () => {
	const page = mountPage();
	const menu = page.menu();
	const labels = menu.map(item => item.text).filter(Boolean);
	expect(labels.indexOf('Standard')).toBeLessThan(labels.indexOf('app'));
	expect(labels.indexOf('Hatady')).toBeLessThan(labels.indexOf('mediaReaction'));
	expect(labels.indexOf('Hatask')).toBeLessThan(labels.indexOf('otherHatask'));
	expect(labels.indexOf('HataFeed')).toBeLessThan(labels.indexOf('hataFeed'));
	switchFor(page, 'mediaReaction').value = false;
	switchFor(page, 'Hatady').value = false;
	await nextTick();
	expect(JSON.parse(page.timeline.dataset.brands!)).not.toContain('hatady');
	expect(JSON.parse(page.timeline.dataset.hatadySubtypes!)).not.toContain('mediaReaction');
	switchFor(page, 'Hatady').value = true;
	await nextTick();
	expect(JSON.parse(page.timeline.dataset.brands!)).toContain('hatady');
	expect(JSON.parse(page.timeline.dataset.hatadySubtypes!)).not.toContain('mediaReaction');
});

test('the legacy Hatask app choice remains separate from the standard app choice', async () => {
	const page = mountPage();
	switchFor(page, 'app').value = false;
	await nextTick();
	expect(JSON.parse(page.timeline.dataset.excludeTypes!)).toContain('app');
	expect(page.timeline.dataset.hataskApp).toBe('true');
	switchFor(page, 'otherHatask').value = false;
	await nextTick();
	expect(page.timeline.dataset.hataskApp).toBe('false');
});

test('old saved child exclusions migrate to the Hatady parent gate and Hatask app child without enabling either', () => {
	miLocalStorage.setItem('hataNotificationView', JSON.stringify({ includeTypes: ['app', 'follow'] }));
	const first = readHataNotificationView();
	expect(first.includeBrands).toEqual(['standard', 'hatask', 'hataFeed']);
	expect(first.includeHataskApp).toBe(true);
	miLocalStorage.setItem('hataNotificationView', JSON.stringify({ includeTypes: ['follow'] }));
	const second = readHataNotificationView();
	expect(second.includeBrands).toEqual(['standard', 'hatask', 'hataFeed']);
	expect(second.includeHataskApp).toBe(false);
	miLocalStorage.setItem('hataNotificationView', JSON.stringify({ includeBrands: null, includeTypes: ['follow'], includeHataskApp: true }));
	expect(readHataNotificationView().includeBrands).toBeNull();
});

test('an unset device filter inherits the current account’s previous Bot choice once', async () => {
	const { prefer } = await import('@/preferences.js');
	prefer.r.notificationExcludeBots.value = true;
	miLocalStorage.removeItem('hataNotificationView');
	const page = mountPage(); await nextTick();
	expect(page.timeline.dataset.bots).toBe('true');
	expect(JSON.parse(miLocalStorage.getItem('hataNotificationView')!).excludeBots).toBe(true);
	prefer.r.notificationExcludeBots.value = false;
	expect(mountPage().timeline.dataset.bots).toBe('true');
});
