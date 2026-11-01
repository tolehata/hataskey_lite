/*
 * 旗鯖fork: Hatady「みんなの学習」公開フィード。全ユーザーの公開ログ(isPublic=true)を
 *   学習時刻(studiedAt)の新しい順に取得する。分野での絞り込みに対応。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import type { HatadyLogsRepository } from '@/models/_.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { DI } from '@/di-symbols.js';
import { applyHatadyLogCursor } from '@/misc/hatady-log-cursor.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.heavyRead,
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// recent=新着 / popular=人気 / following=フォロー中
		type: { type: 'string', enum: ['recent', 'popular', 'following'], default: 'recent' },
		subject: { type: 'string', nullable: true },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hatadyLogsRepository)
		private hatadyLogsRepository: HatadyLogsRepository,

		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// フォロー中: 自分がフォローしているユーザーの公開/フォロワー限定ログ。
			if (ps.type === 'following') {
				const logs = await this.hatadyService.getFollowingTimeline(me.id, { limit: ps.limit, untilId: ps.untilId ?? null, subject: ps.subject ?? null });
				return await this.hatadyEntityService.packLogs(logs, me);
			}

			// 新着 / 人気: 全体公開ログ。
			const query = this.hatadyLogsRepository.createQueryBuilder('log')
				.where('log.isPublic = TRUE');
			const excludedUserIds = [...await this.hatadyService.getTimelineExcludedUserIds(me.id)];
			if (excludedUserIds.length > 0) query.andWhere('log.userId NOT IN (:...excludedUserIds)', { excludedUserIds });
			if (ps.subject != null) query.andWhere('log.subject = :subject', { subject: ps.subject });
			if (ps.untilId != null && !(await applyHatadyLogCursor(query, ps.untilId, ps.type === 'popular'))) return [];
			if (ps.type === 'popular') {
				query.orderBy('log.reactionsCount', 'DESC').addOrderBy('log.studiedAt', 'DESC').addOrderBy('log.id', 'DESC');
			} else {
				query.orderBy('log.studiedAt', 'DESC').addOrderBy('log.id', 'DESC');
			}
			const candidates = await query.limit(ps.limit).getMany();
			const visible = await Promise.all(candidates.map(log => this.hatadyService.canAppearInTimeline(log.userId, me.id)));
			const logs = candidates.filter((_, index) => visible[index]);
			return await this.hatadyEntityService.packLogs(logs, me);
		});
	}
}
