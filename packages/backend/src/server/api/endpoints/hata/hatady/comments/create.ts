/*
 * 旗鯖fork: Hatady の学習ログにコメント(返信)を投稿する。replyId で1段ネスト。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { ApiError } from '@/server/api/error.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.write,
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		noSuchLog: {
			message: 'No such log or access denied.',
			code: 'NO_SUCH_LOG',
			id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		logId: { type: 'string', format: 'misskey:id' },
		replyId: { type: 'string', format: 'misskey:id', nullable: true },
		text: { type: 'string', minLength: 1, maxLength: 2048 },
	},
	required: ['logId', 'text'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const comment = await this.hatadyService.createComment(me, {
					logId: ps.logId,
					replyId: ps.replyId ?? null,
					text: ps.text,
				});
				return await this.hatadyEntityService.packComments([comment], me).then(a => a[0]);
			} catch {
				throw new ApiError(meta.errors.noSuchLog);
			}
		});
	}
}
