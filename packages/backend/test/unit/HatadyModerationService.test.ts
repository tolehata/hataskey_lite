/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { HatadyModerationService, HATADY_MODERATION_UNION, decodeModerationCursor, moderationFingerprint, normalizeModerationOptions, moderationFields, MODERATION_ERRORS } from '@/core/HatadyModerationService.js';
import { MiHatadyBook } from '@/models/HatadyBook.js';
import { MiHatadyLog } from '@/models/HatadyLog.js';
import { MiHatadyComment } from '@/models/HatadyComment.js';
import { MiHatadyReaction } from '@/models/HatadyReaction.js';
import { MiHatadyMediaWork } from '@/models/HatadyMediaWork.js';
import { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';
import { MiHatadyMediaComment } from '@/models/HatadyMediaComment.js';
import { MiHatadyMediaReaction } from '@/models/HatadyMediaReaction.js';
import { MiHatadyBookmark } from '@/models/HatadyBookmark.js';
import { MiHatadyBookMemo } from '@/models/HatadyBookMemo.js';
import { HatadyAttachmentService } from '@/core/HatadyAttachmentService.js';
import type { MiUser } from '@/models/User.js';

const viewer = { id: 'staff' } as MiUser;
const version = 'a'.repeat(64);

function row(overrides: Record<string, unknown> = {}) {
	return { key: 'log:first', targetType: 'log', targetId: 'first', category: 'record', activity: 'study', userId: 'owner', title: '本の記録', body: '本文', createdAt: '2026-09-10T00:00:00.000Z', visibility: 'private', emoji: null, parentKey: null, contentVersion: version, data: { details: { memo: '私的メモ' } }, state: 'unreviewed', note: '', revision: 0, reviewerId: null, reviewedAt: null, stale: false, ...overrides };
}

function fixture(allowed = true) {
	const db = { query: vi.fn(), transaction: vi.fn() };
	const role = { isModerator: vi.fn().mockResolvedValue(allowed) };
	const users = { packMany: vi.fn(async (ids: string[]) => ids.map(id => ({ id, username: id, name: id }))) };
	return { db, role, users, service: new HatadyModerationService(db as never, role as never, users as never, { validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) } as never) };
}

const request = { targetType: 'log' as const, targetId: 'first', state: 'reviewed' as const, note: '確認しました', expectedRevision: 0, expectedContentVersion: version };

// This checks actual entity columns, not a second handwritten schema. It is not
// a PostgreSQL execution test; source SQL is still reviewed separately.
describe('moderation SQL and real model mappings', () => {
	test('all eight source branches and every qualified content column resolve to entities', () => {
		const models = [MiHatadyBook, MiHatadyLog, MiHatadyComment, MiHatadyReaction, MiHatadyMediaWork, MiHatadyMediaSession, MiHatadyMediaComment, MiHatadyMediaReaction, MiHatadyBookmark, MiHatadyBookMemo];
		const metadata = getMetadataArgsStorage();
		const tables = new Map(models.map(model => [metadata.tables.find(table => table.target === model)!.name!, new Set(metadata.columns.filter(column => column.target === model).map(column => column.propertyName))]));

		function unknownColumns(sql: string) {
			const failures: string[] = [];
			for (const branch of sql.split(' UNION ALL ')) {
				const aliases = new Map([...branch.matchAll(/(?:FROM|JOIN) "?(hatady_[a-z_]+)"? ([a-z]+)\b/g)].map(match => [match[2], match[1]]));
				for (const match of branch.matchAll(/\b([a-z]+)\."?([A-Za-z][A-Za-z0-9]*)"?/g)) {
					const table = aliases.get(match[1]);
					if (!table || !tables.get(table)?.has(match[2])) failures.push(`${match[1]}.${match[2]}`);
				}
			}
			return failures;
		}

		expect(HATADY_MODERATION_UNION.split(' UNION ALL ')).toHaveLength(8);
		expect(unknownColumns(HATADY_MODERATION_UNION.replace('x.title', 'x.nonexistentModerationColumn'))).toContain('x.nonexistentModerationColumn');
		expect(unknownColumns(HATADY_MODERATION_UNION)).toEqual([]);
	});

	test('bookmarks, private memos and unknown legacy fields remain reviewable', () => {
		expect(HATADY_MODERATION_UNION).toContain('jsonb_agg(to_jsonb(b) ORDER BY b.id)');
		expect(HATADY_MODERATION_UNION).toContain('jsonb_agg(to_jsonb(m) ORDER BY m.id)');
		const fields = moderationFields({ id: 'notshown', title: 'header', body: 'main', details: { memo: 'private', weaponRows: [{ customResult: 'legacy' }] }, bookmarks: [{ id: 'bookmark', name: '章', page: 0, memo: 'しおりのメモ' }], memos: [{ text: '内容メモ', page: 7 }] });
		expect(fields).toEqual(expect.arrayContaining([
			{ label: '詳しい情報 · 私的メモ', value: 'private' },
			{ label: '詳しい情報 · weaponRows 1 · customResult', value: 'legacy' },
			{ label: 'しおり（本人用） 1 · ページ', value: '0' },
			{ label: 'しおり（本人用） 1 · 私的メモ', value: 'しおりのメモ' },
			{ label: '内容メモ（本人用） 1 · 本文', value: '内容メモ' },
		]));
		expect(fields.some(field => ['notshown', 'header', 'main'].includes(field.value))).toBe(false);
	});
});

