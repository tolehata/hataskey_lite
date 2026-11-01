/* SPDX-License-Identifier: AGPL-3.0-only */
/* eslint-disable vue/one-component-per-file -- Test doubles isolate the result list and form fields from network state. */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, KeepAlive, nextTick, provide, ref, Suspense } from 'vue';
import Search from './search.vue';
import type { App, PropType, Ref } from 'vue';
import type { PageHeaderItem } from '@/types/page-header.js';
import Hk3SidePageContent from '@/components/hataskey3/Hk3SidePageContent.vue';
import MkPageHeader from '@/components/global/MkPageHeader.vue';
import CPPageHeader from '@/components/global/CPPageHeader.vue';
import { DI } from '@/di.js';
import { prefer } from '@/preferences.js';
import { definePage } from '@/page.js';
import { instance } from '@/instance.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useRouter } from '@/router.js';

const requests = vi.hoisted(() => [] as { endpoint: string; params: Record<string, unknown> }[]);
const paginators = vi.hoisted(() => [] as { items: Ref<{ id: string }[]>; fetching: Ref<boolean>; error: Ref<boolean> }[]);
const permissions = vi.hoisted(() => ({ notesSearchAvailable: true, usersSearchAvailable: true }));
vi.mock('@/utility/paginator.js', async () => {
	const { ref: state } = await import('vue');
	return { Paginator: class {
		items = state([{ id: 'result' }]);
		fetching = state(false);
		error = state(false);
		constructor(endpoint: string, options: { params: Record<string, unknown> }) {
			requests.push({ endpoint, params: options.params });
			paginators.push(this);
		}
	} };
});
vi.mock('@/preferences.js', async () => {
	const { ref: state } = await import('vue');
	return { prefer: { r: { animation: state(false) }, s: { animation: false, useBlurEffect: false } } };
});
vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop', DEFAULT_DEVICE_KIND: 'desktop' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	search: '検索', searchResult: '検索結果', clear: 'クリア', options: 'オプション', notes: 'ノート', users: 'ユーザー', events: 'イベント',
	all: 'すべて', local: 'ローカル', remote: 'リモート', reverseChronological: '新しい順', sort: 'ソート', goBack: '戻る', noNotes: 'ノートはありません', noUsers: 'ユーザーはいません',
	selectSelf: '自分を選択', selectUser: 'ユーザーを選択', notesSearchNotAvailable: 'ノート検索は利用できません', usersSearchNotAvailable: 'ユーザー検索は利用できません',
	_search: { searchTarget: '検索対象', searchScope: '検索範囲', searchScopeAll: 'すべて', searchScopeLocal: 'ローカル', searchScopeServer: 'サーバー', searchScopeUser: 'ユーザー指定', pleaseSelectUser: 'ユーザーを選択', notePlaceholder: 'ノートを検索', userPlaceholder: 'ユーザーを検索', eventPlaceholder: 'イベントを検索', postFrom: '開始', postTo: '終了' },
	_event: { startDate: '開始日', endDate: '終了日' },
} } }));
vi.mock('@/instance.js', async () => {
	const { reactive } = await import('vue');
	return { instance: reactive({ federation: 'none', noteSearchableScope: 'local' }) };
});
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/page.js', () => ({ definePage: vi.fn(), isExactHataAppTitle: () => false }));
vi.mock('@/os.js', () => ({ popupMenu: vi.fn(), confirm: vi.fn(async () => ({ canceled: true })), selectUser: vi.fn(), promiseDialog: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn(async () => ({ id: 'author', username: 'author', host: null })) }));
vi.mock('@/utility/check-permissions.js', () => permissions);
vi.mock('@/router.js', async () => {
	const { ref: state } = await import('vue');
	const router = { currentRoute: state({ name: 'search', path: '/search' }), push: vi.fn(), pushByPath: vi.fn() };
	return { mainRouter: router, useRouter: () => router };
});
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => null, getItemAsJson: () => null, setItemAsJson: vi.fn(), removeItem: vi.fn() } }));
vi.mock('@/accounts.js', () => ({ getAccountMenu: vi.fn() }));
vi.mock('@/events.js', () => ({ globalEvents: {} }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/utility/scroll-to-visibility.js', async () => {
	const { ref: state } = await import('vue');
	return { scrollToVisibility: () => ({ showEl: state(false) }) };
});
vi.mock('@@/js/scroll.js', () => ({ getScrollPosition: () => 0, scrollToTop: vi.fn() }));
vi.mock('@@/js/config.js', () => ({ host: 'example.invalid' }));
vi.mock('@/components/global/MkPageHeader.tabs.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkFollowButton.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkInput.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ props: { modelValue: { type: String, default: '' } }, emits: ['update:modelValue'], setup: (props, { emit }) => () => render('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }) }) };
});
vi.mock('@/components/MkSelect.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({ props: { modelValue: { type: String, default: '' }, items: { type: Array as PropType<{ value: string; label: string }[]>, required: true } }, emits: ['update:modelValue'], setup: (props, { emit }) => () => render('select', { value: props.modelValue, onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value) }, props.items.map(item => render('option', { value: item.value }, item.label))) }) };
});
vi.mock('@/components/MkButton.vue', () => ({ default: { template: '<button><slot/></button>' } }));
vi.mock('@/components/MkInfo.vue', () => ({ default: { template: '<p><slot/></p>' } }));
vi.mock('@/components/MkFoldableSection.vue', () => ({ default: { template: '<section><slot name="header"/><slot/></section>' } }));
vi.mock('@/components/MkNotesTimeline.vue', () => ({ default: { props: ['paginator', 'getDate'], template: '<article data-results>最後のノート<button>リアクション</button></article>' } }));
vi.mock('@/components/MkUserList.vue', () => ({ default: { props: ['paginator'], template: '<article data-results>ユーザー</article>' } }));
vi.mock('@/components/MkUserCardMini.vue', () => ({ default: { props: ['user'], template: '<span>{{ user.username }}</span>' } }));

