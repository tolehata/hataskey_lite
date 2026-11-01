/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HataigoService } from '@/core/HataigoService.js';
import { HataigoGameEntityService } from '@/core/entities/HataigoGameEntityService.js';
import { MiUser } from '@/models/User.js';
import type { MiHataigoGame } from '@/models/HataigoGame.js';
import { createClock } from '@/misc/hataigo/clock.js';
import { rebuildHataigo } from '@/misc/hataigo/domain.js';
import { announcementVote, emptyAnnouncementState, defaultSettings, visibilityVote } from '@/misc/hataigo/types.js';
import type { EntityManager } from 'typeorm';

vi.mock('@/core/GlobalEventService.js', () => ({ GlobalEventService: class {} }));
vi.mock('@/core/NoteCreateService.js', () => ({ NoteCreateService: class {} }));
vi.mock('@/core/IdService.js', () => ({ IdService: class {} }));
vi.mock('@/core/entities/UserEntityService.js', () => ({ UserEntityService: class {} }));

const NOW = 10000000;
const user = (id: string, patch: Partial<MiUser> = {}) => ({ id, username: id, name: null, host: null, isSuspended: false, isDeleted: false, ...patch } as MiUser);
const alice = user('alice');
const bob = user('bob');
const stranger = user('stranger');

function waiting(patch: Partial<MiHataigoGame> = {}): MiHataigoGame {
	return { id: 'game1', createdAt: new Date(NOW), startedAt: null, endedAt: null, user1Id: alice.id, user2Id: bob.id, black: null, phase: 'waiting', settings: defaultSettings(9), user1Ready: false, user2Ready: false, isInvitation: false, invitationAccepted: true, result: null, actions: [], clockState: null, deadlineAt: null, visibility: { user1: visibilityVote(), user2: visibilityVote() }, announcements: { user1: announcementVote(), user2: announcementVote() }, announcementState: { user1: emptyAnnouncementState(), user2: emptyAnnouncementState() }, allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false, revision: 0, ...patch };
}

function active(patch: Partial<MiHataigoGame> = {}): MiHataigoGame {
	const settings = { ...defaultSettings(9), clock: { kind: 'byoyomi' as const, mainSec: 300, periodSec: 30, periods: 3 } };
	return waiting({ startedAt: new Date(NOW), phase: 'playing', black: 1, user1Ready: true, user2Ready: true, settings, clockState: createClock(settings.clock, 'black', NOW), deadlineAt: new Date(NOW + 390000), ...patch });
}

function matches(row: object, where: object): boolean {
	return Object.entries(where).every(([key, expected]) => {
		const actual = (row as Record<string, unknown>)[key];
		if (expected && typeof expected === 'object' && '_type' in expected) {
			const op = expected as { _type: string; _value?: unknown };
			if (op._type === 'isNull') return actual === null;
			if (op._type === 'not') return op._value && typeof op._value === 'object' && '_type' in op._value && op._value._type === 'isNull' ? actual !== null : actual !== op._value;
			if (op._type === 'lessThan') return actual instanceof Date && op._value instanceof Date && actual < op._value;
			if (op._type === 'moreThan') return actual instanceof Date && op._value instanceof Date && actual > op._value;
		}
		return actual === expected;
	});
}

