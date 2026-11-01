import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { DI } from '@/di-symbols.js';
import { MiHataskEvent } from '@/models/HataskEvent.js';
import type { HataskRsvpsRepository, UsersRepository } from '@/models/_.js';
import { HATASK_EVENT_AUDIENCE_ERROR, canViewHataskEvent, hataskEventAudienceProperties, validateHataskEventAudience } from './_visibility.js';
import {
	HATASK_EVENT_COLOR_PATTERN,
	HATASK_EVENT_DATE_PATTERN,
	HATASK_EVENT_INVALID_SCHEDULE_ERROR,
	HATASK_EVENT_OPTIONAL_DATE_PATTERN,
	HATASK_EVENT_TIME_PATTERN,
	hashHataskEvent,
	isValidHataskEventSchedule,
	packHataskEvent,
} from './_shared.js';
import type { DataSource } from 'typeorm';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: { duration: ms('1min'), max: 30 },
	res: { type: 'object' },
	errors: {
		invalidAudience: HATASK_EVENT_AUDIENCE_ERROR,
		noSuchEvent: {
			message: 'No such event.',
			code: 'NO_SUCH_EVENT',
			id: '66ae9573-03d3-4e38-ab1f-7d1381e8d516',
		},
		notOwner: {
			message: 'You are not the owner of this event.',
			code: 'NOT_OWNER',
			id: '428c5b74-5a29-46bf-b045-0f6497b52f52',
		},
		invalidSchedule: HATASK_EVENT_INVALID_SCHEDULE_ERROR,
		conflict: {
			message: 'The event changed on another client.',
			code: 'HATASK_EVENT_CONFLICT',
			id: 'a4d81c68-768c-445c-a758-ff00dc1d5198',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		...hataskEventAudienceProperties,
		eventId: { type: 'string', format: 'misskey:id' },
		expectedRevision: { type: 'string', minLength: 64, maxLength: 64 },
		title: { type: 'string', minLength: 1, maxLength: 256 },
		emoji: { type: 'string', maxLength: 32 },
		date: { type: 'string', pattern: HATASK_EVENT_DATE_PATTERN },
		dateEnd: { type: 'string', pattern: HATASK_EVENT_OPTIONAL_DATE_PATTERN },
		timeStart: { type: 'string', pattern: HATASK_EVENT_TIME_PATTERN },
		timeEnd: { type: 'string', pattern: HATASK_EVENT_TIME_PATTERN },
		allDay: { type: 'boolean' },
		color: { type: 'string', pattern: HATASK_EVENT_COLOR_PATTERN },
		rsvp: { type: 'boolean' },
	},
	required: ['eventId', 'expectedRevision'],
	minProperties: 3,
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.db) private db: DataSource,
		@Inject(DI.hataskRsvpsRepository) private hataskRsvpsRepository: HataskRsvpsRepository,
		@Inject(DI.usersRepository) private usersRepository: UsersRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const updatedEvent = await this.db.transaction(async manager => {
				const repository = manager.getRepository(MiHataskEvent);
				const event = await repository.findOne({ where: { id: ps.eventId }, lock: { mode: 'pessimistic_write' } });
				if (event == null || !canViewHataskEvent(event, me.id)) throw new ApiError(meta.errors.noSuchEvent);
				if (event.userId !== me.id) throw new ApiError(meta.errors.notOwner);
				if (hashHataskEvent(event) !== ps.expectedRevision) throw new ApiError(meta.errors.conflict);

				const updates: Partial<MiHataskEvent> = {};
				if (ps.title !== undefined) updates.title = ps.title;
				if (ps.emoji !== undefined) updates.emoji = ps.emoji;
				if (ps.date !== undefined) updates.date = ps.date;
				if (ps.dateEnd !== undefined) updates.dateEnd = ps.dateEnd;
				if (ps.timeStart !== undefined) updates.timeStart = ps.timeStart;
				if (ps.timeEnd !== undefined) updates.timeEnd = ps.timeEnd;
				if (ps.allDay !== undefined) updates.allDay = ps.allDay;
				if (ps.color !== undefined) updates.color = ps.color;
				if (ps.rsvp !== undefined) updates.rsvp = ps.rsvp;
				if (ps.visibility !== undefined) updates.visibility = ps.visibility;
				if (ps.visibleUserIds !== undefined) updates.visibleUserIds = ps.visibleUserIds;
				if (ps.visibility !== undefined || ps.visibleUserIds !== undefined) {
					updates.visibleUserIds = await validateHataskEventAudience({ ...event, ...updates }, this.usersRepository);
				}

				const next = { ...event, ...updates } as MiHataskEvent;
				if (!isValidHataskEventSchedule(next)) throw new ApiError(meta.errors.invalidSchedule);
				// RSVP responses live in hatask_rsvp and are deliberately not rewritten.
				await repository.update(event.id, updates);
				return next;
			});
			return await packHataskEvent(updatedEvent, me.id, this.hataskRsvpsRepository, this.usersRepository);
		});
	}
}
