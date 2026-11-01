/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomInt, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { IsNull, LessThan, MoreThan, Not } from 'typeorm';
import type { Config } from '@/config.js';
import type { MiNote } from '@/models/Note.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { MiUser } from '@/models/User.js';
import type { MiFollowing } from '@/models/Following.js';
import type { MiBlocking } from '@/models/Blocking.js';
import type { MiMuting } from '@/models/Muting.js';
import { MiHataigoGame } from '@/models/HataigoGame.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { canViewHataigo, isHataigoParticipant } from '@/misc/hataigo/access.js';
import { consumeTurn, createClock, projectClock, resumeClock } from '@/misc/hataigo/clock.js';
import { applyOnlineAction, authorizeAction, participantColor, rebuildHataigo } from '@/misc/hataigo/domain.js';
import { calculatePersonalStats } from '@/misc/hataigo/stats.js';
import type { HataigoPersonalStats } from '@/misc/hataigo/types.js';
import type { GameState } from '@/misc/hataigo/rules/game.js';
import type { BoardSize } from '@/misc/hataigo/rules/board.js';
import { HataigoError, announcementVote, emptyAnnouncementState, defaultSettings, normalizeSettings, visibilityVote } from '@/misc/hataigo/types.js';
import type { HataigoClientAction, HataigoMatchOptions, HataigoSettingsPatch, HataigoVisibilityVote } from '@/misc/hataigo/types.js';
import type { DataSource, EntityManager, Repository } from 'typeorm';

const MAX_ACTIVE_GAMES = 8;
const QUEUE_LIFETIME_MS = 30000;
const MAX_ACTIONS = 20000;
const INVITATION_LIFETIME_MS = 86400000;
const incrementLimit = 'local n=redis.call(\'INCR\',KEYS[1]);if n==1 then redis.call(\'PEXPIRE\',KEYS[1],ARGV[1]);end;return n';
const releaseLock = 'if redis.call(\'GET\',KEYS[1])==ARGV[1] then return redis.call(\'DEL\',KEYS[1]) else return 0 end';

@Injectable()
export class HataigoService {
	constructor(
		@Inject(DI.db) private db: DataSource,
		@Inject(DI.redis) private redis: Redis.Redis,
		@Inject(DI.hataigoGamesRepository) private games: Repository<MiHataigoGame>,
		@Inject(DI.usersRepository) private users: Repository<MiUser>,
		@Inject(DI.followingsRepository) private followings: Repository<MiFollowing>,
		@Inject(DI.blockingsRepository) private blockings: Repository<MiBlocking>,
		@Inject(DI.mutingsRepository) private mutings: Repository<MiMuting>,
		private ids: IdService,
		private events: GlobalEventService,
		@Inject(DI.config) private config: Config,
		@Inject(DI.notesRepository) private notes: Repository<MiNote>,
		private noteCreate: NoteCreateService,
	) {}

	@bindThis
	private local(user: MiUser): void {
		if (user.host !== null || user.isDeleted || user.isSuspended) throw new HataigoError('NOT_LOCAL');
	}

	@bindThis
	public async rateLimit(userId: string, operation: string, maximum = 120, windowMs = 60000): Promise<void> {
		const count = Number(await this.redis.eval(incrementLimit, 1, `hataigo:rate:${operation}:${userId}`, windowMs));
		if (!Number.isFinite(count) || count > maximum) throw new HataigoError('RATE_LIMIT');
	}

	@bindThis
	public async assertPairAllowed(first: string, second: string): Promise<void> {
		if (first === second) throw new HataigoError('FORBIDDEN');
		const block = await this.blockings.findOne({ where: [{ blockerId: first, blockeeId: second }, { blockerId: second, blockeeId: first }] });
		if (block) throw new HataigoError('BLOCKED');
		const mutes = await this.mutings.find({ where: [{ muterId: first, muteeId: second }, { muterId: second, muteeId: first }] });
		if (mutes.some(mute => mute.expiresAt === null || mute.expiresAt.getTime() > Date.now())) throw new HataigoError('BLOCKED');
	}

	/** Shared publication prerequisite. Private participant access has a separate authorization path. */
	@bindThis
	public async findParticipantUser(userId: string | null): Promise<MiUser | null> {
		return userId === null ? null : this.users.findOneBy({ id: userId, isDeleted: false });
	}

