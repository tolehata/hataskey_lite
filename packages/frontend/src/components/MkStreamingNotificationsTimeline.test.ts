/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MkStreamingNotificationsTimeline from './MkStreamingNotificationsTimeline.vue';
import { forgetNotificationUnreadState } from '@/utility/notification-unread-state.js';

const fixture = vi.hoisted(() => ({
	api: vi.fn(),
	events: new Map<string, (event: any) => void>(),
	streamEvents: new Map<string, () => void>(),
	intersection: null as IntersectionObserverCallback | null,
	observed: new Set<Element>(),
	account: null as null | { id: string; hasUnreadNotification: boolean; unreadNotificationsCount: number },
	accountUpdates: vi.fn(),
	realtimeMode: true,
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixture.api(...args) }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { useGroupedNotifications: false, enablePullToRefresh: false, animation: false, enableInfiniteScroll: false, enableAbsoluteTime: false, pollingInterval: 3 } } }));
vi.mock('@/store.js', () => ({ store: { s: { get realtimeMode() { return fixture.realtimeMode; } } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { noNotifications: 'empty', loadMore: 'more' } } }));
vi.mock('@/i.js', () => ({ get $i() { return fixture.account; } }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccount: (partial: object) => {
	Object.assign(fixture.account!, partial);
	fixture.accountUpdates(partial);
} }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => null, setItem: vi.fn() } }));
vi.mock('@/events.js', () => ({ globalEvents: { on: vi.fn(), off: vi.fn() } }));
vi.mock('@/stream.js', () => ({ useStream: () => ({
	useChannel: () => ({ on: (name: string, listener: (event: any) => void) => fixture.events.set(name, listener), dispose: vi.fn() }),
	on: (name: string, listener: () => void) => fixture.streamEvents.set(name, listener),
	off: (name: string) => fixture.streamEvents.delete(name),
}) }));
vi.mock('@@/js/use-document-visibility.js', async () => { const { ref } = await import('vue'); return { useDocumentVisibility: () => ref('visible') }; });
vi.mock('@@/js/scroll.js', () => ({ getScrollContainer: () => null, scrollToTop: vi.fn() }));
vi.mock('@/components/MkPullToRefresh.vue', () => ({ default: defineComponent({ render() { return h('div', this.$slots.default?.()); } }) }));
vi.mock('@/components/MkNotification.vue', () => ({ default: defineComponent({ props: ['notification'], render() { return h('article', { 'data-title': this.notification.title }, this.notification.title); } }) }));
vi.mock('@/components/MkHataFeedNotificationGroup.vue', () => ({ default: defineComponent({ render: () => h('div') }) }));
vi.mock('@/components/MkNote.vue', () => ({ default: defineComponent({ render: () => h('div') }) }));

type Notification = { id: string; type: 'app'; title: string; header: string; body: string; createdAt: string };
const item = (id: string, title: string): Notification => ({ id, type: 'app', title, header: 'ordinary', body: '', createdAt: '2026-09-30T00:00:00.000Z' });

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

let app: ReturnType<typeof createApp> | null;
let host: HTMLElement;

async function settle() { for (let i = 0; i < 8; i++) { await Promise.resolve(); await nextTick(); } }

function mount(props: Record<string, unknown> = {}) {
	host = window.document.createElement('div'); window.document.body.append(host);
	app = createApp(MkStreamingNotificationsTimeline, { active: true, notUseGrouped: true, ...props });
	for (const name of ['MkLoading', 'MkError', 'MkResult']) app.component(name, { render: () => h('div') });
	app.directive('appear', {});
	app.mount(host);
}

function changed(ids: string[]) { fixture.events.get('notificationChanged')!({ ids }); }

function title() { return host.querySelector('article')?.getAttribute('data-title') ?? null; }

beforeEach(() => {
	fixture.api.mockReset(); fixture.events.clear(); fixture.streamEvents.clear(); fixture.intersection = null; fixture.observed.clear();
	fixture.account = null; fixture.accountUpdates.mockClear(); fixture.realtimeMode = true;
	vi.stubGlobal('IntersectionObserver', class {
		constructor(callback: IntersectionObserverCallback) { fixture.intersection = callback; }
		observe(target: Element) { fixture.observed.add(target); }
		disconnect() { fixture.observed.clear(); }
	});
});
afterEach(() => { app?.unmount(); app = null; host?.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); forgetNotificationUnreadState('owner-a'); });

