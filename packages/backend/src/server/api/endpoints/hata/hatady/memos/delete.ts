/*
 * 旗鯖fork(Hatady): 本の内容メモを削除する(本人のみ)。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.destructive,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		memoId: { type: 'string', format: 'misskey:id' },
	},
	required: ['memoId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.hatadyService.deleteMemo(me, ps.memoId);
		});
	}
}
