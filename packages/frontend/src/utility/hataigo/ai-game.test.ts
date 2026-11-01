/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it, vi } from 'vitest';
import { AiGameSession, ownershipMarks } from './ai-game.js';
import type { AiSearchClient } from './ai-game.js';
import type { SearchResult } from './engine/client.js';
import type { Point } from './rules/board.js';

function result(point: Point | null = null): SearchResult {
	return { move: point, candidates: [{ point, visits: 1, winRate: 0.5 }], playouts: 1, attempts: 1, elapsedMs: 1, stopped: 'budget', estimatedMargin: 0, ownership: { black: Array(81).fill(0), white: Array(81).fill(0), neutral: Array(81).fill(1), samples: 1 } };
}

function game(moves: (Point | null)[] = [], ownColor: 'black' | 'white' = 'black') {
	const client: AiSearchClient = { search: vi.fn(async () => result(moves.shift() ?? null)), cancel: vi.fn(), dispose: vi.fn() };
	const factory = vi.fn(() => client);
	const session = new AiGameSession({ id: 'test-game', size: 9, handicap: 0, ownColor, level: 'quick' }, factory);
	return { session, client, factory };
}

describe('local AI game behavior', () => {
	it('plays legal human and AI moves and blocks another human move during thought', async () => {
		let resolve: (value: SearchResult) => void = () => {};
		const { session, client } = game();
		vi.mocked(client.search).mockImplementation(() => new Promise(res => { resolve = res; }));
		const pending = session.play({ x: 0, y: 0 });
		expect(session.busy).toBe(true);
		expect(session.state.moves).toHaveLength(1);
		expect(await session.play({ x: 1, y: 0 })).toEqual({ ok: false, reason: 'notYourTurn' });
		resolve(result({ x: 8, y: 8 }));
		await pending;
		expect(session.state.moves).toHaveLength(2);
		expect(session.canPlay).toBe(true);
	});

	it('keeps what the AI compared for its last move, and drops it when that move is undone', async () => {
		const { session } = game([{ x: 8, y: 8 }]);
		await session.play({ x: 0, y: 0 });
		expect(session.analysis).toBeNull();
		expect(session.lastAiThought?.moveNumber).toBe(2);
		expect(session.lastAiThought?.result.move).toEqual({ x: 8, y: 8 });
		session.undo();
		expect(session.lastAiThought).toBeNull();
	});

	it('undoes exactly one move and pauses instead of immediately replacing the AI move', async () => {
		const { session, client } = game([{ x: 8, y: 8 }, { x: 7, y: 8 }]);
		await session.play({ x: 0, y: 0 });
		expect(session.undo()).toBe(true);
		expect(session.state.moves).toHaveLength(1);
		expect(session.state.toPlay).toBe('white');
		expect(session.paused).toBe(true);
		await Promise.resolve();
		expect(client.search).toHaveBeenCalledTimes(1);
		await session.resume();
		expect(session.state.moves).toHaveLength(2);
		expect(session.state.moves[1].point).toEqual({ x: 7, y: 8 });
	});

	it('ignores a stale result after cancel and keeps the human position intact', async () => {
		let resolve: (value: SearchResult) => void = () => {};
		const { session, client } = game();
		vi.mocked(client.search).mockImplementation(() => new Promise(res => { resolve = res; }));
		const pending = session.play({ x: 0, y: 0 });
		session.cancel();
		resolve(result({ x: 8, y: 8 }));
		await pending;
		expect(session.state.moves).toHaveLength(1);
		expect(session.paused).toBe(true);
		expect(session.busy).toBe(false);
	});

	it('disposes an inactive worker and only recreates one on explicit resume', async () => {
		const { session, factory, client } = game([], 'white');
		await session.resume();
		expect(factory).toHaveBeenCalledTimes(1);
		session.deactivate();
		expect(client.dispose).toHaveBeenCalledTimes(1);
		session.activate();
		expect(factory).toHaveBeenCalledTimes(1);
		expect(session.paused).toBe(true);
	});

	it('uses fixed handicap and zero komi with White first', () => {
		const session = new AiGameSession({ id: 'handicap', size: 13, handicap: 5, ownColor: 'white', level: 'quick' }, () => game().client);
		expect(session.state.board.cells.filter(stone => stone === 'black')).toHaveLength(5);
		expect(session.state.toPlay).toBe('white');
		expect(session.state.komi).toBe(0);
	});

	it('finishes by explicit resignation and produces only private result metadata', () => {
		const { session } = game();
		expect(session.resign()).toBe(true);
		expect(session.state.result).toEqual({ reason: 'resign', winner: 'white' });
		expect(session.finishedRecord('2026-10-20T00:00:00.000Z')).toEqual({ id: 'test-game', size: 9, ownColor: 'black', winner: 'white', reason: 'resign', endedAt: '2026-10-20T00:00:00.000Z' });
		expect(session.undo()).toBe(false);
	});

	it('keeps two-pass scoring unfinished despite an ownership draft until the user confirms', async () => {
		const { session, client } = game();
		await session.play(null);
		expect(session.state.phase).toBe('scoring');
		expect(session.state.result).toBeNull();
		const draft = result();
		draft.estimatedMargin = 80;
		draft.ownership.black.fill(1);
		vi.mocked(client.search).mockResolvedValue(draft);
		await session.analyze('estimate');
		expect(session.state.scoring.deadStones).toEqual([]);
		expect(session.state.scoring.neutralPoints).toEqual([]);
		expect(session.state.phase).toBe('scoring');
		expect(session.confirmScore()).toBe(true);
		expect(session.state.phase).toBe('finished');
		expect(session.state.result?.winner).toBe('white');
		expect(session.state.result?.score?.white.komi).toBe(6.5);
		expect(session.state.scoring.acceptedBy).toEqual(['black', 'white']);
	});

	it('toggles the selected whole group and manual empty-point marks without a solver', async () => {
		const { session } = game([{ x: 8, y: 8 }, { x: 8, y: 7 }, null]);
		await session.play({ x: 0, y: 0 });
		await session.play({ x: 1, y: 0 });
		await session.play(null);
		expect(session.state.phase).toBe('scoring');
		expect(session.mark({ x: 0, y: 0 })).toBe(true);
		expect(session.state.scoring.deadStones).toHaveLength(2);
		expect(session.mark({ x: 1, y: 1 })).toBe(true);
		expect(session.state.scoring.neutralPoints).toEqual([{ x: 1, y: 1 }]);
		session.mark({ x: 1, y: 0 });
		expect(session.state.scoring.deadStones).toEqual([]);
		session.clearMarks();
		expect(session.state.scoring.neutralPoints).toEqual([]);
		expect(session.state.phase).toBe('scoring');
	});

	it('handles a worker error without changing the board and can retry', async () => {
		const { session, client } = game();
		vi.mocked(client.search).mockRejectedValueOnce(new Error('watchdog'));
		await session.play({ x: 0, y: 0 });
		expect(session.error).toBe('engine');
		expect(session.state.moves).toHaveLength(1);
		await session.resume();
		expect(session.error).toBeNull();
		expect(session.state.moves).toHaveLength(2);
	});

	it('refuses an illegal AI result instead of silently passing', async () => {
		const { session } = game([{ x: 0, y: 0 }]);
		await session.play({ x: 0, y: 0 });
		expect(session.error).toBe('invalidAiMove');
		expect(session.state.moves).toHaveLength(1);
	});

	it('does not infer ownership or a graph margin when no playout completed', async () => {
		const { session, client } = game();
		const empty = result();
		empty.playouts = 0;
		empty.ownership.samples = 0;
		empty.estimatedMargin = null;
		vi.mocked(client.search).mockResolvedValue(empty);
		await session.analyze('estimate');
		expect(ownershipMarks(session.state, session.analysis)).toEqual({ black: [], white: [] });
		expect(session.graph).toEqual([{ move: 0, margin: null }]);
		expect(session.state.scoring.deadStones).toEqual([]);
	});
});
