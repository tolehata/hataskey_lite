/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { computed, createApp, h, nextTick, reactive, ref } from 'vue';
import MkHatadyTimeline from './MkHatadyTimeline.vue';
import { HK3_THEME_CONTEXT } from './hataskey3/hk3-theme.js';

const fixture = vi.hoisted(() => ({
	api: vi.fn(),
	channels: [] as Array<{ events: Map<string, (payload: any) => void>; send: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
	listeners: new Map<string, Set<() => void>>(),
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixture.api(...args) }));
vi.mock('@/components/HatadyActivityCard.vue', () => ({ default: { props: ['activity'], render(this: { activity: any }) { return h('article', { 'data-record': this.activity.id }, this.activity.study?.title ?? this.activity.media?.session?.note); } } }));
vi.mock('@/components/MkPullToRefresh.vue', () => ({ default: { render(this: { $slots: { default?: () => any } }) { return h('div', this.$slots.default?.()); } } }));
vi.mock('@/utility/hatady-activity-actions.js', () => ({ useHatadyActivityActions: () => ({ openConversation: vi.fn(), openSession: vi.fn(), openBookDetail: vi.fn(), openMediaDetailById: vi.fn(), openProfile: vi.fn(), editActivity: vi.fn(), openActivityMenu: vi.fn() }) }));
vi.mock('@/utility/hataskey-timeline-new-notes.js', () => ({ useHataskeyTimelineNewNotes: () => false }));
vi.mock('@/utility/hatady-ui.js', () => ({ HATADY_ACTIVITY_CHOICES: [{ value: 'study', label: '学習', icon: 'ti ti-book' }] }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { enablePullToRefresh: false, enableInfiniteScroll: false, animation: false, newNoteReceivedNotificationBehavior: 'count' }, r: { newNoteReceivedNotificationBehavior: ref('count') } } }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: true }, r: { realtimeMode: ref(true) } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _hatady: { _page: { myRecords: '自分', everyone: 'みんな' }, _home: { tabFollowing: 'フォロー中', filterAll: 'すべて' } } }, noNotes: '空', loadMore: 'もっと見る', retry: '再試行', newNoteRecived: '新着' }, tsx: { newNoteRecivedCount: ({ n }: { n: string }) => `新着 ${n}` } } }));
vi.mock('@/stream.js', () => ({ useStream: () => ({
	state: 'connected',
	useChannel: () => {
		const channel = { events: new Map<string, (payload: any) => void>(), send: vi.fn(), dispose: vi.fn() };
		fixture.channels.push(channel);
		return { on: (name: string, handler: (payload: any) => void) => channel.events.set(name, handler), send: channel.send, dispose: channel.dispose };
	},
	on: (name: string, listener: () => void) => { if (!fixture.listeners.has(name)) fixture.listeners.set(name, new Set()); fixture.listeners.get(name)!.add(listener); },
	off: (name: string, listener: () => void) => fixture.listeners.get(name)?.delete(listener),
}) }));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
	return { promise, resolve, reject };
}

const record = (id: string, title: string) => ({ id, type: 'study', occurredAt: '2026-09-30T12:00:00.000Z', visibility: 'public', isMine: false, study: { id, title } });
const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, hasMore: !!nextCursor });
let app: ReturnType<typeof createApp> | null = null;
let host: HTMLElement;
let component: ReturnType<typeof ref<any>>;

async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

function mount(active = true, variant: 'ui' | 'uis' = 'ui') {
	host = window.document.createElement('div'); window.document.body.append(host);
	component = ref<any>();
	const props = reactive({ variant, active });
	app = createApp({ render: () => h(MkHatadyTimeline, { ...props, ref: component }) });
	app.provide(HK3_THEME_CONTEXT, computed(() => ({ '--hk3-text': '#123456', '--hk3-surface': '#abcdef', '--hk3-accent': '#fedcba' })));
	app.mount(host);
	return props;
}

function emit(name: string, payload: unknown) { fixture.channels.at(-1)!.events.get(name)!(payload); }