describe('moderation cursor and bounded filters', () => {
	test.each([{ limit: 0 }, { limit: 51 }, { since: 20, until: 10 }, { until: Infinity }, { query: 'あ'.repeat(201) }, { activity: 'unknown' }])('rejects invalid input %j', options => {
		expect(() => normalizeModerationOptions(options as never)).toThrow(MODERATION_ERRORS.invalid);
	});
	test('binds stable equal-date pagination to filters and sort, but not page size', () => {
		const filters = normalizeModerationOptions({ status: 'flagged', sort: 'asc' });
		const fingerprint = moderationFingerprint(filters);
		const cursor = Buffer.from(JSON.stringify({ v: 1, f: fingerprint, time: '2026-09-10T00:00:00.000Z', type: 'log', id: 'first' })).toString('base64url');
		expect(decodeModerationCursor(cursor, moderationFingerprint({ ...filters, limit: 10 })).id).toBe('first');
		expect(() => decodeModerationCursor(cursor, moderationFingerprint({ ...filters, sort: 'desc' }))).toThrow(MODERATION_ERRORS.cursor);
		expect(() => decodeModerationCursor('not-a-valid-cursor', fingerprint)).toThrow(MODERATION_ERRORS.cursor);
	});
});

describe('staff-only reads and isolated writes', () => {
	test('packs staff record images using the public Drive shape without adding attachments to comments', async () => {
		const f = fixture();
		const image = { id: 'image', userId: 'owner', type: 'image/png', isSensitive: true, comment: '説明' };
		const drive = { packMany: vi.fn().mockResolvedValue([image]) };
		const attachments = new HatadyAttachmentService({ findBy: vi.fn().mockResolvedValue([image]) } as never, drive as never);
		const service = new HatadyModerationService(f.db as never, f.role as never, f.users as never, attachments);
		f.db.query.mockResolvedValue([{ items: [row({ data: { fileIds: ['missing', 'image'] } }), row({ key: 'comment:reply', targetType: 'comment', targetId: 'reply', category: 'comment', data: { text: '返信' } })], total: 2, counts: { unreviewed: 2, flagged: 0, reviewed: 0 } }]);
		const result = await service.list(viewer, {});
		expect(result.items[0]).toMatchObject({ fileIds: ['missing', 'image'], files: [image] });
		expect(result.items[1]).toMatchObject({ fileIds: [], files: [] });
		expect(drive.packMany).toHaveBeenCalledWith([image], { self: false, detail: false });
		expect(moderationFields({ fileIds: ['image'], title: 'record' })).toEqual([]);
	});
	test.each(['list', 'show', 'review'] as const)('rejects nonstaff before any %s database access', async method => {
		const f = fixture(false);
		const operation = method === 'list' ? f.service.list(viewer, {}) : method === 'show' ? f.service.show(viewer, 'log', 'first') : f.service.review(viewer, request);
		await expect(operation).rejects.toThrow(MODERATION_ERRORS.denied);
		expect(f.db.query).not.toHaveBeenCalled();
		expect(f.db.transaction).not.toHaveBeenCalled();
	});
	test.each(['list', 'show', 'review'] as const)('rejects third-party tokens before %s', async method => {
		const f = fixture();
		const token = { id: 'app' };
		await expect(method === 'list' ? f.service.list(viewer, {}, token) : method === 'show' ? f.service.show(viewer, 'log', 'first', token) : f.service.review(viewer, request, token)).rejects.toThrow(MODERATION_ERRORS.denied);
		expect(f.db.query).not.toHaveBeenCalled();
		expect(f.db.transaction).not.toHaveBeenCalled();
	});
	test('list limits packing, escapes literal search and uses one snapshot for totals and page', async () => {
		const f = fixture();
		f.db.query.mockResolvedValue([{ items: [row(), row({ targetId: 'second', key: 'log:second' })], total: 15, counts: { unreviewed: 11, flagged: 3, reviewed: 1 } }]);
		const first = await f.service.list(viewer, { limit: 1, query: '50%_\\\' OR TRUE', since: 0, until: 1000, sort: 'asc' });
		expect(first.items).toHaveLength(1);
		expect(first.total).toBe(15);
		expect(first.counts.flagged).toBe(3);
		expect(first.nextCursor).toBeTypeOf('string');
		expect(f.users.packMany).toHaveBeenCalledWith(['owner'], viewer, { schema: 'UserLite' });
		const [sql, params] = f.db.query.mock.calls[0];
		expect(sql).not.toContain('OR TRUE');
		expect(sql).toContain("COALESCE(c.data->'fileIds','[]'::jsonb)='[]'::jsonb THEN c.data-'fileIds'");
		expect(sql).toContain("- 'reactionsCount' - 'commentsCount'");
		expect(sql).toContain('ELSE \'unreviewed\' END AS state');
		expect(params).toEqual([new Date(0), new Date(1000), '%50\\%\\_\\\\\' OR TRUE%', 2]);
		await f.service.list(viewer, { limit: 1, query: '50%_\\\' OR TRUE', since: 0, until: 1000, sort: 'asc', cursor: first.nextCursor! });
		expect(f.db.query.mock.calls[1][0]).toContain('(r."createdAt",r."targetType",r."targetId") >');
	});
	test('show reports missing targets and safely stops a corrupt parent cycle', async () => {
		const f = fixture();
		f.db.query.mockResolvedValueOnce([]);
		await expect(f.service.show(viewer, 'log', 'missing')).rejects.toThrow(MODERATION_ERRORS.missing);
		f.db.query.mockImplementation(async (sql: string, params: string[]) => sql.includes('WHERE "parentKey"') ? [] : [row({ parentKey: 'log:first' })]);
		const detail = await f.service.show(viewer, 'log', 'first');
		expect(detail.ancestors).toEqual([]);
		expect(detail.item.visibility).toBe('private');
		expect(detail.fields).toContainEqual({ label: '詳しい情報 · 私的メモ', value: '私的メモ' });
	});
	test('user deletion during packing never emits an entry with an undefined actor', async () => {
		const f = fixture();
		f.users.packMany.mockResolvedValue([]);
		f.db.query.mockResolvedValueOnce([{ items: [row()], total: 1, counts: { unreviewed: 1, flagged: 0, reviewed: 0 } }]);
		expect((await f.service.list(viewer, {})).items).toEqual([]);
		f.db.query.mockImplementation(async (sql: string) => sql.includes('WHERE "parentKey"') ? [] : [row()]);
		await expect(f.service.show(viewer, 'log', 'first')).rejects.toThrow(MODERATION_ERRORS.missing);
	});
	test.each([{ note: 'a'.repeat(1001) }, { expectedRevision: -1 }, { expectedContentVersion: 'old' }, { targetType: 'user' }])('rejects invalid review %j without writes', async patch => {
		const f = fixture();
		await expect(f.service.review(viewer, { ...request, ...patch } as never)).rejects.toThrow(MODERATION_ERRORS.invalid);
		expect(f.db.transaction).not.toHaveBeenCalled();
	});
	test.each([{ revision: 2 }, { contentVersion: 'b'.repeat(64) }])('retains review/content after revision or content conflict %j', async patch => {
		const f = fixture(), query = vi.fn(async (sql: string) => sql.startsWith('SELECT pg_advisory') ? [] : sql.startsWith('SELECT id') ? [{ id: 'first' }] : [row(patch)]);
		f.db.transaction.mockImplementation(async execute => execute({ query }));
		await expect(f.service.review(viewer, request)).rejects.toThrow(MODERATION_ERRORS.conflict);
		expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
	});
	test('missing targets cannot acquire orphan review rows', async () => {
		const f = fixture(), query = vi.fn().mockResolvedValue([]);
		f.db.transaction.mockImplementation(async execute => execute({ query }));
		await expect(f.service.review(viewer, request)).rejects.toThrow(MODERATION_ERRORS.missing);
		expect(query.mock.calls.map(([sql]) => sql)).toHaveLength(2);
	});
	test('serialized concurrent first reviews cannot silently overwrite each other', async () => {
		const f = fixture();
		let current = row(), lock = Promise.resolve();
		const writes: unknown[][] = [];
		f.db.transaction.mockImplementation(async execute => {
			let unlock: (() => void) | undefined;
			const query = vi.fn(async (sql: string, params: unknown[]) => {
				if (sql.startsWith('SELECT pg_advisory')) {
					const previous = lock;
					lock = new Promise(resolve => { unlock = resolve; });
					await previous;
					return [];
				}
				if (sql.startsWith('SELECT id')) return [{ id: 'first' }];
				if (sql.startsWith('INSERT INTO hatady_moderation_review')) {
					writes.push(params);
					current = row({ state: params[2], note: params[3], revision: params[4], reviewerId: params[6], reviewedAt: new Date() });
					return [];
				}
				if (sql.includes('WHERE "parentKey"')) return [];
				return [{ ...current }];
			});
			try { return await execute({ query }); } finally { unlock?.(); }
		});
		const results = await Promise.allSettled([f.service.review(viewer, request), f.service.review(viewer, { ...request, note: '古い画面からのメモ' })]);
		expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
		expect(writes).toEqual([['log', 'first', 'reviewed', '確認しました', 1, version, 'staff']]);
		if (results[0].status === 'fulfilled') expect(results[0].value.item.review).toMatchObject({ revision: 1, state: 'reviewed', note: '確認しました' });
		if (results[1].status === 'rejected') expect(results[1].reason.message).toBe(MODERATION_ERRORS.conflict);
	});
});
