/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { IsNull, LessThan, LessThanOrEqual, MoreThan } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MiUser } from '@/models/User.js';
import { MiHataigoGame } from '@/models/HataigoGame.js';
import { MiHataigoChatMessage } from '@/models/HataigoChatMessage.js';
import type { Packed } from '@/misc/json-schema.js';
import { HataigoError } from '@/misc/hataigo/types.js';
import { HATAIGO_CHAT_POLICY } from '@/misc/hataigo/chat-policy.js';
import type { HataigoChatPolicy } from '@/misc/hataigo/chat-policy.js';
import { HataigoService } from './HataigoService.js';
import { IdService } from './IdService.js';
import { GlobalEventService } from './GlobalEventService.js';
import { RoleService } from './RoleService.js';
import { UserEntityService } from './entities/UserEntityService.js';
import type { DataSource, EntityManager, Repository } from 'typeorm';

export type HataigoChatMessage = Packed<'HataigoChatMessage'>;

@Injectable()
export class HataigoChatService {
	constructor(
		@Inject(DI.db) private db: DataSource,
		@Inject(DI.hataigoChatMessagesRepository) private messages: Repository<MiHataigoChatMessage>,
		@Inject(DI.usersRepository) private users: Repository<MiUser>,
		private games: HataigoService,
		private ids: IdService,
		private events: GlobalEventService,
		private roles: RoleService,
		private userPacker: UserEntityService,
		@Inject(HATAIGO_CHAT_POLICY) private policy: HataigoChatPolicy | null,
	) {
		if (policy !== null && (!Number.isSafeInteger(policy.retentionDays) || policy.retentionDays < 1 || policy.retentionDays > 3650 || !policy.disclosureVersion || policy.disclosureVersion.length > 100)) throw new Error('Invalid HataIgo chat policy');
	}

	@bindThis public capability(): { enabled: boolean; retentionDays: number | null; disclosureVersion: string | null } {
		return { enabled: this.policy !== null, retentionDays: this.policy?.retentionDays ?? null, disclosureVersion: this.policy?.disclosureVersion ?? null };
	}

	@bindThis private enabled(): HataigoChatPolicy {
		if (this.policy === null) throw new HataigoError('CHAT_DISABLED');
		return this.policy;
	}

	@bindThis private local(me: MiUser): void {
		if (me.host !== null || me.isDeleted || me.isSuspended) throw new HataigoError('FORBIDDEN');
	}

	@bindThis private async publicRoom(game: MiHataigoGame, viewer: MiUser | null): Promise<void> {
		await this.games.assertCanView(game, viewer);
		await this.games.assertPublicParticipants(game);
		const published = game.phase === 'ended' ? game.publicAfterEnd : (game.phase === 'playing' || game.phase === 'scoring') && game.allowSpectate;
		if (game.user1Id === null || game.user2Id === null || !published || !game.allowSpectatorChat) throw new HataigoError('NOT_FOUND');
	}

	@bindThis private async lockedRoom(manager: EntityManager, id: string, me: MiUser): Promise<MiHataigoGame> {
		const game = await manager.getRepository(MiHataigoGame).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
		if (!game) throw new HataigoError('NOT_FOUND');
		await this.publicRoom(game, me);
		return game;
	}

	@bindThis public async getPacked(messageId: string, viewer: MiUser | null, expectedGameId?: string): Promise<HataigoChatMessage> {
		this.enabled();
		const message = await this.messages.findOneBy({ id: messageId });
		if (!message || message.expiresAt.getTime() <= Date.now() || (expectedGameId !== undefined && message.gameId !== expectedGameId)) throw new HataigoError('NOT_FOUND');
		const game = await this.games.get(message.gameId, viewer);
		await this.publicRoom(game, viewer);
		const user = message.userId === null ? null : await this.users.findOneBy({ id: message.userId, isDeleted: false });
		const packedUser = user === null ? null : await this.userPacker.pack(user, viewer, { schema: 'UserLite' });
		// User packing can await other services. Never return the earlier body or publication snapshot.
		const current = await this.messages.findOneBy({ id: messageId });
		if (!current || current.gameId !== message.gameId || (expectedGameId !== undefined && current.gameId !== expectedGameId)) throw new HataigoError('NOT_FOUND');
		const currentAuthor = current.userId === null ? null : await this.users.findOneBy({ id: current.userId, isDeleted: false });
		await this.publicRoom(await this.games.get(current.gameId, viewer), viewer);
		if (current.expiresAt.getTime() <= Date.now()) throw new HataigoError('NOT_FOUND');
		return { id: current.id, gameId: current.gameId, userId: currentAuthor?.id ?? null, user: currentAuthor !== null && currentAuthor.id === message.userId ? packedUser : null, text: current.deletedAt === null ? current.text : null, createdAt: current.createdAt.toISOString(), expiresAt: current.expiresAt.toISOString(), deleted: current.deletedAt !== null };
	}

