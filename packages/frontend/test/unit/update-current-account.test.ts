/* SPDX-License-Identifier: AGPL-3.0-only */

import { watch } from 'vue';
import { beforeEach, expect, test, vi } from 'vitest';
import { $i } from '@/i.js';
import { replaceCurrentAccountData } from '@/accounts.js';

const state = vi.hoisted(() => ({
	store: { s: { accountTokens: {}, accountInfos: {} }, set: vi.fn() },
}));

vi.mock('@@/js/config.js', () => ({ apiUrl: 'https://hataskey.example/api', host: 'hataskey.example' }));
vi.mock('@/os.js', () => ({
	waiting: vi.fn(), popup: vi.fn(() => ({ dispose: vi.fn() })), popupMenu: vi.fn(), success: vi.fn(), alert: vi.fn(),
}));
vi.mock('@/utility/show-suspended-dialog.js', () => ({ showSuspendedDialog: vi.fn() }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: vi.fn(), reloadChannel: { postMessage: vi.fn() } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { accounts: [] }, commit: vi.fn() } }));
vi.mock('@/store.js', () => ({ store: state.store }));
vi.mock('@/i.js', async () => {
	const { reactive } = await import('vue');
	return { $i: reactive<Record<string, unknown>>({}) };
});
vi.mock('@/signout.js', () => ({ signout: vi.fn() }));
vi.mock('@/utility/concrnt/runtime.js', () => ({ purgeConcrnt: vi.fn() }));

const me = $i as unknown as Record<string, unknown>;

beforeEach(() => {
	for (const key of Object.keys(me)) delete me[key];
	Object.assign(me, { id: 'mod', username: 'mod', isAdmin: false, isModerator: true, staleField: 1, token: 'native-token' });
});

test('同期watcherは更新中もid・権限・tokenの欠けた$iを見ない', () => {
	const seen: unknown[][] = [];
	// 登録申請管理画面と同じく flush: 'sync' で権限とtokenを読む。
	const stop = watch(() => [me.id, me.isAdmin, me.isModerator, me.token], value => { seen.push(value); }, { flush: 'sync' });
	replaceCurrentAccountData({ id: 'mod', username: 'mod-renamed', isAdmin: false, isModerator: true } as never);
	stop();
	expect(seen).toEqual([]);
	expect(me).toEqual({ id: 'mod', username: 'mod-renamed', isAdmin: false, isModerator: true, token: 'native-token' });
});

test('権限が変わったときだけ一度通知し、そのときtokenは残っている', () => {
	const seen: unknown[][] = [];
	const stop = watch(() => [me.isModerator, me.token], value => { seen.push(value); }, { flush: 'sync' });
	replaceCurrentAccountData({ id: 'mod', username: 'mod', isAdmin: false, isModerator: false } as never);
	stop();
	expect(seen).toEqual([[false, 'native-token']]);
});