beforeEach(async () => {
	fixture.api.mockReset(); fixture.channels = []; fixture.listeners.clear();
	const { store } = await import('@/store.js');
	store.s.realtimeMode = true; store.r.realtimeMode.value = true;
});
afterEach(() => { app?.unmount(); app = null; host?.remove(); vi.restoreAllMocks(); });

test('append keeps newer stream changes and synchronizes every displayed ID', async () => {
	const later = deferred<ReturnType<typeof page>>();
	fixture.api.mockResolvedValueOnce(page([record('a', 'old'), record('b', 'before')], 'cursor')).mockReturnValueOnce(later.promise);
	mount(); await settle();
	const appended = component.value.loadMore();
	emit('activity', { seq: 1, key: 'log:a', activity: record('a', 'edited') });
	emit('removed', { seq: 2, key: 'log:b', id: 'b' });
	later.resolve(page([record('b', 'stale'), record('c', 'new')]));
	await appended; await settle();
	expect(host.querySelector('[data-record="a"]')?.textContent).toBe('edited');
	expect(host.querySelector('[data-record="b"]')).toBeNull();
	expect(fixture.channels[0].send).toHaveBeenLastCalledWith('sync', expect.objectContaining({ ids: expect.arrayContaining(['log:a', 'log:c']), seenThrough: 2 }));
	expect(fixture.channels[0].send.mock.lastCall?.[1].ids).toHaveLength(2);
});

test('failed REST leaves displayed records subject to buffered removals', async () => {
	const later = deferred<ReturnType<typeof page>>();
	fixture.api.mockResolvedValueOnce(page([record('a', 'old')])).mockReturnValueOnce(later.promise);
	mount(); await settle();
	const reload = component.value.reloadTimeline();
	emit('removed', { seq: 1, key: 'log:a', id: 'a' });
	later.reject(new Error('offline'));
	await reload; await settle();
	expect(host.querySelector('[data-record="a"]')).toBeNull();
	expect(fixture.channels[0].send).toHaveBeenLastCalledWith('sync', expect.objectContaining({ ids: [], seenThrough: 1 }));
});

test('failed reconnect snapshots still synchronize retained displayed and queued records', async () => {
	fixture.api.mockResolvedValueOnce(page([record('a', 'displayed')])).mockRejectedValueOnce(new Error('offline'));
	mount(); await settle();
	const section = host.querySelector('section');
	if (!section) throw new Error('timeline root missing');
	vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({ top: -100 } as DOMRect);
	window.dispatchEvent(new Event('scroll'));
	emit('activity', { seq: 1, key: 'log:q', activity: record('q', 'queued') }); await settle();
	expect(component.value.queuedCount).toBe(1);
	for (const listener of fixture.listeners.get('_disconnected_') ?? []) listener();
	for (const listener of fixture.listeners.get('_connected_') ?? []) listener();
	await settle();
	expect(fixture.channels[0].send).toHaveBeenCalledTimes(2);
	expect(fixture.channels[0].send).toHaveBeenLastCalledWith('sync', { ids: ['log:a', 'log:q'], seenThrough: 0, requestId: 1 });
	expect(host.querySelector('[data-record="a"]')).not.toBeNull();
	expect(component.value.queuedCount).toBe(1);
	expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent === '再試行')).toBe(true);
	emit('removed', { seq: 1, key: 'log:a', id: 'a' });
	emit('removed', { seq: 2, key: 'log:q', id: 'q' }); await settle();
	expect(host.querySelector('[data-record="a"]')).toBeNull();
	expect(component.value.queuedCount).toBe(0);
});

test('manual mode does not subscribe or reload after an empty first page and reactivation', async () => {
	const { store } = await import('@/store.js');
	store.s.realtimeMode = false; store.r.realtimeMode.value = false;
	fixture.api.mockResolvedValue(page([]));
	const props = mount(); await settle();
	expect(fixture.api).toHaveBeenCalledTimes(1);
	expect(fixture.channels).toHaveLength(0);
	props.active = false; await settle(); props.active = true; await settle();
	window.document.dispatchEvent(new Event('visibilitychange')); await settle();
	expect(fixture.api).toHaveBeenCalledTimes(1);
	store.s.realtimeMode = true; store.r.realtimeMode.value = true;
});

