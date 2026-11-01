/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HataskRecordReviewService } from '@/core/HataskRecordReviewService.js';
import { decodeReviewCursor, normalizeReviewOptions, reviewFields, reviewHash } from '@/core/hatask-record-review.js';
import ListEndpoint, { meta as listMeta } from '@/server/api/endpoints/admin/hatask/records/list.js';
import ShowEndpoint, { meta as showMeta } from '@/server/api/endpoints/admin/hatask/records/show.js';
import ReviewEndpoint, { meta as reviewMeta } from '@/server/api/endpoints/admin/hatask/records/review.js';

const id = 'a'.repeat(64), contentVersion = 'b'.repeat(64), viewer = { id: 'moderator' } as never;
const input = { id, state: 'reviewed' as const, expectedRevision: 0, expectedContentVersion: contentVersion };
const row = () => ({ id, userId: 'owner', kind: 'todo', title: '個人の記録', body: '公開していない本文', date: '2026-09-16', time: '12:00', visibility: 'private', dateFallback: false, data: { subtasks: [{ text: '非公開のサブタスク' }] }, contentVersion, revision: 0, state: 'unread', stale: false, reviewerId: null, reviewedAt: null });

function setup(allowed = true) {
	const query = vi.fn().mockResolvedValue([row()]);
	const transaction = vi.fn(async callback => callback({ query }));
	const isModerator = vi.fn().mockResolvedValue(allowed);
	const packMany = vi.fn(async (ids: string[]) => ids.map(id => ({ id, username: id, name: id })));
	return { query, transaction, isModerator, packMany, service: new HataskRecordReviewService({ query, transaction } as never, { isModerator } as never, { packMany } as never) };
}

