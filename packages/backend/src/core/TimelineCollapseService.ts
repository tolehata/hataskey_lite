/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import type { MiNote } from '@/models/Note.js';
import type { MiUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';

export const TIMELINE_COLLAPSE_TRIGGER = 'TL崩れる';
export const TIMELINE_COLLAPSE_DURATION_MS = 10_000;
export const TIMELINE_COLLAPSE_DAILY_LIMIT = 2;
export const TIMELINE_COLLAPSE_ACTIVE_MS = TIMELINE_COLLAPSE_DURATION_MS + 1_000;

const COUNTER_TTL_SECONDS = 60 * 60 * 48;
const ACTIVE_KEY = 'hata:timeline-collapse:active';

// 先にサーバー全体の実行中判定を行うことで、演出中の投稿は日次回数を消費しない。
// 日次カウンターの確認・加算と実行中キーの作成までを1つのLuaスクリプトで原子的に行う。
export const TIMELINE_COLLAPSE_CLAIM_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
	return -1
end

local count = tonumber(redis.call('GET', KEYS[2]) or '0')
local limit = tonumber(ARGV[1])
if count >= limit then
	return 0
end

local nextCount = redis.call('INCR', KEYS[2])
if nextCount == 1 then
	redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
end
redis.call('PSETEX', KEYS[1], tonumber(ARGV[3]), '1')
return nextCount
`;

@Injectable()
export class TimelineCollapseService {
	constructor(
		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		private globalEventService: GlobalEventService,
	) {
	}

	@bindThis
	public async onNoteCreated(note: Pick<MiNote, 'text' | 'visibility' | 'channelId'>, user: Pick<MiUser, 'id' | 'host'>): Promise<boolean> {
		// 全クライアント向けbroadcastへ流すため、公開LTLに出るローカル投稿だけを対象にする。
		// 非公開・チャンネル投稿の存在を、閲覧権限のない利用者へ示さない。
		if (user.host !== null || note.text !== TIMELINE_COLLAPSE_TRIGGER || note.visibility !== 'public' || note.channelId !== null) {
			return false;
		}

		const serverDay = this.getServerDay(new Date());
		const counterKey = `hata:timeline-collapse:${serverDay}:${user.id}`;
		const result = Number(await this.redisClient.eval(
			TIMELINE_COLLAPSE_CLAIM_SCRIPT,
			2,
			ACTIVE_KEY,
			counterKey,
			TIMELINE_COLLAPSE_DAILY_LIMIT,
			COUNTER_TTL_SECONDS,
			TIMELINE_COLLAPSE_ACTIVE_MS,
		));

		if (result <= 0) return false;

		// 投稿者・ノートの情報は載せず、同じサーバーのbroadcast購読者へ空の合図だけを送る。
		this.globalEventService.publishBroadcastStream('hataTimelineCollapse', {});
		return true;
	}

	@bindThis
	private getServerDay(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		const day = String(date.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
}
