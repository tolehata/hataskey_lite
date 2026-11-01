/*
 * 旗鯖fork: Hatady の学習ログを1件取得する(会話ページのルート投稿用)。
 *   公開ログは誰でも、非公開ログは所有者のみ取得できる。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { ApiError } from '@/server/api/error.js';
import type { HatadyLogsRepository } from '@/models/_.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.heavyRead,
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		noSuchLog: {
			message: 'No such log.',
			code: 'NO_SUCH_LOG',
			id: 'b7a5b8c1-0d2e-4f3a-9b1c-1a2b3c4d5e6f',
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
		@Inject(DI.hatadyLogsRepository)
		private hatadyLogsRepository: HatadyLogsRepository,

		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me, token) => {
			const log = await this.hatadyLogsRepository.findOneBy({ id: ps.logId });
			if (log == null || !(await this.hatadyService.canViewLog(log, me.id, token == null))) throw new ApiError(meta.errors.noSuchLog);
			return await this.hatadyEntityService.packLog(log, me, token == null && await this.hatadyService.canModerate(me.id));
		});
	}
}
