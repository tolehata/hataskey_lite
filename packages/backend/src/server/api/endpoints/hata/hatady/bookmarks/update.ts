/*
 * 旗鯖fork(Hatady): しおりを編集する(本人のみ)。名前・ページ・色・メモを更新できる。
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
		noSuchBookmark: {
			message: 'No such bookmark or access denied.',
			code: 'NO_SUCH_BOOKMARK',
			id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		bookmarkId: { type: 'string', format: 'misskey:id' },
		page: { type: 'integer', minimum: 0, maximum: 100000 },
		name: { type: 'string', maxLength: 128, nullable: true },
		color: { type: 'string', maxLength: 16, nullable: true },
		memo: { type: 'string', maxLength: 2048, nullable: true },
	},
	required: ['bookmarkId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				const bm = await this.hatadyService.updateBookmark(me, {
					bookmarkId: ps.bookmarkId,
					...(Object.prototype.hasOwnProperty.call(ps, 'page') ? { page: ps.page } : {}),
					...(Object.prototype.hasOwnProperty.call(ps, 'name') ? { name: ps.name ?? null } : {}),
					...(Object.prototype.hasOwnProperty.call(ps, 'color') ? { color: ps.color ?? null } : {}),
					...(Object.prototype.hasOwnProperty.call(ps, 'memo') ? { memo: ps.memo ?? null } : {}),
				});
				return this.hatadyEntityService.packBookmark(bm);
			} catch (e) {
				throw new ApiError(meta.errors.noSuchBookmark);
			}
		});
	}
}
