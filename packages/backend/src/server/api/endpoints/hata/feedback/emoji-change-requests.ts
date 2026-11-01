/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { FeedbackEmojiChangeRequestsRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { FeedbackService } from '@/core/FeedbackService.js';
import { FeedbackEntityService } from '@/core/entities/FeedbackEntityService.js';
import { QueryService } from '@/core/QueryService.js';
import { feedbackEmojiErrors } from '@/misc/feedback-emoji-errors.js';

export const meta = { tags: ['hata'], requireCredential: true, kind: 'read:account', errors: feedbackEmojiErrors, res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } } } as const;
export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string', format: 'misskey:id' }, originalRequestId: { type: 'string', format: 'misskey:id' },
		mine: { type: 'boolean', default: false },
		status: { type: 'string', enum: ['pending', 'held', 'approved', 'rejected'] },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		untilId: { type: 'string', format: 'misskey:id' }, sinceId: { type: 'string', format: 'misskey:id' },
	}, required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.feedbackEmojiChangeRequestsRepository) private changes: FeedbackEmojiChangeRequestsRepository,
		private feedback: FeedbackService, private entities: FeedbackEntityService, private queries: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (!await this.feedback.canAccess(me.id)) throw new ApiError(meta.errors.accessDenied);
			const query = this.queries.makePaginationQuery(this.changes.createQueryBuilder('req'), ps.sinceId, ps.untilId);
			if (ps.mine || !await this.feedback.isStaff(me.id)) query.andWhere('req.requestedById = :me', { me: me.id });
			if (ps.id) query.andWhere('req.id = :id', { id: ps.id });
			if (ps.originalRequestId) query.andWhere('req.originalRequestId = :original', { original: ps.originalRequestId });
			if (ps.status) query.andWhere('req.status = :status', { status: ps.status });
			const requests = await query.orderBy('req.id', 'DESC').limit(ps.limit).getMany();
			return Promise.all(requests.map(request => this.entities.packEmojiChangeRequest(request)));
		});
	}
}
