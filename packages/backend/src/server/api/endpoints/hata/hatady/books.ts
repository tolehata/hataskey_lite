/*
 * 旗鯖fork: Hatady の自分の本棚(本一覧)を取得する。更新の新しい順。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import type { HatadyBooksRepository } from '@/models/_.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import { DI } from '@/di-symbols.js';
import { HatadyService } from '@/core/HatadyService.js';

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
		scope: { type: 'string', enum: ['mine', 'recent', 'public', 'following', 'all'], default: 'mine' },
		status: { type: 'string', enum: ['reading', 'finished', 'want', 'tsundoku', null], nullable: true },
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
		private service: HatadyService,
	) {
		super(meta, paramDef, async (ps, me, token) => {
			const query = this.hatadyBooksRepository.createQueryBuilder('book');
			const staffAccess = token == null && ps.scope === 'all' && await this.service.canModerate(me.id);
			if (ps.scope === 'all' && !staffAccess) throw new Error('access denied');
			if (staffAccess) query.where('1 = 1');
			else if (ps.scope === 'mine') query.where('book.userId = :meId', { meId: me.id });
			else if (ps.scope === 'following') query.where('book.visibility IN (\'public\', \'followers\') AND EXISTS (SELECT 1 FROM "hatady_following" f WHERE f."followerId" = :meId AND f."followeeId" = book."userId")', { meId: me.id });
			else query.where('book.visibility = \'public\'');
			if (ps.scope !== 'mine' && !staffAccess) {
				const excluded = [...await this.service.getTimelineExcludedUserIds(me.id)];
				if (excluded.length) query.andWhere('book.userId NOT IN (:...excluded)', { excluded });
			}

			if (ps.status != null) query.andWhere('book.status = :status', { status: ps.status });
			if (ps.untilId != null) query.andWhere('book.id < :untilId', { untilId: ps.untilId });
			query.orderBy('book.id', 'DESC');
			const books = await query.limit(ps.limit).getMany();
			// 自分の本棚なので全冊にしおりが付く(挙動は従来どおり)。
			return await this.hatadyEntityService.packBooks(books, staffAccess ? null : me.id);
		});
	}
}
