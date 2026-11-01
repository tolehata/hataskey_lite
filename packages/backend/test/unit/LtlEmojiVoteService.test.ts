/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { LtlEmojiVoteError, LtlEmojiVoteService } from '@/core/LtlEmojiVoteService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import {
	LTL_EMOJI_VOTE_DURATION_MS, LTL_EMOJI_VOTE_FRESH_MS,
	LTL_EMOJI_VOTE_RESULT_MS, LTL_EMOJI_VOTE_TALLY_MS, rankLtlEmojiVotes,
} from '@/core/ltl-emoji-vote.js';
import type { LtlVoteChoice, LtlVoteEmoji, LtlVoteMetadata, LtlVoteStart } from '@/core/ltl-emoji-vote.js';
import ShowEndpoint, { meta as showMeta } from '@/server/api/endpoints/hata/emoji-vote/show.js';
import VoteEndpoint, { meta as voteMeta } from '@/server/api/endpoints/hata/emoji-vote/vote.js';

const { randomIntMock, storeMock } = vi.hoisted(() => ({
	randomIntMock: vi.fn((min: number, _max: number) => min),
	storeMock: { start: vi.fn(), read: vi.fn(), vote: vi.fn() },
}));
vi.mock('@/core/ltl-emoji-vote-ipc.js', () => ({ ltlEmojiVoteStore: storeMock }));
vi.mock('node:crypto', async importOriginal => ({
	...await importOriginal<typeof import('node:crypto')>(),
	randomInt: randomIntMock,
}));

const startedAt = 1_800_000_000_000;
const me = { id: 'viewer', host: null, isSuspended: false, movedToUri: null };
const trigger = { id: 'round1', userId: 'author', userHost: null, text: '絵文字を選ぶぞ', visibility: 'public', channelId: null, replyId: null, renoteId: null, cw: null };
const author = { id: 'author', host: null };
const emoji = (id: string): LtlVoteEmoji => ({ id, name: `emoji_${id}`, url: `https://media.example/${id}.webp`, isSensitive: false });
const dbEmoji = (id: string) => ({ ...emoji(id), host: null, publicUrl: emoji(id).url, originalUrl: '', roleIdsThatCanBeUsedThisEmojiAsReaction: [] as string[] });
const metadata = (count = 5): LtlVoteMetadata => ({
	id: 'round1', noteId: 'round1', startedAt,
	closesAt: startedAt + LTL_EMOJI_VOTE_DURATION_MS,
	resolvedAt: startedAt + LTL_EMOJI_VOTE_DURATION_MS + LTL_EMOJI_VOTE_TALLY_MS,
	expiresAt: startedAt + LTL_EMOJI_VOTE_DURATION_MS + LTL_EMOJI_VOTE_TALLY_MS + LTL_EMOJI_VOTE_RESULT_MS,
	candidates: Array.from({ length: count }, (_, index) => emoji(`e${index}`)),
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); randomIntMock.mockReset(); });

