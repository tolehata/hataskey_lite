/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DataSource, EntitySchema, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { AvatarDecorationService, HataskAvatarDecorationUpdateError } from '@/core/AvatarDecorationService.js';
import { avatarDecorationUnavailableReason, parseAvatarDecorationDate } from '@/core/avatar-decoration-availability.js';
import { hasCompletedHataskFlowerCollection } from '@/core/hatask-flower-completion.js';
import UpdateDecorationEndpoint, { meta as updateMeta } from '@/server/api/endpoints/admin/hatask/update-decoration.js';
import GetDecorationsEndpoint from '@/server/api/endpoints/get-avatar-decorations.js';
import { MiAvatarDecoration, MiUser } from '@/models/_.js';
import type { EntityManager } from 'typeorm';

vi.mock('@/core/hatask-flower-completion.js', () => {
	const completed = vi.fn();
	return { hasCompletedHataskFlowerCollection: completed, recordHataskFlowerCollectionCompletion: completed };
});

const now = Date.parse('2026-10-12T03:00:00.000Z');

function decoration(values: Partial<MiAvatarDecoration> = {}): MiAvatarDecoration {
	return {
		id: 'decoration1', name: 'お花の種', url: 'https://example.test/flower.webp', description: '',
		roleIdsThatCanBeUsedThisDecoration: [], requiresHataskFlowerCompletion: false, availableFrom: null, availableUntil: null,
		updatedAt: null, host: null, remoteId: null, rawUrl: null, ...values,
	};
}

const setting = (id: string): MiUser['avatarDecorations'][number] => ({ id, angle: 0, flipH: false, offsetX: 0, offsetY: 0, scale: 1, opacity: 1 });

beforeEach(() => {
	vi.spyOn(Date, 'now').mockReturnValue(now);
	vi.mocked(hasCompletedHataskFlowerCollection).mockReset().mockResolvedValue(false);
});
afterEach(() => { vi.restoreAllMocks(); });

function fixture(initial = [decoration()]) {
	let data = initial;
	const redis = { on: vi.fn(), off: vi.fn() };
	const decorations = {
		find: vi.fn(async () => data),
		findOneByOrFail: vi.fn(async ({ id }: { id: string }) => {
			const row = data.find(value => value.id === id);
			if (row == null) throw new Error(`Missing fixture decoration: ${id}`);
			return row;
		}),
		update: vi.fn(async (id: string, values: Partial<MiAvatarDecoration>) => { data = data.map(row => row.id === id ? { ...row, ...values } : row); }),
	};
	const roleService = { getUserRoles: vi.fn().mockResolvedValue([]), getRoles: vi.fn().mockResolvedValue([]) };
	const userEntityService = { pack: vi.fn().mockResolvedValue({ id: 'alice', avatarDecorations: [] }) };
	const events = { publishInternalEvent: vi.fn(), publishMainStream: vi.fn() };
	const users = { manager: { query: vi.fn(), transaction: vi.fn() }, createQueryBuilder: vi.fn() };
	const moduleRef = { get: vi.fn((name: string) => name === 'RoleService' ? roleService : userEntityService) };
	const service = new AvatarDecorationService({} as never, redis as never, decorations as never, {} as never,
		users as never, { gen: () => 'newid' } as never, { log: vi.fn() } as never, events as never, {} as never, moduleRef as never);
	return { service, redis, decorations, roleService, userEntityService, events, users };
}

