import ms from 'ms';
/*
 * 旗鯖fork: HataFeed のコメントを削除する(コメント投稿者・イシュー対処権限者のみ)。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackCommentsRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'd9e8f0a1-1b2c-4d3e-8f4a-5b6c7d8e9f01' },
		noSuchComment: { message: 'No such comment.', code: 'HATAFEED_NO_SUCH_COMMENT', id: 'ea0f1b2c-2c3d-4e5f-9a6b-7c8d9e0f1a23' },
		cannotManage: { message: 'You cannot manage this comment.', code: 'HATAFEED_COMMENT_ACCESS_DENIED', id: 'fb102c3d-3d4e-4f60-ab7c-8d9e0f1a2b34' },
	},
	limit: { duration: ms('1min'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		commentId: { type: 'string', format: 'misskey:id' },
	},
	required: ['commentId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackCommentsRepository)
		private feedbackCommentsRepository: FeedbackCommentsRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const comment = await this.feedbackCommentsRepository.findOneBy({ id: ps.commentId });
			if (comment == null) throw new ApiError(meta.errors.noSuchComment);
			if (!await this.feedbackService.canManageComment(me.id, comment)) throw new ApiError(meta.errors.cannotManage);

			await this.feedbackService.deleteComment(comment);
		});
	}
}
