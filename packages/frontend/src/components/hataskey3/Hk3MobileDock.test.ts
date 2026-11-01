/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive, Teleport, markRaw } from 'vue';
import Hk3MobileDock from './Hk3MobileDock.vue';
import type { Hk3MobileNavigation, Hk3MobileNavItem } from './hk3-mobile-navigation.js';
import type { NavbarPullState } from '@/utility/navbar-pull-refresh.js';

vi.mock('@/i18n.js', () => ({ i18n: { ts: { search: 'Search', close: 'Close', done: 'Done', pullDownToRefresh: 'Pull down to refresh', pullUpToRefresh: 'Pull up to refresh', releaseToRefresh: 'Release to refresh', refreshing: 'Refreshing', _hata: { _hataskeyUi3: { note: 'Note', loadFailed: 'Failed', _mobileNavigation: {
	navigation: 'Navigation', timelines: 'Timelines', menu: 'Menu', home: 'Home', close: 'Close', back: 'Back', settings: 'Settings', options: 'Options', reorder: 'Reorder', done: 'Done', loading: 'Loading', loadError: 'Failed', retry: 'Retry', empty: 'Empty', guide: 'Tap, hold, slide', guideMenu: 'Hold Menu for timelines\nKeep holding and slide to choose', gotIt: 'Got it',
} }, _hatasabaUi: { _simple: { record: 'Record' } } } } } }));
vi.mock('@/components/MkMobileNavbarSearch.vue', async () => {
	const { defineComponent, h, ref } = await import('vue');
	return { default: defineComponent({
		props: ['active', 'maxHeight', 'motion'], emits: ['height', 'close'],
		setup(props, { emit, expose }) {
			const input = ref<HTMLInputElement | null>(null);
			const query = ref('');
			const options = ref(false);
			expose({ focus: () => input.value?.focus({ preventScroll: true }) });
			return () => h('div', { 'data-search-stub': '', 'data-active': props.active, 'data-max-height': props.maxHeight, onKeydown: (event: KeyboardEvent) => {
				if (event.key === 'Escape' && options.value && !event.isComposing) { event.preventDefault(); event.stopPropagation(); options.value = false; }
			} }, [
				h('input', { ref: input, 'data-search-query': '', value: query.value, onInput: (event: Event) => { query.value = (event.target as HTMLInputElement).value; } }),
				h('button', { 'data-search-expand': '', onClick: () => emit('height', 320) }, 'Results'),
				h('button', { 'data-search-compact': '', onClick: () => emit('height', 59) }, 'Compact'),
				h('button', { 'data-search-options': '', 'aria-expanded': options.value, onClick: () => { options.value = true; } }, 'Options'),
			]);
		},
	}) };
});
const Icon = markRaw({ render: () => h('svg') });
const cleanups: (() => void)[] = [];
const resizeCallbacks: (() => void)[] = [];
beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: () => void) { resizeCallbacks.push(callback); }
		observe() {}
		disconnect() {}
	});
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	resizeCallbacks.length = 0;
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function navigation(): Hk3MobileNavigation {
	return {
		choices: [
			{ id: 'antenna', label: 'Antennas', icon: 'ti ti-antenna', branch: 'antenna' },
			{ id: 'list', label: 'Lists', icon: 'ti ti-list', branch: 'list' },
			{ id: 'global', label: 'Global', icon: 'ti ti-world' },
			{ id: 'social', label: 'Social', icon: 'ti ti-users' },
			{ id: 'local', label: 'Local', icon: 'ti ti-home' },
			{ id: 'home', label: 'Home TL', icon: 'ti ti-home' },
		],
		active: 'home', selected: { list: null, antenna: 'a' },
		select: vi.fn(), load: vi.fn(async () => [{ id: 'a', name: 'Collection A' }, { id: 'b', name: 'Collection B' }]),
		selectCollection: vi.fn(), settings: vi.fn(), reorder: vi.fn(),
		options: [{ id: 'live', label: 'LIVE', icon: 'ti ti-bolt', checked: true, action: vi.fn() }, { id: 'rss', label: 'RSS', icon: 'ti ti-rss', action: vi.fn() }, { id: 'filter', label: 'Filter', icon: 'ti ti-filter', checked: false, disabled: true, action: vi.fn() }],
	};
}

type PullAttacher = (root: HTMLElement, onClaim: () => void, canStart: () => boolean) => { dispose: () => void };
type Props = { confirmationActive?: boolean; composerBlocked?: boolean; suspended?: boolean; composeKind?: 'note' | 'hatady'; navigation: Hk3MobileNavigation | null; items: Hk3MobileNavItem[]; home: boolean; drawerOpen: boolean; motion: boolean; guideSeen: boolean; pullState: NavbarPullState | null; attachPullGesture: PullAttacher | null };

function mount(overrides: Partial<Props> = {}) {
	const controller = navigation();
	const state = reactive<Props>({ navigation: controller, items: ['/', '/notifications', '/search'].map(path => ({ path, label: path, icon: Icon, badge: path === '/notifications' ? '1' : null, active: path === '/' })), home: true, drawerOpen: false, motion: false, guideSeen: false, pullState: null, attachPullGesture: null, ...overrides });
	const events = { navigate: vi.fn(), menu: vi.fn(), requestTimeline: vi.fn(), menuOpen: vi.fn(), searchOpen: vi.fn(), compose: vi.fn(), dismissGuide: vi.fn() };
	const target = window.document.createElement('div'); window.document.body.append(target);
	let instance: InstanceType<typeof Hk3MobileDock>;
	const app = createApp({ render: () => h(Hk3MobileDock, { ...state, ref: value => { instance = value as typeof instance; }, ...Object.fromEntries(Object.entries(events).map(([key, fn]) => [`on${key[0].toUpperCase()}${key.slice(1)}`, fn])) }) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return {
		target, state, controller, events, instance: () => instance,
		button: (selector: string) => target.querySelector<HTMLButtonElement>(selector)!,
		choice: (id: string) => target.querySelector<HTMLButtonElement>(`[data-choice="${id}"]`)!,
		root: () => target.querySelector<HTMLElement>('section')!,
		list: () => target.querySelector<HTMLElement>('[data-view]')!,
	};
}

async function flush() { await nextTick(); await Promise.resolve(); await nextTick(); }

async function click(button: HTMLElement) { await vi.advanceTimersByTimeAsync(1); button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); await flush(); }

function pointer(target: EventTarget, type: string, x = 40, y = 460, id = 1) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0, isPrimary: true });
	target.dispatchEvent(event);
}

function rect(element: Element, left: number, top: number, width: number, height: number) {
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) });
}

function transition(element: Element, type: 'transitionrun' | 'transitionend' | 'transitioncancel', propertyName: string) {
	const event = new Event(type, { bubbles: true });
	Object.assign(event, { propertyName });
	element.dispatchEvent(event);
}

function geometry(view: ReturnType<typeof mount>, branch = false) {
	rect(view.list(), 10, 100, 300, 340);
	Array.from(view.list().querySelectorAll('[data-choice]')).forEach((element, index) => rect(element, branch ? 10 : 10 + index % 2 * 150, 120 + (branch ? index : Math.floor(index / 2)) * 58, branch ? 300 : 145, 56));
	const back = view.target.querySelector('[data-action="back"]');
	const settings = view.target.querySelector('[data-action="settings"]');
	if (back) rect(back, 10, 50, 44, 44);
	if (settings) rect(settings, 266, 50, 44, 44);
}

async function open(view: ReturnType<typeof mount>) { view.instance().openMenu(); await flush(); geometry(view); }

async function hold(view: ReturnType<typeof mount>) {
	const home = view.button('[data-home-button], [data-timeline-opener]');
	rect(home, 20, 440, 44, 52);
	Object.assign(home, { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() });
	pointer(home, 'pointerdown');
	await vi.advanceTimersByTimeAsync(500); await flush();
	if (view.target.querySelector('[data-view]')) geometry(view);
	return home;
}

function key(element: Element, name: string, extra: KeyboardEventInit = {}) { element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra })); }

