/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { isOnBoard, neighbors, oppositeColor, pointIndex } from './board.js';
import type { Board, Color, Point } from './board.js';

export interface Prisoners {
	/** Stones captured by Black / White, before the agreed dead stones are removed. */
	readonly black: number;
	readonly white: number;
}

export interface ScoringMarks {
	readonly deadStones: readonly Point[];
	readonly neutralPoints: readonly Point[];
}

export interface ScoreResult {
	readonly black: { readonly territory: number; readonly prisoners: number; readonly deadStones: number; readonly total: number };
	readonly white: { readonly territory: number; readonly prisoners: number; readonly deadStones: number; readonly komi: number; readonly total: number };
	readonly winner: Color | 'draw';
	readonly margin: number;
	readonly territory: { readonly black: readonly Point[]; readonly white: readonly Point[]; readonly neutral: readonly Point[] };
}

/** Japanese territory scoring from caller-agreed marks; does not determine whether stones live. */
export function scoreJapanese(board: Board, marks: ScoringMarks, prisoners: Prisoners, komi: number): ScoreResult {
	if (!Number.isFinite(komi) || !Number.isSafeInteger(prisoners.black) || prisoners.black < 0 || !Number.isSafeInteger(prisoners.white) || prisoners.white < 0) {
		throw new RangeError('Invalid score parameters');
	}
	const cells = [...board.cells];
	const removed = { black: 0, white: 0 };
	const dead = pointSet(board, marks.deadStones);
	for (const index of dead) {
		const color = cells[index];
		if (color === null) throw new RangeError('A dead-stone mark must refer to a stone');
		removed[oppositeColor(color)]++;
		cells[index] = null;
	}
	const neutral = pointSet(board, marks.neutralPoints);
	for (const index of neutral) {
		if (cells[index] !== null) throw new RangeError('A neutral mark must refer to an empty point after removal');
	}
	const visited = new Set<number>();
	const territory: { black: Point[]; white: Point[]; neutral: Point[] } = { black: [], white: [], neutral: [] };
	for (let index = 0; index < cells.length; index++) {
		if (cells[index] !== null || visited.has(index)) continue;
		const region: number[] = [index];
		const borders = new Set<Color>();
		visited.add(index);
		for (let cursor = 0; cursor < region.length; cursor++) {
			const current = region[cursor];
			for (const point of neighbors(board.size, { x: current % board.size, y: Math.floor(current / board.size) })) {
				const adjacent = pointIndex(board.size, point);
				const color = cells[adjacent];
				if (color !== null) {
					borders.add(color);
				} else if (!visited.has(adjacent)) {
					visited.add(adjacent);
					region.push(adjacent);
				}
			}
		}
		const owner = borders.size === 1 ? [...borders][0] : null;
		for (const empty of region) {
			const point = { x: empty % board.size, y: Math.floor(empty / board.size) };
			territory[owner !== null && !neutral.has(empty) ? owner : 'neutral'].push(point);
		}
	}
	const blackPrisoners = prisoners.black + removed.black;
	const whitePrisoners = prisoners.white + removed.white;
	const blackTotal = territory.black.length + blackPrisoners;
	const whiteTotal = territory.white.length + whitePrisoners + komi;
	return {
		black: { territory: territory.black.length, prisoners: blackPrisoners, deadStones: removed.black, total: blackTotal },
		white: { territory: territory.white.length, prisoners: whitePrisoners, deadStones: removed.white, komi, total: whiteTotal },
		winner: blackTotal === whiteTotal ? 'draw' : blackTotal > whiteTotal ? 'black' : 'white',
		margin: Math.abs(blackTotal - whiteTotal),
		territory,
	};
}

function pointSet(board: Board, points: readonly Point[]): Set<number> {
	const indexes = new Set<number>();
	for (const point of points) {
		if (!isOnBoard(board.size, point)) throw new RangeError('Scoring mark outside board');
		indexes.add(pointIndex(board.size, point));
	}
	return indexes;
}
