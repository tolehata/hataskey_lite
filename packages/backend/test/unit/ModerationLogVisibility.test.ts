/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { ModerationLogEntityService } from '@/core/entities/ModerationLogEntityService.js';
import { moderatorLogInfoSql, projectModeratorLogInfo } from '@/misc/moderation-log-visibility.js';
import ShowModerationLogsEndpoint, { meta } from '@/server/api/endpoints/admin/show-moderation-logs.js';

const privateValue = 'privateApplicant@example.test';
const privateSnapshot = {
	email: privateValue,
	smtpPass: 'privateSmtpPass',
	objectStorageSecretKey: 'privateStorageSecret',
	captchaSecret: 'privateCaptchaSecret',
	webhookSecret: 'privateWebhookSecret',
	invitations: [{ code: 'privateInvitationCode' }],
	before: { privateNested: privateValue },
	after: { note: privateValue, additionalContacts: privateValue },
};

function makeLog(type = 'suspend', info: Record<string, unknown> = { userId: 'targetA', ...privateSnapshot }) {
	return { id: 'log0000001', type, info, userId: 'actorA', user: null };
}

function entityFixture() {
	const actor = { id: 'actorA', username: 'moderator', host: null };
	const users = {
		pack: vi.fn().mockResolvedValue(actor),
		packMany: vi.fn().mockResolvedValue([actor]),
	};
	const service = new ModerationLogEntityService(
		{ findOneByOrFail: vi.fn().mockResolvedValue(makeLog()) } as never,
		users as never,
		{ parse: vi.fn().mockReturnValue({ date: new Date('2026-09-18T00:00:00Z') }) } as never,
	);
	return { service, users };
}

function endpointFixture({ administrator = false, moderator = true } = {}) {
	const { service, users: packedUsers } = entityFixture();
	const log = makeLog();
	const query = {
		andWhere: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		addSelect: vi.fn().mockReturnThis(),
		getMany: vi.fn().mockResolvedValue([log]),
		getRawMany: vi.fn().mockResolvedValue([{ ...log, info: { userId: 'targetA' } }]),
	};
	const repository = { createQueryBuilder: vi.fn().mockReturnValue(query) };
	const viewer = { userId: 'viewerA', username: 'viewer', name: 'viewer', isRoot: false, isAdministrator: administrator, eligibilityKey: 'grantA' };
	const staff = { getCurrentStaffMember: vi.fn().mockResolvedValue(moderator ? viewer : null) };
	const pagination = { makePaginationQuery: vi.fn().mockReturnValue(query) };
	const endpoint = new ShowModerationLogsEndpoint(repository as never, service, pagination as never, staff as never);
	const me = { id: 'viewerA' } as never;
	return { endpoint, query, repository, staff, viewer, pagination, packedUsers, me, log };
}