describe('Hk3MobileDock', () => {
	it('changes the stable compose opener to Hatady without remounting the draft target', async () => {
		const view = mount({ composeKind: 'note' });
		const opener = view.button('[data-compose-opener]');
		const target = view.instance().composerTarget!;
		const draft = window.document.createElement('textarea'); draft.value = 'unfinished'; target.append(draft);
		view.state.composeKind = 'hatady'; await flush();
		expect(view.button('[data-compose-opener]')).toBe(opener);
		expect(view.instance().composerTarget).toBe(target);
		expect(target.querySelector('textarea')).toBe(draft);
		expect(opener.getAttribute('aria-label')).toBe('Record');
		expect(opener.getAttribute('aria-controls')).toBeNull();
		await click(opener);
		expect(view.events.compose).toHaveBeenCalledOnce();
	});
	it('starts with one mounted hidden composer and emits compose only from the stable Pencil opener', async () => {
		const view = mount({ motion: false });
		const target = view.instance().composerTarget!;
		const opener = view.button('[data-compose-opener]');
		const draft = window.document.createElement('textarea'); draft.value = 'unfinished'; target.append(draft);
		expect(view.root().dataset.composerOpen).toBe('false');
		expect(target.dataset.hidden).toBe('true');
		expect(target.hasAttribute('inert')).toBe(true);
		expect(target.parentElement!.style.height).toBe('44px');
		expect(opener.getAttribute('aria-expanded')).toBe('false');
		await click(opener);
		expect(view.events.compose).toHaveBeenCalledOnce();
		view.instance().openComposer(); await flush();
		expect(view.events.compose).toHaveBeenCalledOnce();
		expect(view.button('[data-compose-opener]')).toBe(opener);
		expect(opener.dataset.hidden).toBe('true');
		expect(target.dataset.hidden).toBe('false');
		expect(target.hasAttribute('inert')).toBe(false);
		view.instance().closeComposer(); await flush();
		expect(target.querySelector('textarea')).toBe(draft);
		expect(draft.value).toBe('unfinished');
		expect(target.parentElement!.style.height).toBe('44px');
	});

	it('uses the send rect for the cap shoulder and opener offsets without hidden-content drift', async () => {
		const view = mount();
		const target = view.instance().composerTarget!;
		const content = window.document.createElement('div');
		const send = window.document.createElement('button'); send.dataset.hk3Send = '';
		content.append(send); target.append(content);
		rect(view.root(), 10, 300, 320, 114);
		rect(target, 10, 286, 320, 194);
		rect(content, 10, 300, 300, 180);
		rect(send, 272, 440, 44, 40);
		resizeCallbacks.forEach(callback => callback()); await flush();
		expect(view.root().style.getPropertyValue('--compose-right')).toBe('14px');
		expect(view.root().style.getPropertyValue('--compose-bottom')).toBe('0px');
		// Moving both composer and send by 14px must not move the button within the dock.
		rect(target, 10, 300, 320, 194);
		rect(send, 272, 454, 44, 40);
		resizeCallbacks.forEach(callback => callback()); await flush();
		expect(view.root().style.getPropertyValue('--compose-bottom')).toBe('0px');
		expect(view.root().querySelector('clipPath path')?.getAttribute('d')).toContain('H 236 C');
	});

	it('closes on app content and timeline scroll, but retains internal, popup, and unrelated focus', async () => {
		const view = mount(); view.target.dataset.hk3Theme = 'light';
		const draft = window.document.createElement('textarea'); view.instance().composerTarget!.append(draft);
		const outside = window.document.createElement('div'); view.target.append(outside);
		const popup = window.document.createElement('div'); popup.setAttribute('role', 'dialog'); view.target.append(popup);
		const feed = window.document.createElement('div'); feed.dataset.timelineTabGestures = ''; view.target.append(feed);
		view.instance().openComposer(); await flush();
		pointer(draft, 'pointerdown'); pointer(popup, 'pointerdown'); await flush();
		expect(view.root().dataset.composerOpen).toBe('true');
		pointer(window.document.body, 'pointerdown'); await flush();
		expect(view.root().dataset.composerOpen).toBe('true');
		pointer(outside, 'pointerdown'); await flush();
		expect(view.root().dataset.composerOpen).toBe('false');
		view.instance().openComposer(); await flush();
		feed.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, bubbles: true }));
		expect(view.root().dataset.composerOpen).toBe('true');
		feed.dispatchEvent(new WheelEvent('wheel', { deltaY: 4, bubbles: true })); await flush();
		expect(view.root().dataset.composerOpen).toBe('false');
		view.instance().openComposer(); await flush();
		key(feed, 'PageDown'); await flush();
		expect(view.root().dataset.composerOpen).toBe('false');
	});

	it('keeps the composer through a downward timeline pull and busy pointerup, but closes on a later ordinary tap', async () => {
		const view = mount({ attachPullGesture: () => ({ dispose: vi.fn() }) });
		view.target.dataset.hk3Theme = 'light';
		const feed = window.document.createElement('div'); feed.dataset.timelineTabGestures = ''; view.target.append(feed);
		view.instance().openComposer(); await flush();
		pointer(feed, 'pointerdown', 40, 100); await flush();
		expect(view.instance().composerOpened).toBe(true);
		pointer(window, 'pointermove', 40, 180); await flush();
		expect(view.instance().composerOpened).toBe(true);
		view.state.pullState = { phase: 'pulling', height: 40, distance: 80, presentation: 'navbar' }; await flush();
		pointer(window, 'pointerup', 40, 180); await flush();
		expect(view.instance().composerOpened).toBe(true);
		expect(view.root().dataset.composerOpen).toBe('true');
		view.state.pullState = { phase: 'idle', height: 0, distance: 0 }; await flush();
		pointer(feed, 'pointerdown', 40, 100); await flush();
		expect(view.instance().composerOpened).toBe(true);
		pointer(window, 'pointerup', 40, 100); await flush();
		expect(view.instance().composerOpened).toBe(false);
		expect(view.root().dataset.composerOpen).toBe('false');
	});

	it.each([{ direction: 'upward', x: 40, y: 60 }, { direction: 'horizontal', x: 90, y: 100 }])('closes the composer on $direction timeline movement after deferring pointerdown', async ({ x, y }) => {
		const view = mount({ attachPullGesture: () => ({ dispose: vi.fn() }) });
		view.target.dataset.hk3Theme = 'light';
		const feed = window.document.createElement('div'); feed.dataset.timelineTabGestures = ''; view.target.append(feed);
		view.instance().openComposer(); await flush();
		pointer(feed, 'pointerdown', 40, 100); await flush();
		expect(view.instance().composerOpened).toBe(true);
		pointer(window, 'pointermove', x, y); await flush();
		expect(view.instance().composerOpened).toBe(false);
		pointer(window, 'pointerup', x, y); await flush();
		expect(view.root().dataset.composerOpen).toBe('false');
	});

	it('honors blocked close, opens from confirmation, and clears overlays for programmatic compose', async () => {
		const view = mount();
		view.instance().openSearch(); await flush();
		view.instance().openComposer(); await flush();
		expect(view.root().dataset.searchOpen).toBe('false');
		expect(view.root().dataset.composerOpen).toBe('true');
		view.state.composerBlocked = true; await flush();
		expect(view.instance().closeComposer()).toBe(false);
		expect(view.root().dataset.composerOpen).toBe('true');
		view.instance().openMenu(); view.instance().openSearch(); await flush();
		expect(view.root().dataset.open).toBe('false');
		expect(view.root().dataset.searchOpen).toBe('false');
		view.instance().closeComposer(true); await flush();
		view.state.confirmationActive = true; await flush();
		expect(view.root().dataset.composerOpen).toBe('true');
		expect(view.instance().composerTarget!.hasAttribute('inert')).toBe(false);
		expect(view.instance().closeComposer()).toBe(false);
		view.state.confirmationActive = false; view.state.composerBlocked = false; await flush();
		view.instance().closeComposer(); await flush();
		view.instance().openMenu(); await flush();
		view.instance().openComposer(); await flush();
		expect(view.root().dataset.open).toBe('false');
		expect(view.root().dataset.composerOpen).toBe('true');
	});

	it('starts hidden on a direct Hatask visit and reuses the composer target when Home returns', async () => {
		const view = mount({ suspended: true, home: false });
		const dock = view.root();
		const composer = view.instance().composerTarget!;
		expect(dock.style.display).toBe('none');
		expect(dock.hasAttribute('inert')).toBe(true);
		expect(view.target.querySelector('[data-mobile-scrim]')).toBeNull();
		view.state.suspended = false;
		view.state.home = true; await flush();
		expect(dock.style.display).not.toBe('none');
		expect(dock.hasAttribute('inert')).toBe(false);
		expect(view.instance().composerTarget).toBe(composer);
		expect(composer.dataset.hidden).toBe('true');
	});

	it('hides immediately on suspension, closes overlays, and retains the teleported draft', async () => {
		const view = mount();
		const dock = view.root();
		const composer = view.instance().composerTarget!;
		const draft = window.document.createElement('textarea');
		draft.value = 'Unsent note';
		composer.append(draft);
		await flush();
		view.instance().openSearch(); await flush();
		expect(view.target.querySelector('[data-mobile-scrim]')).not.toBeNull();
		view.state.suspended = true; await flush();
		expect(dock.style.display).toBe('none');
		expect(dock.hasAttribute('inert')).toBe(true);
		expect(dock.getAttribute('aria-hidden')).toBe('true');
		expect(view.target.querySelector('[data-mobile-scrim]')).toBeNull();
		expect(dock.dataset.searchOpen).toBe('false');
		expect(view.events.searchOpen).toHaveBeenLastCalledWith(false);
		view.instance().openSearch(); view.instance().openMenu(); await flush();
		expect(dock.dataset.searchOpen).toBe('false');
		expect(dock.dataset.open).toBe('false');
		view.state.suspended = false; await flush();
		expect(dock.style.display).not.toBe('none');
		expect(dock.hasAttribute('inert')).toBe(false);
		expect(dock.dataset.searchOpen).toBe('false');
		expect(view.instance().composerTarget).toBe(composer);
		expect(composer.querySelector('textarea')).toBe(draft);
		expect(draft.value).toBe('Unsent note');
	});

	it('cancels a pending menu and long press when suspended', async () => {
		const view = mount({ navigation: null });
		view.instance().openMenu(); await flush();
		expect(view.events.requestTimeline).toHaveBeenCalledOnce();
		view.state.suspended = true;
		view.state.navigation = view.controller; await flush();
		expect(view.root().dataset.open).toBe('false');
		view.state.suspended = false; await flush();
		const home = view.button('[data-home-button]');
		pointer(home, 'pointerdown');
		view.state.suspended = true; await flush();
		await vi.advanceTimersByTimeAsync(600); await flush();
		expect(view.root().dataset.open).toBe('false');
		view.state.suspended = false; await flush();
		expect(view.root().dataset.open).toBe('false');
	});

	it('moves the whole capsule through pull, ready, and refreshing at zero height without replacing the draft or buttons', async () => {
		const view = mount();
		const shell = view.target.querySelector<HTMLElement>('[data-mobile-pull-target]')!;
		const dock = view.root();
		const nav = shell.querySelector('nav')!;
		const home = view.button('[data-home-button]');
		const composer = view.instance().composerTarget!;
		const draft = window.document.createElement('textarea'); draft.value = 'kept draft'; composer.append(draft);
		await flush();
		const body = composer.parentElement!;
		const bodyHeight = parseFloat(body.style.height);
		view.state.pullState = { phase: 'pulling', height: 40, distance: 60 }; await flush();
		expect(dock.style.getPropertyValue('--dock-pull-extension')).toBe('20px');
		expect(body.style.height).toBe(`${bodyHeight + 20}px`);
		expect(dock.style.transform).toBe('translateY(-6px)');
		expect(dock.querySelector('[role="status"]')?.textContent).toBe('Pull down to refresh');
		expect(nav.hasAttribute('inert')).toBe(true);
		expect(composer.hasAttribute('inert')).toBe(true);
		expect(view.target.querySelector('[data-guide]')).toBeNull();
		view.state.pullState = { phase: 'ready', height: 90, distance: 150 }; await flush();
		expect(dock.style.getPropertyValue('--dock-pull-extension')).toBe('40px');
		expect(body.style.height).toBe(`${bodyHeight + 40}px`);
		expect(dock.querySelector('[role="status"]')?.textContent).toBe('Release to refresh');
		view.state.pullState = { phase: 'refreshing', height: 0, distance: 150 }; await flush();
		expect(dock.style.getPropertyValue('--dock-pull-extension')).toBe('0px');
		expect(dock.style.getPropertyValue('--dock-pull-prompt-opacity')).toBe('1');
		expect(dock.style.getPropertyValue('--dock-pull-content-opacity')).toBe('0');
		expect(dock.querySelector('[role="status"]')?.textContent).toBe('Refreshing');
		expect(view.instance().composerTarget).toBe(composer);
		expect(composer.querySelector('textarea')).toBe(draft);
		expect(draft.value).toBe('kept draft');
		expect(view.button('[data-home-button]')).toBe(home);
		expect(shell.querySelector('nav')).toBe(nav);
		expect(body.style.height).toBe(`${bodyHeight}px`);
		view.state.pullState = { phase: 'idle', height: 0, distance: 0 }; await flush();
		expect(dock.querySelector('[role="status"]')?.getAttribute('aria-hidden')).toBe('true');
		expect(dock.querySelector('[role="status"]')?.textContent).toBe('Refreshing');
		expect(dock.style.getPropertyValue('--dock-pull-prompt-opacity')).toBe('0');
		expect(dock.style.getPropertyValue('--dock-pull-content-opacity')).toBe('1');
		expect(dock.style.transform).toBe('');
		expect(nav.hasAttribute('inert')).toBe(false);
		expect(composer.hasAttribute('inert')).toBe(true);
		expect(view.target.querySelector('[data-guide]')).not.toBeNull();
		expect(view.events.dismissGuide).not.toHaveBeenCalled();
		view.state.pullState = { phase: 'returning', height: 20, distance: 60 }; await flush();
		expect(dock.dataset.pullPhase).toBe('returning');
		expect(dock.style.getPropertyValue('--dock-pull-extension')).toBe('10px');
		view.state.pullState = { phase: 'idle', height: 0, distance: 0 }; await flush();
		expect(dock.dataset.pullActive).toBe('false');
	});

	it('keeps navbar presentation geometry and draft unchanged while blocking dock operations until idle', async () => {
		const view = mount();
		const dock = view.root();
		const nav = view.target.querySelector('[data-mobile-pull-target] nav')!;
		const composer = view.instance().composerTarget!;
		const draft = window.document.createElement('textarea'); draft.value = 'navbar pull draft'; composer.append(draft);
		view.instance().openComposer(); await flush();
		const body = composer.parentElement!;
		const height = body.style.height;
		const transform = dock.style.transform;
		for (const phase of ['pulling', 'ready', 'refreshing', 'success', 'error', 'returning'] as const) {
			view.state.pullState = { phase, height: 56, distance: 180, direction: 'down', presentation: 'navbar' }; await flush();
			expect(body.style.height).toBe(height);
			expect(dock.style.transform).toBe(transform);
			expect(dock.style.getPropertyValue('--dock-pull-extension')).toBe('0px');
			expect(dock.dataset.pullActive).toBe('false');
			expect(dock.querySelector('[role="status"]')?.getAttribute('aria-hidden')).toBe('true');
			expect(nav.hasAttribute('inert')).toBe(true);
			expect(composer.hasAttribute('inert')).toBe(true);
			expect(view.instance().closeComposer()).toBe(false);
			view.instance().openMenu(); view.instance().openSearch(); await flush();
			await click(view.button('[aria-label="Menu"]'));
			await click(view.button('[data-mobile-nav-path="/search"]'));
			await click(view.button('[data-mobile-nav-path="/notifications"]'));
			expect(view.events.menu).not.toHaveBeenCalled();
			expect(view.events.searchOpen).not.toHaveBeenCalled();
			expect(view.events.navigate).not.toHaveBeenCalled();
			expect(dock.dataset.open).toBe('false');
			expect(dock.dataset.searchOpen).toBe('false');
			expect(view.instance().composerOpened).toBe(true);
			expect(view.instance().composerTarget).toBe(composer);
			expect(composer.querySelector('textarea')).toBe(draft);
			expect(draft.value).toBe('navbar pull draft');
		}
		view.state.pullState = { phase: 'idle', height: 0, distance: 0 }; await flush();
		expect(nav.hasAttribute('inert')).toBe(false);
		expect(composer.hasAttribute('inert')).toBe(false);
		expect(view.instance().composerOpened).toBe(true);
		await click(view.button('[data-mobile-nav-path="/notifications"]'));
		expect(view.events.navigate).toHaveBeenCalledExactlyOnceWith('/notifications');
		expect(composer.querySelector('textarea')).toBe(draft);
		expect(draft.value).toBe('navbar pull draft');
	});

	it('blocks menu and search during pull and hides feedback behind overlays or off Home', async () => {
		const view = mount({ pullState: { phase: 'pulling', height: 50, distance: 70 } });
		view.instance().openMenu(); view.instance().openSearch(); await flush();
		expect(view.root().dataset.open).toBe('false');
		expect(view.root().dataset.searchOpen).toBe('false');
		await click(view.button('[aria-label="Menu"]'));
		await click(view.button('[data-mobile-nav-path="/search"]'));
		await click(view.button('[data-mobile-nav-path="/notifications"]'));
		expect(view.events.menu).not.toHaveBeenCalled();
		expect(view.events.searchOpen).not.toHaveBeenCalled();
		expect(view.events.navigate).not.toHaveBeenCalled();
		view.state.drawerOpen = true; await flush();
		expect(view.root().querySelector('[role="status"]')?.getAttribute('aria-hidden')).toBe('true');
		view.state.drawerOpen = false; view.state.home = false; await flush();
		expect(view.root().querySelector('[role="status"]')?.getAttribute('aria-hidden')).toBe('true');
		view.state.home = true; view.state.pullState = { phase: 'idle', height: 0, distance: 0 }; await flush();
		view.instance().openMenu(); await flush();
		view.state.pullState = { phase: 'ready', height: 90, distance: 150 }; await flush();
		expect(view.root().querySelector('[role="status"]')?.getAttribute('aria-hidden')).toBe('true');
	});

	it('attaches one shared upward gesture to the nav shell, cancels a pending hold on claim, and disposes it', async () => {
		const dispose = vi.fn();
		const attach = vi.fn((_root: HTMLElement, _onClaim: () => void, _canStart: () => boolean) => ({ dispose }));
		const view = mount({ attachPullGesture: attach }); await flush();
		const [root, onClaim, canStart] = attach.mock.calls[0]!;
		expect(root).toBe(view.target.querySelector('[data-mobile-pull-target]'));
		expect(root.contains(view.instance().composerTarget!)).toBe(false);
		expect(canStart()).toBe(true);
		const home = view.button('[data-home-button]');
		pointer(home, 'pointerdown'); onClaim();
		await vi.advanceTimersByTimeAsync(600); await flush();
		expect(view.root().dataset.open).toBe('false');
		view.state.drawerOpen = true; await flush(); expect(canStart()).toBe(false);
		view.state.drawerOpen = false; view.state.home = false; await flush(); expect(canStart()).toBe(false);
		view.state.attachPullGesture = null; await flush(); expect(dispose).toHaveBeenCalledOnce();
		const nextDispose = vi.fn();
		view.state.attachPullGesture = () => ({ dispose: nextDispose }); await flush();
		cleanups.pop()!(); expect(nextDispose).toHaveBeenCalledOnce();
	});

	it('keeps reduced-motion refresh feedback static', async () => {
		const view = mount({ motion: false, pullState: { phase: 'pulling', height: 40, distance: 60, direction: 'up' } });
		const dock = view.root();
		expect(view.root().dataset.motion).toBe('false');
		expect(dock.querySelector('[role="status"]')?.textContent).toBe('Pull up to refresh');
		expect(dock.querySelector('[role="status"] .ti-arrow-up')).not.toBeNull();
		view.state.pullState = { phase: 'refreshing', height: 0, distance: 150, direction: 'up' }; await flush();
		expect(dock.dataset.pullPhase).toBe('refreshing');
		expect(dock.querySelector('[role="status"]')?.textContent).toBe('Refreshing');
		expect(dock.querySelector('[role="status"] .ti-refresh')).not.toBeNull();
		expect(dock.style.getPropertyValue('--dock-pull-extension')).toBe('0px');
	});

	it('renders parent order, fixed menu, keyboard timeline access, and dismissible first guide', async () => {
		const view = mount();
		expect(view.target.querySelector('[data-guide]')?.textContent).toContain('Tap, hold, slide');
		expect(view.target.querySelector('[data-guide] [aria-hidden="true"] .lucide-pointer')).not.toBeNull();
		expect(view.target.querySelector('[data-caret]')).toBeNull();
		await click(view.button('[data-home-button]'));
		expect(view.events.navigate).toHaveBeenCalledWith('/');
		expect(view.target.querySelector('nav [aria-label="Post"]')).toBeNull();
		key(view.button('[data-home-button]'), 'ArrowUp'); await flush();
		expect(Array.from(view.list().querySelectorAll('[data-choice]')).map(button => (button as HTMLElement).dataset.choice)).toEqual(view.controller.choices.map(choice => choice.id));
		expect(view.events.dismissGuide).toHaveBeenCalledOnce();
		expect(view.events.menuOpen).toHaveBeenCalledWith(true);
		expect(view.button('[aria-label="Menu"]').disabled).toBe(true);
		expect(view.instance().composerTarget?.hasAttribute('inert')).toBe(true);
	});

	it('dismisses the guide once and respects the saved seen flag', async () => {
		const view = mount();
		view.state.items = view.state.items.filter(item => item.path !== '/'); await flush();
		expect(view.target.querySelector('[data-guide] p')?.textContent).toBe('Hold Menu for timelines\nKeep holding and slide to choose');
		expect(view.target.querySelector('[data-guide] .lucide-menu')).not.toBeNull();
		expect(view.target.querySelector('[data-guide] .lucide-house')).toBeNull();
		await click(view.button('[data-guide] button'));
		expect(view.events.dismissGuide).toHaveBeenCalledOnce();
		expect(view.target.querySelector('[data-guide]')).toBeNull();
		view.state.home = false; await flush();
		view.state.home = true; await flush();
		expect(view.target.querySelector('[data-guide]')).toBeNull();
		const seen = mount({ guideSeen: true });
		expect(seen.target.querySelector('[data-guide]')).toBeNull();
	});

	it('keeps the home capture target while the active timeline icon and label change', async () => {
		const view = mount();
		const home = view.button('[data-home-button]');
		expect(home.querySelector('.ti-home')).not.toBeNull();
		expect(home.getAttribute('aria-label')).toBe('Home: Home TL');
		view.state.navigation = { ...view.controller, active: 'antenna' }; await flush();
		expect(view.button('[data-home-button]')).toBe(home);
		expect(home.querySelector('.ti-antenna')).not.toBeNull();
		expect(home.getAttribute('aria-label')).toBe('Home: Antennas');
		await open(view);
		expect(view.button('[data-home-button]')).toBe(home);
		expect(home.getAttribute('aria-label')).toBe('Close');
		view.instance().closeMenu(); await flush();
		view.state.home = false;
		view.state.navigation = null; await flush();
		expect(home.querySelector('.ti-antenna')).not.toBeNull();
		await click(home);
		expect(view.events.navigate).toHaveBeenCalledWith('/');
	});

	it('marks the selected pane item instead of Home while a right pane is shown', async () => {
		const view = mount();
		view.state.items = [
			{ path: '/', label: 'Home', icon: Icon, badge: null, active: false },
			{ path: '/hatask', label: 'Hatask', icon: Icon, badge: null, active: true },
		];
		await flush();
		expect(view.button('[data-home-button]').hasAttribute('aria-current')).toBe(false);
		expect(view.button('[data-mobile-nav-path="/hatask"]').getAttribute('aria-current')).toBe('page');
	});

	it('keeps pointer capture on the same home button while its timeline icon updates', async () => {
		const view = mount();
		const home = await hold(view);
		view.state.navigation = { ...view.controller, active: 'list' }; await flush();
		expect(view.button('[data-home-button]')).toBe(home);
		expect(home.querySelector('.ti-list')).not.toBeNull();
		expect(home.setPointerCapture).toHaveBeenCalledWith(1);
		pointer(window, 'pointermove', 30, 245);
		pointer(window, 'pointerup', 30, 245); await flush();
		expect(view.controller.select).toHaveBeenCalledWith('local');
	});

	it.each([['ContextMenu', {}], ['F10', { shiftKey: true }]])('opens the timeline from %s on the home button', async (name, options) => {
		const view = mount();
		key(view.button('[data-home-button]'), name, options); await flush();
		expect(view.root().dataset.open).toBe('true');
		await click(view.button('[data-home-button]'));
		expect(view.root().dataset.open).toBe('false');
	});

	it('keeps the same Teleport target, composer instance and draft across all visibility states', async () => {
		const view = mount();
		const composerTarget = view.instance().composerTarget!;
		let mounts = 0;
		const composer = createApp({ render: () => h(Teleport, { to: composerTarget }, h({ setup() { mounts++; return () => h('textarea', { value: 'draft' }); } })) });
		const host = window.document.createElement('div'); composer.mount(host);
		cleanups.push(() => composer.unmount());
		await flush();
		const textarea = composerTarget.querySelector('textarea')!;
		textarea.value = 'unsent text';
		await open(view); view.instance().closeMenu(); await flush();
		view.state.home = false; await flush();
		expect(composerTarget.dataset.hidden).toBe('true');
		expect(composerTarget.hasAttribute('inert')).toBe(true);
		view.state.home = true; await flush();
		expect(view.instance().composerTarget).toBe(composerTarget);
		expect(composerTarget.querySelector('textarea')).toBe(textarea);
		expect(textarea.value).toBe('unsent text');
		expect(mounts).toBe(1);
	});

	it('opens search in place and retains search content and the composer draft after closing', async () => {
		const view = mount();
		const target = view.instance().composerTarget!;
		const draft = window.document.createElement('textarea'); draft.value = 'unsent draft'; target.append(draft);
		const search = view.button('[data-mobile-nav-path="/search"]');
		const input = view.target.querySelector<HTMLInputElement>('[data-search-query]')!;
		await click(search);
		expect(view.root().dataset.searchOpen).toBe('true');
		expect(view.events.searchOpen).toHaveBeenLastCalledWith(true);
		expect(view.events.navigate).not.toHaveBeenCalled();
		expect(view.events.requestTimeline).not.toHaveBeenCalled();
		expect(window.document.activeElement).toBe(input);
		expect(search.getAttribute('aria-label')).toBe('Close');
		expect(search.getAttribute('aria-expanded')).toBe('true');
		expect(target.hasAttribute('inert')).toBe(true);
		input.value = 'retained query'; input.dispatchEvent(new Event('input', { bubbles: true }));
		await click(search);
		expect(window.document.activeElement).toBe(search);
		expect(search.getAttribute('aria-label')).toBe('/search');
		await click(search);
		expect(view.target.querySelector('[data-search-query]')).toBe(input);
		expect(input.value).toBe('retained query');
		expect(view.instance().composerTarget).toBe(target);
		expect(target.querySelector('textarea')).toBe(draft);
		expect(draft.value).toBe('unsent draft');
	});

	it('grows and shrinks search within the viewport without resizing the background scroll padding', async () => {
		const view = mount();
		rect(view.root(), 10, 300, 320, 190); resizeCallbacks.forEach(callback => callback());
		await click(view.button('[data-mobile-nav-path="/search"]'));
		await click(view.button('[data-search-expand]'));
		expect(view.instance().composerTarget!.parentElement!.style.height).toBe('320px');
		rect(view.root(), 10, 100, 320, 390); resizeCallbacks.forEach(callback => callback());
		expect(view.instance().dockHeight).toBe(190);
		const input = view.target.querySelector<HTMLInputElement>('[data-search-query]')!; input.focus();
		vi.stubGlobal('innerHeight', 350); window.dispatchEvent(new Event('resize')); await flush();
		expect(view.instance().composerTarget!.parentElement!.style.height).toBe('200px');
		expect(window.document.activeElement).toBe(input);
		await click(view.button('[data-search-compact]'));
		expect(view.instance().composerTarget!.parentElement!.style.height).toBe('59px');
	});

	it('respects IME and inner Escape, traps only Tab edges, and restores focus on outside close', async () => {
		const view = mount(); const search = view.button('[data-mobile-nav-path="/search"]');
		await click(search);
		const input = view.target.querySelector<HTMLInputElement>('[data-search-query]')!;
		key(input, 'Escape', { isComposing: true }); await flush();
		expect(view.root().dataset.searchOpen).toBe('true');
		await click(view.button('[data-search-options]'));
		key(input, 'Escape'); await flush();
		expect(view.root().dataset.searchOpen).toBe('true');
		input.focus();
		const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); input.dispatchEvent(tab);
		expect(tab.defaultPrevented).toBe(false);
		key(input, 'Tab', { shiftKey: true }); expect(window.document.activeElement).toBe(search);
		key(search, 'Tab'); expect(window.document.activeElement).toBe(input);
		await click(view.button('[data-mobile-scrim]'));
		expect(view.root().dataset.searchOpen).toBe('false'); expect(window.document.activeElement).toBe(search);
		await click(search); key(input, 'Escape'); await flush();
		expect(view.root().dataset.searchOpen).toBe('false'); expect(window.document.activeElement).toBe(search);
	});

	it('closes for navigation without stealing the destination or popup focus and excludes timeline/drawer overlays', async () => {
		const view = mount({ navigation: null, home: false });
		await click(view.button('[data-mobile-nav-path="/search"]'));
		expect(view.root().dataset.searchOpen).toBe('true');
		expect(view.events.requestTimeline).not.toHaveBeenCalled();
		view.instance().closeSearch(false);
		const destination = window.document.createElement('button'); window.document.body.append(destination); destination.focus(); await flush();
		expect(window.document.activeElement).toBe(destination);
		destination.remove();
		view.instance().openSearch(); await flush();
		const popup = window.document.createElement('input'); window.document.body.append(popup); popup.focus();
		window.dispatchEvent(new Event('resize')); await flush(); expect(window.document.activeElement).toBe(popup);
		view.instance().closeSearch(); await flush(); expect(window.document.activeElement).toBe(popup); popup.remove();
		view.state.navigation = view.controller; view.state.home = true; await flush();
		view.instance().openSearch(); await flush(); await open(view);
		expect(view.root().dataset.searchOpen).toBe('false'); expect(view.root().dataset.open).toBe('true');
		view.instance().openSearch(); await flush();
		expect(view.root().dataset.open).toBe('false');
		view.state.drawerOpen = true; await flush(); expect(view.root().dataset.searchOpen).toBe('false');
	});

	it('exposes dock height and observes composer content growth without measuring expanded menu height as composer height', async () => {
		const view = mount();
		rect(view.root(), 10, 300, 320, 200);
		const content = window.document.createElement('div');
		view.instance().composerTarget!.append(content);
		rect(content, 10, 300, 300, 180);
		resizeCallbacks.forEach(callback => callback()); await flush();
		expect(view.instance().dockHeight).toBe(200);
		await open(view);
		resizeCallbacks.forEach(callback => callback());
		view.instance().closeMenu(); await flush();
		expect(view.instance().composerTarget!.parentElement!.style.height).toBe('44px');
		view.instance().openComposer(); await flush();
		expect(view.instance().composerTarget!.parentElement!.style.height).toBe('194px');
	});

	it('follows animated composer geometry, ignores visual transitions, and releases tracking when content is removed', async () => {
		const view = mount({ motion: true });
		const content = window.document.createElement('div');
		let height = 120;
		vi.spyOn(content, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, right: 300, bottom: height, width: 300, height, x: 0, y: 0, toJSON: () => ({}) }));
		view.instance().composerTarget!.append(content);
		await flush();
		transition(content, 'transitionrun', 'transform'); await flush();
		expect(view.root().dataset.composerResizing).toBe('false');
		transition(content, 'transitionrun', 'grid-template-rows'); await flush();
		expect(view.root().dataset.composerResizing).toBe('true');
		view.instance().openComposer(); await flush();
		height = 180;
		resizeCallbacks.forEach(callback => callback()); await flush();
		expect(view.instance().composerTarget!.parentElement!.style.height).toBe('194px');
		content.remove(); await flush();
		await vi.advanceTimersByTimeAsync(20); await flush();
		expect(view.root().dataset.composerResizing).toBe('false');
		transition(view.instance().composerTarget!, 'transitionrun', 'height'); await flush();
		expect(view.root().dataset.composerResizing).toBe('false');
	});

	it('preserves the timeline picker height morph while the composer is resizing', async () => {
		const view = mount({ motion: true });
		const content = window.document.createElement('div');
		view.instance().composerTarget!.append(content);
		transition(content, 'transitionrun', 'height'); await flush();
		expect(view.root().dataset.composerResizing).toBe('true');
		await open(view);
		expect(view.root().dataset.pickerMorphing).toBe('true');
		view.instance().closeMenu(); await flush();
		expect(view.root().dataset.open).toBe('false');
		expect(view.root().dataset.pickerMorphing).toBe('true');
		await vi.advanceTimersByTimeAsync(460); await flush();
		expect(view.root().dataset.pickerMorphing).toBe('false');
		transition(content, 'transitioncancel', 'height');
		await vi.advanceTimersByTimeAsync(20); await flush();
		expect(view.root().dataset.composerResizing).toBe('false');
	});

	it('loads collections using the controller and routes settings immediately without selecting a timeline', async () => {
		const view = mount(); await open(view);
		await click(view.choice('antenna'));
		expect(view.controller.load).toHaveBeenCalledWith('antenna');
		expect(view.controller.select).not.toHaveBeenCalled();
		expect(view.choice('a').getAttribute('aria-pressed')).toBe('true');
		expect(view.target.querySelector('[data-edit]')).toBeNull();
		await click(view.button('[data-action="settings"]'));
		expect(view.controller.settings).toHaveBeenCalledWith('antenna');
		expect(view.root().dataset.open).toBe('false');
		await open(view); await click(view.choice('list')); await click(view.choice('b'));
		expect(view.controller.selectCollection).toHaveBeenCalledWith('list', 'b');
	});

	it('exposes a home-only collection entry for the parent empty/error timeline controls', async () => {
		const view = mount();
		await view.instance().openCollection('list'); await flush();
		expect(view.controller.load).toHaveBeenCalledWith('list');
		expect(view.list().dataset.view).toBe('list');
		expect(view.choice('a')).not.toBeNull();
		view.instance().closeMenu(); await flush();
		view.state.home = false; await flush();
		await view.instance().openCollection('antenna'); await flush();
		expect(view.root().dataset.open).toBe('false');
		expect(view.controller.load).toHaveBeenCalledOnce();
		expect(view.events.requestTimeline).not.toHaveBeenCalled();
	});

	it('renders options with checked/disabled state and forwards LIVE/RSS actions', async () => {
		const view = mount(); await open(view);
		await click(view.button('[aria-label="Options"]'));
		const live = view.button('[role="checkbox"][aria-checked="true"]');
		await click(live);
		expect(view.controller.options[0].action).toHaveBeenCalledOnce();
		await click(Array.from(view.list().querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'RSS')!);
		expect(view.controller.options[1].action).toHaveBeenCalledOnce();
		expect(view.button('[role="checkbox"][aria-checked="false"]').disabled).toBe(true);
		key(view.button('[data-action="back"]'), 'Escape'); await flush();
		expect(view.list().dataset.view).toBe('root');
	});

	it('navigates on a short pointer tap and keeps keyboard Tab at the stable held capture target', async () => {
		const view = mount(); const button = view.button('[data-home-button]'); rect(button, 20, 440, 44, 52);
		pointer(button, 'pointerdown'); await vi.advanceTimersByTimeAsync(100);
		pointer(window, 'pointerup'); await click(button);
		expect(view.events.navigate).toHaveBeenCalledWith('/');
		expect(view.root().dataset.open).toBe('false');
		await hold(view);
		const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
		button.dispatchEvent(tab);
		expect(tab.defaultPrevented).toBe(true);
		expect(window.document.activeElement).toBe(button);
	});

	it('short home taps do not open a menu; held slide release selects once and consumes late clicks', async () => {
		const view = mount(); const home = await hold(view);
		pointer(window, 'pointermove', 30, 245); pointer(window, 'pointerup', 30, 245); await flush();
		expect(view.controller.select).toHaveBeenCalledWith('local');
		expect(view.controller.select).toHaveBeenCalledOnce();
		await click(home);
		expect(view.events.navigate).not.toHaveBeenCalled();
		expect(home.setPointerCapture).toHaveBeenCalledWith(1);
		expect(home.releasePointerCapture).toHaveBeenCalledWith(1);
	});

	it('waits 300ms for branch dwell, requires 10px movement after branch load and retains capture', async () => {
		const view = mount(); const home = await hold(view);
		pointer(window, 'pointermove', 30, 135);
		await vi.advanceTimersByTimeAsync(299);
		expect(view.controller.load).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1); await flush(); geometry(view, true);
		expect(view.controller.load).toHaveBeenCalledOnce();
		pointer(window, 'pointermove', 35, 135); pointer(window, 'pointerup', 35, 135); await flush();
		expect(view.controller.selectCollection).not.toHaveBeenCalled();
		expect(view.root().dataset.open).toBe('true');
		expect(home.setPointerCapture).toHaveBeenCalledOnce();
		view.instance().closeMenu(); await flush(); await hold(view);
		pointer(window, 'pointermove', 30, 135); await vi.advanceTimersByTimeAsync(300); await flush(); geometry(view, true);
		pointer(window, 'pointermove', 30, 195); pointer(window, 'pointerup', 30, 195); await flush();
		expect(view.controller.selectCollection).toHaveBeenCalledWith('antenna', 'b');
	});

	it('opens a branch on release, cancels dwell when moving away, and ignores outside releases', async () => {
		const view = mount(); await hold(view);
		pointer(window, 'pointermove', 30, 135); pointer(window, 'pointermove', 400, 90);
		await vi.advanceTimersByTimeAsync(350);
		expect(view.controller.load).not.toHaveBeenCalled();
		pointer(window, 'pointerup', 400, 90); await flush();
		expect(view.controller.select).not.toHaveBeenCalled();
		expect(view.root().dataset.open).toBe('true');
		view.instance().closeMenu(); await flush(); await hold(view);
		pointer(window, 'pointermove', 180, 135); pointer(window, 'pointerup', 180, 135); await flush();
		expect(view.controller.load).toHaveBeenCalledWith('list');
		expect(view.controller.selectCollection).not.toHaveBeenCalled();
	});

	it('slides onto Back and settings with the same capture and re-arms after each view', async () => {
		const view = mount(); await hold(view);
		pointer(window, 'pointermove', 30, 135); await vi.advanceTimersByTimeAsync(300); await flush(); geometry(view, true);
		pointer(window, 'pointermove', 30, 70); await vi.advanceTimersByTimeAsync(300); await flush(); geometry(view);
		expect(view.list().dataset.view).toBe('root');
		await vi.advanceTimersByTimeAsync(600);
		expect(view.controller.load).toHaveBeenCalledOnce();
		pointer(window, 'pointermove', 180, 135); await vi.advanceTimersByTimeAsync(300); await flush(); geometry(view, true);
		pointer(window, 'pointermove', 280, 70); pointer(window, 'pointerup', 280, 70); await flush();
		expect(view.controller.settings).toHaveBeenCalledWith('list');
	});

	it.each(['pointercancel', 'lostpointercapture', 'resize', 'blur', 'secondPointer', 'Escape'])('interrupts %s without selection or synthetic click', async reason => {
		const view = mount(); const home = await hold(view);
		pointer(window, 'pointermove', 30, 135);
		if (reason === 'secondPointer') pointer(window, 'pointerdown', 10, 10, 2);
		else if (reason === 'Escape') key(home, 'Escape');
		else if (reason === 'resize' || reason === 'blur') window.dispatchEvent(new Event(reason));
		else pointer(reason === 'lostpointercapture' ? home : window, reason);
		await vi.advanceTimersByTimeAsync(600); pointer(window, 'pointerup', 30, 135); await click(home);
		expect(view.controller.select).not.toHaveBeenCalled();
		expect(view.controller.load).not.toHaveBeenCalled();
		expect(view.events.navigate).not.toHaveBeenCalled();
		expect(view.root().dataset.open).toBe('true');
	});

	it('keeps an off-home held pointer while requesting navigation and opening after controller arrival', async () => {
		const view = mount({ navigation: null, home: false }); const home = await hold(view);
		expect(view.events.requestTimeline).toHaveBeenCalledOnce();
		expect(view.root().dataset.open).toBe('false');
		view.state.home = true; view.state.navigation = view.controller; await flush(); geometry(view);
		expect(view.root().dataset.open).toBe('true');
		pointer(window, 'pointermove', 30, 245); pointer(window, 'pointerup', 30, 245); await flush();
		expect(view.controller.select).toHaveBeenCalledWith('local');
		expect(home.setPointerCapture).toHaveBeenCalledOnce();
	});

	it('does not re-open when a pending off-home gesture was canceled before controller arrival', async () => {
		const view = mount({ navigation: null, home: false }); await hold(view);
		pointer(window, 'pointercancel');
		view.state.navigation = view.controller; await flush();
		expect(view.root().dataset.open).toBe('false');
	});

	it('renders five configurable items plus menu, caps a sixth, and preserves order when items change', async () => {
		const view = mount();
		view.state.items = ['/search', '/notifications', '/hatask', '/hatady', '/', '/widgets'].map(path => ({ path, label: path, icon: Icon, badge: null, active: false })); await flush();
		const paths = () => [...view.target.querySelectorAll<HTMLElement>('[data-mobile-nav-path]')].map(button => button.dataset.mobileNavPath);
		expect(paths()).toEqual(['/search', '/notifications', '/hatask', '/hatady', '/']);
		expect(view.target.querySelectorAll('nav > *')).toHaveLength(6);
		expect(view.target.querySelector('[data-timeline-opener]')).toBeNull();
		const home = view.button('[data-home-button]');
		view.state.items = [view.state.items[4]!, view.state.items[0]!, view.state.items[1]!, view.state.items[2]!, view.state.items[3]!, view.state.items[5]!]; await flush();
		expect(paths()).toEqual(['/', '/search', '/notifications', '/hatask', '/hatady']);
		expect(view.button('[data-home-button]')).toBe(home);
		view.state.items = view.state.items.slice(0, 2); await flush();
		expect(paths()).toEqual(['/', '/search']);
		expect(view.target.querySelectorAll('nav > *')).toHaveLength(3);
	});

	it('uses the menu for short taps and TL holds when Home is outside the five slots', async () => {
		const view = mount(); view.state.items = ['/search', '/notifications', '/settings', '/hatask', '/hatady', '/'].map(path => ({ path, label: path, icon: Icon, badge: null, active: false })); await flush();
		expect(view.target.querySelector('[data-home-button]')).toBeNull();
		expect(view.target.querySelectorAll('nav > *')).toHaveLength(6);
		const menu = view.button('[data-timeline-opener]');
		await click(menu);
		expect(view.events.menu).toHaveBeenCalledOnce();
		expect(view.root().dataset.open).toBe('false');
		key(menu, 'ArrowUp'); await flush();
		expect(view.root().dataset.open).toBe('true');
		expect(menu.getAttribute('aria-label')).toBe('Close');
		expect(menu.querySelector('.lucide-x')).not.toBeNull();
		await click(menu);
		expect(view.root().dataset.open).toBe('false');
		expect(menu.getAttribute('aria-label')).toBe('Menu');
		await hold(view);
		expect(menu.setPointerCapture).toHaveBeenCalledWith(1);
		expect(view.root().dataset.open).toBe('true');
		pointer(window, 'pointermove', 30, 245); pointer(window, 'pointerup', 30, 245); await flush();
		await click(menu);
		expect(view.controller.select).toHaveBeenCalledWith('local');
		expect(view.events.menu).toHaveBeenCalledOnce();
	});

	it('only saves completed reorder changes, restores canceled drags, and blocks edit selection', async () => {
		const view = mount(); await open(view);
		expect(view.button('[data-edit] .lucide-pencil')).not.toBeNull();
		await click(view.button('[data-edit]'));
		await click(view.choice('home'));
		expect(view.controller.select).not.toHaveBeenCalled();
		key(view.choice('antenna'), 'ArrowDown', { altKey: true }); await flush();
		expect(view.controller.reorder).toHaveBeenLastCalledWith(['list', 'global', 'antenna', 'social', 'local', 'home']);
		geometry(view);
		const before = Array.from(view.list().querySelectorAll<HTMLElement>('[data-choice]')).map(button => button.dataset.choice);
		pointer(view.button('[data-handle="antenna"]'), 'pointerdown', 30, 195);
		pointer(window, 'pointermove', 180, 245); await flush();
		expect(view.controller.reorder).toHaveBeenCalledOnce();
		pointer(window, 'pointercancel'); await flush();
		expect(Array.from(view.list().querySelectorAll<HTMLElement>('[data-choice]')).map(button => button.dataset.choice)).toEqual(before);
		expect(view.controller.reorder).toHaveBeenCalledOnce();
		geometry(view); pointer(view.button('[data-handle="antenna"]'), 'pointerdown', 30, 195);
		pointer(window, 'pointermove', 180, 245); await flush(); geometry(view);
		pointer(window, 'pointerup', 180, 245); await flush();
		expect(view.controller.reorder).toHaveBeenCalledTimes(2);
	});

	it.each(['outside', 'lostpointercapture', 'resize', 'blur', 'secondPointer', 'Escape'])('restores the drag-start reorder on %s without saving', async reason => {
		const view = mount(); await open(view); await click(view.button('[data-edit]')); geometry(view);
		const before = view.controller.choices.map(choice => choice.id);
		pointer(view.button('[data-handle="antenna"]'), 'pointerdown', 30, 135);
		pointer(window, 'pointermove', 180, 245); await flush();
		if (reason === 'outside') pointer(window, 'pointerup', 500, 245);
		else if (reason === 'lostpointercapture') pointer(view.list(), reason);
		else if (reason === 'secondPointer') pointer(window, 'pointerdown', 0, 0, 2);
		else if (reason === 'Escape') key(view.choice('home'), 'Escape');
		else window.dispatchEvent(new Event(reason));
		await flush();
		expect(Array.from(view.list().querySelectorAll<HTMLElement>('[data-choice]')).map(button => button.dataset.choice)).toEqual(before);
		expect(view.controller.reorder).not.toHaveBeenCalled();
	});

	it('traps Tab, supports grid arrows and layered Escape, and lets external popup focus remain outside', async () => {
		const view = mount(); await open(view);
		view.choice('antenna').focus(); key(view.choice('antenna'), 'ArrowDown');
		expect(window.document.activeElement).toBe(view.choice('global'));
		key(view.choice('global'), 'End'); expect(window.document.activeElement).toBe(view.choice('home'));
		view.button('[data-home-button]').focus(); key(view.button('[data-home-button]'), 'Tab');
		expect(window.document.activeElement).toBe(view.button('[aria-label="Options"]'));
		key(view.button('[aria-label="Options"]'), 'Tab', { shiftKey: true });
		expect(window.document.activeElement).toBe(view.button('[data-home-button]'));
		await click(view.choice('list')); key(view.choice('a'), 'Escape'); await flush();
		expect(view.list().dataset.view).toBe('root');
		expect(window.document.activeElement).toBe(view.choice('list'));
		const popup = window.document.createElement('button'); window.document.body.append(popup); popup.focus();
		expect(window.document.activeElement).toBe(popup); popup.remove();
		key(view.choice('home'), 'Escape'); await flush(); expect(view.root().dataset.open).toBe('false');
	});

	it('ignores stale asynchronous loads on close or branch replacement; offers retry after load failure', async () => {
		const view = mount(); let resolve!: (result: { id: string; name: string }[]) => void;
		view.controller.load = vi.fn(() => new Promise<{ id: string; name: string }[]>(done => { resolve = done; }));
		await open(view); await click(view.choice('list'));
		expect(view.list().textContent).toContain('Loading');
		view.instance().closeMenu(); await open(view);
		resolve([{ id: 'old', name: 'Old' }]); await flush();
		expect(view.target.querySelector('[data-choice="old"]')).toBeNull();
		view.state.navigation!.load = vi.fn(async () => null);
		await click(view.choice('list'));
		expect(view.list().textContent).toContain('Failed');
		view.state.navigation!.load = vi.fn(async () => [{ id: 'new', name: 'New' }]);
		await click(view.button('[data-view] button'));
		expect(view.choice('new')).not.toBeNull();
	});

	it('collapses the body to zero with the parent auto-hidden wrapper, and clamps long content to a scrolling area', async () => {
		const view = mount();
		const wrapper = window.document.createElement('div'); view.instance().composerTarget!.append(wrapper);
		rect(wrapper, 0, 0, 300, 0); resizeCallbacks.forEach(callback => callback()); await flush();
		expect(view.instance().composerTarget!.parentElement!.style.height).toBe('44px');
		rect(wrapper, 0, 0, 300, 900); resizeCallbacks.forEach(callback => callback()); await flush();
		expect(view.root().dataset.overflow).toBe('true');
		view.instance().openComposer(); await flush();
		expect(parseInt(view.instance().composerTarget!.parentElement!.style.height)).toBeLessThan(900);
	});

	it('accepts a collection response after LIVE options replace the navigation controller', async () => {
		const view = mount(); let resolve!: (value: { id: string; name: string }[]) => void;
		view.state.navigation!.load = vi.fn(() => new Promise<{ id: string; name: string }[]>(done => { resolve = done; }));
		await open(view); await click(view.choice('list'));
		view.state.navigation = { ...view.state.navigation!, options: [] }; await flush();
		resolve([{ id: 'fresh', name: 'Fresh' }]); await flush();
		expect(view.choice('fresh')?.textContent).toContain('Fresh');
	});

	it('corrects keyboard occlusion with visualViewport offset and removes its scroll/resize listeners on unmount', async () => {
		const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 30, scale: 1 });
		vi.stubGlobal('innerHeight', 800); vi.stubGlobal('visualViewport', viewport);
		const add = vi.spyOn(viewport, 'addEventListener'); const remove = vi.spyOn(viewport, 'removeEventListener');
		const view = mount(); await flush();
		expect(view.root().style.getPropertyValue('--keyboard-inset')).toBe('370px');
		viewport.offsetTop = 80; viewport.dispatchEvent(new Event('scroll')); await flush();
		expect(view.root().style.getPropertyValue('--keyboard-inset')).toBe('320px');
		viewport.scale = 2; viewport.dispatchEvent(new Event('resize')); await flush();
		expect(view.root().style.getPropertyValue('--keyboard-inset')).toBe('0px');
		const added = add.mock.calls.map(([type, listener]) => [type, listener]);
		cleanups.pop()!();
		for (const [type, listener] of added) expect(remove).toHaveBeenCalledWith(type, listener);
	});

	it.each(['visible', 'pageshow'])('recomputes a stale keyboard inset immediately and after %s settles', async event => {
		const viewport = Object.assign(new EventTarget(), { height: 400, offsetTop: 30, scale: 1 });
		vi.stubGlobal('innerHeight', 800); vi.stubGlobal('visualViewport', viewport);
		const hidden = vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
		const added = vi.spyOn(window, 'addEventListener');
		const removed = vi.spyOn(window, 'removeEventListener');
		cleanups.push(() => { hidden.mockRestore(); added.mockRestore(); removed.mockRestore(); });
		const view = mount(); await flush();
		expect(view.root().style.getPropertyValue('--keyboard-inset')).toBe('370px');
		hidden.mockReturnValue(true);
		window.document.dispatchEvent(new Event('visibilitychange'));
		viewport.height = 600; viewport.offsetTop = 0;
		hidden.mockReturnValue(false);
		const resume = () => {
			if (event === 'visible') window.document.dispatchEvent(new Event('visibilitychange'));
			else window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
		};
		resume(); await flush();
		expect(view.root().style.getPropertyValue('--keyboard-inset')).toBe('200px');
		viewport.height = 700;
		await vi.advanceTimersByTimeAsync(100); await flush();
		expect(view.root().style.getPropertyValue('--keyboard-inset')).toBe('100px');
		viewport.height = 800;
		await vi.advanceTimersByTimeAsync(250); await flush();
		expect(view.root().style.getPropertyValue('--keyboard-inset')).toBe('0px');
		const registration = added.mock.calls.find(([type]) => type === 'pageshow')!;
		resume(); resume(); await flush();
		expect(added.mock.calls.filter(([type]) => type === 'pageshow')).toHaveLength(1);
		const element = view.root();
		const measure = vi.spyOn(element, 'getBoundingClientRect');
		cleanups.pop()!();
		expect(removed).toHaveBeenCalledWith(...registration);
		measure.mockClear();
		resume();
		viewport.height = 400;
		await vi.advanceTimersByTimeAsync(500); await flush();
		expect(measure).not.toHaveBeenCalled();
		measure.mockRestore();
	});

	it('excludes fading view and picker buttons from focus and consumes no pending timers after teardown', async () => {
		const view = mount({ motion: true }); await open(view);
		await click(view.choice('list'));
		const leaving = view.target.querySelector('[data-view="root"]');
		expect(leaving?.hasAttribute('inert')).toBe(true);
		expect(leaving?.getAttribute('aria-hidden')).toBe('true');
		key(view.button('[data-home-button]'), 'Tab');
		expect(window.document.activeElement?.closest('[inert]')).toBeNull();
		await vi.advanceTimersByTimeAsync(600); await flush();
		view.choice('a').focus(); key(view.choice('a'), 'ArrowDown');
		expect(window.document.activeElement).toBe(view.choice('b'));
		view.instance().closeMenu(); await flush();
		expect(view.target.querySelector('[data-editing]')?.hasAttribute('inert')).toBe(true);
		cleanups.pop()!();
		await vi.advanceTimersByTimeAsync(1000);
		expect(view.controller.select).not.toHaveBeenCalled();
	});

	it('closes on scrim click/drawer and respects low viewport and reduced-motion opt-out', async () => {
		const view = mount({ motion: false }); await open(view);
		expect(view.root().dataset.motion).toBe('false');
		vi.stubGlobal('innerHeight', 280); window.dispatchEvent(new Event('resize')); await flush();
		expect(parseInt(view.instance().composerTarget!.parentElement!.style.height)).toBeLessThanOrEqual(130);
		await click(view.target.querySelector('[data-mobile-scrim]')!);
		expect(view.root().dataset.open).toBe('false');
		await open(view); view.state.drawerOpen = true; await flush();
		expect(view.root().dataset.open).toBe('false');
	});
});

describe('inline confirmation interaction boundary', () => {
	it('blocks dock navigation without blocking or remounting the teleported composer', async () => {
		const view = mount({ confirmationActive: false, guideSeen: true });
		await flush();
		const composer = view.instance().composerTarget;
		expect(composer).not.toBeNull();
		const input = window.document.createElement('input');
		input.value = 'preserved draft';
		composer!.append(input);
		view.state.confirmationActive = true;
		await flush();
		expect(view.target.querySelector('nav')?.hasAttribute('inert')).toBe(true);
		expect(input.closest('[inert]')).toBeNull();
		view.state.confirmationActive = false;
		await flush();
		expect(view.target.querySelector('nav')?.hasAttribute('inert')).toBe(false);
		expect(view.instance().composerTarget).toBe(composer);
		expect(input.value).toBe('preserved draft');
	});
});
