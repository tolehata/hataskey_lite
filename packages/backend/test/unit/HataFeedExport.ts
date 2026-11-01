/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import HataFeedExportEndpoint from '@/server/api/endpoints/hata/feedback/issues/export.js';

function queryReturning<T>(rows: T[]) {
	const conditions: Array<{ sql: string; params?: Record<string, unknown> }> = [];
	const query = {
		where: vi.fn((sql: string, params?: Record<string, unknown>) => {
			conditions.push({ sql, params });
			return query;
		}),
		andWhere: vi.fn((sql: string, params?: Record<string, unknown>) => {
			conditions.push({ sql, params });
			return query;
		}),
		orderBy: vi.fn(() => query),
		getMany: vi.fn(async () => rows),
	};
	return { query, conditions };
}

function makeIssue() {
	return {
		id: 'issue1',
		number: 12,
		title: '表示が崩れる',
		description: '詳しい本文',
		category: 'bug',
		status: 'inProgress',
		priority: 'high',
		closed: false,
		pinned: false,
		agreementsCount: 4,
		commentsCount: 1,
		code: 'const broken = true;',
		resolutionNote: '修正中',
		createdById: 'author1',
		createdAt: new Date('2026-08-01T00:00:00.000Z'),
		updatedAt: new Date('2026-08-02T00:00:00.000Z'),
	};
}

function makeEndpoint(options: { includeComments?: boolean; staff?: boolean; allowed?: boolean } = {}) {
	const issues = queryReturning([makeIssue()]);
	const comments = queryReturning(options.includeComments ? [{
		id: 'comment1',
		feedbackId: 'issue1',
		userId: 'commenter1',
		text: '確認しました',
		replyToId: null,
		mark: 'important',
		createdAt: new Date('2026-08-01T01:00:00.000Z'),
	}] : []);
	const usersRepository = {
		findBy: vi.fn(async () => [
			{ id: 'author1', username: 'author', host: null },
			{ id: 'commenter1', username: 'commenter', host: 'example.test' },
		]),
	};
	const projectsRepository = {
		findOneBy: vi.fn(async () => ({ id: 'project1', name: 'Project', description: '', url: null })),
	};
	const feedbackService = {
		canAccess: vi.fn(async () => options.allowed !== false),
		canExport: vi.fn(async () => options.allowed !== false),
		isStaff: vi.fn(async () => options.staff === true),
	};
	const endpoint = new HataFeedExportEndpoint(
		{ createQueryBuilder: vi.fn(() => issues.query) } as never,
		{ createQueryBuilder: vi.fn(() => comments.query) } as never,
		projectsRepository as never,
		usersRepository as never,
		feedbackService as never,
	);
	return { endpoint, issues, comments, usersRepository, feedbackService };
}

describe('hata/feedback/issues/export', () => {
	test('範囲をクエリへ適用し、外した内容は取得も出力もしない', async () => {
		const { endpoint, issues, comments, usersRepository } = makeEndpoint();
		const result = await endpoint.exec({
			projectId: 'project1',
			numberFrom: 10,
			numberTo: 20,
			createdFrom: '2026-08-01T00:00:00.000Z',
			createdTo: '2026-08-05T23:59:59.999Z',
			closedState: 'open',
			statuses: ['inProgress'],
			categories: ['bug'],
			includeDescription: false,
			includeComments: false,
			includeCode: false,
			includeResolution: false,
			includeAuthors: false,
			includeStats: false,
		}, { id: 'owner' } as never, null, null);

		const sql = issues.conditions.map(condition => condition.sql).join('\n');
		expect(sql).toContain('issue.number >= :numberFrom');
		expect(sql).toContain('issue.number <= :numberTo');
		expect(sql).toContain('issue.createdAt >= :createdFrom');
		expect(sql).toContain('issue.createdAt <= :createdTo');
		expect(sql).toContain('issue.closed = FALSE');
		expect(sql).toContain('issue.status IN (:...statuses)');
		expect(sql).toContain('issue.category IN (:...categories)');
		expect(sql).toContain('issue.category != :securityCategory');
		expect(comments.query.getMany).not.toHaveBeenCalled();
		expect(usersRepository.findBy).not.toHaveBeenCalled();
		expect(result.schema).toBe('hatafeed-issues-export/v2');
		expect(result.issues[0]).not.toHaveProperty('description');
		expect(result.issues[0]).not.toHaveProperty('comments');
		expect(result.issues[0]).not.toHaveProperty('author');
		expect(result.issues[0]).not.toHaveProperty('agreementsCount');
	});

	test('選択した本文・会話・投稿者を構造化して出力する', async () => {
		const { endpoint, usersRepository } = makeEndpoint({ includeComments: true, staff: true });
		const result = await endpoint.exec({ projectId: 'project1' }, { id: 'mod' } as never, null, null);

		expect(usersRepository.findBy).toHaveBeenCalledOnce();
		expect(result.issues[0]).toMatchObject({
			description: '詳しい本文',
			author: '@author',
			comments: [{
				id: 'comment1',
				author: '@commenter@example.test',
				text: '確認しました',
				mark: 'important',
			}],
		});
	});

	test('開始が終了より後の範囲を拒否する', async () => {
		const { endpoint } = makeEndpoint();
		await expect(endpoint.exec({ numberFrom: 20, numberTo: 10 }, { id: 'owner' } as never, null, null))
			.rejects.toMatchObject({ code: 'HATAFEED_EXPORT_INVALID_RANGE' });
	});

	test('HataFeedまたはエクスポートの権限が無い利用者を拒否する', async () => {
		const { endpoint } = makeEndpoint({ allowed: false });
		await expect(endpoint.exec({}, { id: 'someone' } as never, null, null))
			.rejects.toMatchObject({ code: 'HATAFEED_ACCESS_DENIED' });
	});
});
