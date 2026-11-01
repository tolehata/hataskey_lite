/*
 * 旗鯖fork: HataFeed の絵文字申請用に、リモート(連合先)のカスタム絵文字を一覧/検索する。
 * カスタム絵文字管理のリモートタブ相当。ロールポリシー canRequestRemoteEmoji(またはスタッフ)が必要。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { EmojisRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: { type: 'object', optional: false, nullable: false },
	},
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '73849516-9f88-4032-8c2d-7081a3243546' },
		remoteNotAllowed: { message: 'Browsing remote emoji is not allowed for your account.', code: 'HATAFEED_REMOTE_EMOJI_NOT_ALLOWED', id: '8495a627-a099-4143-9d3e-7192a3243657' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		query: { type: 'string', nullable: true, default: null },
		host: { type: 'string', nullable: true, default: null },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private utilityService: UtilityService,
		private queryService: QueryService,
		private emojiEntityService: EmojiEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			if (!await this.feedbackService.canRequestRemoteEmoji(me.id)) throw new ApiError(meta.errors.remoteNotAllowed);

			const q = this.queryService.makePaginationQuery(this.emojisRepository.createQueryBuilder('emoji'), ps.sinceId, ps.untilId);

			if (ps.host == null) {
				q.andWhere('emoji.host IS NOT NULL');
			} else {
				q.andWhere('emoji.host = :host', { host: this.utilityService.toPuny(ps.host) });
			}
			if (ps.query) {
				q.andWhere('emoji.name like :query', { query: '%' + sqlLikeEscape(ps.query) + '%' });
			}

			const emojis = await q.orderBy('emoji.id', 'DESC').limit(ps.limit).getMany();
			return this.emojiEntityService.packDetailedMany(emojis);
		});
	}
}
