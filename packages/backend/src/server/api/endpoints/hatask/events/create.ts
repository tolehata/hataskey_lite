import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { HataskEventsRepository, UsersRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '@/server/api/error.js';
import { HATASK_EVENT_AUDIENCE_ERROR, hataskEventAudienceProperties, validateHataskEventAudience } from './_visibility.js';
import {
	HATASK_EVENT_COLOR_PATTERN,
	HATASK_EVENT_DATE_PATTERN,
	HATASK_EVENT_INVALID_SCHEDULE_ERROR,
	HATASK_EVENT_OPTIONAL_DATE_PATTERN,
	HATASK_EVENT_TIME_PATTERN,
	hashHataskEvent,
	isValidHataskEventSchedule,
} from './_shared.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: { duration: 1000 * 60, max: 20 },
	res: { type: 'object' },
	errors: {
		invalidAudience: HATASK_EVENT_AUDIENCE_ERROR,
		invalidSchedule: HATASK_EVENT_INVALID_SCHEDULE_ERROR,
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		...hataskEventAudienceProperties,
		title: { type: 'string', minLength: 1, maxLength: 256 },
		emoji: { type: 'string', maxLength: 32, default: '📅' },
		date: { type: 'string', pattern: HATASK_EVENT_DATE_PATTERN },
		dateEnd: { type: 'string', pattern: HATASK_EVENT_OPTIONAL_DATE_PATTERN, default: '' },
		timeStart: { type: 'string', pattern: HATASK_EVENT_TIME_PATTERN, default: '' },
		timeEnd: { type: 'string', pattern: HATASK_EVENT_TIME_PATTERN, default: '' },
		allDay: { type: 'boolean', default: false },
		color: { type: 'string', pattern: HATASK_EVENT_COLOR_PATTERN, default: '#e27d60' },
		rsvp: { type: 'boolean', default: false },
	},
	required: ['title', 'date'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.hataskEventsRepository) private hataskEventsRepository: HataskEventsRepository,
		private idService: IdService,
		@Inject(DI.usersRepository) private usersRepository: UsersRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			const schedule = {
				date: ps.date,
				dateEnd: ps.dateEnd,
				timeStart: ps.timeStart,
				timeEnd: ps.timeEnd,
				allDay: ps.allDay,
				color: ps.color,
			};
			if (!isValidHataskEventSchedule(schedule)) {
				throw new ApiError(meta.errors.invalidSchedule);
			}

			const visibility = ps.visibility ?? 'public';
			const visibleUserIds = await validateHataskEventAudience({ userId: me.id, visibility, visibleUserIds: ps.visibleUserIds }, this.usersRepository);
			const ev = {
				id: this.idService.gen(),
				userId: me.id,
				title: ps.title,
				emoji: ps.emoji,
				...schedule,
				rsvp: ps.rsvp,
				visibility,
				visibleUserIds,
				rsvpClosed: false,
				createdAt: new Date(),
			};

			await this.hataskEventsRepository.insert(ev);

			return {
				id: ev.id,
				userId: ev.userId,
				title: ev.title,
				emoji: ev.emoji,
				date: ev.date,
				dateEnd: ev.dateEnd,
				timeStart: ev.timeStart,
				timeEnd: ev.timeEnd,
				allDay: ev.allDay,
				color: ev.color,
				rsvp: ev.rsvp,
				visibility: ev.visibility,
				visibleUserIds: ev.visibleUserIds,
				rsvpClosed: false,
				createdAt: ev.createdAt.toISOString(),
				revision: hashHataskEvent(ev),
				rsvpResponses: [],
			};
		});
	}
}
