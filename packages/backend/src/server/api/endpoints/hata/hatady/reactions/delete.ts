/*
 * 旗鯖fork: Hatady の学習ログ / コメントへの自分のリアクションを取り消す。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { ApiError } from '@/server/api/error.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.write,
	errors: {
		invalidTarget: {
			message: 'Specify exactly one of logId or commentId.',
			code: 'INVALID_TARGET',
			id: 'e3f4a5b6-c7d8-4e9f-0a1b-2c3d4e5f6a7b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		logId: { type: 'string', format: 'misskey:id', nullable: true },
		commentId: { type: 'string', format: 'misskey:id', nullable: true },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const hasLog = ps.logId != null;
			const hasComment = ps.commentId != null;
			if (hasLog === hasComment) throw new ApiError(meta.errors.invalidTarget);
			await this.hatadyService.unreact(me, { logId: ps.logId ?? null, commentId: ps.commentId ?? null });
		});
	}
}
