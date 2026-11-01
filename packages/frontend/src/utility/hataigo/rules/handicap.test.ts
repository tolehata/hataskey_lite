/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from 'vitest';
import { toSgfPoint } from './board.js';
import { getHandicapPoints } from './handicap.js';

// Literal fixtures transcribed independently from the Phase 1 placement table.
const placements = [
	{ size: 19, expected: ['pd dp', 'pd dp pp', 'pd dp pp dd', 'pd dp pp dd jj', 'pd dp pp dd dj pj', 'pd dp pp dd dj pj jj', 'pd dp pp dd dj pj jd jp', 'pd dp pp dd dj pj jd jp jj'] },
	{ size: 13, expected: ['jd dj', 'jd dj jj', 'jd dj jj dd', 'jd dj jj dd gg', 'jd dj jj dd dg jg', 'jd dj jj dd dg jg gg', 'jd dj jj dd dg jg gd gj', 'jd dj jj dd dg jg gd gj gg'] },
	{ size: 9, expected: ['gc cg', 'gc cg gg', 'gc cg gg cc', 'gc cg gg cc ee', 'gc cg gg cc ce ge', 'gc cg gg cc ce ge ee', 'gc cg gg cc ce ge ec eg', 'gc cg gg cc ce ge ec eg ee'] },
];

describe('fixed handicap', () => {
	for (const { size, expected } of placements) {
		for (let index = 0; index < expected.length; index++) {
			it(`places ${index + 2} stones on ${size} lines in the required order`, () => {
				const points = getHandicapPoints(size, index + 2);
				expect(points.map(point => toSgfPoint(point, size)).join(' ')).toBe(expected[index]);
				expect(new Set(points.map(point => `${point.x},${point.y}`)).size).toBe(index + 2);
			});
		}
	}
	it('rejects unsupported sizes and invalid counts', () => {
		for (const size of [0, 8, 10, 18, 20, NaN]) expect(() => getHandicapPoints(size, 2)).toThrow(RangeError);
		for (const count of [-1, 0, 1, 10, 2.5, NaN, Infinity]) expect(() => getHandicapPoints(19, count)).toThrow(RangeError);
	});
	it('returns new arrays and points on every call', () => {
		const first = getHandicapPoints(19, 9);
		const second = getHandicapPoints(19, 9);
		expect(first).toEqual(second);
		expect(first).not.toBe(second);
		for (let i = 0; i < first.length; i++) expect(first[i]).not.toBe(second[i]);
		first.length = 0;
		expect(getHandicapPoints(19, 9)).toHaveLength(9);
	});
});
