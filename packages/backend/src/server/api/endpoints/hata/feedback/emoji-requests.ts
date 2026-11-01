/*
 * 旗鯖fork: HataFeed の絵文字申請一覧。スタッフは全件(status で「未処理」タブ等を絞り込み)、
 * 一般ユーザーは自分の申請のみ閲覧できる。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import type { FeedbackEmojiRequestsRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '1d3c4e5f-3922-4adc-36f8-253647586970' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		status: { type: 'string', enum: ['pending', 'held', 'approved', 'rejected', 'cancelled', null], nullable: true },
		query: { type: 'string', maxLength: 128 },
		filter: { type: 'string', enum: ['all', 'registered', 'waiting'], default: 'all' },
		mine: { type: 'boolean', default: false },
		// 旗鯖fork(#38): 特定IDで1件取得(通知クリック時の状態確認用)
		id: { type: 'string', format: 'misskey:id', nullable: true },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackEmojiRequestsRepository)
		private feedbackEmojiRequestsRepository: FeedbackEmojiRequestsRepository,

		private queryService: QueryService,
		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			const isStaff = await this.feedbackService.isStaff(me.id);

			const query = this.queryService.makePaginationQuery(this.feedbackEmojiRequestsRepository.createQueryBuilder('req'), ps.sinceId, ps.untilId);

			// 旗鯖fork(#38): id指定があれば該当1件のみ(非スタッフは自分の申請のみ、上で適用)
			if (ps.id != null) query.andWhere('req.id = :rid', { rid: ps.id });
			// 非スタッフ、または mine 指定時は自分の申請のみ。
			if (!isStaff || ps.mine) {
				query.andWhere('req.requestedById = :me', { me: me.id });
			}
			if (ps.status != null) query.andWhere('req.status = :status', { status: ps.status });
			if (ps.filter === 'registered') query.andWhere('req.status = \'approved\' AND EXISTS (SELECT 1 FROM emoji e WHERE e.id = req."resolvedEmojiId" AND e.host IS NULL)');
			if (ps.filter === 'waiting') query.andWhere('(req.status IN (\'pending\', \'held\') OR EXISTS (SELECT 1 FROM feedback_emoji_change_request c WHERE c."originalRequestId" = req.id AND c.status IN (\'pending\', \'held\')))');
			const search = ps.query?.trim().replace(/^:|:$/g, '').trim();
			if (search) query.andWhere('(req.name ILIKE :search OR array_to_string(req.aliases, \' \') ILIKE :search OR EXISTS (SELECT 1 FROM emoji e WHERE e.id = req."resolvedEmojiId" AND (e.name ILIKE :search OR array_to_string(e.aliases, \' \') ILIKE :search)))', { search: `%${sqlLikeEscape(search)}%` });

			query.orderBy('req.id', 'DESC');
			const reqs = await query.limit(ps.limit).getMany();
			return await this.feedbackEntityService.packEmojiRequests(reqs);
		});
	}
}
