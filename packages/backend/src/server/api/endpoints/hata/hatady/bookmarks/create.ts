/*
 * 旗鯖fork(Hatady): 本にしおりを追加する(本の所有者のみ)。
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
			id: 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b9c',
		},
		bookmarkLimitExceeded: {
			message: 'You have reached the maximum number of bookmarks for this book allowed by your role.',
			code: 'HATADY_BOOKMARK_LIMIT_EXCEEDED',
			id: 'b9c0d1e2-f3a4-4b5c-8d6e-7f8a9b0c1d2e',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		bookId: { type: 'string', format: 'misskey:id' },
		page: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
		name: { type: 'string', maxLength: 128, nullable: true },
		color: { type: 'string', maxLength: 16, nullable: true },
		memo: { type: 'string', maxLength: 2048, nullable: true },
	},
	required: ['bookId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const bm = await this.hatadyService.createBookmark(me, {
					bookId: ps.bookId,
					page: ps.page,
					name: ps.name ?? null,
					color: ps.color ?? null,
					memo: ps.memo ?? null,
				});
				return this.hatadyEntityService.packBookmark(bm);
			} catch (e) {
				if (e instanceof Error && e.message === HatadyService.ERR_BOOKMARK_LIMIT) throw new ApiError(meta.errors.bookmarkLimitExceeded);
				throw new ApiError(meta.errors.noSuchBook);
			}
		});
	}
}
