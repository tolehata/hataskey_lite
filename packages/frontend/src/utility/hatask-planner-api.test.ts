/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { createHataskPlannerApiStoragePort } from '@/utility/hatask-planner-api.js';

const scope = ['client', 'hatask'] as const;

function snapshot() {
	return {
		version: 1,
		collections: {
			todos: { exists: true, updatedAt: '2026-08-30T00:00:00.000Z', revision: 'todo-revision-a', value: [{ id: 'todo-a' }] },
			folders: { exists: false, updatedAt: null, revision: null, value: [] },
			events: { exists: true, updatedAt: '2026-08-30T00:00:00.000Z', revision: 'event-revision-a', value: [{ id: 'event-a' }] },
		},
	};
}

describe('Hatask planner API storage adapter', () => {
	test('coalesces parallel collection reads and distinguishes a missing key', async () => {
		const api = vi.fn(async (endpoint: string, _params: Record<string, unknown>) => endpoint === 'hatask/planner/get' ? snapshot() : null);
		const port = createHataskPlannerApiStoragePort(api);
		const [todos, events] = await Promise.all([
			port.read({ scope, key: 'todos' }),
			port.read({ scope, key: 'events' }),
		]);
		expect(todos.value).toEqual([{ id: 'todo-a' }]);
		expect(events.value).toEqual([{ id: 'event-a' }]);
		expect(api).toHaveBeenCalledTimes(1);
		await expect(port.read({ scope, key: 'folders' })).rejects.toMatchObject({ code: 'NO_SUCH_KEY' });
	});

	test('canonical writes use atomic revision comparison and invalidate the snapshot', async () => {
		const api = vi.fn(async (endpoint: string, _params: Record<string, unknown>) => {
			if (endpoint === 'hatask/planner/get') return snapshot();
			if (endpoint === 'hatask/planner/commit') return { revision: 'todo-revision-b' };
			throw new Error(endpoint);
		});
		const port = createHataskPlannerApiStoragePort(api);
		await port.read({ scope, key: 'todos' });
		const result = await port.write({ scope, key: 'todos', value: [{ id: 'todo-b' }], expectedRevision: 'todo-revision-a' });
		expect(result).toEqual({ revision: 'todo-revision-b' });
		expect(api).toHaveBeenCalledWith('hatask/planner/commit', {
			collection: 'todos', expectedRevision: 'todo-revision-a', value: [{ id: 'todo-b' }],
		});
		await port.read({ scope, key: 'events' });
		expect(api.mock.calls.filter(call => call[0] === 'hatask/planner/get')).toHaveLength(2);
	});

	test('migration writes every changed collection through one atomic batch', async () => {
		const api = vi.fn(async (endpoint: string, _params: Record<string, unknown>) => {
			if (endpoint === 'hatask/planner/commit-batch') return { collections: {} };
			throw new Error(endpoint);
		});
		const port = createHataskPlannerApiStoragePort(api);
		await port.writeBatch?.({
			scope,
			writes: [
				{ key: 'todos', value: [{ id: 'todo-b' }] as never, expectedRevision: 'todo-revision-a' },
				{ key: 'events', value: [{ id: 'event-b' }] as never, expectedRevision: 'event-revision-a' },
			],
		});
		expect(api).toHaveBeenCalledOnce();
		expect(api).toHaveBeenCalledWith('hatask/planner/commit-batch', {
			changes: [
				{ collection: 'todos', expectedRevision: 'todo-revision-a', value: [{ id: 'todo-b' }] },
				{ collection: 'events', expectedRevision: 'event-revision-a', value: [{ id: 'event-b' }] },
			],
		});
	});

	test('shadow creation sends only compact evidence while the server captures the large source', async () => {
		const api = vi.fn(async (endpoint: string, _params: Record<string, unknown>) => {
			if (endpoint === 'hatask/planner/get') return snapshot();
			if (endpoint === 'hatask/planner/create-shadow') return { revision: 'shadow-revision-a' };
			throw new Error(endpoint);
		});
		const port = createHataskPlannerApiStoragePort(api);
		const hugeSource = 'x'.repeat(1024 * 1024 + 1);
		const targetIntegrity = {
			schemaVersion: 2 as const,
			collections: {
				todos: { count: 1, normalizedHash: 'fnv1a64:0000000000000001' },
				folders: { count: 0, normalizedHash: 'fnv1a64:0000000000000002' },
				events: { count: 1, normalizedHash: 'fnv1a64:0000000000000003' },
			},
			fullNormalizedHash: 'fnv1a64:0000000000000004',
		};
		const result = await port.write({
			scope,
			key: 'plannerMigrationShadowV2',
			value: {
				format: 'hatask-planner-shadow', version: 1, targetSchemaVersion: 2,
				createdAt: '2026-08-30T00:00:00.000Z',
				source: { todos: { status: 'loaded', value: [{ id: 'todo-a', text: hugeSource }] }, folders: { status: 'missing' }, events: { status: 'missing' } },
				sourceHash: 'fnv1a64:0000000000000005',
				targetIntegrity,
			},
			expectedRevision: null,
		});

		expect(result).toEqual({ revision: 'shadow-revision-a' });
		const call = api.mock.calls.find(entry => entry[0] === 'hatask/planner/create-shadow');
		expect(call?.[1]).toEqual({
			expectedRevisions: { todos: 'todo-revision-a', folders: null, events: 'event-revision-a' },
			targetIntegrity,
		});
		expect(JSON.stringify(call?.[1]).length).toBeLessThan(1000);
		expect(api).not.toHaveBeenCalledWith('i/registry/set', expect.anything());
	});
});