/** Model a stale candidate scan followed by fresh locked rows and an atomic commit. */
function cleanupFixture(snapshot: MiAvatarDecoration[], latest = snapshot) {
	const f = fixture(snapshot);
	const trace: string[] = [];
	const state = {
		current: [...snapshot.map(row => setting(row.id)), setting('ordinary')],
		latest,
		afterScan: null as (() => void) | null,
		failCommit: false,
	};
	const parameters: Record<string, unknown> = {};
	let updates: { avatarDecorations: () => string } | undefined;
	let lockedIds: string[] = [];
	const candidates = {
		select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
		getMany: vi.fn(async () => {
			const avatarDecorations = structuredClone(state.current);
			state.afterScan?.();
			return [{ id: 'alice', avatarDecorations }];
		}),
	};
	const fresh = {
		where: vi.fn((_condition: string, values: { ids: string[] }) => { lockedIds = values.ids; return fresh; }),
		orderBy: vi.fn().mockReturnThis(), setLock: vi.fn().mockReturnThis(),
		getMany: vi.fn(async () => {
			trace.push('read-locked');
			return state.latest.filter(row => row.host == null && lockedIds.includes(row.id)).sort((a, b) => a.id.localeCompare(b.id));
		}),
	};
	const update = {
		update: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
		set: vi.fn((values: typeof updates) => { updates = values; return update; }),
		setParameter: vi.fn((key: string, value: unknown) => { parameters[key] = value; return update; }),
		execute: vi.fn(async () => {
			trace.push('update');
			const before = state.current.length;
			state.current = state.current.filter(row => !(parameters.unavailableIds as string[]).includes(row.id));
			return { affected: Number(state.current.length !== before) };
		}),
	};
	const transaction = {
		getRepository: vi.fn(() => ({ createQueryBuilder: vi.fn(() => fresh) })),
		createQueryBuilder: vi.fn(() => update),
		query: vi.fn(),
	};
	// Keep the old direct-update path executable for the stale-policy positive control.
	f.users.createQueryBuilder.mockImplementation((alias?: string) => alias === 'owner' ? candidates : update);
	f.users.manager.transaction.mockImplementation(async (callback: (manager: EntityManager) => Promise<unknown>) => {
		const before = structuredClone(state.current);
		trace.push('begin');
		try {
			const result = await callback(transaction as unknown as EntityManager);
			if (state.failCommit) throw new Error('cleanup commit failed');
			trace.push('commit');
			return result;
		} catch (error) {
			state.current = before;
			trace.push('rollback');
			throw error;
		}
	});
	f.events.publishInternalEvent.mockImplementation(() => { trace.push('internal'); });
	f.userEntityService.pack.mockImplementation(async () => { trace.push('pack'); return { id: 'alice', avatarDecorations: [] }; });
	f.events.publishMainStream.mockImplementation(() => { trace.push('main'); });
	return { ...f, trace, state, parameters, fresh, update, transaction, getUpdates: () => updates };
}

describe('avatar decoration eligibility', () => {
	test('ordinary decorations remain available without an achievement and unknown IDs cannot be selected', async () => {
		const f = fixture();
		const result = await f.service.getAvailability('alice', [decoration()]);
		expect(result.get('decoration1')).toBeNull();
		expect(result.get('unknown')).toBeUndefined();
		expect(hasCompletedHataskFlowerCollection).not.toHaveBeenCalled();
	});

	test('previous achievers qualify immediately and client state cannot substitute for the server record', async () => {
		const f = fixture();
		const locked = decoration({ requiresHataskFlowerCompletion: true });
		expect((await f.service.getAvailability('alice', [locked])).get(locked.id)).toBe('achievement');
		vi.mocked(hasCompletedHataskFlowerCollection).mockResolvedValue(true);
		expect((await f.service.getAvailability('alice', [locked])).get(locked.id)).toBeNull();
		expect(hasCompletedHataskFlowerCollection).toHaveBeenLastCalledWith(f.users.manager, 'alice');
		expect((await f.service.getAvailability(null, [locked])).get(locked.id)).toBe('achievement');
	});

	test('achievement and existing role restrictions are both required; removed roles remain ignored', async () => {
		const f = fixture();
		f.roleService.getRoles.mockResolvedValue([{ id: 'members' }] as never);
		vi.mocked(hasCompletedHataskFlowerCollection).mockResolvedValue(true);
		const locked = decoration({ requiresHataskFlowerCompletion: true, roleIdsThatCanBeUsedThisDecoration: ['members'] });
		expect((await f.service.getAvailability('alice', [locked])).get(locked.id)).toBe('role');
		f.roleService.getUserRoles.mockResolvedValue([{ id: 'members' }] as never);
		expect((await f.service.getAvailability('alice', [locked])).get(locked.id)).toBeNull();
		f.roleService.getUserRoles.mockResolvedValue([]);
		f.roleService.getRoles.mockResolvedValue([]);
		expect((await f.service.getAvailability('alice', [locked])).get(locked.id)).toBeNull();
	});

	test('the exact start is allowed and the exact end is denied, regardless of achievement', () => {
		const period = decoration({ availableFrom: new Date(now), availableUntil: new Date(now + 1000) });
		const status = (time: number) => avatarDecorationUnavailableReason(period, { now: time, hasCompletedHataskFlower: true });
		expect(status(now - 1)).toBe('notStarted');
		expect(status(now)).toBeNull();
		expect(status(now + 999)).toBeNull();
		expect(status(now + 1000)).toBe('expired');
	});

	test('the public catalog keeps locked decorations visible with reasons', async () => {
		const locked = decoration({ requiresHataskFlowerCompletion: true });
		const f = fixture([locked]);
		const endpoint = new GetDecorationsEndpoint(f.service, f.roleService as never);
		const result = await endpoint.exec({}, { id: 'alice' } as never, null, null);
		expect(result).toMatchObject([{ id: locked.id, requiresHataskFlowerCompletion: true, canUse: false, unavailableReason: 'achievement' }]);
	});
});

