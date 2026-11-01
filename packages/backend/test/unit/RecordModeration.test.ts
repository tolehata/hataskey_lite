/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { RecordModerationService } from '@/core/RecordModerationService.js';
import { normalizeRecordModerationRequest, recordModerationHash } from '@/misc/record-moderation.js';
import type { RecordModerationRequest } from '@/misc/record-moderation.js';
import { projectModeratorLogInfo } from '@/misc/moderation-log-visibility.js';
import LegacyDeleteBook from '@/server/api/endpoints/hata/hatady/admin/delete-book.js';
import PreviewEndpoint from '@/server/api/endpoints/admin/record-moderation/preview.js';
import ExecuteEndpoint from '@/server/api/endpoints/admin/record-moderation/execute.js';
import HistoryEndpoint from '@/server/api/endpoints/admin/record-moderation/history.js';

const target = { product: 'hatady', targetType: 'book', targetId: 'book1' } as const;
const moderator = { id: 'mod' } as never;

function fixture(options: { denied?: boolean; failLog?: boolean; failWarning?: boolean; failStream?: boolean } = {}) {
	let state = { deleted: false, operations: [] as any[], logs: [] as any[], warnings: [] as any[] };
	let sequence = 0;
	const root = { id: 'book1', userId: 'owner', title: '確認対象の本' };
	const stream = vi.fn(() => { if (options.failStream) throw new Error('stream unavailable'); });
	const role = { isModerator: vi.fn(async () => !options.denied) };
	const db = {
		getRepository: () => ({ findOneBy: async ({ id }: { id: string }) => state.warnings.find(row => row.id === id) }),
		transaction: vi.fn(async (...args: any[]) => {
			const working = structuredClone(state);
			const manager = {
				query: async (sql: string, params: any[] = []) => {
					if (sql.startsWith('SELECT pg_advisory')) return [];
					if (sql.startsWith('SELECT * FROM record_moderation_operation')) return working.operations.filter(row => row.requestId === params[1]);
					if (sql.startsWith('SELECT to_jsonb')) return sql.includes('FROM "hatady_book"') && !working.deleted ? [{ data: root }] : [];
					if (sql.startsWith('SELECT id FROM hatady_log')) return [];
					if (sql.startsWith('WITH content')) return [{ userId: 'owner', title: root.title, contentVersion: 'a'.repeat(64), revision: 0 }];
					if (sql.startsWith('SELECT username,name')) return [{ username: params[0] === 'owner' ? 'owner_name' : 'mod_name', name: '表示名' }];
					if (sql.startsWith('INSERT INTO record_moderation_operation')) { working.operations.push({ id: params[0], requestId: params[2], requestHash: params[3], action: params[7], createdAt: params[8], info: JSON.parse(params[9]) }); return []; }
					if (sql.startsWith('DELETE FROM "hatady_book"')) { working.deleted = true; return []; }
					if (sql.startsWith('INSERT INTO moderation_log')) {
						if (options.failLog) throw new Error('log failed');
						working.logs.push({ id: params[0], userId: params[1], type: params[2], info: JSON.parse(params[3]) }); return [];
					}
					throw new Error(`Unexpected SQL: ${sql}`);
				},
				getRepository: () => ({ insert: async (data: any) => { if (options.failWarning) throw new Error('warning failed'); working.warnings.push(data); } }),
			};
			const result = await args.at(-1)(manager);
			state = working;
			return result;
		}),
	};
	const service = new RecordModerationService(db as never, role as never, { gen: () => `operation${++sequence}` } as never, { pack: async (row: unknown) => row } as never, { publishMainStream: stream } as never, { changed: () => {} } as never, { refreshSourceNotifications: async () => {} } as never);
	return { service, db, role, stream, state: () => state, request: async (patch: Partial<RecordModerationRequest> = {}): Promise<RecordModerationRequest> => {
		const preview = await service.preview(moderator, target);
		return { ...target, action: 'delete', requestId: 'request-1234567890', version: preview.version, reason: '本人の同意がない情報を含むため', warning: '利用ルールをご確認ください', ...patch };
	} };
}

