/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { LtlEmojiVoteMemoryState } from '@/core/ltl-emoji-vote-state.js';
import {
	LTL_VOTE_IPC_MAX_PENDING, LTL_VOTE_IPC_REQUEST, LTL_VOTE_IPC_RESPONSE, LTL_VOTE_IPC_TIMEOUT_MS,
	LtlEmojiVoteIpcClient, handleLtlVoteIpcRequest,
} from '@/core/ltl-emoji-vote-ipc.js';
import { LTL_EMOJI_VOTE_DURATION_MS, LTL_EMOJI_VOTE_RESULT_MS, LTL_EMOJI_VOTE_TALLY_MS } from '@/core/ltl-emoji-vote.js';
import type { LtlVoteStart } from '@/core/ltl-emoji-vote.js';
import type { LtlVoteIpcChannel } from '@/core/ltl-emoji-vote-ipc.js';

const startedAt = 1_800_000_000_000;
const input = (): LtlVoteStart => ({
	noteId: 'round1', createdAt: startedAt, requestedAt: startedAt,
	candidates: Array.from({ length: 5 }, (_, index) => ({ id: `e${index}`, name: `emoji${index}`, url: `https://media.example/${index}.webp`, isSensitive: false })),
});

function fixture() {
	vi.useFakeTimers();
	vi.setSystemTime(startedAt);
	return new LtlEmojiVoteMemoryState(() => Date.now());
}

