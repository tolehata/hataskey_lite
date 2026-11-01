/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';

const fixtures = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));
vi.mock('@/os.js', () => ({ confirm: vi.fn() }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/utility/hatady-prefs.js', async () => {
	const { ref } = await import('vue');
	return { hatadyTheme: ref('dark') };
});
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ emits: ['close'], setup: (_props, { slots, emit, expose }) => {
		expose({ close: vi.fn() });
		return () => render('section', [render('button', { 'aria-label': '通知を閉じる', onClick: () => emit('close') }), slots.headerActions?.(), slots.default?.()]);
	} }) };
});
vi.mock('@/components/MkReactionIcon.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ setup: () => () => render('span') }) };
});
import HatadyNotifications from './HatadyNotifications.vue';

const cleanups: Array<() => void> = [];

async function settle() {
	for (let i = 0; i < 4; i++) { await nextTick(); await Promise.resolve(); }
}

function mountNotifications() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const read = vi.fn();
	const app = createApp({ render: () => h(HatadyNotifications, { onRead: read }) });
	app.component('MkAvatar', { render: () => h('span') });
	app.component('MkUserName', { render: () => h('span', '通知した人') });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return { target, read };
}

beforeEach(() => {
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	fixtures.api.mockReset();
	fixtures.api.mockImplementation(async (endpoint: string) => endpoint === 'hata/hatady/notifications' ? [
		{ id: 'reaction', type: 'mediaReaction', mediaTitle: 'リアクションの作品', reaction: '👍', user: { id: 'one' }, createdAt: '2020-01-01', isRead: false },
		{ id: 'comment', type: 'mediaReply', mediaTitle: 'コメントの作品', mediaCommentText: '返信の内容', user: { id: 'two' }, createdAt: '2020-01-01', isRead: false },
		{ id: 'follow', type: 'follow', user: { id: 'three' }, createdAt: '2020-01-01', isRead: false },
	] : undefined);
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.unstubAllGlobals();
});

test('notification capsule filters preserve media groups and expose only the selected label with all accessible names', async () => {
	const { target, read } = mountNotifications();
	await settle();
	const group = target.querySelector('[role="group"][aria-label="通知の種類"]')!;
	expect(group).not.toBeNull();
	const buttons = Array.from(group.querySelectorAll('button'));
	expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['すべて', 'リアクション', 'コメント', 'フォロー', '継続・達成']);
	expect(buttons.every(button => button.querySelector('i[aria-hidden="true"]'))).toBe(true);
	for (const label of ['リアクション', 'コメント', 'フォロー', '継続・達成', 'すべて']) {
		buttons.find(button => button.getAttribute('aria-label') === label)!.click();
		await settle();
		expect(buttons.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.textContent)).toEqual([label]);
		expect(buttons.filter(button => button.getAttribute('aria-pressed') === 'false').every(button => !button.textContent)).toBe(true);
		expect(target.textContent?.includes('リアクションの作品')).toBe(['すべて', 'リアクション'].includes(label));
		expect(target.textContent?.includes('コメントの作品')).toBe(['すべて', 'コメント'].includes(label));
	}
	expect(fixtures.api.mock.calls.filter(([endpoint]) => endpoint === 'hata/hatady/notifications')).toEqual([['hata/hatady/notifications', { limit: 100 }]]);
	expect(fixtures.api).toHaveBeenCalledWith('hata/hatady/notifications/mark-as-read', { notificationIds: ['reaction', 'comment', 'follow'] });
	expect(read).toHaveBeenCalledExactlyOnceWith();
	read.mockClear();
	Array.from(target.querySelectorAll('button')).find(button => button.textContent?.includes('すべて既読'))!.click();
	await settle();
	expect(fixtures.api).toHaveBeenLastCalledWith('hata/hatady/notifications/mark-all-read', {});
	expect(read).toHaveBeenCalledExactlyOnceWith(true);
});

test('opening the list acknowledges notifications only after the server confirms the read', async () => {
	let finishRead!: () => void;
	const original = fixtures.api.getMockImplementation()!;
	fixtures.api.mockImplementation((endpoint: string, params: unknown) => endpoint.endsWith('/mark-as-read')
		? new Promise<void>(resolve => { finishRead = resolve; }) : original(endpoint, params));
	const { target, read } = mountNotifications();
	await settle();
	expect(target.textContent).toContain('コメントの作品');
	expect(fixtures.api).toHaveBeenLastCalledWith('hata/hatady/notifications/mark-as-read', { notificationIds: ['reaction', 'comment', 'follow'] });
	expect(read).not.toHaveBeenCalled();
	const mark = Array.from(target.querySelectorAll('button')).find(button => button.textContent?.includes('すべて既読'))!;
	expect(mark.disabled).toBe(true);
	mark.click();
	expect(fixtures.api.mock.calls.filter(([endpoint]) => endpoint.endsWith('/mark-as-read'))).toHaveLength(1);
	finishRead();
	await settle();
	expect(read).toHaveBeenCalledExactlyOnceWith();
	expect(mark.disabled).toBe(false);
});

test('a failed later notification page does not acknowledge any unread notifications', async () => {
	fixtures.api.mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => ({ id: `item${index}`, isRead: false })))
		.mockRejectedValueOnce(new Error('offline'));
	const { target, read } = mountNotifications();
	await settle();
	expect(fixtures.api).toHaveBeenLastCalledWith('hata/hatady/notifications', { limit: 100, untilId: 'item99' });
	expect(fixtures.api).toHaveBeenCalledTimes(2);
	expect(target.textContent).toContain('通知を読み込めませんでした');
	expect(read).not.toHaveBeenCalled();
});

test('a failed automatic acknowledgement preserves unread state and permits an explicit retry', async () => {
	const original = fixtures.api.getMockImplementation()!;
	let failed = false;
	fixtures.api.mockImplementation((endpoint: string, params: unknown) => {
		if (endpoint.endsWith('/mark-as-read') && !failed) { failed = true; return Promise.reject(new Error('offline')); }
		return original(endpoint, params);
	});
	const { target, read } = mountNotifications();
	await settle();
	expect(target.textContent).toContain('既読にできませんでした');
	expect(read).not.toHaveBeenCalled();
	Array.from(target.querySelectorAll('button')).find(button => button.textContent?.includes('すべて既読'))!.click();
	await settle();
	expect(read).toHaveBeenCalledExactlyOnceWith(true);
	expect(target.textContent).not.toContain('既読にできませんでした');
});

test('closing while the list is loading does not mark unseen notifications read', async () => {
	let finishLoad!: (items: unknown[]) => void;
	fixtures.api.mockImplementationOnce(() => new Promise(resolve => { finishLoad = resolve; }));
	const { target, read } = mountNotifications();
	target.querySelector<HTMLButtonElement>('[aria-label="通知を閉じる"]')!.click();
	finishLoad([{ id: 'later', type: 'follow', createdAt: '2020-01-01', isRead: false, user: { id: 'one' } }]);
	await settle();
	expect(fixtures.api).toHaveBeenCalledTimes(1);
	expect(read).not.toHaveBeenCalled();
});

test.each([
	{ name: 'empty', items: [] },
	{ name: 'already read', items: [{ id: 'read', type: 'follow', createdAt: '2020-01-01', isRead: true, user: { id: 'one' } }] },
])('an $name list only refreshes the badge without acknowledging later arrivals', async ({ items }) => {
	fixtures.api.mockResolvedValueOnce(items);
	const { read } = mountNotifications();
	await settle();
	expect(fixtures.api).toHaveBeenCalledTimes(1);
	expect(read).toHaveBeenCalledExactlyOnceWith();
});
