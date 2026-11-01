/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { signout } from '@/signout.js';

const state = vi.hoisted(() => ({ reload: vi.fn(), purge: vi.fn(), preserve: vi.fn() }));
vi.mock('@@/js/config.js', () => ({ apiUrl: 'https://example.invalid/api' }));
vi.mock('@/preferences/utility.js', () => ({ cloudBackup: vi.fn() }));
vi.mock('@/store.js', () => ({ store: { s: { enablePreferencesAutoCloudBackup: false } } }));
vi.mock('@/os.js', () => ({ waiting: vi.fn() }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: state.reload }));
vi.mock('@/utility/idb-proxy.js', () => ({ clear: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: { id: 'owner', token: 'account-token' } }));
vi.mock('@/preferences.js', () => ({ prefer: { commit: vi.fn() } }));
vi.mock('@/utility/concrnt/runtime.js', () => ({ purgeConcrnt: state.purge, preserveConcrntPurgeMarkers: state.preserve }));
beforeEach(() => {
	vi.clearAllMocks();
	globalThis.localStorage.clear();
	state.purge.mockReset().mockResolvedValue({ cleared: true });
	state.preserve.mockReset().mockReturnValue(() => {});
});
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

test('signout proves ownership of the shared browser subscription before removing all service workers', async () => {
	const order: string[] = [];
	const subscription = {
		endpoint: 'https://push.example/subscription',
		getKey: (key: string) => new Uint8Array(key === 'auth' ? [1, 2, 255] : [4, 5, 254]).buffer,
	};
	const unregister = vi.fn(async () => { order.push('worker'); return true; });
	const registration = { pushManager: { getSubscription: vi.fn(async () => subscription) }, unregister };
	vi.stubGlobal('navigator', {
		serviceWorker: { controller: {}, ready: Promise.resolve(registration), getRegistrations: vi.fn(async () => [registration]) },
	});
	vi.stubGlobal('indexedDB', { deleteDatabase: vi.fn(() => {
		const request: { onsuccess?: () => void } = {};
		queueMicrotask(() => request.onsuccess?.());
		return request;
	}) });
	const fetch = vi.fn(async () => { order.push('server'); return { ok: true }; });
	vi.stubGlobal('fetch', fetch);
	await signout();
	const [url, request] = (fetch.mock.calls as unknown[][])[0] as [string, RequestInit];
	expect(url).toBe('https://example.invalid/api/sw/unregister');
	expect(JSON.parse(request.body as string)).toEqual({ endpoint: subscription.endpoint, auth: 'AQL/', publickey: 'BAX+' });
	expect(order).toEqual(['server', 'worker']);
	expect(state.reload).toHaveBeenCalledWith('/');
});

test('Concrnt未使用でIDBが利用できなくても通常ログアウトを完了する', async () => {
	state.purge.mockRejectedValue(new Error('IDB unavailable'));
	vi.stubGlobal('indexedDB', undefined);
	vi.stubGlobal('navigator', {});
	globalThis.localStorage.setItem('account', 'login-data');
	await signout();
	expect(state.purge).toHaveBeenCalledOnce();
	expect(globalThis.localStorage.getItem('account')).toBeNull();
	expect(state.reload).toHaveBeenCalledWith('/');
});

test('Concrnt消去が停止しても5秒でログアウトし、消去未完了標識を保持する', async () => {
	vi.useFakeTimers();
	state.purge.mockReturnValue(new Promise(() => {}));
	const marker = 'hataskey:concrnt:pending-purge:*';
	globalThis.localStorage.setItem(marker, 'pending');
	globalThis.localStorage.setItem('account', 'login-data');
	state.preserve.mockImplementation(() => {
		const value = globalThis.localStorage.getItem(marker)!;
		return () => globalThis.localStorage.setItem(marker, value);
	});
	vi.stubGlobal('navigator', {});
	vi.stubGlobal('indexedDB', { deleteDatabase: vi.fn(() => {
		const request: { onsuccess?: () => void } = {};
		Promise.resolve().then(() => request.onsuccess?.());
		return request;
	}) });
	const result = signout();
	await vi.advanceTimersByTimeAsync(4999);
	expect(state.reload).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(1);
	await result;
	expect(state.reload).toHaveBeenCalledWith('/');
	expect(globalThis.localStorage.getItem(marker)).toBe('pending');
	expect(globalThis.localStorage.getItem('account')).toBeNull();
});
