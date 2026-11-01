/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { playMove, pointIndex } from '../rules/board.js';
import { FastBoard, colorCode } from './fast-board.js';
import type { Board, Color, Point } from '../rules/board.js';
import type { StoneCode } from './fast-board.js';

export interface SimulationPosition { board: Board; toPlay: Color; previousBoard: Board | null; consecutivePasses: number }
export interface PlayoutResult { owners: (Color | null)[]; winner: Color | 'draw'; moves: number }
export type RandomSource = () => number;

export function createRandom(seed: number): RandomSource {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6D2B79F5) | 0;
		let value = Math.imul(state ^ state >>> 15, 1 | state);
		value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	};
}

function toPoint(board: { size: number }, index: number): Point {
	return { x: index % board.size, y: Math.floor(index / board.size) };
}

/** This local shape check is used only by the simulation move policy. */
export function isTrueEye(board: Board, color: Color, point: Point): boolean {
	return FastBoard.from(board, color).isTrueEye(pointIndex(board.size, point), colorCode(color));
}

/** Only chains with exactly one liberty can nominate a tactical move: taking an enemy chain, or extending an own chain. */
function atariPoints(board: FastBoard, around: number[], out: number[]): number {
	let count = 0;
	for (const start of around) {
		if (board.cells[start] === 0 || board.liberties(start, 2) !== 1) continue;
		const liberty = board.lastLiberty;
		let seen = false;
		for (let cursor = 0; cursor < count; cursor++) if (out[cursor] === liberty) seen = true;
		if (!seen) out[count++] = liberty;
	}
	return count;
}

function fillAll(area: number, out: number[]): void {
	out.length = 0;
	for (let index = 0; index < area; index++) out.push(index);
}

/** Whole-board variant, kept for inspection and tests. */
export function atariMoves(board: Board, color: Color): Point[] {
	const fast = FastBoard.from(board, color);
	const all: number[] = [];
	fillAll(fast.area, all);
	const out: number[] = [];
	const count = atariPoints(fast, all, out);
	return out.slice(0, count).map(index => toPoint(fast, index));
}

/**
 * The simulation policy. Hand-written rules only, used only inside simulations:
 * 1. answer the last move when it left a chain with one liberty (take it, or extend own chain) — never extend into atari again;
 * 2. otherwise a uniformly random legal move that neither fills an own true eye nor joins own stones into a chain in atari;
 * 3. pass when nothing is left.
 */
function choose(board: FastBoard, code: StoneCode, random: RandomSource, around: number[], tactical: number[]): number {
	// Around the last move; the whole board when the last move is unknown (a pass, or the first simulated move).
	if (board.last >= 0) board.withNeighbors(board.last, around);
	else fillAll(board.area, around);
	let count = atariPoints(board, around, tactical);
	while (count > 0) {
		const pick = Math.floor(random() * count);
		const point = tactical[pick];
		if (board.isLegal(point, code) && board.selfAtari(point, code) === 0) return point;
		tactical[pick] = tactical[--count];
	}
	let remaining = board.emptyCount;
	while (remaining > 0) {
		const pick = Math.floor(random() * remaining);
		const point = board.empties[pick];
		if (board.isLegal(point, code) && !board.isTrueEye(point, code) && board.selfAtari(point, code) !== 2) return point;
		board.swapEmpties(pick, --remaining);
	}
	return -1;
}

export function choosePlayoutMove(position: SimulationPosition, random: RandomSource): { point: Point | null; board: Board } {
	const fast = FastBoard.from(position.board, position.toPlay, position.previousBoard);
	const index = choose(fast, colorCode(position.toPlay), random, [], []);
	if (index < 0) return { point: null, board: position.board };
	const point = toPoint(fast, index);
	const moved = playMove(position.board, position.toPlay, point, position.previousBoard ?? undefined);
	if (!moved.ok) throw new Error('Simulation chose an illegal move');
	return { point, board: moved.board };
}

export async function runPlayout(start: SimulationPosition, komi: number, random: RandomSource, checkpoint: () => Promise<boolean>, maxMoves = start.board.size * start.board.size * 4): Promise<PlayoutResult | null> {
	if (!await checkpoint()) return null;
	const board = FastBoard.from(start.board, start.toPlay, start.previousBoard);
	let code = colorCode(start.toPlay);
	let passes = start.consecutivePasses;
	let moves = 0;
	const around: number[] = [];
	const tactical: number[] = [];
	while (passes < 2) {
		if (moves >= maxMoves) return null;
		if (moves > 0 && moves % 64 === 0 && !await checkpoint()) return null;
		const point = choose(board, code, random, around, tactical);
		if (point < 0) { board.pass(); passes++; } else { board.play(point, code); passes = 0; }
		code = code === 1 ? 2 : 1;
		moves++;
	}
	const owners = board.owners();
	let black = 0;
	let white = komi;
	for (const owner of owners) {
		if (owner === 'black') black++;
		else if (owner === 'white') white++;
	}
	return { owners, winner: black === white ? 'draw' : black > white ? 'black' : 'white', moves };
}
