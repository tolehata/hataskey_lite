/*
 * 旗鯖fork: HataFeed のプロジェクト(自分のソフトウェア等)を作成する。
 */
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: 'c8d9ea56-e4dd-4587-d172-5a647596a7b8' },
		staffOnly: { message: 'Only staff can manage projects.', code: 'HATAFEED_PROJECT_STAFF_ONLY', id: 'd9ea0b67-f5ee-4698-e283-6b7081920314' },
	},
	// 旗鯖fork(セキュリティ): スタッフ専用の重い書込のため、1時間あたり30回までに制限。
	limit: { duration: ms('1hour'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', maxLength: 4096, default: '' },
		url: { type: 'string', maxLength: 512, nullable: true },
		iconFileId: { type: 'string', format: 'misskey:id', nullable: true },
		color: { type: 'string', maxLength: 16, nullable: true },
		genre: { type: 'string', maxLength: 128, nullable: true },
	},
	required: ['name'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			// プロジェクトの作成・管理はスタッフ(管理者/モデレーター)のみ。
			if (!await this.feedbackService.isStaff(me.id)) throw new ApiError(meta.errors.staffOnly);

			const id = await this.feedbackService.createProject(me, {
				name: ps.name,
				description: ps.description,
				url: ps.url ?? null,
				iconFileId: ps.iconFileId ?? null,
				color: ps.color ?? null,
				genre: ps.genre ?? null,
			});
			return await this.feedbackEntityService.packProject(id);
		});
	}
}
