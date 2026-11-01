/*
 * 旗鯖fork: Hatady のマイログ(自分の学習ログ)を新しい順に取得する。studiedAt 降順。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import type { HatadyLogsRepository } from '@/models/_.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { DI } from '@/di-symbols.js';
import { applyHatadyLogCursor } from '@/misc/hatady-log-cursor.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.read,
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		subject: { type: 'string', nullable: true },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		untilId: { type: 'string', format: 'misskey:id' },
		// 旗鯖fork: マイログの期間指定ジャンプ用。studiedAt(学習日時)の範囲(エポックms)で絞り込む。
		sinceDate: { type: 'integer', nullable: true },
		untilDate: { type: 'integer', nullable: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hatadyLogsRepository)
		private hatadyLogsRepository: HatadyLogsRepository,

		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.hatadyLogsRepository.createQueryBuilder('log')
				.where('log.userId = :meId', { meId: me.id });
			if (ps.subject != null) query.andWhere('log.subject = :subject', { subject: ps.subject });
			// 旗鯖fork: 期間指定(studiedAt 範囲)。untilDate はその日の終わりまで含めるためフロント側で調整して渡す。
			if (ps.sinceDate != null) query.andWhere('log.studiedAt >= :sinceDate', { sinceDate: new Date(ps.sinceDate) });
			if (ps.untilDate != null) query.andWhere('log.studiedAt <= :untilDate', { untilDate: new Date(ps.untilDate) });
			if (ps.untilId != null && !(await applyHatadyLogCursor(query, ps.untilId))) return [];
			// タイムラインは学習した時刻(studiedAt)の新しい順。同時刻は id で安定化。
			query.orderBy('log.studiedAt', 'DESC').addOrderBy('log.id', 'DESC');
			const logs = await query.limit(ps.limit).getMany();
			return await this.hatadyEntityService.packLogs(logs, me);
		});
	}
}
