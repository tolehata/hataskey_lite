import ms from 'ms';
/*
 * 旗鯖fork: HataFeed のコメントへのリアクションをトグルする(同じ絵文字なら解除、別なら差し替え)。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: { reacted: { type: 'boolean', optional: false, nullable: false } },
	},
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'c8d7f819-e477-4587-e1a3-708192031425' },
		// 旗鯖fork(セキュリティ): 閲覧できないイシューのコメントは存在ごと隠す(未存在と同じ応答)。
		noSuchComment: { message: 'No such comment.', code: 'NO_SUCH_COMMENT', id: 'd9e8a920-f588-4698-f2b4-819203142536' },
	},
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		commentId: { type: 'string', format: 'misskey:id' },
		reaction: { type: 'string', minLength: 1, maxLength: 260 },
	},
	required: ['commentId', 'reaction'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			// 旗鯖fork(セキュリティ): commentId 直指定のため、そのコメントが属するイシューの
			//   可視性を確認する(security / サスペンド中プロジェクト)。
			if (!await this.feedbackService.canViewComment(me.id, ps.commentId)) throw new ApiError(meta.errors.noSuchComment);
			const reacted = await this.feedbackService.toggleCommentReaction(me, ps.commentId, ps.reaction);
			return { reacted };
		});
	}
}
