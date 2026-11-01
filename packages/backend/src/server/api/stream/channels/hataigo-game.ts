/*
	* SPDX-FileCopyrightText: Tolehata and hatasaba-project
	* SPDX-License-Identifier: AGPL-3.0-only
	*/

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { HataigoChatService } from '@/core/HataigoChatService.js';
import { HataigoService } from '@/core/HataigoService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { HataigoGameEventTypes } from '@/core/GlobalEventService.js';
import { isJsonObject } from '@/misc/json-value.js';
import type { JsonObject, JsonValue } from '@/misc/json-value.js';
import { isHataigoParticipant } from '@/misc/hataigo/access.js';
import { HataigoError } from '@/misc/hataigo/types.js';
import type { HataigoClientAction } from '@/misc/hataigo/types.js';
import { hataigoErrorCode } from '@/misc/hataigo/api.js';
import { hataigoPresenceKeys, hataigoPresenceScript, isHataigoReaction, parseHataigoPresence } from '@/misc/hataigo/presence.js';
import Channel, { type MiChannelService } from '../channel.js';

type RoomEvent = { [K in keyof HataigoGameEventTypes]: { type: K; body: HataigoGameEventTypes[K] } }[keyof HataigoGameEventTypes];
/** Same as the spectator heartbeat, which re-checks access on its own; moves and chat always re-check. */
const LIGHT_EVENT_RECHECK_MS = 30000;
export class HataigoGameChannel extends Channel {
	public readonly chName = 'hataigoGame';
	public static shouldShare = false;
	public static requireCredential = false as const;
	private gameId: string | null = null;
	private closed = false;
	private presenceMember: string | null = null;
	private heartbeat: NodeJS.Timeout | null = null;
	private pending: Promise<void> = Promise.resolve();
	private verifiedAt = 0;
	private countSent = false;
	constructor(private games: HataigoService, private redis: Redis.Redis, private events: GlobalEventService, id: string, connection: Channel['connection'], private chat: HataigoChatService) { super(id, connection); }

	/** Disposal can change this flag while any awaited service call is pending. */
	private isClosed(): boolean { return this.closed; }

	@bindThis public async init(params: JsonObject): Promise<boolean> {
		if (typeof params.gameId !== 'string' || !/^[a-zA-Z0-9]{1,32}$/.test(params.gameId)) return false;
		if (this.user && !this.connection.hasPermission('read:account')) return false;
		this.gameId = params.gameId;
		try {
			const game = await this.games.get(this.gameId, this.user ?? null);
			this.verifiedAt = Date.now();
			if (this.isClosed()) return false;
			this.subscriber.on(`hataigoGameStream:${this.gameId}`, this.onEvent);
			if (!isHataigoParticipant(game, this.user?.id ?? null)) {
				this.presenceMember = `${this.user?.id ?? randomUUID()}:${randomUUID()}`;
				await this.pulse();
				if (this.isClosed()) return false;
				this.heartbeat = setInterval(() => { void this.pulse().catch(() => this.revoke()); }, 30000);
			} else {
				const now = Date.now();
				const presence = parseHataigoPresence(await this.redis.eval(hataigoPresenceScript, 2, ...hataigoPresenceKeys(this.gameId), now - 65000, now, '', 'read'));
				if (!this.isClosed() && presence) this.send('spectators', { count: presence.count });
			}
			return !this.isClosed();
		} catch { this.dispose(); return false; }
	}

	@bindThis private async pulse(): Promise<void> {
		if (this.isClosed() || !this.gameId || !this.presenceMember) return;
		await this.games.get(this.gameId, this.user ?? null);
		this.verifiedAt = Date.now();
		if (this.isClosed()) return;
		const now = Date.now();
		const member = this.presenceMember;
		const presence = parseHataigoPresence(await this.redis.eval(hataigoPresenceScript, 2, ...hataigoPresenceKeys(this.gameId), now - 65000, now, member, 'join'));
		if (this.isClosed()) { await this.removePresence(member); return; }
		if (!presence) return;
		// Only a changed count goes to the room (each subscriber re-checks access per event); a joiner whose
		// arrival did not change it (a second tab) still needs the current number once.
		if (presence.changed) this.events.publishHataigoGameStream(this.gameId, 'spectators', { count: presence.count });
		else if (!this.countSent) this.send('spectators', { count: presence.count });
		this.countSent = true;
	}

	/** Counts and fixed reactions carry nothing from the game record, so one re-check covers them for a short window. */
	private async verify(light: boolean): Promise<void> {
		if (!this.gameId || (light && Date.now() - this.verifiedAt < LIGHT_EVENT_RECHECK_MS)) return;
		await this.games.get(this.gameId, this.user ?? null);
		this.verifiedAt = Date.now();
	}

