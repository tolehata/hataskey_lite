/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import HomeIssuesEndpoint from '@/server/api/endpoints/hata/hatagoes/home/issues.js';

function repository(rows: { id: string; createdById: string; status?: string; closed?: boolean }[]) {
	const createQueryBuilder = vi.fn(() => {
		const clauses: string[] = [];
		let params: { createdById?: string; untilId?: string; finishedStatuses?: string[] } = {};
		const query = {
			where: vi.fn((sql: string, values?: typeof params) => { clauses.push(sql); params = { ...params, ...values }; return query; }),
			andWhere: vi.fn((sql: string, values?: typeof params) => { clauses.push(sql); params = { ...params, ...values }; return query; }),
			orderBy: vi.fn(() => query), limit: vi.fn(() => query),
			getMany: vi.fn(async () => rows.filter(row => (!params.createdById || row.createdById === params.createdById)
				&& (!params.untilId || row.id < params.untilId)
				&& (!params.finishedStatuses || !params.finishedStatuses.includes(row.status ?? 'open'))
				&& (!clauses.includes('issue.closed = FALSE') || !row.closed)).slice(0, 50)),
		};
		return query;
	});
	return { createQueryBuilder };
}

describe('HataGoes home issue selection', () => {
	test('prefers the viewer’s own visible issues over newer issues from others', async () => {
		const rows = [{ id: '02', createdById: 'other' }, { id: '01', createdById: 'viewer' }];
		const endpoint = new HomeIssuesEndpoint(
			repository(rows) as never,
			{ packIssues: vi.fn(async (issues: unknown[]) => issues) } as never,
			{ canAccess: vi.fn().mockResolvedValue(true), canViewIssue: vi.fn().mockResolvedValue(true) } as never,
		);
		const result = await endpoint.exec({}, { id: 'viewer' } as never, null, null);
		expect(result).toMatchObject({ source: 'mine', issues: [{ id: '01' }] });
	});

	test('uses only visible latest issues and falls back when the viewer has none', async () => {
		const rows = [
			{ id: '03', title: 'hidden', createdById: 'other' },
			{ id: '02', title: 'latest visible', createdById: 'other' },
			{ id: '01', title: 'older visible', createdById: 'other' },
		];
		const canViewIssue = vi.fn(async (_userId: string, issue: { id: string }) => issue.id !== '03');
		const packIssues = vi.fn(async (issues: unknown[]) => issues);
		const endpoint = new HomeIssuesEndpoint(
			repository(rows) as never,
			{ packIssues } as never,
			{ canAccess: vi.fn().mockResolvedValue(true), canViewIssue } as never,
		);
		const result = await endpoint.exec({}, { id: 'viewer' } as never, null, null);
		expect(result).toMatchObject({ source: 'recent', issues: [{ id: '02' }, { id: '01' }] });
		expect(packIssues).toHaveBeenCalledWith([rows[1], rows[2]], { id: 'viewer' });
	});

	test('finished or closed own issues use the latest-issue fallback without hiding historical statuses there', async () => {
		const rows = [
			{ id: '04', createdById: 'viewer', status: 'open', closed: true },
			{ id: '03', createdById: 'other', status: 'planned' },
			{ id: '02', createdById: 'viewer', status: 'resolved' },
			{ id: '01', createdById: 'viewer', status: 'wontfix' },
		];
		const endpoint = new HomeIssuesEndpoint(
			repository(rows) as never,
			{ packIssues: vi.fn(async (issues: unknown[]) => issues) } as never,
			{ canAccess: vi.fn().mockResolvedValue(true), canViewIssue: vi.fn().mockResolvedValue(true) } as never,
		);
		const result = await endpoint.exec({}, { id: 'viewer' } as never, null, null);
		expect(result).toMatchObject({ source: 'recent', issues: rows.slice(1) });
	});
});
