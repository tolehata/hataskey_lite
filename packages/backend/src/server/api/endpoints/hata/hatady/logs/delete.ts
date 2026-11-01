/*
 * 旗鯖fork: Hatady の学習ログを削除する(本人のみ)。関連リアクション/コメント/通知は CASCADE 削除。
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
	limit: HATADY_RATE_LIMITS.destructive,
	errors: {
		noSuchLog: {
			message: 'No such log or access denied.',
			code: 'NO_SUCH_LOG',
			id: 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		logId: { type: 'string', format: 'misskey:id' },
	},
	required: ['logId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.hatadyService.deleteLog(me, ps.logId);
			} catch {
				throw new ApiError(meta.errors.noSuchLog);
			}
		});
	}
}
