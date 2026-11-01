/* SPDX-License-Identifier: AGPL-3.0-only */

export const RECORD_SCOPE = ['client', 'hatask'] as const;
export const FLOWER_ARCHIVE_KEY = 'flowerRecordImportsV1';
export const RECORD_MAX_BYTES = 8 * 1024 * 1024;
export type RecordKind = 'moods' | 'meals' | 'flowers';
type JournalBase = { id: string; date: string; time: string; note?: string; emoji?: string; reasons?: string[] };
export type MoodRecord = JournalBase & { level: number };
export type MealRecord = JournalBase & { level: string; slot: string };
export type FlowerRecord = { id: string; speciesId: string; season: string; emoji: string; name: string; hanakotoba: string; nickname: string; rare: boolean; harvestedAt: string; memory: string[] };
export type RecordData = { moods: MoodRecord[]; meals: MealRecord[]; flowers: FlowerRecord[] };

const baseJournalProperties = {
	id: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' },
	note: { type: 'string' }, emoji: { type: 'string' }, reasons: { type: 'array', items: { type: 'string' } },
} as const;
export const moodRecordSchema = { type: 'object', properties: { ...baseJournalProperties, level: { type: 'integer' } }, required: ['id', 'date', 'time', 'level'] } as const;
export const mealRecordSchema = { type: 'object', properties: { ...baseJournalProperties, level: { type: 'string' }, slot: { type: 'string' } }, required: ['id', 'date', 'time', 'level', 'slot'] } as const;
const optionalJournalResponseProperties = {
	note: { ...baseJournalProperties.note, optional: true },
	emoji: { ...baseJournalProperties.emoji, optional: true },
	reasons: { ...baseJournalProperties.reasons, optional: true },
} as const;
export const moodRecordResponseSchema = { ...moodRecordSchema, properties: { ...moodRecordSchema.properties, ...optionalJournalResponseProperties } } as const;
export const mealRecordResponseSchema = { ...mealRecordSchema, properties: { ...mealRecordSchema.properties, ...optionalJournalResponseProperties } } as const;
export const flowerRecordSchema = { type: 'object', properties: {
	id: { type: 'string' }, speciesId: { type: 'string' }, season: { type: 'string' }, emoji: { type: 'string' }, name: { type: 'string' },
	hanakotoba: { type: 'string' }, nickname: { type: 'string' }, rare: { type: 'boolean' }, harvestedAt: { type: 'string' }, memory: { type: 'array', items: { type: 'string' } },
}, required: ['id', 'speciesId', 'season', 'emoji', 'name', 'hanakotoba', 'nickname', 'rare', 'harvestedAt', 'memory'] } as const;

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown, max: number, allowEmpty = false): value is string => typeof value === 'string' && (allowEmpty || value.length > 0) && value.length <= max;
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const instant = (value: unknown): value is string => {
	if (typeof value !== 'string') return false;
	const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
	return parts != null && date(parts[1]) && Number(parts[2]) <= 23 && Number(parts[3]) <= 59 && Number(parts[4]) <= 59 &&
		(parts[6] == null || (Number(parts[6]) <= 23 && Number(parts[7]) <= 59)) && !Number.isNaN(Date.parse(value));
};
const id = (value: unknown): value is string => string(value, 128) && value.trim() === value;

