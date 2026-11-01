/* SPDX-License-Identifier: AGPL-3.0-only */

export const HATADY_MAX_DURATION_SECONDS = 2_147_483_647 * 60;
export const HATADY_STARTED_AT_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\\.[0-9]{1,3})?)?$';
export const HATADY_TAGS = ['strength', 'weak', 'interest', 'effort', 'recommend', 'progress', 'doneDay', 'doneAll', 'blocked', 'smooth', 'review', 'movie', 'game'] as const;
export const HATADY_VISIBILITIES = ['public', 'followers', 'private'] as const;

export function normalizeHatadyStartedAt(value: unknown): string | null {
	if (value == null || value === '') return null;
	if (typeof value !== 'string' || !new RegExp(HATADY_STARTED_AT_PATTERN).test(value)) throw new Error('invalid startedAt');
	return value;
}

export function normalizeHatadyDuration(input: { durationSeconds?: number | null; durationMinutes?: number | null }, previous?: { durationSeconds?: number | null; durationMinutes?: number | null }): number | null {
	if (input.durationSeconds === undefined && input.durationMinutes === undefined) {
		return previous?.durationSeconds === undefined ? (previous?.durationMinutes == null ? null : previous.durationMinutes * 60) : previous.durationSeconds;
	}
	const value = input.durationSeconds === undefined ? (input.durationMinutes == null ? null : input.durationMinutes * 60) : input.durationSeconds;
	if (value != null && (!Number.isSafeInteger(value) || value < 0 || value > HATADY_MAX_DURATION_SECONDS)) throw new Error('invalid durationSeconds');
	return value;
}

export function normalizeHatadyTags(value: unknown, previous: string[] = []): string[] {
	if (value === undefined) return [...previous];
	if (!Array.isArray(value) || value.length > 32 || value.some(tag => typeof tag !== 'string' || (!HATADY_TAGS.includes(tag as typeof HATADY_TAGS[number]) && !previous.includes(tag)))) throw new Error('invalid tags');
	// 新クライアントが知らない保存済みタグは編集で消さない。
	return [...new Set([...value, ...previous.filter(tag => !HATADY_TAGS.includes(tag as typeof HATADY_TAGS[number]))])];
}

const WORK_DETAIL_LIMITS = { genre: 128, description: 8192, memo: 8192, nextStep: 240 };
const LOG_DETAIL_LIMITS = { pages: 60, place: 120, note: 8192, nextStep: 240 };

export function mergeHatadyDetails(previous: Record<string, unknown> | undefined, input: unknown, kind: 'work' | 'log' | 'profile'): Record<string, unknown> {
	const stored = previous ?? {};
	if (input === undefined) return { ...stored };
	if (input == null || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid details');
	const patch = input as Record<string, unknown>;
	const limits: Record<string, number> = kind === 'work' ? WORK_DETAIL_LIMITS : LOG_DETAIL_LIMITS;
	const choices: Record<string, string[]> = {
		layout: ['bento', 'journal', 'gallery'], palette: ['theme', 'leaf', 'violet', 'clay'], corners: ['soft', 'neat'], spacing: ['relaxed', 'compact'], cover: ['color'],
	};
	for (const [key, value] of Object.entries(patch)) {
		if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('invalid details key');
		if (kind === 'profile') {
			if (key === 'order' || key === 'hidden') {
				if (!Array.isArray(value) || value.length > 5 || value.some(item => !['stats', 'traits', 'shelf', 'recent', 'work'].includes(item))) throw new Error(`invalid ${key}`);
			} else if (!(key in choices) || !choices[key].includes(value as string)) {
				// 旧写真などの未知項目は同一値の往復のみ許し、省略時にも残す。
				if (!Object.hasOwn(stored, key) || JSON.stringify(stored[key]) !== JSON.stringify(value)) throw new Error(`invalid ${key}`);
			}
		} else if (kind === 'log' && key === 'spoiler') {
			if (typeof value !== 'boolean') throw new Error('invalid spoiler');
		} else if (kind === 'log' && key === 'calories') {
			if (value != null && (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1_000_000)) throw new Error('invalid calories');
		} else if (Object.hasOwn(limits, key)) {
			if (value != null && (typeof value !== 'string' || value.length > limits[key])) throw new Error(`invalid ${key}`);
		} else if (!Object.hasOwn(stored, key) || JSON.stringify(stored[key]) !== JSON.stringify(value)) {
			throw new Error(`invalid ${key}`);
		}
	}
	const result = { ...stored, ...patch };
	if (JSON.stringify(patch).length > (kind === 'profile' ? 3_000_000 : 32_768)) throw new Error('details are too large');
	return result;
}

export function packHatadyDetails(details: Record<string, unknown> | undefined, privateAccess: boolean): Record<string, unknown> {
	if (privateAccess) return { ...details };
	// 未知の将来項目も公開と仮定しない。一般閲覧で返す公開項目は明示する。
	return Object.fromEntries(Object.entries(details ?? {}).filter(([key]) => ['genre', 'description', 'nextStep'].includes(key)));
}
