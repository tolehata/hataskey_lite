/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { DataSource, EntitySchema } from 'typeorm';
import ApplyEndpoint, { meta as applyMeta } from '@/server/api/endpoints/registration/apply.js';
import ListEndpoint from '@/server/api/endpoints/admin/registration-applications.js';
import ApproveEndpoint from '@/server/api/endpoints/admin/approve-registration.js';
import RejectEndpoint from '@/server/api/endpoints/admin/reject-registration.js';
import CleanupEndpoint from '@/server/api/endpoints/admin/cleanup-legacy-rejected-registrations.js';
import { SignupService } from '@/core/SignupService.js';
import { MiUser } from '@/models/User.js';
import { MiUsedUsername } from '@/models/UsedUsername.js';
import AvailableEndpoint from '@/server/api/endpoints/username/available.js';
import { PreserveRegistrationUsernameCase1788700000000 } from '../../migration/1788700000000-preserve-registration-username-case.js';

vi.mock('bcryptjs', () => ({ default: { genSalt: vi.fn(), hash: vi.fn() } }));
vi.mock('node:crypto', async importOriginal => ({
	...await importOriginal<typeof import('node:crypto')>(),
	generateKeyPair: vi.fn((_algorithm, _options, callback) => callback(null, 'public-key', 'private-key')),
}));

const disabled = { code: 'REGISTRATION_APPLICATIONS_DISABLED' };
const reviewRevision = 'a'.repeat(64);
const applicant = { username: 'Applicant', password: 'password123', reason: '参加したいです', email: 'applicant@example.test' };

// Generate real PostgreSQL predicates without connecting to a database.
class QueryOnlyDataSource extends DataSource {
	async prepareMetadata(): Promise<void> { await this.buildMetadatas(); }
}
const applicationSchema = new EntitySchema({
	name: 'RegistrationApplicationQuery', tableName: 'registration_application',
	columns: { id: { type: String, primary: true }, username: { type: String, nullable: true }, status: { type: String } },
});
const queryDb = new QueryOnlyDataSource({ type: 'postgres', entities: [applicationSchema] });
beforeAll(() => queryDb.prepareMetadata());