function channel() {
	const events = new EventEmitter();
	let connected = true;
	const send = vi.fn<LtlVoteIpcChannel['send']>();
	const transport: LtlVoteIpcChannel = {
		isConnected: () => connected,
		send,
		onMessage: callback => { events.on('message', callback); return () => { events.off('message', callback); }; },
		onDisconnect: callback => { events.on('disconnect', callback); return () => { events.off('disconnect', callback); }; },
	};
	const client = new LtlEmojiVoteIpcClient(transport);
	return {
		client, send, events,
		disconnect() { connected = false; events.emit('disconnect'); },
		reply(message: unknown) { events.emit('message', message); },
	};
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('ephemeral LTL emoji vote state', () => {
	test('uses thirty seconds for voting, then 1.8 seconds tally and twenty seconds result', () => {
		const state = fixture();
		expect(LTL_EMOJI_VOTE_DURATION_MS).toBe(30_000);
		expect(state.start(input())).toBe(true);
		expect(state.read(null).metadata).toMatchObject({ startedAt, closesAt: startedAt + 30_000, resolvedAt: startedAt + 31_800, expiresAt: startedAt + 51_800 });
		state.clear();
	});
	test('atomically prevents overlap and duplicate votes, preserving ties and zero counts', () => {
		const state = fixture();
		expect(state.start(input())).toBe(true);
		expect(state.start({ ...input(), noteId: 'other' })).toBe(false);
		expect(state.vote('round1', 'alice', 'e0')).toBe('OK');
		expect(state.vote('round1', 'alice', 'e1')).toBe('ALREADY_VOTED');
		expect(state.vote('round1', 'bob', 'e1')).toBe('OK');
		expect(state.read('alice').counts).toEqual([1, 1, 0, 0, 0]);
		state.clear();
	});
	test('copies only the current viewer choice and cannot be changed by mutating input or a returned snapshot', () => {
		const state = fixture();
		const proposed = input();
		state.start(proposed);
		proposed.candidates[0].name = 'changed input';
		state.vote('round1', 'alice', 'e0');
		state.vote('round1', 'bob', 'e1');
		const alice = state.read('alice');
		expect(alice.choice).toEqual({ emojiId: 'e0', votedAt: startedAt });
		expect(state.read('bob').choice?.emojiId).toBe('e1');
		expect(state.read(null).choice).toBeNull();
		expect(Object.keys(alice).sort()).toEqual(['choice', 'counts', 'metadata', 'serverNow']);
		if (!alice.metadata || !alice.choice) throw new Error('Expected the accepted vote');
		alice.metadata.candidates[0].name = 'changed snapshot';
		alice.choice.emojiId = 'e4';
		alice.counts[0] = 999;
		expect(state.read('alice')).toMatchObject({ metadata: { candidates: [{ name: 'emoji0' }, {}, {}, {}, {}] }, choice: { emojiId: 'e0' }, counts: [1, 1, 0, 0, 0] });
		state.clear();
	});
	test.each([
		{ createdAt: startedAt - 10_001 }, { createdAt: startedAt + 1001 },
		{ requestedAt: startedAt - 1501 }, { requestedAt: startedAt + 1001 },
		{ candidates: [] }, { candidates: [input().candidates[0], input().candidates[0]] },
		{ candidates: [{ ...input().candidates[0], isSensitive: true }] },
	])('rejects stale, delayed or invalid starts: %j', changes => {
		const state = fixture();
		expect(state.start({ ...input(), ...changes })).toBe(false);
		expect(state.read(null).metadata).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
	});
	test('rejects missing rounds and invalid candidates without changing counts', () => {
		const state = fixture();
		expect(state.vote('round1', 'alice', 'e0')).toBe('NO_SUCH_ROUND');
		state.start(input());
		expect(state.vote('other', 'alice', 'e0')).toBe('NO_SUCH_ROUND');
		expect(state.vote('round1', '', 'e0')).toBe('NO_SUCH_ROUND');
		expect(state.vote('round1', 'alice', 'unknown')).toBe('INVALID_EMOJI');
		expect(state.read(null).counts).toEqual([0, 0, 0, 0, 0]);
		state.clear();
	});
	test('accepts immediately before the deadline and freezes counts at the deadline', () => {
		const state = fixture();
		state.start(input());
		vi.setSystemTime(startedAt + LTL_EMOJI_VOTE_DURATION_MS - 1);
		expect(state.vote('round1', 'alice', 'e0')).toBe('OK');
		vi.setSystemTime(startedAt + LTL_EMOJI_VOTE_DURATION_MS);
		expect(state.vote('round1', 'bob', 'e1')).toBe('VOTING_CLOSED');
		expect(state.read(null).counts).toEqual([1, 0, 0, 0, 0]);
		state.clear();
	});
	test('actively clears all round data at expiry without waiting for a read, and keeps no seen history', async () => {
		const state = fixture();
		state.start(input());
		state.vote('round1', 'alice', 'e0');
		const clear = vi.spyOn(state, 'clear');
		const duration = LTL_EMOJI_VOTE_DURATION_MS + LTL_EMOJI_VOTE_TALLY_MS + LTL_EMOJI_VOTE_RESULT_MS;
		await vi.advanceTimersByTimeAsync(duration - 1);
		expect(clear).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(clear).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
		expect(state.start({ ...input(), requestedAt: Date.now() })).toBe(false);
		// 時刻を戻してもreadで隠していただけの旧データが復活しない。
		vi.setSystemTime(startedAt);
		expect(state.read('alice')).toEqual({ serverNow: startedAt, metadata: null, counts: [], choice: null });
	});
	test('expires on reads too if the cleanup timer has not run yet', () => {
		const state = fixture();
		state.start(input());
		vi.setSystemTime(startedAt + 51_800);
		expect(state.read('alice').metadata).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
		expect(state.start({ ...input(), noteId: 'round2', createdAt: Date.now(), requestedAt: Date.now() })).toBe(true);
		state.clear();
	});
});

describe('bounded LTL emoji vote IPC', () => {
	test('two workers share one atomic state and receive only their own ballot', async () => {
		const state = fixture();
		const a = channel();
		const b = channel();
		for (const worker of [a, b]) worker.send.mockImplementation(message => handleLtlVoteIpcRequest(state, message, response => worker.reply(response)));
		expect(await Promise.all([a.client.request({ operation: 'start', input: input() }), b.client.request({ operation: 'start', input: input() })])).toEqual([true, false]);
		expect(await Promise.all([a.client.request({ operation: 'vote', roundId: 'round1', userId: 'alice', emojiId: 'e0' }), b.client.request({ operation: 'vote', roundId: 'round1', userId: 'alice', emojiId: 'e1' })])).toEqual(['OK', 'ALREADY_VOTED']);
		expect(await b.client.request({ operation: 'read', userId: 'bob' })).toMatchObject({ choice: null, counts: [1, 0, 0, 0, 0] });
		expect(vi.getTimerCount()).toBe(1);
		a.client.dispose(); b.client.dispose(); state.clear();
		expect(vi.getTimerCount()).toBe(0);
	});
	test('ignores unrelated messages and refuses expired or malformed operations', () => {
		const state = fixture();
		const reply = vi.fn();
		handleLtlVoteIpcRequest(state, { type: 'memory usage' }, reply);
		expect(reply).not.toHaveBeenCalled();
		for (const changes of [{ deadline: startedAt }, { deadline: startedAt + LTL_VOTE_IPC_TIMEOUT_MS + 1 }, { command: { operation: 'delete' } }]) {
			handleLtlVoteIpcRequest(state, { type: LTL_VOTE_IPC_REQUEST, id: 'request', deadline: startedAt + 1000, command: { operation: 'start', input: input() }, ...changes }, reply);
			expect(reply).toHaveBeenLastCalledWith({ type: LTL_VOTE_IPC_RESPONSE, id: 'request', result: null });
		}
		expect(state.read(null).metadata).toBeNull();
	});
	test('timeouts settle and discard pending callbacks; late replies cannot revive a completed request', async () => {
		fixture();
		const worker = channel();
		const first = worker.client.request({ operation: 'read', userId: null });
		await vi.advanceTimersByTimeAsync(LTL_VOTE_IPC_TIMEOUT_MS);
		expect(await first).toBeNull();
		worker.reply({ type: LTL_VOTE_IPC_RESPONSE, id: worker.send.mock.calls[0][0].id, result: true });
		expect(vi.getTimerCount()).toBe(0);
		worker.client.dispose();
	});
	test('caps pending work and releases every waiter on disconnect without retries', async () => {
		fixture();
		const worker = channel();
		const waiting = Array.from({ length: LTL_VOTE_IPC_MAX_PENDING }, () => worker.client.request({ operation: 'read', userId: null }));
		expect(await worker.client.request({ operation: 'read', userId: null })).toBeNull();
		expect(worker.send).toHaveBeenCalledTimes(LTL_VOTE_IPC_MAX_PENDING);
		worker.disconnect();
		expect(await Promise.all(waiting)).toEqual(waiting.map(() => null));
		expect(await worker.client.request({ operation: 'read', userId: null })).toBeNull();
		expect(worker.events.listenerCount('message')).toBe(0);
		expect(worker.events.listenerCount('disconnect')).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});
	test.each(['throw', 'callback'])('fails closed for a send %s and clears its timer', async failure => {
		fixture();
		const worker = channel();
		worker.send.mockImplementation((_message, callback) => {
			if (failure === 'throw') throw new Error('disconnected');
			callback(new Error('disconnected'));
		});
		expect(await worker.client.request({ operation: 'read', userId: null })).toBeNull();
		expect(vi.getTimerCount()).toBe(0);
		worker.client.dispose();
	});
});
