/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { oppositeColor, playMove } from '../rules/board.js';
import { addOwnership, createOwnershipAccumulator, estimateMargin, ownershipSnapshot } from './ownership.js';
import { FastBoard, colorCode } from './fast-board.js';
import { createRandom, runPlayout } from './playout.js';
import type { Board, Color, Point } from '../rules/board.js';
import type { Ownership } from './ownership.js';
import type { SimulationPosition } from './playout.js';

export interface SearchBudget { maxPlayouts: number; maxMs: number }
export interface SearchInput {
	board: Board;
	toPlay: Color;
	previousBoard?: Board | null;
	consecutivePasses?: number;
	komi: number;
	prisoners?: { black: number; white: number };
	budget: SearchBudget;
	seed?: number;
}
export interface SearchCandidate { point: Point | null; visits: number; winRate: number | null }
export interface SearchResult {
	move: Point | null;
	candidates: SearchCandidate[];
	playouts: number;
	attempts: number;
	elapsedMs: number;
	ownership: Ownership;
	estimatedMargin: number | null;
	stopped: 'budget' | 'cancelled' | 'complete';
}
export interface SearchHooks {
	shouldStop?: () => boolean;
	yieldControl?: () => Promise<void>;
	now?: () => number;
	onProgress?: (result: SearchResult) => void;
	/** Test/measurement hook; production uses UCB_EXPLORATION. */
	explorationConstant?: number;
}
export interface SearchEdge { point: Point | null; visits: number; wins: number; child?: SearchNode }
export interface SearchNode extends SimulationPosition { visits: number; edges: SearchEdge[] | null }
/** Hand-tuned against √2 by self-play (9路, 32 games: 30 wins); 0.25 and 0.15 were not better. */
export const UCB_EXPLORATION = 0.4;

/** いちばん多く読んだ手を先頭に。読んだ回数が同じなら勝率の高い手を先に（読みが浅いと同点が多く、先頭の隅の手を選んでしまうため） */
export function rankCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
	return [...candidates].sort((a, b) => b.visits - a.visits || (b.winRate ?? -1) - (a.winRate ?? -1));
}

export function ucb1(wins: number, visits: number, parentVisits: number, exploration = UCB_EXPLORATION): number {
	return visits === 0 ? Infinity : wins / visits + exploration * Math.sqrt(Math.log(Math.max(1, parentVisits)) / visits);
}

/** Every legal board move and pass is added before the node can be selected. */
export async function expandNode(node: SearchNode, checkpoint: () => Promise<boolean>): Promise<boolean> {
	if (node.edges !== null) return true;
	const edges: SearchEdge[] = [];
	// The same legality as playMove (the tests compare both), without building a board per candidate.
	const fast = FastBoard.from(node.board, node.toPlay, node.previousBoard);
	const code = colorCode(node.toPlay);
	for (let index = 0; index < node.board.cells.length; index++) {
		if (index % node.board.size === 0 && !await checkpoint()) return false;
		if (fast.isLegal(index, code)) edges.push({ point: { x: index % node.board.size, y: Math.floor(index / node.board.size) }, visits: 0, wins: 0 });
	}
	edges.push({ point: null, visits: 0, wins: 0 });
	node.edges = edges;
	return true;
}

function nextPosition(parent: SearchNode, edge: SearchEdge): SearchNode {
	let board = parent.board;
	if (edge.point !== null) {
		const moved = playMove(board, parent.toPlay, edge.point, parent.previousBoard ?? undefined);
		if (!moved.ok) throw new Error('Expanded move became invalid');
		board = moved.board;
	}
	return { board, toPlay: oppositeColor(parent.toPlay), previousBoard: edge.point === null ? null : parent.board, consecutivePasses: edge.point === null ? parent.consecutivePasses + 1 : 0, visits: 0, edges: null };
}

