import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { MiHataskEvent } from '@/models/HataskEvent.js';
import { ApiError } from '../../../error.js';
import { canViewHataskEvent } from './_visibility.js';
import { hashHataskEvent } from './_shared.js';
import type { DataSource } from 'typeorm';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	errors: {
		noSuchEvent: {
			message: 'No such event.',
			code: 'NO_SUCH_EVENT',
			id: 'hb5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
		},
		notOwner: {
			message: 'You are not the owner of this event.',
			code: 'NOT_OWNER',
			id: 'hc6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
		},
		conflict: {
			message: 'The event changed on another client.',
			code: 'HATASK_EVENT_CONFLICT',
			id: '82a7da06-c4c4-48d8-b7eb-a6d1a16d5400',
		},
	},
	// 旗鯖fork(セキュリティ): RSVP 締切のトグル書込。1分30回でスパムを抑止。
	limit: { duration: ms('1min'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		eventId: { type: 'string', minLength: 1 },
		expectedRevision: { type: 'string', minLength: 64, maxLength: 64 },
		closed: { type: 'boolean' },
	},
	required: ['eventId', 'expectedRevision', 'closed'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.db) private db: DataSource,
	) {
		super(meta, paramDef, async (ps, me) => {
			return await this.db.transaction(async manager => {
				const repository = manager.getRepository(MiHataskEvent);
				const event = await repository.findOne({ where: { id: ps.eventId }, lock: { mode: 'pessimistic_write' } });
				if (!event || !canViewHataskEvent(event, me.id)) throw new ApiError(meta.errors.noSuchEvent);
				if (event.userId !== me.id) throw new ApiError(meta.errors.notOwner);
				if (hashHataskEvent(event) !== ps.expectedRevision) throw new ApiError(meta.errors.conflict);
				const updated = { ...event, rsvpClosed: ps.closed };
				await repository.update(event.id, { rsvpClosed: ps.closed });
				return { id: event.id, rsvpClosed: ps.closed, revision: hashHataskEvent(updated) };
			});
		});
	}
}
