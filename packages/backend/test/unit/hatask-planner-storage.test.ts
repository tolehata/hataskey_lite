/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import BatchCommitEndpoint, { meta as batchCommitMeta, paramDef as batchCommitParamDef } from '@/server/api/endpoints/hatask/planner/commit-batch.js';
import { meta as commitMeta, paramDef as commitParamDef } from '@/server/api/endpoints/hatask/planner/commit.js';
import { meta as createShadowMeta, paramDef as createShadowParamDef } from '@/server/api/endpoints/hatask/planner/create-shadow.js';
import { meta as getMeta } from '@/server/api/endpoints/hatask/planner/get.js';
import { RegistryApiService } from '@/core/RegistryApiService.js';
import {
	HATASK_PLANNER_BACKUP_LIMIT,
	HATASK_PLANNER_VALUE_MAX_BYTES,
	appendPlannerBackup,
	assertPlannerValue,
	hashPlannerRawRows,
	hashPlannerShadowSource,
	hashPlannerValue,
	mergePlannerRows,
	plannerBackupKey,
	plannerRawRows,
	readBackupEnvelope,
} from '@/server/api/endpoints/hatask/planner/_shared.js';
import type { MiRegistryItem } from '@/models/RegistryItem.js';

function row(updatedAt: string, value: unknown, id = updatedAt, key = 'todos'): MiRegistryItem {
	return {
		id,
		updatedAt: new Date(updatedAt),
		userId: 'usera',
		user: null,
		key,
		value,
		scope: ['client', 'hatask'],
		domain: null,
	};
}

