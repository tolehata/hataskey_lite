import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { LessThan } from 'typeorm';
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
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.hataskEventsRepository) private hataskEventsRepository: HataskEventsRepository,
		@Inject(DI.hataskRsvpsRepository) private hataskRsvpsRepository: HataskRsvpsRepository,
		@Inject(DI.usersRepository) private usersRepository: UsersRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const events = await this.hataskEventsRepository.find({
				where: {
					userId: me.id,
					...(ps.untilId == null ? {} : { id: LessThan(ps.untilId) }),
				},
				order: { id: 'DESC' },
				take: ps.limit,
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
