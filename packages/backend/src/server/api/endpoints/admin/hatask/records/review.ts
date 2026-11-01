/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskRecordReviewService } from '@/core/HataskRecordReviewService.js';
import { HATASK_REVIEW_ERRORS } from '@/core/hatask-record-review.js';
import { HATASK_REVIEW_STATES } from '@/models/HataskRecordReview.js';
import { detailSchema, reviewId } from './_schema.js';
export const meta = {
	tags: ['admin', 'hatask'], requireCredential: true, requireModerator: true, secure: true, kind: 'write:admin:user-note',
	limit: { duration: 60 * 1000, max: 60 }, errors: HATASK_REVIEW_ERRORS, res: detailSchema,
} as const;
export const paramDef = {
	type: 'object', properties: {
		id: reviewId, state: { type: 'string', enum: HATASK_REVIEW_STATES }, expectedRevision: { type: 'integer', minimum: 0, maximum: 2147483646 }, expectedContentVersion: reviewId,
	}, required: ['id', 'state', 'expectedRevision', 'expectedContentVersion'], additionalProperties: false,
} as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: HataskRecordReviewService) {
		super(meta, paramDef, async (ps, me, token) => service.review(me, ps, token));
	}
}
