/* SPDX-License-Identifier: AGPL-3.0-only */
import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { NotesRepository, UtageSessionsRepository } from '@/models/_.js';
import { MiNote } from '@/models/Note.js';
import { MiUser } from '@/models/User.js';
import { MiNoteReaction } from '@/models/NoteReaction.js';
import { MiUtageSession } from '@/models/UtageSession.js';
import { IdService } from '@/core/IdService.js';
import { QueueService } from '@/core/QueueService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { AchievementService } from '@/core/AchievementService.js';
import { USER_ONLINE_THRESHOLD } from '@/const.js';
import { isUtageEligible } from '@/misc/utage.js';
import { drawRevival, UTAGE_REVIVAL_RULES, utageSnapshot } from '@/misc/utage-revival.js';
import type { EntityManager } from 'typeorm';

type Actor = Pick<MiUser, 'id' | 'host'>;
type Target = Pick<MiNote, 'id' | 'userId' | 'userHost'> & Partial<Pick<MiNote, 'text' | 'cw'>>;
type Phase = 'normal' | 'revival';
type ReactionKind = 'reaction' | 'reply' | 'renote';
const active = (s: MiUtageSession) => s.status === 'running' || s.status === 'reviving';

@Injectable()
export class UtageService {
	constructor(
		@Inject(DI.utageSessionsRepository) private utageSessionsRepository: UtageSessionsRepository,
		private idService: IdService,
		private queueService: QueueService,
		private globalEventService: GlobalEventService,
		private achievementService: AchievementService,
		@Inject(DI.notesRepository) private notesRepository: NotesRepository,
	) {}

	public isCandidate(note: Target): boolean {
		return note.userHost == null && /宴|うたげ|ぅたげ|utage/i.test(`${note.text ?? ''} ${note.cw ?? ''}`);
	}

	public async lock(manager: EntityManager, noteId: string) {
		return manager.findOne(MiUtageSession, { where: { noteId }, lock: { mode: 'pessimistic_write' } });
	}

	private async now(manager: EntityManager): Promise<Date> {
		const [row] = await manager.query('SELECT clock_timestamp() AS now');
		return new Date(row.now);
	}

	private finish(session: MiUtageSession, success: boolean, now: Date) {
		session.successMethod = success ? (session.status === 'reviving' ? 'revival' : 'normal') : null;
		session.status = success ? 'succeeded' : 'failed';
		session.resolvedAt = now;
	}

	private async save(manager: EntityManager, session: MiUtageSession) {
		session.revision++;
		return manager.save(MiUtageSession, session);
	}

	/** Called inside the note insert transaction, before it becomes visible. */
	public async onNoteSaved(manager: EntityManager, note: MiNote, user: Actor, parents: { note: MiNote; kind: ReactionKind }[] = []): Promise<MiUtageSession[]> {
		const changed: MiUtageSession[] = [];
		const targets = [...new Map(parents.filter(p => this.isCandidate(p.note)).map(p => [p.note.id, p])).values()].sort((a, b) => a.note.id.localeCompare(b.note.id));
		for (const target of targets) {
			const session = await this.lock(manager, target.note.id);
			if (session && await this.applyReaction(manager, session, user, target.kind)) changed.push(session);
		}
		if (user.host == null && isUtageEligible(note)) {
			const startedAt = this.idService.parse(note.id).date;
			const session = manager.create(MiUtageSession, {
				id: this.idService.gen(), noteId: note.id, userId: user.id, startedAt,
				expiresAt: new Date(startedAt.getTime() + 900_000), status: 'running', resolvedAt: null,
				ruleVersion: UTAGE_REVIVAL_RULES.version, revision: 1, publishedRevision: 0,
				revivalStartedAt: null, revivalExpiresAt: null, revivalOnlineCount: null, revivalTargetCount: null,
				revivalExcludedUserIds: [], revivalSupporterIds: [], successMethod: null,
				interruptedByUserId: null, interruptedWithin5Seconds: false,
			});
			await manager.insert(MiUtageSession, session);
			changed.push(session);
		}
		return changed;
	}

	/** The note reaction and receipt commit together; a duplicate insert rolls both back. */
	public async saveReaction(note: MiNote, user: Actor, reaction: MiNoteReaction): Promise<void> {
		if (!this.isCandidate(note)) {
			await this.utageSessionsRepository.manager.insert(MiNoteReaction, reaction);
			return;
		}
		let changed: MiUtageSession | null = null;
		await this.utageSessionsRepository.manager.transaction(async manager => {
			const session = await this.lock(manager, note.id);
			await manager.insert(MiNoteReaction, reaction);
			if (session && await this.applyReaction(manager, session, user, 'reaction')) changed = session;
		});
		if (changed) await this.afterCommit([changed]);
	}

	public async removeReaction(note: MiNote, reactionId: string) {
		if (!this.isCandidate(note)) return this.utageSessionsRepository.manager.delete(MiNoteReaction, reactionId);
		return this.utageSessionsRepository.manager.transaction(async manager => {
			await this.lock(manager, note.id);
			// Serializes the initial exclusion snapshot. Accepted receipts remain cumulative.
			return manager.delete(MiNoteReaction, reactionId);
		});
	}