describe('equipped decoration expiry', () => {
	test('packing hides expired, future and unearned decorations before a cleanup tick', async () => {
		const f = fixture([
			decoration({ id: 'ordinary' }),
			decoration({ id: 'future', availableFrom: new Date(now + 1) }),
			decoration({ id: 'expired', availableUntil: new Date(now) }),
			decoration({ id: 'unearned', requiresHataskFlowerCompletion: true }),
			decoration({ id: 'active', availableUntil: new Date(now + 1000) }),
		]);
		const packed = await f.service.packUserDecorations({ id: 'alice', host: null, avatarDecorations: ['ordinary', 'future', 'expired', 'unearned', 'active', 'missing'].map(setting) });
		expect(packed.map(d => d.id)).toEqual(['ordinary', 'active']);
		expect(packed[1].availableUntil).toBe(new Date(now + 1000).toISOString());
	});

	test('remote decorations do not inherit local Hatask completion requirements', async () => {
		const f = fixture([decoration({ host: 'remote.test', requiresHataskFlowerCompletion: true })]);
		const packed = await f.service.packUserDecorations({ id: 'remoteuser', host: 'remote.test', avatarDecorations: [setting('decoration1')] });
		expect(packed).toHaveLength(1);
		expect(hasCompletedHataskFlowerCollection).not.toHaveBeenCalled();
	});

	test('the minute worker does not scan all achievers when their decorations have no inactive period', async () => {
		const f = fixture([decoration({ requiresHataskFlowerCompletion: true })]);
		await f.service.removeUnavailableDecorations();
		expect(f.users.createQueryBuilder).not.toHaveBeenCalled();
		expect(hasCompletedHataskFlowerCollection).not.toHaveBeenCalled();
	});

	test('cleanup filters the database array atomically and broadcasts the changed local profile', async () => {
		const f = cleanupFixture([decoration({ availableUntil: new Date(now) })]);
		f.state.afterScan = () => { f.state.current.push(setting('concurrentAddition')); };
		await f.service.removeUnavailableDecorations();
		expect(f.parameters.unavailableIds).toEqual(['decoration1']);
		const updates = f.getUpdates();
		if (updates == null) throw new Error('Cleanup did not issue a database update');
		expect(updates.avatarDecorations()).toContain('jsonb_array_elements("avatarDecorations") WITH ORDINALITY');
		expect(f.state.current.map(d => d.id)).toEqual(['ordinary', 'concurrentAddition']);
		expect(f.transaction.getRepository).toHaveBeenCalledWith(MiAvatarDecoration);
		expect(f.fresh.orderBy).toHaveBeenCalledWith('decoration.id', 'ASC');
		expect(f.fresh.setLock).toHaveBeenCalledWith('pessimistic_read');
		expect(f.update.update).toHaveBeenCalledWith(MiUser);
		expect(f.trace).toEqual(['begin', 'read-locked', 'update', 'commit', 'internal', 'pack', 'main']);
		expect(f.events.publishInternalEvent).toHaveBeenCalledWith('localUserUpdated', { id: 'alice' });
		expect(f.events.publishMainStream).toHaveBeenCalledWith('alice', 'meUpdated', { id: 'alice', avatarDecorations: [] });
	});

	test.each([
		['deadline extension', { availableUntil: new Date(now) }, { availableUntil: new Date(now + 60_000) }, undefined],
		['period removal', { availableUntil: new Date(now) }, { availableUntil: null }, undefined],
		['reward release', { requiresHataskFlowerCompletion: true }, { requiresHataskFlowerCompletion: false }, 'decoration1'],
	] as const)('keeps equipment when %s commits after the candidate snapshot', async (_reason, before, after, decorationId) => {
		const f = cleanupFixture([decoration(before)], [decoration(after)]);
		await f.service.removeUnavailableDecorations(decorationId);
		expect(f.state.current.map(row => row.id)).toEqual(['decoration1', 'ordinary']);
		expect(f.fresh.getMany).toHaveBeenCalledOnce();
		expect(f.fresh.setLock).toHaveBeenCalledWith('pessimistic_read');
		expect(f.update.execute).not.toHaveBeenCalled();
		expect(f.events.publishInternalEvent).not.toHaveBeenCalled();
		expect(f.events.publishMainStream).not.toHaveBeenCalled();
	});

	test('a confirmed unearned reward is removed using the same transaction for achievement reads', async () => {
		const f = cleanupFixture([decoration({ requiresHataskFlowerCompletion: true })]);
		await f.service.removeUnavailableDecorations('decoration1');
		expect(hasCompletedHataskFlowerCollection).toHaveBeenCalledWith(f.transaction, 'alice');
		expect(f.state.current.map(row => row.id)).toEqual(['ordinary']);
		expect(f.trace).toEqual(['begin', 'read-locked', 'update', 'commit', 'internal', 'pack', 'main']);
	});

	test('a completed reward remains equipped when fresh achievement state allows it', async () => {
		const f = cleanupFixture([decoration({ requiresHataskFlowerCompletion: true })]);
		vi.mocked(hasCompletedHataskFlowerCollection).mockResolvedValue(true);
		await f.service.removeUnavailableDecorations('decoration1');
		expect(hasCompletedHataskFlowerCollection).toHaveBeenCalledWith(f.transaction, 'alice');
		expect(f.state.current.map(row => row.id)).toEqual(['decoration1', 'ordinary']);
		expect(f.update.execute).not.toHaveBeenCalled();
		expect(f.events.publishMainStream).not.toHaveBeenCalled();
	});

	test('a failed commit restores equipment and publishes no uncommitted profile', async () => {
		const f = cleanupFixture([decoration({ availableUntil: new Date(now) })]);
		f.state.failCommit = true;
		await expect(f.service.removeUnavailableDecorations()).rejects.toThrow('cleanup commit failed');
		expect(f.state.current.map(row => row.id)).toEqual(['decoration1', 'ordinary']);
		expect(f.trace).toEqual(['begin', 'read-locked', 'update', 'rollback']);
		expect(f.events.publishInternalEvent).not.toHaveBeenCalled();
		expect(f.userEntityService.pack).not.toHaveBeenCalled();
		expect(f.events.publishMainStream).not.toHaveBeenCalled();
	});

	test('a concurrent unequip produces no redundant profile broadcast', async () => {
		const f = cleanupFixture([decoration({ availableUntil: new Date(now) })]);
		f.state.afterScan = () => { f.state.current = [setting('ordinary')]; };
		await f.service.removeUnavailableDecorations();
		expect(f.state.current.map(row => row.id)).toEqual(['ordinary']);
		expect(f.trace).toEqual(['begin', 'read-locked', 'update', 'commit']);
		expect(f.events.publishInternalEvent).not.toHaveBeenCalled();
		expect(f.events.publishMainStream).not.toHaveBeenCalled();
	});

	test('TypeORM produces quoted owner aliases and bound parameters for atomic cleanup without connecting to a database', async () => {
		const userSchema = new EntitySchema({ name: 'DecorationCleanupUser', target: MiUser, tableName: 'user', columns: {
			id: { type: 'varchar', primary: true }, host: { type: 'varchar', nullable: true }, avatarDecorations: { type: 'jsonb' },
		} });
		const db = new DataSource({ type: 'postgres', entities: [userSchema, MiAvatarDecoration] });
		await (db as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
		const repository = db.getRepository(MiUser);
		const generated: [string, unknown[]][] = [];
		const f = fixture([decoration({ availableUntil: new Date(now) })]);
		f.users.createQueryBuilder.mockImplementation((alias?: string) => repository.createQueryBuilder(alias));
		f.users.manager.transaction.mockImplementation(async (callback: (manager: EntityManager) => Promise<unknown>) => callback(db.manager));
		vi.spyOn(SelectQueryBuilder.prototype, 'getMany').mockImplementation(async function () {
			generated.push(this.getQueryAndParameters());
			return this.expressionMap.mainAlias?.target === MiAvatarDecoration
				? [decoration({ availableUntil: new Date(now) })]
				: [{ id: 'alice', host: null, avatarDecorations: [setting('decoration1')] }];
		});
		vi.spyOn(UpdateQueryBuilder.prototype, 'execute').mockImplementation(async function () {
			generated.push(this.getQueryAndParameters());
			return { affected: 1, raw: [], generatedMaps: [] };
		});
		await f.service.removeUnavailableDecorations();
		expect(generated).toHaveLength(3);
		expect(generated[0][0]).toContain('jsonb_array_elements("owner"."avatarDecorations")');
		expect(generated[0][0]).toContain('ANY($2)');
		expect(generated[0][1]).toEqual(['', ['decoration1']]);
		expect(generated[1][0]).toContain('"decoration"."id" IN ($1)');
		expect(generated[1][0]).toContain('ORDER BY "decoration"."id" ASC FOR SHARE');
		expect(generated[1][1]).toEqual(['decoration1']);
		expect(generated[2][0]).toContain('UPDATE "user" SET "avatarDecorations" = COALESCE');
		expect(generated[2][0]).toContain('jsonb_agg(decoration ORDER BY position)');
		expect(generated[2][1]).toEqual([['decoration1'], 'alice']);
		expect(db.isInitialized).toBe(false);
	});

	test('configuration writes and cross-process events invalidate both catalogs', async () => {
		const f = fixture();
		f.service.cache.set([decoration()]);
		f.service.cacheWithRemote.set([decoration()]);
		await f.service.update('decoration1', { availableUntil: new Date(now) });
		expect(f.service.cache.get()).toBeUndefined();
		expect(f.service.cacheWithRemote.get()).toBeUndefined();
		f.service.cache.set([decoration()]);
		f.service.cacheWithRemote.set([decoration()]);
		await f.redis.on.mock.calls[0][1]('', JSON.stringify({ channel: 'internal', message: { type: 'avatarDecorationUpdated', body: {} } }));
		expect(f.service.cache.get()).toBeUndefined();
		expect(f.service.cacheWithRemote.get()).toBeUndefined();
	});
});

describe('Hatask decoration management endpoint', () => {
	test('requires administrator credentials, secure first-party access and the decoration write scope', () => {
		expect(updateMeta).toMatchObject({ requireCredential: true, requireAdmin: true, secure: true, kind: 'write:admin:avatar-decorations' });
		expect(updateMeta.limit.max).toBeGreaterThan(0);
	});

	test.each(['2026-02-30T12:00:00Z', '2026-10-12', '2026-10-12T12:00:00', '2026-10-12T24:00:00Z', '2026-10-12T12:00:00+24:00', 'invalid'])('rejects malformed or nonexistent dates: %s', value => {
		expect(parseAvatarDecorationDate(value)).toBeNull();
	});

	test('allows leap days and normalizes an explicit timezone', () => {
		expect(parseAvatarDecorationDate('2028-02-29T12:00:00+09:00')?.toISOString()).toBe('2028-02-29T03:00:00.000Z');
	});

	test('rejects invalid intervals, foreign fields and remote decorations before any write', async () => {
		const service = { configureHataskDecoration: vi.fn(), removeUnavailableDecorations: vi.fn() };
		const endpoint = new UpdateDecorationEndpoint(service as never);
		const input = { id: 'decoration1', requiresHataskFlowerCompletion: true, availableFrom: '2026-10-12T03:00:00Z', availableUntil: '2026-10-12T03:00:00Z' };
		await expect(endpoint.exec(input, { id: 'admin' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_AVATAR_DECORATION_PERIOD' });
		await expect(endpoint.exec({ ...input, availableFrom: '2026-02-30T03:00:00Z' }, { id: 'admin' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_AVATAR_DECORATION_PERIOD' });
		await expect(endpoint.exec({ ...input, userId: 'victim' }, { id: 'admin' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(service.configureHataskDecoration).not.toHaveBeenCalled();
		service.configureHataskDecoration.mockRejectedValue(new HataskAvatarDecorationUpdateError('notFound'));
		await expect(endpoint.exec({ ...input, availableFrom: null, availableUntil: null }, { id: 'admin' } as never, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_AVATAR_DECORATION' });
		expect(service.removeUnavailableDecorations).not.toHaveBeenCalled();
	});

	test('stores a valid period and removes existing disallowed equipment', async () => {
		const service = { configureHataskDecoration: vi.fn(), removeUnavailableDecorations: vi.fn() };
		const endpoint = new UpdateDecorationEndpoint(service as never);
		const admin = { id: 'admin' };
		await endpoint.exec({ id: 'decoration1', requiresHataskFlowerCompletion: true, availableFrom: null, availableUntil: '2026-11-01T00:00:00+09:00' }, admin as never, null, null);
		expect(service.configureHataskDecoration).toHaveBeenCalledWith('decoration1', { requiresHataskFlowerCompletion: true, availableFrom: null, availableUntil: new Date('2026-10-31T15:00:00Z') }, admin, undefined);
		expect(service.removeUnavailableDecorations).toHaveBeenCalledWith('decoration1');
	});

	test('forwards an optional replacement ID and maps invalid or conflicting replacements distinctly', async () => {
		const service = { configureHataskDecoration: vi.fn(), removeUnavailableDecorations: vi.fn() };
		const endpoint = new UpdateDecorationEndpoint(service as never);
		const admin = { id: 'admin' };
		const input = { id: 'newdecoration', replaceFromId: 'olddecoration', requiresHataskFlowerCompletion: true, availableFrom: null, availableUntil: null };
		await endpoint.exec(input, admin as never, null, null);
		expect(service.configureHataskDecoration).toHaveBeenCalledWith('newdecoration', { requiresHataskFlowerCompletion: true, availableFrom: null, availableUntil: null }, admin, 'olddecoration');
		service.configureHataskDecoration.mockRejectedValueOnce(new HataskAvatarDecorationUpdateError('invalidReplacement'));
		await expect(endpoint.exec(input, admin as never, null, null)).rejects.toMatchObject({ code: 'INVALID_AVATAR_DECORATION_REPLACEMENT' });
		service.configureHataskDecoration.mockRejectedValueOnce(new HataskAvatarDecorationUpdateError('replacementConflict'));
		await expect(endpoint.exec(input, admin as never, null, null)).rejects.toMatchObject({ code: 'AVATAR_DECORATION_REPLACEMENT_CONFLICT', httpStatusCode: 409 });
	});
});
