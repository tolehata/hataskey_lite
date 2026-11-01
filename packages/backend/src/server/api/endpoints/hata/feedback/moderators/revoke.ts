/*
 * 旗鯖fork: HataFeed の Issue 個別のモデレーター対処権限を剥奪する。管理者専用。
 */
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackIssuesRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	requireAdmin: true,
	// 旗鯖fork: kind が permissions enum の要素ではないため、IEndpointMeta の union を
	// secure(サードパーティアプリからの呼び出し不可)側で満たす。挙動は変えない(元々管理者専用)。
	secure: true,
	kind: 'write:admin',
	errors: {
		noSuchIssue: { message: 'No such issue.', code: 'NO_SUCH_ISSUE', id: 'b7c8d945-d3cc-4476-c061-25a647596a7b' },
	},
	// 旗鯖fork(セキュリティ): grant と同等の制限を適用。
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		issueId: { type: 'string', format: 'misskey:id' },
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['issueId', 'userId'],
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
			await this.feedbackService.revokeModerator(issue, ps.userId);
		});
	}
}
