/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getMetadataArgsStorage, QueryFailedError } from 'typeorm';
import bcrypt from 'bcryptjs';
import { SignupService } from '@/core/SignupService.js';
import { MiRegistrationApplication } from '@/models/RegistrationApplication.js';
import { MiUser } from '@/models/User.js';
import { MiUserProfile } from '@/models/UserProfile.js';
import { MiUserKeypair } from '@/models/UserKeypair.js';
import { MiUsedUsername } from '@/models/UsedUsername.js';
import ApplyEndpoint from '@/server/api/endpoints/registration/apply.js';
import ListEndpoint, { meta as listMeta } from '@/server/api/endpoints/admin/registration-applications.js';
import ApproveEndpoint, { meta as approveMeta } from '@/server/api/endpoints/admin/approve-registration.js';
import RejectEndpoint, { meta as rejectMeta } from '@/server/api/endpoints/admin/reject-registration.js';
import type { FindOperator } from 'typeorm';

vi.mock('bcryptjs', () => ({ default: { genSalt: vi.fn(), hash: vi.fn() } }));
vi.mock('node:crypto', async importOriginal => ({
	...await importOriginal<typeof import('node:crypto')>(),
	generateKeyPair: vi.fn((_algorithm, _options, callback) => callback(null, 'public-key', 'private-key')),
}));

const contacts = 'OTHER_SNS_CONTACT_PRIVATE_FIXTURE';
const reviewRevision = 'a'.repeat(64);
const applicant = { username: 'Applicant', password: 'password123', reason: '参加したいです', email: 'applicant@example.test' };
const admin = { id: 'admin' } as never;
type StoredApplication = Pick<MiRegistrationApplication, 'id' | 'username' | 'hashedPassword' | 'email' | 'additionalContacts' | 'reason' | 'status' | 'createdAt' | 'approvedAt' | 'rejectedAt' | 'personalDataDeletedAt' | 'userId'>;

