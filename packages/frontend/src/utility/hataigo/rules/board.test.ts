/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from 'vitest';
import { boardKey, createBoard, fromDisplayPoint, fromSgfPoint, getGroup, getStone, isOnBoard, neighbors, oppositeColor, playMove, pointIndex, toDisplayPoint, toSgfPoint } from './board.js';
import type { Board, Color, Point } from './board.js';

const p = (x: number, y: number): Point => ({ x, y });

function moved(board: Board, color: Color, point: Point, previous?: Board): Board {
	const result = playMove(board, color, point, previous);
	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error(result.reason);
	return result.board;
}

const keys = (points: Point[]) => points.map(point => `${point.x},${point.y}`).sort();

describe('board snapshots and coordinates', () => {
	it.each([9, 13, 19])('creates an independent %i-line empty board', size => {
		const a = createBoard(size);
		const b = createBoard(size);
		expect(a.cells).toHaveLength(size * size);
		expect(a.cells.every(stone => stone === null)).toBe(true);
		expect(a).not.toBe(b);
		expect(a.cells).not.toBe(b.cells);
		expect(a.hash).toBe(b.hash);
		expect(Object.isFrozen(a.cells)).toBe(true);
	});

	it('copies setup points and rejects invalid sizes, coordinates and overlaps', () => {
		const setupPoint = { x: 1, y: 1 };
		const setup = { black: [setupPoint] };
		const board = createBoard(9, setup);
		setupPoint.x = 3;
		setup.black.length = 0;
		expect(getStone(board, p(1, 1))).toBe('black');
		for (const size of [0, 8, 10, 19.5, NaN]) expect(() => createBoard(size)).toThrow(RangeError);
		for (const point of [p(-1, 0), p(9, 0), p(0, 9), p(0.5, 0), p(NaN, 1), p(Infinity, 0)]) {
			expect(isOnBoard(9, point)).toBe(false);
			expect(() => createBoard(9, { black: [point] })).toThrow(RangeError);
			expect(() => getStone(board, point)).toThrow(RangeError);
			expect(() => getGroup(board, point)).toThrow(RangeError);
			expect(() => neighbors(9, point)).toThrow(RangeError);
			expect(playMove(board, 'black', point)).toEqual({ ok: false, reason: 'outOfBoard' });
		}
		expect(() => createBoard(9, { black: [p(1, 1), p(1, 1)] })).toThrow(RangeError);
		expect(() => createBoard(9, { black: [p(1, 1)], white: [p(1, 1)] })).toThrow(RangeError);
	});

	it('returns orthogonal neighbors and row-major indexes', () => {
		expect(neighbors(9, p(0, 0))).toEqual([p(1, 0), p(0, 1)]);
		expect(neighbors(9, p(4, 0))).toHaveLength(3);
		expect(neighbors(9, p(4, 4))).toHaveLength(4);
		expect(pointIndex(9, p(8, 8))).toBe(80);
		expect(oppositeColor('white')).toBe('black');
		expect(oppositeColor('black')).toBe('white');
	});

	it.each([9, 13, 19])('round trips every coordinate on %i lines', size => {
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const point = p(x, y);
				expect(fromSgfPoint(toSgfPoint(point, size), size)).toEqual(point);
				expect(fromDisplayPoint(toDisplayPoint(point, size), size)).toEqual(point);
			}
		}
	});

	it('uses top-left SGF and bottom-left display origins and skips I', () => {
		expect(toSgfPoint(p(0, 0), 19)).toBe('aa');
		expect(toSgfPoint(p(18, 18), 19)).toBe('ss');
		expect(toDisplayPoint(p(0, 0), 19)).toBe('A19');
		expect(toDisplayPoint(p(8, 18), 19)).toBe('J1');
		expect(toDisplayPoint(p(18, 18), 19)).toBe('T1');
		expect(fromSgfPoint('', 9)).toBeNull();
		for (const value of ['a', 'aaa', 'AA', 'tt', 'ja', ' a']) expect(() => fromSgfPoint(value, 9)).toThrow(RangeError);
		for (const value of ['', 'I1', 'A0', 'J10', 'A01', 'a1', ' A1', 'A1.5', 'T1']) expect(() => fromDisplayPoint(value, 9)).toThrow(RangeError);
		expect(() => toDisplayPoint(p(9, 0), 9)).toThrow(RangeError);
		expect(() => toSgfPoint(p(0, -1), 9)).toThrow(RangeError);
	});
});

