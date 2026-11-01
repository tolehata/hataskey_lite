/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskPlannerEvent, HataskPlannerTodo, HataskRecurrence } from '@/utility/hatask-planner-storage.js';

export type HataskEventOccurrence = HataskPlannerEvent & {
	sourceEventId: string;
	occurrenceDate: string;
	isRecurrenceOccurrence: boolean;
};

function parseLocalDate(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	if (
		date.getFullYear() !== Number(match[1]) ||
		date.getMonth() !== Number(match[2]) - 1 ||
		date.getDate() !== Number(match[3])
	) return null;
	date.setHours(12, 0, 0, 0);
	return date;
}

export function toLocalDateKey(date = new Date()): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

function addMonthsClamped(date: Date, months: number): Date {
	const day = date.getDate();
	const next = new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
	const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0, 12).getDate();
	next.setDate(Math.min(day, lastDay));
	return next;
}

function addYearsClamped(date: Date, years: number): Date {
	const month = date.getMonth();
	const day = date.getDate();
	const next = new Date(date.getFullYear() + years, month, 1, 12);
	const lastDay = new Date(next.getFullYear(), month + 1, 0, 12).getDate();
	next.setDate(Math.min(day, lastDay));
	return next;
}

function weeklyWeekdays(base: Date, recurrence: HataskRecurrence): number[] {
	const weekdays = recurrence.weekdays?.length
		? [...new Set(recurrence.weekdays)].filter(day => day >= 0 && day <= 6).sort((a, b) => a - b)
		: [];
	return weekdays.length > 0 ? weekdays : [base.getDay()];
}

function weeklyDateAt(base: Date, recurrence: HataskRecurrence, index: number): Date {
	if (index <= 0) return new Date(base);
	const interval = Math.max(1, recurrence.interval || 1);
	const weekdays = weeklyWeekdays(base, recurrence);
	const laterInBaseWeek = weekdays.filter(day => day > base.getDay());
	const offset = index - 1;
	if (offset < laterInBaseWeek.length) return addDays(base, laterInBaseWeek[offset] - base.getDay());

	const activeOffset = offset - laterInBaseWeek.length;
	const activeWeek = Math.floor(activeOffset / weekdays.length) + 1;
	const weekday = weekdays[activeOffset % weekdays.length];
	const baseWeekStart = addDays(base, -base.getDay());
	return addDays(baseWeekStart, activeWeek * interval * 7 + weekday);
}

function recurrenceDateAt(base: Date, recurrence: HataskRecurrence, index: number): Date {
	const interval = Math.max(1, recurrence.interval || 1);
	if (index <= 0) return new Date(base);
	if (recurrence.frequency === 'daily') return addDays(base, interval * index);
	if (recurrence.frequency === 'weekly') return weeklyDateAt(base, recurrence, index);
	if (recurrence.frequency === 'monthly') return addMonthsClamped(base, interval * index);
	if (recurrence.frequency === 'yearly') return addYearsClamped(base, interval * index);
	return new Date(base);
}

function estimateOccurrenceIndex(base: Date, rangeStart: Date, recurrence: HataskRecurrence): number {
	if (rangeStart <= base) return 0;
	const interval = Math.max(1, recurrence.interval || 1);
	if (recurrence.frequency === 'daily') return Math.max(0, Math.floor((rangeStart.getTime() - base.getTime()) / 86400000 / interval) - 1);
	if (recurrence.frequency === 'weekly') {
		const weeks = Math.floor((rangeStart.getTime() - base.getTime()) / 86400000 / 7);
		const occurrencesPerActiveWeek = weeklyWeekdays(base, recurrence).length;
		return Math.max(0, Math.floor(weeks / interval) * occurrencesPerActiveWeek - occurrencesPerActiveWeek * 2);
	}
	if (recurrence.frequency === 'monthly') {
		const months = (rangeStart.getFullYear() - base.getFullYear()) * 12 + rangeStart.getMonth() - base.getMonth();
		return Math.max(0, Math.floor(months / interval) - 1);
	}
	if (recurrence.frequency === 'yearly') return Math.max(0, Math.floor((rangeStart.getFullYear() - base.getFullYear()) / interval) - 1);
	return 0;
}

function nextWeeklyDate(date: Date, recurrence: HataskRecurrence): Date {
	const interval = Math.max(1, recurrence.interval || 1);
	const weekdays = weeklyWeekdays(date, recurrence);

	for (let offset = 1; offset <= interval * 7; offset++) {
		const candidate = addDays(date, offset);
		if (!weekdays.includes(candidate.getDay())) continue;
		const crossedWeeks = Math.floor((date.getDay() + offset) / 7);
		if (crossedWeeks === 0 || crossedWeeks % interval === 0) return candidate;
	}
	return addDays(date, interval * 7);
}