	@bindThis public async list(gameId: string, viewer: MiUser | null, options: { untilId?: string; limit?: number } = {}): Promise<HataigoChatMessage[]> {
		this.enabled();
		const game = await this.games.get(gameId, viewer);
		await this.publicRoom(game, viewer);
		const rows = await this.messages.find({ where: { gameId, expiresAt: MoreThan(new Date(Date.now())), ...(options.untilId ? { id: LessThan(options.untilId) } : {}) }, order: { id: 'DESC' }, take: Math.max(1, Math.min(50, options.limit ?? 20)) });
		const result: HataigoChatMessage[] = [];
		for (const row of rows) result.push(await this.getPacked(row.id, viewer, gameId));
		await this.publicRoom(await this.games.get(gameId, viewer), viewer);
		return result;
	}

	@bindThis public async post(gameId: string, me: MiUser, text: string): Promise<HataigoChatMessage> {
		const policy = this.enabled(); this.local(me);
		if (typeof text !== 'string' || text.length > 500 || text.trim().length === 0) throw new HataigoError('INVALID_ACTION');
		if (Array.from(text).some(character => {
			const code = character.charCodeAt(0);
			return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
		})) throw new HataigoError('INVALID_ACTION');
		await this.games.rateLimit(me.id, 'chat-post', 1, 3000);
		const message = await this.db.transaction(async manager => {
			await this.lockedRoom(manager, gameId, me);
			const currentAuthor = await manager.getRepository(MiUser).findOne({ where: { id: me.id, host: IsNull(), isDeleted: false, isSuspended: false }, lock: { mode: 'pessimistic_read' } });
			if (!currentAuthor) throw new HataigoError('FORBIDDEN');
			const repository = manager.getRepository(MiHataigoChatMessage);
			if (await repository.countBy({ gameId }) >= 1000) throw new HataigoError('LIMIT');
			const now = Date.now();
			return repository.save(repository.create({ id: this.ids.gen(), gameId, userId: me.id, text: text.trim(), createdAt: new Date(now), expiresAt: new Date(now + policy.retentionDays * 86400000), policyVersion: policy.disclosureVersion, deletedAt: null, deletedById: null, deletionReason: null }));
		});
		this.events.publishHataigoGameStream(gameId, 'chatMessage', { messageId: message.id });
		return this.getPacked(message.id, me, gameId);
	}

	@bindThis public async delete(messageId: string, me: MiUser, reason: 'abuse' | 'spam' | 'other', expectedGameId?: string): Promise<void> {
		this.enabled(); this.local(me);
		if (!['abuse', 'spam', 'other'].includes(reason)) throw new HataigoError('INVALID_ACTION');
		// Safety-only role check. Does not affect game rules, rewards, quotas or storage limits.
		if (!await this.roles.isModerator(me)) throw new HataigoError('FORBIDDEN');
		await this.games.rateLimit(me.id, 'chat-delete', 120, 60000);
		const source = await this.messages.findOneBy({ id: messageId });
		if (!source || source.expiresAt.getTime() <= Date.now() || (expectedGameId !== undefined && source.gameId !== expectedGameId)) throw new HataigoError('NOT_FOUND');
		const deleted = await this.db.transaction(async manager => {
			await this.lockedRoom(manager, source.gameId, me);
			const currentModerator = await manager.getRepository(MiUser).findOne({ where: { id: me.id, host: IsNull(), isDeleted: false, isSuspended: false }, lock: { mode: 'pessimistic_read' } });
			if (!currentModerator) throw new HataigoError('FORBIDDEN');
			const repository = manager.getRepository(MiHataigoChatMessage);
			const message = await repository.findOne({ where: { id: messageId }, lock: { mode: 'pessimistic_write' } });
			if (!message || message.expiresAt.getTime() <= Date.now()) throw new HataigoError('NOT_FOUND');
			if (message.deletedAt !== null) return false;
			message.text = null; message.deletedAt = new Date(Date.now()); message.deletedById = me.id; message.deletionReason = reason;
			await repository.save(message); return true;
		});
		if (deleted) this.events.publishHataigoGameStream(source.gameId, 'chatDeleted', { messageId });
	}

	@bindThis public async cleanExpired(): Promise<void> {
		// Existing rows retain their recorded expiry even if new chat is disabled later.
		await this.messages.delete({ expiresAt: LessThanOrEqual(new Date(Date.now())) });
	}
}