describe('Hatask staff record review', () => {
	test('all routes require first-party moderator credentials, declared scopes and limits', () => {
		for (const meta of [listMeta, showMeta, reviewMeta]) {
			expect(meta).toMatchObject({ requireCredential: true, requireModerator: true, secure: true });
			expect(meta.limit.max).toBeGreaterThan(0);
		}
		expect(listMeta.kind).toBe('read:admin:show-user');
		expect(showMeta.kind).toBe('read:admin:show-user');
		expect(reviewMeta.kind).toBe('write:admin:user-note');
	});
	test.each(['list', 'show', 'review'] as const)('%s denies ordinary/anonymous/third-party access before reading data', async method => {
		for (const [allowed, account, token] of [[false, viewer, null], [true, null, null], [true, viewer, { id: 'thirdparty' }]] as const) {
			const mock = setup(allowed);
			const call = method === 'list' ? mock.service.list(account as never, {}, token) : method === 'show' ? mock.service.show(account as never, id, token) : mock.service.review(account as never, input, token);
			await expect(call).rejects.toMatchObject({ code: 'HATASK_REVIEW_ACCESS_DENIED' });
			expect(mock.query).not.toHaveBeenCalled(); expect(mock.transaction).not.toHaveBeenCalled(); expect(mock.packMany).not.toHaveBeenCalled();
		}
	});
	test('endpoint callbacks forward the actual session token to the service guard', async () => {
		const mock = setup(), token = { id: 'thirdparty' } as never;
		await expect(new ListEndpoint(mock.service).exec({}, viewer, token, null)).rejects.toMatchObject({ code: 'HATASK_REVIEW_ACCESS_DENIED' });
		await expect(new ShowEndpoint(mock.service).exec({ id }, viewer, token, null)).rejects.toMatchObject({ code: 'HATASK_REVIEW_ACCESS_DENIED' });
		await expect(new ReviewEndpoint(mock.service).exec(input, viewer, token, null)).rejects.toMatchObject({ code: 'HATASK_REVIEW_ACCESS_DENIED' });
		expect(mock.query).not.toHaveBeenCalled();
	});
	test('details retain private subtasks and resolve specified members without altering visibility', async () => {
		const mock = setup();
		mock.query.mockResolvedValue([{ ...row(), visibility: 'specified', data: { subtasks: [{ text: '<script>private</script>', done: false }], visibleUserIds: ['member', 'member'] } }]);
		const detail = await mock.service.show(viewer, id);
		expect(detail.item.visibility).toBe('specified');
		expect(detail.fields.find(field => field.label === 'サブタスク')?.value).toContain('<script>private</script>');
		expect(detail.audience.map(user => user.id)).toEqual(['member']);
		expect(mock.query.mock.calls[0][1]).toEqual([id]);
	});
	test('list applies all filters before keyset paging and excludes full data from the list payload', async () => {
		const mock = setup();
		mock.query.mockResolvedValue([{ items: [row(), { ...row(), id: 'c'.repeat(64) }], total: 4, kinds: { todo: 4 }, states: { unread: 4 } }]);
		const opts = { kind: 'todo' as const, state: 'unread' as const, query: '\'; -- %_', userId: 'owner', dateFrom: '2026-09-01', dateTo: '2026-09-30', visibility: 'private' as const, limit: 1 };
		const result = await mock.service.list(viewer, opts);
		expect(result.items).toHaveLength(1); expect(result.total).toBe(4); expect(result.items[0]).not.toHaveProperty('data');
		const [sql, params] = mock.query.mock.calls[0];
		expect(sql).not.toContain(opts.query); expect(params).toContain('owner'); expect(params).toContain('todo'); expect(params).toContain('unread');
		expect(sql.indexOf('filtered AS')).toBeLessThan(sql.indexOf('page AS'));
		expect(decodeReviewCursor(result.nextCursor, reviewHash(normalizeReviewOptions(opts)))?.id).toBe(id);
		await mock.service.list(viewer, { ...opts, cursor: result.nextCursor });
		expect(mock.query.mock.calls[1][0]).toContain('(date,time,id) <');
	});
	test('rejects invalid dates, page bounds, foreign filter cursors and forged targets', async () => {
		for (const input of [{ dateFrom: '2026-02-30' }, { dateFrom: '2026-09-20', dateTo: '2026-09-01' }, { limit: 1000 }, { kind: 'settings' }, { userId: 'x\'--' }]) expect(() => normalizeReviewOptions(input as never)).toThrow();
		expect(() => decodeReviewCursor(Buffer.from(JSON.stringify({ filter: 'other', date: '2026-09-16', time: '12:00', id })).toString('base64url'), 'current')).toThrow();
		const mock = setup();
		await expect(mock.service.show(viewer, '\';--')).rejects.toMatchObject({ code: 'INVALID_HATASK_REVIEW' });
		expect(mock.query).not.toHaveBeenCalled();
	});
	test.each([{ revision: 1 }, { contentVersion: 'c'.repeat(64) }])('stale content or another reviewer prevents writes: %j', async changed => {
		const mock = setup();
		mock.query.mockResolvedValue([{ ...row(), ...changed }]);
		await expect(mock.service.review(viewer, input)).rejects.toMatchObject({ code: 'HATASK_REVIEW_CONFLICT' });
		expect(mock.query.mock.calls.map(call => call[0]).some(sql => sql.startsWith('INSERT'))).toBe(false);
		expect(mock.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
	});
	test('writes only an annotation with current content and revision and reloads source state', async () => {
		const mock = setup();
		mock.query.mockResolvedValueOnce([]).mockResolvedValueOnce([row()]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...row(), revision: 1, state: 'reviewed', reviewerId: 'moderator', reviewedAt: '2026-09-16T00:00:00Z' }]);
		const result = await mock.service.review(viewer, input);
		expect(mock.query.mock.calls[2][0]).toMatch(/^INSERT INTO hatask_record_review/);
		expect(mock.query.mock.calls[2][1]).toEqual([id, 'owner', 'reviewed', contentVersion, 1, 'moderator']);
		expect(result.item.state).toBe('reviewed'); expect(result.item.revision).toBe(1);
	});
	test('removed records cannot be reviewed and malformed legacy content remains readable', async () => {
		const mock = setup(); mock.query.mockResolvedValue([]);
		await expect(mock.service.review(viewer, input)).rejects.toMatchObject({ code: 'NO_SUCH_HATASK_RECORD' });
		expect(mock.query.mock.calls.some(call => call[0].startsWith('INSERT'))).toBe(false);
		expect(reviewFields({ _unparsed: 'legacy text' })).toEqual([{ label: '読み取れない形式の記録', value: 'legacy text' }]);
	});
});
