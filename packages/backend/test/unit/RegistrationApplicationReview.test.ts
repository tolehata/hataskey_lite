/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { RegistrationApplicationReviewService } from '@/core/RegistrationApplicationReviewService.js';
import { RoleService } from '@/core/RoleService.js';
import { currentRegistrationVote, normalizeRegistrationVoteReason, registrationReviewRevision } from '@/core/registration-review-policy.js';
import type { ReviewStaff } from '@/core/registration-review-policy.js';
import { MiRegistrationApplication } from '@/models/RegistrationApplication.js';
import type { RegistrationReviewVote } from '@/models/RegistrationApplication.js';
import { MiMeta } from '@/models/Meta.js';
import { MiRole } from '@/models/Role.js';
import { MiRoleAssignment } from '@/models/RoleAssignment.js';
import { MiUser } from '@/models/User.js';
import { MiModerationLog } from '@/models/ModerationLog.js';
import type { EntityManager, FindOperator } from 'typeorm';

const now = new Date('2026-09-18T00:00:00.000Z').getTime();
const clone = <T>(value: T): T => structuredClone(value);

function requirePresent<T>(value: T | null | undefined): T {
	if (value == null) throw new Error('Required review fixture value is missing');
	return value;
}

function member(userId: string, options: Partial<ReviewStaff> = {}): ReviewStaff {
	return { userId, name: userId, username: userId, isRoot: false, isAdministrator: false, eligibilityKey: `eligibility${userId}`, ...options };
}

function storedVote(staff: ReviewStaff, choice: 'agree' | 'oppose' = 'agree', reason = ''): RegistrationReviewVote {
	return { userId: staff.userId, name: staff.name, username: staff.username, eligibilityKey: staff.eligibilityKey, choice, reason, votedAt: new Date(now).toISOString() };
}

function reviewApplication(): MiRegistrationApplication {
	return Object.assign(new MiRegistrationApplication(), {
		id: 'application1', status: 'pending', reviewVersion: 0, reviewVotes: {}, reviewDecision: null,
		email: 'applicant@example.test', additionalContacts: '@applicant@social.example.test',
		username: 'applicant', hashedPassword: 'privateHash',
	});
}

