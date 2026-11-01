/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Hataskのお花を、ページやアプリが前面にあるかに関係なく実経過時間で育てる。
 */

import { getHataskFlowerState } from '@/utility/hatask-flower-v2.js';

export const HATASK_FLOWER_GROWTH_EVENT = 'hatask-flower:growth';
export const HATASK_FLOWER_MINUTES_MIN = 480;
export const HATASK_FLOWER_MINUTES_MAX = 1920;
export const HATASK_RARE_FLOWER_MINUTES_MIN = 2880;
export const HATASK_RARE_FLOWER_MINUTES_MAX = 5760;
/** 既存の花に targetMinutes がない場合に使う互換値。 */
export const HATASK_FLOWER_TOTAL_MINUTES = 1200;

const SYNC_INTERVAL_MS = 60_000;
const MINUTE_MS = 60_000;

export type HataskGrowingFlower = {
	emoji: string;
	name: string;
	speciesId?: string;
	rare?: boolean;
	progress: number;
	startedAt: number;
	totalMinutes: number;
	targetMinutes: number;
	lastGrowthAt: number;
};

let started = false;
let syncInFlight = false;

function safeText(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampTargetMinutes(value: unknown, rare: boolean): number {
	const candidate = Math.floor(safeNumber(value, HATASK_FLOWER_TOTAL_MINUTES));
	const maximum = rare ? HATASK_RARE_FLOWER_MINUTES_MAX : HATASK_FLOWER_MINUTES_MAX;
	// 保存済みの短い目標も維持する。レア花の48時間下限は、新規抽選だけに適用する。
	return Math.max(HATASK_FLOWER_MINUTES_MIN, Math.min(maximum, candidate));
}

function flowerMetadata(value: { speciesId?: unknown; rare?: unknown }): Pick<HataskGrowingFlower, 'speciesId' | 'rare'> {
	return {
		...(typeof value.speciesId === 'string' && value.speciesId.trim() ? { speciesId: safeText(value.speciesId, '') } : {}),
		...(typeof value.rare === 'boolean' ? { rare: value.rare } : {}),
	};
}

/** 新しい花に一度だけ割り当てる成長時間を選ぶ。乱数はテストから注入できる。 */
export function randomHataskFlowerTargetMinutes(rng: () => number = Math.random, rare = false): number {
	let sample = 0;
	try {
		sample = Number(rng());
	} catch {
		sample = 0;
	}
	if (!Number.isFinite(sample)) sample = 0;
	// 壊れた rng が 0〜1 の外を返しても、抽選結果は安全な範囲に留める。
	sample = Math.max(0, Math.min(1, sample));
	const minimum = rare === true ? HATASK_RARE_FLOWER_MINUTES_MIN : HATASK_FLOWER_MINUTES_MIN;
	const maximum = rare === true ? HATASK_RARE_FLOWER_MINUTES_MAX : HATASK_FLOWER_MINUTES_MAX;
	return Math.min(maximum, minimum + Math.floor(sample * (maximum - minimum + 1)));
}

export function createHataskGrowingFlower(
	input: { emoji: string; name: string; speciesId?: string; rare?: boolean; now?: number; rng?: () => number; targetMinutes?: number },
): HataskGrowingFlower {
	const now = Math.max(1, Math.floor(safeNumber(input.now, Date.now())));
	const targetMinutes = input.targetMinutes == null ? randomHataskFlowerTargetMinutes(input.rng, input.rare === true) : clampTargetMinutes(input.targetMinutes, input.rare === true);
	return {
		emoji: safeText(input.emoji, '🌱'),
		name: safeText(input.name, 'わかば'),
		...flowerMetadata(input),
		progress: 0,
		startedAt: now,
		totalMinutes: 0,
		targetMinutes,
		lastGrowthAt: now,
	};
}

export function normalizeHataskGrowingFlower(value: unknown, now = Date.now()): HataskGrowingFlower | null {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
	const raw = value as Record<string, unknown>;
	const startedAt = Math.max(1, Math.min(now, Math.floor(safeNumber(raw.startedAt, now))));
	const targetMinutes = clampTargetMinutes(raw.targetMinutes, raw.rare === true);
	const totalMinutes = Math.max(0, Math.min(targetMinutes, Math.floor(safeNumber(raw.totalMinutes))));
	// 旧データには最終計算時刻が無い。開始時刻＋既に加算済みの分数を基準にすれば、
	// 既存の成長分を二重加算せず、これまで停止していた背景時間だけを追いつかせられる。
	const legacyLastGrowthAt = startedAt + totalMinutes * MINUTE_MS;
	const lastGrowthAt = Math.max(startedAt, Math.min(now, Math.floor(safeNumber(raw.lastGrowthAt, legacyLastGrowthAt))));

	return {
		emoji: safeText(raw.emoji, '🌱'),
		name: safeText(raw.name, 'わかば'),
		...flowerMetadata(raw),
		progress: Math.min(100, Math.floor((totalMinutes / targetMinutes) * 100)),
		startedAt,
		totalMinutes,
		targetMinutes,
		lastGrowthAt,
	};
}

export function addHataskFlowerGrowth(value: unknown, minutes: number, now = Date.now()): HataskGrowingFlower | null {
	const flower = normalizeHataskGrowingFlower(value, now);
	if (flower == null) return null;
	const safeMinutes = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
	const minutesUntilBloom = flower.targetMinutes - flower.totalMinutes;
	const addedMinutes = Math.min(minutesUntilBloom, safeMinutes);
	flower.totalMinutes += addedMinutes;
	flower.lastGrowthAt = Math.min(now, flower.lastGrowthAt + addedMinutes * MINUTE_MS);
	flower.progress = Math.min(100, Math.floor((flower.totalMinutes / flower.targetMinutes) * 100));
	return flower;
}

/** 最後に計算した時刻から、前面・背景・終了中を区別せず経過分を反映する。 */
export function advanceHataskFlowerGrowth(value: unknown, now = Date.now()): HataskGrowingFlower | null {
	const flower = normalizeHataskGrowingFlower(value, now);
	if (flower == null || flower.totalMinutes >= flower.targetMinutes) return flower;
	const elapsedMinutes = Math.floor(Math.max(0, now - flower.lastGrowthAt) / MINUTE_MS);
	return elapsedMinutes > 0 ? addHataskFlowerGrowth(flower, elapsedMinutes, now) : flower;
}

export function sameFlower(a: HataskGrowingFlower, b: HataskGrowingFlower): boolean {
	return a.emoji === b.emoji &&
		a.name === b.name &&
		a.speciesId === b.speciesId &&
		a.rare === b.rare &&
		a.progress === b.progress &&
		a.startedAt === b.startedAt &&
		a.totalMinutes === b.totalMinutes &&
		a.targetMinutes === b.targetMinutes &&
		a.lastGrowthAt === b.lastGrowthAt;
}

function publishGrowth(flower: HataskGrowingFlower): void {
	window.dispatchEvent(new CustomEvent<HataskGrowingFlower>(HATASK_FLOWER_GROWTH_EVENT, { detail: flower }));
}

async function flushGrowth(): Promise<void> {
	if (syncInFlight) return;
	syncInFlight = true;
	try {
		const state = await getHataskFlowerState();
		publishGrowth(state.flower);
	} catch (error) {
		// The server preserves elapsed growth and wallet state across disconnections.
		console.warn('Failed to sync Hatask flower growth:', error);
	} finally {
		syncInFlight = false;
	}
}

function syncAfterResume(): void {
	if (!window.document.hidden) void flushGrowth();
}

/** Hatask初回表示時の花を、レジストリ未作成利用者向けの安全な初期値として渡す。 */
export function seedHataskFlowerGrowth(_value: unknown): void {
	void flushGrowth();
}

/**
 * メインUIごとに一度だけ開始する。Hataskページやウィジェットの有無には依存しない。
 * 背景・終了中にタイマーが停止しても、復帰または次回起動時に保存時刻からまとめて追いつく。
 */
export function startHataskFlowerGrowthTracker(): void {
	if (started || typeof window === 'undefined') return;
	started = true;
	window.document.addEventListener('visibilitychange', syncAfterResume);
	window.addEventListener('pageshow', syncAfterResume);
	window.addEventListener('online', syncAfterResume);
	window.setInterval(() => void flushGrowth(), SYNC_INTERVAL_MS);
	void flushGrowth();
}
