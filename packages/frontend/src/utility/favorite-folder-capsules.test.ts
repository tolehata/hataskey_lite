/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { reactive } from 'vue';

const fixtures = vi.hoisted(() => ({ api: vi.fn(), account: null as null | { id: string; token: string } }));
vi.mock('@/i.js', () => ({ get $i() { return fixtures.account; } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));

beforeEach(() => { vi.resetModules(); fixtures.api.mockReset(); fixtures.account = reactive({ id: 'alice', token: 'alice-token' }); });

describe('favorite capsule persistence', () => {
	test('registry-valid scope saves the order and restores it after a fresh load', async () => {
		// Exercise the server's actual scope constraints, not an always-successful API stub.
		const patterns = ['get', 'set'].map(endpoint => {
			const source = readFileSync(`${process.cwd()}/../backend/src/server/api/endpoints/i/registry/${endpoint}.ts`, 'utf8');
			const pattern = source.match(/pattern: \/(.+?)\/\.toString\(\)\.slice\(1, -1\)/)?.[1];
			if (!pattern) throw new Error(`Missing registry scope constraint: ${endpoint}`);
			return new RegExp(pattern);
		});
		// Positive control: the previous scope is rejected by both API contracts.
		for (const pattern of patterns) expect(pattern.test('favorite-folders')).toBe(false);
		const registry = new Map<string, string[]>();
		fixtures.api.mockImplementation(async (endpoint: string, params: { scope: string[]; key: string; value?: string[] }) => {
			const pattern = patterns[endpoint === 'i/registry/get' ? 0 : 1];
			if (!params.scope.every(segment => pattern.test(segment))) throw Object.assign(new Error('Invalid scope'), { code: 'INVALID_PARAM' });
			const key = [...params.scope, params.key].join('/');
			if (endpoint === 'i/registry/set') { registry.set(key, [...params.value!]); return; }
			if (!registry.has(key)) throw Object.assign(new Error('No such key'), { code: 'NO_SUCH_KEY' });
			return [...registry.get(key)!];
		});
		const state = await import('./favorite-folder-capsules.js');
		await state.loadFavoriteCapsules();
		expect(await state.saveFavoriteCapsules(['read', 'all', 'unfiled'], ['read'])).toBe(true);
		vi.resetModules();
		const restored = await import('./favorite-folder-capsules.js');
		await restored.loadFavoriteCapsules();
		expect(restored.favoriteCapsules.loaded).toBe(true);
		expect(restored.favoriteCapsules.order).toEqual(['read', 'all', 'unfiled']);
	});

	test('read failures do not overwrite registry and missing key can be saved explicitly', async () => {
		fixtures.api.mockRejectedValueOnce({ code: 'OFFLINE' });
		const state = await import('./favorite-folder-capsules.js');
		await expect(state.loadFavoriteCapsules()).rejects.toMatchObject({ code: 'OFFLINE' });
		expect(await state.saveFavoriteCapsules(['unfiled', 'all'], [])).toBe(false);
		expect(fixtures.api).toHaveBeenCalledTimes(1);
		fixtures.api.mockRejectedValueOnce({ code: 'NO_SUCH_KEY' });
		await state.loadFavoriteCapsules();
		fixtures.api.mockResolvedValueOnce(undefined);
		expect(await state.saveFavoriteCapsules(['unfiled', 'all'], [])).toBe(true);
		expect(fixtures.api).toHaveBeenLastCalledWith('i/registry/set', { scope: ['client', 'favorite_folders'], key: 'capsuleOrder', value: ['unfiled', 'all'] }, 'alice-token');
	});
	test('failed write keeps original order and retries without duplicate concurrent writes', async () => {
		fixtures.api.mockResolvedValueOnce(['unfiled', 'all']);
		const state = await import('./favorite-folder-capsules.js');
		await state.loadFavoriteCapsules();
		let rejectWrite!: (reason: unknown) => void;
		fixtures.api.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectWrite = reject; }));
		const write = state.saveFavoriteCapsules(['all', 'unfiled'], []);
		expect(await state.saveFavoriteCapsules(['all', 'unfiled'], [])).toBe(false);
		rejectWrite(new Error('offline'));
		await expect(write).rejects.toThrow('offline');
		expect(state.favoriteCapsules.order).toEqual(['unfiled', 'all']);
		fixtures.api.mockResolvedValueOnce(undefined);
		expect(await state.saveFavoriteCapsules(['all', 'unfiled'], [])).toBe(true);
	});
	test('late reads and writes cannot populate another account or token generation', async () => {
		let completeRead!: (value: unknown) => void;
		fixtures.api.mockImplementationOnce(() => new Promise(resolve => { completeRead = resolve; }));
		const state = await import('./favorite-folder-capsules.js');
		const read = state.loadFavoriteCapsules();
		fixtures.account!.id = 'bob'; fixtures.account!.token = 'bob-token';
		fixtures.api.mockResolvedValueOnce(['all', 'unfiled']);
		await state.loadFavoriteCapsules();
		completeRead(['unfiled', 'all', 'alice-private-folder']); await read;
		expect(state.favoriteCapsules.order).toEqual(['all', 'unfiled']);
		let completeWrite!: () => void;
		fixtures.api.mockImplementationOnce(() => new Promise<void>(resolve => { completeWrite = resolve; }));
		const write = state.saveFavoriteCapsules(['unfiled', 'all'], []);
		fixtures.account!.token = 'new-bob-token';
		completeWrite();
		expect(await write).toBe(false);
		expect(state.favoriteCapsules.loaded).toBe(false);
		expect(state.favoriteCapsules.order).toEqual([]);
	});
});
