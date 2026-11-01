/*
 * 旗鯖fork: HataFeed の Issue 単体取得(詳細)。
 */
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			issue: { type: 'object', optional: false, nullable: false },
			canManage: { type: 'boolean', optional: false, nullable: false },
			moderators: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
			participants: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
		},
	},
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '73849501-9f88-4032-8c2d-819203142537' },
		noSuchIssue: { message: 'No such issue.', code: 'NO_SUCH_ISSUE', id: '8495a612-a099-4143-9d3e-92031425a648' },
	},
	// 旗鯖fork(セキュリティ): 詳細画面で頻繁に叩かれる読取のため、緩めの 1分120回。
	limit: { duration: ms('1min'), max: 120 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		issueId: { type: 'string', format: 'misskey:id' },
		// 旗鯖fork: 「#番号」リンクからの参照用。issueId か number のどちらかを指定。
		number: { type: 'integer' },
	},
	anyOf: [
		{ required: ['issueId'] },
		{ required: ['number'] },
	],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,

		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const issue = ps.issueId != null
				? await this.feedbackIssuesRepository.findOneBy({ id: ps.issueId })
				: ps.number != null
					? await this.feedbackIssuesRepository.findOneBy({ number: ps.number })
					: null;
			if (issue == null) throw new ApiError(meta.errors.noSuchIssue);

			// 旗鯖fork: 可視性判定(security イシュー / サスペンド中プロジェクト)は
			//   FeedbackService.canViewIssue に集約。存在ごと隠す。
			if (!await this.feedbackService.canViewIssue(me.id, issue)) {
				throw new ApiError(meta.errors.noSuchIssue);
			}

			return {
				issue: await this.feedbackEntityService.packIssue(issue, me),
				canManage: await this.feedbackService.canManageIssue(me.id, issue),
				moderators: await this.feedbackEntityService.packIssueModerators(issue.id),
				participants: await this.feedbackEntityService.packIssueParticipants(issue.id),
			};
		});
	}
}
