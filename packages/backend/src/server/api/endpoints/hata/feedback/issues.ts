/*
 * 旗鯖fork: HataFeed の Issue 一覧。projectId 未指定なら公式(インスタンス)フィードバック。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import type { FeedbackIssuesRepository, FeedbackProjectsRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { applyFeedbackIssueListFilter } from '@/misc/feedback-issue-list-filter.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: { type: 'object', optional: false, nullable: false },
	},
	errors: {
		accessDenied: {
			message: 'HataFeed is not available for your account.',
			code: 'HATAFEED_ACCESS_DENIED',
			id: 'b1c0e1a2-7f00-4e10-9a3c-0f1e2d3c4b5a',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		projectId: { type: 'string', format: 'misskey:id', nullable: true },
		category: { type: 'string', nullable: true },
		status: { type: 'string', nullable: true },
		// 旗鯖fork(2a): 作成者で絞り込む。
		createdById: { type: 'string', format: 'misskey:id', nullable: true },
		// 旗鯖fork: 検索。タイトル・説明・会話(コメント本文)を横断して絞り込む。
		query: { type: 'string', nullable: true },
		includeClosed: { type: 'boolean', default: false },
		order: { type: 'string', enum: ['pinned', 'recent'], default: 'pinned' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,
		@Inject(DI.feedbackProjectsRepository)
		private feedbackProjectsRepository: FeedbackProjectsRepository,

		private queryService: QueryService,
		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			// 旗鯖fork: サスペンド中のプロジェクトのイシューは、作成者・鯖缶以外には返さない。
			if (ps.projectId != null) {
				const project = await this.feedbackProjectsRepository.findOneBy({ id: ps.projectId });
				if (project != null && !await this.feedbackService.canViewProject(me.id, project)) {
					return [];
				}
			}

			const query = this.queryService.makePaginationQuery(this.feedbackIssuesRepository.createQueryBuilder('issue'), ps.sinceId, ps.untilId);

			applyFeedbackIssueListFilter(query, ps, await this.feedbackService.isStaff(me.id));

			// An ID cursor needs a matching sort for the cross-app feed; preserve the normal pinned list.
			if (ps.order === 'recent') query.orderBy('issue.id', 'DESC');
			else query.orderBy('issue.pinned', 'DESC').addOrderBy('issue.id', 'DESC');

			const issues = await query.limit(ps.limit).getMany();
			// 旗鯖fork: N+1 解消のため packIssues でバッチ pack。
			return await this.feedbackEntityService.packIssues(issues, me);
		});
	}
}