let app: App | undefined;
let host: HTMLElement;
let width = 390;
let reduced = false;
const warnings: string[] = [];
let resizeCallbacks: ResizeObserverCallback[];
type Motion = { frames: Keyframe[]; options: KeyframeAnimationOptions; cancel: ReturnType<typeof vi.fn>; finish: () => void };
let motions: Motion[];
const searchActive = ref(true);
const embeddedActive = ref(true);
const embeddedMaxHeight = ref(320);
const heights: number[] = [];
const close = vi.fn();
const searchRef = ref<{ focus: () => void } | null>(null);

async function flush() {
	for (let i = 0; i < 5; i++) await nextTick();
}

function element<T extends Element = HTMLElement>(selector: string): T {
	const found = host.querySelector<T>(selector) ?? window.document.body.querySelector<T>(selector);
	if (!found) throw new Error(`Missing ${selector}`);
	return found;
}

async function mount(mode: 'standard' | 'compact' = 'standard', props: Record<string, unknown> = {}, inWindow = false, containedControls?: Ref<boolean>) {
	const PageWithHeader = defineComponent({
		props: { actions: { type: Array as PropType<PageHeaderItem[]>, required: true } },
		setup(header, { slots }) {
			provide(DI.pageMetadata, ref({ title: '検索', icon: 'ti ti-search' }));
			return () => h('main', { 'data-page': true }, [h(mode === 'standard' ? MkPageHeader : CPPageHeader, { actions: header.actions }), slots.default?.()]);
		},
	});
	const OtherPage = defineComponent({ render: () => h('p', '別のページ') });
	const page = () => h(KeepAlive, null, { default: () => h(Suspense, null, { default: () => searchActive.value ? h(Search, {
		query: '旗鯖', ...props, ref: searchRef,
		...(props.embedded ? { active: embeddedActive.value, maxHeight: embeddedMaxHeight.value, onHeight: (height: number) => heights.push(height), onClose: close } : {}),
	}) : h(OtherPage) }) });
	app = createApp({ render: () => containedControls
		? h(Hk3SidePageContent, { omitHeaderTitle: false, containedControls: containedControls.value }, { default: page })
		: page() });
	app.provide('inWindow', inWindow);
	app.component('PageWithHeader', PageWithHeader);
	app.component('MkAvatar', { render: () => null });
	app.component('MkUserName', { render: () => null });
	app.directive('tooltip', {});
	app.config.warnHandler = message => warnings.push(message);
	app.mount(host);
	await flush();
}

