/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { createBoard } from './board.js';
import { scoreJapanese } from './score.js';

const row = (y: number) => Array.from({ length: 9 }, (_, x) => ({ x, y }));
const marks = { deadStones: [], neutralPoints: [] };
const prisoners = { black: 0, white: 0 };
const partition = () => createBoard(9, { black: row(4), white: row(6) });

describe('Japanese scoring from agreed marks', () => {
	test.each([6.5, 7.5, 0.5, 0])('counts territory, shared dame and komi %s', komi => {
		const result = scoreJapanese(partition(), marks, { black: 2, white: 3 }, komi);
		expect(result.black).toEqual({ territory: 36, prisoners: 2, deadStones: 0, total: 38 });
		expect(result.white).toEqual({ territory: 18, prisoners: 3, deadStones: 0, komi, total: 21 + komi });
		expect(result.territory.neutral).toHaveLength(9);
		expect(result.winner).toBe('black');
		expect(result.margin).toBe(17 - komi);
	});
	test('dead stones add prisoners once and their vacated points can be territory', () => {
		const board = createBoard(9, { black: row(4), white: [...row(6), { x: 1, y: 1 }] });
		const snapshot = JSON.stringify(board);
		const deadMarks = { deadStones: [{ x: 1, y: 1 }, { x: 1, y: 1 }], neutralPoints: [] };
		const result = scoreJapanese(board, deadMarks, { black: 2, white: 0 }, 6.5);
		expect(result.black).toEqual({ territory: 36, prisoners: 3, deadStones: 1, total: 39 });
		expect(result.territory.black).toContainEqual({ x: 1, y: 1 });
		expect(scoreJapanese(board, deadMarks, { black: 2, white: 0 }, 6.5)).toEqual(result);
		expect(JSON.stringify(board)).toBe(snapshot);
	});
	test('counts dead stones of both colors for the capturing side', () => {
		const board = createBoard(9, { black: [...row(4), { x: 1, y: 8 }], white: [...row(6), { x: 1, y: 1 }] });
		const result = scoreJapanese(board, { deadStones: [{ x: 1, y: 8 }, { x: 1, y: 1 }], neutralPoints: [] }, prisoners, 0);
		expect(result.black.total).toBe(37);
		expect(result.white.total).toBe(19);
	});
	test('manual dame and seki eye marks exclude only the marked empty points', () => {
		const result = scoreJapanese(partition(), { deadStones: [], neutralPoints: [{ x: 1, y: 1 }, { x: 1, y: 8 }] }, prisoners, 0);
		expect(result.black.territory).toBe(35);
		expect(result.white.territory).toBe(17);
		expect(result.territory.neutral).toHaveLength(11);
	});
	test('neutral marks also exclude a vacated dead-stone point from territory', () => {
		const board = createBoard(9, { black: row(4), white: [...row(6), { x: 1, y: 1 }] });
		const result = scoreJapanese(board, { deadStones: [{ x: 1, y: 1 }], neutralPoints: [{ x: 1, y: 1 }] }, prisoners, 0);
		expect(result.black).toEqual({ territory: 35, prisoners: 1, deadStones: 1, total: 36 });
	});
	test('an empty board has no territory and supports jigo', () => {
		expect(scoreJapanese(createBoard(9), marks, prisoners, 0)).toMatchObject({ winner: 'draw', margin: 0, black: { territory: 0 }, white: { territory: 0 } });
		expect(scoreJapanese(createBoard(9), marks, prisoners, 0.5)).toMatchObject({ winner: 'white', margin: 0.5 });
	});
	test('does not infer dead stones or alter the provided board', () => {
		const board = createBoard(9, { black: row(4), white: [...row(6), { x: 1, y: 1 }] });
		expect(scoreJapanese(board, marks, prisoners, 0).black.territory).toBe(0);
	});
	test.each([
		{ deadStones: [{ x: 0, y: 0 }], neutralPoints: [] },
		{ deadStones: [{ x: -1, y: 0 }], neutralPoints: [] },
		{ deadStones: [], neutralPoints: [{ x: 0, y: 4 }] },
		{ deadStones: [], neutralPoints: [{ x: 9, y: 0 }] },
	])('rejects invalid scoring marks %#', invalid => {
		expect(() => scoreJapanese(partition(), invalid, prisoners, 0)).toThrow(RangeError);
	});
	test('rejects invalid counts or non-finite komi', () => {
		expect(() => scoreJapanese(partition(), marks, { black: -1, white: 0 }, 0)).toThrow(RangeError);
		expect(() => scoreJapanese(partition(), marks, prisoners, NaN)).toThrow(RangeError);
	});
});
