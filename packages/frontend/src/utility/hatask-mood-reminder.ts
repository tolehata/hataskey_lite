/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Saved slot labels, in display order. The backend accepts exactly these values. */
export const HATASK_MOOD_REMINDER_TIMES = ['朝 8:00', '昼 12:00', '夜 20:00', '寝る前 23:00'] as const;
const DEFAULT_MOOD_REMINDER_TIMES = ['昼 12:00', '寝る前 23:00'];
/** The server's zone for settings saved before the zone was recorded. */
export const HATASK_MOOD_REMINDER_DEFAULT_TIME_ZONE = 'Asia/Tokyo';

export function isHataskMoodReminderTimeZone(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > 100 || /^[+-]/u.test(value)) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

export function getHataskDeviceTimeZone(): string {
	try {
		const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (isHataskMoodReminderTimeZone(value)) return value;
	} catch {
		// Keep the server's legacy fallback when the device cannot identify its zone.
	}
	return HATASK_MOOD_REMINDER_DEFAULT_TIME_ZONE;
}

/** The zone the server currently uses for these settings. */
export function getHataskMoodReminderTimeZone(settings: Record<string, unknown>): string {
	return isHataskMoodReminderTimeZone(settings.moodRemindTimeZone) ? settings.moodRemindTimeZone : HATASK_MOOD_REMINDER_DEFAULT_TIME_ZONE;
}

/** e.g. "Asia/Tokyo (GMT+9)" */
export function formatHataskTimeZone(timeZone: string, lang?: string): string {
	try {
		const offset = new Intl.DateTimeFormat(lang, { timeZone, timeZoneName: 'shortOffset' })
			.formatToParts(Date.now()).find(part => part.type === 'timeZoneName')?.value;
		return offset ? `${timeZone} (${offset})` : timeZone;
	} catch {
		return timeZone;
	}
}

/**
 * Record the device's zone the first time reminders are edited. A zone that is
 * already saved only changes when the patch sets it explicitly: browsers that hide
 * the real zone (for example privacy modes reporting UTC) must not silently move
 * every reminder by hours just because a time was toggled there.
 */
export function createHataskMoodReminderPatch(settings: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
	const next = { ...patch };
	if (!Object.hasOwn(patch, 'moodRemind') && !Object.hasOwn(patch, 'moodRemindTimes') && !Object.hasOwn(patch, 'moodRemindTimeZone')) return next;
	if (Array.isArray(patch.moodRemindTimes)) {
		next.moodRemindTimes = [...patch.moodRemindTimes];
	} else if (!Object.hasOwn(patch, 'moodRemindTimes') && settings.moodRemindTimes === undefined) {
		// Settings can enable reminders before the journal page has ever been opened.
		// An explicitly empty selection stays empty.
		next.moodRemindTimes = [...DEFAULT_MOOD_REMINDER_TIMES];
	}
	if (Object.hasOwn(patch, 'moodRemindTimeZone')) {
		if (!isHataskMoodReminderTimeZone(patch.moodRemindTimeZone)) delete next.moodRemindTimeZone;
	} else if (!isHataskMoodReminderTimeZone(settings.moodRemindTimeZone)) {
		next.moodRemindTimeZone = getHataskDeviceTimeZone();
	}
	return next;
}
