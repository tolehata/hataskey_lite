/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskRecordReviewService } from '@/core/HataskRecordReviewService.js';
import { HATASK_REVIEW_ERRORS } from '@/core/hatask-record-review.js';
import { detailSchema, reviewId } from './_schema.js';
export const meta = {
	tags: ['admin', 'hatask'], requireCredential: true, requireModerator: true, secure: true, kind: 'read:admin:show-user',
	limit: { duration: 60 * 1000, max: 120 }, errors: HATASK_REVIEW_ERRORS, res: detailSchema,
} as const;
export const paramDef = { type: 'object', properties: { id: reviewId }, required: ['id'], additionalProperties: false } as const;
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: HataskRecordReviewService) {
		super(meta, paramDef, async (ps, me, token) => service.show(me, ps.id, token));
	}
}