describe('moderator log payload allowlist', () => {
	test('positive control detects hidden values before projection, then exposes only the allowed target ID', () => {
		const log = makeLog();
		expect(JSON.stringify(log.info)).toContain(privateValue);
		expect(projectModeratorLogInfo(log.type, log.info)).toEqual({ userId: 'targetA' });
		expect(JSON.stringify(projectModeratorLogInfo(log.type, log.info))).not.toContain(privateValue);
		expect(log.info).toHaveProperty('before.privateNested', privateValue);
	});

	test.each(['updateServerSettings', 'createInvitation', 'futureUnknownEvent', '__proto__', 'constructor'])('%s exposes no payload, including plausible IDs and nested secrets', type => {
		expect(projectModeratorLogInfo(type, { applicationId: 'applicationA', userId: 'targetA', ...privateSnapshot })).toEqual({});
	});

	test.each(['approveRegistrationApplication', 'rejectRegistrationApplication'])('%s exposes only the application ID', type => {
		expect(projectModeratorLogInfo(type, {
			applicationId: 'applicationA', choice: 'oppose', reason: privateValue, username: privateValue, ...privateSnapshot,
		})).toEqual({ applicationId: 'applicationA' });
	});

	test.each(['agree', 'oppose'])('a registration vote exposes only the application ID and the allowed %s choice', choice => {
		expect(projectModeratorLogInfo('voteRegistrationApplication', { applicationId: 'applicationA', choice, reason: privateValue, ...privateSnapshot })).toEqual({ applicationId: 'applicationA', choice });
	});

	test.each([null, 1, true, {}, [], { value: 'agree' }, 'AGREE', 'unknown', privateValue].map(value => ({ value })))('a registration vote discards the malformed choice $value', ({ value: choice }) => {
		expect(projectModeratorLogInfo('voteRegistrationApplication', { applicationId: 'applicationA', choice })).toEqual({ applicationId: 'applicationA' });
	});

	test.each([null, true, 42, [], {}, { nested: 'targetA' }, '', 'a'.repeat(33), privateValue, 'targetA\n', 'target A', 'target_A'].map(value => ({ value })))('rejects unexpected ID value $value', ({ value: userId }) => {
		expect(projectModeratorLogInfo('suspend', { userId, ...privateSnapshot })).toEqual({});
	});

	test('retains the operation-specific IDs while rejecting an unrelated ID', () => {
		expect(projectModeratorLogInfo('assignRole', { userId: 'targetA', roleId: 'roleA', fileId: 'fileA', roleName: privateValue })).toEqual({ userId: 'targetA', roleId: 'roleA' });
		expect(projectModeratorLogInfo('deleteNote', { noteId: 'noteA', noteUserId: 'targetA', note: privateSnapshot })).toEqual({ noteId: 'noteA', noteUserId: 'targetA' });
	});

	test.each([null, [], privateValue, 42].map(value => ({ value })))('rejects malformed old payload $value', ({ value: info }) => {
		expect(projectModeratorLogInfo('suspend', info)).toEqual({});
	});

	test('ignores inherited payload values', () => {
		expect(projectModeratorLogInfo('suspend', Object.create({ userId: 'targetA' }))).toEqual({});
	});

	test('SQL projection has an empty default and does not stringify arbitrary payloads', () => {
		expect(moderatorLogInfoSql).toContain('ELSE \'{}\'::jsonb END');
		expect(moderatorLogInfoSql).toContain('jsonb_typeof("log"."info"->\'userId\') = \'string\'');
		expect(moderatorLogInfoSql).toContain('char_length("log"."info"->>\'userId\') BETWEEN 1 AND 32');
		expect(moderatorLogInfoSql).toContain('!~ \'[^a-zA-Z0-9]\'');
		expect(moderatorLogInfoSql).toContain('jsonb_typeof("log"."info"->\'choice\') = \'string\'');
		expect(moderatorLogInfoSql).toContain('"log"."info"->>\'choice\' IN (\'agree\', \'oppose\')');
		for (const key of ['email', 'before', 'after', 'invitations', 'smtpPass', 'note', 'additionalContacts']) {
			expect(moderatorLogInfoSql).not.toContain(`->'${key}'`);
			expect(moderatorLogInfoSql).not.toContain(`->>'${key}'`);
		}
		// Mandatory reasons are visible only for the four record moderation operations.
		const existingOperations = moderatorLogInfoSql.slice(moderatorLogInfoSql.indexOf("WHEN 'suspend'"));
		expect(existingOperations).toContain("WHEN 'suspend'");
		expect(existingOperations).not.toContain("->'reason'");
		expect(existingOperations).not.toContain("->>'reason'");
		expect(moderatorLogInfoSql).toContain("char_length(\"log\".\"info\"->>'reason') BETWEEN 1 AND 1000");
	});

	test('hidden-only changes do not affect projected search matches, ordering or page boundaries', () => {
		const makeRows = (secret: string) => [
			{ ...makeLog('suspend', { userId: 'targetA', before: secret }), id: '3' },
			{ ...makeLog('createInvitation', { invitations: [{ code: secret }] }), id: '2' },
			{ ...makeLog('suspend', { userId: 'targetB', before: secret }), id: '1' },
		];
		// Model search over the SELECT projection. Endpoint tests below separately
		// require that PostgreSQL WHERE uses exactly that projection before LIMIT.
		const page = (rows: ReturnType<typeof makeRows>, search: string, offset = 0) => rows
			.filter(log => JSON.stringify(projectModeratorLogInfo(log.type, log.info)).toLowerCase().includes(search.toLowerCase()))
			.map(log => log.id).slice(offset, offset + 1);
		const original = makeRows(privateValue);
		const changed = makeRows('changedPrivateSecret');
		expect(original.filter(log => JSON.stringify(log.info).includes(privateValue))).toHaveLength(3);
		expect(changed.filter(log => JSON.stringify(log.info).includes(privateValue))).toHaveLength(0);
		for (const search of ['target', 'targetA', privateValue, 'changedPrivateSecret']) {
			expect(page(original, search)).toEqual(page(changed, search));
			expect(page(original, search, 1)).toEqual(page(changed, search, 1));
		}
		expect(page(original, 'target')).toEqual(['3']);
		expect(page(original, 'target', 1)).toEqual(['1']);
		expect(page(original, privateValue)).toEqual([]);
	});
});

