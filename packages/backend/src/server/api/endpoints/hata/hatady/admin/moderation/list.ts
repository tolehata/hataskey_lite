/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyModerationService, MODERATION_CATEGORIES, MODERATION_ACTIVITIES, MODERATION_VISIBILITIES } from '@/core/HatadyModerationService.js';
import { HATADY_MODERATION_STATES } from '@/models/HatadyModerationReview.js';
import { moderationErrors, moderationResult, moderationEntriesSchema, moderationCountsSchema } from './_schemas.js';

export const meta = {
	tags: ['hata', 'admin'], requireCredential: true, requireModerator: true, secure: true,
	kind: 'write:admin:resolve-abuse-user-report',
	limit: HATADY_RATE_LIMITS.heavyRead,
	errors: moderationErrors,
	res: { type: 'object', optional: false, nullable: false, properties: {
		items: moderationEntriesSchema, nextCursor: { type: 'string', optional: false, nullable: true },
		total: { type: 'integer', optional: false, nullable: false }, counts: moderationCountsSchema,
	}, required: ['items', 'nextCursor', 'total', 'counts'] },
} as const;

export const paramDef = {
	type: 'object', properties: {
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 30 },
		cursor: { type: 'string', minLength: 1, maxLength: 1024 },
		category: { type: 'string', enum: MODERATION_CATEGORIES, default: 'all' },
		status: { type: 'string', enum: ['all', ...HATADY_MODERATION_STATES], default: 'all' },
		activity: { type: 'string', enum: MODERATION_ACTIVITIES, default: 'all' },
		visibility: { type: 'string', enum: MODERATION_VISIBILITIES, default: 'all' },
		query: { type: 'string', maxLength: 200 },
		since: { type: 'integer', minimum: 0, maximum: 8640000000000000 },
		until: { type: 'integer', minimum: 0, maximum: 8640000000000000 },
		sort: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
	}, required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyModerationService) {
		super(meta, paramDef, async (ps, me, token) => moderationResult(() => service.list(me, ps, token)));
	}
}
