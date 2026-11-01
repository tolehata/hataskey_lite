import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { MiHataskEvent } from '@/models/HataskEvent.js';
import { MiHataskRsvp } from '@/models/HataskRsvp.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '../../../error.js';
import { canViewHataskEvent } from './_visibility.js';
import type { DataSource } from 'typeorm';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: { duration: 1000 * 60, max: 30 },
	errors: {
		noSuchEvent: {
			message: 'No such event.',
			code: 'NO_SUCH_EVENT',
			id: 'h7a1b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5',
		},
		eventClosed: {
			message: 'RSVP is closed for this event.',
			code: 'EVENT_CLOSED',
			id: 'h8b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6',
		},
		rsvpDisabled: {
			message: 'RSVP is not enabled for this event.',
			code: 'RSVP_DISABLED',
			id: '535d8d8b-70f4-40dd-9f8e-1231ac9b06ca',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		eventId: { type: 'string', minLength: 1 },
		status: { type: 'string', enum: ['going', 'maybe', 'declined'] },
	},
	required: ['eventId', 'status'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.db) private db: DataSource,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			return await this.db.transaction(async manager => {
				const eventRepository = manager.getRepository(MiHataskEvent);
				const rsvpRepository = manager.getRepository(MiHataskRsvp);
				const event = await eventRepository.findOne({ where: { id: ps.eventId }, lock: { mode: 'pessimistic_write' } });
				if (!event || !canViewHataskEvent(event, me.id)) throw new ApiError(meta.errors.noSuchEvent);
				if (!event.rsvp) throw new ApiError(meta.errors.rsvpDisabled);
				if (event.rsvpClosed) throw new ApiError(meta.errors.eventClosed);

				const existing = await rsvpRepository.findOneBy({ eventId: ps.eventId, userId: me.id });
				if (existing) {
					await rsvpRepository.update(existing.id, { status: ps.status, respondedAt: new Date() });
					return { id: existing.id, status: ps.status };
				}
				const rsvp = { id: this.idService.gen(), eventId: ps.eventId, userId: me.id, status: ps.status, respondedAt: new Date() };
				await rsvpRepository.insert(rsvp);
				return { id: rsvp.id, status: ps.status };
			});
		});
	}
}
