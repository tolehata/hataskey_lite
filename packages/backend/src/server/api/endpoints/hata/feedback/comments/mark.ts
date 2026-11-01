import ms from 'ms';
/*
 * 旗鯖fork: HataFeed のコメントにマーク('important'/'question')を付ける/外す。
 *   コメント投稿者・イシュー対処権限者のみ。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackCommentsRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '0c213d4e-4e5f-4061-bc8d-9e0f1a2b3c45' },
		noSuchComment: { message: 'No such comment.', code: 'HATAFEED_NO_SUCH_COMMENT', id: '1d324e5f-5f60-4172-cd9e-0f1a2b3c4d56' },
		cannotManage: { message: 'You cannot manage this comment.', code: 'HATAFEED_COMMENT_ACCESS_DENIED', id: '2e435f60-6071-4283-de0f-1a2b3c4d5e67' },
	},
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		commentId: { type: 'string', format: 'misskey:id' },
		// null でマーク解除
		mark: { type: 'string', enum: ['important', 'question', null], nullable: true },
	},
	required: ['commentId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackCommentsRepository)
		private feedbackCommentsRepository: FeedbackCommentsRepository,

		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const comment = await this.feedbackCommentsRepository.findOneBy({ id: ps.commentId });
			if (comment == null) throw new ApiError(meta.errors.noSuchComment);
			if (!await this.feedbackService.canManageComment(me.id, comment)) throw new ApiError(meta.errors.cannotManage);

			await this.feedbackService.setCommentMark(comment.id, ps.mark ?? null);
			const updated = await this.feedbackCommentsRepository.findOneByOrFail({ id: comment.id });
			return await this.feedbackEntityService.packComment(updated, me);
		});
	}
}