async function submit() {
	element<HTMLInputElement>('input[type=search]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	await flush();
}

async function resizePage(paneWidth: number) {
	for (const callback of resizeCallbacks) callback([{ contentRect: { width: paneWidth } }] as ResizeObserverEntry[], {} as ResizeObserver);
	await flush();
}

beforeEach(() => {
	width = 390; reduced = false; resizeCallbacks = []; motions = []; requests.length = 0; paginators.length = 0; warnings.length = 0; heights.length = 0;
	vi.clearAllMocks();
	Object.assign(instance, { federation: 'none', noteSearchableScope: 'local' });
	permissions.notesSearchAvailable = true; permissions.usersSearchAvailable = true;
	embeddedActive.value = true; embeddedMaxHeight.value = 320; searchRef.value = null;
	vi.mocked(os.confirm).mockResolvedValue({ canceled: true });
	prefer.r.animation.value = false;
	searchActive.value = true;
	host = window.document.createElement('div'); window.document.body.append(host);
	vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => width);
	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width);
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
		observe() {}
		disconnect() {}
	});
	vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; } }));
	// Geometry is synthetic: these tests verify transition/state handling, not browser layout.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		if (this.matches('button[aria-controls]')) return new DOMRect(width - 56, 4, 44, 44);
		if (this.matches('[role=search]')) return new DOMRect(12, this.dataset.docked === 'true' ? 56 : 700, width - 24, 64);
		return new DOMRect(0, 0, width, 844);
	});
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation((frames, options) => {
		let finish!: () => void;
		let reject!: (reason: Error) => void;
		const finished = new Promise<void>((resolve, failure) => { finish = resolve; reject = failure; });
		const cancel = vi.fn(() => reject(new Error('cancelled')));
		motions.push({ frames: frames as Keyframe[], options: options as KeyframeAnimationOptions, cancel, finish });
		return { finished, cancel } as unknown as Animation;
	});
});

afterEach(async () => {
	app?.unmount(); app = undefined; await flush(); host.remove();
	vi.restoreAllMocks(); vi.unstubAllGlobals();
	expect(warnings).toEqual([]);
});

