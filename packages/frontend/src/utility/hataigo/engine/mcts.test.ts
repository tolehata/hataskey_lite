/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test } from 'vitest';
import { boardKey, createBoard, playMove } from '../rules/board.js';
import { UCB_EXPLORATION, expandNode, rankCandidates, searchPosition, ucb1 } from './mcts.js';
import { AI_LEVELS, getLevelBudget } from './levels.js';
import type { SearchNode } from './mcts.js';

test('full expansion exactly matches all canonical legal moves plus pass, with visit statistics only', async () => {
	const board = createBoard(9, { black: [{ x: 1, y: 0 }], white: [{ x: 0, y: 0 }] });
	const node: SearchNode = { board, toPlay: 'black', previousBoard: null, consecutivePasses: 0, visits: 0, edges: null };
	expect(await expandNode(node, async () => true)).toBe(true);
	const legal = board.cells.flatMap((_, index) => playMove(board, 'black', { x: index % 9, y: Math.floor(index / 9) }).ok ? [index] : []);
	expect(node.edges?.length).toBe(legal.length + 1);
	for (const edge of node.edges ?? []) expect(Object.keys(edge).sort()).toEqual(['point', 'visits', 'wins']);
	expect(node.edges?.some(edge => edge.point === null)).toBe(true);
});

test('interrupted expansion never publishes a partial set of edges', async () => {
	const node: SearchNode = { board: createBoard(9), toPlay: 'black', previousBoard: null, consecutivePasses: 0, visits: 0, edges: null };
	let calls = 0;
	expect(await expandNode(node, async () => ++calls < 5)).toBe(false);
	expect(node.edges).toBeNull();
});

test('UCB1 uses empirical wins and exploration, with unvisited edges first', () => {
	expect(ucb1(0, 0, 1)).toBe(Infinity);
	expect(ucb1(5, 10, 100)).toBeCloseTo(0.5 + UCB_EXPLORATION * Math.sqrt(Math.log(100) / 10));
});

test('a bounded search returns a legal move and never mutates its position', async () => {
	const board = createBoard(9);
	const before = boardKey(board);
	const result = await searchPosition({ board, toPlay: 'black', komi: 6.5, seed: 1, budget: { maxPlayouts: 2, maxMs: 250 } });
	expect(result.attempts).toBeLessThanOrEqual(2);
	expect(result.move === null || playMove(board, 'black', result.move).ok).toBe(true);
	expect(result.ownership.samples).toBe(result.playouts);
	expect(boardKey(board)).toBe(before);
});

test('cancelled or timed-out work contributes no partial ownership samples', async () => {
	const input = { board: createBoard(9), toPlay: 'black' as const, komi: 0, budget: { maxPlayouts: 10, maxMs: 100 } };
	const cancelled = await searchPosition(input, { shouldStop: () => true });
	expect(cancelled.stopped).toBe('cancelled');
	expect(cancelled.playouts).toBe(0);
	expect(cancelled.estimatedMargin).toBeNull();
	// The fake clock ticks once per call; root expansion checks once per row, so a short budget runs out while expanding.
	let time = 0;
	const timed = await searchPosition({ ...input, budget: { maxPlayouts: 10, maxMs: 5 } }, { now: () => time++ });
	expect(timed.elapsedMs).toBeGreaterThanOrEqual(5);
	expect(timed.attempts).toBe(0);
	expect(timed.playouts).toBe(0);
});

test('macrotask yielding allows a pending cancellation to be observed', async () => {
	let time = 0;
	let cancelled = false;
	const result = await searchPosition({ board: createBoard(19), toPlay: 'black', komi: 0, budget: { maxPlayouts: 10, maxMs: 10000 } }, { now: () => ++time, yieldControl: async () => { cancelled = true; }, shouldStop: () => cancelled });
	expect(result.stopped).toBe('cancelled');
	expect(result.attempts).toBe(0);
});

test('level descriptions use budgets, and all nine-line time limits stay under two seconds', () => {
	for (const level of AI_LEVELS) expect(level.budget[9].maxMs).toBeLessThanOrEqual(2000);
	expect(getLevelBudget('unknown', 19)).toEqual(getLevelBudget('balanced', 19));
});

test('UCT selects the immediate capture in a self-authored two-choice tactical position', async () => {
	const black: { x: number; y: number }[] = [];
	for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
		if (!(y === 0 && x >= 1 && x <= 3)) black.push({ x, y });
	}
	const board = createBoard(9, { black, white: [{ x: 2, y: 0 }, { x: 3, y: 0 }] });
	const result = await searchPosition({ board, toPlay: 'black', komi: 6.5, seed: 23, budget: { maxPlayouts: 64, maxMs: 2000 } });
	expect(result.move).toEqual({ x: 1, y: 0 });
	expect(result.candidates[0].visits).toBeGreaterThan(result.candidates[1].visits);
	expect(result.playouts).toBe(64);
});

test('ties in visits go to the higher win rate, so a shallow search does not just take the first corner point', () => {
	const ranked = rankCandidates([
		{ point: { x: 0, y: 0 }, visits: 1, winRate: 0 },
		{ point: { x: 4, y: 4 }, visits: 1, winRate: 1 },
		{ point: { x: 2, y: 2 }, visits: 3, winRate: 0.2 },
		{ point: { x: 8, y: 8 }, visits: 0, winRate: null },
	]);
	expect(ranked.map(candidate => candidate.point)).toEqual([{ x: 2, y: 2 }, { x: 4, y: 4 }, { x: 0, y: 0 }, { x: 8, y: 8 }]);
});
