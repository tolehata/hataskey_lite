/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test } from 'vitest';
import { createBoard } from '../rules/board.js';
import { addOwnership, createOwnershipAccumulator, estimateMargin, ownershipSnapshot, terminalOwnership } from './ownership.js';

test('terminal ownership includes stones, single-color territory, and shared neutral space', () => {
	const board = createBoard(9, { black: Array.from({ length: 9 }, (_, x) => ({ x, y: 3 })), white: Array.from({ length: 9 }, (_, x) => ({ x, y: 5 })) });
	const owners = terminalOwnership(board);
	expect(owners.filter(color => color === 'black')).toHaveLength(36);
	expect(owners.filter(color => color === 'white')).toHaveLength(36);
	expect(owners.filter(color => color === null)).toHaveLength(9);
	const accumulator = createOwnershipAccumulator(81);
	addOwnership(accumulator, owners);
	const snapshot = ownershipSnapshot(accumulator);
	expect(snapshot.black[0]).toBe(1);
	expect(snapshot.white[80]).toBe(1);
	expect(snapshot.neutral[40]).toBe(1);
	expect(estimateMargin(board, snapshot, { black: 2, white: 1 }, 6.5)).toBe(-5.5);
});

test('ownership averages only submitted completed outcomes, and empty samples have no margin', () => {
	const accumulator = createOwnershipAccumulator(81);
	const board = createBoard(9);
	expect(estimateMargin(board, ownershipSnapshot(accumulator), { black: 0, white: 0 }, 0)).toBeNull();
	addOwnership(accumulator, Array<'black'>(81).fill('black'));
	const first = ownershipSnapshot(accumulator);
	addOwnership(accumulator, Array<'white'>(81).fill('white'));
	const second = ownershipSnapshot(accumulator);
	expect(first.samples).toBe(1);
	expect(first.black[0]).toBe(1);
	expect(second.samples).toBe(2);
	expect(second.black[0]).toBe(0.5);
	expect(second.white[0]).toBe(0.5);
	expect(() => addOwnership(accumulator, [])).toThrow(RangeError);
});