describe('mobile search toolbar', () => {
	test('desktop side page keeps a narrow search inline after results appear', async () => {
		width = 1200;
		const contained = ref(true);
		await mount('standard', {}, false, contained);
		await resizePage(480);
		const page = element('[data-page]');
		const panel = element('[role=search]');
		await submit();
		expect(page.contains(panel)).toBe(true);
		expect(panel.parentElement).not.toBe(window.document.body);
		expect(panel.dataset.mobile).toBe('false');
		expect(panel.style.display).toBe('');
		expect(host.querySelector('button[aria-controls]')).toBeNull();
		expect(page.contains(element('[data-results]'))).toBe(true);
		expect(requests).toHaveLength(1);
	});

	test('side page context changes and split/full widths preserve one query, result, and control', async () => {
		width = 1200;
		const contained = ref(true);
		await mount('standard', {}, false, contained);
		await resizePage(480);
		await submit();
		const input = element<HTMLInputElement>('input[type=search]');
		const panel = element('[role=search]');
		const result = element('[data-results]');
		for (const paneWidth of [1200, 480]) {
			await resizePage(paneWidth);
			expect(host.contains(panel)).toBe(true);
			expect(panel.style.display).toBe('');
		}
		contained.value = false; await flush();
		expect(panel.parentElement).toBe(window.document.body);
		expect(panel.dataset.mobile).toBe('true');
		expect(panel.style.display).toBe('none');
		contained.value = true; await flush();
		expect(host.contains(panel)).toBe(true);
		expect(panel.style.display).toBe('');
		expect(element<HTMLInputElement>('input[type=search]')).toBe(input);
		expect(input.value).toBe('旗鯖');
		expect(element('[data-results]')).toBe(result);
		expect(host.querySelectorAll('[role=search]')).toHaveLength(1);
		expect(window.document.body.querySelectorAll(':scope > [role=search]')).toHaveLength(0);
		expect(requests).toHaveLength(1);
		expect(paginators).toHaveLength(1);
	});

	test.each(['standard', 'compact'] as const)('%s header opens the same query and leaves the results intact', async mode => {
		await mount(mode);
		const input = element<HTMLInputElement>('input[type=search]');
		await submit();
		const results = element('[data-results]');
		const panel = element('[role=search]');
		const toggle = element<HTMLButtonElement>('button[aria-controls]');
		expect(requests).toEqual([{ endpoint: 'notes/search', params: { query: '旗鯖', host: '.' } }]);
		expect(panel.style.display).toBe('none');
		expect(panel.hasAttribute('inert')).toBe(true);
		expect(toggle.getAttribute('aria-controls')).toBe(panel.id);
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(toggle.getAttribute('aria-label')).toBe('検索');
		expect(toggle.textContent).toBe('');
		expect(window.document.activeElement).toBe(toggle);
		toggle.click(); await flush();
		expect(element('input[type=search]')).toBe(input);
		expect(input.value).toBe('旗鯖');
		expect(element('[data-results]')).toBe(results);
		expect(requests).toHaveLength(1);
		expect(panel.style.display).toBe('');
		expect(panel.dataset.docked).toBe('true');
		expect(panel.style.getPropertyValue('--search-dock-top')).toBe('56px');
		expect(window.document.activeElement).toBe(input);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await flush();
		expect(panel.style.display).toBe('none');
		expect(window.document.activeElement).toBe(toggle);
	});

	test('author and date filters survive collapse and reopening', async () => {
		await mount('standard', { userId: 'author' });
		const date = element<HTMLInputElement>('input[type=datetime-local]');
		date.value = '2026-09-01T12:00'; date.dispatchEvent(new Event('input')); await flush();
		await submit();
		expect(requests[0].params).toMatchObject({ query: '旗鯖', userId: 'author', rangeStartAt: new Date('2026-09-01T12:00').getTime() });
		element<HTMLButtonElement>('button[aria-controls]').click(); await flush();
		expect(element('input[type=datetime-local]')).toBe(date);
		expect(date.value).toBe('2026-09-01T12:00');
	});

	test('empty input and Japanese conversion do not collapse or start a search', async () => {
		await mount('standard', { query: '' });
		await submit();
		const input = element<HTMLInputElement>('input[type=search]');
		input.value = '変換中'; input.dispatchEvent(new Event('input')); await flush();
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })); await flush();
		expect(requests).toEqual([]);
		expect(element('[role=search]').style.display).toBe('');
		expect(host.querySelector('button[aria-controls]')).toBeNull();
	});

	test.each(['user', 'event'] as const)('%s results also allow editing the query in the header', async type => {
		await mount('standard', { type }); await submit();
		expect(element('[data-results]')).toBeTruthy();
		expect(element('[role=search]').style.display).toBe('none');
		element<HTMLButtonElement>('button[aria-controls]').click(); await flush();
		expect(element('[role=search]').style.display).toBe('');
	});

	test('rapid reversals cancel old animations without hiding the reopened field', async () => {
		prefer.r.animation.value = true;
		await mount(); await submit();
		const closing = motions[0];
		expect(closing.options.duration).toBe(240);
		expect(closing.frames[1].transform).toContain('translate(322px, -696px)');
		element<HTMLButtonElement>('button[aria-controls]').click(); await flush();
		expect(closing.cancel).toHaveBeenCalledOnce();
		motions.at(-1)?.finish(); await flush();
		expect(element('[role=search]').style.display).toBe('');
		expect(element('[role=search]').hasAttribute('inert')).toBe(false);
		expect(element('button[aria-controls]').getAttribute('aria-expanded')).toBe('true');
	});

	test('reduced motion settles the controls without animation', async () => {
		prefer.r.animation.value = true; reduced = true;
		await mount(); await submit();
		expect(motions).toEqual([]);
		expect(element('[role=search]').style.display).toBe('none');
		element<HTMLButtonElement>('button[aria-controls]').click(); await flush();
		expect(motions).toEqual([]);
		expect(element('[role=search]').style.display).toBe('');
	});

	test('a wider pane keeps the query inline and returning to mobile restores the toggle', async () => {
		await mount(); await submit();
		width = 1200;
		for (const callback of resizeCallbacks) callback([{ contentRect: { width } }] as ResizeObserverEntry[], {} as ResizeObserver);
		await flush();
		expect(element('[role=search]').dataset.mobile).toBe('false');
		expect(element('[role=search]').style.display).toBe('');
		expect(host.querySelector('button[aria-controls]')).toBeNull();
		width = 390;
		for (const callback of resizeCallbacks) callback([{ contentRect: { width } }] as ResizeObserverEntry[], {} as ResizeObserver);
		await flush();
		expect(element('[role=search]').style.display).toBe('none');
		expect(element('button[aria-controls]').getAttribute('aria-expanded')).toBe('false');
	});

	test('leaving a cached search page removes its floating controls and restores the query on return', async () => {
		await mount(); await submit();
		element<HTMLButtonElement>('button[aria-controls]').click(); await flush();
		const input = element<HTMLInputElement>('input[type=search]');
		expect(host.contains(input)).toBe(false);
		searchActive.value = false; await flush();
		expect(window.document.body.querySelector('[role=search]')).toBeNull();
		searchActive.value = true; await flush();
		expect(element('input[type=search]')).toBe(input);
		expect(input.value).toBe('旗鯖');
		expect(element('[role=search]').style.display).toBe('none');
		expect(requests).toHaveLength(1);
	});

	test('a narrow page window retains its search field inside the window', async () => {
		await mount('standard', {}, true);
		await submit();
		const panel = element('[role=search]');
		expect(host.contains(panel)).toBe(true);
		expect(panel.dataset.mobile).toBe('false');
		expect(panel.style.display).toBe('');
		expect(host.querySelector('button[aria-controls]')).toBeNull();
		expect(element('[data-results]')).toBeTruthy();
	});
});

