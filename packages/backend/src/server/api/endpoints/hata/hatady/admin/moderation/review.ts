/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyModerationService } from '@/core/HatadyModerationService.js';
import { HATADY_MODERATION_STATES } from '@/models/HatadyModerationReview.js';
import { moderationErrors, moderationResult, moderationTargetParams, moderationDetailSchema } from './_schemas.js';

export const meta = {
	tags: ['hata', 'admin'], requireCredential: true, requireModerator: true, secure: true,
	kind: 'write:admin:resolve-abuse-user-report',
	limit: HATADY_RATE_LIMITS.write,
	errors: moderationErrors,
	res: moderationDetailSchema,
} as const;

export const paramDef = {
	type: 'object', properties: {
		...moderationTargetParams,
		state: { type: 'string', enum: HATADY_MODERATION_STATES },
		note: { type: 'string', maxLength: 1000 },
		expectedRevision: { type: 'integer', minimum: 0, maximum: 2147483646 },
		expectedContentVersion: { type: 'string', pattern: '^[a-f0-9]{64}$' },
	}, required: ['targetType', 'targetId', 'state', 'note', 'expectedRevision', 'expectedContentVersion'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyModerationService) {
		super(meta, paramDef, async (ps, me, token) => moderationResult(() => service.review(me, ps, token)));
	}
}