function fixture() {
	vi.useFakeTimers();
	vi.setSystemTime(startedAt);
	let current: LtlVoteMetadata | null = metadata();
	let clock = startedAt;
	let counts = [5, 5, 1, 0, 0];
	let castResult = 'OK';
	const choices = new Map<string, LtlVoteChoice>();
	const store = storeMock;
	store.start.mockReset().mockResolvedValue(true);
	store.vote.mockReset().mockImplementation(async () => castResult);
	store.read.mockReset().mockImplementation(async (userId: string | null) => {
		if (!current || clock >= current.expiresAt) return { serverNow: clock, metadata: null, choice: null, counts: [] };
		return { serverNow: clock, metadata: structuredClone(current), choice: choices.get(userId ?? '') ?? null, counts: [...counts] };
	});
	const query = {
		where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
		innerJoinAndSelect: vi.fn().mockReturnThis(), leftJoinAndSelect: vi.fn().mockReturnThis(),
		getOne: vi.fn().mockResolvedValue({ ...trigger }),
	};
	const notes = { createQueryBuilder: vi.fn(() => query) };
	const emojis = {
		find: vi.fn(async () => Array.from({ length: 8 }, (_, index) => dbEmoji(`e${index}`))),
		findBy: vi.fn(async () => metadata().candidates.map(candidate => dbEmoji(candidate.id))),
	};
	const policies = { ltlAvailable: true };
	const roles = { getUserPolicies: vi.fn(async () => policies) };
	const filters = { generateVisibilityQuery: vi.fn(), generateChannelVisibilityQuery: vi.fn(async () => {}), generateBaseNoteFilteringQuery: vi.fn() };
	const packer = { pack: vi.fn().mockResolvedValue({ ...trigger, user: { requireSigninToViewContents: false } }) };
	const idService = { parse: vi.fn(() => ({ date: new Date(startedAt) })) };
	const service = new LtlEmojiVoteService(notes as never, emojis as never, filters as never, roles as never, packer as never, idService as never);
	return {
		service, store, query, notes, emojis, roles, policies, filters, packer, idService, choices,
		setNow(value: number) { clock = value; },
		setRound(value: LtlVoteMetadata | null) { current = value; },
		setCounts(value: number[]) { counts = value; },
		setCastResult(value: string) { castResult = value; },
	};
}

