/*
 * 旗鯖fork: HataFeed のフィードバックセンター内通知の一覧と未読件数。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import type { FeedbackNotificationsRepository } from '@/models/_.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			unreadCount: { type: 'integer', optional: false, nullable: false },
			notifications: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
		},
	},
	errors: {
		accessDenied: { message: 'HataFeed is not available for your account.', code: 'HATAFEED_ACCESS_DENIED', id: '6283940a-8e77-4f21-8b1d-708192031425' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.feedbackNotificationsRepository)
		private feedbackNotificationsRepository: FeedbackNotificationsRepository,

		private queryService: QueryService,
		private feedbackEntityService: FeedbackEntityService,
		private feedbackService: FeedbackService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedbackService.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);

			const query = this.queryService.makePaginationQuery(this.feedbackNotificationsRepository.createQueryBuilder('n'), ps.sinceId, ps.untilId)
				.andWhere('n.userId = :me', { me: me.id })
				.orderBy('n.id', 'DESC');

			const [notifications, unreadCount] = await Promise.all([
				query.limit(ps.limit).getMany(),
				this.feedbackService.getUnreadCount(me.id),
			]);

			return {
				unreadCount,
				// 旗鯖fork: N+1 解消のため packNotifications でバッチ pack。
				notifications: await this.feedbackEntityService.packNotifications(notifications),
			};
		});
	}
}