function reviewFixture() {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(now);
	const user = (id: string, overrides: Partial<MiUser> = {}) => Object.assign(new MiUser(), {
		id, username: id, name: id, host: null, isDeleted: false, isSuspended: false,
		isLocked: false, isCat: false, isBot: false, isExplorable: true, followersCount: 0, followingCount: 0, notesCount: 0,
		...overrides,
	});
	const role = (id: string, overrides: Partial<MiRole> = {}) => Object.assign(new MiRole(), {
		id, target: 'manual', isModerator: true, isAdministrator: false, condFormula: { type: 'isLocal' }, ...overrides,
	});
	const assignment = (id: string, userId: string, roleId: string, expiresAt: Date | null = null) => Object.assign(new MiRoleAssignment(), { id, userId, roleId, expiresAt });
	const state = {
		application: reviewApplication() as MiRegistrationApplication | null,
		meta: { id: 'meta', rootUserId: 'root1', disableRegistration: true, registrationClosed: false },
		users: [user('root1'), user('mod1'), user('admin1'), user('ordinary')],
		roles: [role('modRole'), role('adminRole', { isModerator: false, isAdministrator: true })],
		assignments: [assignment('grantMod1', 'mod1', 'modRole'), assignment('grantAdmin1', 'admin1', 'adminRole')],
		logs: [] as { id: string; userId: string; type: string; info: Record<string, string> }[],
		commits: 0,
		rollbacks: 0,
	};
	const hooks = { afterUpdate: () => {}, beforeLog: () => {}, beforeCommit: () => {} };
	const operations = { query: vi.fn(), findOne: vi.fn(), find: vi.fn(), update: vi.fn(), insert: vi.fn(), meta: vi.fn() };
	let logSequence = 0;
	const roles = Object.assign(Object.create(RoleService.prototype), {
		userEntityService: { isLocalUser: (u: MiUser) => u.host == null, isRemoteUser: (u: MiUser) => u.host != null },
		idService: { parse: () => ({ date: new Date(now - 10000) }) },
	}) as RoleService;

	function managerFor(stage: { application: MiRegistrationApplication | null; logs: typeof state.logs }): EntityManager {
		return {
			query: async (sql: string) => { operations.query(sql); },
			findOneOrFail: async (entity: unknown, options: unknown) => {
				expect(entity).toBe(MiMeta);
				operations.meta(options);
				return clone(state.meta);
			},
			find: async (entity: unknown, options?: { where?: Record<string, unknown> }) => {
				operations.find(entity, options);
				if (entity === MiRole) return clone(state.roles);
				if (entity === MiRoleAssignment) return clone(state.assignments.filter(a => !options?.where?.userId || a.userId === options.where.userId));
				expect(entity).toBe(MiUser);
				return clone(state.users.filter(u => Object.entries(options?.where ?? {}).every(([key, value]) => {
					const actual = u[key as keyof MiUser];
					if (value && typeof value === 'object' && 'type' in value) {
						const op = value as FindOperator<unknown>;
						if (op.type === 'isNull') return actual == null;
						if (op.type === 'in') return (op.value as unknown[]).includes(actual);
						throw new Error(`Unsupported fixture operator: ${op.type}`);
					}
					return actual === value;
				})));
			},
			findOne: async (entity: unknown, options: { where: { id: string } }) => {
				expect(entity).toBe(MiRegistrationApplication);
				operations.findOne(entity, options);
				return stage.application?.id === options.where.id ? clone(stage.application) : null;
			},
			update: async (entity: unknown, id: string, changes: Partial<MiRegistrationApplication>) => {
				expect(entity).toBe(MiRegistrationApplication);
				operations.update(entity, id, clone(changes));
				if (stage.application?.id !== id) throw new Error('fixture application missing');
				Object.assign(stage.application, clone(changes));
				hooks.afterUpdate();
			},
			insert: async (entity: unknown, log: typeof state.logs[number]) => {
				expect(entity).toBe(MiModerationLog);
				operations.insert(entity, clone(log));
				hooks.beforeLog();
				stage.logs.push(clone(log));
			},
		} as unknown as EntityManager;
	}

	// A serialized, staged transaction fixture verifies service ordering/rollback.
	// It does not claim to exercise PostgreSQL's actual table lock implementation.
	let tail = Promise.resolve();
	const db = {
		manager: managerFor(state),
		transaction: vi.fn(async <T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> => {
			const previous = tail;
			let release!: () => void;
			tail = new Promise<void>(resolve => { release = resolve; });
			await previous;
			const stage = { application: clone(state.application), logs: clone(state.logs) };
			try {
				const result = await fn(managerFor(stage));
				hooks.beforeCommit();
				state.application = stage.application;
				state.logs = stage.logs;
				state.commits++;
				return result;
			} catch (error) {
				state.rollbacks++;
				throw error;
			} finally {
				release();
			}
		}),
	};
	const service = new RegistrationApplicationReviewService(db as never, roles, { gen: () => `log${++logSequence}` } as never);
	const revision = async () => registrationReviewRevision(requirePresent(state.application), await service.getCurrentStaff());
	return { service, state, hooks, operations, db, role, user, assignment, revision };
}

afterEach(() => vi.useRealTimers());