describe('moderation log entity visibility', () => {
	test('defaults to redacted packing and a public actor summary', async () => {
		const { service, users } = entityFixture();
		const packed = await service.pack(makeLog());
		expect(packed).toMatchObject({ isRedacted: true, info: { userId: 'targetA' }, userId: 'actorA' });
		expect(JSON.stringify(packed)).not.toContain(privateValue);
		expect(users.pack).toHaveBeenCalledWith('actorA', null, { schema: 'UserLite' });
	});

	test('bulk packing preserves moderator redaction and avoids detailed actor profiles', async () => {
		const { service, users } = entityFixture();
		const packed = await service.packMany([makeLog('updateServerSettings', privateSnapshot)]);
		expect(packed[0]).toMatchObject({ isRedacted: true, info: {} });
		expect(users.packMany).toHaveBeenCalledWith(['actorA'], null, { schema: 'UserLite' });
		expect(users.pack).not.toHaveBeenCalled();
	});

	test('explicit administrator access preserves the existing full payload and actor schema', async () => {
		const { service, users } = entityFixture();
		const log = makeLog('updateServerSettings', privateSnapshot);
		const packed = await service.packMany([log], { isAdministrator: true });
		expect(packed[0]).toMatchObject({ isRedacted: false, info: privateSnapshot });
		expect(packed[0].info).toStrictEqual(log.info);
		expect(JSON.stringify(packed)).toContain(privateValue);
		expect(users.packMany).toHaveBeenCalledWith(['actorA'], null, { schema: 'UserDetailedNotMe' });
	});
});

