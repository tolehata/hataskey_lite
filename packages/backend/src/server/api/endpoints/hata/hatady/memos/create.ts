/*
 * 旗鯖fork(Hatady): 本に内容メモを追加する(本の所有者のみ)。
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
		noSuchBook: {
			message: 'No such book or access denied.',
			code: 'NO_SUCH_BOOK',
			id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
		},
		memoLimitExceeded: {
			message: 'You have reached the maximum number of memos for this book.',
			code: 'HATADY_MEMO_LIMIT_EXCEEDED',
			id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		bookId: { type: 'string', format: 'misskey:id' },
		text: { type: 'string', minLength: 1, maxLength: 4096 },
		page: { type: 'integer', minimum: 0, maximum: 100000, nullable: true },
	},
	required: ['bookId', 'text'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const memo = await this.hatadyService.createMemo(me, {
					bookId: ps.bookId,
					text: ps.text,
					page: ps.page ?? null,
				});
				return this.hatadyEntityService.packMemo(memo);
			} catch (e) {
				if (e instanceof Error && e.message === HatadyService.ERR_MEMO_LIMIT) throw new ApiError(meta.errors.memoLimitExceeded);
				throw new ApiError(meta.errors.noSuchBook);
			}
		});
	}
}
