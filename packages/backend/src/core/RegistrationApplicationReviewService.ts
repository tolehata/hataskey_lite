/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { MiMeta } from '@/models/Meta.js';
import { MiUser } from '@/models/User.js';
import { MiRole } from '@/models/Role.js';
import { MiRoleAssignment } from '@/models/RoleAssignment.js';
import { MiModerationLog } from '@/models/ModerationLog.js';
import { MiRegistrationApplication } from '@/models/RegistrationApplication.js';
import type { RegistrationReviewVote } from '@/models/RegistrationApplication.js';
import { RoleService } from '@/core/RoleService.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '@/server/api/error.js';
import { assertRegistrationApplicationsEnabled, registrationApplicationApprovalErrors } from './registration-application-policy.js';
import { currentRegistrationVote, normalizeRegistrationVoteReason, registrationReviewErrors, registrationReviewRevision } from './registration-review-policy.js';
import type { EntityManager } from 'typeorm';
import type { ReviewStaff } from './registration-review-policy.js';

export type RegistrationReviewContext = { staff: ReviewStaff[]; actor: ReviewStaff; revision: string; application: MiRegistrationApplication };

@Injectable()
export class RegistrationApplicationReviewService {
	constructor(
		@Inject(DI.db) private db: DataSource,
		private roleService: RoleService,
		private idService: IdService,
	) {}

	/** Read effective staff without the role/user caches, including conditional roles and expiry. */
	public async getCurrentStaff(manager: EntityManager = this.db.manager, onlyUserId?: string): Promise<ReviewStaff[]> {
		const serverMeta = await manager.findOneOrFail(MiMeta, { where: {}, select: { id: true, rootUserId: true } });
		const roles = await manager.find(MiRole);
		const assignments = await manager.find(MiRoleAssignment, onlyUserId ? { where: { userId: onlyUserId } } : {});
		const staffRoles = roles.filter(x => x.isModerator || x.isAdministrator);
		const ids = new Set(assignments.filter(x => staffRoles.some(r => r.id === x.roleId)).map(x => x.userId));
		if (serverMeta.rootUserId) ids.add(serverMeta.rootUserId);
		const conditional = staffRoles.some(x => x.target === 'conditional');
		if (!onlyUserId && !conditional && ids.size === 0) return [];
		const users = await manager.find(MiUser, {
			where: { host: IsNull(), isDeleted: false, isSuspended: false, ...(onlyUserId ? { id: onlyUserId } : conditional ? {} : { id: In([...ids]) }) },
			select: {
				id: true, name: true, username: true, host: true, isDeleted: true, isSuspended: true,
				isLocked: true, isBot: true, isCat: true, isExplorable: true, followersCount: true, followingCount: true, notesCount: true,
			},
		});
		// Evaluate expiry after database reads, so an assignment that expires while
		// loading users cannot survive the final authority recheck.
		const now = Date.now();
		return users.flatMap(user => {
			const grants = assignments.filter(x => x.userId === user.id && (x.expiresAt == null || x.expiresAt.getTime() > now));
			const assigned = roles.filter(r => grants.some(a => a.roleId === r.id));
			const effective = staffRoles.filter(r => assigned.includes(r) || (r.target === 'conditional' && this.roleService.evalCond(user, assigned, r.condFormula, now)));
			const isRoot = user.id === serverMeta.rootUserId;
			if (!isRoot && effective.length === 0) return [];
			// A reappointment or changed authority requires a fresh vote. Ordinary profile changes do not.
			const eligibilityKey = createHash('sha256').update(JSON.stringify([
				isRoot, effective.map(r => [
					r.id, r.target, r.isModerator, r.isAdministrator, r.condFormula,
					grants.filter(a => r.target === 'conditional' || a.roleId === r.id).map(a => [a.id, a.roleId, a.expiresAt]).sort(),
				]).sort(),
			])).digest('hex');
			return [{
				userId: user.id, name: user.name, username: user.username, isRoot,
				isAdministrator: isRoot || effective.some(r => r.isAdministrator), eligibilityKey,
			}];
		}).sort((a, b) => a.userId.localeCompare(b.userId));
	}

