/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import type * as Misskey from 'cherrypick-js';

const fixture = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/utility/hatady-reaction-details.js', () => ({ listHatadyReactionPage: fixture.list }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { reactionsList: 'リアクション一覧', all: 'すべて', noUsers: 'ユーザーはいません', retry: '再試行', loadMore: 'もっと見る', _hata: { _hatady: { _userList: { loading: '読み込み中' } } } } } }));
vi.mock('@/components/HyDialog.vue', () => ({ default: defineComponent({
	setup(_, { slots, emit, expose }) {
		expose({ close: () => emit('closed') });
		return () => h('section', slots.default?.());
	},
}) }));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: defineComponent({ props: ['reaction'], setup(props) { return () => h('span', { 'data-reaction': props.reaction }); } }) }));
import HatadyReactionSheet from './HatadyReactionSheet.vue';

const cleanup: Array<() => void> = [];
const user = (id: string) => ({ id, username: id, host: null }) as Misskey.entities.UserLite;
const row = (id: string, reaction = '👍', owner = id) => ({ id, createdAt: '2026-01-01T00:00:00Z', reaction, user: user(owner) });
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await nextTick(); };

async function mountSheet() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatadyReactionSheet, { target: { logId: 'log-1' }, reactions: { '👍': 101, '❤️': 2 } }) });
	app.component('MkAvatar', defineComponent({ setup() { return () => h('span'); } }));
	app.component('MkUserName', defineComponent({ props: ['user'], setup(props) { return () => h('span', props.user.username); } }));
	app.mount(target);
	cleanup.push(() => { app.unmount(); target.remove(); });
	await settle();
	return target;
}

beforeEach(() => fixture.list.mockReset());
afterEach(() => cleanup.splice(0).forEach(fn => fn()));

test('all reactions group by user and load the next API page', async () => {
	fixture.list.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => row(String(100 - i), i === 1 ? '❤️' : '👍', i < 2 ? 'shared' : String(i)))).mockResolvedValueOnce([row('0')]);
	const host = await mountSheet();
	expect(fixture.list).toHaveBeenCalledWith({ logId: 'log-1' }, undefined, undefined);
	expect(host.querySelectorAll('li')).toHaveLength(99);
	expect(host.querySelectorAll('li')[0].querySelectorAll('[data-reaction]')).toHaveLength(2);
	Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('もっと見る'))?.click();
	await settle();
	expect(fixture.list).toHaveBeenLastCalledWith({ logId: 'log-1' }, undefined, '1');
	expect(host.querySelectorAll('li')).toHaveLength(100);
});

test('tab switch discards a pending response, then an error can be retried', async () => {
	let finishOld!: (rows: ReturnType<typeof row>[]) => void;
	fixture.list.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([row('heart', '❤️')]);
	const host = await mountSheet();
	const heartTab = host.querySelector<HTMLButtonElement>('button:has([data-reaction="❤️"])')!;
	heartTab.click();
	await settle();
	finishOld([row('stale')]);
	await settle();
	expect(host.textContent).not.toContain('stale');
	expect(host.querySelector('[role="alert"]')).not.toBeNull();
	Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('再試行'))?.click();
	await settle();
	expect(fixture.list).toHaveBeenLastCalledWith({ logId: 'log-1' }, '❤️', undefined);
	expect(host.textContent).toContain('heart');
	expect(host.querySelector('[role="alert"]')).toBeNull();
	expect(fixture.list.mock.calls.every(([target]) => target.logId === 'log-1')).toBe(true);
});
