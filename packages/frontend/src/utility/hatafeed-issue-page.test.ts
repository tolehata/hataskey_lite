/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { fetchHataFeedIssuePage } from './hatafeed-issue-page.js';
import type { HataFeedIssueFilters, HataFeedIssuePageRequest } from './hatafeed-issue-page.js';

const filters: HataFeedIssueFilters = {
	projectId: 'project',
	category: 'bug',
	status: 'open',
	createdById: 'author',
	query: 'search text',
	includeClosed: true,
};

function createIssues(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		id: `issue-${String(count - index).padStart(4, '0')}`,
		title: `Issue ${count - index}`,
	}));
}

function createRequest(count: number) {
	const issues = createIssues(count);
	const request = vi.fn(async (params: HataFeedIssuePageRequest) => {
		if (params.limit < 1 || params.limit > 100) throw new Error('INVALID_PARAM');
		return issues.filter(issue => params.untilId == null || issue.id < params.untilId).slice(0, params.limit);
	});
	return { request, issues };
}

describe('fetchHataFeedIssuePage', () => {
	test.each([
		[10, 0, false],
		[10, 10, false],
		[10, 11, true],
		[50, 50, false],
		[50, 51, true],
		[100, 99, false],
		[100, 100, false],
		[100, 101, true],
	] as const)('%i 件表示・対象 %i 件で次ページ有無を %s と判定する', async (pageSize, count, hasNext) => {
		const { request, issues } = createRequest(count);

		const result = await fetchHataFeedIssuePage(request, filters, pageSize);

		expect(result).toEqual({ issues: issues.slice(0, pageSize), hasNext });
		expect(request.mock.calls).toHaveLength(pageSize === 100 && count >= 100 ? 2 : 1);
		expect(request.mock.calls[0][0].limit).toBe(Math.min(pageSize + 1, 100));
	});

	test('100 件表示の先読みは同じ絞り込みで最後の表示行より後を取得する', async () => {
		const { request, issues } = createRequest(201);
		const untilId = issues[0].id;

		const result = await fetchHataFeedIssuePage(request, filters, 100, untilId);

		expect(result.issues).toEqual(issues.slice(1, 101));
		expect(result.hasNext).toBe(true);
		expect(request.mock.calls.map(([params]) => params)).toEqual([
			{ ...filters, limit: 100, untilId },
			{ ...filters, limit: 1, untilId: issues[100].id },
		]);
	});

	test('取得中に画面の絞り込みが変わっても先読み条件を混ぜない', async () => {
		const changingFilters = { ...filters };
		let calls = 0;
		const request = vi.fn(async (_params: HataFeedIssuePageRequest) => {
			if (++calls === 1) {
				changingFilters.category = 'other';
				changingFilters.includeClosed = false;
				return createIssues(100);
			}
			return [];
		});

		await fetchHataFeedIssuePage(request, changingFilters, 100);

		expect(request.mock.calls[1][0]).toMatchObject(filters);
	});

	test('一覧取得に失敗したときは成功結果を返さない', async () => {
		const error = new Error('request failed');
		const request = vi.fn().mockRejectedValue(error);

		await expect(fetchHataFeedIssuePage(request, filters, 100)).rejects.toBe(error);
		expect(request).toHaveBeenCalledTimes(1);
	});

	test('100 件取得後の先読みに失敗しても不確かなページを返さない', async () => {
		const error = new Error('probe failed');
		const request = vi.fn().mockResolvedValueOnce(createIssues(100)).mockRejectedValueOnce(error);

		await expect(fetchHataFeedIssuePage(request, filters, 100)).rejects.toBe(error);
		expect(request).toHaveBeenCalledTimes(2);
	});
});
