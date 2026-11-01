/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FindOperator, IsNull, Not } from 'typeorm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import CleanupEndpoint, { meta, paramDef } from '@/server/api/endpoints/admin/cleanup-legacy-rejected-registrations.js';
import { MiRegistrationApplication } from '@/models/RegistrationApplication.js';

const now = new Date('2026-09-18T10:00:00.000Z');
const endpointName = 'admin/cleanup-legacy-rejected-registrations';
const endpointModule = './endpoints/admin/cleanup-legacy-rejected-registrations.js';
const privateSentinel = 'private-cleanup-sentinel';

function application(id: string, overrides: Partial<MiRegistrationApplication> = {}): MiRegistrationApplication {
	return Object.assign(new MiRegistrationApplication(), {
		id, status: 'rejected', username: `${privateSentinel}-${id}`, hashedPassword: `${privateSentinel}-hash`,
		email: `${privateSentinel}@example.test`, reason: privateSentinel, additionalContacts: null,
		personalDataDeletedAt: null, rejectedAt: new Date('2026-09-01T00:00:00.000Z'),
		reviewVersion: 4,
		reviewVotes: { moderator: {
			userId: 'moderator', name: null, username: 'moderator', choice: 'oppose', reason: privateSentinel,
			eligibilityKey: 'grant', votedAt: '2026-09-01T00:00:00.000Z',
		} },
		reviewDecision: {
			actor: { userId: 'root', name: null, username: 'root' }, at: '2026-09-01T00:00:00.000Z',
			voterIds: ['moderator'], voters: [{ userId: 'moderator', name: null, username: 'moderator', choice: 'oppose', votedAt: '2026-09-01T00:00:00.000Z' }],
		},
	}, overrides);
}

function matchesValue(actual: unknown, expected: unknown): boolean {
	if (!(expected instanceof FindOperator)) return actual === expected;
	if (expected.type === 'isNull') return actual == null;
	if (expected.type === 'not') return !matchesValue(actual, expected.child ?? expected.value);
	throw new Error(`Unsupported fixture operator: ${expected.type}`);
}

function matches(row: MiRegistrationApplication, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, value]) => matchesValue(row[key as keyof MiRegistrationApplication], value));
}

function fixture() {
	const serverMeta = { disableRegistration: true, registrationClosed: false };
	const records = [
		application('both'),
		application('usernameOnly', { hashedPassword: null }),
		application('hashOnly', { username: null, email: null }),
		application('cleaned', { username: null, hashedPassword: null, personalDataDeletedAt: new Date('2026-09-01T00:00:00.000Z') }),
		application('pending', { status: 'pending', additionalContacts: privateSentinel, reviewDecision: null }),
		application('approved', { status: 'approved' }),
	];
	let changes: Partial<MiRegistrationApplication> = {};
	let selectedIds: string[] = [];
	const query = {
		update: vi.fn(),
		set: vi.fn((patch: Partial<MiRegistrationApplication>) => { changes = patch; return query; }),
		whereInIds: vi.fn((ids: string[]) => { selectedIds = ids; return query; }),
		execute: vi.fn(async () => {
			const targets = records.filter(row => selectedIds.includes(row.id));
			for (const row of targets) Object.assign(row, structuredClone(changes));
			return { affected: targets.length };
		}),
	};
	query.update.mockReturnValue(query);
	const repository = {
		find: vi.fn(async ({ where }: { where: Record<string, unknown>[]; select: { id: boolean } }) =>
			records.filter(row => where.some(condition => matches(row, condition))).map(row => ({ id: row.id }))),
		count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => records.filter(row => matches(row, where)).length),
		createQueryBuilder: vi.fn().mockReturnValue(query),
	};
	const endpoint = new CleanupEndpoint(serverMeta as never, repository as never);
	const run = (params: Record<string, unknown> = {}) => endpoint.exec(params, { id: 'root' } as never, null, null);
	return { serverMeta, records, repository, query, run };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(now);
});
afterEach(() => { vi.useRealTimers(); });

