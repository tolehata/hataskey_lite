import { describe, expect, test } from "vitest";
import {
	automaticShuffle,
	createBoard,
	createPiece,
	findMatches,
	hasPossibleMove,
	playSwap,
	resolve,
	specialFor,
	specialTargets,
	swap,
	uchimizuShuffle,
} from "./engine.js";
import type { Board, Flower } from "./engine.js";
import { mulberry32 } from "./rng.js";

const colors: Flower[] = ["matsu", "ume", "sakura", "ajisai"];
const board = (rows: string[][]): Board =>
	rows.map((row) => row.map((flower) => createPiece(flower as Flower)));

describe("花常盤面エンジン", () => {
	test("横と縦の3連続を見つける", () => {
		const value = board([
			["matsu", "matsu", "matsu"],
			["ume", "sakura", "ajisai"],
			["ume", "sakura", "ajisai"],
		]);
		expect(findMatches(value)).toHaveLength(1);
		expect(findMatches(value)[0].cells).toEqual([
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 0, col: 2 },
		]);
	});

	test("雨溜まりのマスはマッチの連続を分断する", () => {
		const value = board([["matsu", "matsu", "matsu"]]);
		expect(findMatches(value, [{ row: 0, col: 1 }])).toHaveLength(0);
	});

	test("開始盤面は自然消去なしで、少なくとも一手を持つ", () => {
		const value = createBoard(8, 8, colors, mulberry32(20260721));
		expect(findMatches(value)).toHaveLength(0);
		expect(hasPossibleMove(value)).toBe(true);
	});

	test("成立しない隣接交換は盤面を戻し、成立する交換だけを受け入れる", () => {
		const value = board([
			["matsu", "ume", "matsu"],
			["ume", "matsu", "sakura"],
			["sakura", "matsu", "ajisai"],
		]);
		expect(
			playSwap(
				value,
				{ row: 0, col: 0 },
				{ row: 1, col: 0 },
				colors,
				mulberry32(1),
			).accepted,
		).toBe(false);
		expect(
			playSwap(
				value,
				{ row: 0, col: 1 },
				{ row: 1, col: 1 },
				colors,
				mulberry32(1),
			).accepted,
		).toBe(true);
		expect(
			swap(value, { row: 0, col: 1 }, { row: 1, col: 1 })[0][1]?.flower,
		).toBe("matsu");
	});

	test("4連続、5連続、L/T字から短冊・月・鞠を生成する", () => {
		const line4 = board([["matsu", "matsu", "matsu", "matsu"]]);
		expect(specialFor(findMatches(line4), { row: 0, col: 1 })).toEqual(
			createPiece("matsu", "tanzaku", "column"),
		);
		const line5 = board([["ume", "ume", "ume", "ume", "ume"]]);
		expect(specialFor(findMatches(line5), { row: 0, col: 2 })).toEqual(
			createPiece("ume", "tsuki"),
		);
		const cross = board([
			["sakura", "ume", "ume"],
			["sakura", "sakura", "sakura"],
			["sakura", "ume", "ume"],
		]);
		expect(specialFor(findMatches(cross), { row: 1, col: 0 })).toEqual(
			createPiece("sakura", "mari"),
		);
	});

	test("特殊ピースの組合せは指定範囲を消去対象にする", () => {
		const value: Board = [
			[createPiece("matsu"), createPiece("ume"), createPiece("sakura")],
			[
				createPiece("ajisai"),
				createPiece("ume", "mari"),
				createPiece("matsu", "mari"),
			],
			[createPiece("sakura"), createPiece("ume"), createPiece("ajisai")],
		];
		expect(
			specialTargets(value, { row: 1, col: 1 }, { row: 1, col: 2 }),
		).toHaveLength(9);
		const moons: Board = [
			[createPiece("matsu", "tsuki"), createPiece("ume", "tsuki")],
			[createPiece("sakura"), createPiece("ajisai")],
		];
		expect(
			specialTargets(moons, { row: 0, col: 0 }, { row: 0, col: 1 }),
		).toHaveLength(4);
		const combinations: Board = [
			[
				createPiece("matsu", "tsuki"),
				createPiece("ume", "tanzaku", "column"),
				createPiece("matsu"),
			],
			[
				createPiece("ume"),
				createPiece("sakura", "mari"),
				createPiece("ajisai"),
			],
			[createPiece("ume"), createPiece("kiku"), createPiece("matsu")],
		];
		expect(
			specialTargets(combinations, { row: 0, col: 1 }, { row: 1, col: 1 }),
		).toHaveLength(9); // 短冊+鞠
		expect(
			specialTargets(combinations, { row: 0, col: 0 }, { row: 0, col: 1 }),
		).toHaveLength(6); // 月+短冊
		expect(
			specialTargets(combinations, { row: 0, col: 0 }, { row: 1, col: 1 }),
		).toHaveLength(9); // 月+鞠
	});

	test("短冊同士は縦横の十字を消去する", () => {
		const value: Board = [
			[createPiece("matsu"), createPiece("ume"), createPiece("sakura")],
			[
				createPiece("ajisai"),
				createPiece("matsu", "tanzaku", "row"),
				createPiece("ume", "tanzaku", "column"),
			],
			[createPiece("sakura"), createPiece("ajisai"), createPiece("matsu")],
		];
		expect(
			specialTargets(value, { row: 1, col: 1 }, { row: 1, col: 2 }),
		).toHaveLength(5);
	});

	test("消去は連鎖スコアを加算し、季節外れの花に手数を返す", () => {
		const value: Board = [
			[
				{ ...createPiece("matsu"), outOfSeason: true },
				createPiece("matsu"),
				createPiece("matsu"),
			],
			[createPiece("ume"), createPiece("sakura"), createPiece("ajisai")],
			[createPiece("ajisai"), createPiece("ume"), createPiece("sakura")],
		];
		const result = resolve(value, colors, mulberry32(9));
		expect(result.removed).toHaveLength(3);
		expect(result.returnedMoves).toBe(1);
		expect(result.score).toBeGreaterThanOrEqual(530);
		expect(result.collected.matsu).toBe(3);
	});

	test("連鎖の中間状態は既存の集計値と一致する", () => {
		const value = board([
			["ume", "sakura", "ajisai"],
			["matsu", "matsu", "matsu"],
			["ume", "ajisai", "sakura"],
			["ume", "sakura", "ajisai"],
		]);
		const result = resolve(value, colors, mulberry32(20260725));
		expect(result.steps.length).toBeGreaterThanOrEqual(2);
		expect(result.steps).toHaveLength(result.cascade);
		expect(result.steps.map((step) => step.cascade)).toEqual(
			result.steps.map((_, index) => index + 1),
		);
		expect(result.steps.at(-1)?.board).toEqual(result.board);
		expect(
			result.steps.reduce((total, step) => total + step.gained, 0),
		).toBeCloseTo(result.score);
		const cells = new Set(
			result.steps.flatMap((step) =>
				step.removed.map(({ at }) => `${at.row}:${at.col}`),
			),
		);
		expect(cells.size).toBe(result.removed.length);
		const collected: Partial<Record<Flower, number>> = {};
		for (const step of result.steps) {
			for (const { piece } of step.removed) collected[piece.flower] = (collected[piece.flower] ?? 0) + 1;
		}
		expect(collected).toEqual(result.collected);
		expect(result.steps.flatMap((step) => step.spawn ?? [])).toEqual(
			result.spawns,
		);
		expect(result.steps[0].removed.map(({ piece }) => piece.flower)).toEqual([
			"matsu",
			"matsu",
			"matsu",
		]);
	});

	test("落下距離は列ごとに、消えていない列は0・上ほど大きい", () => {
		const value = board([
			["ume", "sakura", "ajisai"],
			["matsu", "matsu", "matsu"],
			["ume", "ajisai", "sakura"],
			["ume", "sakura", "ajisai"],
		]);
		const [first] = resolve(value, colors, mulberry32(20260725)).steps;
		expect(first.drops).toHaveLength(4);
		expect(first.drops.every((row) => row.length === 3)).toBe(true);
		// 1行目を消したので、各列とも「上の1枚＋補充1枚」が1マスぶん落ちる。
		expect(first.drops).toEqual([
			[1, 1, 1],
			[1, 1, 1],
			[0, 0, 0],
			[0, 0, 0],
		]);
		const untouched = board([
			["matsu", "matsu", "matsu", "ume"],
			["ume", "sakura", "ajisai", "sakura"],
			["sakura", "ajisai", "ume", "ajisai"],
			["ajisai", "ume", "sakura", "matsu"],
		]);
		const step = resolve(untouched, colors, mulberry32(7)).steps[0];
		// 消去のない列は誰も落ちない。消えた列は下に向かって非増加。
		expect(step.drops.map((row) => row[3])).toEqual([0, 0, 0, 0]);
		for (let col = 0; col < 4; col++) {
			for (let row = 1; row < 4; row++) {
				expect(step.drops[row][col]).toBeLessThanOrEqual(
					step.drops[row - 1][col],
				);
			}
		}
	});

	test("中間状態は生成と起爆を段ごとに記録する", () => {
		const four = board([
			["matsu", "matsu", "matsu", "matsu"],
			["ume", "sakura", "ajisai", "ume"],
			["sakura", "ajisai", "ume", "sakura"],
			["ajisai", "ume", "sakura", "ajisai"],
		]);
		const spawned = resolve(four, colors, mulberry32(31)).steps[0];
		expect(spawned.spawn?.piece).toEqual(
			createPiece("matsu", "tanzaku", "column"),
		);
		expect(spawned.detonated).toEqual([]);
		const withMari: Board = [
			[createPiece("matsu"), createPiece("ume"), createPiece("sakura")],
			[
				createPiece("ajisai"),
				createPiece("ume", "mari"),
				createPiece("matsu"),
			],
			[createPiece("sakura"), createPiece("ajisai"), createPiece("ume")],
		];
		const detonatedStep = resolve(withMari, colors, mulberry32(31), [
			{ row: 1, col: 1 },
		]).steps[0];
		expect(detonatedStep.detonated).toEqual(["mari"]);
		expect(detonatedStep.removed).toHaveLength(9);
	});

	test("同じシードでは同じシャッフルになり、両発動経路は同じ関数を使う", () => {
		const value = board([
			["matsu", "ume", "sakura"],
			["ajisai", "matsu", "ume"],
			["sakura", "ajisai", "matsu"],
		]);
		const first = automaticShuffle(value, mulberry32(22));
		const second = uchimizuShuffle(value, mulberry32(22));
		expect(first).toEqual(second);
		expect(findMatches(first)).toHaveLength(0);
		expect(hasPossibleMove(first)).toBe(true);
	});
});
