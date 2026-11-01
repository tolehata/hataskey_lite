/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createBoard } from './board.js';
import type { Point } from './board.js';

/** Fixed placement order; five and seven stones include the center last. */
export function getHandicapPoints(size: number, count: number): Point[] {
	createBoard(size);
	if (!Number.isInteger(count) || count < 2 || count > 9) throw new RangeError('Handicap must be between two and nine');
	const low = size === 9 ? 2 : 3;
	const high = size - low - 1;
	const middle = (size - 1) / 2;
	const corners: Point[] = [{ x: high, y: low }, { x: low, y: high }, { x: high, y: high }, { x: low, y: low }];
	if (count <= 4) return corners.slice(0, count);
	const center = { x: middle, y: middle };
	if (count === 5) return [...corners, center];
	const sides = [{ x: low, y: middle }, { x: high, y: middle }];
	if (count === 6) return [...corners, ...sides];
	if (count === 7) return [...corners, ...sides, center];
	const eight = [...corners, ...sides, { x: middle, y: low }, { x: middle, y: high }];
	return count === 8 ? eight : [...eight, center];
}
