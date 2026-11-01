/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from 'vitest';
import { createRecord, exportRecord, importRecord, RecordPlayback } from './record.js';
import { boardKey, getStone } from './rules/board.js';
import type { LocalRecord } from './record.js';

function imported(source: string): LocalRecord {
	const result = importRecord(source);
	if (!result.ok) throw new Error(result.error.message);
	return result.records[0];
}

describe('local HataIgo record', () => {
	it('alternates legal moves and records passes without ending an analysis session', () => {
		const record = createRecord({ size: 9 });
		expect(record.play({ x: 0, y: 0 }).ok).toBe(true);
		expect(record.current.position.toPlay).toBe('white');
		expect(record.play(null).ok).toBe(true);
		expect(record.play(null).ok).toBe(true);
		expect(record.play({ x: 1, y: 1 }).ok).toBe(true);
		expect(record.current.position.moveNumber).toBe(4);
		expect(record.moves.map(move => move.color)).toEqual(['black', 'white', 'black', 'white']);
	});

	it('rejects occupied, suicide and outside points without changing the cursor', () => {
		const record = imported('(;SZ[9]AW[ba][ab])');
		const before = record.current.id;
		expect(record.play({ x: 0, y: 0 })).toEqual({ ok: false, reason: 'suicide' });
		expect(record.play({ x: 1, y: 0 })).toEqual({ ok: false, reason: 'occupied' });
		expect(record.play({ x: -1, y: 0 })).toEqual({ ok: false, reason: 'outOfBoard' });
		expect(record.current.id).toBe(before);
		expect(record.total).toBe(0);
	});

	it('keeps capture counts and undo snapshots independent', () => {
		const record = imported('(;SZ[9]AW[aa]AB[ba])');
		expect(record.play({ x: 0, y: 1 }).ok).toBe(true);
		expect(getStone(record.current.position.board, { x: 0, y: 0 })).toBeNull();
		expect(record.current.position.prisoners).toEqual({ black: 1, white: 0 });
		expect(record.previous()).toBe(true);
		expect(getStone(record.current.position.board, { x: 0, y: 0 })).toBe('white');
		expect(record.current.position.prisoners.black).toBe(0);
		expect(record.next()).toBe(true);
		expect(record.current.position.prisoners.black).toBe(1);
	});

	it('rejects immediate ko and allows recapture after a threat and response', () => {
		const record = imported('(;SZ[9]AB[ab][ba][bc]AW[bb][ca][db][cc])');
		expect(record.play({ x: 2, y: 1 }).ok).toBe(true);
		expect(record.play({ x: 1, y: 1 })).toEqual({ ok: false, reason: 'ko' });
		expect(record.play({ x: 8, y: 8 }).ok).toBe(true);
		expect(record.play({ x: 8, y: 7 }).ok).toBe(true);
		expect(record.play({ x: 1, y: 1 }).ok).toBe(true);
	});

	it.each([9, 13, 19] as const)('creates fixed handicap positions on %i lines and resets through a new record', size => {
		const record = createRecord({ size, handicap: 5 });
		expect(record.current.position.board.cells.filter(stone => stone === 'black')).toHaveLength(5);
		expect(record.current.position.toPlay).toBe('white');
		expect(record.komi).toBe(0);
		expect(record.total).toBe(0);
		const reset = createRecord({ size });
		expect(reset.current.position.board.cells.every(stone => stone === null)).toBe(true);
		expect(reset.current.position.toPlay).toBe('black');
	});

	it('creates alternatives after undo and switches between them without dropping either', () => {
		const record = createRecord({ size: 9 });
		record.play({ x: 0, y: 0 });
		const fork = record.current.id;
		record.play({ x: 1, y: 0 });
		const original = record.current.id;
		record.previous();
		record.play({ x: 2, y: 0 });
		const alternative = record.current.id;
		expect(record.node(fork).children).toEqual([original, alternative]);
		expect(record.chooseVariation(fork, original)).toBe(true);
		expect(getStone(record.current.position.board, { x: 1, y: 0 })).toBe('white');
		expect(getStone(record.current.position.board, { x: 2, y: 0 })).toBeNull();
		expect(record.chooseVariation(fork, alternative)).toBe(true);
		expect(getStone(record.current.position.board, { x: 2, y: 0 })).toBe('white');
		expect(record.branches[0].options).toHaveLength(2);
	});

	it('reuses an existing continuation and never duplicates a repeated pass', () => {
		const record = createRecord({ size: 9 });
		record.play(null);
		const first = record.current.id;
		record.previous();
		expect(record.play(null)).toMatchObject({ ok: true, reused: true, node: { id: first } });
		expect(record.node(record.current.parent ?? 0).children).toHaveLength(1);
	});

	it('navigates first, previous, move table jumps, next and last on the selected branch', () => {
		const record = imported('(;SZ[9];B[aa];W[bb](;B[cc];W[dd])(;B[ee]))');
		expect(record.total).toBe(4);
		expect(record.current.position.moveNumber).toBe(0);
		expect(record.next()).toBe(true);
		expect(record.current.position.moveNumber).toBe(1);
		expect(record.jumpToMove(3)).toBe(true);
		expect(record.current.move?.point).toEqual({ x: 2, y: 2 });
		record.last();
		expect(record.current.position.moveNumber).toBe(4);
		expect(record.next()).toBe(false);
		record.previous();
		expect(record.current.position.moveNumber).toBe(3);
		record.first();
		expect(record.previous()).toBe(false);
		expect(record.jumpToMove(99)).toBe(false);
		expect(record.jump(-1)).toBe(false);
	});

	it('replays a root move from move zero and preserves a new root-move alternative', () => {
		const record = imported('(;SZ[9]B[aa];W[bb])');
		expect(record.current.position.moveNumber).toBe(0);
		expect(getStone(record.current.position.board, { x: 0, y: 0 })).toBeNull();
		record.play({ x: 1, y: 0 });
		expect(record.branches).toHaveLength(1);
		const exported = exportRecord([record]);
		expect(exported.ok).toBe(true);
		if (exported.ok) expect(imported(exported.value).branches[0].options).toHaveLength(2);
	});

	it('handles setup and PL nodes during replay without consuming a move number', () => {
		const record = imported('(;SZ[9]AB[aa]PL[W];W[bb];AE[aa]AB[cc]PL[B];B[dd])');
		expect(record.current.position.toPlay).toBe('white');
		record.next();
		expect(record.current.position.moveNumber).toBe(1);
		expect(getStone(record.current.position.board, { x: 0, y: 0 })).toBeNull();
		expect(getStone(record.current.position.board, { x: 2, y: 2 })).toBe('black');
		expect(record.current.position.toPlay).toBe('black');
	});

	it('keeps all branches and metadata through local SGF export/import', () => {
		const record = imported('(;SZ[9]PB[自作の黒]PW[自作の白]C[private];B[aa](;W[bb]C[one])(;W[cc]C[two]))');
		const exported = exportRecord([record], true);
		expect(exported.ok).toBe(true);
		if (!exported.ok) return;
		const again = imported(exported.value);
		expect(again.toSgf()).toEqual(record.toSgf());
		expect(again.branches[0].options).toHaveLength(2);
		const safe = exportRecord([record]);
		expect(safe.ok).toBe(true);
		if (safe.ok) expect(safe.value).not.toContain('C[');
	});

	it('preserves a collection rather than silently dropping extra games', () => {
		const result = importRecord('(;SZ[9];B[aa])(;SZ[13];B[bb])');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.records.map(record => record.size)).toEqual([9, 13]);
		const exported = exportRecord(result.records);
		if (!exported.ok) throw new Error(exported.error.message);
		const again = importRecord(exported.value);
		expect(again.ok && again.records.length).toBe(2);
	});

	it('validates illegal continuations even on unselected SGF branches', () => {
		const result = importRecord('(;SZ[9];B[aa](;W[bb])(;W[aa]))');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('illegalMove');
	});

	it('returns SGF parse/encoding/limit errors without replacing a record', () => {
		const before = createRecord({ size: 9 });
		expect(importRecord('invalid').ok).toBe(false);
		expect(importRecord('(;CA[Shift_JIS])').ok).toBe(false);
		expect(importRecord(`(;C[${'x'.repeat(1024 * 1024)}])`).ok).toBe(false);
		expect(boardKey(before.current.position.board)).toBe(boardKey(createRecord({ size: 9 }).current.position.board));
	});

	it('shows only the latest ten moves still present as numbered stones', () => {
		const record = createRecord({ size: 19 });
		for (let i = 0; i < 12; i++) record.play({ x: i, y: 0 });
		expect(record.recentNumbers().map(mark => mark.number)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		record.jumpToMove(2);
		expect(record.recentNumbers().map(mark => mark.number)).toEqual([1, 2]);
		const capturing = imported('(;SZ[9]AB[ba];W[aa];B[ab])');
		capturing.last();
		expect(capturing.recentNumbers()).toEqual([{ point: { x: 0, y: 1 }, number: 2 }]);
	});
});

