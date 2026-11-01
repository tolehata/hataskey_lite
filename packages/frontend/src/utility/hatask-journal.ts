/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataskJournalKind = 'mood' | 'meal';
export type HataskJournalEntry = {
	id: string;
	date: string;
	time: string;
	note?: string;
	level: number | string;
	emoji?: string;
	slot?: string;
	reasons?: string[];
	[key: string]: unknown;
};

export type HataskMealTemplate = {
	id: string;
	name: string;
	slot: string;
	level: string;
	note: string;
	reasons: string[];
	[key: string]: unknown;
};

export const HATASK_MEAL_TEMPLATE_KEY = 'mealTemplatesV1';

export function journalLocalDateTime(now = new Date()): { date: string; time: string } {
	return {
		date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
		time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
	};
}

export function isJournalDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
	const date = new Date(`${value}T12:00:00`);
	return Number.isFinite(date.getTime()) && journalLocalDateTime(date).date === value;
}

export function isJournalTime(value: string): boolean {
	return /^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function isJournalEntry(value: unknown, kind: HataskJournalKind): value is HataskJournalEntry {
	if (!isObject(value) || typeof value.id !== 'string' || typeof value.date !== 'string' || !isJournalDate(value.date) || typeof value.time !== 'string') return false;
	if (value.note != null && typeof value.note !== 'string') return false;
	if (value.emoji != null && typeof value.emoji !== 'string') return false;
	if (value.reasons != null && (!Array.isArray(value.reasons) || !value.reasons.every(reason => typeof reason === 'string'))) return false;
	return kind === 'mood' ? typeof value.level === 'number' && Number.isInteger(value.level) && value.level >= 1 && value.level <= 5
		: typeof value.slot === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(value.slot) && ['ate', 'little', 'none'].includes(String(value.level));
}

export function isMealTemplate(value: unknown): value is HataskMealTemplate {
	return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string'
		&& typeof value.slot === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(value.slot)
		&& typeof value.level === 'string' && ['ate', 'little', 'none'].includes(value.level)
		&& typeof value.note === 'string' && Array.isArray(value.reasons) && value.reasons.every(reason => typeof reason === 'string');
}

/** Display filtering must never become a migration or a replacement for the raw rows. */
export function selectJournalEntries(rows: readonly unknown[], kind: HataskJournalKind, options: {
	query?: string;
	date?: string;
	oldestFirst?: boolean;
	text?: (entry: HataskJournalEntry) => string;
} = {}): HataskJournalEntry[] {
	const query = (options.query ?? '').normalize('NFKC').toLocaleLowerCase().trim();
	return rows.filter((entry): entry is HataskJournalEntry => isJournalEntry(entry, kind))
		.filter(entry => (!options.date || entry.date === options.date)
			&& (!query || [entry.note, entry.date, entry.time, entry.emoji, ...(entry.reasons ?? []), options.text?.(entry)].join(' ').normalize('NFKC').toLocaleLowerCase().includes(query)))
		.sort((a, b) => (a.date.localeCompare(b.date) || a.time.localeCompare(b.time)) * (options.oldestFirst ? 1 : -1));
}

export type HataskJournalChange = { type: 'save'; value: { id: string; [key: string]: unknown }; existingId?: string } | { type: 'delete'; id: string };

/** Copy only the explicitly selected row, retaining order, unknown fields and legacy rows. */
export function changeJournalRows(rows: readonly unknown[], change: HataskJournalChange): unknown[] {
	const id = change.type === 'delete' ? change.id : change.existingId ?? change.value.id;
	const matches = rows.flatMap((row, index) => isObject(row) && row.id === id ? [index] : []);
	if (change.type === 'save' && change.existingId == null) {
		if (matches.length) throw new Error('Hatask journal record already exists');
		return [{ ...change.value }, ...rows];
	}
	if (matches.length !== 1) throw new Error('Hatask journal record is missing or ambiguous');
	if (change.type === 'save' && change.value.id !== change.existingId) throw new Error('Hatask journal record ID cannot change');
	return rows.flatMap((row, index) => index !== matches[0] ? [row]
		: change.type === 'delete' ? [] : [{ ...(row as Record<string, unknown>), ...change.value }]);
}

export async function persistJournalChange(rows: readonly unknown[], change: HataskJournalChange, write: (next: unknown[]) => Promise<void>): Promise<unknown[]> {
	const next = changeJournalRows(rows, change);
	await write(next);
	return next;
}

export function mealTemplateFromEntry(entry: HataskJournalEntry, id: string, name: string): HataskMealTemplate {
	return { id, name: name.trim(), slot: entry.slot ?? 'breakfast', level: String(entry.level), note: entry.note ?? '', reasons: [...(entry.reasons ?? [])] };
}