function fixture() {
	const serverMeta = { disableRegistration: true, preservedUsernames: [], rootUserId: 'admin', name: 'test', prohibitedWordsForNameOfUser: [] };
	const state = {
		application: {
			id: 'app1', username: 'applicant', hashedPassword: 'hash', email: applicant.email, additionalContacts: contacts,
			reason: applicant.reason, status: 'pending', createdAt: new Date('2026-08-01T00:00:00Z'),
			approvedAt: null, rejectedAt: null, personalDataDeletedAt: null, userId: null,
		} as StoredApplication | null,
		records: [] as unknown[],
		commits: 0,
		rollbacks: 0,
	};
	const events: string[] = [];
	const hooks = { failAt: '', modeOffAt: '' };

	function checkpoint(phase: string) {
		if (hooks.modeOffAt === phase) serverMeta.disableRegistration = false;
		if (hooks.failAt === phase) throw new Error(`fixture failure: ${phase}`);
	}

	let lockTail = Promise.resolve();
	const locks = vi.fn();
	const updates = vi.fn();
	const saves = vi.fn();
	const transactionUsers = { exists: vi.fn().mockResolvedValue(false) };
	const transactionUsedNames = { exists: vi.fn().mockResolvedValue(false) };
	const getRepository = vi.fn((entity: unknown) => entity === MiUser ? transactionUsers : transactionUsedNames);
	const db = {
		transaction: vi.fn(async (callback: (manager: {
			getRepository: typeof getRepository;
			findOne: (entity: unknown, options: unknown) => Promise<StoredApplication | null>;
			findOneBy: () => Promise<null>;
			save: (entity: unknown) => Promise<unknown>;
			update: (entity: unknown, id: string, changes: Partial<StoredApplication>) => Promise<{ affected: number }>;
		}) => Promise<void>) => {
			let release: (() => void) | undefined;
			let lockedApplication: StoredApplication | null = null;
			let decision: StoredApplication | null = null;
			const staged: unknown[] = [];
			const manager = {
				getRepository,
				findOne: async (entity: unknown, options: unknown) => {
					locks(entity, options);
					const previous = lockTail;
					lockTail = new Promise<void>(done => { release = done; });
					await previous;
					lockedApplication = state.application ? { ...state.application } : null;
					checkpoint('lock');
					return lockedApplication;
				},
				findOneBy: async () => null,
				query: async () => [],
				save: async (entity: unknown) => {
					saves(entity);
					const phase = entity instanceof MiUser ? 'account' : entity instanceof MiUserKeypair ? 'keypair' : entity instanceof MiUserProfile ? 'profile' : 'usedName';
					checkpoint(phase);
					staged.push(entity);
					return entity;
				},
				update: async (entity: unknown, id: string, changes: Partial<StoredApplication>) => {
					updates(entity, id, changes);
					if (!lockedApplication) throw new Error('fixture requires locked application');
					decision = { ...lockedApplication, ...changes };
					checkpoint('decision');
					return { affected: 1 };
				},
			};
			try {
				await callback(manager);
				checkpoint('commit');
				state.records.push(...staged);
				if (decision) state.application = decision;
				state.commits++;
				events.push('commit');
			} catch (error) {
				state.rollbacks++;
				throw error;
			} finally {
				release?.();
			}
		}),
	};
	const repository = {
		exists: vi.fn().mockResolvedValue(false), insert: vi.fn().mockResolvedValue({}),
		find: vi.fn(async (_options: Record<string, unknown>) => state.application ? [{ ...state.application }] : []),
	};
	const users = { exists: vi.fn().mockResolvedValue(false) };
	const usedNames = { exists: vi.fn().mockResolvedValue(false) };
	const userEntity = { validateLocalUsername: vi.fn().mockReturnValue(true), validatePassword: vi.fn().mockReturnValue(true) };
	const utility = { isKeyWordIncluded: vi.fn().mockReturnValue(false), toPunyNullable: vi.fn().mockReturnValue(null) };
	const userService = { notifySystemWebhook: vi.fn(() => { events.push('webhook'); }) };
	const chart = { update: vi.fn(() => { events.push('chart'); }) };
	const mail = { sendTemplateEmail: vi.fn(async () => { events.push('mail'); }) };
	const notification = { notifyNewApplication: vi.fn().mockResolvedValue(undefined) };
	const id = { gen: vi.fn().mockReturnValue('user1') };
	const reviewer = { userId: 'admin', name: null, username: 'admin', isRoot: true, isAdministrator: true, eligibilityKey: 'fixture-root' };
	const review = {
		assertStaff: vi.fn().mockResolvedValue(reviewer),
		getCurrentStaff: vi.fn().mockResolvedValue([reviewer]),
		packReview: vi.fn().mockReturnValue({ revision: reviewRevision, voters: [] }),
		assertRoot: vi.fn().mockResolvedValue(undefined),
		lockReview: vi.fn(async (_manager: unknown, application: unknown) => ({ application })),
		assertUnanimous: vi.fn(),
		recordDecision: vi.fn(async () => { checkpoint('review'); }),
	};
	const signup = new SignupService(db as never, serverMeta as never, users as never, usedNames as never, utility as never, userService as never, userEntity as never, id as never, {} as never, {} as never, chart as never, review as never);
	const apply = new ApplyEndpoint(serverMeta as never, repository as never, users as never, usedNames as never, id as never, {} as never, notification as never);
	const list = new ListEndpoint(serverMeta as never, repository as never, review as never);
	const approve = new ApproveEndpoint({ url: 'https://example.test' } as never, serverMeta as never, signup, mail as never);
	const rejectionNotification = { send: vi.fn(async () => { events.push('rejection-mail'); return { emailSent: false, notificationStatus: 'failed' }; }) };
	const reject = new RejectEndpoint(serverMeta as never, db as never, review as never, rejectionNotification as never);
	return { review, state, serverMeta, hooks, events, locks, updates, saves, db, repository, users, usedNames, transactionUsers, transactionUsedNames, getRepository, userService, chart, mail, notification, rejectionNotification, signup, apply, list, approve, reject };
}

beforeEach(() => {
	vi.mocked(bcrypt.genSalt).mockResolvedValue('salt' as never);
	vi.mocked(bcrypt.hash).mockResolvedValue('hash' as never);
});
afterEach(() => { vi.clearAllMocks(); });