export async function searchPosition(input: SearchInput, hooks: SearchHooks = {}): Promise<SearchResult> {
	if (!Number.isSafeInteger(input.budget.maxPlayouts) || input.budget.maxPlayouts < 1 || input.budget.maxPlayouts > 100000 || !Number.isFinite(input.budget.maxMs) || input.budget.maxMs < 1 || input.budget.maxMs > 10000 || !Number.isFinite(input.komi)) throw new RangeError('Invalid search budget or komi');
	const toPlay: unknown = input.toPlay;
	if (toPlay !== 'black' && toPlay !== 'white') throw new RangeError('Invalid search color');
	if (!Number.isInteger(input.consecutivePasses ?? 0) || (input.consecutivePasses ?? 0) < 0 || (input.consecutivePasses ?? 0) > 2) throw new RangeError('Invalid pass count');
	if (hooks.explorationConstant !== undefined && (!Number.isFinite(hooks.explorationConstant) || hooks.explorationConstant < 0)) throw new RangeError('Invalid exploration constant');
	const now = hooks.now ?? Date.now;
	const started = now();
	const deadline = started + input.budget.maxMs;
	const random = createRandom(input.seed ?? started);
	const root: SearchNode = { board: input.board, toPlay: input.toPlay, previousBoard: input.previousBoard ?? null, consecutivePasses: input.consecutivePasses ?? 0, visits: 0, edges: null };
	const ownership = createOwnershipAccumulator(input.board.cells.length);
	let attempts = 0;
	let ticks = 0;
	let lastYield = started;
	let lastProgress = started;
	let reason: SearchResult['stopped'] = 'budget';
	let fallback: Point | null = null;
	const snapshot = (): SearchResult => {
		const candidates = rankCandidates((root.edges ?? []).map(edge => ({ point: edge.point === null ? null : { ...edge.point }, visits: edge.visits, winRate: edge.visits === 0 ? null : edge.wins / edge.visits })));
		const estimate = ownershipSnapshot(ownership);
		return { move: candidates[0]?.visits ? candidates[0].point : fallback, candidates: candidates.slice(0, 3), playouts: ownership.samples, attempts, elapsedMs: Math.max(0, now() - started), ownership: estimate, estimatedMargin: estimateMargin(input.board, estimate, input.prisoners ?? { black: 0, white: 0 }, input.komi), stopped: reason };
	};
	const checkpoint = async (): Promise<boolean> => {
		if (hooks.shouldStop?.()) { reason = 'cancelled'; return false; }
		if (now() >= deadline) return false;
		ticks++;
		if (ticks % 16 === 0 && now() - lastYield >= 8) {
			await (hooks.yieldControl?.() ?? Promise.resolve());
			lastYield = now();
			if (hooks.shouldStop?.()) { reason = 'cancelled'; return false; }
			if (lastYield >= deadline) return false;
		}
		if (now() - lastProgress >= 150) { hooks.onProgress?.(snapshot()); lastProgress = now(); }
		return true;
	};
	if (!await expandNode(root, checkpoint)) return snapshot();
	const initialEdges = root.edges ?? [];
	fallback = initialEdges[Math.floor(random() * initialEdges.length)]?.point ?? null;
	while (attempts < input.budget.maxPlayouts && await checkpoint()) {
		attempts++;
		let node = root;
		const path: { node: SearchNode; edge: SearchEdge }[] = [];
		while (node.consecutivePasses < 2) {
			if (!await expandNode(node, checkpoint)) return snapshot();
			const edges = node.edges ?? [];
			let best: SearchEdge | undefined;
			let bestScore = -Infinity;
			const offset = Math.floor(random() * edges.length);
			for (let index = 0; index < edges.length; index++) {
				const edge = edges[(index + offset) % edges.length];
				const score = ucb1(edge.wins, edge.visits, node.visits, hooks.explorationConstant);
				if (score > bestScore) { best = edge; bestScore = score; }
			}
			if (!best) throw new Error('Expanded node has no pass');
			path.push({ node, edge: best });
			best.child ??= nextPosition(node, best);
			node = best.child;
			if (best.visits === 0) break;
		}
		const result = await runPlayout(node, input.komi, random, checkpoint);
		if (!result) continue;
		addOwnership(ownership, result.owners);
		node.visits++;
		for (const step of path) {
			step.node.visits++;
			step.edge.visits++;
			step.edge.wins += result.winner === 'draw' ? 0.5 : result.winner === step.node.toPlay ? 1 : 0;
		}
		if (root.consecutivePasses >= 2) { reason = 'complete'; break; }
	}
	return snapshot();
}