function fixture(enabled: unknown = true) {
	const serverMeta = { registrationClosed: false, disableRegistration: enabled, preservedUsernames: [], rootUserId: 'admin', name: 'test', prohibitedWordsForNameOfUser: [] };
	const application = { id: 'app1', username: 'applicant', hashedPassword: 'hash', reason: '参加したいです', email: 'applicant@example.test', status: 'pending', createdAt: new Date('2026-08-01T00:00:00Z'), personalDataDeletedAt: null, rejectedAt: null };
	const query = { update: vi.fn(), set: vi.fn(), whereInIds: vi.fn(), execute: vi.fn().mockResolvedValue({ affected: 1 }) };
	query.update.mockReturnValue(query);
	query.set.mockReturnValue(query);
	query.whereInIds.mockReturnValue(query);
	const repository = {
		exists: vi.fn().mockResolvedValue(false), insert: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({ affected: 1 }),
		find: vi.fn().mockResolvedValue([application]), findOneBy: vi.fn().mockResolvedValue(application), count: vi.fn().mockResolvedValue(1),
		createQueryBuilder: vi.fn().mockReturnValue(query),
	};
	const users = { exists: vi.fn().mockResolvedValue(false) };
	const usedNames = { exists: vi.fn().mockResolvedValue(false) };
	const profiles = { update: vi.fn().mockResolvedValue({}) };
	const signup = { signup: vi.fn().mockResolvedValue({ account: { id: 'user1', username: 'applicant' }, applicationEmail: applicant.email }) };
	const mail = { sendTemplateEmail: vi.fn().mockResolvedValue(undefined) };
	const notification = { notifyNewApplication: vi.fn().mockResolvedValue(undefined) };
	const captcha = { verifyTestcaptcha: vi.fn().mockResolvedValue(undefined) };
	const id = { gen: vi.fn().mockReturnValue('newapp') };
	const decisionTransaction = { findOne: vi.fn().mockResolvedValue(application), update: vi.fn().mockResolvedValue({ affected: 1 }) };
	const decisionDb = { transaction: vi.fn(async callback => callback(decisionTransaction)) };
	const reviewer = { userId: 'admin', name: null, username: 'admin', isRoot: true, isAdministrator: true, eligibilityKey: 'fixture-root' };
	const review = {
		assertStaff: vi.fn().mockResolvedValue(reviewer),
		getCurrentStaff: vi.fn().mockResolvedValue([reviewer]),
		packReview: vi.fn().mockReturnValue({ revision: reviewRevision, voters: [] }),
		assertRoot: vi.fn().mockResolvedValue(undefined),
		lockReview: vi.fn().mockResolvedValue({ application }),
		assertUnanimous: vi.fn(),
		recordDecision: vi.fn().mockResolvedValue(undefined),
	};
	const apply = new ApplyEndpoint(serverMeta as never, repository as never, users as never, usedNames as never, id as never, captcha as never, notification as never);
	const list = new ListEndpoint(serverMeta as never, repository as never, review as never);
	const approve = new ApproveEndpoint({ url: 'https://example.test' } as never, serverMeta as never, signup as never, mail as never);
	const reject = new RejectEndpoint(serverMeta as never, decisionDb as never, review as never, { send: vi.fn().mockResolvedValue({ emailSent: false, notificationStatus: 'failed' }) } as never);
	const cleanup = new CleanupEndpoint(serverMeta as never, repository as never);
	return { review, serverMeta, application, repository, users, usedNames, profiles, signup, mail, notification, captcha, query, apply, list, approve, reject, cleanup, decisionTransaction, decisionDb };
}

function signupFixture(enabled: boolean) {
	const f = fixture(enabled);
	const persisted: unknown[] = [];
	const transactionUsers = { exists: vi.fn().mockResolvedValue(false) };
	const transactionUsedNames = { exists: vi.fn().mockResolvedValue(false) };
	const transaction = {
		getRepository: vi.fn(entity => entity === MiUser ? transactionUsers : transactionUsedNames),
		findOne: vi.fn().mockResolvedValue(f.application),
		findOneBy: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue({ affected: 1 }),
		save: vi.fn(async (entity: unknown) => { persisted.push(entity); return entity; }),
		query: vi.fn().mockResolvedValue([]),
	};
	let commits = 0;
	let rollbacks = 0;
	const db = { transaction: vi.fn(async (callback: (manager: typeof transaction) => Promise<void>) => {
		try { await callback(transaction); commits++; } catch (error) { persisted.length = 0; rollbacks++; throw error; }
	}) };
	const usersChart = { update: vi.fn() };
	const userService = { notifySystemWebhook: vi.fn() };
	const utility = { isKeyWordIncluded: vi.fn().mockReturnValue(false), toPunyNullable: vi.fn().mockReturnValue(null) };
	const userEntity = { validateLocalUsername: vi.fn().mockReturnValue(true), validatePassword: vi.fn().mockReturnValue(true) };
	const service = new SignupService(db as never, f.serverMeta as never, f.users as never, f.usedNames as never, utility as never, userService as never, userEntity as never, { gen: () => 'user1' } as never, {} as never, {} as never, usersChart as never, f.review as never);
	return { ...f, service, transaction, db, persisted, usersChart, userService, get commits() { return commits; }, get rollbacks() { return rollbacks; } };
}

