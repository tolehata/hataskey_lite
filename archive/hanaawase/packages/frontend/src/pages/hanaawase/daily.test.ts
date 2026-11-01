import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { findMatches, hasPossibleMove } from "./engine.js";
import {
	createDailyBoard,
	dailyDateFrom,
	formatDailyShareText,
	updateDailyResult,
} from "./daily.js";
import type { Daily } from "./storage.js";

const emptyDaily = (): Daily => ({
	v: 1,
	lastPlayed: "",
	streak: 0,
	best: 0,
	freezes: 0,
	freezeMonth: "",
	plays: 0,
	longest: 0,
	updatedAt: 0,
});

describe("花常デイリー", () => {
	test("今日の盤面は未読物語へ誤遷移せず、個人の今日の記録を結果画面に出す", () => {
		const page = readFileSync(resolve(process.cwd(), "src/pages/hanaawase/index.vue"), "utf8");
		expect(page).toMatch(/function storyWaitsAfterBoard\(\)\s*\{[\s\S]*?if \(isDaily\.value\) return false;/);
		expect(page).toContain('aria-label="今日の記録"');
		expect(page).toContain('class="daily-result-score"');
		expect(page).toContain('自己ベスト');
		expect(page).toContain('連続日数');
		expect(page).toContain('プレイ日数');
		expect(page).not.toContain('デイリーランキング');
	});

	test("日付はJST固定でYYYYMMDDシード用表現を作る", () => {
		expect(dailyDateFrom(new Date("2026-07-22T14:59:59.000Z")).key).toBe("2026-07-22");
		const next = dailyDateFrom(new Date("2026-07-22T15:00:00.000Z"));
		expect(next.key).toBe("2026-07-23");
		expect(next.compact).toBe("20260723");
		expect(next.label).toBe("2026/07/23");
	});

	test("同じ日付は同じ盤面になり、初期マッチなしで一手を持つ", () => {
		const date = dailyDateFrom(new Date("2026-07-23T00:00:00.000Z"));
		const first = createDailyBoard(date);
		const second = createDailyBoard(date);
		expect(first).toEqual(second);
		expect(findMatches(first)).toHaveLength(0);
		expect(hasPossibleMove(first)).toBe(true);
		expect(first.flat().filter((piece) => piece?.outOfSeason)).toHaveLength(1);
	});

	test("同じ日の再プレイはプレイ回数とストリークを二重加算せず、自己ベストだけ伸ばす", () => {
		const date = dailyDateFrom(new Date("2026-07-23T00:00:00.000Z"));
		const first = updateDailyResult(emptyDaily(), date, 120);
		const second = updateDailyResult(first, date, 300);
		expect(second.plays).toBe(1);
		expect(second.streak).toBe(1);
		expect(second.best).toBe(300);
		expect(second.freezes).toBe(1);
	});

	test("一日空きは花の露を消費してストリークを維持する", () => {
		const daily: Daily = {
			...emptyDaily(),
			lastPlayed: "2026-07-21",
			streak: 4,
			freezes: 1,
			freezeMonth: "2026-07",
			plays: 4,
			longest: 4,
		};
		const next = updateDailyResult(daily, dailyDateFrom(new Date("2026-07-23T00:00:00.000Z")), 80);
		expect(next.streak).toBe(5);
		expect(next.freezes).toBe(0);
		expect(next.longest).toBe(5);
	});

	test("共有文面にハッシュタグを付けない", () => {
		const text = formatDailyShareText(dailyDateFrom(new Date("2026-07-23T00:00:00.000Z")), 246, 3);
		expect(text).toBe("花常 今日の盤面 2026/07/23\nスコア 246(最大3連鎖)");
		expect(text).not.toContain("#");
	});
});
