/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { boardKey, oppositeColor } from './board.js';
import { applyGameAction, createGame } from './game.js';
import type { Color, Point } from './board.js';
import type { GameAction, GameState } from './game.js';

function act(state: GameState, action: GameAction): GameState {
	const result = applyGameAction(state, action);
	if (!result.ok) throw new Error(result.reason);
	return result.state;
}

function toScoring(state = createGame({ size: 9 })): GameState {
	const once = act(state, { type: 'pass', color: state.toPlay });
	return act(once, { type: 'pass', color: once.toPlay });
}

/** Three independent, self-authored ko shapes produce a six-move cycle. */
function tripleKo(repetitionThreshold = 3) {
	const black: Point[] = [];
	const white: Point[] = [];
	const moves: Point[] = [];
	const recaptures: Point[] = [];
	for (let i = 0; i < 3; i++) {
		const x = 2 + i * 6;
		const y = 2;
		const friendly = i === 1 ? white : black;
		const enemy = i === 1 ? black : white;
		friendly.push({ x: x + 2, y }, { x: x + 1, y: y - 1 }, { x: x + 1, y: y + 1 });
		enemy.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y - 1 }, { x, y: y + 1 });
		moves.push({ x, y });
		recaptures.push({ x: x + 1, y });
	}
	return { state: createGame({ size: 19, setup: { black, white }, repetitionThreshold }), cycle: [...moves, ...recaptures] };
}