beforeEach(() => {
	vi.mocked(bcrypt.genSalt).mockResolvedValue('salt' as never);
	vi.mocked(bcrypt.hash).mockResolvedValue('hash' as never);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('registration application mode', () => {
	test('complete closure rejects applications and approval while preserving pending data', async () => {
		const f = fixture();
		f.serverMeta.registrationClosed = true;
		await expect(f.apply.exec({ ...applicant }, null, null, null)).rejects.toMatchObject(disabled);
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, null, null, null)).rejects.toMatchObject(disabled);
		expect(f.repository.insert).not.toHaveBeenCalled();
		expect(f.signup.signup).not.toHaveBeenCalled();
		expect(f.application.status).toBe('pending');
	});

	test.each([true, false])('complete closure blocks normal signup in either previous mode (%s)', async enabled => {
		const f = signupFixture(enabled);
		f.serverMeta.registrationClosed = true;
		await expect(f.service.signup({ username: 'applicant', passwordHash: 'hash' })).rejects.toThrow('REGISTRATION_CLOSED');
		expect(f.db.transaction).not.toHaveBeenCalled();
		f.serverMeta.registrationClosed = false;
		await expect(f.service.signup({ username: 'applicant', passwordHash: 'hash' })).resolves.toMatchObject({ account: { id: 'user1' } });
	});

	test('closing during account writes rolls back and suppresses creation events', async () => {
		const f = signupFixture(true);
		f.transaction.save.mockImplementation(async (entity: unknown) => { f.persisted.push(entity); f.serverMeta.registrationClosed = true; return entity; });
		await expect(f.service.signup({ username: 'applicant', passwordHash: 'hash' })).rejects.toThrow('REGISTRATION_CLOSED');
		expect(f.rollbacks).toBe(1);
		expect(f.persisted).toHaveLength(0);
		expect(f.usersChart.update).not.toHaveBeenCalled();
	});

	test.each(['pending', 'rejected'])('case-insensitive reservation blocks a %s application using a literal ID', async status => {
		const f = fixture();
		f.repository.exists.mockResolvedValueOnce(true);
		await expect(f.apply.exec({ ...applicant, username: 'HaTa_Test' }, null, null, null)).rejects.toMatchObject({ code: 'USERNAME_ALREADY_EXISTS' });
		const { where } = f.repository.exists.mock.calls[0][0];
		const condition = where.find(item => item.status === status);
		expect(condition).toBeDefined();
		const [sql, params] = queryDb.getRepository(applicationSchema).createQueryBuilder('application').where(condition).getQueryAndParameters();
		expect(sql).toContain('LOWER("application"."username") = $1');
		expect(params).toEqual(['hata_test', status]);
		expect(f.repository.insert).not.toHaveBeenCalled();
	});

	test.each([0, 1])('availability uses the same case-insensitive reservation predicate (matches=%s)', async matches => {
		const f = fixture();
		f.repository.count.mockResolvedValue(matches);
		const users = { countBy: vi.fn().mockResolvedValue(0) };
		const used = { countBy: vi.fn().mockResolvedValue(0) };
		const endpoint = new AvailableEndpoint(f.serverMeta as never, users as never, used as never, f.repository as never);
		await expect(endpoint.exec({ username: 'HaTa_Test' }, null, null, null)).resolves.toEqual({ available: matches === 0 });
		const { where } = f.repository.count.mock.calls[0][0];
		for (const status of ['pending', 'rejected']) {
			const condition = where.find(item => item.status === status);
			expect(condition).toBeDefined();
			const [sql, params] = queryDb.getRepository(applicationSchema).createQueryBuilder('application').where(condition).getQueryAndParameters();
			expect(sql).toContain('LOWER("application"."username") = $1');
			expect(params).toEqual(['hata_test', status]);
		}
		expect(users.countBy).toHaveBeenCalledWith(expect.objectContaining({ usernameLower: 'hata_test' }));
		expect(used.countBy).toHaveBeenCalledWith({ username: 'hata_test' });
	});

	test.each(['existing', 'used', 'preserved'])('mixed-case application still rejects a %s ID', async kind => {
		const f = fixture();
		if (kind === 'existing') f.users.exists.mockResolvedValue(true);
		if (kind === 'used') f.usedNames.exists.mockResolvedValue(true);
		if (kind === 'preserved') Object.assign(f.serverMeta, { preservedUsernames: ['aPpLiCaNt'] });
		await expect(f.apply.exec({ ...applicant }, null, null, null)).rejects.toMatchObject({ code: 'USERNAME_ALREADY_EXISTS' });
		expect(f.repository.insert).not.toHaveBeenCalled();
	});

	test('migration replaces the reservation index with a case-insensitive unique index before dropping the old one', async () => {
		const query = vi.fn().mockResolvedValue(undefined);
		await new PreserveRegistrationUsernameCase1788700000000().up({ query });
		expect(query.mock.calls.map(call => call[0])).toEqual([
			'CREATE UNIQUE INDEX "IDX_reg_app_username_lower_pending" ON "registration_application" (LOWER("username")) WHERE "status" = \'pending\'',
			'DROP INDEX "IDX_reg_app_username_pending"',
		]);
	});

	test.each([false, undefined, null, 'true'])('apply fails closed for %s before captcha, hashing or repository access', async enabled => {
		const f = fixture(enabled);
		// fixture default is deliberately overwritten for the missing-value case.
		f.serverMeta.disableRegistration = enabled;
		vi.stubEnv('NODE_ENV', 'production');
		Object.assign(f.serverMeta, { enableTestcaptcha: true });
		await expect(f.apply.exec({ ...applicant }, null, null, null)).rejects.toMatchObject(disabled);
		expect(f.captcha.verifyTestcaptcha).not.toHaveBeenCalled();
		expect(bcrypt.genSalt).not.toHaveBeenCalled();
		expect(bcrypt.hash).not.toHaveBeenCalled();
		expect(f.users.exists).not.toHaveBeenCalled();
		expect(f.repository.insert).not.toHaveBeenCalled();
	});

	test('ON is a positive control: validates, hashes and saves a pending application', async () => {
		const f = fixture();
		await expect(f.apply.exec({ ...applicant }, null, null, null)).resolves.toEqual({ success: true });
		expect(bcrypt.hash).toHaveBeenCalledWith(applicant.password, 'salt');
		expect(f.repository.insert).toHaveBeenCalledWith(expect.objectContaining({ username: 'Applicant', hashedPassword: 'hash', status: 'pending', email: applicant.email }));
		expect(applyMeta.limit).toEqual({ duration: 3600000, max: 2 });
	});

	test('OFF while captcha awaits stops before duplicate checks and hashing', async () => {
		const f = fixture();
		vi.stubEnv('NODE_ENV', 'production');
		Object.assign(f.serverMeta, { enableTestcaptcha: true });
		f.captcha.verifyTestcaptcha.mockImplementation(async () => { f.serverMeta.disableRegistration = false; });
		await expect(f.apply.exec({ ...applicant }, null, null, null)).rejects.toMatchObject(disabled);
		expect(f.captcha.verifyTestcaptcha).toHaveBeenCalledOnce();
		expect(f.users.exists).not.toHaveBeenCalled();
		expect(bcrypt.hash).not.toHaveBeenCalled();
	});

	test('OFF during duplicate checks stops before hashing', async () => {
		const f = fixture();
		f.repository.exists.mockImplementation(async () => { f.serverMeta.disableRegistration = false; return false; });
		await expect(f.apply.exec({ ...applicant }, null, null, null)).rejects.toMatchObject(disabled);
		expect(bcrypt.genSalt).not.toHaveBeenCalled();
		expect(f.repository.insert).not.toHaveBeenCalled();
	});

	test('OFF while password hashing awaits stops before inserting', async () => {
		const f = fixture();
		vi.mocked(bcrypt.hash).mockImplementation(async () => { f.serverMeta.disableRegistration = false; return 'hash'; });
		await expect(f.apply.exec({ ...applicant }, null, null, null)).rejects.toMatchObject(disabled);
		expect(bcrypt.hash).toHaveBeenCalledOnce();
		expect(f.repository.insert).not.toHaveBeenCalled();
	});

	test.each(['list', 'approve', 'reject', 'cleanup'] as const)('OFF blocks admin %s before fetching or mutating saved applications', async key => {
		const f = fixture(false);
		await expect(f[key].exec({ applicationId: 'app1', revision: reviewRevision, execute: true }, { id: 'admin' } as never, null, null)).rejects.toMatchObject(disabled);
		expect(f.repository.find).not.toHaveBeenCalled();
		expect(f.repository.findOneBy).not.toHaveBeenCalled();
		expect(f.repository.update).not.toHaveBeenCalled();
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(f.signup.signup).not.toHaveBeenCalled();
		expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
	});

	test('ON lists applications without exposing password hashes; OFF during the read discards its result', async () => {
		const f = fixture();
		const result = await f.list.exec({}, { id: 'admin' } as never, null, null);
		expect(result).toEqual([expect.objectContaining({ id: 'app1', username: 'applicant' })]);
		expect(result[0]).not.toHaveProperty('hashedPassword');
		f.repository.find.mockImplementation(async () => { f.serverMeta.disableRegistration = false; return [f.application]; });
		await expect(f.list.exec({}, { id: 'admin' } as never, null, null)).rejects.toMatchObject(disabled);
	});

	test('OFF during the final staff refresh discards an already fetched application list', async () => {
		const f = fixture();
		const staff = await f.review.getCurrentStaff();
		f.review.getCurrentStaff.mockImplementation(async () => { f.serverMeta.disableRegistration = false; return staff; });
		await expect(f.list.exec({}, { id: 'admin' } as never, null, null)).rejects.toMatchObject(disabled);
	});

	test('approval sends the structured template input with the approved username', async () => {
		const f = fixture();
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, { id: 'admin' } as never, null, null)).resolves.toEqual({ success: true, emailSent: true });
		expect(f.mail.sendTemplateEmail).toHaveBeenCalledWith(applicant.email, { kind: 'registration-approved', username: 'applicant' });
	});

	test('ON approval delegates the atomic decision to signup and sends mail only afterwards', async () => {
		const f = fixture();
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, { id: 'admin' } as never, null, null)).resolves.toEqual({ success: true, emailSent: true });
		expect(f.signup.signup).toHaveBeenCalledWith({ registrationApplicationId: 'app1', reviewerId: 'admin', revision: reviewRevision });
		expect(f.profiles.update).not.toHaveBeenCalled();
		expect(f.repository.update).not.toHaveBeenCalled();
		expect(f.mail.sendTemplateEmail).toHaveBeenCalledOnce();
	});

	test('OFF during rejection lookup preserves pending application and avoids side effects', async () => {
		const f = fixture();
		f.decisionTransaction.findOne.mockImplementation(async () => { f.serverMeta.disableRegistration = false; return f.application; });
		await expect(f.reject.exec({ applicationId: 'app1', revision: reviewRevision }, { id: 'admin' } as never, null, null)).rejects.toMatchObject(disabled);
		expect(f.application.status).toBe('pending');
		expect(f.repository.update).not.toHaveBeenCalled();
		expect(f.decisionTransaction.update).not.toHaveBeenCalled();
		expect(f.signup.signup).not.toHaveBeenCalled();
		expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
	});

	test('ON rejection keeps existing privacy behavior and retained email', async () => {
		const f = fixture();
		await expect(f.reject.exec({ applicationId: 'app1', revision: reviewRevision }, { id: 'admin' } as never, null, null)).resolves.toEqual({ success: true, emailSent: false, notificationStatus: 'failed' });
		const changes = f.decisionTransaction.update.mock.calls[0][2];
		expect(changes).toMatchObject({ status: 'rejected', username: null, hashedPassword: null, additionalContacts: null });
		expect(changes).not.toHaveProperty('email');
	});

	test.each([false, true])('ON manual cleanup supports execute=%s while OFF during reads never executes it', async execute => {
		const f = fixture();
		await expect(f.cleanup.exec({ execute }, { id: 'admin' } as never, null, null)).resolves.toMatchObject({ cleanedCount: 1 });
		expect(f.query.execute).toHaveBeenCalledTimes(execute ? 1 : 0);
		f.query.execute.mockClear();
		f.repository.count.mockImplementation(async () => { f.serverMeta.disableRegistration = false; return 1; });
		await expect(f.cleanup.exec({ execute }, { id: 'admin' } as never, null, null)).rejects.toMatchObject(disabled);
		expect(f.query.execute).not.toHaveBeenCalled();
	});

	test('cleanup dry-run reports all planned records without mutating or deleting them', async () => {
		const f = fixture();
		const targets = [
			{ ...f.application, status: 'rejected' },
			{ ...f.application, id: 'app2', status: 'rejected', hashedPassword: null },
		];
		const before = JSON.stringify(targets);
		f.repository.find.mockResolvedValue(targets as never);
		await expect(f.cleanup.exec({ execute: false }, { id: 'admin' } as never, null, null)).resolves.toMatchObject({
			cleanedCount: 2, alreadyCleanedCount: 1, emailRetainedCount: 1,
		});
		expect(JSON.stringify(targets)).toBe(before);
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(f.repository.update).not.toHaveBeenCalled();
		expect(f.query.execute).not.toHaveBeenCalled();
	});

	test.each([0, 1])('cleanup execution reports the actual affected count %s rather than the planned count', async affected => {
		const f = fixture();
		f.repository.find.mockResolvedValue([
			{ ...f.application, status: 'rejected' },
			{ ...f.application, id: 'app2', status: 'rejected' },
		]);
		f.query.execute.mockResolvedValue({ affected });
		await expect(f.cleanup.exec({ execute: true }, { id: 'admin' } as never, null, null)).resolves.toMatchObject({ cleanedCount: affected });
		expect(f.query.whereInIds).toHaveBeenCalledWith(['app1', 'app2']);
		expect(f.query.execute).toHaveBeenCalledOnce();
		expect(f.query.set).toHaveBeenCalledWith({ username: null, hashedPassword: null, personalDataDeletedAt: expect.any(Date) });
	});

	test.each([false, true])('cleanup with no targets reports zero without writing for execute=%s', async execute => {
		const f = fixture();
		f.repository.find.mockResolvedValue([]);
		await expect(f.cleanup.exec({ execute }, { id: 'admin' } as never, null, null)).resolves.toMatchObject({ cleanedCount: 0 });
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(f.query.execute).not.toHaveBeenCalled();
	});

	test('OFF also blocks cleanup dry-run before reading retained applicant data', async () => {
		const f = fixture(false);
		await expect(f.cleanup.exec({ execute: false }, { id: 'admin' } as never, null, null)).rejects.toMatchObject(disabled);
		expect(f.repository.find).not.toHaveBeenCalled();
		expect(f.repository.count).not.toHaveBeenCalled();
		expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
	});
});