	public async getCurrentStaffMember(userId: string): Promise<ReviewStaff | null> {
		return (await this.getCurrentStaff(this.db.manager, userId))[0] ?? null;
	}

	public async assertStaff(userId: string): Promise<ReviewStaff> {
		const member = await this.getCurrentStaffMember(userId);
		if (!member) throw new ApiError(registrationReviewErrors.forbidden);
		return member;
	}

	public async assertRoot(userId: string): Promise<void> {
		if (!(await this.assertStaff(userId)).isRoot) throw new ApiError(registrationReviewErrors.forbidden);
	}

	public packReview(application: MiRegistrationApplication, staff: ReviewStaff[], viewer: ReviewStaff) {
		const votes = application.reviewVotes ?? {};
		const current = staff.filter(x => !x.isRoot);
		const pending = application.status === 'pending';
		const voters = current.map(member => {
			const vote = currentRegistrationVote(votes, member);
			return {
				userId: member.userId, name: member.name, username: member.username, isCurrent: true,
				choice: vote?.choice ?? null, reason: pending ? vote?.reason ?? null : null, votedAt: vote?.votedAt ?? null,
			};
		});
		for (const vote of Object.values(votes)) {
			if (current.some(x => x.userId === vote.userId)) continue;
			voters.push({
				userId: vote.userId, name: vote.name, username: vote.username ?? '', isCurrent: false,
				choice: vote.choice, reason: pending ? vote.reason : null, votedAt: vote.votedAt,
			});
		}
		if (!pending) {
			// Preserve uncast votes and actor names at the decision, even after retirement/deletion.
			const snapshot = application.reviewDecision?.voters ?? [];
			voters.splice(0, voters.length, ...snapshot.map(voter => ({ ...voter, username: voter.username ?? '', isCurrent: true, reason: null })));
			for (const vote of Object.values(votes)) {
				if (snapshot.some(x => x.userId === vote.userId)) continue;
				voters.push({ userId: vote.userId, name: vote.name, username: vote.username ?? '', isCurrent: false, choice: vote.choice, reason: null, votedAt: vote.votedAt });
			}
		}
		const required = voters.filter(x => x.isCurrent);
		const agreeCount = required.filter(x => x.choice === 'agree').length;
		const opposeCount = required.filter(x => x.choice === 'oppose').length;
		return {
			revision: registrationReviewRevision(application, staff), voters,
			requiredCount: required.length, agreeCount, opposeCount, waitingCount: required.length - agreeCount - opposeCount,
			myChoice: currentRegistrationVote(votes, viewer)?.choice ?? null,
			canVote: pending && !viewer.isRoot, canFinalize: pending && viewer.isRoot && agreeCount === required.length,
			isRoot: viewer.isRoot, decidedBy: application.reviewDecision?.actor ?? null, decidedAt: application.reviewDecision?.at ?? null,
		};
	}

	/** Called after locking the application; all authority inputs remain stable until commit.
	 * The user table lock also covers conditional-role changes/new qualifying users. Keep crypto outside it.
	 */
	public async lockReview(manager: EntityManager, application: MiRegistrationApplication, actorId: string, revision: string, final: boolean): Promise<RegistrationReviewContext> {
		await manager.query('SET LOCAL lock_timeout = \'3s\'');
		await manager.query('LOCK TABLE "user" IN SHARE ROW EXCLUSIVE MODE');
		await manager.query('LOCK TABLE "role", "role_assignment" IN SHARE MODE');
		const serverMeta = await manager.findOneOrFail(MiMeta, { where: {}, lock: { mode: 'pessimistic_read' } });
		assertRegistrationApplicationsEnabled(serverMeta);
		const staff = await this.getCurrentStaff(manager);
		const actor = staff.find(x => x.userId === actorId);
		if (!actor || actor.isRoot !== final) throw new ApiError(registrationReviewErrors.forbidden);
		if (application.status !== 'pending') throw new ApiError(registrationApplicationApprovalErrors.alreadyProcessed);
		if (registrationReviewRevision(application, staff) !== revision) throw new ApiError(registrationReviewErrors.changed);
		return { staff, actor, revision, application };
	}