test('manual mode retries an initial load interrupted by tab deactivation', async () => {
	const { store } = await import('@/store.js');
	store.s.realtimeMode = false; store.r.realtimeMode.value = false;
	const pending = deferred<ReturnType<typeof page>>();
	fixture.api.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([record('current', 'current')]));
	const props = mount(); await settle();
	props.active = false; await settle(); props.active = true; await settle();
	pending.resolve(page([record('stale', 'stale')])); await settle();
	expect(fixture.api).toHaveBeenCalledTimes(2);
	expect(fixture.channels).toHaveLength(0);
	expect(host.querySelector('[data-record="current"]')).not.toBeNull();
	expect(host.querySelector('[data-record="stale"]')).toBeNull();
});

test('manual mode retries an initial load interrupted while the document was hidden', async () => {
	const { store } = await import('@/store.js');
	store.s.realtimeMode = false; store.r.realtimeMode.value = false;
	const hidden = vi.spyOn(window.document, 'hidden', 'get').mockReturnValue(false);
	const pending = deferred<ReturnType<typeof page>>();
	fixture.api.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([record('current', 'current')]));
	mount(); await settle();
	hidden.mockReturnValue(true);
	window.document.dispatchEvent(new Event('visibilitychange')); await settle();
	hidden.mockReturnValue(false);
	window.document.dispatchEvent(new Event('visibilitychange')); await settle();
	pending.resolve(page([record('stale', 'stale')])); await settle();
	expect(fixture.api).toHaveBeenCalledTimes(2);
	expect(fixture.channels).toHaveLength(0);
	expect(host.querySelector('[data-record="current"]')).not.toBeNull();
	expect(host.querySelector('[data-record="stale"]')).toBeNull();
});

test('manual mode retries an interrupted first load for a new filter', async () => {
	const { store } = await import('@/store.js');
	store.s.realtimeMode = false; store.r.realtimeMode.value = false;
	const pending = deferred<ReturnType<typeof page>>();
	fixture.api.mockResolvedValueOnce(page([record('previous', 'previous')])).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([record('current', 'current')]));
	const props = mount(); await settle();
	const mine = Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')).find(button => button.textContent === '自分');
	mine?.click(); await settle();
	props.active = false; await settle(); props.active = true; await settle();
	pending.resolve(page([record('stale', 'stale')])); await settle();
	expect(fixture.api).toHaveBeenCalledTimes(3);
	expect(fixture.api).toHaveBeenLastCalledWith('hata/hatady/activities', expect.objectContaining({ scope: 'mine' }));
	expect(host.querySelector('[data-record="current"]')).not.toBeNull();
	expect(host.querySelector('[data-record="stale"]')).toBeNull();
});

test('switching to manual mode retries an interrupted initial load', async () => {
	const { store } = await import('@/store.js');
	const pending = deferred<ReturnType<typeof page>>();
	fixture.api.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([record('current', 'current')]));
	mount(); await settle();
	store.s.realtimeMode = false; store.r.realtimeMode.value = false; await settle();
	pending.resolve(page([record('stale', 'stale')])); await settle();
	expect(fixture.api).toHaveBeenCalledTimes(2);
	expect(fixture.channels[0].dispose).toHaveBeenCalledOnce();
	expect(host.querySelector('[data-record="current"]')).not.toBeNull();
	expect(host.querySelector('[data-record="stale"]')).toBeNull();
});

test('dispose rejects a pending REST result and late events from its old channel', async () => {
	const pending = deferred<ReturnType<typeof page>>();
	fixture.api.mockReturnValueOnce(pending.promise);
	mount(); await nextTick();
	const channel = fixture.channels[0];
	app!.unmount(); app = null;
	channel.events.get('activity')!({ seq: 1, key: 'log:a', activity: record('a', 'late') });
	pending.resolve(page([record('a', 'stale')]));
	await settle();
	expect(channel.dispose).toHaveBeenCalledOnce();
	expect(channel.send).not.toHaveBeenCalled();
	expect(host.querySelector('[data-record]')).toBeNull();
});

