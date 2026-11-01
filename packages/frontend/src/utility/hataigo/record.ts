/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createBoard, fromSgfPoint, getStone, oppositeColor, playMove, toSgfPoint } from './rules/board.js';
import { getHandicapPoints } from './rules/handicap.js';
import { DEFAULT_SGF_LIMITS, readSgf, writeSgf } from './rules/sgf.js';
import type { Board, BoardSize, Color, Point } from './rules/board.js';
import type { SgfFailure, SgfNode, SgfTree, SgfWriteResult } from './rules/sgf.js';

export interface RecordMove {
	readonly color: Color;
	readonly point: Point | null;
}

export interface RecordPosition {
	readonly board: Board;
	readonly toPlay: Color;
	readonly previousBoard: Board | undefined;
	readonly prisoners: { readonly black: number; readonly white: number };
	readonly lastMove: Point | null;
	readonly moveNumber: number;
}

export interface RecordNode {
	readonly id: number;
	readonly parent: number | null;
	readonly children: readonly number[];
	readonly properties: SgfNode['properties'];
	readonly move: RecordMove | null;
	readonly position: RecordPosition;
}

type MutableNode = Omit<RecordNode, 'children'> & { children: number[] };
export type RecordEditResult = { ok: true; node: RecordNode; reused: boolean } | { ok: false; reason: 'occupied' | 'suicide' | 'ko' | 'outOfBoard' | 'notYourTurn' | 'limitExceeded' };
export type RecordImportResult = { ok: true; records: LocalRecord[] } | SgfFailure | { ok: false; error: { code: 'illegalMove'; message: string; offset: number } };

function decodedPoint(value: string, size: BoardSize): Point {
	const result = fromSgfPoint(value, size);
	if (result === null) throw new RangeError('Setup cannot contain a pass.');
	return result;
}

function applyNode(previous: RecordPosition, properties: SgfNode['properties']): { position: RecordPosition; move: RecordMove | null } {
	let board = previous.board;
	let previousBoard = previous.previousBoard;
	let toPlay = properties.PL?.[0] === 'B' ? 'black' as const : properties.PL?.[0] === 'W' ? 'white' as const : previous.toPlay;
	const hasSetup = properties.AB !== undefined || properties.AW !== undefined || properties.AE !== undefined || properties.PL !== undefined;
	if (hasSetup) {
		const cells = [...board.cells];
		for (const key of ['AE', 'AB', 'AW'] as const) {
			for (const value of properties[key] ?? []) {
				const point = decodedPoint(value, board.size);
				cells[point.y * board.size + point.x] = key === 'AB' ? 'black' : key === 'AW' ? 'white' : null;
			}
		}
		const black: Point[] = [];
		const white: Point[] = [];
		cells.forEach((stone, index) => {
			if (stone === 'black') black.push({ x: index % board.size, y: Math.floor(index / board.size) });
			else if (stone === 'white') white.push({ x: index % board.size, y: Math.floor(index / board.size) });
		});
		board = createBoard(board.size, { black, white });
		previousBoard = undefined;
	}
	const color = properties.B !== undefined ? 'black' : properties.W !== undefined ? 'white' : null;
	if (color === null) return { position: { ...previous, board, previousBoard, toPlay, lastMove: hasSetup ? null : previous.lastMove }, move: null };
	const point = fromSgfPoint((color === 'black' ? properties.B : properties.W)?.[0] ?? '', board.size);
	const applied = point === null ? { ok: true as const, board, captured: [] as Point[] } : playMove(board, color, point, previousBoard);
	if (!applied.ok) throw new RangeError(applied.reason);
	toPlay = oppositeColor(color);
	return {
		move: { color, point },
		position: {
			board: applied.board, toPlay, previousBoard: point === null ? undefined : board,
			prisoners: { ...previous.prisoners, [color]: previous.prisoners[color] + applied.captured.length },
			lastMove: point, moveNumber: previous.moveNumber + 1,
		},
	};
}

/** A local analysis record. SGF moves are replayed in their recorded colors;
 * new moves alternate from the current position. Passes may be followed by
 * further analysis moves; this is not the lifecycle of a competitive game.
 * The virtual node 0 precedes SGF's root, including a root containing a move.
 */
export class LocalRecord {
	private nodes = new Map<number, MutableNode>();
	private selected = new Map<number, number>();
	private nextId = 1;
	private cursorId = 0;
	readonly size: BoardSize;
	readonly komi: number;
	readonly handicap: number;