	@bindThis
	public async assertPublicParticipants(game: Pick<MiHataigoGame, 'user1Id' | 'user2Id'>): Promise<void> {
		const participants = await Promise.all([this.findParticipantUser(game.user1Id), this.findParticipantUser(game.user2Id)]);
		if (participants.some(user => user === null)) throw new HataigoError('NOT_FOUND');
	}

	@bindThis
	public async assertCanView(game: MiHataigoGame, viewer: MiUser | null): Promise<void> {
		if (!canViewHataigo(game, viewer?.id ?? null)) throw new HataigoError('NOT_FOUND');
		if (viewer && isHataigoParticipant(game, viewer.id)) return;
		await this.assertPublicParticipants(game);
		if (!viewer) return;
		for (const owner of [game.user1Id, game.user2Id]) {
			if (owner === null) throw new HataigoError('NOT_FOUND');
			try { await this.assertPairAllowed(viewer.id, owner); } catch (error) { if (error instanceof HataigoError && error.code === 'BLOCKED') throw new HataigoError('NOT_FOUND'); throw error; }
		}
	}

	@bindThis
	public async get(gameId: string, viewer: MiUser | null): Promise<MiHataigoGame> {
		const game = await this.games.findOneBy({ id: gameId });
		if (!game) throw new HataigoError('NOT_FOUND');
		await this.assertCanView(game, viewer);
		return game;
	}

	@bindThis
	public async list(viewer: MiUser | null, options: { my?: boolean; ongoing?: boolean; ended?: boolean; limit?: number; untilId?: string } = {}): Promise<MiHataigoGame[]> {
		const limit = Math.max(1, Math.min(50, options.limit ?? 10));
		if (options.my && !viewer) throw new HataigoError('FORBIDDEN');
		const query = this.games.createQueryBuilder('game').orderBy('game.id', 'DESC').take(100);
		if (options.ended) query.andWhere('game.phase = :ended', { ended: 'ended' });
		if (options.ongoing) query.andWhere('game.phase != :ended', { ended: 'ended' });
		if (options.my && options.ongoing) query.andWhere('(game.isInvitation = FALSE OR game.invitationAccepted = TRUE)');
		if (options.untilId) query.andWhere('game.id < :untilId', { untilId: options.untilId });
		if (options.my && viewer) query.andWhere('(game.user1Id = :viewer OR game.user2Id = :viewer)', { viewer: viewer.id });
		else query.andWhere('((game.phase IN (\'playing\',\'scoring\') AND game.allowSpectate = TRUE) OR (game.phase = \'ended\' AND game.publicAfterEnd = TRUE))');
		const result: MiHataigoGame[] = [];
		for (const game of await query.getMany()) {
			try { await this.assertCanView(game, viewer); result.push(game); } catch (error) { if (!(error instanceof HataigoError && error.code === 'NOT_FOUND')) throw error; }
			if (result.length >= limit) break;
		}
		return result;
	}

	/** Caller is always the authenticated subject; never accepts another player's ID. */
	@bindThis
	public async personalStats(me: MiUser): Promise<HataigoPersonalStats> {
		this.local(me);
		const games = await this.games.find({
			where: [{ user1Id: me.id, phase: 'ended', result: Not(IsNull()) }, { user2Id: me.id, phase: 'ended', result: Not(IsNull()) }],
			select: { id: true, phase: true, startedAt: true, endedAt: true, user1Id: true, user2Id: true, black: true, settings: true, result: true },
		});
		return calculatePersonalStats(me.id, games);
	}

	@bindThis
	private revision(game: MiHataigoGame, expected: number): void {
		if (!Number.isSafeInteger(expected) || game.revision !== expected) throw new HataigoError('STALE_REVISION');
	}

	@bindThis
	private participant(game: MiHataigoGame, me: MiUser): void {
		this.local(me);
		if (!isHataigoParticipant(game, me.id)) throw new HataigoError('FORBIDDEN');
	}

