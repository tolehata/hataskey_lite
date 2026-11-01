/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Board, Color } from '../rules/board.js';

/**
 * A mutable board for the engine's inner loops. It follows exactly the same rules as rules/board.ts
 * (captures, no suicide, and the previous-board ko check, which for a single move is the single-stone ko),
 * but avoids allocating a frozen snapshot per move. Positions in the search tree stay rules/board.ts boards.
 */
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export type StoneCode = typeof BLACK | typeof WHITE;

interface Geometry { adjacency: Int16Array; degree: Uint8Array; diagonals: Int16Array; diagonalCount: Uint8Array }
const geometries = new Map<number, Geometry>();

function geometryOf(size: number): Geometry {
	const cached = geometries.get(size);
	if (cached) return cached;
	const area = size * size;
	const adjacency = new Int16Array(area * 4);
	const degree = new Uint8Array(area);
	const diagonals = new Int16Array(area * 4);
	const diagonalCount = new Uint8Array(area);
	for (let index = 0; index < area; index++) {
		const x = index % size;
		const y = Math.floor(index / size);
		for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
			if (x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size) adjacency[index * 4 + degree[index]++] = (y + dy) * size + x + dx;
		}
		for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
			if (x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size) diagonals[index * 4 + diagonalCount[index]++] = (y + dy) * size + x + dx;
		}
	}
	const created = { adjacency, degree, diagonals, diagonalCount };
	geometries.set(size, created);
	return created;
}

export function colorCode(color: Color): StoneCode {
	return color === 'black' ? BLACK : WHITE;
}

export function codeColor(code: StoneCode): Color {
	return code === BLACK ? 'black' : 'white';
}

export class FastBoard {
	readonly size: number;
	readonly area: number;
	readonly cells: Uint8Array;
	/** The point the side to move may not take back (single-stone ko), or -1. */
	ko = -1;
	/** The most recent move, or -1 after a pass or when unknown. */
	last = -1;
	/** One liberty seen by the latest liberties() call; meaningful when it returned 1. */
	lastLiberty = -1;
	/** Empty points; the first emptyCount entries are valid. */
	readonly empties: Int16Array;
	emptyCount = 0;
	private readonly emptyAt: Int16Array;
	private readonly geometry: Geometry;
	private readonly mark: Uint32Array;
	private readonly stack: Int16Array;
	private stamp = 0;

	constructor(size: number) {
		this.size = size;
		this.area = size * size;
		this.cells = new Uint8Array(this.area);
		this.empties = new Int16Array(this.area);
		this.emptyAt = new Int16Array(this.area);
		this.geometry = geometryOf(size);
		this.mark = new Uint32Array(this.area);
		this.stack = new Int16Array(this.area);
	}

	/** previousBoard is the position before the opponent's immediately preceding turn, as in playMove. */
	static from(board: Board, toPlay: Color, previousBoard?: Board | null): FastBoard {
		const fast = new FastBoard(board.size);
		for (let index = 0; index < fast.area; index++) {
			const stone = board.cells[index];
			fast.cells[index] = stone === null ? EMPTY : colorCode(stone);
			if (stone === null) fast.addEmpty(index);
		}
		if (previousBoard && previousBoard.cells.length === board.cells.length) {
			const opponent = colorCode(toPlay) === BLACK ? WHITE : BLACK;
			let added = -1;
			let removed = -1;
			let changes = 0;
			for (let index = 0; index < fast.area; index++) {
				const before = previousBoard.cells[index];
				if (before === board.cells[index]) continue;
				changes++;
				if (before === null && fast.cells[index] === opponent) added = index;
				else if (before === toPlay && fast.cells[index] === EMPTY) removed = index;
			}
			if (added >= 0 && changes === 1) fast.last = added;
			// Retaking is forbidden exactly when it would recreate previousBoard: one lone stone that took one stone and has that point as its only liberty.
			if (added >= 0 && removed >= 0 && changes === 2) {
				fast.last = added;
				if (fast.isAdjacent(added, removed) && !fast.hasNeighbor(added, opponent) && fast.liberties(added, 2) === 1) fast.ko = removed;
			}
		}
		return fast;
	}

