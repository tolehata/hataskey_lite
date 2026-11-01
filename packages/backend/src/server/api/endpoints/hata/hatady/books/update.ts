/*
 * 旗鯖fork(1m): Hatady の本を編集する(本人のみ)。読書の記録(進捗 currentPage・状態 status)もここで更新。
 */
import { Injectable } from '@nestjs/common';
import { parseHatadyMediaDateTime } from '@/core/HatadyMediaService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { ApiError } from '@/server/api/error.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { BOOK_INPUT_PROPERTIES } from '../_record.js';

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
			id: 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		...BOOK_INPUT_PROPERTIES,
		bookId: { type: 'string', format: 'misskey:id' },
		title: { type: 'string', minLength: 1, maxLength: 512 },
		author: { type: 'string', maxLength: 256, nullable: true },
		totalPages: { type: 'integer', minimum: 1, maximum: 100000, nullable: true },
		currentPage: { type: 'integer', minimum: 0, maximum: 100000 },
		status: { type: 'string', enum: ['reading', 'finished', 'want', 'tsundoku'] },
		coverColorIndex: { type: 'integer', minimum: 0, maximum: 20, nullable: true },
		isFavorite: { type: 'boolean' },
		isRecommended: { type: 'boolean' },
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
				const book = await this.hatadyService.updateBook(me, ps.bookId, {
					visibility: ps.visibility,
					details: ps.details,
					finishedAt: ps.finishedAt === undefined ? undefined : ps.finishedAt === null ? null : parseHatadyMediaDateTime(ps.finishedAt, 'finishedAt'),
					title: ps.title,
					author: ps.author,
					totalPages: ps.totalPages,
					currentPage: ps.currentPage,
					status: ps.status,
					coverColorIndex: ps.coverColorIndex,
					isFavorite: ps.isFavorite,
					isRecommended: ps.isRecommended,
				});
				return this.hatadyEntityService.packBook(book, true);
			} catch {
				throw new ApiError(meta.errors.noSuchBook);
			}
		});
	}
}
