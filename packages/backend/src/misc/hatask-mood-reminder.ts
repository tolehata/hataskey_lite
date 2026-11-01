/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const reminderTimes = new Map([
	['朝 8:00', '08:00'],
	['昼 12:00', '12:00'],
	['夜 20:00', '20:00'],
	['寝る前 23:00', '23:00'],
]);
const defaultReminderTimes = ['昼 12:00', '寝る前 23:00'];
// The system queue runs one job at a time, so daily maintenance jobs or a paused
// host can delay this per-minute check by tens of minutes. Reminder slots are at
// least three hours apart, so this window cannot merge two slots.
const catchUpMinutes = 120;

function isObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Match the frontend's isJournalEntry(value, 'mood'), including legacy time strings. */
function isMoodEntry(value: unknown): value is Record<string, unknown> & { date: string } {
	if (!isObject(value) || typeof value.id !== 'string' || typeof value.date !== 'string' || typeof value.time !== 'string') return false;
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(value.date)) return false;
	const date = new Date(`${value.date}T12:00:00Z`);
	if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.date) return false;
	if (value.note != null && typeof value.note !== 'string') return false;
	if (value.emoji != null && typeof value.emoji !== 'string') return false;
	if (value.reasons != null && (!Array.isArray(value.reasons) || !value.reasons.every(reason => typeof reason === 'string'))) return false;
	return typeof value.level === 'number' && Number.isInteger(value.level) && value.level >= 1 && value.level <= 5;
}

/**
 * @param notBefore When the settings were last saved. Slots that had already passed
 * then are not caught up, so enabling reminders or adding a time does not notify at once.
 */
export function getDueHataskMoodReminder(settings: unknown, moods: unknown, handledSlots: readonly string[], now: number, notBefore?: number): {
	date: string;
	time: string;
	key: string;
	timeZone: string;
} | null {
	if (!isObject(settings) || settings.moodRemind !== true || !Array.isArray(moods) || !Number.isFinite(now)) return null;
	if (!Array.isArray(handledSlots) || !handledSlots.every(slot => typeof slot === 'string')) return null;
	const times = settings.moodRemindTimes === undefined ? defaultReminderTimes : settings.moodRemindTimes;
	if (!Array.isArray(times) || times.length === 0 || !times.every(time => typeof time === 'string' && reminderTimes.has(time))) return null;
	const timeZone = settings.moodRemindTimeZone === undefined ? 'Asia/Tokyo' : settings.moodRemindTimeZone;
	// Intl also accepts fixed-offset strings on recent Node versions. Persisted zones must be named zones.
	if (typeof timeZone !== 'string' || !timeZone || /^[+-]/u.test(timeZone)) return null;
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat('en-CA', {
			timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
		}).formatToParts(now);
	} catch {
		return null;
	}
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
	const date = `${part('year')}-${part('month')}-${part('day')}`;
	if (moods.some(mood => isMoodEntry(mood) && mood.date === date)) return null;
	const localMinutes = Number(part('hour')) * 60 + Number(part('minute'));
	let due: { date: string; time: string; key: string; timeZone: string } | null = null;
	let dueElapsed = Infinity;
	for (const label of times) {
		const time = reminderTimes.get(label)!;
		const [hour, minute] = time.split(':').map(Number);
		const elapsedMinutes = localMinutes - (hour * 60 + minute);
		// Bounded catch-up for delayed workers, without delivering stale reminders after an outage.
		if (elapsedMinutes < 0 || elapsedMinutes >= catchUpMinutes || elapsedMinutes >= dueElapsed) continue;
		// Wall-clock start of the slot, rounded down to the checked minute.
		const slotStart = Math.floor(now / 60_000) * 60_000 - elapsedMinutes * 60_000;
		if (notBefore != null && Number.isFinite(notBefore) && slotStart < Math.floor(notBefore / 60_000) * 60_000) continue;
		const key = `${date}T${time}`;
		// Exclude the timezone so travel and repeated DST hours cannot repeat the same local slot.
		if (handledSlots.includes(key)) continue;
		due = { date, time, key, timeZone };
		dueElapsed = elapsedMinutes;
	}
	return due;
}
