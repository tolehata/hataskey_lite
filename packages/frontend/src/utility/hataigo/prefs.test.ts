/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useHataigoPrefs } from './prefs.js';
import type { HataigoPrefs } from './prefs.js';

type AccountFixture = { id: string; token: string } | null;
type RegistryParams = { scope: string[]; key: string; value?: unknown };

const fixtures = vi.hoisted(() => ({
	api: vi.fn(),
	account: { current: null as AccountFixture },
}));
vi.mock('@/i.js', () => ({ get $i() { return fixtures.account.current; } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixtures.api(...args) }));

const registry = new Map<string, unknown>();
let accountNumber = 0;
const defaultPrefs: HataigoPrefs = { theme: 'fuji', stones: 'real', labels: true, autoplayInterval: 1000, placement: 'auto', showThought: true, showEstimate: true };

function signedInAccount(): Exclude<AccountFixture, null> {
	const account = fixtures.account.current;
	if (!account) throw new Error('Expected signed-in account fixture');
	return account;
}

function missingKey(): Error & { code: string } {
	return Object.assign(new Error('No such key'), { code: 'NO_SUCH_KEY' });
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

async function registryApi(endpoint: string, params: RegistryParams, token: string): Promise<unknown> {
	expect(params.scope).toEqual(['client', 'hataigo']);
	expect(params.key).toBe('display');
	expect(token).toBe(fixtures.account.current?.token);
	if (endpoint === 'i/registry/get') {
		if (!registry.has(token)) throw missingKey();
		return registry.get(token);
	}
	if (endpoint === 'i/registry/set') {
		registry.set(token, params.value);
		return undefined;
	}
	throw new Error(`Unexpected endpoint ${endpoint}`);
}

describe('HataIgo display preferences', () => {
	beforeEach(() => {
		registry.clear();
		accountNumber++;
		fixtures.account.current = { id: `hataigo-owner-${accountNumber}`, token: `hataigo-token-${accountNumber}` };
		fixtures.api.mockReset();
		fixtures.api.mockImplementation(registryApi);
	});

	test('loads defaults for an absent registry key', async () => {
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));

		expect(result.prefs).toEqual(defaultPrefs);
		expect(result.error.value).toBeNull();
		expect(fixtures.api).toHaveBeenCalledWith('i/registry/get', { scope: ['client', 'hataigo'], key: 'display' }, fixtures.account.current?.token);
	});

	test('remembers whether the AI thought and estimate cards are shown, and ignores non-boolean values', async () => {
		registry.set(signedInAccount().token, { showThought: false, showEstimate: 'no' });
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));
		expect(result.prefs.showThought).toBe(false);
		expect(result.prefs.showEstimate).toBe(true);
		expect(await result.save({ showEstimate: false })).toBe(true);
		expect(registry.get(signedInAccount().token)).toMatchObject({ showThought: false, showEstimate: false });
		expect(result.prefs.showEstimate).toBe(false);
	});

	test('loads supported values, defaults unknown values, and keeps unrelated remote keys', async () => {
		registry.set(signedInAccount().token, {
			theme: 'sumi', stones: 'unknown', labels: 'yes', autoplayInterval: 9000, futureOption: { enabled: true },
		});
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));

		expect(result.prefs).toEqual({ ...defaultPrefs, theme: 'sumi' });
		expect(result.error.value).toBeNull();
	});

	test('shows a real read failure and does not treat it as an absent key', async () => {
		const failure = new Error('registry offline');
		fixtures.api.mockRejectedValue(failure);
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));

		expect(result.prefs).toEqual(defaultPrefs);
		expect(result.error.value).toBe('registry offline');
		expect(await result.save({ theme: 'kaya' })).toBe(false);
		expect(fixtures.api.mock.calls.some(([endpoint]) => endpoint === 'i/registry/set')).toBe(false);
		expect(result.prefs.theme).toBe('fuji');
	});

	test('keeps current values and exposes an error when registry write fails', async () => {
		registry.set(signedInAccount().token, { ...defaultPrefs, theme: 'seiji' });
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));
		fixtures.api.mockImplementation(async (endpoint: string, params: RegistryParams, token: string) => {
			if (endpoint === 'i/registry/set') throw new Error('registry write failed');
			return registryApi(endpoint, params, token);
		});

		expect(await result.save({ theme: 'kaya' })).toBe(false);
		expect(result.prefs.theme).toBe('seiji');
		expect(result.error.value).toBe('registry write failed');
	});

	test('read-merges and preserves unknown keys; visible values change only after the write succeeds', async () => {
		registry.set(signedInAccount().token, { theme: 'seiji', futureOption: 42 });
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));
		const write = deferred<unknown>();
		fixtures.api.mockImplementation(async (endpoint: string, params: RegistryParams, token: string) => {
			if (endpoint === 'i/registry/set') {
				expect(params.scope).toEqual(['client', 'hataigo']);
				return write.promise;
			}
			return registryApi(endpoint, params, token);
		});

		const saving = result.save({ theme: 'kaya', autoplayInterval: 1500 });
		await vi.waitFor(() => expect(fixtures.api.mock.calls.some(([endpoint]) => endpoint === 'i/registry/set')).toBe(true));
		expect(result.prefs).toEqual({ ...defaultPrefs, theme: 'seiji' });
		write.resolve(undefined);
		expect(await saving).toBe(true);
		expect(result.prefs).toEqual({ ...defaultPrefs, theme: 'kaya', autoplayInterval: 1500 });
		expect(fixtures.api.mock.calls.find(([endpoint]) => endpoint === 'i/registry/set')?.[1]).toEqual({
			scope: ['client', 'hataigo'], key: 'display', value: { theme: 'kaya', futureOption: 42, autoplayInterval: 1500 },
		});
	});

	test('serializes saves and validates values before persisting', async () => {
		registry.set(signedInAccount().token, { futureOption: true, theme: 'fuji', stones: 'real', labels: true, autoplayInterval: 1000 });
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));

		const first = result.save({ theme: 'kaya' });
		const second = result.save({ labels: false, autoplayInterval: 100, theme: 'future' as HataigoPrefs['theme'] });
		expect(await Promise.all([first, second])).toEqual([true, true]);
		expect(registry.get(signedInAccount().token)).toEqual({
			futureOption: true, theme: 'fuji', stones: 'real', labels: false, autoplayInterval: 1000,
		});
		expect(result.prefs).toEqual({ ...defaultPrefs, labels: false });
	});

	test('does not let an in-flight stale load overwrite a successful save', async () => {
		const initialRead = deferred<unknown>();
		let reads = 0;
		fixtures.api.mockImplementation(async (endpoint: string, params: RegistryParams, token: string) => {
			if (endpoint === 'i/registry/get' && ++reads === 1) return initialRead.promise;
			return registryApi(endpoint, params, token);
		});
		const result = useHataigoPrefs();
		registry.set(signedInAccount().token, { theme: 'fuji' });
		expect(await result.save({ theme: 'kaya' })).toBe(true);
		initialRead.resolve({ theme: 'sumi' });
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));

		expect(result.prefs.theme).toBe('kaya');
	});

	test('keeps reactive preference state separate between accounts', async () => {
		const firstAccount = signedInAccount();
		registry.set(firstAccount.token, { ...defaultPrefs, theme: 'sumi' });
		const first = useHataigoPrefs();
		await vi.waitFor(() => expect(first.loaded.value).toBe(true));
		fixtures.account.current = { id: `${firstAccount.id}-other`, token: `${firstAccount.token}-other` };
		registry.set(fixtures.account.current.token, { ...defaultPrefs, theme: 'sakura' });
		const second = useHataigoPrefs();
		await vi.waitFor(() => expect(second.loaded.value).toBe(true));

		expect(first.prefs.theme).toBe('sumi');
		expect(second.prefs.theme).toBe('sakura');
		expect(first.prefs).not.toBe(second.prefs);
	});
	test('reloads a discarded in-flight read when returning to the same account', async () => {
		const originalAccount = fixtures.account.current;
		if (!originalAccount) throw new Error('Expected signed-in fixture');
		const pending = deferred<unknown>();
		fixtures.api.mockImplementationOnce(() => pending.promise);
		const first = useHataigoPrefs();
		fixtures.account.current = { id: 'temporary-other', token: 'temporary-token' };
		pending.resolve({ theme: 'sumi' });
		await pending.promise;
		await Promise.resolve();
		await Promise.resolve();
		expect(first.loaded.value).toBe(false);
		fixtures.account.current = originalAccount;
		registry.set(originalAccount.token, { theme: 'seiji' });
		const returned = useHataigoPrefs();
		await vi.waitFor(() => expect(returned.loaded.value).toBe(true));
		expect(returned.prefs.theme).toBe('seiji');
		expect(returned.prefs).toBe(first.prefs);
	});

	test('saving after logout returns false without throwing or sending a request', async () => {
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));
		fixtures.api.mockClear();
		fixtures.account.current = null;
		expect(await result.save({ theme: 'sumi' })).toBe(false);
		expect(fixtures.api).not.toHaveBeenCalled();
	});

	test('snapshots a queued patch before the caller can change it', async () => {
		const result = useHataigoPrefs();
		await vi.waitFor(() => expect(result.loaded.value).toBe(true));
		const patch: Partial<HataigoPrefs> = { labels: false };
		const saving = result.save(patch);
		patch.labels = true;
		expect(await saving).toBe(true);
		expect(result.prefs.labels).toBe(false);
	});
});
