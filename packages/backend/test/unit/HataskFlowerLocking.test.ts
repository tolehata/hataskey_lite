/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';
import { RegistryApiService } from '@/core/RegistryApiService.js';
import CommitEndpoint from '@/server/api/endpoints/hatask/planner/commit.js';
import BatchCommitEndpoint from '@/server/api/endpoints/hatask/planner/commit-batch.js';

vi.mock('@/core/NotificationService.js', () => ({ NotificationService: class {} }));

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(done => { resolve = done; });
	return { promise, resolve };
}

// A deterministic transaction-lock fixture, not a PostgreSQL integration test.
// The registry and public-flower writes below model the actual BEFORE trigger.
function transactionLocks() {
	const owners = new Map<string, string>();
	const waiting = new Map<string, string>();
	const wakeups = new Map<string, (() => void)[]>();
	const steps: string[] = [];

	async function lock(transaction: string, key: string): Promise<void> {
		steps.push(`${transaction}:${key}`);
		const owner = owners.get(key);
		if (owner && owner !== transaction) {
			waiting.set(transaction, owner);
			let cursor: string | undefined = owner;
			while (cursor) {
				if (cursor === transaction) throw new Error('deadlock detected');
				cursor = waiting.get(cursor);
			}
			await new Promise<void>(done => wakeups.set(key, [...wakeups.get(key) ?? [], done]));
			waiting.delete(transaction);
			return lock(transaction, key);
		}
		owners.set(key, transaction);
	}

	function release(transaction: string) {
		waiting.delete(transaction);
		for (const [key, owner] of owners) if (owner === transaction) {
			owners.delete(key);
			for (const done of wakeups.get(key) ?? []) done();
			wakeups.delete(key);
		}
	}

	return { lock, release, steps };
}

function fixture() {
	const { lock, release, steps } = transactionLocks();
	const renameReady = deferred(), plannerReady = deferred();

	function manager(transaction: string) {
		const qb = { where: () => qb, andWhere: () => qb, orderBy: () => qb, setLock: () => qb, getMany: async () => [] };
		return {
			getRepository: () => ({
				createQueryBuilder: () => qb,
				insert: async (row: { key: string }) => {
					if (row.key === 'todos') {
						await lock(transaction, 'record-moderation:hatask:owner');
						plannerReady.resolve();
					}
				},
			}),
			query: async (sql: string, params: unknown[] = []) => {
				if (sql.startsWith('SELECT pg_advisory')) {
					if (transaction === 'planner' && params[0] === 'hatask-flower:owner') plannerReady.resolve();
					await lock(transaction, String(params[0]));
					return [];
				}
				if (sql.startsWith('SELECT * FROM hatask_drop_wallet')) return [{ userId: 'owner', drops: 0, timezone: 'UTC', flower: null, seeds: [], rareSeeds: [] }];
				if (sql.startsWith('SELECT entry FROM hatask_flower_harvest')) return [{ entry: { name: 'Original' } }];
				if (sql.startsWith('UPDATE hatask_flower SET')) {
					renameReady.resolve();
					await plannerReady.promise;
					await lock(transaction, 'record-moderation:hatask:owner');
				}
				return [];
			},
		};
	}

	function db(transaction: string) {
		return { transaction: async (callback: (m: ReturnType<typeof manager>) => Promise<unknown>) => {
			try { return await callback(manager(transaction)); } finally { release(transaction); }
		} };
	}

	const flower = new HataskFlowerV2Service(db('rename') as never, { gen: () => 'id' } as never, {} as never);
	// Packing state is outside the locking path under test.
	vi.spyOn(flower as never as { state: () => Promise<unknown> }, 'state').mockResolvedValue({});
	const registry = new RegistryApiService(flower, { manager: db('planner') } as never, { gen: () => 'id' } as never, {} as never);
	const commit = new CommitEndpoint(db('planner') as never, { gen: () => 'id' } as never, flower);
	const batch = new BatchCommitEndpoint(db('planner') as never, { gen: () => 'id' } as never, flower);
	const value = [{ id: 'todo', text: 'Write test', done: false }];
	const save = (writer: string) => {
		if (writer === 'registry') return registry.set('owner', null, ['client', 'hatask'], 'todos', value);
		if (writer === 'commit') return commit.exec({ collection: 'todos', expectedRevision: null, value }, { id: 'owner' } as never, null, null);
		return batch.exec({ changes: [{ collection: 'todos', expectedRevision: null, value }] }, { id: 'owner' } as never, null, null);
	};
	return { steps, renameReady, rename: () => flower.rename('owner', 'flower', 'Renamed'), save };
}

