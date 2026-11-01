/*
 * 旗鯖fork: Hatady に本を追加する(手入力・表紙はタイトルから自動生成)。
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
		bookLimitExceeded: {
			message: 'You have reached the maximum number of books allowed by your role.',
			code: 'HATADY_BOOK_LIMIT_EXCEEDED',
			id: 'a8b9c0d1-e2f3-4a5b-8c6d-7e8f9a0b1c2d',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		...BOOK_INPUT_PROPERTIES,
		title: { type: 'string', minLength: 1, maxLength: 512 },
		author: { type: 'string', maxLength: 256, nullable: true },
		totalPages: { type: 'integer', minimum: 1, maximum: 100000, nullable: true },
		status: { type: 'string', enum: ['reading', 'finished', 'want', 'tsundoku'], default: 'reading' },
		coverColorIndex: { type: 'integer', minimum: 0, maximum: 20, nullable: true },
	},
	required: ['title'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const book = await this.hatadyService.createBook(me, {
					visibility: ps.visibility,
					details: ps.details,
					currentPage: ps.currentPage,
					isFavorite: ps.isFavorite,
					isRecommended: ps.isRecommended,
					finishedAt: ps.finishedAt === undefined ? undefined : ps.finishedAt === null ? null : parseHatadyMediaDateTime(ps.finishedAt, 'finishedAt'),
					title: ps.title,
					author: ps.author ?? null,
					totalPages: ps.totalPages ?? null,
					status: ps.status,
					coverColorIndex: ps.coverColorIndex ?? null,
				});
				return this.hatadyEntityService.packBook(book, true);
			} catch (e) {
				if (e instanceof Error && e.message === HatadyService.ERR_BOOK_LIMIT) throw new ApiError(meta.errors.bookLimitExceeded);
				throw e;
			}
		});
	}
}