function fixture(initial = active()) {
	const rows = new Map<string, MiHataigoGame>([[initial.id, structuredClone(initial)]]);
	const people = new Map([alice, bob, stranger].map(person => [person.id, person]));
	const blocked: { blockerId: string; blockeeId: string }[] = [];
	const muted: { muterId: string; muteeId: string; expiresAt: Date | null }[] = [];
	const follows: { followerId: string; followeeId: string }[] = [];
	const findRow = (where: object | object[]) => [...rows.values()].find(row => Array.isArray(where) ? where.some(condition => matches(row, condition)) : matches(row, where));
	const query = { where: vi.fn(() => query), orderBy: vi.fn(() => query), take: vi.fn(() => query), getMany: vi.fn(async () => [...rows.values()].filter(row => row.announcementState.user1.status === 'pending' || row.announcementState.user2.status === 'pending')) };
	const repository = {
		createQueryBuilder: vi.fn(() => query),
		findOneBy: vi.fn(async (where: object) => { const row = findRow(where); return row ? structuredClone(row) : null; }),
		findOne: vi.fn(async ({ where, lock }: { where: object | object[]; lock?: { mode: string } }) => { if (lock) expect(lock.mode).toBe('pessimistic_write'); const row = findRow(where); return row ? structuredClone(row) : null; }),
		find: vi.fn(async ({ where }: { where: object | object[] }) => [...rows.values()].filter(row => Array.isArray(where) ? where.some(condition => matches(row, condition)) : matches(row, where)).map(row => structuredClone(row))),
		create: vi.fn((value: MiHataigoGame) => structuredClone(value)),
		save: vi.fn(async (row: MiHataigoGame) => { rows.set(row.id, structuredClone(row)); return structuredClone(row); }),
		countBy: vi.fn(async (where: { user1Id?: string; user2Id?: string }[]) => [...rows.values()].filter(row => row.phase !== 'ended' && where.some(condition => condition.user1Id === row.user1Id || condition.user2Id === row.user2Id)).length),
	};
	const userRepository = {
		findOneBy: vi.fn(async (where: object) => [...people.values()].find(person => matches(person, where)) ?? null),
		findOne: vi.fn(async ({ where, lock }: { where: object; lock: { mode: string } }) => { expect(lock.mode).toBe('pessimistic_read'); return [...people.values()].find(person => matches(person, where)) ?? null; }),
	};
	const manager = { getRepository: (entity: unknown) => entity === MiUser ? userRepository : repository, query: vi.fn(async () => []) };
	let queue = Promise.resolve();
	const db = { transaction: vi.fn(<T>(operation: (manager: EntityManager) => Promise<T>) => {
		const result = queue.then(() => operation(manager as unknown as EntityManager));
		queue = result.then(() => undefined, () => undefined);
		return result;
	}) };
	const values = new Map<string, string>();
	const sorted = new Map<string, Map<string, number>>();
	const redis = {
		eval: vi.fn(async (script: string, _keys: number, key: string, value: string | number) => {
			if (script.includes('INCR')) { const count = Number(values.get(key) ?? '0') + 1; values.set(key, String(count)); return count; }
			if (values.get(key) === value) values.delete(key);
			return 1;
		}),
		get: vi.fn(async (key: string) => values.get(key) ?? null),
		set: vi.fn(async (key: string, value: string, ...args: (string | number)[]) => { if (args.includes('NX') && values.has(key)) return null; values.set(key, value); return 'OK'; }),
		del: vi.fn(async (...keys: string[]) => { keys.forEach(key => values.delete(key)); return keys.length; }),
		zadd: vi.fn(async (key: string, score: number, id: string) => { const entries = sorted.get(key) ?? new Map<string, number>(); entries.set(id, score); sorted.set(key, entries); return 1; }),
		zrem: vi.fn(async (key: string, id: string) => sorted.get(key)?.delete(id) ? 1 : 0),
		expire: vi.fn(async () => 1),
		zrangebyscore: vi.fn(async (key: string, minimum: number) => [...(sorted.get(key) ?? new Map<string, number>()).entries()].filter(([, score]) => score >= minimum).sort((a, b) => a[1] - b[1]).map(([id]) => id)),
	};
	const events = { publishHataigoGameStream: vi.fn((id: string, _event: string, payload: { revision: number }) => { expect(rows.get(id)?.revision).toBe(payload.revision); }), publishHataigoStream: vi.fn() };
	let id = 1;
	const notes = new Map<string, { id: string; userId: string; userHost: null; text: string }>();
	const noteRepository = { findOneBy: vi.fn(async (where: object) => [...notes.values()].find(note => matches(note, where)) ?? null) };
	const noteCreate = { create: vi.fn(async (author: MiUser, data: { text: string }) => { const note = { id: `note${notes.size + 1}`, userId: author.id, userHost: null, text: data.text }; notes.set(note.id, note); return note; }) };
	const service = new HataigoService(db as never, redis as never, repository as never, userRepository as never, { findOneBy: vi.fn(async (where: object) => follows.find(row => matches(row, where)) ?? null) } as never, { findOne: vi.fn(async ({ where }: { where: object[] }) => blocked.find(row => where.some(condition => matches(row, condition))) ?? null) } as never, { find: vi.fn(async ({ where }: { where: object[] }) => muted.filter(row => where.some(condition => matches(row, condition)))) } as never, { gen: () => `created${id++}` } as never, events as never, { url: 'https://local.example' } as never, noteRepository as never, noteCreate as never);
	return { service, rows, repository, manager, db, redis, values, sorted, blocked, muted, follows, people, events, notes, noteRepository, noteCreate };
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); });

