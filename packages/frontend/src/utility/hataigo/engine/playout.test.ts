/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test } from 'vitest';
import { boardKey, createBoard } from '../rules/board.js';
import { atariMoves, choosePlayoutMove, createRandom, isTrueEye, runPlayout } from './playout.js';

test('only groups with one liberty nominate tactical moves, not two-liberty groups', () => {
	const two = createBoard(9, { white: [{ x: 0, y: 0 }] });
	expect(atariMoves(two, 'black')).toEqual([]);
	const one = createBoard(9, { white: [{ x: 0, y: 0 }], black: [{ x: 1, y: 0 }] });
	expect(atariMoves(one, 'black')).toEqual([{ x: 0, y: 1 }]);
	expect(choosePlayoutMove({ board: one, toPlay: 'black', previousBoard: null, consecutivePasses: 0 }, createRandom(1)).point).toEqual({ x: 0, y: 1 });
	const escaping = createBoard(9, { black: [{ x: 0, y: 0 }], white: [{ x: 1, y: 0 }] });
	expect(atariMoves(escaping, 'black')).toEqual([{ x: 0, y: 1 }]);
});

test('true-eye exclusion is local to playouts and accounts for hostile corner diagonals', () => {
	const eye = createBoard(9, { black: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] });
	expect(isTrueEye(eye, 'black', { x: 0, y: 0 })).toBe(true);
	const falseEye = createBoard(9, { black: [{ x: 1, y: 0 }, { x: 0, y: 1 }], white: [{ x: 1, y: 1 }] });
	expect(isTrueEye(falseEye, 'black', { x: 0, y: 0 })).toBe(false);
});

test('completed rollouts count only their terminal board and preserve the input', async () => {
	const board = createBoard(9, { black: [{ x: 0, y: 0 }] });
	const before = boardKey(board);
	const result = await runPlayout({ board, toPlay: 'white', previousBoard: null, consecutivePasses: 2 }, 6.5, createRandom(1), async () => true);
	expect(result?.moves).toBe(0);
	expect(result?.winner).toBe('black');
	expect(result?.owners).toHaveLength(81);
	expect(boardKey(board)).toBe(before);
});

test('move-cap and cooperative cancellation discard unfinished simulations', async () => {
	const position = { board: createBoard(9), toPlay: 'black' as const, previousBoard: null, consecutivePasses: 0 };
	expect(await runPlayout(position, 6.5, createRandom(1), async () => true, 0)).toBeNull();
	expect(await runPlayout(position, 6.5, createRandom(1), async () => false)).toBeNull();
});

test('seeded random streams reproduce without learned parameters', () => {
	const first = createRandom(29);
	const second = createRandom(29);
	for (let index = 0; index < 20; index++) expect(first()).toBe(second());
});