describe('record moderation transaction', () => {
	test('real preview version can execute; target, staff, time and reason are preserved', async () => {
		const f = fixture(), request = await f.request();
		const result = await f.service.execute(moderator, request);
		expect(f.state().deleted).toBe(true);
		expect(f.state().logs.map(row => row.type)).toEqual(['deleteHatadyRecord', 'warnHatadyUser']);
		expect(f.state().logs[0].info).toMatchObject({ targetUsername: 'owner_name', moderatorUsername: 'mod_name', reason: request.reason, performedAt: result.performedAt });
		expect(f.state().warnings[0]).toMatchObject({ userId: 'owner', icon: 'warning', display: 'dialog', needConfirmationToRead: true });
		expect(f.state().warnings[0].text).not.toContain(request.reason);
		expect(f.stream).toHaveBeenCalledWith('owner', 'announcementCreated', expect.anything());
	});
	test.each([{ failLog: true }, { failWarning: true }])('rolls back deletion, audit and warning on failure: %j', async options => {
		const f = fixture(options), request = await f.request();
		await expect(f.service.execute(moderator, request)).rejects.toThrow();
		expect(f.state()).toEqual({ deleted: false, operations: [], logs: [], warnings: [] });
		expect(f.stream).not.toHaveBeenCalled();
	});
	test('response retry returns the same operation after target deletion without duplicate logs or warnings', async () => {
		const f = fixture(), request = await f.request();
		const first = await f.service.execute(moderator, request);
		expect(await f.service.execute(moderator, request)).toEqual(first);
		expect(f.state().logs).toHaveLength(2); expect(f.state().warnings).toHaveLength(1);
		await expect(f.service.execute(moderator, { ...request, reason: '別の理由' })).rejects.toMatchObject({ code: 'RECORD_MODERATION_CONFLICT' });
	});
	test('durable warning survives realtime failure without reporting a failed deletion', async () => {
		const f = fixture({ failStream: true });
		await expect(f.service.execute(moderator, await f.request())).resolves.toMatchObject({ action: 'delete' });
		expect(f.state().deleted).toBe(true); expect(f.state().warnings).toHaveLength(1);
	});
	test('warning only retains source; deletion without warning stores only the deletion log', async () => {
		const warn = fixture();
		await warn.service.execute(moderator, await warn.request({ action: 'warn' }));
		expect(warn.state().deleted).toBe(false); expect(warn.state().logs.map(row => row.type)).toEqual(['warnHatadyUser']);
		const remove = fixture();
		await remove.service.execute(moderator, await remove.request({ warning: null }));
		expect(remove.state().deleted).toBe(true); expect(remove.state().warnings).toHaveLength(0); expect(remove.state().logs).toHaveLength(1);
	});
	test('denies third party tokens and permission loss before any writes', async () => {
		const f = fixture(), request = await f.request();
		await expect(f.service.execute(moderator, request, {})).rejects.toMatchObject({ code: 'RECORD_MODERATION_ACCESS_DENIED' });
		f.role.isModerator.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		await expect(f.service.execute(moderator, request)).rejects.toMatchObject({ code: 'RECORD_MODERATION_ACCESS_DENIED' });
		expect(f.state().operations).toHaveLength(0); expect(f.state().deleted).toBe(false);
	});
	test('changed source version and blank reason are rejected with no mutation', async () => {
		const f = fixture(), request = await f.request();
		await expect(f.service.execute(moderator, { ...request, version: 'f'.repeat(64) })).rejects.toMatchObject({ code: 'RECORD_MODERATION_CONFLICT' });
		await expect(f.service.execute(moderator, { ...request, reason: '　\n ' })).rejects.toMatchObject({ code: 'INVALID_RECORD_MODERATION' });
		expect(f.state().operations).toHaveLength(0);
	});
	test('legacy book endpoint rejects old requests that omit mandatory audit fields', async () => {
		const f = fixture();
		await expect(new LegacyDeleteBook(f.service).exec({ bookId: 'book1' } as never, moderator, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(f.db.transaction).not.toHaveBeenCalled();
	});
	test('all administrative endpoints reject app and Flash tokens at the service boundary', async () => {
		const f = fixture(), input = await f.request();
		const endpoints = [
			[new PreviewEndpoint(f.service), target], [new HistoryEndpoint(f.service), target],
			[new ExecuteEndpoint(f.service), input],
			[new LegacyDeleteBook(f.service), { bookId: 'book1', requestId: input.requestId, version: input.version, reason: input.reason, warning: input.warning }],
		] as const;
		for (const [endpoint, params] of endpoints) {
			await expect(endpoint.exec(params as never, moderator, {} as never, null)).rejects.toMatchObject({ code: 'RECORD_MODERATION_ACCESS_DENIED' });
			await expect(endpoint.exec(params as never, moderator, null, {} as never)).rejects.toMatchObject({ code: 'RECORD_MODERATION_ACCESS_DENIED' });
		}
		expect(f.state().operations).toHaveLength(0);
	});
});
describe('Hatask record moderation locking', () => {
	const hataskTarget = { product: 'hatask', targetType: 'record', targetId: 'c'.repeat(64) } as const;

	function hataskFixture(options: { insertAfterRowLock?: boolean; collection?: 'todos' | 'gallery' } = {}) {
		const steps: string[] = [];
		let ownerLocked = false;
		const manager = {
			query: async (sql: string, params: any[] = []) => {
				if (sql.startsWith('SELECT pg_advisory')) {
					const key = String(params[0]).split(':').slice(0, 2).join(':');
					steps.push(`lock:${key}`);
					if (key === 'record-moderation:hatask') ownerLocked = true;
					return [];
				}
				if (sql.startsWith('WITH expanded')) return [{ userId: 'owner', key: options.collection ?? 'todos', entry_id: 'id:t1', data: {}, title: '予定', contentVersion: 'a'.repeat(64), revision: 0 }];
				if (sql.startsWith('SELECT to_jsonb')) return [];
				if (sql.startsWith('SELECT id,value,"updatedAt" FROM registry_item')) {
					if (sql.endsWith('FOR UPDATE')) steps.push('rows');
					const value = [{ id: 't1' }, ...(options.insertAfterRowLock && ownerLocked ? [{ id: 't1', copy: true }] : [])];
					return [{ id: 'reg1', value, updatedAt: new Date(0) }];
				}
				if (sql.startsWith('SELECT username,name')) return [{ username: params[0], name: '' }];
				if (sql.startsWith('SELECT * FROM record_moderation_operation')) return [];
				if (sql.startsWith('INSERT INTO')) return [];
				throw new Error(`Unexpected SQL: ${sql}`);
			},
			getRepository: () => ({ insert: async () => {} }),
		};
		const db = { getRepository: () => ({ findOneBy: async () => null }), transaction: async (...args: any[]) => args.at(-1)(manager) };
		const service = new RecordModerationService(db as never, { isModerator: async () => true } as never, { gen: () => 'operation1' } as never, { pack: async (row: unknown) => row } as never, { publishMainStream: () => {} } as never, { changed: () => {} } as never, { refreshSourceNotifications: async () => {} } as never);
		return { service, steps };
	}

	test.each(['todos', 'gallery'] as const)('%s takes planner, wallet, row, then owner locks, matching writers', async collection => {
		const f = hataskFixture({ collection });
		const { version } = await f.service.preview(moderator, hataskTarget);
		f.steps.length = 0;
		await f.service.execute(moderator, { ...hataskTarget, action: 'warn', requestId: 'request-1234567890', version, reason: '理由', warning: '警告' });
		const order = ['lock:hatask-planner:owner', 'lock:hatask-flower:owner', 'rows', 'lock:record-moderation:hatask', 'lock:hatask-review:' + hataskTarget.targetId];
		expect(f.steps.filter(step => order.includes(step))).toEqual(order);
	});

	test('a write that lands before the owner lock is reported as a conflict', async () => {
		const f = hataskFixture({ insertAfterRowLock: true });
		const { version } = await f.service.preview(moderator, hataskTarget);
		await expect(f.service.execute(moderator, { ...hataskTarget, action: 'warn', requestId: 'request-1234567890', version, reason: '理由', warning: '警告' })).rejects.toMatchObject({ code: 'RECORD_MODERATION_CONFLICT' });
	});
});
describe('record moderation validation and projection', () => {
	test.each([{ reason: '' }, { reason: ' '.repeat(4) }, { reason: 'a'.repeat(1001) }, { warning: '' }, { warning: 'a'.repeat(2001) }, { action: 'warn', warning: null }, { product: 'hatask', targetType: 'book' }])('rejects invalid input %j', patch => {
		expect(() => normalizeRecordModerationRequest({ ...target, requestId: 'request-1234567890', action: 'delete', version: 'a'.repeat(64), reason: '理由', warning: null, ...patch } as RecordModerationRequest)).toThrow();
	});
	test('fingerprints are canonical and Date changes are significant', () => {
		expect(recordModerationHash({ a: 1, b: 2 })).toBe(recordModerationHash({ b: 2, a: 1 }));
		expect(recordModerationHash(new Date(0))).not.toBe(recordModerationHash(new Date(1)));
	});
	test('only the new audit fields are exposed; existing operations remain redacted', () => {
		const info = { reason: '削除理由', targetUsername: 'owner', moderatorUsername: 'staff', performedAt: '2026-09-22T13:00:00.000Z', body: '非公開本文', warning: '警告本文', targetId: 'a'.repeat(64) };
		expect(projectModeratorLogInfo('deleteHataskRecord', info)).toEqual({ reason: info.reason, targetUsername: 'owner', moderatorUsername: 'staff', performedAt: info.performedAt, targetId: info.targetId });
		expect(projectModeratorLogInfo('deleteNote', { noteId: 'id', ...info })).toEqual({ noteId: 'id' });
		expect(projectModeratorLogInfo('deleteHataskRecord', { reason: 'a'.repeat(1001) })).not.toHaveProperty('reason');
	});
});
