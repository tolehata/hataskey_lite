import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の Issue を削除する。管理者・モデレーター専用。
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
	requireModerator: true,
	// 旗鯖fork: kind が permissions enum の要素ではないため、IEndpointMeta の union を
	// secure(サードパーティアプリからの呼び出し不可)側で満たす。挙動は変えない(元々スタッフ専用)。
	secure: true,
	kind: 'write:admin',
	errors: {
		noSuchIssue: { message: 'No such issue.', code: 'NO_SUCH_ISSUE', id: 'd9e80a1b-1700-4476-f2b4-81920314a3b5' },
	},
	limit: { duration: ms('1hour'), max: 30 },
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
			const issue = await this.feedbackIssuesRepository.findOneBy({ id: ps.issueId });
			if (issue == null) throw new ApiError(meta.errors.noSuchIssue);
			await this.feedbackService.deleteIssue(issue);
		});
	}
}
