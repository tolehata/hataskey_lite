/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { AvatarDecorationService } from '@/core/AvatarDecorationService.js';
import type { MiAvatarDecoration, MiUser } from '@/models/_.js';

const moderator = { id: 'admin' } as MiUser;
const oldEnd = new Date('2027-01-01T00:00:00Z');
const newEnd = new Date('2027-02-01T00:00:00Z');
const rewardSettings = { requiresHataskFlowerCompletion: true, availableFrom: null, availableUntil: newEnd };

function decoration(id: string, requiresHataskFlowerCompletion = false): MiAvatarDecoration {
	return {
		id, name: id, description: `${id} description`, url: `https://example.test/${id}.webp`,
		roleIdsThatCanBeUsedThisDecoration: [`${id}Role`], requiresHataskFlowerCompletion,
		availableFrom: null, availableUntil: oldEnd, updatedAt: null,
		host: null, remoteId: null, rawUrl: null,
	};
}

/** Transaction fixture models rollback/serialization; it never connects to PostgreSQL. */
function fixture() {
	const rows = new Map(['old', 'new', 'other'].map(id => [id, decoration(id, id === 'old')]));
	const locks: { ids?: string[]; condition?: string; order?: [string, string]; lock?: string }[] = [];
	const writes: { id: string; values: Partial<MiAvatarDecoration> }[] = [];
	const trace: string[] = [];
	let failId: string | undefined;
	let serial = Promise.resolve();
	type Repository = {
		createQueryBuilder: (alias: string) => unknown;
		update: (id: string, values: Partial<MiAvatarDecoration>) => Promise<void>;
	};
	const transaction = vi.fn(async (callback: (manager: { getRepository: () => Repository }) => Promise<unknown>) => {
		const previous = serial;
		let release: () => void = () => {};
		serial = new Promise<void>(resolve => { release = resolve; });
		await previous;
		const working = new Map(structuredClone([...rows]));
		const repository = {
			createQueryBuilder: () => {
				const lock: typeof locks[number] = {};
				locks.push(lock);
				const builder = {
					where: vi.fn((_condition: string, params: { ids: string[] }) => { lock.ids = params.ids; return builder; }),
					andWhere: vi.fn((condition: string) => { lock.condition = condition; return builder; }),
					orderBy: vi.fn((field: string, direction: string) => { lock.order = [field, direction]; return builder; }),
					setLock: vi.fn((mode: string) => { lock.lock = mode; return builder; }),
					getMany: vi.fn(async () => [...working.values()].filter(row => lock.ids?.includes(row.id) && row.host == null).sort((a, b) => a.id.localeCompare(b.id))),
				};
				return builder;
			},
			update: vi.fn(async (id: string, values: Partial<MiAvatarDecoration>) => {
				writes.push({ id, values });
				if (id === failId) throw new Error('simulated write failure');
				const before = working.get(id);
				if (before == null) throw new Error('missing fixture row');
				working.set(id, { ...before, ...values });
			}),
		};
		try {
			const result = await callback({ getRepository: () => repository });
			rows.clear();
			for (const [id, row] of working) rows.set(id, row);
			trace.push('commit');
			return result;
		} finally {
			release();
		}
	});
	const events = { publishInternalEvent: vi.fn(() => { trace.push('publish'); }) };
	const log = vi.fn(() => { trace.push('log'); });
	const service = new AvatarDecorationService({} as never, { on: vi.fn(), off: vi.fn() } as never,
		{ manager: { transaction } } as never, {} as never, {} as never,
		{} as never, { log } as never, events as never, {} as never, {} as never);
	return { service, rows, locks, writes, trace, transaction, events, log, failAt: (id: string) => { failId = id; } };
}