export function nextRecurrenceDate(value: string, recurrence: HataskRecurrence): string | null {
	const date = parseLocalDate(value);
	if (date == null || recurrence.frequency === 'none') return null;
	const interval = Math.max(1, recurrence.interval || 1);
	let next: Date;
	if (recurrence.frequency === 'daily') next = addDays(date, interval);
	else if (recurrence.frequency === 'weekly') next = nextWeeklyDate(date, recurrence);
	else if (recurrence.frequency === 'monthly') next = addMonthsClamped(date, interval);
	else next = addYearsClamped(date, interval);
	const key = toLocalDateKey(next);
	const until = typeof recurrence.until === 'string' ? recurrence.until.slice(0, 10) : null;
	return until != null && key > until ? null : key;
}

function shiftDate(value: string | undefined, days: number): string | undefined {
	if (!value) return value;
	const parsed = parseLocalDate(value);
	return parsed == null ? value : toLocalDateKey(addDays(parsed, days));
}

export function expandHataskEventOccurrences(
	events: readonly HataskPlannerEvent[],
	rangeStart: string,
	rangeEnd: string,
	maxOccurrencesPerEvent = 500,
): HataskEventOccurrence[] {
	const output: HataskEventOccurrence[] = [];
	for (const event of events) {
		if (event.archivedAt != null) continue;
		const recurrence = event.recurrence;
		const base = parseLocalDate(event.date);
		const baseEnd = parseLocalDate(event.dateEnd ?? event.date);
		if (base == null) continue;
		const durationDays = baseEnd != null ? Math.max(0, Math.round((baseEnd.getTime() - base.getTime()) / 86400000)) : 0;
		const countLimit = recurrence.count ?? Number.POSITIVE_INFINITY;
		const parsedRangeStart = parseLocalDate(rangeStart) ?? base;
		let occurrenceIndex = estimateOccurrenceIndex(base, addDays(parsedRangeStart, -durationDays), recurrence);
		let occurrenceDate = toLocalDateKey(recurrenceDateAt(base, recurrence, occurrenceIndex));

		let emittedOrScanned = 0;
		while (occurrenceIndex < countLimit && emittedOrScanned < maxOccurrencesPerEvent) {
			const occurrenceEnd = shiftDate(occurrenceDate, durationDays) ?? occurrenceDate;
			if (occurrenceEnd >= rangeStart && occurrenceDate <= rangeEnd) {
				output.push({
					...event,
					id: occurrenceIndex === 0 ? event.id : `${event.id}::${occurrenceDate}`,
					date: occurrenceDate,
					dateEnd: occurrenceEnd,
					sourceEventId: event.id,
					occurrenceDate,
					isRecurrenceOccurrence: occurrenceIndex > 0,
				});
			}
			if (recurrence.frequency === 'none' || occurrenceDate > rangeEnd) break;
			occurrenceIndex++;
			emittedOrScanned++;
			const next = toLocalDateKey(recurrenceDateAt(base, recurrence, occurrenceIndex));
			const until = typeof recurrence.until === 'string' ? recurrence.until.slice(0, 10) : null;
			if (next <= occurrenceDate || (until != null && next > until)) break;
			occurrenceDate = next;
		}
	}
	return output.sort((a, b) => a.date.localeCompare(b.date) || (a.timeStart ?? '').localeCompare(b.timeStart ?? '') || a.id.localeCompare(b.id));
}

export function createNextRecurringTodo(
	todo: HataskPlannerTodo,
	id: string,
	completedAt: Date,
): HataskPlannerTodo | null {
	if (todo.recurrence.frequency === 'none') return null;
	const baseDue = todo.due && /^\d{4}-\d{2}-\d{2}$/.test(todo.due) ? todo.due : toLocalDateKey(completedAt);
	const anchorValue = typeof todo.recurrence.anchorDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todo.recurrence.anchorDate) ? todo.recurrence.anchorDate : baseDue;
	const anchor = parseLocalDate(anchorValue);
	const occurrenceIndex = typeof todo.recurrence.occurrenceIndex === 'number' && Number.isSafeInteger(todo.recurrence.occurrenceIndex) ? todo.recurrence.occurrenceIndex + 1 : 1;
	if (typeof todo.recurrence.count === 'number' && occurrenceIndex >= todo.recurrence.count) return null;
	const due = anchor == null ? nextRecurrenceDate(baseDue, todo.recurrence) : toLocalDateKey(recurrenceDateAt(anchor, todo.recurrence, occurrenceIndex));
	if (due == null) return null;
	const until = typeof todo.recurrence.until === 'string' ? todo.recurrence.until.slice(0, 10) : null;
	if (until != null && due > until) return null;
	return {
		...todo,
		id,
		done: false,
		due,
		doneAt: undefined,
		archivedAt: null,
		createdAt: completedAt.toISOString(),
		position: todo.position - 0.5,
		subtasks: todo.subtasks.map(subtask => ({ ...subtask, done: false })),
		recurrence: { ...todo.recurrence, anchorDate: anchorValue, occurrenceIndex },
		recurrenceParentId: todo.id,
	};
}
