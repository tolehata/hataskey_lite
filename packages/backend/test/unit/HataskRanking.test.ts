/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { HataskRankingService } from '@/core/HataskRankingService.js';
import { hataskRankingWindow, parseHataskRankingSnapshot, rankHataskScores } from '@/core/hatask-ranking.js';
import type { HataskRankingScore } from '@/core/hatask-ranking.js';
import ListEndpoint, { meta as listMeta } from '@/server/api/endpoints/hatask/ranking/list.js';
import ParticipationEndpoint, { meta as participationMeta } from '@/server/api/endpoints/hatask/ranking/participation.js';

const me = { id: 'owner' } as never;
const score = (userId: string, value: number, metric: HataskRankingScore['metric'] = 'flower'): HataskRankingScore => ({ userId, value, metric });
const participant = (id: string, flower = true) => ({ id, flower, utage: true, block: true, login: true });

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function fixture(scores: HataskRankingScore[] = [score('owner', 3), score('other', 6)]) {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-09T12:15:00Z'));
	const cache = new Map<string, string>();
	const redis = {
		get: vi.fn(async (key: string) => cache.get(key) ?? null),
		set: vi.fn(async (key: string, value: string) => { if (cache.has(key)) return null; cache.set(key, value); return 'OK'; }),
	};
	let eligible = [participant('owner'), participant('other')];
	const query = {
		innerJoin: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getRawMany: vi.fn(async () => eligible),
	};
	const mine = { hataskRankingParticipating: true, achievements: [{ name: 'notes1', unlockedAt: 20 }, { name: 'utageSuccess10', unlockedAt: 10 }] };
	const profiles = {
		query: vi.fn(async () => scores.map(row => ({ ...row, value: String(row.value) }))),
		createQueryBuilder: vi.fn(() => query), findOneByOrFail: vi.fn(async () => mine), update: vi.fn(async () => ({})),
	};
	const filters = { generateMutedUserQueryForUsers: vi.fn(), generateBlockQueryForUsers: vi.fn() };
	const users = { packMany: vi.fn(async (ids: string[]) => ids.map(id => ({ id, username: id, name: `Name ${id}` }))) };
	const service = new HataskRankingService(redis as never, profiles as never, filters as never, users as never);
	return { service, redis, cache, profiles, query, filters, users, mine, setEligible: (value: typeof eligible) => { eligible = value; } };
}

describe('Hatask ranking calendar and ties', () => {
	test('uses month, Monday-based week and day, including a year boundary', () => {
		const now = new Date(2027, 0, 3, 12);
		expect(hataskRankingWindow('month', now)).toMatchObject({ from: '2027-01-01', to: '2027-01-03', loginDates: ['2027/1/1', '2027/1/2', '2027/1/3'] });
		expect(hataskRankingWindow('week', now)).toMatchObject({ from: '2026-12-28', loginDates: ['2026/12/28', '2026/12/29', '2026/12/30', '2026/12/31', '2027/1/1', '2027/1/2', '2027/1/3'] });
		expect(hataskRankingWindow('day', now)).toMatchObject({ from: '2027-01-03', loginDates: ['2027/1/3'] });
		expect(hataskRankingWindow('week', new Date(2027, 0, 4, 0)).from).toBe('2027-01-04');
	});
	test('uses leap days and omits future login dates', () => {
		const window = hataskRankingWindow('month', new Date(2028, 1, 29, 0));
		expect(window.loginDates).toHaveLength(29);
		expect(window.loginDates.at(-1)).toBe('2028/2/29');
	});
	test('assigns competition ranks with stable ties and leaves input unchanged', () => {
		const rows = Object.freeze([score('z', 5), score('a', 5), score('b', 1), score('zero', 0)]);
		expect(rankHataskScores(rows).map(row => [row.userId, row.rank])).toEqual([['a', 1], ['z', 1], ['b', 3]]);
		expect(rows[0].userId).toBe('z');
	});
	test('accepts valid snapshots and rejects malformed cache values', () => {
		const valid = { generatedAt: new Date().toISOString(), scores: [score('a', 2)] };
		expect(parseHataskRankingSnapshot(JSON.stringify(valid))).toEqual(valid);
		for (const raw of [null, '', 'null', '{', '{}', JSON.stringify({ ...valid, generatedAt: 'invalid' }), JSON.stringify({ ...valid, scores: [score('a', -1)] }), JSON.stringify({ ...valid, scores: [{ ...score('a', 1), metric: 'secret' }] })]) {
			expect(parseHataskRankingSnapshot(raw)).toBeNull();
		}
	});
});