describe('LTL emoji vote rankings', () => {
	test('includes all five candidates, stable ties and zero votes with competition ranks', () => {
		const candidates = metadata().candidates;
		const result = rankLtlEmojiVotes(candidates, [5, 5, 1, 0, 0]);
		expect(result.map(row => [row.emoji.id, row.count, row.rank, row.tied])).toEqual([
			['e0', 5, 1, true], ['e1', 5, 1, true], ['e2', 1, 3, false], ['e3', 0, 4, true], ['e4', 0, 4, true],
		]);
		expect(candidates.map(row => row.id)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
	});
	test('keeps zero-vote candidates without creating a first place when nobody voted', () => {
		expect(rankLtlEmojiVotes(metadata().candidates, [0, 0, 0, 0, 0]).map(row => [row.rank, row.count, row.tied])).toEqual(Array.from({ length: 5 }, () => [null, 0, false]));
	});
	test.each([1, 2, 3, 4, 5])('ranks all %i available candidates', (size) => {
		const result = rankLtlEmojiVotes(metadata(size).candidates, Array.from({ length: size }, (_, index) => index + 1));
		expect(result).toHaveLength(size);
		expect(result.map(row => row.rank)).toEqual(Array.from({ length: size }, (_, index) => index + 1));
	});
});

describe('LTL emoji vote creation', () => {
	test('passes five unique local candidates even when the random source always picks its lower bound', async () => {
		const f = fixture();
		await expect(f.service.onNoteCreated(trigger as never, author)).resolves.toBe(true);
		const proposed = f.store.start.mock.calls[0][0] as LtlVoteStart;
		expect(proposed).toMatchObject({ noteId: 'round1', createdAt: startedAt, requestedAt: startedAt });
		expect(proposed.candidates).toHaveLength(5);
		expect(new Set(proposed.candidates.map((value: LtlVoteEmoji) => value.id)).size).toBe(proposed.candidates.length);
	});
	test.each([1, 2, 3, 4, 5])('offers every usable candidate when only %i are available', async count => {
		const f = fixture();
		const available = Array.from({ length: count }, (_, index) => dbEmoji(`e${index}`));
		f.emojis.find.mockResolvedValueOnce([
			...available,
			{ ...dbEmoji('sensitive'), isSensitive: true },
			{ ...dbEmoji('restricted'), roleIdsThatCanBeUsedThisEmojiAsReaction: ['special'] },
			{ ...dbEmoji('remote'), host: 'remote.example' } as never,
		]);
		await expect(f.service.onNoteCreated(trigger as never, author)).resolves.toBe(true);
		const proposed = (f.store.start.mock.calls[0][0] as LtlVoteStart);
		expect(proposed.candidates.map((value: LtlVoteEmoji) => value.id).sort()).toEqual(available.map(value => value.id).sort());
	});
	test('still draws the five candidates randomly from a larger pool without duplicates', async () => {
		const f = fixture();
		randomIntMock.mockImplementation((_min, max) => max - 1);
		await expect(f.service.onNoteCreated(trigger as never, author)).resolves.toBe(true);
		const proposed = (f.store.start.mock.calls[0][0] as LtlVoteStart);
		const ids = proposed.candidates.map((value: LtlVoteEmoji) => value.id);
		expect(ids).toHaveLength(5);
		expect(new Set(ids).size).toBe(5);
		expect(ids).toContain('e7');
		expect(ids.every((id: string) => Array.from({ length: 8 }, (_, index) => `e${index}`).includes(id))).toBe(true);
	});
	test('trims the exact trigger, permits local-only media and does not treat a CDN URL as remote registration', async () => {
		const f = fixture();
		f.emojis.find.mockResolvedValueOnce([{ ...dbEmoji('only'), localOnly: true } as never]);
		await expect(f.service.onNoteCreated({ ...trigger, text: ' 絵文字を選ぶぞ\n' } as never, author)).resolves.toBe(true);
		expect((f.store.start.mock.calls[0][0] as LtlVoteStart).candidates).toEqual([emoji('only')]);
	});
	test.each([
		['different text', { text: '絵文字を選ぶぞ！' }, author],
		['home visibility', { visibility: 'home' }, author],
		['followers visibility', { visibility: 'followers' }, author],
		['specified visibility', { visibility: 'specified' }, author],
		['channel', { channelId: 'channel' }, author],
		['remote note', { userHost: 'remote.example' }, author],
		['remote user', {}, { id: 'author', host: 'remote.example' }],
		['author mismatch', {}, { id: 'different', host: null }],
	])('does not claim or query emoji for %s', async (_name, changes, user) => {
		const f = fixture();
		await expect(f.service.onNoteCreated({ ...trigger, ...changes } as never, user)).resolves.toBe(false);
		expect(f.store.start).not.toHaveBeenCalled();
		expect(f.emojis.find).not.toHaveBeenCalled();
	});
	test('rejects stale replays without leaving a start queued', async () => {
		const f = fixture();
		vi.setSystemTime(startedAt + LTL_EMOJI_VOTE_FRESH_MS + 1);
		await expect(f.service.onNoteCreated(trigger as never, author)).resolves.toBe(false);
		expect(f.store.start).not.toHaveBeenCalled();
	});
	test('starts no round if all local candidates are sensitive or role-restricted', async () => {
		const f = fixture();
		f.emojis.find.mockResolvedValueOnce([{ ...dbEmoji('s'), isSensitive: true }, { ...dbEmoji('r'), roleIdsThatCanBeUsedThisEmojiAsReaction: ['special'] }, { ...dbEmoji('remote'), host: 'remote.example' } as never]);
		await expect(f.service.onNoteCreated(trigger as never, author)).resolves.toBe(false);
		expect(f.store.start).not.toHaveBeenCalled();
	});
	test('does not replace a round when the atomic claim rejects an overlap', async () => {
		const f = fixture();
		f.store.start.mockResolvedValueOnce(false);
		await expect(f.service.onNoteCreated(trigger as never, author)).resolves.toBe(false);
	});
	test('bounds a stalled coordinator start', async () => {
		const f = fixture();
		f.store.start.mockImplementationOnce(() => new Promise(() => {}));
		const result = f.service.onNoteCreated(trigger as never, author);
		const assertion = expect(result).rejects.toThrow('Emoji vote start timed out');
		await vi.advanceTimersByTimeAsync(1600);
		await assertion;
		expect(vi.getTimerCount()).toBe(0);
	});
	test('bounds stalled emoji lookup and never starts after its timed-out lookup resolves', async () => {
		const f = fixture();
		let resolveLookup!: (value: ReturnType<typeof dbEmoji>[]) => void;
		f.emojis.find.mockImplementationOnce(() => new Promise(resolve => { resolveLookup = resolve; }));
		const result = f.service.onNoteCreated(trigger as never, author);
		const assertion = expect(result).rejects.toThrow('Emoji vote start timed out');
		await vi.advanceTimersByTimeAsync(1600);
		await assertion;
		expect(f.store.start).not.toHaveBeenCalled();
		resolveLookup([dbEmoji('e0')]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(f.store.start).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
	test('keeps the pre-query request time when a valid delayed lookup reaches the coordinator', async () => {
		const f = fixture();
		f.emojis.find.mockImplementationOnce(async () => {
			await new Promise(resolve => setTimeout(resolve, 120));
			return [dbEmoji('e0')];
		});
		const result = f.service.onNoteCreated(trigger as never, author);
		await vi.advanceTimersByTimeAsync(120);
		await expect(result).resolves.toBe(true);
		expect((f.store.start.mock.calls[0][0] as LtlVoteStart).requestedAt).toBe(startedAt);
	});
	test('rejects a lookup that consumed the start budget before sending a coordinator request', async () => {
		const f = fixture();
		f.emojis.find.mockImplementationOnce(async () => {
			await new Promise(resolve => setTimeout(resolve, 1501));
			return [dbEmoji('e0')];
		});
		const result = f.service.onNoteCreated(trigger as never, author);
		await vi.advanceTimersByTimeAsync(1501);
		await expect(result).resolves.toBe(false);
		expect(f.store.start).not.toHaveBeenCalled();
	});
});

describe('LTL emoji vote read/write authorization and phase handling', () => {
	test('treats revoked private channel access during packing as an unavailable round', async () => {
		const f = fixture();
		f.packer.pack.mockRejectedValue(new PrivateChannelNoteVisibilityError());
		await expect(f.service.show(me as never)).resolves.toMatchObject({ round: null });
		await expect(f.service.vote(me as never, 'round1', 'e0')).rejects.toMatchObject({ code: 'NO_SUCH_ROUND' });
		expect(f.store.vote).not.toHaveBeenCalled();
	});
	test('propagates unrelated packing failures', async () => {
		const f = fixture();
		f.packer.pack.mockRejectedValue(new Error('database unavailable'));
		await expect(f.service.show(me as never)).rejects.toThrow('database unavailable');
	});
	test('applies the existing visibility, mute/block and packed-note hiding rules on reads and writes', async () => {
		const f = fixture();
		await f.service.show(me as never);
		await f.service.vote(me as never, 'round1', 'e0');
		expect(f.roles.getUserPolicies).toHaveBeenCalledWith(me.id);
		expect(f.filters.generateVisibilityQuery).toHaveBeenCalledWith(f.query, me);
		expect(f.filters.generateBaseNoteFilteringQuery).toHaveBeenCalledWith(f.query, me);
		expect(f.query.andWhere).toHaveBeenCalledWith('note.visibility = \'public\' AND note.userHost IS NULL AND note.channelId IS NULL');
		expect(f.packer.pack).toHaveBeenCalledWith(expect.objectContaining({ id: 'round1' }), me, { detail: true, skipHide: false });
	});
	test('returns the same candidates but only the authenticated viewer own choice; hides live counts', async () => {
		const f = fixture();
		f.choices.set('viewer', { emojiId: 'e0', votedAt: startedAt + 10 });
		f.choices.set('other', { emojiId: 'e1', votedAt: startedAt + 10 });
		const a = await f.service.show(me as never);
		const b = await f.service.show({ ...me, id: 'other' } as never);
		const guest = await f.service.show(null);
		expect(a.round?.candidates).toEqual(b.round?.candidates);
		expect(a.round).toMatchObject({ choice: { emojiId: 'e0' }, total: 0, rankings: [] });
		expect(b.round?.choice?.emojiId).toBe('e1');
		expect(guest.round?.choice).toBeNull();
		expect(a.round).not.toHaveProperty('votes');
		expect(a.round).not.toHaveProperty('authorId');
	});
	test('uses the coordinator clock for all phases and removes the result exactly 20 seconds after resolution', async () => {
		const f = fixture();
		vi.setSystemTime(startedAt + 99999999);
		for (const [now, phase] of [[metadata().closesAt - 1, 'voting'], [metadata().closesAt, 'tallying'], [metadata().resolvedAt, 'result'], [metadata().expiresAt - 1, 'result']] as const) {
			f.setNow(now);
			expect(await f.service.show(me as never)).toMatchObject({ serverNow: now, round: { phase } });
		}
		f.setNow(metadata().expiresAt);
		expect((await f.service.show(me as never)).round).toBeNull();
	});
	test('publishes all five final rankings and a consistent aggregate', async () => {
		const f = fixture();
		f.setNow(metadata().resolvedAt);
		const response = await f.service.show(me as never);
		expect(response.round?.rankings).toEqual(rankLtlEmojiVotes(metadata().candidates, [5, 5, 1, 0, 0]));
		expect(response.round?.total).toBe(11);
	});
	test.each(['role', 'filtered note', 'hidden note', 'hidden reply', 'hidden quote', 'edited text', 'converted visibility'])('denies reads and writes for %s without a cast', async (reason) => {
		const f = fixture();
		if (reason === 'role') f.policies.ltlAvailable = false;
		if (reason === 'filtered note') f.query.getOne.mockResolvedValue(null);
		if (reason === 'hidden note') f.packer.pack.mockResolvedValue({ ...trigger, isHidden: true });
		if (reason === 'hidden reply') f.packer.pack.mockResolvedValue({ ...trigger, reply: { isHidden: true } });
		if (reason === 'hidden quote') f.packer.pack.mockResolvedValue({ ...trigger, renote: { isHidden: true } });
		if (reason === 'edited text') f.query.getOne.mockResolvedValue({ ...trigger, text: 'changed' });
		if (reason === 'converted visibility') f.packer.pack.mockResolvedValue({ ...trigger, visibility: 'followers', isHidden: false });
		expect((await f.service.show(me as never)).round).toBeNull();
		await expect(f.service.vote(me as never, 'round1', 'e0')).rejects.toMatchObject({ code: 'NO_SUCH_ROUND' });
		expect(f.store.vote.mock.calls.length > 0).toBe(false);
	});
	test('passes an anonymous viewer to the note packer so signin-required content stays hidden', async () => {
		const f = fixture();
		f.packer.pack.mockResolvedValueOnce({ ...trigger, isHidden: true });
		expect((await f.service.show(null)).round).toBeNull();
		expect(f.packer.pack).toHaveBeenCalledWith(expect.anything(), null, { detail: true, skipHide: false });
	});
	test.each(['deleted', 'remote', 'renamed', 'image changed', 'sensitive', 'restricted'])('fails closed when a candidate becomes %s', async (reason) => {
		const f = fixture();
		const changed = metadata().candidates.map(candidate => dbEmoji(candidate.id));
		if (reason === 'deleted') changed.pop();
		if (reason === 'remote') changed[0].host = 'remote.example' as never;
		if (reason === 'renamed') changed[0].name = 'another';
		if (reason === 'image changed') changed[0].publicUrl = 'https://media.example/changed.webp';
		if (reason === 'sensitive') changed[0].isSensitive = true;
		if (reason === 'restricted') changed[0].roleIdsThatCanBeUsedThisEmojiAsReaction = ['role'];
		f.emojis.findBy.mockResolvedValue(changed);
		expect((await f.service.show(me as never)).round).toBeNull();
		await expect(f.service.vote(me as never, 'round1', 'e0')).rejects.toMatchObject({ code: 'NO_SUCH_ROUND' });
		expect(f.store.vote.mock.calls.length > 0).toBe(false);
	});
	test('does not use one round authorization for a replacement round during the request', async () => {
		const f = fixture();
		f.packer.pack.mockImplementationOnce(async () => {
			f.setRound({ ...metadata(), id: 'round2', noteId: 'round2' });
			return { ...trigger };
		});
		expect((await f.service.show(me as never)).round).toBeNull();
	});
	test('an old anchor or round ID never resolves to a different active round', async () => {
		const f = fixture();
		expect((await f.service.show(me as never, 'oldNote')).round).toBeNull();
		await expect(f.service.vote(me as never, 'oldRound', 'e0')).rejects.toMatchObject({ code: 'NO_SUCH_ROUND' });
		expect(f.query.getOne).not.toHaveBeenCalled();
	});
	test.each(['NO_SUCH_ROUND', 'VOTING_CLOSED', 'ALREADY_VOTED', 'INVALID_EMOJI'])('preserves atomic coordinator rejection %s without reporting success', async (code) => {
		const f = fixture();
		f.setCastResult(code);
		await expect(f.service.vote(me as never, 'round1', 'e0')).rejects.toMatchObject({ code });
	});
	test('never trusts a submitted user ID or another candidate when composing the cast', async () => {
		const f = fixture();
		await expect(f.service.vote(me as never, 'round1', 'unknown')).rejects.toMatchObject({ code: 'INVALID_EMOJI' });
		await f.service.vote(me as never, 'round1', 'e0');
		expect(f.store.vote).toHaveBeenCalledWith('round1', me.id, 'e0');
	});
	test.each([{ ...me, isSuspended: true }, { ...me, movedToUri: 'https://remote.example/u' }, { ...me, host: 'remote.example' }])('rejects ineligible voting identity %j', async (user) => {
		const f = fixture();
		await expect(f.service.vote(user as never, 'round1', 'e0')).rejects.toMatchObject({ code: 'NO_SUCH_ROUND' });
		expect(f.store.read).not.toHaveBeenCalled();
		expect(f.store.vote).not.toHaveBeenCalled();
	});
	test('does not substitute stale authorization if a fresh database check fails', async () => {
		const f = fixture();
		await f.service.show(me as never);
		f.query.getOne.mockRejectedValueOnce(new Error('database unavailable'));
		await expect(f.service.show(me as never)).rejects.toThrow('database unavailable');
	});
});

describe('LTL emoji vote API schemas', () => {
	test('limits both endpoints and protects anonymous writes and OAuth access', () => {
		expect(showMeta).toMatchObject({ requireCredential: false, kind: 'read:account', limit: { duration: 60_000, max: 180 } });
		expect(voteMeta).toMatchObject({ requireCredential: true, prohibitMoved: true, kind: 'write:votes', limit: { duration: 60_000, max: 30 } });
	});
	test('allows current and note-specific reads while rejecting caller supplied ownership or oversized IDs', async () => {
		const service = { show: vi.fn(async () => ({ serverNow: startedAt, round: null })) };
		const endpoint = new ShowEndpoint(service as never);
		await endpoint.exec({}, null, null, null);
		await endpoint.exec({ noteId: 'round1' }, me as never, null, null);
		expect(service.show).toHaveBeenNthCalledWith(1, null, undefined);
		expect(service.show).toHaveBeenNthCalledWith(2, me, 'round1');
		for (const params of [{ noteId: '' }, { noteId: 'x'.repeat(33) }, { noteId: 'round-1' }, { userId: 'victim' }]) {
			await expect(endpoint.exec(params, me as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		expect(service.show).toHaveBeenCalledTimes(2);
	});
	test('takes voter identity from credentials, rejects extra input and maps service errors', async () => {
		const service = { vote: vi.fn(async () => ({ serverNow: startedAt, round: null })) };
		const endpoint = new VoteEndpoint(service as never);
		await endpoint.exec({ roundId: 'round1', emojiId: 'e0' }, me as never, null, null);
		expect(service.vote).toHaveBeenCalledWith(me, 'round1', 'e0');
		for (const params of [{}, { roundId: 'round1' }, { roundId: 'round1', emojiId: 'e0', userId: 'victim' }, { roundId: 'round1', emojiId: 'x'.repeat(33) }]) {
			await expect(endpoint.exec(params, me as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		}
		service.vote.mockRejectedValueOnce(new LtlEmojiVoteError('ALREADY_VOTED'));
		await expect(endpoint.exec({ roundId: 'round1', emojiId: 'e0' }, me as never, null, null)).rejects.toMatchObject({ code: 'ALREADY_VOTED' });
	});
});
