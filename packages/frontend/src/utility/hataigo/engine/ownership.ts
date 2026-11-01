/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { neighbors, pointIndex } from '../rules/board.js';
import type { Board, Color } from '../rules/board.js';

export interface Ownership {
	black: number[];
	white: number[];
	neutral: number[];
	samples: number;
}
export interface OwnershipAccumulator {
	black: number[];
	white: number[];
	neutral: number[];
	samples: number;
}

/** Called only for completed simulation end positions, including their stones. */
export function terminalOwnership(board: Board): (Color | null)[] {
	const owners = [...board.cells];
	const visited = new Set<number>();
	for (let index = 0; index < board.cells.length; index++) {
		if (board.cells[index] !== null || visited.has(index)) continue;
		const region = [index];
		const borders = new Set<Color>();
		visited.add(index);
		for (let cursor = 0; cursor < region.length; cursor++) {
			const current = region[cursor];
			for (const point of neighbors(board.size, { x: current % board.size, y: Math.floor(current / board.size) })) {
				const neighbor = pointIndex(board.size, point);
				const color = board.cells[neighbor];
				if (color !== null) borders.add(color);
				else if (!visited.has(neighbor)) { visited.add(neighbor); region.push(neighbor); }
			}
		}
		const owner = borders.size === 1 ? [...borders][0] : null;
		for (const empty of region) owners[empty] = owner;
	}
	return owners;
}

export function createOwnershipAccumulator(length: number): OwnershipAccumulator {
	return { black: Array<number>(length).fill(0), white: Array<number>(length).fill(0), neutral: Array<number>(length).fill(0), samples: 0 };
}

export function addOwnership(target: OwnershipAccumulator, owners: readonly (Color | null)[]): void {
	if (owners.length !== target.black.length) throw new RangeError('Ownership size mismatch');
	for (let index = 0; index < owners.length; index++) {
		const owner = owners[index];
		target[owner ?? 'neutral'][index]++;
	}
	target.samples++;
}

export function ownershipSnapshot(source: OwnershipAccumulator): Ownership {
	const divisor = source.samples || 1;
	return { black: source.black.map(count => count / divisor), white: source.white.map(count => count / divisor), neutral: source.neutral.map(count => count / divisor), samples: source.samples };
}

/** Estimated current empty-point territory plus existing prisoners; never an agreed final score. */
export function estimateMargin(board: Board, ownership: Ownership, prisoners: { black: number; white: number }, komi: number): number | null {
	if (ownership.samples === 0) return null;
	let difference = prisoners.black - prisoners.white - komi;
	for (let index = 0; index < board.cells.length; index++) {
		if (board.cells[index] === null) difference += ownership.black[index] - ownership.white[index];
	}
	return difference;
}