describe('moderation log endpoint authorization and query boundary', () => {
	test('requires authenticated moderator credentials and rejects third-party/Flash tokens at the API gate', () => {
		expect(meta).toMatchObject({ requireCredential: true, requireModerator: true, secure: true, kind: 'read:admin:show-moderation-log' });
	});

	test('denies a viewer without current staff eligibility before log retrieval', async () => {
		const f = endpointFixture({ moderator: false });
		await expect(f.endpoint.exec({}, f.me, null, null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
		expect(f.staff.getCurrentStaffMember).toHaveBeenCalledWith('viewerA');
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('denies a missing/deleted viewer record before log retrieval', async () => {
		const f = endpointFixture();
		f.staff.getCurrentStaffMember.mockResolvedValue(null);
		await expect(f.endpoint.exec({}, f.me, null, null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test.each(['anonymous', 'app', 'flash'])('defensively denies %s in the handler as well', async kind => {
		const f = endpointFixture({ administrator: true });
		await expect(f.endpoint.exec({}, kind === 'anonymous' ? null as never : f.me, kind === 'app' ? {} as never : null, kind === 'flash' ? {} as never : null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('uses the same safe SQL projection for selection and search before pagination', async () => {
		const f = endpointFixture();
		const response = await f.endpoint.exec({ search: 'targetA', limit: 1, userId: 'actorA', type: 'suspend', untilId: 'logZ' }, f.me, null, null);
		expect(f.query.select).toHaveBeenCalledWith('log.id', 'id');
		expect(f.query.addSelect).toHaveBeenCalledWith(moderatorLogInfoSql, 'info');
		expect(f.query.andWhere).toHaveBeenCalledWith(`${moderatorLogInfoSql}::text ILIKE :search`, { search: '%targetA%' });
		expect(f.query.andWhere).toHaveBeenCalledWith('log.type = :type', { type: 'suspend' });
		expect(f.query.andWhere).toHaveBeenCalledWith('log.userId = :userId', { userId: 'actorA' });
		expect(f.query.andWhere.mock.invocationCallOrder.at(-1)).toBeLessThan(f.query.limit.mock.invocationCallOrder[0]);
		expect(f.query.limit).toHaveBeenCalledWith(1);
		expect(f.query.getMany).not.toHaveBeenCalled();
		expect(f.query.getRawMany).toHaveBeenCalledOnce();
		expect(response[0]).toMatchObject({ isRedacted: true, info: { userId: 'targetA' } });
		expect(f.pagination.makePaginationQuery).toHaveBeenCalledWith(f.query, undefined, 'logZ', undefined, undefined);
	});

	test('escapes search wildcards while keeping hidden values out of the searchable SQL', async () => {
		const f = endpointFixture();
		await f.endpoint.exec({ search: '%_\\' }, f.me, null, null);
		expect(f.query.andWhere).toHaveBeenCalledWith(`${moderatorLogInfoSql}::text ILIKE :search`, { search: '%\\%\\_\\\\%' });
	});

	test.each([false, true])('filters application history using only projected application IDs (administrator: %s)', async administrator => {
		const f = endpointFixture({ administrator });
		await f.endpoint.exec({ applicationId: 'applicationA' }, f.me, null, null);
		expect(f.query.andWhere).toHaveBeenCalledWith(`${moderatorLogInfoSql}->>'applicationId' = :applicationId`, { applicationId: 'applicationA' });
		expect(f.query.andWhere.mock.invocationCallOrder[0]).toBeLessThan(f.query.limit.mock.invocationCallOrder[0]);
	});

	test.each(['invalid@example.test', 'a'.repeat(33), 'applicationA\' OR TRUE'])('rejects malformed application ID %s before lookup', async applicationId => {
		const f = endpointFixture();
		await expect(f.endpoint.exec({ applicationId }, f.me, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('positive control: administrator queries still search and return the full payload', async () => {
		const f = endpointFixture({ administrator: true });
		const result = await f.endpoint.exec({ search: privateValue }, f.me, null, null);
		expect(f.query.andWhere).toHaveBeenCalledWith('log.info::text ILIKE :search', { search: `%${privateValue}%` });
		expect(f.query.getMany).toHaveBeenCalledOnce();
		expect(f.query.getRawMany).not.toHaveBeenCalled();
		expect(result[0]).toMatchObject({ isRedacted: false, info: f.log.info });
		expect(JSON.stringify(result)).toContain(privateValue);
	});

	test('fails closed if moderator role lookup fails', async () => {
		const f = endpointFixture();
		f.staff.getCurrentStaffMember.mockRejectedValue(new Error('role lookup failed'));
		await expect(f.endpoint.exec({}, f.me, null, null)).rejects.toThrow('role lookup failed');
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('does not return data after moderator access is revoked during loading', async () => {
		const f = endpointFixture();
		f.staff.getCurrentStaffMember.mockResolvedValueOnce(f.viewer).mockResolvedValue(null);
		await expect(f.endpoint.exec({}, f.me, null, null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
		expect(f.query.getRawMany).toHaveBeenCalledOnce();
	});

	test('does not return administrator payloads after demotion to moderator during loading', async () => {
		const f = endpointFixture({ administrator: true });
		f.staff.getCurrentStaffMember.mockResolvedValueOnce(f.viewer).mockResolvedValue({ ...f.viewer, isAdministrator: false });
		await expect(f.endpoint.exec({}, f.me, null, null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
		expect(f.query.getMany).toHaveBeenCalledOnce();
	});

	test('does not return data after the account is suspended during loading', async () => {
		const f = endpointFixture();
		f.staff.getCurrentStaffMember.mockResolvedValueOnce(f.viewer).mockResolvedValue(null);
		await expect(f.endpoint.exec({}, f.me, null, null)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
	});
});
