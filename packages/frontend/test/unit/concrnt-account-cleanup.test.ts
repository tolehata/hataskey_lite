/* SPDX-License-Identifier: AGPL-3.0-only */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { removeAccount, refreshCurrentAccount } from '@/accounts.js';

const state = vi.hoisted(() => ({
	purge: vi.fn(), reload: vi.fn(), signout: vi.fn(),
	store: {
		s: { accountTokens: {} as Record<string, string>, accountInfos: {} as Record<string, unknown> },
		set: vi.fn(),
	},
	prefer: {
		s: { accounts: [] as [string, { id: string; username: string }][] },
		commit: vi.fn(),
	},
}));

vi.mock('@@/js/config.js', () => ({ apiUrl: 'https://hataskey.example/api', host: 'hataskey.example' }));
vi.mock('@/os.js', () => ({
	waiting: vi.fn(), popup: vi.fn(() => ({ dispose: vi.fn() })), popupMenu: vi.fn(), success: vi.fn(), alert: vi.fn(),
}));
vi.mock('@/utility/show-suspended-dialog.js', () => ({ showSuspendedDialog: vi.fn() }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: state.reload, reloadChannel: { postMessage: vi.fn() } }));
vi.mock('@/preferences.js', () => ({ prefer: state.prefer }));
vi.mock('@/store.js', () => ({ store: state.store }));
vi.mock('@/i.js', () => ({ $i: { id: 'removed', token: 'revoked-token' } }));
vi.mock('@/signout.js', () => ({ signout: state.signout }));
vi.mock('@/utility/concrnt/runtime.js', () => ({ purgeConcrnt: state.purge }));

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	state.store.s.accountTokens = { 'hataskey.example/removed': 'revoked-token', 'hataskey.example/kept': 'valid-token' };
	state.store.s.accountInfos = { 'hataskey.example/removed': { id: 'removed' }, 'hataskey.example/kept': { id: 'kept' } };
	state.prefer.s.accounts = [['hataskey.example', { id: 'removed', username: 'removed' }], ['hataskey.example', { id: 'kept', username: 'kept' }]];
	state.store.set.mockImplementation((key: 'accountTokens' | 'accountInfos', value: Record<string, never>) => { state.store.s[key] = value; });
	state.prefer.commit.mockImplementation((_key: string, value: typeof state.prefer.s.accounts) => { state.prefer.s.accounts = value; });
	state.purge.mockReset().mockResolvedValue({ cleared: true });
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

test('消去の完了を待つ前に失効済みアカウントを一覧から除き、5秒で戻る', async () => {
	state.purge.mockReturnValue(new Promise(() => {}));
	const result = removeAccount('hataskey.example', 'removed');
	expect(state.store.s.accountTokens).toEqual({ 'hataskey.example/kept': 'valid-token' });
	expect(state.store.s.accountInfos).toEqual({ 'hataskey.example/kept': { id: 'kept' } });
	expect(state.prefer.s.accounts).toEqual([['hataskey.example', { id: 'kept', username: 'kept' }]]);
	await vi.advanceTimersByTimeAsync(5000);
	await result;
	expect(state.purge).toHaveBeenCalledWith('hataskey.example/removed');
});

test('端末データの消去エラーを通常アカウント削除へ伝播させない', async () => {
	state.purge.mockRejectedValue(new Error('IDB unavailable'));
	await expect(removeAccount('hataskey.example', 'removed')).resolves.toBeUndefined();
	expect(state.store.s.accountTokens).toEqual({ 'hataskey.example/kept': 'valid-token' });
});

test('失効通知後の自動切替が消去待ち中の旧トークンを再選択しない', async () => {
	state.purge.mockReturnValue(new Promise(() => {}));
	const fetch = vi.fn()
		.mockResolvedValueOnce({ status: 401, json: async () => ({ error: { id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14' } }) })
		.mockResolvedValueOnce({ status: 200, json: async () => ({ id: 'kept', username: 'kept' }) });
	vi.stubGlobal('fetch', fetch);
	await refreshCurrentAccount();
	await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
	expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ i: 'valid-token' });
	expect(state.signout).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(5000);
});
