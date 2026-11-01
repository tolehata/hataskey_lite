import ms from 'ms';
/*
 * 旗鯖fork: HataFeed の Issue 作成。projectId 未指定なら公式フィードバックへ。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { ApiError } from '@/server/api/error.js';
import { feedbackAttachmentErrors } from '@/misc/feedback-attachments.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
	},
	errors: {
		invalidAttachment: feedbackAttachmentErrors.invalidAttachment,
		accessDenied: {
			message: 'HataFeed is not available for your account.',
			code: 'HATAFEED_ACCESS_DENIED',
			id: 'c2d1f2b3-8e11-4f21-8b4d-1a2b3c4d5e6f',
		},
		staffOnlyCategory: {
			message: 'This category can only be used by staff.',
			code: 'HATAFEED_STAFF_ONLY_CATEGORY',
			id: 'd3e2031c-9f22-4032-9c5e-2b3c4d5e6f71',
		},
	},
	limit: { duration: ms('1hour'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		title: { type: 'string', minLength: 1, maxLength: 256 },
		description: { type: 'string', maxLength: 8192, default: '' },
		category: { type: 'string', enum: ['bug', 'improvement', 'unresolved', 'featureRequest', 'adoptionRequest', 'security', 'betaFeature', 'other'], default: 'bug' },
		priority: { type: 'string', enum: ['low', 'normal', 'high'], default: 'normal' },
		projectId: { type: 'string', format: 'misskey:id', nullable: true },
		fileIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, default: [] },
		// 旗鯖fork: 任意提出のコード
		code: { type: 'string', maxLength: 16384, nullable: true },
	},
	required: ['title'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			// 「改善予定(improvement)」「セキュリティ対応(security)」はユーザーからは選べず、
			// スタッフ(管理者/モデレーター)専用。security は内部限定の扱いなので閲覧・作成ともスタッフのみ。
			if ((ps.category === 'improvement' || ps.category === 'security') && !await this.feedbackService.isStaff(me.id)) {
				throw new ApiError(meta.errors.staffOnlyCategory);
			}

			const id = await this.feedbackService.createIssue(me, {
				title: ps.title,
				description: ps.description,
				category: ps.category,
				priority: ps.priority,
				projectId: ps.projectId ?? null,
				fileIds: ps.fileIds,
				code: ps.code ?? null,
			});

			return await this.feedbackEntityService.packIssue(id, me);
		});
	}
}
