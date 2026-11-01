/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HatadyService } from '@/core/HatadyService.js';
import MyLogsEndpoint from '@/server/api/endpoints/hata/hatady/logs.js';
import TimelineEndpoint from '@/server/api/endpoints/hata/hatady/timeline.js';

type Row = { id: string; userId: string; subject: string; studiedAt: Date; reactionsCount: number; isPublic: boolean; visibility: string };
type Params = { meId: string; ids: string[]; excludedUserIds: string[]; vis: string[]; subject: string; sinceDate: Date; untilDate: Date; hatadyCursorId: string; hatadyCursorTime: Date; hatadyCursorScore: number; untilId: string };
const rows: Row[] = [
	['a', '2026-09-04', 1], ['d', '2026-09-03', 8], ['c', '2026-09-03', 8], ['z', '2026-09-02', 6], ['b', '2026-09-01', 9],
].map(([id, date, reactionsCount]) => ({ id: String(id), userId: 'owner', subject: 'study', studiedAt: new Date(`${date}T00:00:00Z`), reactionsCount: Number(reactionsCount), isPublic: true, visibility: 'public' }));
const chronological = '(log.studiedAt < :hatadyCursorTime OR (log.studiedAt = :hatadyCursorTime AND log.id < :hatadyCursorId))';
const popular = `(log.reactionsCount < :hatadyCursorScore OR (log.reactionsCount = :hatadyCursorScore AND ${chronological}))`;

// Execute the supported query predicates against adversarially ordered fixture
// rows, so endpoint pagination is checked across complete consecutive pages.
function queryBuilder(source: Row[], conditions: Array<(row: Row) => boolean> = []) {
	let maximum = Infinity;
	const order: Array<keyof Row> = [];
	const query = {
		where: vi.fn((sql: string, params: Params = {} as Params) => {
			conditions.length = 0;
			return query.andWhere(sql, params);
		}),
		andWhere: vi.fn((sql: string, p: Params = {} as Params) => {
			const afterTime = (row: Row) => row.studiedAt < p.hatadyCursorTime || (+row.studiedAt === +p.hatadyCursorTime && row.id < p.hatadyCursorId);
			if (sql === 'log.userId = :meId') conditions.push(row => row.userId === p.meId);
			else if (sql === 'log.userId IN (:...ids)') conditions.push(row => p.ids.includes(row.userId));
			else if (sql === 'log.userId NOT IN (:...excludedUserIds)') conditions.push(row => !p.excludedUserIds.includes(row.userId));
			else if (sql === 'log.visibility IN (:...vis)') conditions.push(row => p.vis.includes(row.visibility));
			else if (sql === 'log.isPublic = TRUE') conditions.push(row => row.isPublic);
			else if (sql === 'log.subject = :subject') conditions.push(row => row.subject === p.subject);
			else if (sql === 'log.studiedAt >= :sinceDate') conditions.push(row => row.studiedAt >= p.sinceDate);
			else if (sql === 'log.studiedAt <= :untilDate') conditions.push(row => row.studiedAt <= p.untilDate);
			else if (sql === 'log.id = :hatadyCursorId') conditions.push(row => row.id === p.hatadyCursorId);
			else if (sql === 'log.id < :untilId') conditions.push(row => row.id < p.untilId);
			else if (sql === chronological) conditions.push(afterTime);
			else if (sql === popular) conditions.push(row => row.reactionsCount < p.hatadyCursorScore || row.reactionsCount === p.hatadyCursorScore && afterTime(row));
			else throw new Error(`Unsupported predicate: ${sql}`);
			return query;
		}),
		clone: vi.fn(() => queryBuilder(source, [...conditions])),
		orderBy: vi.fn((column: string) => { order.length = 0; order.push(column.slice(4) as keyof Row); return query; }),
		addOrderBy: vi.fn((column: string) => { order.push(column.slice(4) as keyof Row); return query; }),
		limit: vi.fn((value: number) => { maximum = value; return query; }),
		getOne: vi.fn(async () => source.find(row => conditions.every(predicate => predicate(row))) ?? null),
		getMany: vi.fn(async () => source.filter(row => conditions.every(predicate => predicate(row))).sort((a, b) => {
			for (const key of order) { if (a[key] < b[key]) return 1; if (a[key] > b[key]) return -1; }
			return 0;
		}).slice(0, maximum)),
	};
	return query;
}

function setup(source = rows) {
	const repository = { createQueryBuilder: vi.fn(() => queryBuilder(source)) };
	const service = Object.create(HatadyService.prototype) as HatadyService;
	Object.assign(service, { hatadyLogsRepository: repository });
	Object.defineProperties(service, {
		getFollowingUserIds: { value: vi.fn().mockResolvedValue(['owner']) },
		canAppearInTimeline: { value: vi.fn().mockResolvedValue(true) },
		getTimelineExcludedUserIds: { value: vi.fn().mockResolvedValue(new Set()) },
	});
	const pack = { packLogs: vi.fn(async (logs: Row[]) => logs) };
	return {
		mine: new MyLogsEndpoint(repository as never, pack as never),
		timeline: new TimelineEndpoint(repository as never, service, pack as never),
	};
}

describe('Hatady legacy ID cursor compatibility', () => {
	test.each(['mine', 'recent', 'following', 'popular'] as const)('%s paginates backdated and tied records without skips or duplicates', async scope => {
		const endpoints = setup();
		const endpoint = scope === 'mine' ? endpoints.mine : endpoints.timeline;
		const ids: string[] = [];
		let untilId: string | undefined;
		for (let page = 0; page < 4; page++) {
			const result = await endpoint.exec({ ...(scope === 'mine' ? {} : { type: scope }), subject: 'study', limit: 2, ...(untilId ? { untilId } : {}) }, { id: 'owner' } as never, null, null) as Row[];
			ids.push(...result.map(row => row.id));
			if (result.length === 0) break;
			const last = result.at(-1);
			if (last == null) break;
			untilId = last.id;
		}
		expect(ids).toEqual(scope === 'popular' ? ['b', 'd', 'c', 'z', 'a'] : ['a', 'd', 'c', 'z', 'b']);
	});

	test.each(['mine', 'recent', 'following', 'popular'] as const)('%s does not resolve private, filtered, or nonexistent anchors', async scope => {
		const hidden = { ...rows[0], id: 'hidden', userId: 'other', isPublic: false, visibility: 'private' };
		const filtered = { ...rows[0], id: 'filtered', subject: 'other' };
		const endpoints = setup([...rows, hidden, filtered]);
		const endpoint = scope === 'mine' ? endpoints.mine : endpoints.timeline;
		for (const untilId of ['hidden', 'filtered', 'missing']) {
			await expect(endpoint.exec({ ...(scope === 'mine' ? {} : { type: scope }), subject: 'study', untilId }, { id: 'owner' } as never, null, null)).resolves.toEqual([]);
		}
	});

	test('My Log cursor resolution retains date-range filters', async () => {
		const { mine } = setup();
		await expect(mine.exec({ untilId: 'b', sinceDate: Date.parse('2026-09-02T00:00:00Z') }, { id: 'owner' } as never, null, null)).resolves.toEqual([]);
	});
});
