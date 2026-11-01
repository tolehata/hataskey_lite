/*
 * 旗鯖fork(Hatady): 本の内容メモを編集する(本人のみ)。本文・ページを更新できる。
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
		noSuchMemo: {
			message: 'No such memo or access denied.',
			code: 'NO_SUCH_MEMO',
			id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		memoId: { type: 'string', format: 'misskey:id' },
		text: { type: 'string', minLength: 1, maxLength: 4096 },
		page: { type: 'integer', minimum: 0, maximum: 100000, nullable: true },
	},
	required: ['memoId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const memo = await this.hatadyService.updateMemo(me, {
					memoId: ps.memoId,
					text: ps.text,
					// page は明示的に渡された時のみ更新(null も「ページ指定なしに戻す」として有効)。
					...(Object.prototype.hasOwnProperty.call(ps, 'page') ? { page: ps.page ?? null } : {}),
				});
				return this.hatadyEntityService.packMemo(memo);
			} catch (e) {
				throw new ApiError(meta.errors.noSuchMemo);
			}
		});
	}
}
