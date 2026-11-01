import { describe, expect, test } from "vitest";
import { applyBossAction, advanceBoss, bossDamage, createBossState } from "./bosses.js";
import { createPiece } from "./engine.js";
import { mulberry32 } from "./rng.js";

const board = Array.from({ length: 8 }, (_, row) =>
	Array.from({ length: 8 }, (_, col) => createPiece((['matsu', 'ume', 'sakura', 'ajisai'] as const)[(row + col) % 4])),
);

describe("季節の障り", () => {
	test.each([
		["haruare", 2],
		["samidare", 3],
		["nowaki", 4],
		["ooshimo", 3],
	] as const)("%s は行動の1手前に予告する", (id, cycle) => {
		let state = createBossState(id);
		const rng = mulberry32(42);
		for (let move = 1; move < cycle; move++) state = advanceBoss(state, board, rng).state;
		expect(state.telegraph).toBeDefined();
		const resolved = advanceBoss(state, board, rng);
		expect(resolved.action).toEqual(state.telegraph);
		expect(resolved.state.telegraph).toBeUndefined();
	});

	test("天候の移動は予告対象だけを循環させ、特殊消去は二倍ダメージ", () => {
		const action = { kind: "swap-four" as const, targets: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 0 }] };
		const shifted = applyBossAction(board, action);
		expect(shifted[0][0]).toEqual(board[1][0]);
		expect(bossDamage([[createPiece("matsu", "mari"), createPiece("ume")]], [{ row: 0, col: 0 }, { row: 0, col: 1 }])).toBe(3);
	});
});