describe('note search scope', () => {
	async function openOptions() {
		element<HTMLButtonElement>('button[aria-label="オプション"]').click();
		await flush();
	}

	async function expectScope(embedded: boolean, value: string, label: string, candidates: string[]) {
		if (embedded) {
			const trigger = element<HTMLButtonElement>('button[aria-label="検索範囲"]');
			expect(trigger.textContent).toBe(label);
			trigger.click(); await flush();
			const choices = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-choice-value]'));
			expect(choices.map(choice => choice.dataset.choiceValue)).toEqual(candidates);
			expect(choices.filter(choice => choice.getAttribute('aria-pressed') === 'true').map(choice => choice.dataset.choiceValue)).toEqual([value]);
			element<HTMLButtonElement>('button[aria-label="戻る"]').click(); await flush();
		} else {
			const select = element<HTMLSelectElement>('select');
			expect(Array.from(select.options, option => option.value)).toEqual(candidates);
			expect(select.value).toBe(value);
			expect(select.selectedOptions[0]?.textContent).toBe(label);
		}
	}

	async function chooseScope(embedded: boolean, value: string) {
		if (embedded) {
			element<HTMLButtonElement>('button[aria-label="検索範囲"]').click(); await flush();
			element<HTMLButtonElement>(`[data-choice-value="${value}"]`).click();
		} else {
			const select = element<HTMLSelectElement>('select');
			select.value = value;
			select.dispatchEvent(new Event('change'));
		}
		await flush();
	}

	test.each([
		{ federation: 'none', permission: 'global', props: {}, value: 'local', label: 'すべて', candidates: ['local', 'user'] },
		{ federation: 'none', permission: 'global', props: { host: 'remote.example' }, value: 'local', label: 'すべて', candidates: ['local', 'user'] },
		{ federation: 'all', permission: 'local', props: { host: 'remote.example' }, value: 'local', label: 'ローカル', candidates: ['local', 'user'] },
		{ federation: 'all', permission: 'global', props: {}, value: 'all', label: 'すべて', candidates: ['all', 'local', 'server', 'user'] },
		{ federation: 'all', permission: 'global', props: { host: 'remote.example' }, value: 'server', label: 'サーバー', candidates: ['all', 'local', 'server', 'user'] },
	])('embedded initial scope is a visible candidate for $federation/$permission and $props', async ({ federation, permission, props, value, label, candidates }) => {
		Object.assign(instance, { federation, noteSearchableScope: permission });
		await mount('standard', { embedded: true, ...props });
		await openOptions();
		await expectScope(true, value, label, candidates);
	});

	test('standalone search initializes to a visible scope for federation none', async () => {
		Object.assign(instance, { federation: 'none', noteSearchableScope: 'global' });
		await mount(); await openOptions();
		await expectScope(false, 'local', 'すべて', ['local', 'user']);
	});

	test('a local author prop selects the user scope', async () => {
		await mount('standard', { embedded: true, userId: 'author' });
		await openOptions();
		await expectScope(true, 'user', 'ユーザー指定', ['local', 'user']);
	});

	test.each([false, true])('embedded=%s repairs unavailable choices without resetting a valid selection', async embedded => {
		Object.assign(instance, { federation: 'all', noteSearchableScope: 'global' });
		await mount('standard', { embedded }); await openOptions();
		await chooseScope(embedded, 'server');
		await expectScope(embedded, 'server', 'サーバー', ['all', 'local', 'server', 'user']);
		Object.assign(instance, { noteSearchableScope: 'local' }); await flush();
		await expectScope(embedded, 'local', 'ローカル', ['local', 'user']);
		Object.assign(instance, { noteSearchableScope: 'global' }); await flush();
		await expectScope(embedded, 'local', 'ローカル', ['all', 'local', 'server', 'user']);
		await chooseScope(embedded, 'user');
		Object.assign(instance, { federation: 'none' }); await flush();
		await expectScope(embedded, 'user', 'ユーザー指定', ['local', 'user']);
	});
});

