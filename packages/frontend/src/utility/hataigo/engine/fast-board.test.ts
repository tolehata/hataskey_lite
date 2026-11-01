/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test } from 'vitest';
import { createBoard, oppositeColor, playMove } from '../rules/board.js';
import { BLACK, FastBoard, WHITE, colorCode } from './fast-board.js';
import { createRandom } from './playout.js';
import type { Board, Color } from '../rules/board.js';

function legalByRules(board: Board, color: Color, previous: Board | null): number[] {
	return board.cells.flatMap((_, index) => playMove(board, color, { x: index % board.size, y: Math.floor(index / board.size) }, previous ?? undefined).ok ? [index] : []);
}

function legalFast(fast: FastBoard, color: Color): number[] {
	return Array.from({ length: fast.area }, (_, index) => index).filter(index => fast.isLegal(index, colorCode(color)));
}

test('legality, captures and ko agree with rules/board.ts over long random games, both incrementally and rebuilt', () => {
	const random = createRandom(7);
	let compared = 0;
	let kos = 0;
	for (let game = 0; game < 12; game++) {
		let board = createBoard(9);
		let previous: Board | null = null;
		let color: Color = 'black';
		const incremental = FastBoard.from(board, color, previous);
		for (let move = 0; move < 160; move++) {
			const expected = legalByRules(board, color, previous);
			expect(legalFast(FastBoard.from(board, color, previous), color)).toEqual(expected);
			expect(legalFast(incremental, color)).toEqual(expected);
			if (incremental.ko >= 0) kos++;
			compared++;
			if (expected.length === 0) break;
			const index = expected[Math.floor(random() * expected.length)];
			const moved = playMove(board, color, { x: index % 9, y: Math.floor(index / 9) }, previous ?? undefined);
			if (!moved.ok) throw new Error('unreachable');
			incremental.play(index, colorCode(color));
			expect(Array.from(incremental.cells)).toEqual(moved.board.cells.map(stone => stone === null ? 0 : stone === 'black' ? BLACK : WHITE));
			previous = board;
			board = moved.board;
			color = oppositeColor(color);
		}
	}
	expect(compared).toBeGreaterThan(1000);
	// The comparison is only meaningful if ko actually occurred.
	expect(kos).toBeGreaterThan(0);
});

test('a ko retake is illegal for exactly one turn, and a pass clears it', () => {
	// White (2,0) has one liberty at (3,0); black takes it and the lone black stone then has (2,0) as its only liberty.
	const board = createBoard(9, { black: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }], white: [{ x: 2, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 4, y: 0 }] });
	const taken = playMove(board, 'black', { x: 3, y: 0 });
	expect(taken.ok).toBe(true);
	if (!taken.ok) return;
	expect(taken.captured).toEqual([{ x: 2, y: 0 }]);
	const fast = FastBoard.from(taken.board, 'white', board);
	expect(fast.ko).toBe(2);
	expect(fast.isLegal(2, WHITE)).toBe(false);
	expect(playMove(taken.board, 'white', { x: 2, y: 0 }, board).ok).toBe(false);
	fast.pass();
	expect(fast.isLegal(2, WHITE)).toBe(true);
});

test('self-atari distinguishes a lone stone from joining a chain, and a capture is never self-atari', () => {
	// Black chain (0,0)-(1,0) with liberties (2,0) and (0,1); either one leaves the joined chain with the other only.
	const board = createBoard(9, { black: [{ x: 0, y: 0 }, { x: 1, y: 0 }], white: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 0 }, { x: 0, y: 2 }] });
	const fast = FastBoard.from(board, 'black');
	expect(fast.selfAtari(2, BLACK)).toBe(2);
	expect(fast.selfAtari(9, BLACK)).toBe(2);
	const lone = FastBoard.from(createBoard(9, { white: [{ x: 1, y: 0 }] }), 'black');
	expect(lone.selfAtari(9, BLACK)).toBe(0);
	expect(FastBoard.from(createBoard(9, { white: [{ x: 1, y: 1 }, { x: 0, y: 2 }] }), 'black').selfAtari(9, BLACK)).toBe(1);
	// Without the capture of (0,0) the move would even be suicide.
	const capture = FastBoard.from(createBoard(9, { white: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }], black: [{ x: 1, y: 0 }] }), 'black');
	expect(capture.selfAtari(9, BLACK)).toBe(0);
});