test.each(['all', 'hatask'])('reward history and live events stay visible and can be read in %s when optional types are disabled', async brand => {
	vi.useFakeTimers();
	fixture.account = { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 1 };
	const reward = { ...item('reward', 'earned'), type: 'hataskDecorationUnlocked' };
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications'
		? Promise.resolve([reward, item('ordinary', 'hidden')])
		: endpoint === 'notifications/unread-count'
			? Promise.resolve({ unreadNotificationsCount: 0, revision: '1' })
			: Promise.resolve());
	mount({ brand, includeBrands: ['hatask'], excludeTypes: ['hataskDecorationUnlocked', 'app'], excludeBots: true });
	await settle();
	expect(title()).toBe('earned');
	expect(host.querySelectorAll('article')).toHaveLength(1);
	const row = [...fixture.observed].find(element => element.getAttribute('data-notification-ids') === '["reward"]');
	if (!row || !fixture.intersection) throw new Error('Reward must be observed for individual reads');
	fixture.intersection([{ target: row, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
	vi.advanceTimersByTime(80); await settle();
	expect(fixture.api).toHaveBeenCalledWith('notifications/mark-as-read', { notificationIds: ['reward'] });
	expect(fixture.account).toMatchObject({ hasUnreadNotification: false, unreadNotificationsCount: 0 });
	const onNotification = fixture.events.get('notification');
	if (!onNotification) throw new Error('Notification stream must be subscribed');
	onNotification({ ...reward, id: 'next-reward', title: 'earned next' });
	onNotification(item('next-ordinary', 'still hidden'));
	await settle();
	expect([...host.querySelectorAll('article')].map(element => element.getAttribute('data-title'))).toEqual(['earned next', 'earned']);
});

test.each([
	{ brand: 'standard' }, { brand: 'hatady' }, { brand: 'hataFeed' },
	{ brand: 'all', includeBrands: ['standard'] }, { brand: 'all', includeBrands: ['hatady'] },
	{ brand: 'all', includeBrands: ['hataFeed'] }, { brand: 'all', includeBrands: [] },
])('reward history and live events stay out of an unrelated brand selection: %j', async filters => {
	vi.useFakeTimers();
	fixture.account = { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 1 };
	const reward = { ...item('reward', 'earned'), type: 'hataskDecorationUnlocked' };
	fixture.api.mockResolvedValue([reward]);
	mount(filters); await settle();
	expect(host.querySelectorAll('article')).toHaveLength(0);
	const onNotification = fixture.events.get('notification');
	if (!onNotification) throw new Error('Notification stream must be subscribed');
	onNotification({ ...reward, id: 'next-reward', title: 'earned next' });
	await settle();
	expect(host.querySelectorAll('article')).toHaveLength(0);
	expect([...fixture.observed].some(element => element.hasAttribute('data-notification-ids'))).toBe(false);
	vi.advanceTimersByTime(80); await settle();
	expect(fixture.api.mock.calls.some(([endpoint]) => endpoint === 'notifications/mark-as-read')).toBe(false);
	expect(fixture.account).toMatchObject({ hasUnreadNotification: true, unreadNotificationsCount: 1 });
});

test('a visible read reconciles the badge without a stream event while realtime is disabled', async () => {
	vi.useFakeTimers();
	fixture.realtimeMode = false;
	fixture.account = { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 2 };
	let countRequests = 0;
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications'
		? Promise.resolve([item('one', 'shown'), item('two', 'hidden')])
		: endpoint === 'notifications/unread-count'
			? Promise.resolve({ unreadNotificationsCount: ++countRequests === 1 ? 1 : 0, revision: String(countRequests) })
			: Promise.resolve());
	mount(); await settle();
	const rows = [...fixture.observed].filter(element => element.hasAttribute('data-notification-ids'));
	expect(rows).toHaveLength(2);
	const first = rows.find(row => row.getAttribute('data-notification-ids') === '["one"]')!;
	const second = rows.find(row => row.getAttribute('data-notification-ids') === '["two"]')!;
	fixture.intersection!([{ target: first, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
	vi.advanceTimersByTime(80); await settle();
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/mark-as-read')).toHaveLength(1);
	expect(fixture.api.mock.calls.find(([endpoint]) => endpoint === 'notifications/mark-as-read')?.[1]).toEqual({ notificationIds: ['one'] });
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/unread-count')).toHaveLength(1);
	expect(fixture.account).toMatchObject({ hasUnreadNotification: true, unreadNotificationsCount: 1 });
	fixture.intersection!([{ target: second, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
	vi.advanceTimersByTime(80); await settle();
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/mark-as-read').at(-1)?.[1]).toEqual({ notificationIds: ['two'] });
	expect(fixture.account).toMatchObject({ hasUnreadNotification: false, unreadNotificationsCount: 0 });
});

test('two visible rows share one read batch and one unread snapshot', async () => {
	vi.useFakeTimers();
	fixture.realtimeMode = false;
	fixture.account = { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 2 };
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications'
		? Promise.resolve([item('one', 'first'), item('two', 'second')])
		: endpoint === 'notifications/unread-count'
			? Promise.resolve({ unreadNotificationsCount: 0, revision: '1' })
			: Promise.resolve());
	mount(); await settle();
	const rows = [...fixture.observed].filter(element => element.hasAttribute('data-notification-ids'));
	fixture.intersection!(rows.map(target => ({ target, isIntersecting: true } as IntersectionObserverEntry)), {} as IntersectionObserver);
	vi.advanceTimersByTime(80); await settle();
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/mark-as-read')).toHaveLength(1);
	expect(fixture.api.mock.calls.find(([endpoint]) => endpoint === 'notifications/mark-as-read')?.[1]).toEqual({ notificationIds: ['one', 'two'] });
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/unread-count')).toHaveLength(1);
	expect(fixture.account).toMatchObject({ hasUnreadNotification: false, unreadNotificationsCount: 0 });
});

test('a failed visible read does not reconcile the badge', async () => {
	vi.useFakeTimers();
	fixture.realtimeMode = false;
	fixture.account = { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 1 };
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications'
		? Promise.resolve([item('one', 'shown')])
		: endpoint === 'notifications/mark-as-read'
			? Promise.reject(new Error('failed'))
			: Promise.resolve());
	mount(); await settle();
	const row = [...fixture.observed].find(element => element.hasAttribute('data-notification-ids'))!;
	fixture.intersection!([{ target: row, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
	vi.advanceTimersByTime(80); await settle();
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/unread-count')).toHaveLength(0);
	expect(fixture.accountUpdates).not.toHaveBeenCalled();
});

test('an intersecting row that leaves before the read delay remains unread', async () => {
	vi.useFakeTimers();
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications' ? Promise.resolve([item('one', 'shown')]) : Promise.resolve());
	mount(); await settle();
	const row = [...fixture.observed].find(element => element.hasAttribute('data-notification-ids'))!;
	const entry = (isIntersecting: boolean) => ({ target: row, isIntersecting } as IntersectionObserverEntry);
	fixture.intersection!([entry(true)], {} as IntersectionObserver);
	fixture.intersection!([entry(false)], {} as IntersectionObserver);
	vi.advanceTimersByTime(80); await settle();
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/mark-as-read')).toHaveLength(0);
});

test('out-of-order show responses cannot replace a newer notification revision', async () => {
	const first = deferred<Notification[]>();
	let showCalls = 0;
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications' ? Promise.resolve([item('one', 'initial')]) : endpoint === 'notifications/show' ? ++showCalls === 1 ? first.promise : Promise.resolve([item('one', 'newest')]) : Promise.resolve());
	mount(); await settle();
	changed(['one']); changed(['one']); await settle();
	expect(title()).toBe('newest');
	first.resolve([item('one', 'stale')]); await settle();
	expect(title()).toBe('newest');
});

test('a deleted sole row restores at its recorded position without treating it as a new arrival', async () => {
	let showCalls = 0;
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications' ? Promise.resolve([item('one', 'before')]) : endpoint === 'notifications/show' ? Promise.resolve(++showCalls === 1 ? [] : [item('one', 'restored')]) : Promise.resolve());
	mount(); await settle();
	changed(['one']); await settle(); expect(title()).toBeNull();
	changed(['one']); await settle(); expect(title()).toBe('restored');
	expect(fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'notifications/mark-as-read')).toHaveLength(0);
});

test('an old list response stays hidden until its changed ID is revalidated after commit', async () => {
	const oldList = deferred<Notification[]>();
	const recheck = deferred<Notification[]>();
	let showCalls = 0;
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications' ? oldList.promise : endpoint === 'notifications/show' ? ++showCalls === 1 ? Promise.resolve([]) : recheck.promise : Promise.resolve());
	mount(); await settle();
	changed(['one']); await settle();
	oldList.resolve([item('one', 'deleted title')]); await settle();
	expect(title()).toBeNull();
	expect(showCalls).toBe(2);
	recheck.resolve([]); await settle();
	expect(title()).toBeNull();
});

test('a stale initial response cannot overwrite a completed reload after a deletion', async () => {
	const stale = deferred<Notification[]>();
	let listCalls = 0;
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications' ? ++listCalls === 1 ? stale.promise : Promise.resolve([]) : endpoint === 'notifications/show' ? Promise.resolve([]) : Promise.resolve());
	mount(); await settle();
	changed(['one']); await settle();
	fixture.events.get('notificationFlushed')!({ unreadNotificationsCount: 0, revision: '2' });
	await settle();
	expect(title()).toBeNull();
	stale.resolve([item('one', 'deleted title')]); await settle();
	expect(title()).toBeNull();
});

test('reconnection reloads the authorized page to drop stale loaded rows', async () => {
	let listCalls = 0;
	fixture.api.mockImplementation((endpoint: string) => endpoint === 'i/notifications' ? Promise.resolve(++listCalls === 1 ? [item('one', 'before')] : []) : Promise.resolve());
	mount(); await settle();
	expect(title()).toBe('before');
	fixture.streamEvents.get('_connected_')!(); await settle();
	expect(title()).toBeNull();
	expect(listCalls).toBe(2);
});
