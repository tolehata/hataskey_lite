import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { ArrayContains, MoreThanOrEqual } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { HataskEventsRepository, HataskRsvpsRepository, UsersRepository } from '@/models/_.js';
import { packHataskEvent } from './_shared.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'read:account',
	limit: { duration: ms('1min'), max: 60 },
	res: { type: 'array', items: { type: 'object' } },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 30 },
		includeExpired: { type: 'boolean', default: false },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.hataskEventsRepository) private hataskEventsRepository: HataskEventsRepository,
		@Inject(DI.hataskRsvpsRepository) private hataskRsvpsRepository: HataskRsvpsRepository,
		@Inject(DI.usersRepository) private usersRepository: UsersRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const today = new Date().toISOString().slice(0, 10);
			// 開始日が過去でも、終了日が今日以降なら開催中として残す。
			const dates = ps.includeExpired ? [{}] : [
				{ date: MoreThanOrEqual(today) },
				{ dateEnd: MoreThanOrEqual(today) },
			];
			const audiences = [{ visibility: 'public' as const }, { userId: me.id }, { visibility: 'specified' as const, visibleUserIds: ArrayContains([me.id]) }];
			const where = audiences.flatMap(audience => dates.map(date => ({ ...audience, ...date })));

			const events = await this.hataskEventsRepository.find({
				where,
				order: { date: 'ASC', createdAt: 'DESC' },
				take: ps.limit ?? 30,
			});

			return await Promise.all(events.map(event => packHataskEvent(
				event,
				me.id,
				this.hataskRsvpsRepository,
				this.usersRepository,
			)));
		});
	}
}