describe('registration cleanup endpoint registration and metadata', () => {
	test('registers the actual cleanup module exactly once in the production endpoint list', () => {
		// Check the production export contract without importing every unrelated endpoint and its dependencies.
		const source = readFileSync(resolve(process.cwd(), 'src/server/api/endpoint-list.ts'), 'utf8');
		const assertRegistered = (input: string) => {
			const exports = Array.from(input.matchAll(/^export \* as ['"]([^'"]+)['"] from ['"]([^'"]+)['"];$/gm));
			const registered = exports.filter(match => match[1] === endpointName);
			expect(registered.map(match => match[2])).toEqual([endpointModule]);
		};
		assertRegistered(source);
		// Positive control: the detector recognizes the original missing-export regression.
		const withoutCleanup = source.split('\n').filter(line => !line.includes(endpointName)).join('\n');
		expect(() => { assertRegistered(withoutCleanup); }).toThrow();
		expect(meta).toMatchObject({
			requireCredential: true, requireModerator: true, requireAdmin: true, secure: true,
			kind: 'write:admin:cleanup-rejected-registrations', limit: { duration: 60000, max: 30 },
		});
	});

	test('declares summary-only output and makes omitted execute a dry run', () => {
		expect(paramDef.properties.execute).toEqual({ type: 'boolean', default: false });
		expect(paramDef.required).toEqual([]);
		expect(Object.keys(meta.res.properties).sort()).toEqual(['alreadyCleanedCount', 'cleanedCount', 'emailRetainedCount', 'executedAt']);
	});
});

describe('registration cleanup data handling', () => {
	test.each([{}, { execute: false }])('returns only counts without writing for dry run %j', async params => {
		const f = fixture();
		const before = structuredClone(f.records);
		expect(JSON.stringify(before)).toContain(privateSentinel);
		const result = await f.run(params);
		expect(result).toEqual({ cleanedCount: 3, alreadyCleanedCount: 1, emailRetainedCount: 3, executedAt: now.toISOString() });
		expect(JSON.stringify(result)).not.toContain(privateSentinel);
		expect(f.repository.find).toHaveBeenCalledWith({
			select: { id: true },
			where: [
				{ status: 'rejected', username: Not(IsNull()) },
				{ status: 'rejected', hashedPassword: Not(IsNull()) },
			],
		});
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(f.query.execute).not.toHaveBeenCalled();
		expect(f.records).toEqual(before);
	});

	test('clears only legacy rejected credentials and preserves email, status, and review history', async () => {
		const f = fixture();
		const before = structuredClone(f.records);
		const result = await f.run({ execute: true });
		expect(result).toEqual({ cleanedCount: 3, alreadyCleanedCount: 1, emailRetainedCount: 3, executedAt: now.toISOString() });
		expect(f.query.whereInIds).toHaveBeenCalledWith(['both', 'usernameOnly', 'hashOnly']);
		expect(f.query.set).toHaveBeenCalledWith({ username: null, hashedPassword: null, personalDataDeletedAt: now });
		expect(f.query.execute).toHaveBeenCalledOnce();
		expect(f.records).toEqual(before.map((row, index) => index < 3
			? { ...row, username: null, hashedPassword: null, personalDataDeletedAt: now }
			: row));
		expect(JSON.stringify(result)).not.toContain(privateSentinel);
	});

	test('reports affected rows rather than the earlier target count', async () => {
		const f = fixture();
		f.query.execute.mockResolvedValue({ affected: 1 });
		await expect(f.run({ execute: true })).resolves.toMatchObject({ cleanedCount: 1 });
		expect(f.query.whereInIds).toHaveBeenCalledWith(['both', 'usernameOnly', 'hashOnly']);
	});

	test('does not issue a write when only already-cleaned or non-rejected records remain', async () => {
		const f = fixture();
		f.records.splice(0, 3);
		const before = structuredClone(f.records);
		await expect(f.run({ execute: true })).resolves.toEqual({ cleanedCount: 0, alreadyCleanedCount: 1, emailRetainedCount: 1, executedAt: now.toISOString() });
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(f.records).toEqual(before);
	});

	test.each([
		{ disableRegistration: false, registrationClosed: false },
		{ disableRegistration: true, registrationClosed: true },
	])('rejects unavailable registration application mode before reading %j', async mode => {
		const f = fixture();
		Object.assign(f.serverMeta, mode);
		await expect(f.run({ execute: true })).rejects.toMatchObject({ code: 'REGISTRATION_APPLICATIONS_DISABLED' });
		expect(f.repository.find).not.toHaveBeenCalled();
		expect(f.repository.count).not.toHaveBeenCalled();
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});

	test('rechecks registration closure after reads and before deleting credentials', async () => {
		const f = fixture();
		const before = structuredClone(f.records);
		f.repository.count.mockImplementationOnce(async () => {
			f.serverMeta.registrationClosed = true;
			return 1;
		});
		await expect(f.run({ execute: true })).rejects.toMatchObject({ code: 'REGISTRATION_APPLICATIONS_DISABLED' });
		expect(f.repository.find).toHaveBeenCalledOnce();
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(f.records).toEqual(before);
	});

	test('rejects a string execute parameter without reading or writing', async () => {
		const f = fixture();
		await expect(f.run({ execute: 'true' })).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(f.repository.find).not.toHaveBeenCalled();
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});
});
