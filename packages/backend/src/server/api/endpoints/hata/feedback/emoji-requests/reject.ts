import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の絵文字申請を却下する。スタッフ専用。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackEmojiRequestsRepository } from '@/models/_.js';
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
		noSuchRequest: { message: 'No such emoji request.', code: 'NO_SUCH_EMOJI_REQUEST', id: '51728394-7d66-4e10-7a0c-697081920314' },
	},
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		requestId: { type: 'string', format: 'misskey:id' },
		comment: { type: 'string', maxLength: 1024, nullable: true },
	},
	required: ['requestId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackEmojiRequestsRepository)
		private feedbackEmojiRequestsRepository: FeedbackEmojiRequestsRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const req = await this.feedbackEmojiRequestsRepository.findOneBy({ id: ps.requestId });
			if (req == null) throw new ApiError(meta.errors.noSuchRequest);
			await this.feedbackService.rejectEmojiRequest(me, req, ps.comment ?? null);
		});
	}
}