	/** Keep both deleted flags stable until a normal game mutation commits. */
	@bindThis
	private async assertPresentParticipants(game: MiHataigoGame, manager: EntityManager): Promise<void> {
		if (game.user1Id === null || game.user2Id === null) throw new HataigoError('INVALID_STATE');
		for (const id of [game.user1Id, game.user2Id].sort()) {
			const user = await manager.getRepository(MiUser).findOne({ where: { id, isDeleted: false }, lock: { mode: 'pessimistic_read' } });
			if (!user) throw new HataigoError('INVALID_STATE');
		}
	}

	@bindThis
	private async mutate(gameId: string, operation: (game: MiHataigoGame, manager: EntityManager) => Promise<void | boolean>): Promise<MiHataigoGame> {
		const saved = await this.db.transaction(async manager => {
			const repository = manager.getRepository(MiHataigoGame);
			const game = await repository.findOne({ where: { id: gameId }, lock: { mode: 'pessimistic_write' } });
			if (!game) throw new HataigoError('NOT_FOUND');
			if (await operation(game, manager) === false) return { game, changed: false };
			game.revision++;
			return { game: await repository.save(game), changed: true };
		});
		if (saved.changed) this.events.publishHataigoGameStream(saved.game.id, 'updated', { revision: saved.game.revision });
		return saved.game;
	}

	@bindThis
	private effectiveVisibility(game: MiHataigoGame): void {
		game.allowSpectate = game.visibility.user1.allowSpectate && game.visibility.user2.allowSpectate;
		game.allowSpectatorChat = game.allowSpectate && game.visibility.user1.allowSpectatorChat && game.visibility.user2.allowSpectatorChat;
		game.publicAfterEnd = game.visibility.user1.publicAfterEnd && game.visibility.user2.publicAfterEnd;
	}

	@bindThis
	private setState(game: MiHataigoGame, state: GameState, now: number): void {
		game.result = structuredClone(state.result);
		game.phase = state.phase === 'finished' ? 'ended' : state.phase;
		if (state.phase === 'finished') { game.endedAt = new Date(now); game.deadlineAt = null; } else if (game.clockState) {
			const projection = projectClock(game.settings.clock, game.clockState, now);
			game.deadlineAt = projection.deadlineAtMs === null ? null : new Date(projection.deadlineAtMs);
		}
	}

	@bindThis
	private timeoutState(game: MiHataigoGame, state: GameState, now: number): boolean {
		if (game.phase !== 'playing' || !game.clockState) return false;
		const projection = projectClock(game.settings.clock, game.clockState, now);
		const expired = projection.expiredColor;
		if (expired === null) return false;
		const result = applyOnlineAction(state, { type: 'timeout', color: expired });
		game.actions = [...game.actions, ...result.actions];
		game.clockState = { ...projection.state, runningColor: null, turnStartedAtMs: null };
		this.setState(game, result.state, now);
		return true;
	}

