/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import RegistryGetAllEndpoint from '@/server/api/endpoints/i/registry/get-all.js';
import RegistryGetDetailEndpoint from '@/server/api/endpoints/i/registry/get-detail.js';
import RegistryGetEndpoint from '@/server/api/endpoints/i/registry/get.js';
import RegistryKeysWithTypeEndpoint from '@/server/api/endpoints/i/registry/keys-with-type.js';
import RegistryKeysEndpoint from '@/server/api/endpoints/i/registry/keys.js';
import RegistryRemoveEndpoint from '@/server/api/endpoints/i/registry/remove.js';
import RegistrySetEndpoint from '@/server/api/endpoints/i/registry/set.js';

function registryService() {
	return {
		getAllItemsOfScope: vi.fn().mockResolvedValue([]),
		getAllKeysOfScope: vi.fn().mockResolvedValue([]),
		getItem: vi.fn().mockResolvedValue({ updatedAt: new Date('2026-08-30T00:00:00.000Z'), value: [] }),
		remove: vi.fn().mockResolvedValue(undefined),
		set: vi.fn().mockResolvedValue(undefined),
	};
}

describe('Hatask native Registry access', () => {
	test('Flash tokens cannot read, enumerate, overwrite, or remove the native Hatask scope', async () => {
		const service = registryService();
		const user = { id: 'usera' } as never;
		const flashToken = { userId: 'usera', permissions: ['read:account', 'write:account'] } as never;
		const scope = ['client', 'hatask'];
		const calls = [
			new RegistryGetAllEndpoint(service as never).exec({ scope }, user, null, flashToken),
			new RegistryGetDetailEndpoint(service as never).exec({ key: 'todos', scope }, user, null, flashToken),
			new RegistryGetEndpoint(service as never).exec({ key: 'todos', scope }, user, null, flashToken),
			new RegistryKeysWithTypeEndpoint(service as never).exec({ scope }, user, null, flashToken),
			new RegistryKeysEndpoint(service as never).exec({ scope }, user, null, flashToken),
			new RegistryRemoveEndpoint(service as never).exec({ key: 'plannerMigrationShadowV2', scope }, user, null, flashToken),
			new RegistrySetEndpoint(service as never).exec({ key: 'todos', value: [], scope }, user, null, flashToken),
		];

		for (const call of calls) {
			await expect(call).rejects.toMatchObject({ code: 'HATASK_REGISTRY_NATIVE_ONLY' });
		}
		expect(service.getAllItemsOfScope).not.toHaveBeenCalled();
		expect(service.getAllKeysOfScope).not.toHaveBeenCalled();
		expect(service.getItem).not.toHaveBeenCalled();
		expect(service.remove).not.toHaveBeenCalled();
		expect(service.set).not.toHaveBeenCalled();
	});

	test('positive control: the signed-in first-party client keeps native read/write access', async () => {
		const service = registryService();
		const user = { id: 'usera' } as never;
		const scope = ['client', 'hatask'];
		const getEndpoint = new RegistryGetEndpoint(service as never);
		const setEndpoint = new RegistrySetEndpoint(service as never);

		await expect(getEndpoint.exec({ key: 'todos', scope }, user, null, null)).resolves.toEqual([]);
		await expect(setEndpoint.exec({ key: 'settings', value: { theme: 'kisetsu' }, scope }, user, null, null)).resolves.toBeUndefined();
		expect(service.getItem).toHaveBeenCalledWith('usera', null, scope, 'todos');
		expect(service.set).toHaveBeenCalledWith('usera', null, scope, 'settings', { theme: 'kisetsu' });
	});

	test('positive control: Flash registry access outside the Hatask native scope is unchanged', async () => {
		const service = registryService();
		const endpoint = new RegistryGetEndpoint(service as never);
		const user = { id: 'usera' } as never;
		const flashToken = { userId: 'usera', permissions: ['read:account'] } as never;

		await expect(endpoint.exec({ key: 'value', scope: ['another', 'client'] }, user, null, flashToken)).resolves.toEqual([]);
		expect(service.getItem).toHaveBeenCalledOnce();
	});
});