describe('groups and captures', () => {
	it('collects connected stones and unique liberties, excluding diagonal stones', () => {
		const board = createBoard(9, { black: [p(1, 1), p(2, 1), p(2, 2), p(0, 0)], white: [p(1, 0)] });
		const group = getGroup(board, p(1, 1));
		expect(group).not.toBeNull();
		if (group === null) throw new Error('Expected connected stones');
		expect(keys(group.stones)).toEqual(keys([p(1, 1), p(2, 1), p(2, 2)]));
		expect(keys(group.liberties)).toEqual(keys([p(0, 1), p(1, 2), p(2, 0), p(3, 1), p(3, 2), p(2, 3)]));
		expect(getGroup(board, p(8, 8))).toBeNull();
		group.stones.length = 0;
		expect(getGroup(board, p(1, 1))?.stones).toHaveLength(3);
	});

	it.each([
		{ white: [p(1, 1)], black: [p(0, 1), p(1, 0), p(2, 1)], move: p(1, 2) },
		{ white: [p(1, 0)], black: [p(0, 0), p(2, 0)], move: p(1, 1) },
		{ white: [p(0, 0)], black: [p(1, 0)], move: p(0, 1) },
		{ white: [p(1, 1), p(2, 1)], black: [p(0, 1), p(1, 0), p(2, 0), p(3, 1), p(1, 2)], move: p(2, 2) },
	])('captures an entire group including at edges and corners: $move', ({ white, black, move }) => {
		const board = createBoard(9, { black, white });
		const before = boardKey(board);
		const result = playMove(board, 'black', move);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(keys(result.captured)).toEqual(keys(white));
		for (const point of white) expect(getStone(result.board, point)).toBeNull();
		expect(getStone(result.board, move)).toBe('black');
		expect(boardKey(board)).toBe(before);
		expect(result.board.cells).not.toBe(board.cells);
	});

	it('captures several separate groups together', () => {
		const board = createBoard(9, { white: [p(1, 2), p(3, 2)], black: [p(0, 2), p(1, 1), p(1, 3), p(4, 2), p(3, 1), p(3, 3)] });
		const result = playMove(board, 'black', p(2, 2));
		expect(result.ok && keys(result.captured)).toEqual(keys([p(1, 2), p(3, 2)]));
	});

	it('does not count one connected captured group more than once', () => {
		const white = [p(1, 2), p(1, 1), p(2, 1)];
		const board = createBoard(9, { white, black: [p(0, 2), p(1, 3), p(0, 1), p(1, 0), p(2, 0), p(3, 1)] });
		const result = playMove(board, 'black', p(2, 2));
		expect(result.ok && keys(result.captured)).toEqual(keys(white));
	});

	it('rejects occupied points and single-stone or connected-group suicide without mutation', () => {
		const board = createBoard(9, { white: [p(0, 1), p(1, 0), p(2, 1), p(1, 2)] });
		const before = boardKey(board);
		expect(playMove(board, 'black', p(0, 1))).toEqual({ ok: false, reason: 'occupied' });
		expect(playMove(board, 'black', p(1, 1))).toEqual({ ok: false, reason: 'suicide' });
		expect(boardKey(board)).toBe(before);
		const connected = createBoard(9, { black: [p(1, 1)], white: [p(0, 1), p(1, 0), p(2, 1), p(0, 2), p(2, 2), p(1, 3)] });
		expect(playMove(connected, 'black', p(1, 2))).toEqual({ ok: false, reason: 'suicide' });
		expect(getStone(connected, p(1, 1))).toBe('black');
	});

	it('permits a surrounded move when capturing first creates a liberty', () => {
		const board = createBoard(9, { white: [p(1, 0), p(0, 1), p(2, 1), p(1, 2)], black: [p(0, 0), p(2, 0)] });
		const result = playMove(board, 'black', p(1, 1));
		expect(result.ok && result.captured).toEqual([p(1, 0)]);
	});
});

describe('simple ko and position keys', () => {
	const initial = () => createBoard(9, { black: [p(0, 1), p(1, 0), p(1, 2)], white: [p(1, 1), p(2, 0), p(3, 1), p(2, 2)] });
	it('forbids immediate recapture and compares exact cells independently of hash', () => {
		const before = initial();
		const captured = moved(before, 'black', p(2, 1));
		expect(playMove(captured, 'white', p(1, 1), before)).toEqual({ ok: false, reason: 'ko' });
		expect(playMove(captured, 'white', p(1, 1), { ...before, hash: 'different' })).toEqual({ ok: false, reason: 'ko' });
		const different = createBoard(9);
		expect(playMove(captured, 'white', p(1, 1), { ...different, hash: before.hash }).ok).toBe(true);
		expect(boardKey(captured)).not.toBe(boardKey(before));
		expect(boardKey({ ...before, hash: 'different' })).toBe(boardKey(before));
	});
	it('permits recapture after intervening moves', () => {
		const before = initial();
		const captured = moved(before, 'black', p(2, 1));
		const threat = moved(captured, 'white', p(8, 8), before);
		const answer = moved(threat, 'black', p(8, 7), captured);
		const recaptured = moved(answer, 'white', p(1, 1), threat);
		expect(getStone(recaptured, p(2, 1))).toBeNull();
		expect(getStone(recaptured, p(1, 1))).toBe('white');
	});
});