describe('registration review policy', () => {
	test.each(['', ' ', '\t\r\n', '\u3000', '\u200b\u200c\u200d\u2060\ufeff', '\u0000\u0007', '\u034f\ufe0f', '\u3164', '\u2800'])('rejects an empty or invisible opposition reason %j', value => {
		expect(() => normalizeRegistrationVoteReason('oppose', value)).toThrow(expect.objectContaining({ code: 'REGISTRATION_REVIEW_REASON_REQUIRED' }));
	});

	test('keeps substantive opposition text and makes agreement notes optional', () => {
		expect(normalizeRegistrationVoteReason('oppose', '  確認事項が残っています。  ')).toBe('確認事項が残っています。');
		expect(normalizeRegistrationVoteReason('agree', '  ')).toBe('');
	});

	test('a vote is valid only for the current authority fingerprint', () => {
		const staff = member('mod1');
		const vote = storedVote(staff);
		expect(currentRegistrationVote({ mod1: vote }, staff)).toBe(vote);
		expect(currentRegistrationVote({ mod1: vote }, { ...staff, eligibilityKey: 'newAppointment' })).toBeNull();
		expect(currentRegistrationVote(Object.create({ mod1: vote }), staff)).toBeNull();
		expect(currentRegistrationVote({ mod1: { ...vote, choice: 'invalid' } as never }, staff)).toBeNull();
	});

	test('revisions ignore presentation/order changes but bind application, version, decision state and electorate', () => {
		const app = reviewApplication();
		const staff = [member('root1', { isRoot: true }), member('mod1')];
		const original = registrationReviewRevision(app, staff);
		expect(registrationReviewRevision(app, [...staff].reverse().map(s => ({ ...s, name: 'changed display name' })))).toBe(original);
		for (const changed of [{ ...app, id: 'otherApplication' }, { ...app, status: 'approved' }, { ...app, reviewVersion: 1 }]) {
			expect(registrationReviewRevision(changed, staff)).not.toBe(original);
		}
		for (const changed of [staff.slice(1), [...staff, member('newMod')], staff.map(s => s.isRoot ? { ...s, isRoot: false } : s), staff.map(s => ({ ...s, eligibilityKey: 'newKey' }))]) {
			expect(registrationReviewRevision(app, changed)).not.toBe(original);
		}
	});
});

describe('registration review effective staff enumeration', () => {
	test('includes root and actual moderators/administrators once, but not ordinary users', async () => {
		const f = reviewFixture();
		f.state.assignments.push(f.assignment('secondModGrant', 'mod1', 'adminRole'));
		const staff = await f.service.getCurrentStaff();
		expect(staff.map(s => s.userId)).toEqual(['admin1', 'mod1', 'root1']);
		expect(staff.find(s => s.userId === 'root1')).toMatchObject({ isRoot: true, isAdministrator: true });
		expect(staff.find(s => s.userId === 'admin1')).toMatchObject({ isRoot: false, isAdministrator: true });
		await expect(f.service.assertRoot('admin1')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		await expect(f.service.assertRoot('root1')).resolves.toBeUndefined();
		await expect(f.service.assertStaff('ordinary')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
	});

	test.each(['isSuspended', 'isDeleted', 'host'] as const)('excludes accounts with %s from eligibility and authorization', async field => {
		const f = reviewFixture();
		Object.assign(requirePresent(f.state.users.find(u => u.id === 'mod1')), { [field]: field === 'host' ? 'remote.example.test' : true });
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).not.toContain('mod1');
		await expect(f.service.assertStaff('mod1')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
	});

	test('evaluates expiry at the boundary and invalidates a renewed assignment fingerprint', async () => {
		const f = reviewFixture();
		const original = requirePresent((await f.service.getCurrentStaff()).find(s => s.userId === 'mod1'));
		f.state.assignments[0].expiresAt = new Date(now);
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).not.toContain('mod1');
		f.state.assignments[0] = f.assignment('reappointment', 'mod1', 'modRole', new Date(now + 1000));
		const renewed = requirePresent((await f.service.getCurrentStaff()).find(s => s.userId === 'mod1'));
		expect(renewed.eligibilityKey).not.toBe(original.eligibilityKey);
		expect(currentRegistrationVote({ mod1: storedVote(original) }, renewed)).toBeNull();
	});

	test('matches conditional moderators using fresh user fields and manual-role dependencies', async () => {
		const f = reviewFixture();
		f.state.roles.push(f.role('conditionalMod', { target: 'conditional', condFormula: { type: 'and', values: [{ type: 'isLocked' }, { type: 'roleAssignedTo', roleId: 'supportRole' }] } }));
		f.state.roles.push(f.role('supportRole', { isModerator: false }));
		f.state.assignments.push(f.assignment('supportGrant', 'ordinary', 'supportRole'));
		requirePresent(f.state.users.find(u => u.id === 'ordinary')).isLocked = true;
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).toContain('ordinary');
		requirePresent(f.state.assignments.find(a => a.id === 'supportGrant')).expiresAt = new Date(now);
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).not.toContain('ordinary');
	});

	test('time-based conditional eligibility is re-evaluated without cache invalidation', async () => {
		const f = reviewFixture();
		f.state.roles.push(f.role('youngModerator', { target: 'conditional', condFormula: { type: 'createdLessThan', sec: 11 } }));
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).toContain('ordinary');
		vi.setSystemTime(now + 1000);
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).not.toContain('ordinary');
	});

	test('an assignment that expires while users load is excluded from the completed staff read', async () => {
		const f = reviewFixture();
		f.state.assignments[0].expiresAt = new Date(now + 1);
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).toContain('mod1');
		f.operations.find.mockImplementation(entity => {
			if (entity === MiUser) vi.setSystemTime(now + 1);
		});
		expect((await f.service.getCurrentStaff()).map(s => s.userId)).not.toContain('mod1');
	});

	test('renewing a conditional role dependency invalidates the vote even when the condition remains true', async () => {
		const f = reviewFixture();
		f.state.roles.push(f.role('supportRole', { isModerator: false }));
		f.state.roles.push(f.role('conditionalMod', { target: 'conditional', condFormula: { type: 'roleAssignedTo', roleId: 'supportRole' } }));
		f.state.assignments.push(f.assignment('supportOld', 'ordinary', 'supportRole'));
		const oldMember = requirePresent((await f.service.getCurrentStaff()).find(s => s.userId === 'ordinary'));
		f.state.assignments = f.state.assignments.filter(a => a.id !== 'supportOld');
		f.state.assignments.push(f.assignment('supportNew', 'ordinary', 'supportRole'));
		const currentMember = requirePresent((await f.service.getCurrentStaff()).find(s => s.userId === 'ordinary'));
		expect(currentMember.eligibilityKey).not.toBe(oldMember.eligibilityKey);
		expect(currentRegistrationVote({ ordinary: storedVote(oldMember) }, currentMember)).toBeNull();
	});

	test('enumeration failures propagate instead of producing an empty electorate', async () => {
		const f = reviewFixture();
		const manager = { findOneOrFail: vi.fn().mockRejectedValue(new Error('metadata lookup failed')) } as never;
		await expect(f.service.getCurrentStaff(manager)).rejects.toThrow('metadata lookup failed');
	});
});