describe('Hatask ranking privacy, caching and pagination', () => {
	test('uses public Utage notes and server calendar keys in one parameterized aggregate', async () => {
		const f = fixture();
		const response = await f.service.list(me, 'month', undefined, 1, 5);
		expect(f.profiles.query).toHaveBeenCalledOnce();
		const [sql, values] = f.profiles.query.mock.calls[0] as unknown as [string, unknown[]];
		expect(sql).toContain('note.visibility = \'public\'');
		expect(sql).toContain('session."resolvedAt" >= $1');
		expect(sql).toContain('COUNT(DISTINCT dates.day)');
		expect(sql).toContain('dates.day = ANY($3::varchar[])');
		expect(values).toEqual([new Date('2026-09-01T00:00:00Z'), new Date('2026-09-09T12:15:00Z'), Array.from({ length: 9 }, (_, i) => `2026/9/${i + 1}`)]);
		expect(response.boards).toHaveLength(4);
		expect(response.boards[0].self).toEqual({ rank: 2, value: 3, delta: null, eligible: true });
		expect(response.latestAchievement).toEqual({ name: 'utageSuccess10', unlockedAt: 10 });
		expect(response.nextUpdateAt).toBe('2026-09-09T13:00:00.000Z');
		expect(f.filters.generateMutedUserQueryForUsers).toHaveBeenCalledWith(f.query, me);
		expect(f.filters.generateBlockQueryForUsers).toHaveBeenCalledWith(f.query, me);
		expect(f.query.andWhere).toHaveBeenCalledWith('profile.hataskRankingParticipating = TRUE');
		expect(f.query.andWhere).toHaveBeenCalledWith('user.isSuspended = FALSE');
		expect(f.query.andWhere).toHaveBeenCalledWith('user.isDeleted = FALSE');
		expect(f.query.addSelect).toHaveBeenCalledWith(expect.stringContaining('"hataskFlowerVisibility" = \'public\''), 'flower');
	});
	test('reuses counts while immediately excluding newly opted-out or blocked users before ranking and packing', async () => {
		const f = fixture();
		expect((await f.service.list(me, 'day', 'flower', 1, 1)).boards[0]).toMatchObject({ total: 2, items: [{ user: { id: 'other' } }], self: { rank: 2 } });
		f.setEligible([participant('owner')]);
		const result = await f.service.list(me, 'day', 'flower', 99, 1);
		expect(f.profiles.query).toHaveBeenCalledOnce();
		expect(f.query.getRawMany).toHaveBeenCalledTimes(2);
		expect(result.boards[0]).toMatchObject({ total: 1, totalPages: 1, page: 1, self: { rank: 1 }, items: [{ user: { id: 'owner' } }] });
		expect(f.users.packMany).toHaveBeenLastCalledWith(['owner'], me, { schema: 'UserLite' });
	});
	test('applies per-metric visibility and only returns the private count to its owner', async () => {
		const f = fixture([score('owner', 3), score('other', 6), score('other', 2, 'login')]);
		f.setEligible([participant('other', false)]);
		f.mine.hataskRankingParticipating = false;
		const result = await f.service.list(me, 'month', undefined, 1, 5);
		expect(result.participating).toBe(false);
		expect(result.boards[0]).toMatchObject({ total: 0, items: [], self: { eligible: false, rank: null, delta: null, value: 3 } });
		expect(result.boards[3]).toMatchObject({ total: 1, items: [{ user: { id: 'other' }, value: 2 }] });
	});
	test('compares previous snapshot only against users who are still eligible', async () => {
		const f = fixture([score('owner', 8), score('other', 6), score('hidden', 20)]);
		const hour = Math.floor(Date.now() / 3600000);
		f.cache.set(`hatask:ranking:v1:month:2026-09-01:${hour - 1}`, JSON.stringify({ generatedAt: '2026-09-09T11:00:00Z', scores: [score('owner', 3), score('other', 6), score('hidden', 20)] }));
		const result = await f.service.list(me, 'month', 'flower', 1, 5);
		expect(result.boards[0].items.map(row => [row.user.id, row.rank, row.delta])).toEqual([['owner', 1, 1], ['other', 2, -1]]);
	});
	test('coalesces simultaneous refreshes and refreshes at the next hour', async () => {
		const f = fixture();
		await Promise.all([f.service.list(me, 'month', 'flower', 1, 5), f.service.list(me, 'month', 'login', 1, 5)]);
		expect(f.profiles.query).toHaveBeenCalledOnce();
		vi.setSystemTime(new Date('2026-09-09T13:00:00Z'));
		await f.service.list(me, 'month', 'flower', 1, 5);
		expect(f.profiles.query).toHaveBeenCalledTimes(2);
	});
	test('does not reuse another period or compare across a period boundary', async () => {
		const f = fixture();
		await f.service.list(me, 'day', 'flower', 1, 5);
		await f.service.list(me, 'week', 'flower', 1, 5);
		expect(f.profiles.query).toHaveBeenCalledTimes(2);
		vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
		expect((await f.service.list(me, 'month', 'flower', 1, 5)).previousGeneratedAt).toBeNull();
	});
	test('returns stable page boundaries even when adjacent ranks tie', async () => {
		const f = fixture([score('a', 5), score('b', 5), score('c', 2)]);
		f.setEligible(['a', 'b', 'c'].map(id => participant(id)));
		const first = await f.service.list(me, 'month', 'flower', 1, 1);
		const second = await f.service.list(me, 'month', 'flower', 2, 1);
		expect(first.boards[0]).toMatchObject({ total: 3, totalPages: 3, page: 1, items: [{ rank: 1, user: { id: 'a' } }] });
		expect(second.boards[0]).toMatchObject({ page: 2, items: [{ rank: 1, user: { id: 'b' } }] });
	});
	test('fails closed when fresh privacy checks or aggregation fail', async () => {
		const f = fixture();
		await f.service.list(me, 'month', 'flower', 1, 5);
		f.query.getRawMany.mockRejectedValueOnce(new Error('db unavailable'));
		await expect(f.service.list(me, 'month', 'flower', 1, 5)).rejects.toThrow('db unavailable');
		f.profiles.query.mockRejectedValueOnce(new Error('aggregate unavailable'));
		await expect(f.service.list(me, 'day', 'flower', 1, 5)).rejects.toThrow('aggregate unavailable');
		await expect(f.service.list(me, 'day', 'flower', 1, 5)).resolves.toBeDefined();
	});
});

