import { createHash } from 'node:crypto';
import type { MiHataskEvent } from '@/models/HataskEvent.js';
import type { HataskRsvpsRepository, UsersRepository } from '@/models/_.js';
import { canViewHataskEvent } from './_visibility.js';

export const HATASK_EVENT_DATE_PATTERN = '^(?:[0-9]{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$';
export const HATASK_EVENT_OPTIONAL_DATE_PATTERN = '^(?:|(?:[0-9]{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01]))$';
export const HATASK_EVENT_TIME_PATTERN = '^(?:|(?:[01][0-9]|2[0-3]):[0-5][0-9])$';
export const HATASK_EVENT_COLOR_PATTERN = '^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$';

export const HATASK_EVENT_INVALID_SCHEDULE_ERROR = {
	message: 'The event date, time, or color is invalid.',
	code: 'INVALID_HATASK_EVENT_SCHEDULE',
	id: '4f4daa0c-7ca5-4e91-b210-c709206fec0b',
} as const;

type HataskEventSchedule = Pick<MiHataskEvent, 'date' | 'dateEnd' | 'timeStart' | 'timeEnd' | 'allDay' | 'color'>;

function isValidDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
	if (match == null) return false;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (year < 1 || month < 1 || month > 12 || day < 1) return false;

	return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidTime(value: string): boolean {
	return value === '' || /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value);
}

/**
 * JSON Schema rejects malformed input; this also rejects impossible dates and
 * inconsistent ranges before PostgreSQL receives them.
 */
export function isValidHataskEventSchedule(schedule: HataskEventSchedule): boolean {
	if (!isValidDate(schedule.date)) return false;
	if (schedule.dateEnd !== '' && (!isValidDate(schedule.dateEnd) || schedule.dateEnd < schedule.date)) return false;
	if (!isValidTime(schedule.timeStart) || !isValidTime(schedule.timeEnd)) return false;
	if (!schedule.allDay) {
		if (schedule.timeStart === '' || schedule.timeEnd === '') return false;
		const effectiveEndDate = schedule.dateEnd || schedule.date;
		if (effectiveEndDate === schedule.date && schedule.timeEnd < schedule.timeStart) return false;
	}
	if (!/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/u.test(schedule.color)) return false;
	return true;
}

type HataskEventRevisionSource = Pick<MiHataskEvent,
	'id' | 'userId' | 'title' | 'emoji' | 'date' | 'dateEnd' | 'timeStart' | 'timeEnd' |
	'allDay' | 'color' | 'rsvp' | 'rsvpClosed' | 'createdAt'
> & Partial<Pick<MiHataskEvent, 'visibility' | 'visibleUserIds'>>;

export function hashHataskEvent(event: HataskEventRevisionSource): string {
	return createHash('sha256').update(JSON.stringify([
		event.id, event.userId, event.title, event.emoji, event.date, event.dateEnd, event.timeStart, event.timeEnd,
		event.allDay, event.color, event.rsvp, event.rsvpClosed, event.createdAt.toISOString(),
		event.visibility ?? 'public', [...(event.visibleUserIds ?? [])].sort(),
	])).digest('hex');
}

export async function packHataskEvent(
	event: MiHataskEvent,
	viewerId: string,
	hataskRsvpsRepository: HataskRsvpsRepository,
	usersRepository: UsersRepository,
) {
	if (!canViewHataskEvent(event, viewerId)) throw new Error('Hatask event is not visible to this viewer.');
	const rsvpResponses = [];
	if (event.rsvp) {
		const rsvps = await hataskRsvpsRepository.find({ where: { eventId: event.id } });
		for (const rsvp of rsvps) {
			if (!canViewHataskEvent(event, rsvp.userId)) continue;
			const user = await usersRepository.findOneBy({ id: rsvp.userId });
			rsvpResponses.push({
				userId: rsvp.userId,
				username: user?.username ?? 'unknown',
				avatarUrl: user?.avatarUrl ?? null,
				status: rsvp.status,
				respondedAt: rsvp.respondedAt.toISOString(),
			});
		}
	}

	const creator = await usersRepository.findOneBy({ id: event.userId });
	return {
		id: event.id,
		userId: event.userId,
		username: creator?.username ?? 'unknown',
		avatarUrl: creator?.avatarUrl ?? null,
		title: event.title,
		emoji: event.emoji,
		date: event.date,
		dateEnd: event.dateEnd,
		timeStart: event.timeStart,
		timeEnd: event.timeEnd,
		allDay: event.allDay,
		color: event.color,
		rsvp: event.rsvp,
		visibility: event.visibility,
		visibleUserIds: event.userId === viewerId ? [...event.visibleUserIds] : event.visibility === 'specified' ? [viewerId] : [],
		rsvpClosed: event.rsvpClosed,
		createdAt: event.createdAt.toISOString(),
		revision: hashHataskEvent(event),
		rsvpResponses,
		isOwner: event.userId === viewerId,
	};
}