describe('HataIgo locked game mutations', () => {
	test('concurrent same-revision actions serialize under a row lock and only one commits', async () => {
		const f = fixture();
		const outcomes = await Promise.allSettled([f.service.act('game1', alice, { type: 'play', point: { x: 0, y: 0 } }, 0), f.service.act('game1', alice, { type: 'play', point: { x: 1, y: 0 } }, 0)]);
		expect(outcomes.filter(value => value.status === 'fulfilled')).toHaveLength(1);
		expect(f.rows.get('game1')?.actions).toHaveLength(1);
		expect(f.repository.findOne.mock.calls.every(([options]) => options.lock?.mode === 'pessimistic_write')).toBe(true);
		expect(f.events.publishHataigoGameStream).toHaveBeenCalledOnce();
	});

	test('wrong player and forged color/server actions cannot alter authoritative history or clocks', async () => {
		const f = fixture();
		const before = structuredClone(f.rows.get('game1'));
		await expect(f.service.act('game1', stranger, { type: 'pass' }, 0)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(f.service.act('game1', bob, { type: 'play', point: { x: 0, y: 0 } }, 0)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		await expect(f.service.act('game1', alice, { type: 'pass', color: 'white' } as never, 0)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		await expect(f.service.act('game1', alice, { type: 'timeout' } as never, 0)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		await expect(f.service.act('game1', alice, { type: 'play', point: { x: 0.5, y: 0 } }, 0)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		expect(f.rows.get('game1')).toEqual(before);
	});

	test('server replay applies captures and preserves turn ownership', async () => {
		const game = active({ actions: [{ type: 'play', color: 'black', point: { x: 1, y: 0 } }, { type: 'play', color: 'white', point: { x: 0, y: 0 } }] });
		const f = fixture(game);
		const saved = await f.service.act('game1', alice, { type: 'play', point: { x: 0, y: 1 } }, 0);
		const state = rebuildHataigo(saved.settings, saved.actions);
		expect(state.prisoners.black).toBe(1);
		expect(state.board.cells[0]).toBeNull();
		expect(saved.clockState?.runningColor).toBe('white');
	});

	test('scoring resets agreements on new marks and rejects an old-revision acceptance', async () => {
		const f = fixture();
		let game = await f.service.act('game1', alice, { type: 'pass' }, 0);
		game = await f.service.act('game1', bob, { type: 'pass' }, game.revision);
		expect(game.phase).toBe('scoring');
		expect(game.clockState?.runningColor).toBeNull();
		game = await f.service.act('game1', alice, { type: 'acceptScore' }, game.revision);
		const oldRevision = game.revision;
		game = await f.service.act('game1', bob, { type: 'setScoring', marks: { deadStones: [], neutralPoints: [{ x: 0, y: 0 }] } }, game.revision);
		expect(rebuildHataigo(game.settings, game.actions).scoring.acceptedBy).toEqual([]);
		await expect(f.service.act('game1', bob, { type: 'acceptScore' }, oldRevision)).rejects.toMatchObject({ code: 'STALE_REVISION' });
		game = await f.service.act('game1', bob, { type: 'acceptScore' }, game.revision);
		game = await f.service.act('game1', alice, { type: 'acceptScore' }, game.revision);
		expect(game.phase).toBe('ended');
		expect(rebuildHataigo(game.settings, game.actions).result?.reason).toBe('score');
	});

	test('one requester resumes atomically with the opponent playing first and a fresh clock origin', async () => {
		const f = fixture();
		let game = await f.service.act('game1', alice, { type: 'pass' }, 0);
		game = await f.service.act('game1', bob, { type: 'pass' }, game.revision);
		vi.spyOn(Date, 'now').mockReturnValue(NOW + 999999);
		game = await f.service.act('game1', alice, { type: 'requestResume' }, game.revision);
		expect(game.phase).toBe('playing');
		expect(game.actions.slice(-2)).toEqual([{ type: 'requestResume', color: 'black' }, { type: 'acceptResume', color: 'white' }]);
		expect(game.clockState?.runningColor).toBe('white');
		expect(game.clockState?.turnStartedAtMs).toBe(NOW + 999999);
	});

	test('timeout claims recheck the server deadline and stale revision under lock', async () => {
		const f = fixture();
		await expect(f.service.claimTimeout('game1', bob, 0)).rejects.toMatchObject({ code: 'INVALID_STATE' });
		vi.spyOn(Date, 'now').mockReturnValue(NOW + 390000);
		await expect(f.service.claimTimeout('game1', bob, 0)).rejects.toMatchObject({ code: 'INVALID_STATE' });
		vi.spyOn(Date, 'now').mockReturnValue(NOW + 390001);
		const ended = await f.service.claimTimeout('game1', bob, 0);
		expect(ended.phase).toBe('ended');
		expect(ended.clockState?.black).toEqual({ mainRemainingMs: 0, periodsRemaining: 0 });
		expect(rebuildHataigo(ended.settings, ended.actions).result).toEqual({ reason: 'timeout', winner: 'white' });
		await expect(f.service.claimTimeout('game1', bob, 0)).rejects.toMatchObject({ code: 'STALE_REVISION' });
	});

	test('expired byoyomi rows cannot starve the correspondence sweep', async () => {
		const f = fixture(active({ deadlineAt: new Date(NOW - 1), clockState: createClock({ kind: 'byoyomi', mainSec: 300, periodSec: 30, periods: 3 }, 'black', NOW - 390001) }));
		const correspondence = defaultSettings(9, 'correspondence');
		f.rows.set('correspondence', active({ id: 'correspondence', settings: correspondence, deadlineAt: new Date(NOW - 1), clockState: createClock(correspondence.clock, 'black', NOW - 86400001) }));
		expect(await f.service.sweepTimeouts()).toBe(2);
		expect(f.rows.get('game1')?.phase).toBe('ended');
		expect(f.rows.get('correspondence')?.phase).toBe('ended');
	});
});

describe('HataIgo waiting-room settings and equal matching restrictions', () => {
	test('changing settings clears both readiness flags and handicap starts White with zero komi', async () => {
		const f = fixture(waiting());
		let game = await f.service.ready('game1', alice, true, 0);
		expect(game.user1Ready).toBe(true);
		game = await f.service.updateSettings('game1', bob, { handicap: 4 }, game.revision);
		expect(game.user1Ready).toBe(false);
		expect(game.user2Ready).toBe(false);
		expect(game.settings.komi).toBe(0);
		game = await f.service.ready('game1', alice, true, game.revision);
		game = await f.service.ready('game1', bob, true, game.revision);
		expect(game.phase).toBe('playing');
		expect([1, 2]).toContain(game.black);
		expect(rebuildHataigo(game.settings, game.actions).toPlay).toBe('white');
		expect(game.clockState?.runningColor).toBe('white');
	});

	test('publication needs both participants and either participant can later withdraw their own vote', async () => {
		const f = fixture(waiting());
		let game = await f.service.updateSettings('game1', alice, { allowSpectate: true, publicAfterEnd: true }, 0);
		expect(game.allowSpectate).toBe(false);
		expect(game.publicAfterEnd).toBe(false);
		game = await f.service.updateSettings('game1', bob, { allowSpectate: true, publicAfterEnd: true }, game.revision);
		expect(game.allowSpectate).toBe(true);
		game = await f.service.ready('game1', alice, true, game.revision);
		game = await f.service.ready('game1', bob, true, game.revision);
		game = await f.service.updateSettings('game1', alice, { allowSpectate: false, publicAfterEnd: false }, game.revision);
		expect(game.allowSpectate).toBe(false);
		expect(game.publicAfterEnd).toBe(false);
		await expect(f.service.get('game1', stranger)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(f.service.updateSettings('game1', alice, { size: 19 }, game.revision)).rejects.toMatchObject({ code: 'INVALID_STATE' });
	});

	test('private packing rechecks fresh permissions before looking up either participant identity', async () => {
		const f = fixture();
		const users = { pack: vi.fn() };
		const packer = new HataigoGameEntityService(f.service, users as never);
		const forged = active({ phase: 'ended', publicAfterEnd: true });
		await expect(packer.packDetail(forged, stranger)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect(users.pack).not.toHaveBeenCalled();
	});

	test('an invitation is local/following-only, defaults private, and only its recipient can accept', async () => {
		const f = fixture();
		await expect(f.service.invite(alice, bob.id)).rejects.toMatchObject({ code: 'NOT_FOLLOWING' });
		f.follows.push({ followerId: alice.id, followeeId: bob.id });
		const invited = await f.service.invite(alice, bob.id);
		expect(invited.invitationAccepted).toBe(false);
		expect(invited.allowSpectate).toBe(false);
		expect(invited.publicAfterEnd).toBe(false);
		await expect(f.service.ready(invited.id, bob, true, 0)).rejects.toMatchObject({ code: 'INVALID_STATE' });
		await expect(f.service.respondInvite(invited.id, alice, true, 0)).rejects.toMatchObject({ code: 'FORBIDDEN' });
		const accepted = await f.service.respondInvite(invited.id, bob, true, 0);
		expect(accepted.invitationAccepted).toBe(true);
		const again = await f.service.invite(alice, bob.id);
		const declined = await f.service.respondInvite(again.id, bob, false, 0);
		expect(declined.phase).toBe('ended');
		expect(declined.actions).toEqual([]);
	});

	test('reverse-direction blocks and active mutes prevent invites and public spectator reads', async () => {
		const f = fixture(active({ allowSpectate: true }));
		f.follows.push({ followerId: alice.id, followeeId: bob.id });
		f.blocked.push({ blockerId: bob.id, blockeeId: alice.id });
		await expect(f.service.invite(alice, bob.id)).rejects.toMatchObject({ code: 'BLOCKED' });
		f.blocked.length = 0;
		f.muted.push({ muterId: bob.id, muteeId: alice.id, expiresAt: null });
		await expect(f.service.invite(alice, bob.id)).rejects.toMatchObject({ code: 'BLOCKED' });
		f.muted.push({ muterId: bob.id, muteeId: stranger.id, expiresAt: null });
		await expect(f.service.get('game1', stranger)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		f.people.set('remote', user('remote', { host: 'elsewhere.invalid' }));
		await expect(f.service.invite(alice, 'remote')).rejects.toMatchObject({ code: 'NOT_LOCAL' });
	});

	test('free matching separates size/clock kind and blocked candidates remain available to others', async () => {
		const f = fixture();
		expect(await f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi', allowSpectate: true })).toBeNull();
		expect(await f.service.matchAnyUser(bob, { size: 13, clockKind: 'byoyomi' })).toBeNull();
		expect(await f.service.matchAnyUser(bob, { size: 9, clockKind: 'correspondence' })).toBeNull();
		f.blocked.push({ blockerId: alice.id, blockeeId: bob.id });
		expect(await f.service.matchAnyUser(bob, { size: 9, clockKind: 'byoyomi' })).toBeNull();
		expect(f.sorted.get('hataigo:queue:9:byoyomi')?.has(alice.id)).toBe(true);
		const matched = await f.service.matchAnyUser(stranger, { size: 9, clockKind: 'byoyomi', allowSpectate: true });
		expect(matched?.user1Id).toBe(alice.id);
		expect(matched?.user2Id).toBe(stranger.id);
		expect(matched?.allowSpectate).toBe(true);
		expect(f.redis.eval.mock.calls.some(([script]) => script.includes('INCR'))).toBe(true);
	});

	test('a player who accepts any size waits in every size queue and is matched at the other player\'s size', async () => {
		const f = fixture();
		expect(await f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi', anySize: true })).toBeNull();
		for (const size of [9, 13, 19]) expect(f.sorted.get(`hataigo:queue:${size}:byoyomi`)?.has(alice.id), String(size)).toBe(true);
		expect(f.values.get(`hataigo:queue-user:${alice.id}`)).toBe('hataigo:queue:9:byoyomi hataigo:queue:13:byoyomi hataigo:queue:19:byoyomi');
		const matched = await f.service.matchAnyUser(bob, { size: 13, clockKind: 'byoyomi' });
		expect(matched?.user1Id).toBe(alice.id);
		expect(matched?.settings.size).toBe(13);
		for (const size of [9, 13, 19]) expect(f.sorted.get(`hataigo:queue:${size}:byoyomi`)?.has(alice.id), String(size)).toBe(false);
		expect(f.values.has(`hataigo:queue-user:${alice.id}`)).toBe(false);
	});

	test('a fixed-size player is not matched with someone waiting only for another size, and any-size searchers reach them', async () => {
		const f = fixture();
		expect(await f.service.matchAnyUser(alice, { size: 19, clockKind: 'byoyomi' })).toBeNull();
		expect(await f.service.matchAnyUser(bob, { size: 9, clockKind: 'byoyomi' })).toBeNull();
		const matched = await f.service.matchAnyUser(stranger, { size: 9, clockKind: 'correspondence', anySize: true });
		expect(matched).toBeNull();
		const flexible = await f.service.matchAnyUser(stranger, { size: 13, clockKind: 'byoyomi', anySize: true });
		expect(flexible?.user2Id).toBe(stranger.id);
		// 第一希望 13 に誰もいなければ 9→19 の順に見る。9 路で待っていた bob と組む
		expect(flexible?.user1Id).toBe(bob.id);
		expect(flexible?.settings.size).toBe(9);
		expect(f.sorted.get('hataigo:queue:19:byoyomi')?.has(alice.id)).toBe(true);
		expect(f.sorted.get('hataigo:queue:13:byoyomi')?.has(stranger.id) ?? false).toBe(false);
	});

	test('rejects a non-boolean anySize', async () => {
		const f = fixture();
		await expect(f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi', anySize: 'yes' as unknown as boolean })).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
	});

	test('expired mutes allow matching and cancellation removes queued preferences', async () => {
		const f = fixture();
		f.muted.push({ muterId: alice.id, muteeId: bob.id, expiresAt: new Date(NOW - 1) });
		await f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi' });
		await f.service.cancelMatch(alice);
		expect(f.sorted.get('hataigo:queue:9:byoyomi')?.has(alice.id)).toBe(false);
		expect(f.values.has(`hataigo:queue-options:${alice.id}`)).toBe(false);
		await f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi' });
		expect((await f.service.matchAnyUser(bob, { size: 9, clockKind: 'byoyomi' }))?.user1Id).toBe(alice.id);
	});

	test('uniform rate limits reject the same excessive request count without reading user policies', async () => {
		const f = fixture();
		f.values.set('hataigo:rate:invite:alice', '10');
		await expect(f.service.invite(alice, bob.id)).rejects.toMatchObject({ code: 'RATE_LIMIT' });
		expect(f.db.transaction).not.toHaveBeenCalled();
	});
});

describe('HataIgo reviewed abuse and race regressions', () => {
	test('stream coordinates and marks cannot carry arbitrary text into stored state', async () => {
		const f = fixture();
		await expect(f.service.act('game1', alice, { type: 'play', point: { x: 0, y: 0, message: 'private text' } } as never, 0)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		let game = await f.service.act('game1', alice, { type: 'pass' }, 0);
		game = await f.service.act('game1', bob, { type: 'pass' }, game.revision);
		await expect(f.service.act('game1', alice, { type: 'setScoring', marks: { deadStones: [], neutralPoints: [{ x: 0, y: 0, message: 'private text' }] } } as never, game.revision)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		await expect(f.service.act('game1', alice, { type: 'setScoring', marks: { deadStones: [], neutralPoints: [], message: 'private text' } } as never, game.revision)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		expect(JSON.stringify(f.rows.get('game1'))).not.toContain('private text');
	});

	test('outsiders receive the same invitation denial irrespective of a supplied revision', async () => {
		const f = fixture(waiting({ isInvitation: true, invitationAccepted: false, revision: 7 }));
		for (const revision of [0, 7, 8]) await expect(f.service.respondInvite('game1', stranger, true, revision)).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	test('duplicate invitations reuse one outstanding pair and pending recipient invites do not consume active capacity', async () => {
		const f = fixture();
		f.follows.push({ followerId: alice.id, followeeId: bob.id });
		const first = await f.service.invite(alice, bob.id);
		const repeated = await f.service.invite(alice, bob.id);
		expect(repeated.id).toBe(first.id);
		for (let index = 0; index < 10; index++) f.rows.set(`incoming${index}`, waiting({ id: `incoming${index}`, user1Id: `sender${index}`, user2Id: bob.id, isInvitation: true, invitationAccepted: false }));
		await f.service.matchAnyUser(bob, { size: 9, clockKind: 'byoyomi' });
		const game = await f.service.matchAnyUser(stranger, { size: 9, clockKind: 'byoyomi' });
		expect(game?.user1Id).toBe(bob.id);
	});

	test('accepting an invite rechecks both active-game limits under advisory locks', async () => {
		const f = fixture(waiting({ isInvitation: true, invitationAccepted: false }));
		for (let index = 0; index < 8; index++) f.rows.set(`busy${index}`, active({ id: `busy${index}`, user1Id: bob.id, user2Id: `opponent${index}` }));
		await expect(f.service.respondInvite('game1', bob, true, 0)).rejects.toMatchObject({ code: 'LIMIT', limitUserId: bob.id });
		expect(f.rows.get('game1')?.invitationAccepted).toBe(false);
		expect(f.manager.query).toHaveBeenCalled();
	});

	test('a full queued candidate is dropped so a later available candidate can match', async () => {
		const f = fixture();
		await f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi' });
		await f.service.matchAnyUser(bob, { size: 9, clockKind: 'byoyomi' }).then(game => { if (game) f.rows.delete(game.id); });
		// Recreate queue order explicitly to model a player whose capacity filled while queued.
		f.sorted.set('hataigo:queue:9:byoyomi', new Map([[alice.id, NOW], [bob.id, NOW]]));
		for (const person of [alice, bob]) { f.values.set(`hataigo:queue-user:${person.id}`, 'hataigo:queue:9:byoyomi'); f.values.set(`hataigo:queue-options:${person.id}`, JSON.stringify({ size: 9, clockKind: 'byoyomi' })); }
		for (let index = 0; index < 7; index++) f.rows.set(`full${index}`, active({ id: `full${index}`, user1Id: alice.id, user2Id: `other${index}` }));
		const matched = await f.service.matchAnyUser(stranger, { size: 9, clockKind: 'byoyomi' });
		expect(matched?.user1Id).toBe(bob.id);
		expect(f.values.has(`hataigo:queue-options:${alice.id}`)).toBe(false);
	});

	test('cancelling an in-flight queue insertion waits for it and removes all old queue data', async () => {
		const f = fixture();
		let signalEntered: (() => void) | undefined;
		let release: (() => void) | undefined;
		const entered = new Promise<void>(resolve => { signalEntered = resolve; });
		const held = new Promise<void>(resolve => { release = resolve; });
		const original = f.redis.zadd.getMockImplementation();
		f.redis.zadd.mockImplementationOnce(async (key, score, id) => { signalEntered?.(); await held; if (!original) throw new Error('Missing queue implementation'); return original(key, score, id); });
		const matching = f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi' });
		await entered;
		let cancelled = false;
		const cancellation = f.service.cancelMatch(alice).then(() => { cancelled = true; });
		await Promise.resolve();
		expect(cancelled).toBe(false);
		release?.();
		await matching;
		await cancellation;
		expect(f.sorted.get('hataigo:queue:9:byoyomi')?.has(alice.id)).toBe(false);
		expect(f.values.has(`hataigo:queue-options:${alice.id}`)).toBe(false);
	});

	test('stale pending invitations are retired without deleting their rows', async () => {
		const f = fixture(waiting({ isInvitation: true, invitationAccepted: false, createdAt: new Date(NOW - 86400001) }));
		expect(await f.service.invitations(bob)).toEqual([]);
		expect(await f.service.sweepTimeouts()).toBe(1);
		expect(f.rows.get('game1')?.phase).toBe('ended');
		expect(f.rows.has('game1')).toBe(true);
	});
});

describe('HataIgo announcement consent and durable outbox', () => {
	test('default-off never posts; enabled alone cannot name the opponent', async () => {
		for (const enabled of [false, true]) {
			const game = waiting(); game.announcements.user1.enabled = enabled;
			const f = fixture(game);
			const first = await f.service.ready(game.id, alice, true, 0);
			await f.service.ready(game.id, bob, true, first.revision);
			await f.service.processAnnouncements(game.id);
			expect(f.noteCreate.create).not.toHaveBeenCalled();
			expect(f.rows.get(game.id)?.announcementState.user1.status).toBe('none');
		}
	});

	test('both explicit consents produce only the author-selected local note and serialize retries', async () => {
		const game = waiting();
		game.announcements.user1 = { enabled: true, visibility: 'followers', allowName: false };
		game.announcements.user2.allowName = true;
		const f = fixture(game);
		f.people.set(bob.id, user(bob.id, { name: '<evil>\nBob' }));
		const first = await f.service.ready(game.id, alice, true, 0);
		await f.service.ready(game.id, bob, true, first.revision);
		await Promise.all([f.service.processAnnouncements(game.id), f.service.processAnnouncements(game.id)]);
		expect(f.noteCreate.create).toHaveBeenCalledOnce();
		expect(f.noteCreate.create).toHaveBeenCalledWith(alice, { text: 'HataIgo: <plain>evilBob</plain> さんとの対局を始めました。\nhttps://local.example/hataigo/game1', visibility: 'followers', localOnly: true, apMentions: [], apHashtags: [], apEmojis: [] });
		expect(f.rows.get(game.id)?.announcementState.user1).toMatchObject({ status: 'sent', noteId: 'note1', attempts: 1 });
		expect(f.rows.get(game.id)?.announcementState.user2.status).toBe('none');
	});

	test('failed creation is retried after backoff and recovers an inserted note instead of duplicating it', async () => {
		const game = active();
		game.announcements.user1.enabled = true; game.announcements.user2.allowName = true;
		game.announcementState.user1 = { ...emptyAnnouncementState(), status: 'pending', text: 'Fixed consented note' };
		const f = fixture(game);
		f.noteCreate.create.mockRejectedValueOnce(new Error('temporary'));
		await f.service.processAnnouncements(game.id);
		expect(f.rows.get(game.id)?.announcementState.user1).toMatchObject({ status: 'pending', attempts: 1, lastError: 'NOTE_CREATE_FAILED', nextAttemptAtMs: NOW + 2000 });
		await f.service.processAnnouncements(game.id);
		expect(f.noteCreate.create).toHaveBeenCalledOnce();
		// Simulate insertion succeeding before the game/outbox transaction was committed.
		f.notes.set('recovered', { id: 'recovered', userId: alice.id, userHost: null, text: 'Fixed consented note' });
		vi.spyOn(Date, 'now').mockReturnValue(NOW + 2000);
		await f.service.processAnnouncements(game.id);
		expect(f.noteCreate.create).toHaveBeenCalledOnce();
		expect(f.rows.get(game.id)?.announcementState.user1).toMatchObject({ status: 'sent', noteId: 'recovered', attempts: 2, lastError: null });
	});

	test('withdrawals, ended games and deleted/suspended users cancel pending notes before retry', async () => {
		for (const reason of ['own', 'opponent', 'ended', 'deleted', 'suspended'] as const) {
			const game = active(); game.announcements.user1.enabled = true; game.announcements.user2.allowName = true;
			game.announcementState.user1 = { ...emptyAnnouncementState(), status: 'pending', text: 'Do not post' };
			const f = fixture(game);
			if (reason === 'own') await f.service.updateSettings(game.id, alice, { announcement: { enabled: false } }, 0);
			if (reason === 'opponent') await f.service.updateSettings(game.id, bob, { announcement: { allowName: false } }, 0);
			if (reason === 'ended') f.rows.set(game.id, { ...game, phase: 'ended' });
			if (reason === 'deleted') f.people.delete(bob.id);
			if (reason === 'suspended') f.people.set(alice.id, user(alice.id, { isSuspended: true }));
			await f.service.processAnnouncements(game.id);
			expect(f.noteCreate.create).not.toHaveBeenCalled();
			expect(f.rows.get(game.id)?.announcementState.user1.status).toBe('cancelled');
		}
	});

	test('only waiting games can enable or choose visibility; invalid nested fields never persist', async () => {
		const f = fixture(waiting({ user1Ready: true, user2Ready: true }));
		const changed = await f.service.updateSettings('game1', alice, { announcement: { enabled: true, visibility: 'public', allowName: true } }, 0);
		expect(changed.user1Ready || changed.user2Ready).toBe(false);
		expect(changed.announcements.user2).toEqual(announcementVote());
		await expect(f.service.updateSettings('game1', alice, { announcement: { message: 'not chat' } } as never, changed.revision)).rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
		const g = fixture();
		for (const announcement of [{ enabled: true }, { allowName: true }, { visibility: 'home' }]) await expect(g.service.updateSettings('game1', alice, { announcement } as never, 0)).rejects.toMatchObject({ code: 'INVALID_STATE' });
	});

	test('packing hides outbox and preferences from spectators and returns independent mutable rule arrays', async () => {
		const game = active({ allowSpectate: true });
		const f = fixture(game);
		const entity = new HataigoGameEntityService(f.service, { pack: vi.fn(async (person: MiUser) => ({ id: person.id })) } as never);
		const spectator = await entity.packDetail(game.id, stranger);
		expect(spectator.announcements).toBeNull(); expect(spectator.announcementState).toBeNull();
		const packed = await entity.packDetail(game.id, alice);
		expect(packed.announcements?.user1.enabled).toBe(false);
		if (!packed.state) throw new Error('Expected started state');
		expect(typeof packed.state.board.hash).toBe('string');
		packed.state.board.cells[0] = 'white';
		packed.state.scoring.neutralPoints.push({ x: 0, y: 0 });
		const next = await entity.packDetail(game.id, alice);
		expect(next.state?.board.cells[0]).toBeNull();
		expect(next.state?.scoring.neutralPoints).toEqual([]);
	});
});

describe('HataIgo authoritative personal statistics', () => {
	test('resignation and timeout persist the canonical result, then own stats use the finished rows', async () => {
		const f = fixture();
		const resigned = await f.service.act('game1', bob, { type: 'resign' }, 0);
		expect(resigned.result).toEqual({ reason: 'resign', winner: 'black' });
		f.rows.set('timed', active({ id: 'timed', black: 2, clockState: createClock(defaultSettings(9).clock, 'black', NOW - 99999999) }));
		await f.service.claimTimeout('timed', alice, 0);
		expect(f.rows.get('timed')?.result).toEqual({ reason: 'timeout', winner: 'white' });
		expect(await f.service.personalStats(alice)).toEqual({ wins: 2, losses: 0, draws: 0, streak: 2, wins9: 2, wins19: 0, distinctOpponents: 1 });
		expect(await f.service.personalStats(bob)).toMatchObject({ wins: 0, losses: 2, streak: 0, distinctOpponents: 0 });
		const query = f.repository.find.mock.calls.at(-1)?.[0];
		expect(query).not.toHaveProperty('take');
		expect(query).toHaveProperty('select', { id: true, phase: true, startedAt: true, endedAt: true, user1Id: true, user2Id: true, black: true, settings: true, result: true });
	});
});

test('own ongoing games stay visible behind many unaccepted invitations', async () => {
	const f = fixture();
	for (let index = 0; index < 120; index++) f.rows.set(`z${index}`, waiting({ id: `z${index}`, user1Id: `sender${index}`, user2Id: alice.id, isInvitation: true, invitationAccepted: false }));
	let acceptedOnly = false;
	const query = {
		orderBy: vi.fn(() => query), take: vi.fn(() => query),
		andWhere: vi.fn((expression: string) => { if (expression.includes('game.isInvitation = FALSE OR game.invitationAccepted = TRUE')) acceptedOnly = true; return query; }),
		getMany: vi.fn(async () => [...f.rows.values()].filter(game => !acceptedOnly || !game.isInvitation || game.invitationAccepted).sort((a, b) => a.id > b.id ? -1 : 1).slice(0, 100)),
	};
	f.repository.createQueryBuilder.mockReturnValue(query as never);
	const games = await f.service.list(alice, { my: true, ongoing: true });
	expect(games.map(game => game.id)).toEqual(['game1']);
	expect(acceptedOnly).toBe(true);
});

function publicationGate<T>() {
	let release: (value: T) => void = () => { throw new Error('Gate not initialized'); };
	const promise = new Promise<T>(resolve => { release = resolve; });
	return { promise, release };
}

test.each(['playing', 'ended'] as const)('packing rechecks %s publication after deferred participant packing for authenticated and anonymous viewers', async phase => {
	for (const viewer of [stranger, null]) {
		const game = active({ phase, allowSpectate: true, publicAfterEnd: true });
		const f = fixture(game);
		const started = publicationGate<void>(); const resume = publicationGate<void>();
		const users = { pack: vi.fn(async (person: MiUser) => {
			if (person.id === bob.id) { started.release(); await resume.promise; }
			return { id: person.id };
		}) };
		const entity = new HataigoGameEntityService(f.service, users as never);
		const pending = entity.packDetail(game.id, viewer);
		await started.promise;
		const current = f.rows.get(game.id);
		if (!current) throw new Error('Missing test game');
		f.rows.set(game.id, { ...current, allowSpectate: false, publicAfterEnd: false });
		resume.release();
		await expect(pending).rejects.toMatchObject({ code: 'NOT_FOUND' });
	}
});

test.each(['missing', 'softDeleted'] as const)('public records reject a %s participant while remaining private access safely packs null', async state => {
	for (const phase of ['playing', 'ended'] as const) {
		const game = active({ phase, allowSpectate: true, publicAfterEnd: true });
		const f = fixture(game);
		if (state === 'missing') f.people.delete(bob.id);
		else f.people.set(bob.id, user(bob.id, { isDeleted: true }));
		for (const viewer of [stranger, null]) await expect(f.service.get(game.id, viewer)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(f.service.get(game.id, alice)).resolves.toMatchObject({ id: game.id });
		const users = { pack: vi.fn(async (person: MiUser) => ({ id: person.id })) };
		const entity = new HataigoGameEntityService(f.service, users as never);
		const packed = await entity.packDetail(game.id, alice);
		expect(packed.user1).toEqual({ id: alice.id }); expect(packed.user2).toBeNull();
		expect(users.pack.mock.calls.every(([person]) => person.id === alice.id)).toBe(true);
		expect(packed.isParticipant).toBe(true); expect(packed.state).not.toBeNull();
	}
});

test('a packed batch rechecks earlier records after later user packing awaits', async () => {
	const f = fixture(active({ id: 'first', allowSpectate: true }));
	f.rows.set('second', active({ id: 'second', allowSpectate: true }));
	const started = publicationGate<void>(); const resume = publicationGate<void>();
	let bobPacks = 0;
	const users = { pack: vi.fn(async (person: MiUser) => {
		if (person.id === bob.id && ++bobPacks === 2) { started.release(); await resume.promise; }
		return { id: person.id };
	}) };
	const entity = new HataigoGameEntityService(f.service, users as never);
	const pending = entity.packDetailMany(['first', 'second'], stranger);
	await started.promise;
	const first = f.rows.get('first');
	if (!first) throw new Error('Missing first test game');
	f.rows.set(first.id, { ...first, allowSpectate: false });
	resume.release();
	await expect(pending).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('an in-flight stale matching/invitation subject cannot recreate withdrawn participant IDs', async () => {
	const f = fixture();
	f.people.set(alice.id, user(alice.id, { isDeleted: true }));
	await expect(f.service.matchAnyUser(alice, { size: 9, clockKind: 'byoyomi' })).rejects.toMatchObject({ code: 'NOT_LOCAL' });
	f.follows.push({ followerId: alice.id, followeeId: bob.id });
	await expect(f.service.invite(alice, bob.id)).rejects.toMatchObject({ code: 'NOT_LOCAL' });
	expect(f.repository.create).not.toHaveBeenCalled();
	expect(f.values.has('hataigo:queue-user:alice')).toBe(false);
});

test.each(['softDeleted', 'missing'] as const)('no game result can be finalized during the %s withdrawal cleanup gap', async state => {
	const f = fixture(active({ deadlineAt: new Date(NOW - 1), clockState: createClock({ kind: 'byoyomi', mainSec: 300, periodSec: 30, periods: 3 }, 'black', NOW - 390001) }));
	if (state === 'softDeleted') f.people.set(alice.id, user(alice.id, { isDeleted: true }));
	else f.people.delete(alice.id);
	const before = structuredClone(f.rows.get('game1'));
	await expect(f.service.act('game1', bob, { type: 'resign' }, 0)).rejects.toMatchObject({ code: 'INVALID_STATE' });
	await expect(f.service.claimTimeout('game1', bob, 0)).rejects.toMatchObject({ code: 'INVALID_STATE' });
	expect(await f.service.sweepTimeouts()).toBe(0);
	expect(f.rows.get('game1')).toEqual(before);
	expect(f.rows.get('game1')?.result).toBeNull();
});
