/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.destructive,
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		noSuchComment: {
			message: 'No such comment or access denied.',
			code: 'NO_SUCH_COMMENT',
			id: '75676a69-1144-4c83-a33e-03e866df3325',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: { commentId: { type: 'string', format: 'misskey:id' } },
	required: ['commentId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private hatadyService: HatadyService) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.hatadyService.deleteComment(me, ps.commentId);
				return {};
			} catch {
				throw new ApiError(meta.errors.noSuchComment);
			}
		});
	}
}
