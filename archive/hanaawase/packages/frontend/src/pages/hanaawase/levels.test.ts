import { describe, expect, test } from "vitest";
import { createPiece, findMatches, swap } from "./engine.js";
import { LEVELS, levelById } from "./levels.js";

describe("花常の36面定義", () => {
	test("12ヶ月×3面で、ボスは季節末の4面だけ", () => {
		expect(LEVELS).toHaveLength(36);
		expect(LEVELS.filter((stage) => stage.boss).map((stage) => stage.id)).toEqual([
			"m3-3",
			"m6-3",
			"m9-3",
			"m12-3",
		]);
		expect(levelById("m12-3")?.ambience).toBe("silent");
	});

	test("一月一面は初期消去なし・可能手が一つだけのヒント盤面", () => {
		const preset = levelById("m1-1")?.boardPreset;
		expect(preset).toBeDefined();
		const board = (preset ?? []).map((row) => row.map((flower) => createPiece(flower)));
		expect(findMatches(board)).toHaveLength(0);
		const possibleMoves = board.flatMap((row, rowIndex) =>
			row.flatMap((_, col) =>
				[{ row: rowIndex + 1, col }, { row: rowIndex, col: col + 1 }]
					.filter((target) => target.row < board.length && target.col < row.length)
					.filter((target) => findMatches(swap(board, { row: rowIndex, col }, target)).length > 0),
			),
		);
		expect(possibleMoves).toHaveLength(1);
	});
});
