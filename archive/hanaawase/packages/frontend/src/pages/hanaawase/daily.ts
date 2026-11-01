import { createBoard } from "./engine.js";
import type { Board, Flower, Piece } from "./engine.js";
import { mulberry32, seedFromText } from "./rng.js";
import { SAVE_VERSION } from "./storage.js";
import type { Daily } from "./storage.js";

export const DAILY_SHARE_TEXT = "花常 今日の盤面 {date}\nスコア {score}(最大{maxChain}連鎖)" as const;

export type DailyDate = Readonly<{
	key: string;
	compact: string;
	label: string;
	monthKey: string;
}>;

export type DailyStage = Readonly<{
	id: "daily";
	month: number;
	monthName: string;
	flower: Flower;
	colors: readonly Flower[];
	moves: number;
	goalNeed?: undefined;
	starScores: readonly [number, number, number];
	outOfSeasonRate: number;
	ambience: "shop";
	boardPreset: Board;
	boss?: undefined;
}>;

const MS_PER_DAY = 86_400_000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAILY_COLORS: readonly Flower[] = ["matsu", "ume", "sakura", "ajisai", "himawari", "kiku"];
const pad = (value: number) => String(value).padStart(2, "0");

export const dailyDateFrom = (date = new Date()): DailyDate => {
	const shifted = new Date(date.getTime() + JST_OFFSET_MS);
	const year = shifted.getUTCFullYear();
	const month = shifted.getUTCMonth() + 1;
	const day = shifted.getUTCDate();
	return {
		key: `${year}-${pad(month)}-${pad(day)}`,
		compact: `${year}${pad(month)}${pad(day)}`,
		label: `${year}/${pad(month)}/${pad(day)}`,
		monthKey: `${year}-${pad(month)}`,
	};
};

const dayNumber = (key: string) => {
	const [year, month, day] = key.split("-").map(Number);
	if (!year || !month || !day) return undefined;
	return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
};

const withMonthlyFreeze = (daily: Daily, date: DailyDate): Daily =>
	daily.freezeMonth === date.monthKey
		? daily
		: { ...daily, freezes: daily.freezes + 1, freezeMonth: date.monthKey };

export const createDailyBoard = (date: DailyDate): Board => {
	const seed = seedFromText(`hanaawase-${date.compact}`);
	const board = createBoard(8, 8, DAILY_COLORS, mulberry32(seed));
	const row = seed % 8;
	const col = Math.floor(seed / 8) % 8;
	const next: (Piece | null)[][] = board.map((cells, rowIndex) =>
		cells.map((piece, colIndex) =>
			piece && rowIndex === row && colIndex === col ? { ...piece, outOfSeason: true } : piece));
	return next;
};

export const createDailyStage = (date = dailyDateFrom()): DailyStage => ({
	id: "daily",
	month: Number(date.key.slice(5, 7)),
	monthName: `今日の盤面 ${date.label}`,
	flower: "matsu",
	colors: DAILY_COLORS,
	moves: 20,
	starScores: [0, 0, 0],
	outOfSeasonRate: 0,
	ambience: "shop",
	boardPreset: createDailyBoard(date),
});

export const updateDailyResult = (daily: Daily, date: DailyDate, score: number): Daily => {
	const normalized = withMonthlyFreeze(daily, date);
	const previousDay = dayNumber(normalized.lastPlayed);
	const today = dayNumber(date.key);
	let streak = 1;
	let freezes = normalized.freezes;
	let plays = normalized.plays + 1;
	if (normalized.lastPlayed === date.key) {
		streak = normalized.streak;
		plays = normalized.plays;
	} else if (previousDay !== undefined && today !== undefined) {
		const gap = today - previousDay;
		if (gap === 1) streak = normalized.streak + 1;
		else if (gap === 2 && freezes > 0) {
			freezes--;
			streak = normalized.streak + 1;
		}
	}
	return {
		...normalized,
		v: SAVE_VERSION,
		lastPlayed: date.key,
		streak,
		best: Math.max(normalized.best, Math.floor(score)),
		freezes,
		plays,
		longest: Math.max(normalized.longest, streak),
	};
};

export const formatDailyShareText = (date: DailyDate, score: number, maxChain: number) =>
	DAILY_SHARE_TEXT
		.replace("{date}", date.label)
		.replace("{score}", String(Math.floor(score)))
		.replace("{maxChain}", String(Math.max(1, Math.floor(maxChain))));
