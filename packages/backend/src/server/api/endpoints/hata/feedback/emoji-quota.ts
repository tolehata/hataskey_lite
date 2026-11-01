/*
 * 旗鯖fork: HataFeed の絵文字申請クォータ(週次)を返す。残数・上限・リモート申請可否・リセット予定時刻。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			limit: { type: 'integer', optional: false, nullable: false },
			used: { type: 'integer', optional: false, nullable: false },
			remaining: { type: 'integer', optional: false, nullable: false },
			canRemote: { type: 'boolean', optional: false, nullable: false },
			resetAt: { type: 'string', optional: false, nullable: true },
		},
	},
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '62839405-8e77-4f21-8b1d-7081a3243546' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			return await this.feedbackService.getEmojiRequestQuota(me.id);
		});
	}
}
