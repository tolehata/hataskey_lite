/*
 * 旗鯖fork: HataFeed の Issue 内コメント(会話)一覧。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import type { FeedbackCommentsRepository, FeedbackIssuesRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'f5a4c5e6-b144-4254-be70-4d5e6f708192' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		issueId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: ['issueId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackCommentsRepository)
		private feedbackCommentsRepository: FeedbackCommentsRepository,
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,

		private queryService: QueryService,
		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			// 旗鯖fork(セキュリティ): そのイシューを閲覧してよいかを確認する。
			//   canAccess は「HataFeed を使えるか」しか見ないため、これが無いと
			//   security イシューやサスペンド中プロジェクトの会話が issueId 直指定で読めてしまう。
			//   issues.ts の作法に倣い、見えないイシューは空配列を返して存在ごと隠す。
			const issue = await this.feedbackIssuesRepository.findOneBy({ id: ps.issueId });
			if (issue == null) return [];
			if (!await this.feedbackService.canViewIssue(me.id, issue)) return [];

			const query = this.queryService.makePaginationQuery(this.feedbackCommentsRepository.createQueryBuilder('comment'), ps.sinceId, ps.untilId)
				.andWhere('comment.feedbackId = :issueId', { issueId: ps.issueId })
				.orderBy('comment.id', 'ASC');

			const comments = await query.limit(ps.limit).getMany();
			// 旗鯖fork: N+1 解消のため packComments でバッチ pack。
			return await this.feedbackEntityService.packComments(comments, me);
		});
	}
}