describe('registration review votes and decision boundary', () => {
	test('opposition is recorded with its reason, keeps pending data and logs no applicant/reason content', async () => {
		const f = reviewFixture();
		const reason = '本人への確認が必要 private@example.test';
		await f.service.vote('application1', 'mod1', await f.revision(), 'oppose', reason);
		expect(f.state.application).toMatchObject({ status: 'pending', reviewVersion: 1, email: 'applicant@example.test', additionalContacts: '@applicant@social.example.test', reviewVotes: { mod1: { userId: 'mod1', choice: 'oppose', reason } } });
		expect(f.state.logs).toEqual([{ id: 'log1', userId: 'mod1', type: 'voteRegistrationApplication', info: { applicationId: 'application1', choice: 'oppose' } }]);
		expect(JSON.stringify(f.state.logs)).not.toContain(reason);
		expect(f.operations.findOne).toHaveBeenCalledWith(MiRegistrationApplication, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
		expect(f.operations.query.mock.calls.map(([sql]) => sql)).toEqual([
			'SET LOCAL lock_timeout = \'3s\'', 'LOCK TABLE "user" IN SHARE ROW EXCLUSIVE MODE', 'LOCK TABLE "role", "role_assignment" IN SHARE MODE',
		]);
		expect(f.operations.meta).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_read' } }));
	});

	test.each(['root1', 'ordinary', 'missing'])('%s cannot submit a moderator vote', async actor => {
		const f = reviewFixture();
		await expect(f.service.vote('application1', actor, await f.revision(), 'agree', '')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		expect(f.operations.update).not.toHaveBeenCalled();
		expect(f.state.logs).toEqual([]);
	});

	test('a stale revision does not overwrite a previous vote', async () => {
		const f = reviewFixture();
		const original = await f.revision();
		await f.service.vote('application1', 'mod1', original, 'agree', '');
		await expect(f.service.vote('application1', 'mod1', original, 'oppose', '追加の確認が必要')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_CHANGED' });
		expect(requirePresent(f.state.application).reviewVotes.mod1.choice).toBe('agree');
		expect(f.state.logs).toHaveLength(1);
	});

	test('an agreement memo is not reused when opposition has no substantive reason', async () => {
		const f = reviewFixture();
		await f.service.vote('application1', 'mod1', await f.revision(), 'agree', '確認済み');
		await expect(f.service.vote('application1', 'mod1', await f.revision(), 'oppose', '\u200b')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_REASON_REQUIRED' });
		expect(requirePresent(f.state.application).reviewVotes.mod1).toMatchObject({ choice: 'agree', reason: '確認済み' });
		expect(requirePresent(f.state.application).reviewVersion).toBe(1);
		expect(f.state.logs).toHaveLength(1);
	});

	test('a current revision can update the actor vote without changing other voters', async () => {
		const f = reviewFixture();
		await f.service.vote('application1', 'mod1', await f.revision(), 'agree', '');
		await f.service.vote('application1', 'admin1', await f.revision(), 'agree', '');
		await f.service.vote('application1', 'mod1', await f.revision(), 'oppose', '確認が必要');
		expect(requirePresent(f.state.application).reviewVotes.admin1.choice).toBe('agree');
		expect(requirePresent(f.state.application).reviewVotes.mod1.choice).toBe('oppose');
		expect(requirePresent(f.state.application).reviewVersion).toBe(3);
	});

	test.each(['approved', 'rejected'])('a %s application cannot be voted on again', async status => {
		const f = reviewFixture();
		requirePresent(f.state.application).status = status;
		await expect(f.service.vote('application1', 'mod1', await f.revision(), 'agree', '')).rejects.toMatchObject({ code: 'ALREADY_PROCESSED' });
		expect(f.operations.update).not.toHaveBeenCalled();
	});

	test('a deleted application cannot be recreated through voting', async () => {
		const f = reviewFixture();
		const revision = await f.revision();
		f.state.application = null;
		await expect(f.service.vote('application1', 'mod1', revision, 'agree', '')).rejects.toMatchObject({ code: 'NO_SUCH_APPLICATION' });
		expect(f.operations.update).not.toHaveBeenCalled();
	});

	test.each(['registrationClosed', 'disableRegistration'] as const)('locked metadata enforces registration mode: %s', async field => {
		const f = reviewFixture();
		const revision = await f.revision();
		f.state.meta[field] = field === 'registrationClosed';
		await expect(f.service.vote('application1', 'mod1', revision, 'agree', '')).rejects.toMatchObject({ code: 'REGISTRATION_APPLICATIONS_DISABLED' });
		expect(f.operations.update).not.toHaveBeenCalled();
	});

	test.each(['beforeLog', 'beforeCommit'] as const)('failure at %s rolls back the vote, version and log together', async point => {
		const f = reviewFixture();
		f.hooks[point] = () => { throw new Error(`failure at ${point}`); };
		await expect(f.service.vote('application1', 'mod1', await f.revision(), 'agree', '')).rejects.toThrow(`failure at ${point}`);
		expect(f.state.application).toMatchObject({ reviewVotes: {}, reviewVersion: 0, status: 'pending' });
		expect(f.state.logs).toEqual([]);
		expect(f.state.rollbacks).toBe(1);
	});

	test('expiry during a transaction rolls back the staged vote and log', async () => {
		const f = reviewFixture();
		f.state.assignments[0].expiresAt = new Date(now + 1);
		const revision = await f.revision();
		f.hooks.afterUpdate = () => vi.setSystemTime(now + 1);
		await expect(f.service.vote('application1', 'mod1', revision, 'agree', '')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_CHANGED' });
		expect(f.state.application).toMatchObject({ reviewVotes: {}, reviewVersion: 0 });
		expect(f.state.logs).toEqual([]);
	});

	test('failure to acquire the authority locks prevents vote and log writes', async () => {
		const f = reviewFixture();
		f.operations.query.mockImplementation(sql => {
			if (sql.startsWith('LOCK TABLE')) throw new Error('lock timeout');
		});
		await expect(f.service.vote('application1', 'mod1', await f.revision(), 'agree', '')).rejects.toThrow('lock timeout');
		expect(f.operations.update).not.toHaveBeenCalled();
		expect(f.state.logs).toEqual([]);
	});

	test('serialized concurrent submissions with the same revision accept exactly one', async () => {
		const f = reviewFixture();
		const revision = await f.revision();
		const results = await Promise.allSettled([
			f.service.vote('application1', 'mod1', revision, 'agree', ''),
			f.service.vote('application1', 'admin1', revision, 'agree', ''),
		]);
		expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
		expect(results[1]).toMatchObject({ reason: { code: 'REGISTRATION_REVIEW_CHANGED' } });
		expect(f.state.commits).toBe(1);
		expect(f.state.logs).toHaveLength(1);
	});
});

describe('registration final consent and display', () => {
	test('only root may obtain a final-decision context', async () => {
		const f = reviewFixture();
		const revision = await f.revision();
		for (const actor of ['admin1', 'mod1', 'ordinary']) {
			await expect(f.service.lockReview(f.db.manager, requirePresent(f.state.application), actor, revision, true)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		}
		await expect(f.service.lockReview(f.db.manager, requirePresent(f.state.application), 'root1', revision, true)).resolves.toMatchObject({ actor: { userId: 'root1', isRoot: true } });
	});

	test('waiting and opposing votes block final approval until every current non-root staff member agrees', async () => {
		const f = reviewFixture();
		for (const choice of [null, 'oppose', 'agree'] as const) {
			const staff = await f.service.getCurrentStaff();
			requirePresent(f.state.application).reviewVotes = Object.fromEntries(staff.filter(s => !s.isRoot && (s.userId !== 'mod1' || choice !== null)).map(s => [s.userId, storedVote(s, s.userId === 'mod1' ? requirePresent(choice) : 'agree', '理由')]));
			const ctx = await f.service.lockReview(f.db.manager, requirePresent(f.state.application), 'root1', await f.revision(), true);
			const packed = f.service.packReview(requirePresent(f.state.application), staff, ctx.actor);
			if (choice === 'agree') {
				expect(() => f.service.assertUnanimous(ctx)).not.toThrow();
				expect(packed.canFinalize).toBe(true);
			} else {
				expect(() => f.service.assertUnanimous(ctx)).toThrow(expect.objectContaining({ code: 'REGISTRATION_REVIEW_NOT_UNANIMOUS' }));
				expect(packed.canFinalize).toBe(false);
			}
		}
	});

	test('new staff need a new vote; departed opposing staff remain in history but cannot block approval', async () => {
		const f = reviewFixture();
		let staff = await f.service.getCurrentStaff();
		requirePresent(f.state.application).reviewVotes = Object.fromEntries(staff.filter(s => !s.isRoot).map(s => [s.userId, storedVote(s, s.userId === 'mod1' ? 'oppose' : 'agree', '確認待ち')]));
		const oldRevision = await f.revision();
		f.state.assignments = f.state.assignments.filter(a => a.userId !== 'mod1');
		staff = await f.service.getCurrentStaff();
		const root = requirePresent(staff.find(s => s.isRoot));
		const afterDeparture = f.service.packReview(requirePresent(f.state.application), staff, root);
		expect(afterDeparture).toMatchObject({ requiredCount: 1, agreeCount: 1, opposeCount: 0, canFinalize: true });
		expect(afterDeparture.voters.find(v => v.userId === 'mod1')).toMatchObject({ isCurrent: false, choice: 'oppose', reason: '確認待ち' });
		await expect(f.service.lockReview(f.db.manager, requirePresent(f.state.application), 'root1', oldRevision, true)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_CHANGED' });
		f.state.assignments.push(f.assignment('newGrant', 'ordinary', 'modRole'));
		staff = await f.service.getCurrentStaff();
		expect(f.service.packReview(requirePresent(f.state.application), staff, root)).toMatchObject({ requiredCount: 2, waitingCount: 1, canFinalize: false });
	});

	test('a root change invalidates the revision and denies the old root final authority', async () => {
		const f = reviewFixture();
		const revision = await f.revision();
		f.state.meta.rootUserId = 'ordinary';
		await expect(f.service.lockReview(f.db.manager, requirePresent(f.state.application), 'root1', revision, true)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_FORBIDDEN' });
		await expect(f.service.lockReview(f.db.manager, requirePresent(f.state.application), 'ordinary', revision, true)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_CHANGED' });
	});

	test('final-decision recording erases review reasons and fixes the decision electorate', async () => {
		const f = reviewFixture();
		const staff = await f.service.getCurrentStaff();
		requirePresent(f.state.application).reviewVotes = Object.fromEntries(staff.filter(s => !s.isRoot).map(s => [s.userId, storedVote(s, 'agree', 'private review comment')]));
		const revision = await f.revision();
		await f.db.transaction(async manager => {
			const app = await manager.findOne(MiRegistrationApplication, { where: { id: 'application1' } });
			const context = await f.service.lockReview(manager, requirePresent(app), 'root1', revision, true);
			f.service.assertUnanimous(context);
			await manager.update(MiRegistrationApplication, requirePresent(app).id, { status: 'approved' });
			await f.service.recordDecision(manager, context, true);
		});
		expect(f.state.application).toMatchObject({ status: 'approved', reviewVersion: 1, reviewDecision: { actor: { userId: 'root1' }, voterIds: ['admin1', 'mod1'] } });
		expect(Object.values(requirePresent(f.state.application).reviewVotes).map(v => v.reason)).toEqual(['', '']);
		expect(f.state.logs[0]).toMatchObject({ userId: 'root1', type: 'approveRegistrationApplication', info: { applicationId: 'application1' } });
		f.state.assignments.push(f.assignment('newGrant', 'ordinary', 'modRole'));
		const currentStaff = await f.service.getCurrentStaff();
		const packed = f.service.packReview(requirePresent(f.state.application), currentStaff, requirePresent(currentStaff.find(s => s.isRoot)));
		expect(packed).toMatchObject({ requiredCount: 2, agreeCount: 2, canFinalize: false, canVote: false, decidedBy: { userId: 'root1' } });
		expect(packed.voters.map(v => v.userId)).not.toContain('ordinary');
		expect(JSON.stringify(packed)).not.toContain('private review comment');
	});

	test('decision log failure rolls the staged decision and reason erasure back', async () => {
		const f = reviewFixture();
		const staff = await f.service.getCurrentStaff();
		requirePresent(f.state.application).reviewVotes = Object.fromEntries(staff.filter(s => !s.isRoot).map(s => [s.userId, storedVote(s, 'oppose', '理由を保持')]));
		const revision = await f.revision();
		f.hooks.beforeLog = () => { throw new Error('log insert failed'); };
		await expect(f.db.transaction(async manager => {
			const app = await manager.findOne(MiRegistrationApplication, { where: { id: 'application1' } });
			const context = await f.service.lockReview(manager, requirePresent(app), 'root1', revision, true);
			await manager.update(MiRegistrationApplication, requirePresent(app).id, { status: 'rejected' });
			await f.service.recordDecision(manager, context, false);
		})).rejects.toThrow('log insert failed');
		expect(f.state.application).toMatchObject({ status: 'pending', reviewVersion: 0, reviewDecision: null });
		expect(Object.values(requirePresent(f.state.application).reviewVotes).map(v => v.reason)).toEqual(['理由を保持', '理由を保持']);
		expect(f.state.logs).toEqual([]);
	});

	test('terminal rejection preserves uncast and invalidated votes as waiting in the decision snapshot', async () => {
		const f = reviewFixture();
		const original = requirePresent((await f.service.getCurrentStaff()).find(s => s.userId === 'mod1'));
		requirePresent(f.state.application).reviewVotes = { mod1: storedVote(original) };
		f.state.assignments[0] = f.assignment('reappointedMod', 'mod1', 'modRole');
		const revision = await f.revision();
		await f.db.transaction(async manager => {
			const app = await manager.findOne(MiRegistrationApplication, { where: { id: 'application1' } });
			const context = await f.service.lockReview(manager, requirePresent(app), 'root1', revision, true);
			await manager.update(MiRegistrationApplication, requirePresent(app).id, { status: 'rejected' });
			await f.service.recordDecision(manager, context, false);
		});
		const staff = await f.service.getCurrentStaff();
		const packed = f.service.packReview(requirePresent(f.state.application), staff, requirePresent(staff.find(s => s.isRoot)));
		expect(packed).toMatchObject({ requiredCount: 2, waitingCount: 2, agreeCount: 0, opposeCount: 0, canFinalize: false });
		expect(packed.voters).toEqual(expect.arrayContaining([
			expect.objectContaining({ userId: 'mod1', choice: null, votedAt: null }),
			expect.objectContaining({ userId: 'admin1', choice: null, votedAt: null }),
		]));
	});

	test('approval excludes only its newly created conditional moderator from the final electorate recheck', async () => {
		const f = reviewFixture();
		f.state.roles.push(f.role('allLocalStaff', { target: 'conditional', condFormula: { type: 'isLocal' } }));
		const staff = await f.service.getCurrentStaff();
		requirePresent(f.state.application).reviewVotes = Object.fromEntries(staff.filter(s => !s.isRoot).map(s => [s.userId, storedVote(s)]));
		const revision = await f.revision();
		await f.db.transaction(async manager => {
			const app = await manager.findOne(MiRegistrationApplication, { where: { id: 'application1' } });
			const context = await f.service.lockReview(manager, requirePresent(app), 'root1', revision, true);
			f.service.assertUnanimous(context);
			f.state.users.push(f.user('newApplicant'));
			// Positive control: without the explicit newly created ID, the changed
			// roster is detected. This does not exempt arbitrary other staff.
			await expect(f.service.assertContextUnchanged(manager, context)).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_CHANGED' });
			await manager.update(MiRegistrationApplication, requirePresent(app).id, { status: 'approved' });
			await f.service.recordDecision(manager, context, true, 'newApplicant');
		});
		expect(requirePresent(f.state.application).status).toBe('approved');
		expect(requirePresent(requirePresent(f.state.application).reviewDecision).voterIds).toEqual(['admin1', 'mod1', 'ordinary']);
		expect(requirePresent(requirePresent(f.state.application).reviewDecision).voters.map(v => v.userId)).not.toContain('newApplicant');
		expect(f.state.commits).toBe(1);
	});

	test('excluding a created applicant still catches another user newly qualifying for a conditional role', async () => {
		const f = reviewFixture();
		f.state.roles.push(f.role('lockedStaff', { target: 'conditional', condFormula: { type: 'isLocked' } }));
		const context = await f.service.lockReview(f.db.manager, requirePresent(f.state.application), 'root1', await f.revision(), true);
		f.state.users.push(f.user('newApplicant', { isLocked: true }));
		requirePresent(f.state.users.find(u => u.id === 'ordinary')).isLocked = true;
		await expect(f.service.assertContextUnchanged(f.db.manager, context, 'newApplicant')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_CHANGED' });
	});

	test('excluding a created applicant still catches expiry of an existing moderator assignment', async () => {
		const f = reviewFixture();
		f.state.assignments[0].expiresAt = new Date(now + 1);
		const context = await f.service.lockReview(f.db.manager, requirePresent(f.state.application), 'root1', await f.revision(), true);
		f.state.users.push(f.user('newApplicant'));
		vi.setSystemTime(now + 1);
		await expect(f.service.assertContextUnchanged(f.db.manager, context, 'newApplicant')).rejects.toMatchObject({ code: 'REGISTRATION_REVIEW_CHANGED' });
	});
});