	@bindThis private onEvent(event: RoomEvent): void {
		this.pending = this.pending.then(async () => {
			if (this.isClosed() || !this.gameId) return;
			await this.verify(event.type === 'spectators' || event.type === 'reacted');
			if (event.type === 'chatMessage' || event.type === 'chatDeleted') {
				try {
					const message = await this.chat.getPacked(event.body.messageId, this.user ?? null, this.gameId);
					if (!this.isClosed()) this.send(event.type, message);
				} catch (error) {
					if (!(error instanceof HataigoError && ['NOT_FOUND', 'FORBIDDEN', 'CHAT_DISABLED'].includes(error.code))) throw error;
				}
			} else if (!this.isClosed()) this.send(event.type, event.body);
		}).catch(() => this.revoke());
	}

	@bindThis private revoke(): void { if (!this.isClosed()) { this.send('revoked', {}); this.connection.disconnectChannel(this.id); this.dispose(); } }

	@bindThis public onMessage(type: string, body: JsonValue): void {
		void this.command(type, body).catch(() => {});
	}

	private async command(type: string, body: JsonValue): Promise<void> {
		if (this.isClosed() || !this.gameId || !isJsonObject(body)) return;
		const requestId = typeof body.requestId === 'string' && body.requestId.length <= 80 ? body.requestId : null;
		try {
			if (!this.user || !this.connection.hasPermission('write:account') || this.user.host !== null || this.user.isSuspended || this.user.isDeleted) throw new HataigoError('FORBIDDEN');
			if (type === 'action') {
				if (!isJsonObject(body.action) || !Number.isSafeInteger(body.expectedRevision)) throw new HataigoError('INVALID_ACTION');
				await this.games.act(this.gameId, this.user, body.action as unknown as HataigoClientAction, body.expectedRevision as number);
			} else if (type === 'claimTimeout') {
				if (body.expectedRevision !== undefined && !Number.isSafeInteger(body.expectedRevision)) throw new HataigoError('INVALID_ACTION');
				await this.games.claimTimeout(this.gameId, this.user, body.expectedRevision as number | undefined);
			} else if (type === 'chatPost') {
				if (typeof body.text !== 'string') throw new HataigoError('INVALID_ACTION');
				await this.chat.post(this.gameId, this.user, body.text);
			} else if (type === 'chatDelete') {
				if (typeof body.messageId !== 'string' || (body.reason !== 'abuse' && body.reason !== 'spam' && body.reason !== 'other')) throw new HataigoError('INVALID_ACTION');
				await this.chat.delete(body.messageId, this.user, body.reason, this.gameId);
			} else if (type === 'reaction') {
				if (!isHataigoReaction(body.reaction)) throw new HataigoError('INVALID_ACTION');
				await this.games.get(this.gameId, this.user);
				await this.games.rateLimit(this.user.id, 'reaction', 1, 3000);
				this.events.publishHataigoGameStream(this.gameId, 'reacted', { reaction: body.reaction });
			} else { throw new HataigoError('INVALID_ACTION'); }
			if (!this.isClosed() && requestId) this.send('ack', { requestId, ok: true });
		} catch (error) {
			if (!this.isClosed() && requestId) this.send('ack', { requestId, ok: false, error: hataigoErrorCode(error) });
		}
	}

	private async leavePresence(): Promise<void> {
		const member = this.presenceMember;
		this.presenceMember = null;
		if (member) await this.removePresence(member);
	}

	private async removePresence(member: string): Promise<void> {
		if (!this.gameId) return;
		const now = Date.now();
		const presence = parseHataigoPresence(await this.redis.eval(hataigoPresenceScript, 2, ...hataigoPresenceKeys(this.gameId), now - 65000, now, member, 'leave'));
		if (presence?.changed) this.events.publishHataigoGameStream(this.gameId, 'spectators', { count: presence.count });
	}

	@bindThis public dispose(): void {
		this.closed = true;
		if (this.heartbeat) clearInterval(this.heartbeat);
		this.heartbeat = null;
		if (this.gameId) this.subscriber.off(`hataigoGameStream:${this.gameId}`, this.onEvent);
		void this.leavePresence().catch(() => {});
	}
}

@Injectable()
export class HataigoGameChannelService implements MiChannelService<false> {
	public readonly shouldShare = HataigoGameChannel.shouldShare;
	public readonly requireCredential = HataigoGameChannel.requireCredential;
	public readonly kind = undefined;
	constructor(private games: HataigoService, @Inject(DI.redis) private redis: Redis.Redis, private events: GlobalEventService, private chat: HataigoChatService) {}
	@bindThis public create(id: string, connection: Channel['connection']): HataigoGameChannel { return new HataigoGameChannel(this.games, this.redis, this.events, id, connection, this.chat); }
}