describe('review-only additional contacts', () => {
	test.each(['true', 1, null])('administrator relationship must be a boolean (%s)', async hasAdminRelationship => {
		const f = fixture();
		await expect(f.apply.exec({ ...applicant, hasAdminRelationship, additionalContacts: contacts }, null, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(f.repository.insert).not.toHaveBeenCalled();
	});

	test.each([undefined, null, '', ' \n\t '])('administrator relationship rejects missing or blank contacts (%s)', async additionalContacts => {
		const f = fixture();
		await expect(f.apply.exec({ ...applicant, hasAdminRelationship: true, additionalContacts }, null, null, null)).rejects.toMatchObject({ code: 'ADDITIONAL_CONTACTS_REQUIRED' });
		expect(f.repository.insert).not.toHaveBeenCalled();
		expect(f.notification.notifyNewApplication).not.toHaveBeenCalled();
	});

	test.each([undefined, '', ' \n\t '])('without an administrator relationship, a reason remains required (%s)', async reason => {
		const f = fixture();
		await expect(f.apply.exec({ ...applicant, hasAdminRelationship: false, reason, additionalContacts: contacts }, null, null, null)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
		expect(f.repository.insert).not.toHaveBeenCalled();
	});

	test.each([undefined, '', 'This disabled draft must not be stored'])('administrator relationship accepts contacts instead of reason (%s) and still requires review', async reason => {
		const f = fixture();
		await expect(f.apply.exec({ ...applicant, hasAdminRelationship: true, reason, additionalContacts: `  ${contacts}\n ` }, null, null, null)).resolves.toEqual({ success: true });
		expect(f.repository.insert).toHaveBeenCalledWith(expect.objectContaining({
			reason: 'サーバー管理者と関係があります（フォロワー・知り合いなど、本人申告）。',
			additionalContacts: contacts,
			status: 'pending',
		}));
		expect(f.db.transaction).not.toHaveBeenCalled();
		expect(f.notification.notifyNewApplication).toHaveBeenCalledExactlyOnceWith();
	});

	test('saved applications return success without waiting for notification recipient discovery', async () => {
		const f = fixture();
		let finishDelivery!: () => void;
		const pendingDelivery = new Promise<void>(resolve => { finishDelivery = resolve; });
		f.notification.notifyNewApplication.mockReturnValue(pendingDelivery);
		let response: unknown;
		const sending = f.apply.exec(applicant, null, null, null).then(value => { response = value; });
		try {
			await vi.waitFor(() => expect(response).toEqual({ success: true }));
			expect(f.repository.insert).toHaveBeenCalledOnce();
			expect(f.notification.notifyNewApplication).toHaveBeenCalledExactlyOnceWith();
		} finally {
			finishDelivery();
			await sending;
		}
	});

	test.each([undefined, null, '', ' \n\t '])('empty or omitted %s is stored as null', async additionalContacts => {
		const f = fixture();
		await expect(f.apply.exec({ ...applicant, additionalContacts }, null, null, null)).resolves.toEqual({ success: true });
		expect(f.repository.insert).toHaveBeenCalledWith(expect.objectContaining({ additionalContacts: null, email: applicant.email }));
		expect(f.notification.notifyNewApplication).toHaveBeenCalledExactlyOnceWith();
	});

	test('contacts are trimmed plain text, not normalized into links or transferred to other fields', async () => {
		const f = fixture();
		const text = ' <script>alert(1)</script>\n@someone@example.test ';
		await f.apply.exec({ ...applicant, additionalContacts: text }, null, null, null);
		expect(f.repository.insert).toHaveBeenCalledWith(expect.objectContaining({ additionalContacts: text.trim(), reason: applicant.reason, email: applicant.email, hashedPassword: 'hash' }));
		expect(bcrypt.hash).toHaveBeenCalledWith(applicant.password, 'salt');
		expect(f.notification.notifyNewApplication).toHaveBeenCalledExactlyOnceWith();
	});

	test('1024 characters are accepted and 1025 are rejected before any write', async () => {
		const f = fixture();
		await f.apply.exec({ ...applicant, additionalContacts: 'x'.repeat(1024) }, null, null, null);
		expect(f.repository.insert).toHaveBeenCalledOnce();
		f.repository.insert.mockClear();
		f.notification.notifyNewApplication.mockClear();
		await expect(f.apply.exec({ ...applicant, additionalContacts: 'x'.repeat(1025) }, null, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(f.repository.insert).not.toHaveBeenCalled();
		expect(f.notification.notifyNewApplication).not.toHaveBeenCalled();
	});

	test('database insert errors never expose the private row or original cause', async () => {
		const f = fixture();
		const driverError = Object.assign(new Error(`failing row contains ${contacts}`), { detail: contacts });
		const rawError = new QueryFailedError('INSERT contact', [contacts], driverError);
		expect(String(rawError)).toContain(contacts); // positive leak fixture
		f.repository.insert.mockRejectedValue(rawError);
		const error = await f.apply.exec({ ...applicant, additionalContacts: contacts }, null, null, null).catch(value => value);
		expect(error).toMatchObject({ code: 'REGISTRATION_APPLICATION_SAVE_FAILED', message: 'The registration application could not be saved.' });
		expect(error.cause).toBeUndefined();
		expect(error.info).toBeUndefined();
		expect(`${JSON.stringify(error)} ${error.stack}`).not.toContain(contacts);
		expect(f.notification.notifyNewApplication).not.toHaveBeenCalled();
	});

	test.each(['pending', 'approved', 'rejected'])('list selects and returns contact only for pending, requested=%s', async status => {
		const f = fixture();
		f.state.application!.status = status;
		const result = await f.list.exec({ status }, admin, null, null);
		expect(f.repository.find).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ additionalContacts: status === 'pending' }) }));
		expect(result[0].additionalContacts).toBe(status === 'pending' ? contacts : null);
		expect(result[0]).not.toHaveProperty('hashedPassword');
	});

	test('terminal records returned unexpectedly by a pending query still hide residual contacts', async () => {
		const f = fixture();
		f.state.application!.status = 'approved';
		const result = await f.list.exec({ status: 'pending' }, admin, null, null);
		expect(result[0].additionalContacts).toBeNull();
	});

	test('nullable non-default column and terminal-state check are present in entity and the corresponding migration', () => {
		const column = getMetadataArgsStorage().columns.find(item => item.target === MiRegistrationApplication && item.propertyName === 'additionalContacts');
		expect(column?.options).toMatchObject({ nullable: true, length: 1024, select: false });
		const expression = '"status" = \'pending\' OR "additionalContacts" IS NULL';
		expect(getMetadataArgsStorage().checks.find(item => item.target === MiRegistrationApplication)?.expression).toBe(expression);
		const migrationDir = resolve(process.cwd(), 'migration');
		const currentNumber = 1788500000000;
		// Later migrations are valid; only a collision with this migration's number is invalid.
		const sameNumber = readdirSync(migrationDir).filter(name => Number(name.match(/^\d+/)?.[0]) === currentNumber);
		expect(sameNumber).toHaveLength(1);
		const source = readFileSync(resolve(migrationDir, '1788500000000-add-registration-additional-contacts.js'), 'utf8');
		expect(source).toContain('ADD "additionalContacts" varchar(1024) NULL');
		expect(source).toContain(`CHECK (${expression})`);
	});
});

