import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の Issue にコメント(会話)を投稿する。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackCommentsRepository, FeedbackIssuesRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { feedbackAttachmentErrors } from '@/misc/feedback-attachments.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		invalidAttachment: feedbackAttachmentErrors.invalidAttachment,
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'a6b5d6f7-c255-4365-cf81-5e6f70819203' },
		noSuchIssue: { message: 'No such issue.', code: 'NO_SUCH_ISSUE', id: 'b7c6e708-d366-4476-d092-6f7081920314' },
		issueClosed: { message: 'This issue is closed.', code: 'HATAFEED_ISSUE_CLOSED', id: 'c8d7f819-e477-4476-e1a3-7081920314a3' },
	},
	limit: { duration: ms('1hour'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		issueId: { type: 'string', format: 'misskey:id' },
		text: { type: 'string', minLength: 1, maxLength: 8192 },
		fileIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, default: [] },
		// 旗鯖fork: 返信先コメントID(任意)
		replyToId: { type: 'string', format: 'misskey:id', nullable: true },
	},
	required: ['issueId', 'text'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackCommentsRepository)
		private feedbackCommentsRepository: FeedbackCommentsRepository,
		@Inject(DI.feedbackIssuesRepository)
		private feedbackIssuesRepository: FeedbackIssuesRepository,

		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const issue = await this.feedbackIssuesRepository.findOneBy({ id: ps.issueId });
			if (issue == null) throw new ApiError(meta.errors.noSuchIssue);
			// 旗鯖fork(セキュリティ): 閲覧できないイシュー(security / サスペンド中プロジェクト)には
			//   コメントも投稿できない。存在ごと隠すため noSuchIssue を返す。
			if (!await this.feedbackService.canViewIssue(me.id, issue)) throw new ApiError(meta.errors.noSuchIssue);
			// クローズ済みのイシューには書き込めない。
			if (issue.closed) throw new ApiError(meta.errors.issueClosed);

			const id = await this.feedbackService.addComment(me, issue, ps.text, ps.fileIds, ps.replyToId ?? null);
			const comment = await this.feedbackCommentsRepository.findOneByOrFail({ id });
			return await this.feedbackEntityService.packComment(comment, me);
		});
	}
}
