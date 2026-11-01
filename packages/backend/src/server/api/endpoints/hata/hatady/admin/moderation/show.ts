/* SPDX-License-Identifier: AGPL-3.0-only */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyModerationService } from '@/core/HatadyModerationService.js';
import { moderationErrors, moderationResult, moderationTargetParams, moderationDetailSchema } from './_schemas.js';

export const meta = {
	tags: ['hata', 'admin'], requireCredential: true, requireModerator: true, secure: true,
	kind: 'write:admin:resolve-abuse-user-report',
	limit: HATADY_RATE_LIMITS.heavyRead,
	errors: moderationErrors,
	res: moderationDetailSchema,
} as const;

export const paramDef = { type: 'object', properties: moderationTargetParams, required: ['targetType', 'targetId'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HatadyModerationService) {
		super(meta, paramDef, async (ps, me, token) => moderationResult(() => service.show(me, ps.targetType, ps.targetId, token)));
	}
}