describe('Hatask ranking endpoint contracts', () => {
	test('requires credentials and the respective account scopes with rate limits', () => {
		expect(listMeta).toMatchObject({ requireCredential: true, kind: 'read:account', limit: { max: 60 } });
		expect(participationMeta).toMatchObject({ requireCredential: true, kind: 'write:account', limit: { max: 20 } });
	});
	test('supplies list defaults and rejects unbounded or unknown input before service execution', async () => {
		const service = { list: vi.fn(async () => ({})) };
		const endpoint = new ListEndpoint(service as never);
		await endpoint.exec({}, me, null, null);
		expect(service.list).toHaveBeenLastCalledWith(me, 'month', undefined, 1, 5);
		for (const params of [{ period: 'year' }, { metric: 'private' }, { limit: 21 }, { page: 0 }, { page: 1.5 }, { userId: 'victim' }]) {
			await expect(endpoint.exec(params, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		expect(service.list).toHaveBeenCalledOnce();
	});
	test('updates only the authenticated owner, accepts both boolean states and rejects userId injection', async () => {
		const f = fixture();
		const endpoint = new ParticipationEndpoint(f.profiles as never);
		for (const participating of [false, true]) {
			await expect(endpoint.exec({ participating }, me, null, null)).resolves.toEqual({ participating });
			expect(f.profiles.update).toHaveBeenLastCalledWith({ userId: 'owner' }, { hataskRankingParticipating: participating });
		}
		for (const params of [{}, { participating: 'false' }, { participating: true, userId: 'victim' }]) {
			await expect(endpoint.exec(params, me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		expect(f.profiles.update).toHaveBeenCalledTimes(2);
	});
});