export function cleanRecord(value: unknown, kind: 'moods'): MoodRecord;
export function cleanRecord(value: unknown, kind: 'meals'): MealRecord;
export function cleanRecord(value: unknown, kind: 'flowers'): FlowerRecord;
export function cleanRecord(value: unknown, kind: RecordKind): MoodRecord | MealRecord | FlowerRecord;
export function cleanRecord(value: unknown, kind: RecordKind): MoodRecord | MealRecord | FlowerRecord {
	if (!object(value) || !id(value.id)) throw new TypeError('Invalid record ID');
	if (kind === 'flowers') {
		if (!string(value.speciesId, 128) || !(typeof value.season === 'string' && ['spring', 'summer', 'autumn', 'winter'].includes(value.season)) ||
			!string(value.emoji, 32) || !string(value.name, 80) || !string(value.hanakotoba, 256, true) ||
			(value.nickname != null && !(typeof value.nickname === 'string' && [...value.nickname].length <= 80)) || typeof value.rare !== 'boolean' || !instant(value.harvestedAt) ||
			(value.memory != null && (!Array.isArray(value.memory) || value.memory.length > 6 || !value.memory.every(item => string(item, 512, true))))) {
			throw new TypeError('Invalid flower record');
		}
		return { id: value.id, speciesId: value.speciesId, season: value.season as string, emoji: value.emoji, name: value.name,
			hanakotoba: value.hanakotoba, nickname: (value.nickname ?? '') as string, rare: value.rare, harvestedAt: value.harvestedAt, memory: (value.memory ?? []) as string[] };
	}
	if (!date(value.date) || typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) ||
		(value.note != null && !string(value.note, RECORD_MAX_BYTES, true)) || (value.emoji != null && !string(value.emoji, RECORD_MAX_BYTES, true)) ||
		(value.reasons != null && (!Array.isArray(value.reasons) || value.reasons.length > 50000 || !value.reasons.every(reason => string(reason, RECORD_MAX_BYTES, true))))) {
		throw new TypeError('Invalid journal record');
	}
	if (kind === 'moods' ? !(Number.isInteger(value.level) && Number(value.level) >= 1 && Number(value.level) <= 5)
		: !(typeof value.slot === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(value.slot) && typeof value.level === 'string' && ['ate', 'little', 'none'].includes(value.level))) {
		throw new TypeError('Invalid journal kind');
	}
	return { id: value.id, date: value.date, time: value.time, level: value.level as number | string,
		...(kind === 'meals' ? { slot: value.slot } : {}),
		...(value.note != null ? { note: value.note } : {}),
		...(value.emoji != null ? { emoji: value.emoji } : {}),
		...(value.reasons != null ? { reasons: value.reasons } : {}) } as MoodRecord | MealRecord;
}

export function checkedRows(value: unknown, kind: 'moods'): MoodRecord[];
export function checkedRows(value: unknown, kind: 'meals'): MealRecord[];
export function checkedRows(value: unknown, kind: 'flowers'): FlowerRecord[];
export function checkedRows(value: unknown, kind: RecordKind): (MoodRecord | MealRecord | FlowerRecord)[];
export function checkedRows(value: unknown, kind: RecordKind): (MoodRecord | MealRecord | FlowerRecord)[] {
	if (!Array.isArray(value) || value.length > 50000) throw new TypeError('Invalid record collection');
	const seen = new Set<string>();
	return value.map(row => {
		const clean = cleanRecord(row, kind);
		if (seen.has(clean.id as string)) throw new TypeError('Duplicate record ID');
		seen.add(clean.id as string);
		return clean;
	});
}

export function parseImport(value: unknown): RecordData {
	if (!object(value) || value.format !== 'hatask-records-export' || value.version !== 1 || !instant(value.exportedAt) || !object(value.data)) throw new TypeError('Invalid record export');
	if (Object.keys(value).some(key => !['format', 'version', 'exportedAt', 'data'].includes(key)) || Object.keys(value.data).some(key => !['moods', 'meals', 'flowers'].includes(key))) throw new TypeError('Unknown export field');
	return { moods: checkedRows(value.data.moods, 'moods'), meals: checkedRows(value.data.meals, 'meals'), flowers: checkedRows(value.data.flowers, 'flowers') };
}

export function mergeRecords(existing: unknown, incoming: Record<string, unknown>[], kind: RecordKind): { value: Record<string, unknown>[]; added: number; duplicates: number; conflicts: number } {
	if (!Array.isArray(existing)) throw new TypeError('Invalid stored collection');
	const original = existing as Record<string, unknown>[];
	const byId = new Map<string, Record<string, unknown>>();
	for (const row of original) {
		if (!object(row) || !id(row.id) || byId.has(row.id)) throw new TypeError('Ambiguous stored record ID');
		byId.set(row.id, row);
	}
	const appended: Record<string, unknown>[] = [];
	let duplicates = 0, conflicts = 0;
	for (const row of incoming) {
		const old = byId.get(row.id as string);
		if (old == null) {
			appended.push(kind === 'flowers' ? row : { ...row, imported: true });
			byId.set(row.id as string, row);
		} else {
			let same = false;
			try { same = JSON.stringify(cleanRecord(old, kind)) === JSON.stringify(row); } catch { /* Preserve incompatible legacy rows as conflicts. */ }
			if (same) duplicates++; else conflicts++;
		}
	}
	return { value: [...original, ...appended], added: appended.length, duplicates, conflicts };
}
