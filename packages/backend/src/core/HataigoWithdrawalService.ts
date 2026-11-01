/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { MoreThan } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MiHataigoGame } from '@/models/HataigoGame.js';
import { MiHataigoChatMessage } from '@/models/HataigoChatMessage.js';
import { announcementVote, emptyAnnouncementState, visibilityVote } from '@/misc/hataigo/types.js';
import { GlobalEventService } from './GlobalEventService.js';
import type { DataSource, Repository } from 'typeorm';

const releaseLock = 'if redis.call(\'GET\',KEYS[1])==ARGV[1] then return redis.call(\'DEL\',KEYS[1]) else return 0 end';

/** Anonymizes shared HataIgo records only. Never deletes an opponent's notes or abuse reports. */
@Injectable()
export class HataigoWithdrawalService {
	constructor(
		@Inject(DI.db) private db: DataSource,
		@Inject(DI.redis) private redis: Redis.Redis,
		@Inject(DI.hataigoGamesRepository) private games: Repository<MiHataigoGame>,
		@Inject(DI.hataigoChatMessagesRepository) private messages: Repository<MiHataigoChatMessage>,
		private events: GlobalEventService,
	) {}

	@bindThis private async clearQueue(userId: string): Promise<void> {
		// Serialize with matches already in flight so a late enqueue cannot recreate the removed entry.
		const token = randomUUID();
		for (let attempt = 0; ; attempt++) {
			if (await this.redis.set('hataigo:match-lock', token, 'PX', 20000, 'NX') === 'OK') break;
			if (attempt >= 800) throw new Error('HataIgo withdrawal matching lock unavailable');
			await new Promise(resolve => setTimeout(resolve, 25));
		}
		try {
			const queue = await this.redis.get(`hataigo:queue-user:${userId}`);
			if (queue && /^hataigo:queue:(9|13|19):(byoyomi|correspondence)$/.test(queue)) await this.redis.zrem(queue, userId);
			await this.redis.del(`hataigo:queue-user:${userId}`, `hataigo:queue-options:${userId}`);
		} finally { await this.redis.eval(releaseLock, 1, 'hataigo:match-lock', token); }
	}

	/** Called after the account's deleted flag is committed, and again before physical deletion. */
	@bindThis public async cleanup(userId: string): Promise<void> {
		await this.clearQueue(userId);
		let cursor: string | null = null;
		for (;;) {
			const after = cursor === null ? {} : { id: MoreThan(cursor) };
			const rows = await this.games.find({ where: [{ user1Id: userId, ...after }, { user2Id: userId, ...after }], select: { id: true }, order: { id: 'ASC' }, take: 100 });
			if (rows.length === 0) break;
			for (const source of rows) {
				const changed = await this.db.transaction(async manager => {
					const repository = manager.getRepository(MiHataigoGame);
					const game = await repository.findOne({ where: { id: source.id }, lock: { mode: 'pessimistic_write' } });
					if (!game || (game.user1Id !== userId && game.user2Id !== userId)) return null;
					if (game.user1Id === userId) game.user1Id = null;
					if (game.user2Id === userId) game.user2Id = null;
					game.allowSpectate = false; game.allowSpectatorChat = false; game.publicAfterEnd = false;
					game.visibility = { user1: visibilityVote(), user2: visibilityVote() };
					game.announcements = { user1: announcementVote(), user2: announcementVote() };
					game.announcementState = { user1: { ...emptyAnnouncementState(), status: 'cancelled' }, user2: { ...emptyAnnouncementState(), status: 'cancelled' } };
					game.user1Ready = false; game.user2Ready = false;
					if (game.phase !== 'ended') {
						// No invented resignation, timeout or agreement: unfinished records have no scored result.
						game.phase = 'ended'; game.endedAt = new Date(Date.now()); game.result = null;
					}
					game.deadlineAt = null;
					if (game.clockState !== null) game.clockState = { ...game.clockState, runningColor: null, turnStartedAtMs: null };
					game.revision++;
					return repository.save(game);
				});
				if (changed !== null) this.events.publishHataigoGameStream(changed.id, 'updated', { revision: changed.revision });
				cursor = source.id;
			}
		}
		// Chat retains its already-recorded expiry. Only identifying author/moderator references are removed.
		for (;;) {
			const authored = await this.messages.find({ where: { userId }, select: { id: true, gameId: true }, order: { id: 'ASC' }, take: 100 });
			if (authored.length === 0) break;
			for (const message of authored) {
				await this.messages.update({ id: message.id, userId }, { userId: null });
				this.events.publishHataigoGameStream(message.gameId, 'chatMessage', { messageId: message.id });
			}
		}
		await this.messages.update({ deletedById: userId }, { deletedById: null });
	}
}
