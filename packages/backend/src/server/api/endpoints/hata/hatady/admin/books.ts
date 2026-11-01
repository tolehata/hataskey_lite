/*
 * 旗鯖fork(Hatady): 全ユーザーの本を確認する(モデレーター/管理者のみ)。本棚の「すべての本」タブ用。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import type { HatadyBooksRepository } from '@/models/_.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.heavyRead,
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false } },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.hatadyBooksRepository)
		private hatadyBooksRepository: HatadyBooksRepository,

		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q = this.hatadyBooksRepository.createQueryBuilder('b');
			if (ps.untilId != null) q.where('b.id < :untilId', { untilId: ps.untilId });
			const books = await q.orderBy('b.id', 'DESC').limit(ps.limit).getMany();
			if (books.length === 0) return [];

			// requireModerator のスタッフ専用画面。しおり演出のため絞り込まない(従来どおり)。
			return await this.hatadyEntityService.packBooks(books, null);
		});
	}
}