function moderatorFixture(userId = 'moderator') {
	const f = fixture();
	const viewer = { userId, name: '担当者', username: 'moderator', isRoot: false, isAdministrator: false, eligibilityKey: 'current-moderator-grant' };
	f.review.assertStaff.mockResolvedValue(viewer);
	f.review.getCurrentStaff.mockResolvedValue([viewer]);
	return { ...f, viewer, me: { id: userId } as never };
}

describe('registration list moderator security', () => {
	test('the list accepts moderators but keeps credential and first-party-token requirements', () => {
		expect(listMeta).toMatchObject({ requireCredential: true, requireModerator: true, secure: true, kind: 'read:admin:registration-applications' });
		expect(listMeta).not.toHaveProperty('requireAdmin');
	});

	test.each(['pending', 'approved', 'rejected'])('a moderator never receives the email field in %s results', async status => {
		const f = moderatorFixture();
		f.state.application!.status = status;
		const result = await f.list.exec({ status }, f.me, null, null);
		expect(f.state.application!.email).toBe(applicant.email); // Positive private backing row.
		expect(result[0]).not.toHaveProperty('email');
		expect(result[0]).not.toHaveProperty('hashedPassword');
		expect(result[0]).not.toHaveProperty('reviewVotes');
		expect(JSON.stringify(result)).not.toContain(applicant.email);
	});

	test('root retains the original contact data as a visibility positive control', async () => {
		const f = fixture();
		f.state.application!.reason = `連絡先 ${applicant.email}`;
		f.state.application!.additionalContacts = `@applicant@social.example.test / ${applicant.email}`;
		const result = await f.list.exec({ status: 'pending' }, admin, null, null);
		expect(result[0]).toMatchObject({ email: applicant.email, reason: `連絡先 ${applicant.email}`, additionalContacts: `@applicant@social.example.test / ${applicant.email}` });
	});

	test('moderator responses redact free-text emails and preserve an unrelated SNS ID', async () => {
		const f = moderatorFixture();
		f.state.application!.reason = `参加希望。連絡先 ${applicant.email}`;
		f.state.application!.additionalContacts = `@applicant@social.example.test / ${applicant.email} / other%40example.test`;
		const result = await f.list.exec({ status: 'pending' }, f.me, null, null);
		expect(result[0].additionalContacts).toContain('@applicant@social.example.test');
		expect(JSON.stringify(result)).not.toMatch(/applicant@example\.test|other(?:@|%40)example\.test/u);
		expect(result[0].reason).toContain('参加希望。連絡先');
		expect(f.state.application!.reason).toContain(applicant.email);
		expect(f.state.application!.additionalContacts).toContain('other%40example.test');
		expect(f.repository.find).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ email: true }) }));
	});

	test('voter names, vote reasons and the final actor name cannot smuggle an email', async () => {
		const f = moderatorFixture();
		f.review.packReview.mockReturnValue({
			revision: reviewRevision,
			voters: [{ userId: 'other', name: applicant.email, username: 'other', isCurrent: true, choice: 'oppose', reason: `確認先: ${applicant.email}`, votedAt: '2026-09-18T00:00:00Z' }],
			decidedBy: { userId: 'admin', name: applicant.email, username: 'admin' },
		});
		const result = await f.list.exec({ status: 'pending' }, f.me, null, null);
		expect(JSON.stringify(result)).not.toContain(applicant.email);
		expect(result[0].review.voters[0]).toMatchObject({ userId: 'other', choice: 'oppose', votedAt: '2026-09-18T00:00:00Z' });
		expect(result[0].review.voters[0].name).toContain('［メールアドレス非公開］');
		expect(result[0].review.decidedBy?.name).toContain('［メールアドレス非公開］');
	});

	test('moderators see staff names written as "name@status" as they are', async () => {
		const f = moderatorFixture();
		f.review.packReview.mockReturnValue({
			revision: reviewRevision,
			voters: [{ userId: 'other', name: '旗茶@審査中', username: 'other', isCurrent: true, choice: 'oppose', reason: '連絡先 contact@another.test', votedAt: '2026-09-18T00:00:00Z' }],
			decidedBy: { userId: 'admin', name: '鯖缶@運営', username: 'admin' },
		});
		const result = await f.list.exec({ status: 'pending' }, f.me, null, null);
		expect(result[0].review.voters[0].name).toBe('旗茶@審査中');
		expect(result[0].review.decidedBy?.name).toBe('鯖缶@運営');
		// Free-text vote reasons still use the generic email rule.
		expect(result[0].review.voters[0].reason).toBe('連絡先 ［メールアドレス非公開］');
	});

	test('ordinary callers rejected by staff validation cannot even query saved applications', async () => {
		const f = moderatorFixture();
		f.review.assertStaff.mockRejectedValue({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		await expect(f.list.exec({}, f.me, null, null)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		expect(f.repository.find).not.toHaveBeenCalled();
		expect(f.review.packReview).not.toHaveBeenCalled();
	});

	test.each(['removed', 'reappointed', 'rootChanged'])('a %s viewer is rejected after the database read', async change => {
		const f = moderatorFixture();
		const next = { ...f.viewer };
		if (change === 'reappointed') next.eligibilityKey = 'replacement-grant';
		if (change === 'rootChanged') next.isRoot = true;
		f.review.getCurrentStaff.mockResolvedValue(change === 'removed' ? [] : [next]);
		await expect(f.list.exec({}, f.me, null, null)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		expect(f.repository.find).toHaveBeenCalledOnce();
		expect(f.review.packReview).not.toHaveBeenCalled();
	});

	test('root losing authority while the list loads cannot receive the fetched email', async () => {
		const f = fixture();
		f.review.getCurrentStaff.mockResolvedValue([{ userId: 'admin', name: null, username: 'admin', isRoot: false, isAdministrator: true, eligibilityKey: 'fixture-root' }]);
		await expect(f.list.exec({}, admin, null, null)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		expect(f.repository.find).toHaveBeenCalledOnce();
		expect(f.review.packReview).not.toHaveBeenCalled();
	});

	test('needsReview binds the authenticated reviewer and grant separately from SQL text', async () => {
		const f = moderatorFixture('reviewer\' OR true --');
		f.viewer.eligibilityKey = 'grant\' OR true --';
		await f.list.exec({ needsReview: true, limit: 1, offset: 2 }, f.me, null, null);
		const query = f.repository.find.mock.calls[0][0] as { where: { reviewVotes: FindOperator<unknown> }; take: number; skip: number };
		const filter = query.where.reviewVotes;
		expect(query).toMatchObject({ take: 1, skip: 2 });
		expect(filter.type).toBe('raw');
		expect(filter.getSql?.('application.reviewVotes')).toBe('(application.reviewVotes -> :reviewerId ->> \'eligibilityKey\') IS DISTINCT FROM :eligibilityKey');
		expect(filter.getSql?.('application.reviewVotes')).not.toContain(f.viewer.userId);
		expect(filter.objectLiteralParameters).toEqual({ reviewerId: f.viewer.userId, eligibilityKey: f.viewer.eligibilityKey });
	});

	test.each(['root', 'allVotes'])('the %s list does not apply the moderator-only needsReview filter', async mode => {
		const f = mode === 'root' ? fixture() : moderatorFixture();
		const me = mode === 'root' ? admin : { id: 'moderator' } as never;
		await f.list.exec({ needsReview: mode === 'root' }, me, null, null);
		const query = f.repository.find.mock.calls[0][0] as { where: Record<string, unknown> };
		expect(query.where).not.toHaveProperty('reviewVotes');
	});
});

describe('atomic decisions and contact erasure', () => {
	test('approval uses only transaction repositories while holding the application row lock', async () => {
		const f = fixture();
		f.users.exists.mockRejectedValue(new Error('global connection must not be acquired'));
		f.usedNames.exists.mockRejectedValue(new Error('global connection must not be acquired'));
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).resolves.toEqual({ success: true, emailSent: true });
		expect(f.getRepository).toHaveBeenCalledWith(MiUser);
		expect(f.getRepository).toHaveBeenCalledWith(MiUsedUsername);
		expect(f.transactionUsers.exists).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usernameLower: 'applicant' }) }));
		expect(f.transactionUsedNames.exists).toHaveBeenCalledWith({ where: { username: 'applicant' } });
		expect(f.users.exists).not.toHaveBeenCalled();
		expect(f.usedNames.exists).not.toHaveBeenCalled();
	});

	test.each([
		['transactionUsers', 'DUPLICATED_USERNAME'],
		['transactionUsedNames', 'USED_USERNAME'],
	] as const)('duplicate checks still reject through %s', async (repository, message) => {
		const f = fixture();
		f[repository].exists.mockResolvedValue(true);
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).rejects.toThrow(message);
		expect(f.saves).not.toHaveBeenCalled();
		expect(f.updates).not.toHaveBeenCalled();
		expect(f.state.application).toMatchObject({ status: 'pending', additionalContacts: contacts });
	});

	test('approval commits account/profile/decision together before chart, webhook or email', async () => {
		const f = fixture();
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).resolves.toEqual({ success: true, emailSent: true });
		expect(f.db.transaction).toHaveBeenCalledOnce();
		expect(f.locks).toHaveBeenCalledWith(MiRegistrationApplication, expect.objectContaining({ where: { id: 'app1' }, lock: { mode: 'pessimistic_write' }, select: { id: true, status: true, username: true, hashedPassword: true, email: true, reviewVotes: true, reviewVersion: true } }));
		expect(f.state.application).toMatchObject({ status: 'approved', additionalContacts: null, email: applicant.email, userId: 'user1', approvedAt: expect.any(Date) });
		expect(f.state.records).toHaveLength(4);
		expect(f.state.records.find(record => record instanceof MiUserProfile)).toMatchObject({ email: applicant.email, emailVerified: true, password: 'hash', lang: 'ja-JP' });
		expect(f.state.records.some(record => record instanceof MiUsedUsername)).toBe(true);
		expect(f.events).toEqual(['commit', 'chart', 'webhook', 'mail']);
		expect(JSON.stringify([f.state.records, f.mail.sendTemplateEmail.mock.calls, f.userService.notifySystemWebhook.mock.calls, f.chart.update.mock.calls])).not.toContain(contacts);
		expect(f.saves.mock.calls.every(([record]) => !(record instanceof MiRegistrationApplication))).toBe(true);
	});

	test('rejection locks and clears contacts/credentials but preserves required email and reason', async () => {
		const f = fixture();
		await expect(f.reject.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).resolves.toEqual({ success: true, emailSent: false, notificationStatus: 'failed' });
		expect(f.events).toEqual(['commit', 'rejection-mail']);
		expect(f.locks).toHaveBeenCalledWith(MiRegistrationApplication, { where: { id: 'app1' }, lock: { mode: 'pessimistic_write' }, select: { id: true, status: true, reviewVotes: true, reviewVersion: true } });
		expect(f.state.application).toMatchObject({ status: 'rejected', additionalContacts: null, username: null, hashedPassword: null, email: applicant.email, reason: applicant.reason, rejectedAt: expect.any(Date), personalDataDeletedAt: expect.any(Date) });
		expect(f.state.records).toHaveLength(0);
		expect(f.mail.sendTemplateEmail).not.toHaveBeenCalled();
		expect(f.saves).not.toHaveBeenCalled();
	});

	test.each(['unauthorized', 'stale'])('rejection %s does not send a result notification', async failure => {
		const f = fixture();
		const originalUsername = f.state.application?.username;
		const guard = failure === 'unauthorized' ? f.review.assertRoot : f.review.lockReview;
		guard.mockRejectedValue(new Error(failure));
		await expect(f.reject.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).rejects.toThrow(failure);
		expect(f.rejectionNotification.send).not.toHaveBeenCalled();
		expect(f.state.application).toMatchObject({ status: 'pending', username: originalUsername, additionalContacts: contacts });
	});

	test('a notification exception cannot undo the committed rejection or report success', async () => {
		const f = fixture();
		f.rejectionNotification.send.mockRejectedValue(new Error('unknown delivery'));
		expect(await f.reject.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).toEqual({ success: true, emailSent: false, notificationStatus: 'sending' });
		expect(f.state.application).toMatchObject({ status: 'rejected', username: null, hashedPassword: null, additionalContacts: null, email: applicant.email });
		expect(f.state.commits).toBe(1);
	});

	test.each(['account', 'keypair', 'profile', 'usedName', 'decision', 'review', 'commit'])('approval failure at %s preserves pending contacts and rolls back every account record', async failAt => {
		const f = fixture();
		f.hooks.failAt = failAt;
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).rejects.toThrow(`fixture failure: ${failAt}`);
		expect(f.state.application).toMatchObject({ status: 'pending', additionalContacts: contacts, approvedAt: null, userId: null });
		expect(f.state.records).toHaveLength(0);
		expect(f.state.rollbacks).toBe(1);
		expect(f.events).toEqual([]);
	});

	test.each(['decision', 'review', 'commit'])('rejection failure at %s does not partially clear a pending application', async failAt => {
		const f = fixture();
		f.hooks.failAt = failAt;
		await expect(f.reject.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).rejects.toThrow(`fixture failure: ${failAt}`);
		expect(f.rejectionNotification.send).not.toHaveBeenCalled();
		expect(f.state.application).toMatchObject({ status: 'pending', additionalContacts: contacts, username: 'applicant', hashedPassword: 'hash', email: applicant.email });
		expect(f.state.rollbacks).toBe(1);
	});

	test.each(['approve', 'reject'] as const)('mode OFF after the %s write rolls its decision back', async key => {
		const f = fixture();
		f.hooks.modeOffAt = 'decision';
		await expect(f[key].exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).rejects.toMatchObject({ code: 'REGISTRATION_APPLICATIONS_DISABLED' });
		expect(f.state.application).toMatchObject({ status: 'pending', additionalContacts: contacts });
		expect(f.state.records).toHaveLength(0);
		expect(f.events).toEqual([]);
	});

	test.each(['approve', 'reject'] as const)('mode OFF during %s lock acquisition prevents writes', async key => {
		const f = fixture();
		f.hooks.modeOffAt = 'lock';
		await expect(f[key].exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).rejects.toMatchObject({ code: 'REGISTRATION_APPLICATIONS_DISABLED' });
		expect(f.saves).not.toHaveBeenCalled();
		expect(f.updates).not.toHaveBeenCalled();
	});

	test.each([
		['approve', 'approve'], ['approve', 'reject'], ['reject', 'approve'], ['reject', 'reject'],
	] as const)('concurrent %s then %s has one decision and no revived contact', async (first, second) => {
		const f = fixture();
		const results = await Promise.allSettled([
			f[first].exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null),
			f[second].exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null),
		]);
		expect(results[0].status).toBe('fulfilled');
		expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'ALREADY_PROCESSED' } });
		expect(f.state.commits).toBe(1);
		expect(f.state.application).toMatchObject({ status: first === 'approve' ? 'approved' : 'rejected', additionalContacts: null });
		expect(f.state.records).toHaveLength(first === 'approve' ? 4 : 0);
		expect(f.mail.sendTemplateEmail).toHaveBeenCalledTimes(first === 'approve' ? 1 : 0);
	});

	test('email delivery failure does not undo the already committed account/contact erasure', async () => {
		const f = fixture();
		f.mail.sendTemplateEmail.mockRejectedValue(new Error('mail unavailable'));
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).resolves.toEqual({ success: true, emailSent: false });
		expect(f.state.application).toMatchObject({ status: 'approved', additionalContacts: null });
		expect(f.state.records).toHaveLength(4);
		expect(f.state.commits).toBe(1);
	});

	test.each(['approve', 'reject'] as const)('missing application in %s performs no decision or account writes', async key => {
		const f = fixture();
		f.state.application = null;
		await expect(f[key].exec({ applicationId: 'missing', revision: reviewRevision }, admin, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_APPLICATION' });
		expect(f.saves).not.toHaveBeenCalled();
		expect(f.updates).not.toHaveBeenCalled();
	});

	test.each(['username', 'hashedPassword', 'email'] as const)('approval rejects incomplete %s before account creation', async field => {
		const f = fixture();
		f.state.application![field] = null;
		await expect(f.approve.exec({ applicationId: 'app1', revision: reviewRevision }, admin, null, null)).rejects.toMatchObject({ code: 'MISSING_APPLICANT_DATA' });
		expect(f.saves).not.toHaveBeenCalled();
		expect(f.updates).not.toHaveBeenCalled();
	});

	test('both decision endpoints retain admin/moderator and first-party token restrictions', () => {
		for (const meta of [approveMeta, rejectMeta]) {
			expect(meta).toMatchObject({ requireCredential: true, requireAdmin: true, requireModerator: true, secure: true });
			expect(meta.kind).toMatch(/^write:admin:/);
		}
	});
});