	constructor(tree: SgfTree) {
		const root = tree.sequence[0].properties;
		this.size = Number(root.SZ?.[0] ?? 19) as BoardSize;
		this.komi = Number(root.KM?.[0] ?? 6.5);
		this.handicap = Number(root.HA?.[0] ?? 0);
		const toPlay = root.PL?.[0] === 'B' ? 'black' : root.PL?.[0] === 'W' || this.handicap >= 2 ? 'white' : 'black';
		this.nodes.set(0, {
			id: 0, parent: null, children: [], properties: {}, move: null,
			position: { board: createBoard(this.size), toPlay, previousBoard: undefined, prisoners: { black: 0, white: 0 }, lastMove: null, moveNumber: 0 },
		});
		// Put a root move after the metadata so move zero always shows the
		// initial position and new alternatives cannot bypass the SGF root.
		const rootMove = root.B !== undefined ? { B: root.B.slice() } : root.W !== undefined ? { W: root.W.slice() } : null;
		const rootProperties = { ...root };
		delete rootProperties.B;
		delete rootProperties.W;
		const normalizedRoot = rootMove === null ? tree : { ...tree, sequence: [{ properties: rootProperties }, { properties: rootMove }, ...tree.sequence.slice(1)] };
		const pending = [{ tree: normalizedRoot, parent: 0 }];
		while (pending.length > 0) {
			const item = pending[pending.length - 1];
			pending.pop();
			let parent = item.parent;
			for (const source of item.tree.sequence) {
				const properties = Object.fromEntries(Object.entries(source.properties).map(([key, values]) => [key, values?.slice()]));
				const applied = applyNode(this.node(parent).position, properties);
				const node = this.append(parent, properties, applied);
				parent = node.id;
			}
			for (let i = item.tree.variations.length - 1; i >= 0; i--) pending.push({ tree: item.tree.variations[i], parent });
		}
		this.first();
	}

	private append(parent: number, properties: SgfNode['properties'], applied: { position: RecordPosition; move: RecordMove | null }): MutableNode {
		if (this.nextId > DEFAULT_SGF_LIMITS.maxNodes) throw new RangeError('limitExceeded');
		const id = this.nextId++;
		const node: MutableNode = { id, parent, children: [], properties, ...applied };
		this.nodes.set(id, node);
		const parentNode = this.nodes.get(parent);
		if (parentNode === undefined) throw new RangeError('Unknown record parent.');
		parentNode.children.push(id);
		if (!this.selected.has(parent)) this.selected.set(parent, id);
		return node;
	}

	node(id: number): RecordNode {
		const node = this.nodes.get(id);
		if (node === undefined) throw new RangeError('Unknown record node.');
		return node;
	}

	get current(): RecordNode {
		return this.node(this.cursorId);
	}

	/** The chosen continuation, including setup/comment nodes and virtual root. */
	get line(): readonly RecordNode[] {
		const result: RecordNode[] = [];
		let next: number | undefined = 0;
		while (next !== undefined) {
			const node = this.node(next);
			result.push(node);
			next = this.selected.get(node.id) ?? node.children.at(0);
		}
		return result;
	}

	get moves(): readonly (RecordMove & { id: number; number: number })[] {
		return this.line.flatMap(node => node.move === null ? [] : [{ ...node.move, id: node.id, number: node.position.moveNumber }]);
	}

	get total(): number {
		return this.line.at(-1)?.position.moveNumber ?? 0;
	}

	jump(id: number): boolean {
		if (!this.nodes.has(id)) return false;
		let child = this.node(id);
		while (child.parent !== null) {
			this.selected.set(child.parent, child.id);
			child = this.node(child.parent);
		}
		this.cursorId = id;
		return true;
	}

	jumpToMove(number: number): boolean {
		if (!Number.isSafeInteger(number) || number < 0 || number > this.total) return false;
		const candidate = this.line.filter(node => node.position.moveNumber <= number).at(-1);
		return candidate === undefined ? false : this.jump(candidate.id);
	}

	first(): boolean {
		return this.jumpToMove(0);
	}

	previous(): boolean {
		return this.current.position.moveNumber > 0 && this.jumpToMove(this.current.position.moveNumber - 1);
	}

	next(): boolean {
		return this.current.position.moveNumber < this.total && this.jumpToMove(this.current.position.moveNumber + 1);
	}

	last(): boolean {
		return this.jumpToMove(this.total);
	}

	chooseVariation(parent: number, child: number): boolean {
		if (!this.nodes.has(parent) || !this.node(parent).children.includes(child)) return false;
		this.selected.set(parent, child);
		return this.jump(child);
	}

	get branches(): readonly { parent: number; number: number; options: readonly RecordNode[]; selected: number | undefined }[] {
		return this.line.filter(node => node.children.length > 1).map(node => ({ parent: node.id, number: node.position.moveNumber, options: node.children.map(id => this.node(id)), selected: this.selected.get(node.id) }));
	}