describe('atomic Hatask reward decoration changes', () => {
	test('replaces a reward in one transaction while retaining both images, roles, and the old period', async () => {
		const f = fixture();
		const beforeOld = structuredClone(f.rows.get('old'));
		const beforeNew = structuredClone(f.rows.get('new'));
		f.service.cache.set([]);
		f.service.cacheWithRemote.set([]);
		await f.service.configureHataskDecoration('new', rewardSettings, moderator, 'old');
		expect(f.transaction).toHaveBeenCalledTimes(1);
		expect(f.locks).toEqual([{ ids: ['new', 'old'], condition: 'decoration.host IS NULL', order: ['decoration.id', 'ASC'], lock: 'pessimistic_write' }]);
		expect(f.rows.get('old')).toEqual({ ...beforeOld, updatedAt: expect.any(Date), requiresHataskFlowerCompletion: false });
		expect(f.rows.get('new')).toEqual({ ...beforeNew, updatedAt: expect.any(Date), ...rewardSettings });
		expect(f.writes.map(write => Object.keys(write.values).sort())).toEqual([
			['requiresHataskFlowerCompletion', 'updatedAt'],
			['availableFrom', 'availableUntil', 'requiresHataskFlowerCompletion', 'updatedAt'],
		]);
		expect(f.service.cache.get()).toBeUndefined();
		expect(f.service.cacheWithRemote.get()).toBeUndefined();
		expect(f.trace).toEqual(['commit', 'publish', 'log', 'publish', 'log']);
		expect(f.events.publishInternalEvent).toHaveBeenCalledWith('avatarDecorationUpdated', f.rows.get('old'));
		expect(f.events.publishInternalEvent).toHaveBeenCalledWith('avatarDecorationUpdated', f.rows.get('new'));
	});

	test('a failed target write rolls back release of the old reward and emits no committed update', async () => {
		const f = fixture();
		const before = structuredClone([...f.rows]);
		f.service.cache.set([]);
		f.service.cacheWithRemote.set([]);
		f.failAt('new');
		await expect(f.service.configureHataskDecoration('new', rewardSettings, moderator, 'old')).rejects.toThrow('simulated write failure');
		expect([...f.rows]).toEqual(before);
		expect(f.writes.map(write => write.id)).toEqual(['old', 'new']);
		expect(f.events.publishInternalEvent).not.toHaveBeenCalled();
		expect(f.log).not.toHaveBeenCalled();
		expect(f.service.cache.get()).toEqual([]);
		expect(f.service.cacheWithRemote.get()).toEqual([]);
	});

	test.each([
		['same ID', 'old', 'old', rewardSettings],
		['non-reward target settings', 'new', 'old', { ...rewardSettings, requiresHataskFlowerCompletion: false }],
	] as const)('rejects invalid replacement before a transaction: %s', async (_label, id, source, settings) => {
		const f = fixture();
		await expect(f.service.configureHataskDecoration(id, settings, moderator, source)).rejects.toMatchObject({ reason: 'invalidReplacement' });
		expect(f.transaction).not.toHaveBeenCalled();
	});

	test.each(['missingSource', 'missingTarget', 'remoteSource', 'remoteTarget'])('rejects absent or foreign records without writes: %s', async scenario => {
		const f = fixture();
		if (scenario === 'missingSource') f.rows.delete('old');
		if (scenario === 'missingTarget') f.rows.delete('new');
		if (scenario === 'remoteSource') f.rows.set('old', { ...decoration('old', true), host: 'remote.test' });
		if (scenario === 'remoteTarget') f.rows.set('new', { ...decoration('new'), host: 'remote.test' });
		await expect(f.service.configureHataskDecoration('new', rewardSettings, moderator, 'old')).rejects.toMatchObject({ reason: 'notFound' });
		expect(f.writes).toEqual([]);
	});

	test.each(['sourceReleased', 'targetAlreadyReward'])('detects stale replacement state while holding the row locks: %s', async scenario => {
		const f = fixture();
		if (scenario === 'sourceReleased') f.rows.set('old', decoration('old', false));
		if (scenario === 'targetAlreadyReward') f.rows.set('new', decoration('new', true));
		await expect(f.service.configureHataskDecoration('new', rewardSettings, moderator, 'old')).rejects.toMatchObject({ reason: 'replacementConflict' });
		expect(f.writes).toEqual([]);
	});

	test('simultaneous replacements of the same old reward produce one winner and one conflict', async () => {
		const f = fixture();
		const results = await Promise.allSettled([
			f.service.configureHataskDecoration('new', rewardSettings, moderator, 'old'),
			f.service.configureHataskDecoration('other', rewardSettings, moderator, 'old'),
		]);
		expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
		expect(results[1]).toMatchObject({ reason: { reason: 'replacementConflict' } });
		expect(f.rows.get('old')?.requiresHataskFlowerCompletion).toBe(false);
		expect(f.rows.get('new')?.requiresHataskFlowerCompletion).toBe(true);
		expect(f.rows.get('other')?.requiresHataskFlowerCompletion).toBe(false);
	});

	test('ordinary release uses the same transaction and does not delete the decoration or change its role and period', async () => {
		const f = fixture();
		const before = structuredClone(f.rows.get('old'));
		await f.service.configureHataskDecoration('old', { requiresHataskFlowerCompletion: false, availableFrom: null, availableUntil: oldEnd }, moderator);
		expect(f.locks).toEqual([{ ids: ['old'], condition: 'decoration.host IS NULL', order: ['decoration.id', 'ASC'], lock: 'pessimistic_write' }]);
		expect(f.rows.size).toBe(3);
		expect(f.rows.get('old')).toEqual({ ...before, updatedAt: expect.any(Date), requiresHataskFlowerCompletion: false });
	});
});