	private addEmpty(index: number): void {
		this.emptyAt[index] = this.emptyCount;
		this.empties[this.emptyCount++] = index;
	}

	private removeEmpty(index: number): void {
		const slot = this.emptyAt[index];
		const moved = this.empties[--this.emptyCount];
		this.empties[slot] = moved;
		this.emptyAt[moved] = slot;
	}

	/** Reorders the empty list; used to sample without replacement. */
	swapEmpties(first: number, second: number): void {
		const a = this.empties[first];
		const b = this.empties[second];
		this.empties[first] = b;
		this.empties[second] = a;
		this.emptyAt[b] = first;
		this.emptyAt[a] = second;
	}

	private nextStamp(): number {
		if (++this.stamp >= 0xffffffff) { this.mark.fill(0); this.stamp = 1; }
		return this.stamp;
	}

	/** Writes the point and its on-board neighbours into out. */
	withNeighbors(index: number, out: number[]): void {
		const { adjacency, degree } = this.geometry;
		out.length = 0;
		out.push(index);
		for (let k = 0; k < degree[index]; k++) out.push(adjacency[index * 4 + k]);
	}

	private isAdjacent(a: number, b: number): boolean {
		const { adjacency, degree } = this.geometry;
		for (let k = 0; k < degree[a]; k++) if (adjacency[a * 4 + k] === b) return true;
		return false;
	}

	private hasNeighbor(index: number, code: number): boolean {
		const { adjacency, degree } = this.geometry;
		for (let k = 0; k < degree[index]; k++) if (this.cells[adjacency[index * 4 + k]] === code) return true;
		return false;
	}

	/** Counts liberties of the chain at start that are not yet marked, continuing from found and stopping at cap. */
	private collect(start: number, stamp: number, alreadyFound: number, cap: number): number {
		const { adjacency, degree } = this.geometry;
		const code = this.cells[start];
		let found = alreadyFound;
		let top = 0;
		this.stack[top++] = start;
		this.mark[start] = stamp;
		while (top > 0) {
			const current = this.stack[--top];
			for (let k = 0; k < degree[current]; k++) {
				const neighbor = adjacency[current * 4 + k];
				if (this.mark[neighbor] === stamp) continue;
				const cell = this.cells[neighbor];
				if (cell === EMPTY) {
					this.mark[neighbor] = stamp;
					this.lastLiberty = neighbor;
					if (++found >= cap) return found;
				} else if (cell === code) {
					this.mark[neighbor] = stamp;
					this.stack[top++] = neighbor;
				}
			}
		}
		return found;
	}

	/** Liberties of the chain at start, counted only up to cap. */
	liberties(start: number, cap: number): number {
		return this.collect(start, this.nextStamp(), 0, cap);
	}

	isLegal(index: number, code: StoneCode): boolean {
		if (this.cells[index] !== EMPTY || index === this.ko) return false;
		const { adjacency, degree } = this.geometry;
		for (let k = 0; k < degree[index]; k++) {
			const neighbor = adjacency[index * 4 + k];
			const cell = this.cells[neighbor];
			if (cell === EMPTY) return true;
			// A friendly chain keeps a liberty besides this point, or an enemy chain whose only liberty is this point is captured.
			if (cell === code ? this.liberties(neighbor, 2) >= 2 : this.liberties(neighbor, 2) === 1) return true;
		}
		return false;
	}

	/** Plays a legal move and returns the number of captured stones. */
	play(index: number, code: StoneCode): number {
		const { adjacency, degree } = this.geometry;
		const enemy = code === BLACK ? WHITE : BLACK;
		this.cells[index] = code;
		this.removeEmpty(index);
		let captured = 0;
		let capturedAt = -1;
		for (let k = 0; k < degree[index]; k++) {
			const neighbor = adjacency[index * 4 + k];
			if (this.cells[neighbor] === enemy && this.liberties(neighbor, 1) === 0) {
				captured += this.removeChain(neighbor);
				capturedAt = neighbor;
			}
		}
		this.ko = captured === 1 && !this.hasNeighbor(index, code) && this.liberties(index, 2) === 1 ? capturedAt : -1;
		this.last = index;
		return captured;
	}