	public assertUnanimous(context: RegistrationReviewContext): void {
		if (context.staff.some(x => !x.isRoot && currentRegistrationVote(context.application.reviewVotes ?? {}, x)?.choice !== 'agree')) {
			throw new ApiError(registrationReviewErrors.notUnanimous);
		}
	}

	public async assertContextUnchanged(manager: EntityManager, context: RegistrationReviewContext, createdUserId?: string): Promise<void> {
		// Time-based assignments/conditions can expire even while their rows are locked.
		if (registrationReviewRevision(context.application, (await this.getCurrentStaff(manager)).filter(member => member.userId !== createdUserId)) !== context.revision) {
			throw new ApiError(registrationReviewErrors.changed);
		}
	}

	public async recordDecision(manager: EntityManager, context: RegistrationReviewContext, approved: boolean, createdUserId?: string): Promise<void> {
		const { actor, application, staff } = context;
		const votes = Object.fromEntries(Object.entries(application.reviewVotes ?? {}).map(([id, vote]) => [id, { ...vote, reason: '' }]));
		await manager.update(MiRegistrationApplication, application.id, {
			reviewVotes: votes, reviewVersion: application.reviewVersion + 1,
			reviewDecision: {
				actor: { userId: actor.userId, name: actor.name, username: actor.username }, at: new Date().toISOString(),
				voterIds: staff.filter(x => !x.isRoot).map(x => x.userId),
				voters: staff.filter(x => !x.isRoot).map(member => {
					const vote = currentRegistrationVote(application.reviewVotes ?? {}, member);
					return { userId: member.userId, name: member.name, username: member.username, choice: vote?.choice ?? null, votedAt: vote?.votedAt ?? null };
				}),
			},
		});
		await this.writeLog(manager, actor.userId, approved ? 'approveRegistrationApplication' : 'rejectRegistrationApplication', { applicationId: application.id });
		await this.assertContextUnchanged(manager, context, approved ? createdUserId : undefined);
	}

	public async writeLog(manager: EntityManager, userId: string, type: string, info: Record<string, string>): Promise<void> {
		await manager.insert(MiModerationLog, { id: this.idService.gen(), userId, type, info: info as MiModerationLog['info'] });
	}

	public async vote(applicationId: string, actorId: string, revision: string, choice: 'agree' | 'oppose', inputReason: string): Promise<void> {
		const reason = normalizeRegistrationVoteReason(choice, inputReason);
		if ((await this.assertStaff(actorId)).isRoot) throw new ApiError(registrationReviewErrors.forbidden);
		await this.db.transaction(async manager => {
			const application = await manager.findOne(MiRegistrationApplication, { where: { id: applicationId }, lock: { mode: 'pessimistic_write' }, select: { id: true, status: true, reviewVersion: true, reviewVotes: true } });
			if (!application) throw new ApiError(registrationApplicationApprovalErrors.noSuchApplication);
			const context = await this.lockReview(manager, application, actorId, revision, false);
			const { actor } = context;
			const vote: RegistrationReviewVote = { userId: actor.userId, name: actor.name, username: actor.username, choice, reason, votedAt: new Date().toISOString(), eligibilityKey: actor.eligibilityKey };
			await manager.update(MiRegistrationApplication, application.id, { reviewVotes: { ...application.reviewVotes, [actor.userId]: vote }, reviewVersion: application.reviewVersion + 1 });
			await this.writeLog(manager, actor.userId, 'voteRegistrationApplication', { applicationId, choice });
			await this.assertContextUnchanged(manager, context);
		});
	}
}