describe('Hatask planner loss prevention', () => {
	test('planner endpoints are credentialed, scoped, and rate limited', () => {
		expect(getMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'read:account' });
		expect(commitMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'write:account' });
		expect(batchCommitMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'write:account' });
		expect(createShadowMeta).toMatchObject({ requireCredential: true, secure: true, kind: 'write:account' });
		expect(getMeta.limit).toBeDefined();
		expect(commitMeta.limit).toBeDefined();
		expect(batchCommitMeta.limit).toBeDefined();
		expect(createShadowMeta.limit).toBeDefined();
		expect(commitMeta.bodyLimit).toBe(HATASK_PLANNER_VALUE_MAX_BYTES + (64 * 1024));
		expect(commitParamDef.required).toEqual(['collection', 'expectedRevision', 'value']);
		expect(commitParamDef.properties.collection.enum).toEqual(['todos', 'folders', 'events', 'templates']);
		expect(batchCommitParamDef.required).toEqual(['changes']);
		expect(batchCommitParamDef.properties.changes).toMatchObject({ minItems: 1, maxItems: 4 });
		expect(createShadowParamDef.required).toEqual(['expectedRevisions', 'targetIntegrity']);
		expect(createShadowParamDef.properties).not.toHaveProperty('source');
	});

	test('hash is independent of object key insertion order', () => {
		expect(hashPlannerValue([{ id: 'a', text: 'task', nested: { z: 1, a: 2 } }]))
			.toBe(hashPlannerValue([{ nested: { a: 2, z: 1 }, text: 'task', id: 'a' }]));
	});

	test('duplicate legacy rows are merged without dropping older IDs or unknown fields', () => {
		const merged = mergePlannerRows([
			row('2026-08-28T00:00:00.000Z', [{ id: 'old', text: '残す' }, { id: 'same', text: '旧', legacy: true }]),
			row('2026-08-29T00:00:00.000Z', [{ id: 'same', text: '新' }, { id: 'new', text: '追加' }]),
		]);

		expect(merged).toEqual([
			{ id: 'old', text: '残す' },
			{ id: 'same', text: '新', legacy: true },
			{ id: 'new', text: '追加' },
		]);
	});

	test('same-millisecond duplicate rows have a deterministic ID tie-breaker', () => {
		const timestamp = '2026-08-29T00:00:00.000Z';
		const first = row(timestamp, [{ id: 'same', text: 'row-a' }], 'row-a');
		const second = row(timestamp, [{ id: 'same', text: 'row-b' }], 'row-b');
		expect(mergePlannerRows([second, first])).toEqual([{ id: 'same', text: 'row-b' }]);
		expect(mergePlannerRows([first, second])).toEqual([{ id: 'same', text: 'row-b' }]);
	});

	test('unsupported stored values fail closed instead of becoming an empty array', () => {
		expect(() => assertPlannerValue({ id: 'not-an-array' })).toThrow(/array of objects/);
		expect(() => mergePlannerRows([row('2026-08-29T00:00:00.000Z', null)])).toThrow(/array of objects/);
	});

	test('anonymous legacy items keep their exact count so validation can fail closed', () => {
		expect(mergePlannerRows([row('2026-08-29T00:00:00.000Z', [{ text: '匿名' }, { text: '匿名' }])])).toEqual([
			{ text: '匿名' },
			{ text: '匿名' },
		]);
	});

	test('planner commits reject missing and duplicate IDs', () => {
		expect(() => assertPlannerValue([{ text: 'IDなし' }], 'todos')).toThrow(/id must be/);
		expect(() => assertPlannerValue([{ id: 'a', text: '1' }, { id: 'a', text: '2' }], 'todos')).toThrow(/duplicate id/);
	});

	test('template commits require a typed reusable payload', () => {
		expect(() => assertPlannerValue([{ id: 'template-a', kind: 'todo', name: '朝支度', payload: {} }], 'templates')).toThrow(/payload\.text/);
		expect(() => assertPlannerValue([{ id: 'template-a', kind: 'event', name: '定例', payload: [] }], 'templates')).toThrow(/payload must be an object/);
		expect(() => assertPlannerValue([{ id: 'template-a', kind: 'event', name: '定例', payload: { title: '定例会' } }], 'templates')).not.toThrow();
	});

	test('versioned shadow backup keeps bounded distinct snapshots and legacy payload', () => {
		let envelope = readBackupEnvelope('旧形式を保持');
		for (let index = 0; index < HATASK_PLANNER_BACKUP_LIMIT + 2; index++) {
			const value = [{ id: String(index), text: `予定${index}` }];
			const rawRows = plannerRawRows([row(
				`2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
				value,
				`raw-${index}`,
			)]);
			envelope = appendPlannerBackup(
				envelope,
				value,
				`2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
				`2026-08-${String(index + 1).padStart(2, '0')}T00:00:01.000Z`,
				rawRows,
			);
		}

		expect(envelope.legacyValue).toBe('旧形式を保持');
		expect(envelope.snapshots).toHaveLength(HATASK_PLANNER_BACKUP_LIMIT);
		const latestSnapshot = envelope.snapshots[0];
		expect(latestSnapshot.value).toEqual([{ id: '6', text: '予定6' }]);
		expect(latestSnapshot.rawRows).toEqual([expect.objectContaining({ id: 'raw-6', key: 'todos' })]);
		expect(latestSnapshot.rawHash).toBe(hashPlannerRawRows(latestSnapshot.rawRows ?? []));
	});

	test('planner endpoints are registered', () => {
		const source = readFileSync(resolve(import.meta.dirname, '../../src/server/api/endpoint-list.ts'), 'utf8');
		expect(source).toContain('\'hatask/planner/get\'');
		expect(source).toContain('\'hatask/planner/create-shadow\'');
		expect(source).toContain('\'hatask/planner/commit\'');
		expect(source).toContain('\'hatask/planner/commit-batch\'');
	});

	test('batch conflict positive control rejects every write before partial application', async () => {
		const timestamp = '2026-08-30T00:00:00.000Z';
		const storedRows = [
			row(timestamp, [{ id: 'todo-a', text: '既存Todo' }], 'todo-row', 'todos'),
			row(timestamp, [{ id: 'folder-a', name: '既存フォルダ' }], 'folder-row', 'folders'),
		];
		const lockedQuery = {
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			setLock: vi.fn().mockReturnThis(),
			getMany: vi.fn().mockResolvedValue(storedRows),
		};
		const insert = vi.fn().mockResolvedValue(undefined);
		const update = vi.fn().mockResolvedValue(undefined);
		const manager = {
			query: vi.fn().mockResolvedValue(undefined),
			getRepository: vi.fn().mockReturnValue({ createQueryBuilder: vi.fn().mockReturnValue(lockedQuery), insert, update }),
		};
		const endpoint = new BatchCommitEndpoint(
			{ transaction: vi.fn(async callback => await callback(manager)) } as never,
			{ gen: vi.fn().mockReturnValue('generated-id') } as never,
			{ onTodosCommitted: vi.fn().mockResolvedValue({}) } as never,
		);
		await expect(endpoint.exec({
			changes: [
				{
					collection: 'todos',
					expectedRevision: `${timestamp}:${hashPlannerValue([{ id: 'todo-a', text: '既存Todo' }])}`,
					value: [{ id: 'todo-a', text: '既存Todo' }, { id: 'todo-b', text: '追加Todo' }],
				},
				{
					collection: 'folders',
					expectedRevision: 'stale-revision',
					value: [{ id: 'folder-a', name: '既存フォルダ' }, { id: 'folder-b', name: '追加フォルダ' }],
				},
			],
		}, { id: 'usera' } as never, null, null)).rejects.toThrow();
		expect(manager.query.mock.calls.map(call => call[1])).toEqual([
			['hatask-planner:usera:folders'], ['hatask-planner:usera:todos'], ['hatask-flower:usera'],
		]);
		expect(insert).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	test('server-side shadow creation atomically captures every raw duplicate row', async () => {
		const timestamp = '2026-08-30T00:00:00.000Z';
		const storedRows = [
			row(timestamp, [{ id: 'same', text: '旧本文', nested: { old: true } }], 'raw-a'),
			row(timestamp, [{ id: 'same', text: '新本文', nested: { next: true } }], 'raw-b'),
		];
		const lockedQuery = {
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			setLock: vi.fn().mockReturnThis(),
			getMany: vi.fn().mockResolvedValue(storedRows),
		};
		const insert = vi.fn().mockResolvedValue(undefined);
		const manager = {
			query: vi.fn().mockResolvedValue(undefined),
			getRepository: vi.fn().mockReturnValue({ createQueryBuilder: vi.fn().mockReturnValue(lockedQuery), insert }),
		};
		const service = new RegistryApiService(
			{ onTodosCommitted: vi.fn().mockResolvedValue({}) } as never,
			{ manager: { transaction: vi.fn(async (callback: (value: typeof manager) => unknown) => await callback(manager)) } } as never,
			{ gen: vi.fn().mockReturnValue('shadow-id') } as never,
			{ publishMainStream: vi.fn() } as never,
		);
		const merged = mergePlannerRows(storedRows);
		const result = await service.createHataskPlannerMigrationShadow(
			'usera',
			{
				todos: `${timestamp}:${hashPlannerValue(merged)}`,
				folders: null,
				events: null,
			},
			{
				schemaVersion: 2,
				collections: {
					todos: { count: 1, normalizedHash: 'fnv1a64:0000000000000001' },
					folders: { count: 0, normalizedHash: 'fnv1a64:0000000000000002' },
					events: { count: 0, normalizedHash: 'fnv1a64:0000000000000003' },
				},
				fullNormalizedHash: 'fnv1a64:0000000000000004',
			},
		);

		expect(manager.query).toHaveBeenCalledTimes(3);
		expect(result).toMatchObject({ created: true, rawRowCount: 2 });
		const storedShadow = insert.mock.calls[0][0].value;
		expect(storedShadow.source.todos.value).toEqual([{ id: 'same', text: '新本文', nested: { next: true } }]);
		expect(storedShadow.source.todos.rawRows).toEqual([
			expect.objectContaining({ id: 'raw-a', value: [{ id: 'same', text: '旧本文', nested: { old: true } }] }),
			expect.objectContaining({ id: 'raw-b', value: [{ id: 'same', text: '新本文', nested: { next: true } }] }),
		]);
		expect(storedShadow.source.todos.rawHash).toBe(hashPlannerRawRows(storedShadow.source.todos.rawRows));
		expect(storedShadow.sourceHash).toBe(hashPlannerShadowSource(storedShadow.source));
	});

	test('planner writes never publish private values while an ordinary native Registry write still publishes', async () => {
		const commitSource = readFileSync(resolve(import.meta.dirname, '../../src/server/api/endpoints/hatask/planner/commit.ts'), 'utf8');
		expect(commitSource).not.toContain('publishMainStream');
		const lockedQuery = {
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			setLock: vi.fn().mockReturnThis(),
			getMany: vi.fn().mockResolvedValue([]),
		};
		const transactionalRepository = {
			createQueryBuilder: vi.fn().mockReturnValue(lockedQuery),
			insert: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
		};
		const manager = {
			query: vi.fn().mockResolvedValue(undefined),
			getRepository: vi.fn().mockReturnValue(transactionalRepository),
		};
		const ordinaryQuery = {
			where: vi.fn().mockReturnThis(),
			andWhere: vi.fn().mockReturnThis(),
			getOne: vi.fn().mockResolvedValue(null),
		};
		const registryRepository = {
			manager: { transaction: vi.fn(async callback => await callback(manager)) },
			createQueryBuilder: vi.fn().mockReturnValue(ordinaryQuery),
			insert: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
		};
		const publishMainStream = vi.fn();
		const service = new RegistryApiService(
			{ onTodosCommitted: vi.fn().mockResolvedValue({}) } as never,
			registryRepository as never,
			{ gen: vi.fn().mockReturnValue('generated-id') } as never,
			{ publishMainStream } as never,
		);
		await expect(service.set('usera', null, ['client', 'hatask'], plannerBackupKey('todos'), { forged: true }))
			.rejects.toThrow(/write-protected/u);

		await service.set('usera', null, ['client', 'hatask'], 'todos', [{ id: 'todo-a', text: '秘密の本文' }]);
		expect(publishMainStream).not.toHaveBeenCalled();

		await service.set('usera', null, ['client', 'hatask'], 'settings', { theme: 'kisetsu' });
		expect(publishMainStream).toHaveBeenCalledTimes(1);
		expect(publishMainStream).toHaveBeenCalledWith('usera', 'registryUpdated', {
			scope: ['client', 'hatask'],
			key: 'settings',
			value: { theme: 'kisetsu' },
		});
	});
});