test('category menu stays under its button and scrolls within the visible parent boundary with keyboard access', async () => {
	fixture.api.mockResolvedValue(page([]));
	mount(); await settle();
	host.style.overflowY = 'auto';
	const button = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
	const originalRect = HTMLElement.prototype.getBoundingClientRect;
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
		if (this === button) return { left: window.innerWidth - 24, right: window.innerWidth - 8, top: window.innerHeight - 222, bottom: window.innerHeight - 190 } as unknown as DOMRect;
		if (this === host) return { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight - 80 } as unknown as DOMRect;
		if (this.getAttribute('role') === 'menu') return { width: 180 } as unknown as DOMRect;
		return originalRect.call(this);
	});
	button.click(); await settle();
	let menu = window.document.body.querySelector<HTMLElement>('[role="menu"]')!;
	expect(menu.parentElement).toBe(window.document.body);
	expect(menu.style.left).toBe(`${window.innerWidth - 188}px`);
	expect(menu.style.top).toBe(`${window.innerHeight - 186}px`);
	expect(menu.style.maxHeight).toBe('98px');
	const items = menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
	expect(window.document.activeElement).toBe(items[0]);
	items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await settle();
	expect(window.document.activeElement).toBe(items[1]);
	items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); await settle();
	expect(window.document.activeElement).toBe(items[0]);
	items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); await settle();
	expect(window.document.activeElement).toBe(items[1]);
	items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await settle();
	expect(window.document.activeElement).toBe(items[0]);
	items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle();
	expect(window.document.body.querySelector('[role="menu"]')).toBeNull();
	expect(window.document.activeElement).toBe(button);
	button.click(); await settle();
	menu = window.document.body.querySelector<HTMLElement>('[role="menu"]')!;
	window.document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); await settle();
	expect(window.document.body.querySelector('[role="menu"]')).toBeNull();
});

test('category menu keeps the UI S palette after teleporting to body', async () => {
	fixture.api.mockResolvedValue(page([]));
	mount(true, 'uis'); await settle();
	const button = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
	vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 24, right: 120, top: 32, bottom: 64 } as unknown as DOMRect);
	button.click(); await settle();
	const menu = window.document.body.querySelector<HTMLElement>('[role="menu"]')!;
	expect(menu.style.getPropertyValue('--hk3-text')).toBe('#123456');
	expect(menu.style.getPropertyValue('--hk3-surface')).toBe('#abcdef');
	expect(menu.style.getPropertyValue('--hk3-accent')).toBe('#fedcba');
});

test('category menu does not focus hidden items and closes if its button scrolls outside the parent', async () => {
	fixture.api.mockResolvedValue(page([]));
	mount(); await settle();
	host.style.overflowY = 'auto';
	const button = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
	const scrollIntoView = vi.fn();
	button.scrollIntoView = scrollIntoView;
	let buttonTop = 68;
	let buttonBottom = 100;
	let hostBottom = 142;
	vi.spyOn(button, 'getBoundingClientRect').mockImplementation(() => ({ left: 24, right: 120, top: buttonTop, bottom: buttonBottom } as unknown as DOMRect));
	vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, right: window.innerWidth, top: 0, bottom: hostBottom } as unknown as DOMRect));
	button.focus(); button.click(); await settle();
	expect(scrollIntoView).toHaveBeenCalledOnce();
	expect(window.document.body.querySelector('[role="menu"]')).toBeNull();
	expect(window.document.activeElement).toBe(button);
	hostBottom = 400;
	button.click(); await settle();
	expect(window.document.body.querySelector('[role="menu"]')).not.toBeNull();
	buttonTop = 410; buttonBottom = 442;
	host.dispatchEvent(new Event('scroll', { bubbles: true })); await settle();
	expect(window.document.body.querySelector('[role="menu"]')).toBeNull();
});
