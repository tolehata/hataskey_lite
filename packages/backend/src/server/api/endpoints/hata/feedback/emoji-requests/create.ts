import ms from 'ms';
/*
 * 旗鯖fork: HataFeed のカスタム絵文字 追加申請を作成する。
 * 自前画像(image)は fileId、リモート絵文字(remote)は originalUrl が必要。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FeedbackEmojiRequestsRepository } from '@/models/_.js';
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
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '2e4d5f60-4a33-4bed-47f9-364758697081' },
		noImage: { message: 'No image source (fileId for image / originalUrl for remote).', code: 'NO_IMAGE_SOURCE', id: '3f5e6071-5b44-4cfe-58fa-475869708192' },
		remoteNotAllowed: { message: 'Requesting remote emoji is not allowed for your account.', code: 'HATAFEED_REMOTE_EMOJI_NOT_ALLOWED', id: '4061a283-6c55-4d0f-69fb-58697081a324' },
		quotaExceeded: { message: 'Weekly emoji request quota exceeded.', code: 'HATAFEED_EMOJI_QUOTA_EXCEEDED', id: '51728394-7d66-4e10-7a0c-697081a32435' },
	},
	limit: { duration: ms('1hour'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 128 },
		category: { type: 'string', maxLength: 128, nullable: true },
		aliases: { type: 'array', items: { type: 'string', maxLength: 128 }, default: [] },
		license: { type: 'string', maxLength: 1024, nullable: true },
		localOnly: { type: 'boolean', default: false },
		isSensitive: { type: 'boolean', default: false },
		sourceType: { type: 'string', enum: ['remote', 'image'] },
		originalUrl: { type: 'string', maxLength: 512, nullable: true },
		remoteHost: { type: 'string', maxLength: 512, nullable: true },
		fileId: { type: 'string', format: 'misskey:id', nullable: true },
	},
	required: ['name', 'sourceType'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackEmojiRequestsRepository)
		private feedbackEmojiRequestsRepository: FeedbackEmojiRequestsRepository,

		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			if (ps.sourceType === 'image' && ps.fileId == null) throw new ApiError(meta.errors.noImage);
			if (ps.sourceType === 'remote' && ps.originalUrl == null) throw new ApiError(meta.errors.noImage);

			// 旗鯖fork(セキュリティ修正): originalUrlは申請者由来。http/https以外(javascript:, data: 等)を拒否。
			//   スタッフが承認画面で踏むとモデ権限のコンテキストで動作するため重要。
			if (ps.originalUrl != null) {
				try { const p = new URL(ps.originalUrl); if (p.protocol !== 'http:' && p.protocol !== 'https:') throw new ApiError(meta.errors.noImage); }
				catch { throw new ApiError(meta.errors.noImage); }
			}

			// リモート絵文字の申請はロールポリシーで別途許可が必要。週次クォータ(emojiRequestLimit、既定10)も確認。
			// スタッフ(管理者/モデレーター)はクォータ免除(直接追加できるため)。
			const quota = await this.feedbackService.getEmojiRequestQuota(me.id);
			const staff = await this.feedbackService.isStaff(me.id);
			if (ps.sourceType === 'remote' && !quota.canRemote) throw new ApiError(meta.errors.remoteNotAllowed);
			if (!staff && quota.remaining <= 0) throw new ApiError(meta.errors.quotaExceeded);

			const id = await this.feedbackService.createEmojiRequest(me, {
				name: ps.name,
				category: ps.category ?? null,
				aliases: ps.aliases,
				license: ps.license ?? null,
				localOnly: ps.localOnly,
				isSensitive: ps.isSensitive,
				sourceType: ps.sourceType,
				originalUrl: ps.originalUrl ?? null,
				remoteHost: ps.remoteHost ?? null,
				fileId: ps.fileId ?? null,
			});

			const req = await this.feedbackEmojiRequestsRepository.findOneByOrFail({ id });
			return await this.feedbackEntityService.packEmojiRequest(req);
		});
	}
}