	private async applyReaction(manager: EntityManager, session: MiUtageSession, actor: Actor, kind: ReactionKind): Promise<boolean> {
		if (!active(session)) return false;
		const now = await this.now(manager);
		const note = await manager.findOneBy(MiNote, { id: session.noteId });
		if (!note || !isUtageEligible(note)) {
			this.finish(session, false, now);
		} else if (session.status === 'running') {
			if (now >= session.expiresAt) {
				this.finish(session, true, now);
			} else {
				session.interruptedByUserId = actor.id;
				const elapsed = now.getTime() - session.startedAt.getTime();
				session.interruptedWithin5Seconds = actor.id !== session.userId && elapsed >= 0 && elapsed <= 5000;
				let chance: ReturnType<typeof drawRevival> = null;
				if (session.ruleVersion >= 1 && actor.id !== session.userId && randomInt(10_000) < UTAGE_REVIVAL_RULES.probability) {
					const reactions = await manager.find(MiNoteReaction, { where: { noteId: session.noteId }, select: { userId: true } });
					session.revivalExcludedUserIds = [...new Set(reactions.map(r => r.userId))];
					const online = await manager.createQueryBuilder(MiUser, 'user')
						.where('user.host IS NULL AND user.isBot = false AND user.isSuspended = false AND user.isDeleted = false')
						.andWhere('user.lastActiveDate > :since', { since: new Date(now.getTime() - USER_ONLINE_THRESHOLD) })
						.andWhere('user.id != :author', { author: session.userId })
						.andWhere('NOT (user.id = ANY(:excluded))', { excluded: session.revivalExcludedUserIds })
						.getCount();
					chance = drawRevival(online);
					if (chance) session.revivalOnlineCount = online;
				}
				if (chance) {
					session.status = 'reviving';
					session.revivalStartedAt = now;
					session.revivalExpiresAt = new Date(now.getTime() + chance.seconds * 1000);
					session.revivalTargetCount = chance.target;
				} else this.finish(session, false, now);
			}
		} else if (now >= session.revivalExpiresAt!) {
			this.finish(session, false, now);
		} else {
			if (kind !== 'reaction' || actor.id === session.userId || session.revivalExcludedUserIds.includes(actor.id) || session.revivalSupporterIds.includes(actor.id)) return false;
			const user = await manager.findOneBy(MiUser, { id: actor.id });
			if (!user || user.host != null || user.isBot || user.isSuspended || user.isDeleted) return false;
			session.revivalSupporterIds.push(actor.id);
			if (session.revivalSupporterIds.length >= session.revivalTargetCount!) this.finish(session, true, now);
		}
		await this.save(manager, session);
		return true;
	}

	/** Caller locks the session before saving the edited note. */
	public async onNoteUpdatedInTransaction(manager: EntityManager, previous: MiNote, updated: MiNote, session: MiUtageSession | null) {
		if (!session || !active(session) || (isUtageEligible(previous) && isUtageEligible(updated))) return null;
		this.finish(session, false, await this.now(manager));
		return this.save(manager, session);
	}

	public async resolveExpired(noteId: string, phase: Phase = 'normal'): Promise<void> {
		let changed: MiUtageSession | null = null;
		await this.utageSessionsRepository.manager.transaction(async manager => {
			const session = await this.lock(manager, noteId);
			if (!session || session.status !== (phase === 'normal' ? 'running' : 'reviving')) return;
			const now = await this.now(manager);
			if (now < (phase === 'normal' ? session.expiresAt : session.revivalExpiresAt!)) return;
			const note = await manager.findOneBy(MiNote, { id: noteId });
			this.finish(session, phase === 'normal' && note != null && isUtageEligible(note), now);
			changed = await this.save(manager, session);
		});
		if (changed) await this.afterCommit([changed]);
	}

	/** Failures stay pending for recovery; a committed reaction must not be reported as failed. */
	public async afterCommit(sessions: MiUtageSession[]): Promise<void> {
		for (const session of sessions) {
			try {
				if (active(session)) {
					const revival = session.status === 'reviving';
					await this.queueService.createUtageResolveJob(session.noteId, Math.max(0, (revival ? session.revivalExpiresAt! : session.expiresAt).getTime() - Date.now()), revival ? 'revival' : 'normal');
				} else if (session.status === 'succeeded') {
					await this.achievementService.reconcileUtageAchievements(session.userId, 'success');
				} else if (session.interruptedByUserId) {
					const actor = await this.notesRepository.manager.findOneBy(MiUser, { id: session.interruptedByUserId });
					if (actor && actor.host == null) await this.achievementService.reconcileUtageAchievements(actor.id, 'interruption');
				}
				const note = await this.notesRepository.manager.findOneBy(MiNote, { id: session.noteId });
				if (note != null) {
					await this.globalEventService.publishNoteStream(note,
						'utageStatusUpdated', { status: session.status as ReturnType<typeof utageSnapshot>['utageStatus'], ...utageSnapshot(session) });
				}
				await this.utageSessionsRepository.createQueryBuilder().update()
					.set({ publishedRevision: session.revision }).where('id = :id AND "publishedRevision" < :revision', { id: session.id, revision: session.revision }).execute();
			} catch (error) { console.error('[utage] pending side effects will be retried:', error); }
		}
	}

	/** Recovers lost deadline jobs and interrupted post-commit delivery after a restart. */
	public async recover(): Promise<void> {
		const expired = await this.utageSessionsRepository.createQueryBuilder('session')
			.where('(session.status = :running AND session.expiresAt <= now()) OR (session.status = :reviving AND session.revivalExpiresAt <= now())', { running: 'running', reviving: 'reviving' })
			.orderBy('session.id', 'ASC').take(200).getMany();
		for (const session of expired) await this.resolveExpired(session.noteId, session.status === 'reviving' ? 'revival' : 'normal');
		const pending = await this.utageSessionsRepository.createQueryBuilder('session')
			.where('session.publishedRevision < session.revision').orderBy('session.id', 'ASC').take(200).getMany();
		await this.afterCommit(pending);
	}
}