	play(point: Point | null): RecordEditResult {
		const parent = this.current;
		const color = parent.position.toPlay;
		const move = point === null ? '' : toSgfPointSafe(point, this.size);
		if (move === undefined) return { ok: false, reason: 'outOfBoard' };
		const key = color === 'black' ? 'B' : 'W';
		const existing = parent.children.map(id => this.node(id)).find(node => node.properties[key]?.[0] === move);
		if (existing !== undefined) {
			this.jump(existing.id);
			return { ok: true, node: existing, reused: true };
		}
		if (this.nextId > DEFAULT_SGF_LIMITS.maxNodes) return { ok: false, reason: 'limitExceeded' };
		const applied = point === null ? { ok: true as const, board: parent.position.board, captured: [] } : playMove(parent.position.board, color, point, parent.position.previousBoard);
		if (!applied.ok) return applied;
		const properties = { [key]: [move] };
		const node = this.append(parent.id, properties, applyNode(parent.position, properties));
		this.jump(node.id);
		return { ok: true, node, reused: false };
	}

	recentNumbers(count = 10): { point: Point; number: number }[] {
		const found = new Map<string, { point: Point; number: number }>();
		for (const move of this.moves) {
			if (move.number > this.current.position.moveNumber) break;
			if (move.point !== null && move.number > this.current.position.moveNumber - count && getStone(this.current.position.board, move.point) === move.color) {
				found.set(`${move.point.x},${move.point.y}`, { point: move.point, number: move.number });
			}
		}
		return [...found.values()];
	}

	/** Compact adjacent single-child nodes into SGF sequences. */
	toSgf(): SgfTree {
		const sourceRoot = this.node(0).children.at(0);
		if (sourceRoot === undefined) throw new RangeError('Empty record.');
		const root: SgfTree = { sequence: [], variations: [] };
		const pending = [{ start: sourceRoot, target: root }];
		while (pending.length > 0) {
			const item = pending[pending.length - 1];
			pending.pop();
			let node = this.node(item.start);
			let next: number | undefined = item.start;
			while (next !== undefined) {
				node = this.node(next);
				item.target.sequence.push({ properties: Object.fromEntries(Object.entries(node.properties).map(([key, value]) => [key, value?.slice()])) });
				next = node.children.length === 1 ? node.children[0] : undefined;
			}
			for (const child of node.children) {
				const target: SgfTree = { sequence: [], variations: [] };
				item.target.variations.push(target);
				pending.push({ start: child, target });
			}
		}
		return root;
	}
}

function toSgfPointSafe(point: Point, size: BoardSize): string | undefined {
	try {
		return toSgfPoint(point, size);
	} catch {
		return undefined;
	}
}

export function createRecord(options: { size?: BoardSize; handicap?: number; komi?: number } = {}): LocalRecord {
	const size = options.size ?? 19;
	const handicap = options.handicap ?? 0;
	const properties: SgfNode['properties'] = { FF: ['4'], GM: ['1'], CA: ['UTF-8'], RU: ['Japanese'], SZ: [String(size)], KM: [String(handicap === 0 ? options.komi ?? 6.5 : 0)] };
	if (handicap !== 0) {
		properties.HA = [String(handicap)];
		properties.AB = getHandicapPoints(size, handicap).map(point => toSgfPoint(point, size));
	}
	return new LocalRecord({ sequence: [{ properties }], variations: [] });
}

export function importRecord(input: unknown): RecordImportResult {
	const parsed = readSgf(input);
	if (!parsed.ok) return parsed;
	try {
		return { ok: true, records: parsed.trees.map(tree => new LocalRecord(tree)) };
	} catch (error) {
		return { ok: false, error: { code: 'illegalMove', message: error instanceof Error ? error.message : 'Invalid record position.', offset: 0 } };
	}
}

export function exportRecord(records: readonly LocalRecord[], includeComments = false): SgfWriteResult {
	return writeSgf(records.map(record => record.toSgf()), { includeComments });
}

/** Timer injection keeps playback deterministic in tests and outside the DOM. */
export class RecordPlayback {
	private timer: unknown;
	private active = false;
	private generation = 0;

	constructor(private options: { advance: () => boolean; interval: () => number; schedule: (callback: () => void, delay: number) => unknown; cancel: (handle: unknown) => void; changed?: (playing: boolean) => void }) {}

	get playing(): boolean {
		return this.active;
	}

	start(): void {
		if (this.active) return;
		this.active = true;
		this.options.changed?.(true);
		this.queue();
	}

	stop(): void {
		this.active = false;
		this.generation++;
		if (this.timer !== undefined) this.options.cancel(this.timer);
		this.timer = undefined;
		this.options.changed?.(false);
	}

	private queue(): void {
		const generation = this.generation;
		const interval = this.options.interval();
		this.timer = this.options.schedule(() => {
			if (!this.active || generation !== this.generation) return;
			this.timer = undefined;
			if (!this.options.advance()) this.stop();
			else this.queue();
		}, Number.isFinite(interval) ? Math.max(100, Math.min(10000, interval)) : 1000);
	}
}