	pass(): void {
		this.ko = -1;
		this.last = -1;
	}

	private removeChain(start: number): number {
		const { adjacency, degree } = this.geometry;
		const code = this.cells[start];
		let removed = 0;
		let top = 0;
		this.stack[top++] = start;
		this.cells[start] = EMPTY;
		while (top > 0) {
			const current = this.stack[--top];
			this.addEmpty(current);
			removed++;
			for (let k = 0; k < degree[current]; k++) {
				const neighbor = adjacency[current * 4 + k];
				if (this.cells[neighbor] === code) {
					this.cells[neighbor] = EMPTY;
					this.stack[top++] = neighbor;
				}
			}
		}
		return removed;
	}

	/** Same shape test as the original simulation policy: every neighbour friendly, and few hostile diagonals. */
	isTrueEye(index: number, code: StoneCode): boolean {
		if (this.cells[index] !== EMPTY) return false;
		const { adjacency, degree, diagonals, diagonalCount } = this.geometry;
		for (let k = 0; k < degree[index]; k++) if (this.cells[adjacency[index * 4 + k]] !== code) return false;
		const enemy = code === BLACK ? WHITE : BLACK;
		let hostile = 0;
		for (let k = 0; k < diagonalCount[index]; k++) if (this.cells[diagonals[index * 4 + k]] === enemy) hostile++;
		return hostile <= (diagonalCount[index] < 4 ? 0 : 1);
	}

	/**
	 * For a legal move that captures nothing: 0 when the resulting chain is not in atari,
	 * 1 when a lone new stone would be in atari, 2 when it would join friendly stones into a chain in atari.
	 */
	selfAtari(index: number, code: StoneCode): 0 | 1 | 2 {
		const { adjacency, degree } = this.geometry;
		const enemy = code === BLACK ? WHITE : BLACK;
		for (let k = 0; k < degree[index]; k++) {
			const neighbor = adjacency[index * 4 + k];
			if (this.cells[neighbor] === enemy && this.liberties(neighbor, 2) === 1) return 0;
		}
		const stamp = this.nextStamp();
		this.mark[index] = stamp;
		let found = 0;
		let joins = false;
		for (let k = 0; k < degree[index]; k++) {
			const neighbor = adjacency[index * 4 + k];
			if (this.cells[neighbor] === EMPTY && this.mark[neighbor] !== stamp) {
				this.mark[neighbor] = stamp;
				if (++found >= 2) return 0;
			}
		}
		for (let k = 0; k < degree[index]; k++) {
			const neighbor = adjacency[index * 4 + k];
			if (this.cells[neighbor] !== code || this.mark[neighbor] === stamp) continue;
			joins = true;
			found = this.collect(neighbor, stamp, found, 2);
			if (found >= 2) return 0;
		}
		return joins ? 2 : 1;
	}

	/** Area ownership of a finished simulation: stones, and empty regions bordered by one colour only. */
	owners(): (Color | null)[] {
		const { adjacency, degree } = this.geometry;
		const owners = Array<Color | null>(this.area).fill(null);
		const stamp = this.nextStamp();
		for (let index = 0; index < this.area; index++) {
			const cell = this.cells[index];
			if (cell !== EMPTY) { owners[index] = cell === BLACK ? 'black' : 'white'; continue; }
			if (this.mark[index] === stamp) continue;
			let top = 0;
			let borders = 0;
			this.stack[top++] = index;
			this.mark[index] = stamp;
			const region: number[] = [];
			while (top > 0) {
				const current = this.stack[--top];
				region.push(current);
				for (let k = 0; k < degree[current]; k++) {
					const neighbor = adjacency[current * 4 + k];
					const neighborCell = this.cells[neighbor];
					if (neighborCell !== EMPTY) borders |= neighborCell;
					else if (this.mark[neighbor] !== stamp) { this.mark[neighbor] = stamp; this.stack[top++] = neighbor; }
				}
			}
			const owner = borders === BLACK ? 'black' : borders === WHITE ? 'white' : null;
			for (const empty of region) owners[empty] = owner;
		}
		return owners;
	}
}
