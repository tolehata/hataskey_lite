/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { MiNote, MiUser } from '@/models/_.js';
import { hasLtlPunchTrigger, validLtlPunchId, type LtlPunchState } from '@/misc/ltl-punch.js';
import { LTL_PUNCH_SCRIPT } from '@/misc/ltl-punch-redis.js';
import { GlobalEventService } from './GlobalEventService.js';
import { AchievementService } from './AchievementService.js';

@Injectable()
export class LtlPunchService implements OnModuleInit, OnApplicationShutdown {
	private timer?: ReturnType<typeof setInterval>;
	private ticking = false;
	private awardCursor = '0';
	private awardPage: string[] = [];
	private readonly prefix = 'ltlPunch:';

	constructor(
		@Inject(DI.redis) private redis: Redis.Redis,
		private globalEventService: GlobalEventService,
		private achievementService: AchievementService,
	) {}

	public onModuleInit(): void {
		this.timer = setInterval(() => { void this.tick(); }, 1000);
		this.timer.unref();
		void this.tick();
	}

	public onApplicationShutdown(): void {
		clearInterval(this.timer);
	}

	private async transition(operation: 'start' | 'sync' | 'attack' | 'tick', userId = '', eventId = '', requestId = '') {
		const keys = ['state', 'presence', 'participants', 'awards', 'lastAttack', 'requests', `daily:${userId}`].map(key => this.prefix + key);
		const raw = await this.redis.eval(LTL_PUNCH_SCRIPT, keys.length, ...keys, operation, '', userId, eventId, requestId);
		const result = JSON.parse(String(raw)) as { state: LtlPunchState | null; changed: boolean; started: boolean };
		// Internal ratio prevents HP drift on presence changes; it is never part of the wire contract.
		if (result.state) {
			const { id, revision, startedAt, fallAt, endsAt, finishedAt, status, hp, maxHp, people, serverNow } = result.state;
			result.state = { id, revision, startedAt, fallAt, endsAt, finishedAt, status, hp, maxHp, people, serverNow };
		}
		if (result.changed || operation === 'tick') await this.globalEventService.publishLtlPunchStream(result.state);
		return result;
	}

	public async onNoteCreated(note: MiNote, user: Pick<MiUser, 'id' | 'host'>): Promise<boolean> {
		if (user.host !== null || note.userHost !== null || note.userId !== user.id || note.visibility !== 'public' || note.channelId !== null || !hasLtlPunchTrigger(note.text)) return false;
		return (await this.transition('start', user.id, randomUUID())).started;
	}

	public async sync(userId: string): Promise<LtlPunchState | null> {
		return (await this.transition('sync', userId)).state;
	}

	public async attack(userId: string, eventId: unknown, requestId: unknown): Promise<LtlPunchState | null> {
		if (!validLtlPunchId(eventId) || !validLtlPunchId(requestId)) return null;
		return (await this.transition('attack', userId, eventId, requestId)).state;
	}

	private async tick(): Promise<void> {
		if (this.ticking) return;
		this.ticking = true;
		try {
			await this.transition('tick');
			// A bounded scan keeps large participant lists off the request path. Failed awards stay pending.
			if (this.awardPage.length === 0) {
				const [cursor, entries] = await this.redis.hscan(this.prefix + 'awards', this.awardCursor, 'COUNT', 50);
				this.awardCursor = cursor;
				this.awardPage = [...entries];
			}
			// COUNT is a hint: compact Redis hashes can return the entire hash at cursor zero.
			// Keep the unprocessed page across ticks so failed early entries cannot starve later ones.
			const entries = this.awardPage.splice(0, 100);
			for (let index = 0; index < entries.length; index += 2) {
				try {
					const award = JSON.parse(entries[index + 1]) as { userId: string; type: 'ltlPunchVictory' | 'ltlPunchDefeat' };
					await this.achievementService.create(award.userId, award.type);
					await this.redis.hdel(this.prefix + 'awards', entries[index]);
				} catch { /* Retry on the next tick; achievement creation is idempotent. */ }
			}
		} catch { /* Redis outages must not terminate the stream worker. */ } finally { this.ticking = false; }
	}
}
