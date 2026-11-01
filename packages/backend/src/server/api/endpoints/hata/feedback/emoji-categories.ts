/*
 * 旗鯖fork: HataFeed の絵文字申請フォーム用に、既存のローカルカスタム絵文字カテゴリ一覧を返す。
 */
import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { EmojisRepository } from '@/models/_.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: { type: 'string', optional: false, nullable: false },
	},
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '95a6b723-b1aa-4254-ae4f-031425a64759' },
	},
	// 旗鯖fork(セキュリティ): DISTINCT クエリでやや重いので、1分60回に制限。
	limit: { duration: ms('1min'), max: 60 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const rows = await this.emojisRepository.createQueryBuilder('emoji')
				.select('emoji.category', 'category')
				.where('emoji.host IS NULL')
				.andWhere('emoji.category IS NOT NULL')
				.andWhere("emoji.category <> ''")
				.distinct(true)
				.orderBy('emoji.category', 'ASC')
				.getRawMany<{ category: string }>();

			return rows.map(r => r.category);
		});
	}
}