describe('local record autoplay', () => {
	function timerHarness(advance: () => boolean) {
		const pending = new Map<number, () => void>();
		const delays: number[] = [];
		const changes: boolean[] = [];
		let sequence = 0;
		const playback = new RecordPlayback({
			advance, interval: () => 750,
			schedule(callback, delay) { const id = ++sequence; pending.set(id, callback); delays.push(delay); return id; },
			cancel(handle) { pending.delete(Number(handle)); },
			changed(playing) { changes.push(playing); },
		});
		const tick = () => { const item = pending.entries().next().value; if (item !== undefined) { pending.delete(item[0]); item[1](); } };
		return { playback, pending, delays, changes, tick };
	}

	it('advances at the configured interval and stops at the end', () => {
		const record = imported('(;SZ[9];B[aa];W[bb])');
		const harness = timerHarness(() => record.next() && record.current.position.moveNumber < record.total);
		harness.playback.start();
		harness.tick();
		expect(record.current.position.moveNumber).toBe(1);
		harness.tick();
		expect(record.current.position.moveNumber).toBe(2);
		expect(harness.playback.playing).toBe(false);
		expect(harness.pending.size).toBe(0);
		expect(harness.delays).toEqual([750, 750]);
	});

	it('cancels pending work on stop/unmount and ignores an already queued callback', () => {
		let calls = 0;
		const harness = timerHarness(() => { calls++; return true; });
		harness.playback.start();
		const stale = harness.pending.values().next().value;
		harness.playback.stop();
		expect(harness.pending.size).toBe(0);
		stale?.();
		expect(calls).toBe(0);
		expect(harness.playback.playing).toBe(false);
	});

	it('does not create duplicate timers when started twice and can restart', () => {
		const harness = timerHarness(() => true);
		harness.playback.start();
		harness.playback.start();
		expect(harness.pending.size).toBe(1);
		harness.playback.stop();
		harness.playback.start();
		expect(harness.pending.size).toBe(1);
		harness.tick();
		expect(harness.pending.size).toBe(1);
	});
});