describe('embedded navbar search', () => {
	function button(label: string) {
		return element<HTMLButtonElement>(`button[aria-label="${label}"]`);
	}

	async function escape() {
		(window.document.activeElement ?? element('input[type=search]')).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flush();
	}

	test('keeps controls and results inside its owner without page metadata or header actions', async () => {
		await mount('standard', { embedded: true });
		expect(definePage).not.toHaveBeenCalled();
		expect(host.querySelector('[data-page]')).toBeNull();
		const input = element<HTMLInputElement>('input[type=search]');
		expect(host.contains(input)).toBe(true);
		expect(input.hasAttribute('autofocus')).toBe(false);
		await submit();
		expect(host.contains(element('[data-results]'))).toBe(true);
		expect(element('[role=search]').style.display).toBe('');
		expect(close).not.toHaveBeenCalled();
		expect(motions).toEqual([]);
		expect(requests).toEqual([{ endpoint: 'notes/search', params: { query: '旗鯖', host: '.' } }]);
	});

	test.each([false, true])('embedded=%s uses the same author and date request parameters', async embedded => {
		await mount('standard', { embedded, userId: 'author' });
		const dates = Array.from(host.querySelectorAll<HTMLInputElement>('input[type=datetime-local]'));
		if (dates.length === 0) dates.push(...window.document.body.querySelectorAll<HTMLInputElement>('input[type=datetime-local]'));
		dates[0].value = '2026-09-01T12:00'; dates[0].dispatchEvent(new Event('input')); await flush();
		dates[1].value = '2026-09-03T13:00'; dates[1].dispatchEvent(new Event('input')); await flush();
		await submit();
		expect(requests[0]).toEqual({ endpoint: 'notes/search', params: {
			query: '旗鯖', host: '.', userId: 'author',
			rangeStartAt: new Date('2026-09-01T12:00').getTime(), rangeEndAt: new Date('2026-09-03T13:00').getTime(),
		} });
	});

	test('target and scope pickers return to the same query, conditions and result instance', async () => {
		await mount('standard', { embedded: true }); await submit();
		const input = element<HTMLInputElement>('input[type=search]');
		const result = element('[data-results]');
		button('オプション').click(); await flush();
		const date = element<HTMLInputElement>('input[type=datetime-local]');
		date.value = '2026-09-01T12:00'; date.dispatchEvent(new Event('input')); await flush();
		for (const label of ['検索対象', '検索範囲']) {
			const trigger = button(label); trigger.click(); await flush();
			const back = button('戻る');
			expect(back.textContent).toBe('');
			expect(back.querySelector('.ti-chevron-left')).not.toBeNull();
			expect(element('[aria-pressed=true]').textContent).toBeTruthy();
			back.click(); await flush();
			expect(window.document.activeElement).toBe(trigger);
			expect(trigger.getAttribute('aria-expanded')).toBe('false');
		}
		expect(element('input[type=search]')).toBe(input);
		expect(element('[data-results]')).toBe(result);
		expect(element('input[type=datetime-local]')).toBe(date);
		expect(date.value).toBe('2026-09-01T12:00');
		expect(requests).toHaveLength(1);
		expect(os.popupMenu).not.toHaveBeenCalled();
	});

	test('choosing a target resets its results through the shared controller while retaining the query', async () => {
		await mount('standard', { embedded: true }); await submit();
		button('検索対象').click(); await flush();
		element<HTMLButtonElement>('[data-choice-value=user]').click(); await flush();
		expect(element<HTMLInputElement>('input[type=search]').value).toBe('旗鯖');
		expect(host.querySelector('[data-results]')).toBeNull();
		await submit();
		expect(requests.at(-1)).toEqual({ endpoint: 'users/search', params: { query: '旗鯖', origin: 'local' } });
	});

	test('event sort and range use the existing paginator request', async () => {
		await mount('standard', { embedded: true, type: 'event', query: '' });
		button('オプション').click(); await flush();
		button('ソート').click(); await flush();
		element<HTMLButtonElement>('[data-choice-value=createdAt]').click(); await flush();
		const dates = host.querySelectorAll<HTMLInputElement>('input[type=date]');
		dates[0].value = '2026-10-01'; dates[0].dispatchEvent(new Event('input'));
		dates[1].value = '2026-10-02'; dates[1].dispatchEvent(new Event('input')); await flush();
		await submit();
		expect(requests.at(-1)).toEqual({ endpoint: 'notes/events/search', params: {
			query: undefined, sortBy: 'createdAt', origin: 'combined',
			sinceDate: new Date('2026-10-01').getTime(), untilDate: new Date('2026-10-02').getTime() + 86400000,
		} });
	});

	test('Escape closes picker, conditions, then asks the parent to close', async () => {
		await mount('standard', { embedded: true });
		button('オプション').click(); await flush();
		button('検索範囲').click(); await flush();
		await escape();
		expect(button('検索範囲').getAttribute('aria-expanded')).toBe('false');
		expect(button('オプション').getAttribute('aria-expanded')).toBe('true');
		expect(close).not.toHaveBeenCalled();
		await escape();
		expect(button('オプション').getAttribute('aria-expanded')).toBe('false');
		expect(close).not.toHaveBeenCalled();
		await escape();
		expect(close).toHaveBeenCalledOnce();
	});

	test('inactive content preserves results and ignores delayed resize, focus and Escape', async () => {
		await mount('standard', { embedded: true }); await submit();
		const input = element<HTMLInputElement>('input[type=search]');
		const results = element('[data-results]');
		embeddedActive.value = false; await flush();
		const count = heights.length;
		const outside = window.document.createElement('button'); host.append(outside); outside.focus();
		searchRef.value?.focus();
		embeddedMaxHeight.value = 180;
		paginators[0].fetching.value = true;
		for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await flush();
		expect(window.document.activeElement).toBe(outside);
		expect(element('[data-embedded-search]').hasAttribute('inert')).toBe(true);
		expect(heights).toHaveLength(count);
		expect(close).not.toHaveBeenCalled();
		embeddedActive.value = true; await flush();
		expect(element('[data-results]')).toBe(results);
		expect(element('input[type=search]')).toBe(input);
		expect(requests).toHaveLength(1);
		searchRef.value?.focus(); await flush();
		expect(window.document.activeElement).toBe(input);
	});

	test('measures natural pane content and caps it without retaining the previous picker height', async () => {
		await mount('standard', { embedded: true });
		const root = element('[data-embedded-search]');
		const row = root.firstElementChild as HTMLElement;
		const pane = element('[role=region]').parentElement!;
		const picker = button('戻る').closest<HTMLElement>('[role=group]')!;
		vi.spyOn(root, 'offsetHeight', 'get').mockReturnValue(500);
		vi.spyOn(row, 'offsetHeight', 'get').mockReturnValue(59);
		vi.spyOn(pane, 'offsetHeight', 'get').mockImplementation(() => button('オプション').getAttribute('aria-expanded') === 'true' ? 300 : 0);
		vi.spyOn(picker, 'offsetHeight', 'get').mockReturnValue(190);
		for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
		expect(heights.at(-1)).toBe(59);
		button('オプション').click(); await flush();
		expect(heights.at(-1)).toBe(320);
		button('検索範囲').click(); await flush();
		expect(heights.at(-1)).toBe(249);
		button('戻る').click(); await flush();
		expect(heights.at(-1)).toBe(320);
		button('オプション').click(); await flush();
		expect(heights.at(-1)).toBe(59);
		button('検索対象').click(); await flush();
		embeddedMaxHeight.value = 180; await flush();
		expect(heights.at(-1)).toBe(180);
		button('戻る').click(); await flush();
		expect(heights.at(-1)).toBe(59);
	});

	test('resize does not reclaim focus from a detailed user dialog', async () => {
		await mount('standard', { embedded: true });
		const dialog = window.document.createElement('input'); host.append(dialog); dialog.focus();
		embeddedMaxHeight.value = 220; await flush();
		for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
		await flush();
		expect(window.document.activeElement).toBe(dialog);
	});

	test.each(['@author', '#hataskey', 'https://remote.example/note'])('a late lookup confirmation for %s cannot navigate after deactivation', async query => {
		let confirm!: (result: { canceled: boolean }) => void;
		vi.mocked(os.confirm).mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }));
		await mount('standard', { embedded: true, query }); await submit();
		embeddedActive.value = false; await flush();
		confirm({ canceled: false }); await flush();
		expect(useRouter().push).not.toHaveBeenCalled();
		expect(useRouter().pushByPath).not.toHaveBeenCalled();
		expect(misskeyApi).not.toHaveBeenCalled();
		expect(requests).toEqual([]);
	});

	test('a completed AP lookup cannot navigate after the embedded search closes', async () => {
		let finish!: (value: { type: string; object: { id: string } }) => void;
		const pending = new Promise<{ type: string; object: { id: string } }>(resolve => { finish = resolve; });
		vi.mocked(os.confirm).mockResolvedValueOnce({ canceled: false });
		vi.mocked(misskeyApi).mockReturnValueOnce(pending as ReturnType<typeof misskeyApi>);
		await mount('standard', { embedded: true, query: 'https://remote.example/note' }); await submit();
		expect(misskeyApi).toHaveBeenCalledWith('ap/show', { uri: 'https://remote.example/note' });
		embeddedActive.value = false; await flush();
		finish({ type: 'Note', object: { id: 'remote-note' } }); await flush();
		expect(useRouter().push).not.toHaveBeenCalled();
		expect(requests).toEqual([]);
	});

	test.each(['@author', '#hataskey'])('search permission does not block the existing %s lookup', async query => {
		permissions.notesSearchAvailable = false;
		vi.mocked(os.confirm).mockResolvedValueOnce({ canceled: false });
		await mount('standard', { embedded: true, query }); await submit();
		expect(os.confirm).toHaveBeenCalledOnce();
		if (query.startsWith('@')) expect(useRouter().pushByPath).toHaveBeenCalledWith('/@author');
		else expect(useRouter().push).toHaveBeenCalledWith('/tags/:tag', { params: { tag: 'hataskey' } });
		expect(requests).toEqual([]);
	});

	test('IME Enter does not submit and empty results do not replace the paginator component', async () => {
		await mount('standard', { embedded: true });
		const input = element<HTMLInputElement>('input[type=search]');
		input.dispatchEvent(new Event('compositionstart'));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await flush();
		expect(requests).toEqual([]);
		input.dispatchEvent(new Event('compositionend')); await submit();
		const result = element('[data-results]');
		paginators[0].items.value = []; await flush();
		expect(host.textContent).toContain('ノートはありません');
		expect(element('[data-results]')).toBe(result);
		expect(result.style.display).toBe('none');
		paginators[0].error.value = true; await flush();
		expect(result.style.display).toBe('');
		expect(host.textContent).not.toContain('ノートはありません');
	});

	test('does not construct a paginator when note search is not permitted', async () => {
		permissions.notesSearchAvailable = false;
		await mount('standard', { embedded: true }); await submit();
		expect(host.textContent).toContain('ノート検索は利用できません');
		expect(requests).toEqual([]);
	});
});
