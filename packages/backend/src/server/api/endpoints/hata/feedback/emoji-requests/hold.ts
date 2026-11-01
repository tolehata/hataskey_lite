import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の絵文字申請を保留にする。スタッフ専用。
 * ⚠️承認画面で管理者が直した入力値を一緒に受け取り、保存してから保留にする。
 *   （保留のたびに入力が消えると、後で最初から入力し直すことになるため）
 * ⚠️受け取る項目は approve.ts と揃える。片方だけ増やすと「承認では直せるが保留では消える」ことになる。
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
	// secure(サードパーティアプリからの呼び出し不可)側で満たす。
	secure: true,
	kind: 'write:admin',
	errors: {
		noSuchRequest: { message: 'No such emoji request.', code: 'NO_SUCH_EMOJI_REQUEST', id: '62839405-8e77-4f21-8b1d-7a8192031425' },
	},
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		requestId: { type: 'string', format: 'misskey:id' },
		comment: { type: 'string', maxLength: 1024, nullable: true },
		name: { type: 'string', minLength: 1, maxLength: 128 },
		category: { type: 'string', maxLength: 128, nullable: true },
		aliases: { type: 'array', items: { type: 'string', maxLength: 128 } },
		license: { type: 'string', maxLength: 1024, nullable: true },
		localOnly: { type: 'boolean' },
		isSensitive: { type: 'boolean' },
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
			await this.feedbackService.holdEmojiRequest(me, req, {
				name: ps.name,
				category: ps.category,
				aliases: ps.aliases,
				license: ps.license,
				localOnly: ps.localOnly,
				isSensitive: ps.isSensitive,
			}, ps.comment ?? null);
		});
	}
}