describe('Hatask wallet and moderation lock ordering', () => {
	test('the modeled owner lock matches the installed database trigger', () => {
		const migration = readFileSync(resolve(import.meta.dirname, '../../migration/1790035300000-record-moderation.js'), 'utf8');
		expect(migration).toContain('pg_advisory_xact_lock(hashtextextended(\'record-moderation:hatask:\' || owner_id,0))');
		expect(migration).toContain('[\'registry_item\', \'hatask_event\', \'hatask_flower\']');
	});

	test.each(['registry', 'commit', 'batch'])('%s todo save and flower rename both finish when overlapped', async writer => {
		const f = fixture();
		const rename = f.rename();
		await f.renameReady.promise;
		const results = await Promise.allSettled([rename, f.save(writer)]);
		expect(results.map(result => result.status), JSON.stringify(results, (_key, value) => value instanceof Error ? value.message : value)).toEqual(['fulfilled', 'fulfilled']);
		expect(f.steps.indexOf('planner:hatask-flower:owner')).toBeLessThan(f.steps.indexOf('planner:record-moderation:hatask:owner'));
	});
});

test('migration shadow and batch saves acquire their collection locks in the same order', async () => {
	const locks = transactionLocks(), batchReady = deferred(), shadowReady = deferred();

	function database(transaction: string) {
		const qb = { where: () => qb, andWhere: () => qb, orderBy: () => qb, setLock: () => qb, getMany: async () => [] };
		const manager = {
			getRepository: () => ({ createQueryBuilder: () => qb, insert: async () => {} }),
			query: async (_sql: string, params: string[]) => {
				const key = params[0];
				if (transaction === 'shadow' && key === 'hatask-planner:owner:events') shadowReady.resolve();
				await locks.lock(transaction, key);
				if (transaction === 'batch' && key === 'hatask-planner:owner:events') {
					batchReady.resolve();
					await shadowReady.promise;
				}
				return [];
			},
		};
		return { transaction: async (callback: (m: typeof manager) => Promise<unknown>) => {
			try { return await callback(manager); } finally { locks.release(transaction); }
		} };
	}

	const flower = { onTodosCommitted: async () => ({}) } as never;
	const batch = new BatchCommitEndpoint(database('batch') as never, { gen: () => 'id' } as never, flower);
	const registry = new RegistryApiService(flower, { manager: database('shadow') } as never, { gen: () => 'id' } as never, {} as never);
	const commit = batch.exec({ changes: ['events', 'todos'].map(collection => ({ collection, expectedRevision: null, value: [] })) } as never, { id: 'owner' } as never, null, null);
	await batchReady.promise;
	const shadow = registry.createHataskPlannerMigrationShadow('owner', { todos: null, folders: null, events: null }, {
		schemaVersion: 2,
		collections: {
			todos: { count: 0, normalizedHash: 'fnv1a64:0000000000000001' },
			folders: { count: 0, normalizedHash: 'fnv1a64:0000000000000002' },
			events: { count: 0, normalizedHash: 'fnv1a64:0000000000000003' },
		},
		fullNormalizedHash: 'fnv1a64:0000000000000004',
	});
	const results = await Promise.allSettled([commit, shadow]);
	expect(results.map(result => result.status), JSON.stringify(results, (_key, value) => value instanceof Error ? value.message : value)).toEqual(['fulfilled', 'fulfilled']);
});