describe('SignupService application-only guard', () => {
	test('application approval preserves requested spelling and reserves the lowercase ID', async () => {
		const f = signupFixture(true);
		await f.apply.exec({ ...applicant, username: 'HaTa_Test' }, null, null, null);
		const saved = f.repository.insert.mock.calls[0][0];
		Object.assign(f.application, saved);
		const { account } = await f.service.signup({ registrationApplicationId: f.application.id, reviewerId: 'admin', revision: reviewRevision });
		expect(account).toMatchObject({ username: 'HaTa_Test', usernameLower: 'hata_test' });
		expect(f.persisted.find(entity => entity instanceof MiUsedUsername)).toMatchObject({ username: 'hata_test' });
		expect(f.transaction.findOneBy).toHaveBeenCalledWith(MiUser, expect.objectContaining({ usernameLower: 'hata_test' }));
		// 上流 2026.10.1: 同じユーザー名の並行サインアップは、重複チェックの前に advisory lock で直列化する。
		expect(f.transaction.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', ['signup:username:hata_test']);
		expect(f.transaction.query.mock.invocationCallOrder[0]).toBeLessThan(f.transaction.findOneBy.mock.invocationCallOrder[0]);
	});

	test('direct application signup is blocked in OFF mode before account work', async () => {
		const f = signupFixture(false);
		await expect(f.service.signup({ registrationApplicationId: 'app1', reviewerId: 'admin', revision: reviewRevision })).rejects.toMatchObject(disabled);
		expect(f.users.exists).not.toHaveBeenCalled();
		expect(f.db.transaction).not.toHaveBeenCalled();
	});

	test.each([true, false])('normal/signup positive control remains available with disableRegistration=%s', async enabled => {
		const f = signupFixture(enabled);
		await expect(f.service.signup({ username: 'applicant', passwordHash: 'hash' })).resolves.toMatchObject({ account: { id: 'user1' } });
		expect(f.commits).toBe(1);
		expect(f.persisted).toHaveLength(4);
		expect(f.transaction.getRepository).not.toHaveBeenCalled();
		expect(f.users.exists).toHaveBeenCalledOnce();
		expect(f.usedNames.exists).toHaveBeenCalledOnce();
		expect(f.usedNames.exists.mock.invocationCallOrder[0]).toBeLessThan(f.db.transaction.mock.invocationCallOrder[0]);
	});

	test.each(['assertRoot', 'assertUnanimous'] as const)('application signup honors the review service %s guard before saving an account', async guard => {
		const f = signupFixture(true);
		f.review[guard].mockImplementation(() => { throw new Error('review denied'); });
		await expect(f.service.signup({ registrationApplicationId: 'app1', reviewerId: 'admin', revision: reviewRevision })).rejects.toThrow('review denied');
		expect(f.transaction.save).not.toHaveBeenCalled();
		expect(f.transaction.update).not.toHaveBeenCalled();
		expect(f.usersChart.update).not.toHaveBeenCalled();
		expect(f.userService.notifySystemWebhook).not.toHaveBeenCalled();
	});

	test('ON application signup commits account and notifies only after success', async () => {
		const f = signupFixture(true);
		await expect(f.service.signup({ registrationApplicationId: 'app1', reviewerId: 'admin', revision: reviewRevision })).resolves.toMatchObject({ account: { id: 'user1' } });
		expect(f.commits).toBe(1);
		expect(f.usersChart.update).toHaveBeenCalledOnce();
		expect(f.userService.notifySystemWebhook).toHaveBeenCalledOnce();
	});

	test('OFF while transaction duplicate lookup awaits prevents the first save', async () => {
		const f = signupFixture(true);
		f.transaction.findOneBy.mockImplementation(async () => { f.serverMeta.disableRegistration = false; return null; });
		await expect(f.service.signup({ registrationApplicationId: 'app1', reviewerId: 'admin', revision: reviewRevision })).rejects.toMatchObject(disabled);
		expect(f.transaction.save).not.toHaveBeenCalled();
		expect(f.rollbacks).toBe(1);
		expect(f.usersChart.update).not.toHaveBeenCalled();
	});

	test('OFF during account writes rolls the transaction back and never emits creation events', async () => {
		const f = signupFixture(true);
		f.transaction.save.mockImplementation(async (entity: unknown) => { f.persisted.push(entity); f.serverMeta.disableRegistration = false; return entity; });
		await expect(f.service.signup({ registrationApplicationId: 'app1', reviewerId: 'admin', revision: reviewRevision })).rejects.toMatchObject(disabled);
		expect(f.rollbacks).toBe(1);
		expect(f.commits).toBe(0);
		expect(f.persisted).toHaveLength(0);
		expect(f.usersChart.update).not.toHaveBeenCalled();
		expect(f.userService.notifySystemWebhook).not.toHaveBeenCalled();
	});
});
