/*
 * 旗鯖fork: Hatady の本を削除する(本人のみ)。紐づくログの bookId は SET NULL で外れる。
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
		noSuchBook: {
			message: 'No such book or access denied.',
			code: 'NO_SUCH_BOOK',
			id: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		bookId: { type: 'string', format: 'misskey:id' },
	},
	required: ['bookId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.hatadyService.deleteBook(me, ps.bookId);
			} catch {
				throw new ApiError(meta.errors.noSuchBook);
			}
		});
	}
}