describe('game state transitions', () => {
	test('validates supported sizes, handicap, komi and repetition threshold', () => {
		expect(() => createGame({ size: 10 })).toThrow(RangeError);
		expect(() => createGame({ handicap: 1 })).toThrow(RangeError);
		expect(() => createGame({ komi: Infinity })).toThrow(RangeError);
		expect(() => createGame({ repetitionThreshold: 1 })).toThrow(RangeError);
		expect(() => createGame({ handicap: 2, setup: {} })).toThrow(RangeError);
	});
	test.each([9, 13, 19])('handicap on %s starts White with zero komi', size => {
		const state = createGame({ size, handicap: 5, komi: 7.5, toPlay: 'black' });
		expect(state.toPlay).toBe('white');
		expect(state.komi).toBe(0);
		expect(state.board.cells.filter(color => color === 'black')).toHaveLength(5);
		const finished = act(act(toScoring(state), { type: 'acceptScore', color: 'black' }), { type: 'acceptScore', color: 'white' });
		expect(finished.result?.score?.white.komi).toBe(0);
	});
	test('turn ownership and invalid moves leave state unchanged', () => {
		const state = createGame({ size: 9 });
		const snapshot = JSON.stringify(state);
		expect(applyGameAction(state, { type: 'play', color: 'white', point: { x: 0, y: 0 } })).toEqual({ ok: false, reason: 'notYourTurn' });
		expect(applyGameAction(state, { type: 'pass', color: 'white' })).toEqual({ ok: false, reason: 'notYourTurn' });
		expect(applyGameAction(state, { type: 'play', color: 'black', point: { x: -1, y: 0 } })).toEqual({ ok: false, reason: 'outOfBoard' });
		expect(JSON.stringify(state)).toBe(snapshot);
	});
	test('captures belong to the capturing player and are returned with the move', () => {
		const state = createGame({ size: 9, setup: { black: [{ x: 1, y: 0 }], white: [{ x: 0, y: 0 }] } });
		const result = applyGameAction(state, { type: 'play', color: 'black', point: { x: 0, y: 1 } });
		expect(result).toMatchObject({ ok: true, captured: [{ x: 0, y: 0 }], state: { prisoners: { black: 1, white: 0 }, toPlay: 'white' } });
		expect(state.prisoners.black).toBe(0);
	});
	test('returned captures cannot mutate saved move history', () => {
		const state = createGame({ size: 9, setup: { black: [{ x: 1, y: 0 }], white: [{ x: 0, y: 0 }] } });
		const result = applyGameAction(state, { type: 'play', color: 'black', point: { x: 0, y: 1 } });
		if (!result.ok) throw new Error(result.reason);
		result.captured.length = 0;
		expect(result.state.moves[0].captured).toEqual([{ x: 0, y: 0 }]);
		expect(result.state.prisoners.black).toBe(1);
	});
	test('two consecutive passes enter scoring and a played move resets the pass count', () => {
		let state = act(createGame({ size: 9 }), { type: 'pass', color: 'black' });
		state = act(state, { type: 'play', color: 'white', point: { x: 0, y: 0 } });
		expect(state.consecutivePasses).toBe(0);
		state = act(state, { type: 'pass', color: 'black' });
		expect(state.phase).toBe('playing');
		state = act(state, { type: 'pass', color: 'white' });
		expect(state.phase).toBe('scoring');
		expect(applyGameAction(state, { type: 'play', color: 'black', point: { x: 1, y: 1 } })).toEqual({ ok: false, reason: 'invalidState' });
	});
	test('both players must accept the current marks, repeated own acceptance does not finish', () => {
		let state = toScoring();
		state = act(state, { type: 'acceptScore', color: 'black' });
		state = act(state, { type: 'acceptScore', color: 'black' });
		expect(state.phase).toBe('scoring');
		state = act(state, { type: 'setScoring', color: 'white', marks: { deadStones: [], neutralPoints: [{ x: 0, y: 0 }] } });
		expect(state.scoring.acceptedBy).toEqual([]);
		state = act(state, { type: 'acceptScore', color: 'white' });
		expect(state.phase).toBe('scoring');
		state = act(state, { type: 'acceptScore', color: 'black' });
		expect(state.result).toMatchObject({ reason: 'score', winner: 'white', score: { margin: 6.5 } });
		expect(state.phase).toBe('finished');
		expect(applyGameAction(state, { type: 'resign', color: 'white' })).toEqual({ ok: false, reason: 'invalidState' });
	});
	test('invalid marks do not destroy prior agreement and input marks are copied', () => {
		const state = act(toScoring(), { type: 'acceptScore', color: 'black' });
		expect(applyGameAction(state, { type: 'setScoring', color: 'white', marks: { deadStones: [{ x: 0, y: 0 }], neutralPoints: [] } })).toEqual({ ok: false, reason: 'invalidScoring' });
		expect(state.scoring.acceptedBy).toEqual(['black']);
		const neutral = [{ x: 0, y: 0 }];
		const changed = act(state, { type: 'setScoring', color: 'white', marks: { deadStones: [], neutralPoints: neutral } });
		neutral[0].x = 8;
		expect(changed.scoring.neutralPoints).toEqual([{ x: 0, y: 0 }]);
	});
	test.each(['black', 'white'] as Color[])('resumption requested by %s needs the other player', requester => {
		let state = toScoring();
		state = act(state, { type: 'requestResume', color: requester });
		expect(applyGameAction(state, { type: 'acceptResume', color: requester })).toEqual({ ok: false, reason: 'notYourTurn' });
		expect(applyGameAction(state, { type: 'acceptScore', color: oppositeColor(requester) })).toEqual({ ok: false, reason: 'invalidState' });
		state = act(state, { type: 'acceptResume', color: oppositeColor(requester) });
		expect(state.phase).toBe('playing');
		expect(state.toPlay).toBe(oppositeColor(requester));
		expect(state.consecutivePasses).toBe(0);
		expect(state.previousBoard).toBeNull();
		expect(state.scoring.deadStones).toEqual([]);
	});
	test.each(['resign', 'timeout'] as const)('%s ends with the opposing winner', type => {
		const state = act(createGame(), { type, color: 'white' });
		expect(state.result).toEqual({ reason: type, winner: 'black' });
		expect(state.phase).toBe('finished');
	});
	test('ko recapture is rejected without changing history', () => {
		const { state, cycle } = tripleKo();
		const first = act(state, { type: 'play', color: 'black', point: cycle[0] });
		expect(applyGameAction(first, { type: 'play', color: 'white', point: cycle[3] })).toEqual({ ok: false, reason: 'ko' });
		expect(first.moves).toHaveLength(1);
	});
	test('three-ko repetition is legal and notifies on the third same-position/same-turn visit', () => {
		const fixture = tripleKo();
		let state = fixture.state;
		const original = boardKey(state.board);
		for (let lap = 1; lap <= 2; lap++) {
			for (const point of fixture.cycle) state = act(state, { type: 'play', color: state.toPlay, point });
			expect(boardKey(state.board)).toBe(original);
			expect(state.toPlay).toBe('black');
			if (lap === 1) expect(state.repetition).toBeNull();
		}
		expect(state.repetition).toMatchObject({ type: 'repetition', count: 3 });
		expect(state.phase).toBe('playing');
		expect(state.result).toBeNull();
		expect(state.prisoners).toEqual({ black: 6, white: 6 });
		state = act(state, { type: 'acceptNoResult', color: 'black' });
		expect(state.phase).toBe('playing');
		state = act(state, { type: 'acceptNoResult', color: 'white' });
		expect(state.result).toEqual({ reason: 'noResult', winner: null });
	});
	test('same board with a different turn does not reach the repetition threshold', () => {
		const first = act(createGame({ repetitionThreshold: 2 }), { type: 'pass', color: 'black' });
		expect(first.repetition).toBeNull();
		const second = act(first, { type: 'pass', color: 'white' });
		expect(second.repetition?.count).toBe(2);
	});
	test('a move clears a pending no-result agreement', () => {
		let state = act(createGame(), { type: 'acceptNoResult', color: 'black' });
		state = act(state, { type: 'play', color: 'black', point: { x: 3, y: 3 } });
		state = act(state, { type: 'acceptNoResult', color: 'white' });
		expect(state.phase).toBe('playing');
	});
});
