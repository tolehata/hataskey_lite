import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の Issue への賛同(これ困ってる)をトグルする。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			isAgreed: { type: 'boolean', optional: false, nullable: false },
		},
	},
	errors: {
		accessDenied: {
			message: 'HataFeed is not available for your account.',
			code: 'HATAFEED_ACCESS_DENIED',
			id: 'd3e2a3c4-9f22-4032-9c5e-2b3c4d5e6f70',
		},
		noSuchIssue: {
			message: 'No such issue.',
			code: 'NO_SUCH_ISSUE',
			id: 'e4f3b4d5-a033-4143-ad6f-3c4d5e6f7081',
		},
	},
	limit: { duration: ms('1min'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		issueId: { type: 'string', format: 'misskey:id' },
	},
	required: ['issueId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const issue = await this.feedbackIssuesRepository.findOneBy({ id: ps.issueId });
			if (issue == null) throw new ApiError(meta.errors.noSuchIssue);
			// 旗鯖fork(セキュリティ): 閲覧できないイシュー(security / サスペンド中プロジェクト)には
			//   賛同できない。存在ごと隠すため noSuchIssue を返す。
			if (!await this.feedbackService.canViewIssue(me.id, issue)) throw new ApiError(meta.errors.noSuchIssue);

			const isAgreed = await this.feedbackService.toggleAgree(me, issue);
			return { isAgreed };
		});
	}
}
