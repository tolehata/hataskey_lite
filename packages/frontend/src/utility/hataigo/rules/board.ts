/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type BoardSize = 9 | 13 | 19;
export type Color = 'black' | 'white';
export type Point = { readonly x: number; readonly y: number };
export type Stone = Color | null;
export type Board = { readonly size: BoardSize; readonly cells: readonly Stone[]; readonly hash: string };
export type MoveResult = { ok: true; board: Board; captured: Point[] } | { ok: false; reason: 'occupied' | 'suicide' | 'ko' | 'outOfBoard' | 'notYourTurn' };

function assertSize(size: number): asserts size is BoardSize {
	if (size !== 9 && size !== 13 && size !== 19) throw new RangeError('Unsupported board size');
}

export function isOnBoard(size: number, point: Point): boolean {
	assertSize(size);
	return Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.y >= 0 && point.x < size && point.y < size;
}

export function pointIndex(size: number, point: Point): number {
	if (!isOnBoard(size, point)) throw new RangeError('Point outside board');
	return point.y * size + point.x;
}

export function neighbors(size: number, point: Point): Point[] {
	pointIndex(size, point);
	return [{ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }, { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 }].filter(p => isOnBoard(size, p));
}

export function oppositeColor(color: Color): Color {
	return color === 'black' ? 'white' : 'black';
}

/** Exact key, independent of the compact hash, for repetition checks. */
export function boardKey(board: Board): string {
	return `${board.size}:${board.cells.map(stone => stone === null ? '.' : stone === 'black' ? 'b' : 'w').join('')}`;
}

function snapshot(size: BoardSize, cells: readonly Stone[]): Board {
	const copied = Object.freeze([...cells]);
	let hash = 2166136261;
	for (const character of boardKey({ size, cells: copied, hash: '' })) {
		hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	}
	return Object.freeze({ size, cells: copied, hash: (hash >>> 0).toString(16).padStart(8, '0') });
}

export function createBoard(size: number, setup: { black?: readonly Point[]; white?: readonly Point[] } = {}): Board {
	assertSize(size);
	const cells: Stone[] = Array<Stone>(size * size).fill(null);
	for (const color of ['black', 'white'] as const) {
		for (const point of setup[color] ?? []) {
			const index = pointIndex(size, point);
			if (cells[index] !== null) throw new RangeError('Overlapping setup stones');
			cells[index] = color;
		}
	}
	return snapshot(size, cells);
}

export function getStone(board: Board, point: Point): Stone {
	return board.cells[pointIndex(board.size, point)];
}

export function getGroup(board: Board, point: Point): { stones: Point[]; liberties: Point[] } | null {
	const color = getStone(board, point);
	if (color === null) return null;
	const visited = new Set<number>();
	const liberties = new Map<number, Point>();
	const stones: Point[] = [];
	const pending: Point[] = [{ x: point.x, y: point.y }];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === undefined) break;
		const index = pointIndex(board.size, current);
		if (visited.has(index)) continue;
		visited.add(index);
		stones.push(current);
		for (const neighbor of neighbors(board.size, current)) {
			const stone = getStone(board, neighbor);
			if (stone === null) liberties.set(pointIndex(board.size, neighbor), neighbor);
			else if (stone === color) pending.push(neighbor);
		}
	}
	return { stones, liberties: [...liberties.values()] };
}

/** previousBoard is the position before the opponent's immediately preceding turn. */
export function playMove(board: Board, color: Color, point: Point, previousBoard?: Board): MoveResult {
	if (!isOnBoard(board.size, point)) return { ok: false, reason: 'outOfBoard' };
	if (getStone(board, point) !== null) return { ok: false, reason: 'occupied' };
	const cells = [...board.cells];
	cells[pointIndex(board.size, point)] = color;
	const placed: Board = { size: board.size, cells, hash: '' };
	const captured: Point[] = [];
	for (const neighbor of neighbors(board.size, point)) {
		if (getStone(placed, neighbor) !== oppositeColor(color)) continue;
		const group = getGroup(placed, neighbor);
		if (group === null || group.liberties.length > 0) continue;
		for (const stone of group.stones) {
			cells[pointIndex(board.size, stone)] = null;
			captured.push(stone);
		}
	}
	const ownGroup = getGroup(placed, point);
	if (ownGroup === null || ownGroup.liberties.length === 0) return { ok: false, reason: 'suicide' };
	if (previousBoard && previousBoard.size === board.size && previousBoard.cells.length === cells.length && previousBoard.cells.every((stone, index) => stone === cells[index])) return { ok: false, reason: 'ko' };
	return { ok: true, board: snapshot(board.size, cells), captured };
}

export function toSgfPoint(point: Point, size: number): string {
	pointIndex(size, point);
	return String.fromCharCode(97 + point.x, 97 + point.y);
}

export function fromSgfPoint(value: string, size: number): Point | null {
	assertSize(size);
	if (value === '') return null;
	if (!/^[a-s]{2}$/.test(value)) throw new RangeError('Invalid SGF point');
	const point = { x: value.charCodeAt(0) - 97, y: value.charCodeAt(1) - 97 };
	pointIndex(size, point);
	return point;
}

const DISPLAY_COLUMNS = 'ABCDEFGHJKLMNOPQRST';

export function toDisplayPoint(point: Point, size: number): string {
	pointIndex(size, point);
	return `${DISPLAY_COLUMNS[point.x]}${size - point.y}`;
}

export function fromDisplayPoint(value: string, size: number): Point {
	assertSize(size);
	if (!/^[A-HJ-T][1-9][0-9]?$/.test(value)) throw new RangeError('Invalid display point');
	const point = { x: DISPLAY_COLUMNS.indexOf(value[0]), y: size - Number(value.slice(1)) };
	pointIndex(size, point);
	return point;
}
