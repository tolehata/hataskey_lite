/*
 * 旗鯖fork: Hatady の学習ログのコメント(返信)一覧を古い順に取得する。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.read,
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
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
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me, token) => {
			// 閲覧権限のないログ(非公開/フォロワー限定で未フォロー)のコメントは返さない。
			const log = await this.hatadyService.getLog(ps.logId);
			if (log == null || !(await this.hatadyService.canViewLog(log, me.id, token == null))) return [];
			const comments = await this.hatadyService.getComments(ps.logId, me.id, token == null);
			return await this.hatadyEntityService.packComments(comments, me);
		});
	}
}