	@bindThis
	public async updateSettings(gameId: string, me: MiUser, patch: HataigoSettingsPatch, expectedRevision: number): Promise<MiHataigoGame> {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
		if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['size', 'handicap', 'komi', 'rules', 'clock', 'allowSpectate', 'allowSpectatorChat', 'publicAfterEnd', 'announcement'].includes(key))) throw new HataigoError('INVALID_SETTINGS');
		await this.rateLimit(me.id, 'settings', 60);
		return this.mutate(gameId, async game => {
			this.participant(game, me); this.revision(game, expectedRevision);
			const changesRules = ['size', 'handicap', 'komi', 'rules', 'clock'].some(key => key in patch);
			if (changesRules && (game.phase !== 'waiting' || !game.invitationAccepted)) throw new HataigoError('INVALID_STATE');
			if (changesRules) game.settings = normalizeSettings({ ...game.settings, ...patch });
			const slot = game.user1Id === me.id ? 'user1' : 'user2';
			if (patch.announcement !== undefined) {
				announcementVote(patch.announcement);
				if (game.phase !== 'waiting' && (patch.announcement.visibility !== undefined || patch.announcement.enabled === true || patch.announcement.allowName === true)) throw new HataigoError('INVALID_STATE');
				game.announcements = { ...game.announcements, [slot]: announcementVote({ ...game.announcements[slot], ...patch.announcement }) };
				for (const own of ['user1', 'user2'] as const) {
					const other = own === 'user1' ? 'user2' : 'user1';
					if (game.announcementState[own].status === 'pending' && (!game.announcements[own].enabled || !game.announcements[other].allowName)) game.announcementState[own].status = 'cancelled';
				}
			}
			game.visibility = { ...game.visibility, [slot]: visibilityVote({ ...game.visibility[slot], ...patch }) };
			this.effectiveVisibility(game);
			if (game.phase === 'waiting') { game.user1Ready = false; game.user2Ready = false; }
		});
	}

	@bindThis
	public async ready(gameId: string, me: MiUser, ready: boolean, expectedRevision: number): Promise<MiHataigoGame> {
		if (typeof ready !== 'boolean') throw new HataigoError('INVALID_SETTINGS');
		await this.rateLimit(me.id, 'ready', 30);
		const saved = await this.mutate(gameId, async (game, manager) => {
			this.participant(game, me); this.revision(game, expectedRevision);
			if (game.phase !== 'waiting' || !game.invitationAccepted || !game.user1Id || !game.user2Id) throw new HataigoError('INVALID_STATE');
			await this.assertPresentParticipants(game, manager);
			await this.assertPairAllowed(game.user1Id, game.user2Id);
			if (game.user1Id === me.id) game.user1Ready = ready; else game.user2Ready = ready;
			if (!game.user1Ready || !game.user2Ready) return;
			game.settings = normalizeSettings(game.settings);
			game.black = randomInt(2) === 0 ? 1 : 2;
			const state = rebuildHataigo(game.settings, []);
			const now = Date.now();
			game.startedAt = new Date(now);
			game.clockState = createClock(game.settings.clock, state.toPlay, now);
			this.setState(game, state, now);
			for (const own of ['user1', 'user2'] as const) {
				const other = own === 'user1' ? 'user2' : 'user1';
				if (!game.announcements[own].enabled || !game.announcements[other].allowName) continue;
				const opponentId = other === 'user1' ? game.user1Id : game.user2Id;
				const opponent = await this.users.findOneBy({ id: opponentId });
				if (!opponent || opponent.isDeleted || opponent.isSuspended || opponent.host !== null) continue;
				const displayName = opponent.name === null || opponent.name === '' ? opponent.username : opponent.name;
				const name = displayName.replace(/[<>\r\n]/g, '').slice(0, 80);
				game.announcementState[own] = { ...emptyAnnouncementState(), status: 'pending', text: `HataIgo: <plain>${name}</plain> さんとの対局を始めました。\n${this.config.url}/hataigo/${game.id}` };
			}
		});
		// Durable pending rows are retried by the regular timeout job if this process stops here.
		if (saved.startedAt !== null) void this.processAnnouncements(saved.id).catch(() => undefined);
		return saved;
	}

	@bindThis
	public async act(gameId: string, me: MiUser, action: HataigoClientAction, expectedRevision: number): Promise<MiHataigoGame> {
		await this.rateLimit(me.id, 'action');
		return this.mutate(gameId, async (game, manager) => {
			this.participant(game, me); this.revision(game, expectedRevision);
			if (game.phase === 'waiting' || game.phase === 'ended') throw new HataigoError('INVALID_STATE');
			await this.assertPresentParticipants(game, manager);
			const state = rebuildHataigo(game.settings, game.actions);
			const canonical = authorizeAction(action, participantColor(game, me.id));
			const now = Date.now();
			if (this.timeoutState(game, state, now)) return;
			if (game.actions.length >= MAX_ACTIONS && !['resign', 'acceptScore', 'acceptNoResult'].includes(action.type)) throw new HataigoError('LIMIT');
			const applied = applyOnlineAction(state, canonical);
			game.actions = [...game.actions, ...applied.actions];
			if (game.clockState) {
				if (canonical.type === 'play' || canonical.type === 'pass') game.clockState = consumeTurn(game.settings.clock, game.clockState, applied.state.phase === 'playing' ? applied.state.toPlay : null, now);
				else if (canonical.type === 'requestResume') game.clockState = resumeClock(game.clockState, applied.state.toPlay, now);
				else if (applied.state.phase === 'finished') game.clockState = consumeTurn(game.settings.clock, game.clockState, null, now);
			}
			this.setState(game, applied.state, now);
		});
	}

	@bindThis
	public async claimTimeout(gameId: string, me: MiUser, expectedRevision?: number): Promise<MiHataigoGame> {
		await this.rateLimit(me.id, 'timeout', 30);
		return this.mutate(gameId, async (game, manager) => {
			this.participant(game, me);
			if (expectedRevision !== undefined) this.revision(game, expectedRevision);
			if (game.phase !== 'playing') throw new HataigoError('INVALID_STATE');
			await this.assertPresentParticipants(game, manager);
			const state = rebuildHataigo(game.settings, game.actions);
			if (participantColor(game, me.id) === state.toPlay) throw new HataigoError('FORBIDDEN');
			if (!this.timeoutState(game, state, Date.now())) throw new HataigoError('INVALID_STATE', 'Clock has not expired');
		});
	}

	@bindThis
	public async sweepTimeouts(): Promise<number> {
		const due = await this.games.find({ where: { phase: 'playing', deadlineAt: LessThan(new Date()) }, order: { deadlineAt: 'ASC' }, take: 100 });
		let ended = 0;
		for (const candidate of due) {
			await this.mutate(candidate.id, async (game, manager) => {
				if (game.phase !== 'playing') return false;
				try { await this.assertPresentParticipants(game, manager); } catch (error) { if (error instanceof HataigoError && error.code === 'INVALID_STATE') return false; throw error; }
				const expired = this.timeoutState(game, rebuildHataigo(game.settings, game.actions), Date.now());
				if (expired) ended++;
				return expired;
			});
		}
		const expiredInvitations = await this.games.find({ where: { phase: 'waiting', isInvitation: true, invitationAccepted: false, createdAt: LessThan(new Date(Date.now() - INVITATION_LIFETIME_MS)) }, order: { createdAt: 'ASC' }, take: 100 });
		for (const candidate of expiredInvitations) await this.mutate(candidate.id, async game => {
			if (game.phase !== 'waiting' || !game.isInvitation || game.invitationAccepted || game.createdAt.getTime() >= Date.now() - INVITATION_LIFETIME_MS) return false;
			game.phase = 'ended'; game.endedAt = new Date(); ended++;
			return true;
		});
		const pending = await this.games.createQueryBuilder('game')
			.where('(("game"."announcementState"->\'user1\'->>\'status\' = \'pending\' AND ("game"."announcementState"->\'user1\'->>\'nextAttemptAtMs\')::bigint <= :now) OR ("game"."announcementState"->\'user2\'->>\'status\' = \'pending\' AND ("game"."announcementState"->\'user2\'->>\'nextAttemptAtMs\')::bigint <= :now))', { now: Date.now() })
			.orderBy('game.id', 'ASC').take(100).getMany();
		for (const game of pending) await this.processAnnouncements(game.id);
		return ended;
	}

	/** Serialized outbox. A note inserted before a process crash is recovered by its fixed text and author.
	 * NoteCreateService has no idempotency key; deletion in that crash window cannot be distinguished
	 * from a failed insert. Notes are local-only and are never emitted without both relevant consents.
	 */
	@bindThis
	public async processAnnouncements(gameId: string): Promise<void> {
		await this.mutate(gameId, async game => {
			let changed = false;
			for (const own of ['user1', 'user2'] as const) {
				const pending = game.announcementState[own];
				if (pending.status !== 'pending') continue;
				const other = own === 'user1' ? 'user2' : 'user1';
				const authorId = own === 'user1' ? game.user1Id : game.user2Id;
				const opponentId = other === 'user1' ? game.user1Id : game.user2Id;
				const author = authorId === null ? null : await this.users.findOneBy({ id: authorId });
				const opponent = opponentId === null ? null : await this.users.findOneBy({ id: opponentId });
				if (game.phase === 'waiting' || game.phase === 'ended' || !game.announcements[own].enabled || !game.announcements[other].allowName || !author || !opponent || author.host !== null || opponent.host !== null || author.isDeleted || opponent.isDeleted || author.isSuspended || opponent.isSuspended || pending.text === null) {
					pending.status = 'cancelled'; changed = true; continue;
				}
				if (pending.nextAttemptAtMs > Date.now()) continue;
				changed = true; pending.attempts++;
				try {
					const existing = await this.notes.findOneBy({ userId: author.id, userHost: IsNull(), text: pending.text });
					const note = existing ?? await this.noteCreate.create(author, { text: pending.text, visibility: game.announcements[own].visibility, localOnly: true, apMentions: [], apHashtags: [], apEmojis: [] });
					pending.noteId = note.id; pending.status = 'sent'; pending.lastError = null;
				} catch {
					pending.lastError = 'NOTE_CREATE_FAILED';
					pending.nextAttemptAtMs = Date.now() + Math.min(300000, 1000 * 2 ** Math.min(pending.attempts, 9));
				}
			}
			return changed;
		});
	}

	@bindThis
	public async cancelGame(gameId: string, me: MiUser, expectedRevision: number): Promise<MiHataigoGame> {
		await this.rateLimit(me.id, 'cancel', 30);
		return this.mutate(gameId, async game => {
			this.participant(game, me); this.revision(game, expectedRevision);
			if (game.phase !== 'waiting') throw new HataigoError('INVALID_STATE');
			game.phase = 'ended'; game.endedAt = new Date();
		});
	}

	@bindThis
	private async capacity(manager: EntityManager, userIds: string[]): Promise<void> {
		for (const userId of [...userIds].sort()) {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hataigo:capacity:${userId}`]);
			const active = await manager.getRepository(MiHataigoGame).find({ where: [{ user1Id: userId, phase: Not('ended') }, { user2Id: userId, phase: Not('ended') }] });
			if (active.filter(game => !game.isInvitation || game.invitationAccepted).length >= MAX_ACTIVE_GAMES) throw new HataigoError('LIMIT', 'Active game limit', userId);
		}
	}

	@bindThis
	private async create(first: string, second: string, options: HataigoMatchOptions, invited: boolean, secondVote: Partial<HataigoVisibilityVote> = {}): Promise<MiHataigoGame> {
		const game = await this.db.transaction(async manager => {
			for (const id of [first, second].sort()) {
				const user = await manager.getRepository(MiUser).findOne({ where: { id, host: IsNull(), isDeleted: false, isSuspended: false }, lock: { mode: 'pessimistic_read' } });
				if (!user) throw new HataigoError('NOT_LOCAL');
			}
			if (invited) {
				for (const userId of [first, second].sort()) await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hataigo:capacity:${userId}`]);
				const pending = await manager.getRepository(MiHataigoGame).find({ where: [{ user1Id: first, isInvitation: true, invitationAccepted: false, phase: 'waiting', createdAt: MoreThan(new Date(Date.now() - INVITATION_LIFETIME_MS)) }, { user1Id: second, user2Id: first, isInvitation: true, invitationAccepted: false, phase: 'waiting', createdAt: MoreThan(new Date(Date.now() - INVITATION_LIFETIME_MS)) }] });
				const existing = pending.find(game => game.user1Id === first && game.user2Id === second || game.user1Id === second && game.user2Id === first);
				if (existing) return existing;
				if (pending.filter(game => game.user1Id === first).length >= 8) throw new HataigoError('LIMIT', 'Pending invitation limit', first);
			} else await this.capacity(manager, [first, second]);
			if (!invited) {
				const waiting = await manager.getRepository(MiHataigoGame).findOne({ where: [{ user1Id: first, phase: 'waiting', isInvitation: false }, { user2Id: first, phase: 'waiting', isInvitation: false }, { user1Id: second, phase: 'waiting', isInvitation: false }, { user2Id: second, phase: 'waiting', isInvitation: false }] });
				if (waiting) throw new HataigoError('INVALID_STATE', 'Player already has a waiting free match');
			}
			await this.assertPairAllowed(first, second);
			const repository = manager.getRepository(MiHataigoGame);
			const created = repository.create({ id: this.ids.gen(), createdAt: new Date(), startedAt: null, endedAt: null, user1Id: first, user2Id: second, black: null, phase: 'waiting', settings: normalizeSettings(defaultSettings(options.size, options.clockKind)), user1Ready: false, user2Ready: false, isInvitation: invited, invitationAccepted: !invited, result: null, actions: [], clockState: null, deadlineAt: null, visibility: { user1: visibilityVote(options), user2: visibilityVote(secondVote) }, announcements: { user1: announcementVote(), user2: announcementVote() }, announcementState: { user1: emptyAnnouncementState(), user2: emptyAnnouncementState() }, allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false, revision: 0 });
			this.effectiveVisibility(created);
			return repository.save(created);
		});
		this.events.publishHataigoStream(first, invited ? 'invited' : 'matched', { gameId: game.id });
		this.events.publishHataigoStream(second, invited ? 'invited' : 'matched', { gameId: game.id });
		return game;
	}

	@bindThis
	public async invite(me: MiUser, targetUserId: string): Promise<MiHataigoGame> {
		this.local(me);
		await this.rateLimit(me.id, 'invite', 10);
		const target = await this.users.findOneBy({ id: targetUserId, host: IsNull(), isDeleted: false, isSuspended: false });
		if (!target) throw new HataigoError('NOT_LOCAL');
		await this.assertPairAllowed(me.id, target.id);
		if (!await this.followings.findOneBy({ followerId: me.id, followeeId: target.id })) throw new HataigoError('NOT_FOLLOWING');
		return this.create(me.id, target.id, { size: 19, clockKind: 'byoyomi' }, true);
	}

	@bindThis
	public async invitations(me: MiUser): Promise<MiHataigoGame[]> {
		this.local(me);
		const candidates = await this.games.find({ where: { user2Id: me.id, isInvitation: true, invitationAccepted: false, phase: 'waiting', createdAt: MoreThan(new Date(Date.now() - INVITATION_LIFETIME_MS)) }, order: { id: 'DESC' }, take: 50 });
		const result: MiHataigoGame[] = [];
		for (const game of candidates) {
			if (!game.user1Id) continue;
			try { await this.assertPairAllowed(me.id, game.user1Id); result.push(game); } catch (error) { if (!(error instanceof HataigoError && error.code === 'BLOCKED')) throw error; }
		}
		return result;
	}

	@bindThis
	public async respondInvite(gameId: string, me: MiUser, accept: boolean, expectedRevision: number): Promise<MiHataigoGame> {
		if (typeof accept !== 'boolean') throw new HataigoError('INVALID_ACTION');
		await this.rateLimit(me.id, 'invite-response', 30);
		return this.mutate(gameId, async (game, manager) => {
			this.local(me);
			if (game.user2Id !== me.id) throw new HataigoError('FORBIDDEN');
			this.revision(game, expectedRevision);
			if (!game.isInvitation || game.invitationAccepted || game.phase !== 'waiting' || !game.user1Id || game.createdAt.getTime() <= Date.now() - INVITATION_LIFETIME_MS) throw new HataigoError('INVALID_STATE');
			if (accept) { await this.capacity(manager, [game.user1Id, me.id]); await this.assertPairAllowed(game.user1Id, me.id); game.invitationAccepted = true; } else { game.phase = 'ended'; game.endedAt = new Date(); }
		});
	}

	@bindThis
	private async cancelQueue(userId: string): Promise<void> {
		// 路数を問わない人は複数の行列に並ぶので、空白区切りで全部持っている（1つだけの旧形式もそのまま読める）
		const previous = await this.redis.get(`hataigo:queue-user:${userId}`);
		for (const key of previous?.split(' ') ?? []) if (/^hataigo:queue:(9|13|19):(byoyomi|correspondence)$/.test(key)) await this.redis.zrem(key, userId);
		await this.redis.del(`hataigo:queue-user:${userId}`, `hataigo:queue-options:${userId}`);
	}

	@bindThis
	private async withMatchLock<T>(operation: () => Promise<T>, wait = false): Promise<T> {
		const token = randomUUID();
		for (let attempt = 0; ; attempt++) {
			if (await this.redis.set('hataigo:match-lock', token, 'PX', 20000, 'NX') === 'OK') break;
			if (!wait || attempt >= 800) throw new HataigoError('MATCH_BUSY');
			await new Promise(resolve => setTimeout(resolve, 25));
		}
		try { return await operation(); } finally { await this.redis.eval(releaseLock, 1, 'hataigo:match-lock', token); }
	}

	@bindThis
	public async cancelMatch(me: MiUser): Promise<void> {
		this.local(me);
		await this.rateLimit(me.id, 'cancel-match', 30);
		await this.withMatchLock(() => this.cancelQueue(me.id), true);
	}

	@bindThis
	public async matchAnyUser(me: MiUser, options: HataigoMatchOptions): Promise<MiHataigoGame | null> {
		this.local(me);
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
		if (!options || typeof options !== 'object' || ![9, 13, 19].includes(options.size)) throw new HataigoError('INVALID_SETTINGS');
		normalizeSettings(defaultSettings(options.size, options.clockKind));
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
		if (options.clockKind !== 'byoyomi' && options.clockKind !== 'correspondence') throw new HataigoError('INVALID_SETTINGS');
		if (options.anySize !== undefined && typeof options.anySize !== 'boolean') throw new HataigoError('INVALID_SETTINGS');
		const normalized = { size: options.size, clockKind: options.clockKind, anySize: options.anySize === true, ...visibilityVote(options) };
		await this.rateLimit(me.id, 'match', 30);
		return this.withMatchLock(async () => {
			if (!await this.users.findOneBy({ id: me.id, host: IsNull(), isDeleted: false, isSuspended: false })) throw new HataigoError('NOT_LOCAL');
			const waiting = await this.games.findOne({ where: [{ user1Id: me.id, phase: 'waiting', isInvitation: false }, { user2Id: me.id, phase: 'waiting', isInvitation: false }] });
			if (waiting) { await this.cancelQueue(me.id); return waiting; }
			await this.db.transaction(manager => this.capacity(manager, [me.id]));
			await this.cancelQueue(me.id);
			// 路数を問わないときは、第一希望の路数の行列から順にほかの路数の行列も見る
			const sizes: BoardSize[] = normalized.anySize ? [normalized.size, ...([9, 13, 19] as const).filter(size => size !== normalized.size)] : [normalized.size];
			const keys = sizes.map(size => `hataigo:queue:${size}:${normalized.clockKind}`);
			for (const [index, key] of keys.entries()) {
				const size = sizes[index];
				const candidates = await this.redis.zrangebyscore(key, Date.now() - QUEUE_LIFETIME_MS, '+inf', 'LIMIT', 0, 50);
				for (const candidate of candidates) {
					if (candidate === me.id) continue;
					const stored = await this.redis.get(`hataigo:queue-options:${candidate}`);
					if (!stored) { await this.redis.zrem(key, candidate); continue; }
					const user = await this.users.findOneBy({ id: candidate, host: IsNull(), isDeleted: false, isSuspended: false });
					if (!user) { await this.redis.zrem(key, candidate); continue; }
					try { await this.assertPairAllowed(me.id, candidate); } catch (error) { if (error instanceof HataigoError && error.code === 'BLOCKED') continue; throw error; }
					let previous: HataigoMatchOptions;
					try { previous = JSON.parse(stored) as HataigoMatchOptions; visibilityVote(previous); } catch { await this.redis.zrem(key, candidate); continue; }
					// この行列にいる人はこの路数を受け入れている（第一希望か、路数を問わない人）
					if ((previous.size !== size && previous.anySize !== true) || previous.clockKind !== normalized.clockKind) continue;
					if (await this.redis.zrem(key, candidate) !== 1) continue;
					let game: MiHataigoGame;
					try { game = await this.create(candidate, me.id, { ...previous, size }, false, normalized); } catch (error) {
						if (error instanceof HataigoError && error.code === 'INVALID_STATE') continue;
						if (error instanceof HataigoError && error.code === 'LIMIT' && error.limitUserId !== me.id) { await this.cancelQueue(candidate); continue; }
						if ((await this.redis.get(`hataigo:queue-user:${candidate}`))?.split(' ').includes(key)) await this.redis.zadd(key, Date.now(), candidate);
						throw error;
					}
					// 組めた相手はほかの路数の行列からも外す
					await this.cancelQueue(candidate);
					return game;
				}
			}
			for (const key of keys) {
				await this.redis.zadd(key, Date.now(), me.id);
				await this.redis.expire(key, 60);
			}
			await this.redis.set(`hataigo:queue-user:${me.id}`, keys.join(' '), 'PX', QUEUE_LIFETIME_MS);
			await this.redis.set(`hataigo:queue-options:${me.id}`, JSON.stringify(normalized), 'PX', QUEUE_LIFETIME_MS);
			return null;
		});
	}
}
