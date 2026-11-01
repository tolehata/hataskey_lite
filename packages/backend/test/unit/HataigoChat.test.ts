/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { HataigoChatService } from '@/core/HataigoChatService.js';
import { MiHataigoChatMessage } from '@/models/HataigoChatMessage.js';
import { MiHataigoGame } from '@/models/HataigoGame.js';
import { MiUser } from '@/models/User.js';
import { canViewHataigo } from '@/misc/hataigo/access.js';
import { HataigoError } from '@/misc/hataigo/types.js';
import { hataigoChatRetentionPolicy } from '@/misc/hataigo/chat-policy.js';
import type { HataigoChatPolicy } from '@/misc/hataigo/chat-policy.js';
import type { EntityManager } from 'typeorm';

vi.mock('@/core/HataigoService.js', () => ({ HataigoService: class {} }));
vi.mock('@/core/GlobalEventService.js', () => ({ GlobalEventService: class {} }));
vi.mock('@/core/IdService.js', () => ({ IdService: class {} }));
vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/entities/UserEntityService.js', () => ({ UserEntityService: class {} }));

const NOW = 10000000;
const alice = { id: 'alice', host: null, isDeleted: false, isSuspended: false } as MiUser;
const viewer = { ...alice, id: 'viewer' };
const moderator = { ...alice, id: 'moderator' };
const TEST_POLICY = { retentionDays: 30, disclosureVersion: 'test-only' };

afterEach(() => { vi.restoreAllMocks(); });

function fixture(policy: HataigoChatPolicy | null = TEST_POLICY) {
	vi.spyOn(Date, 'now').mockReturnValue(NOW);
	const game = { id: 'game1', phase: 'playing', user1Id: alice.id, user2Id: 'bob', allowSpectate: true, allowSpectatorChat: true, publicAfterEnd: false } as MiHataigoGame;
	const rows = new Map<string, MiHataigoChatMessage>();
	const messages = {
		findOneBy: vi.fn(async ({ id }: { id: string }) => { const row = rows.get(id); return row ? structuredClone(row) : null; }),
		findOne: vi.fn(async ({ where, lock }: { where: { id: string }; lock: { mode: string } }) => { expect(lock.mode).toBe('pessimistic_write'); const row = rows.get(where.id); return row ? structuredClone(row) : null; }),
		find: vi.fn(async ({ where, take }: { where: { gameId: string }; take: number }) => [...rows.values()].filter(row => row.gameId === where.gameId && row.expiresAt.getTime() > Date.now()).slice(0, take)),
		countBy: vi.fn(async () => rows.size), create: vi.fn((value: MiHataigoChatMessage) => value),
		save: vi.fn(async (value: MiHataigoChatMessage) => { rows.set(value.id, structuredClone(value)); return value; }),
		delete: vi.fn(async () => { for (const [id, row] of rows) if (row.expiresAt.getTime() <= Date.now()) rows.delete(id); }),
	};
	const gameRepository = { findOne: vi.fn(async ({ lock }: { lock: { mode: string } }) => { expect(lock.mode).toBe('pessimistic_write'); return structuredClone(game); }) };
	const manager = { getRepository: (entity: unknown) => entity === MiHataigoGame ? gameRepository : entity === MiUser ? users : messages };
	let serial = Promise.resolve();
	const db = { transaction: vi.fn(<T>(operation: (manager: EntityManager) => Promise<T>) => { const result = serial.then(() => operation(manager as unknown as EntityManager)); serial = result.then(() => undefined, () => undefined); return result; }) };
	const blocked = new Set<string>();
	const assertCanView = vi.fn(async (room: MiHataigoGame, me: MiUser | null) => { if (!canViewHataigo(room, me?.id ?? null) || (me && blocked.has(me.id))) throw new HataigoError('NOT_FOUND'); });
	const people = new Map([alice, { ...alice, id: 'bob' }, viewer, moderator].map(person => [person.id, person]));
	const assertPublicParticipants = vi.fn(async (room: Pick<MiHataigoGame, 'user1Id' | 'user2Id'>) => {
		for (const id of [room.user1Id, room.user2Id]) { const person = id === null ? undefined : people.get(id); if (!person || person.isDeleted) throw new HataigoError('NOT_FOUND'); }
	});
	const games = { assertCanView, assertPublicParticipants, get: vi.fn(async () => structuredClone(game)), rateLimit: vi.fn(async () => {}) };
	const users = { findOneBy: vi.fn(async ({ id, isDeleted }: { id: string; isDeleted?: boolean }) => { const person = people.get(id); return person && (isDeleted === undefined || person.isDeleted === isDeleted) ? person : null; }), findOne: vi.fn(async ({ where, lock }: { where: { id: string }; lock: { mode: string } }) => { expect(lock.mode).toBe('pessimistic_read'); const person = people.get(where.id); return person && person.host === null && !person.isDeleted && !person.isSuspended ? person : null; }) };
	const roles = { isModerator: vi.fn(async (me: MiUser) => me.id === moderator.id) };
	const packer = { pack: vi.fn(async (me: MiUser) => ({ id: me.id })) };
	const events = { publishHataigoGameStream: vi.fn() };
	let id = 0;
	const service = new HataigoChatService(db as never, messages as never, users as never, games as never, { gen: () => `message${++id}` } as never, events as never, roles as never, packer as never, policy);
	return { service, game, rows, messages, gameRepository, db, games, users, roles, events, blocked, people, packer };
}

describe('HataIgo policy-gated public chat', () => {
	test('injected disabled policy prevents new chat reads/writes/moderation but still cleans existing expiries', async () => {
		const f = fixture(null);
		expect(f.service.capability()).toEqual({ enabled: false, retentionDays: null, disclosureVersion: null });
		for (const work of [() => f.service.list('game1', alice), () => f.service.getPacked('secret', alice), () => f.service.post('game1', alice, 'blocked'), () => f.service.delete('secret', moderator, 'abuse')]) await expect(work()).rejects.toMatchObject({ code: 'CHAT_DISABLED' });
		f.rows.set('old', { id: 'old', gameId: 'game1', userId: alice.id, text: 'expired prior-policy row', createdAt: new Date(0), expiresAt: new Date(NOW), policyVersion: 'prior-policy', deletedAt: null, deletedById: null, deletionReason: null });
		await f.service.cleanExpired();
		expect(f.rows.size).toBe(0);
		expect(f.messages.findOneBy).not.toHaveBeenCalled(); expect(f.messages.find).not.toHaveBeenCalled();
		expect(f.messages.save).not.toHaveBeenCalled(); expect(f.messages.delete).toHaveBeenCalledOnce();
		expect(f.db.transaction).not.toHaveBeenCalled(); expect(f.roles.isModerator).not.toHaveBeenCalled(); expect(f.events.publishHataigoGameStream).not.toHaveBeenCalled();
	});

	test('public-room matrix rejects an unsafe positive control and never gives participants a private chat bypass', async () => {
		const cases = [
			{ phase: 'playing', allowSpectate: true, publicAfterEnd: false, chat: true, allowed: true },
			{ phase: 'playing', allowSpectate: false, publicAfterEnd: true, chat: true, allowed: false },
			{ phase: 'scoring', allowSpectate: true, publicAfterEnd: false, chat: true, allowed: true },
			{ phase: 'ended', allowSpectate: true, publicAfterEnd: false, chat: true, allowed: false },
			{ phase: 'ended', allowSpectate: false, publicAfterEnd: true, chat: true, allowed: true },
			{ phase: 'waiting', allowSpectate: true, publicAfterEnd: true, chat: true, allowed: false },
			{ phase: 'playing', allowSpectate: true, publicAfterEnd: false, chat: false, allowed: false },
		] as const;
		const unsafe = () => true;
		expect(cases.filter(item => unsafe() !== item.allowed).length).toBeGreaterThan(0);
		for (const item of cases) {
			const f = fixture(); Object.assign(f.game, { phase: item.phase, allowSpectate: item.allowSpectate, publicAfterEnd: item.publicAfterEnd, allowSpectatorChat: item.chat });
			for (const me of [alice, viewer, null]) {
				if (item.allowed) await expect(f.service.list('game1', me)).resolves.toEqual([]);
				else await expect(f.service.list('game1', me)).rejects.toMatchObject({ code: 'NOT_FOUND' });
			}
		}
	});

	test('test-only policy posts under a game lock with fixed expiry, room cap and shared user frequency limit', async () => {
		const f = fixture();
		const message = await f.service.post('game1', viewer, '  public message  ');
		expect(message).toMatchObject({ userId: viewer.id, text: 'public message', deleted: false, expiresAt: new Date(NOW + 30 * 86400000).toISOString() });
		expect(f.rows.get(message.id)?.policyVersion).toBe('test-only');
		expect(f.gameRepository.findOne).toHaveBeenCalledOnce(); expect(f.roles.isModerator).not.toHaveBeenCalled();
		expect(f.games.rateLimit).toHaveBeenCalledWith(viewer.id, 'chat-post', 1, 3000);
		expect(f.events.publishHataigoGameStream).toHaveBeenCalledWith('game1', 'chatMessage', { messageId: message.id });
		f.messages.countBy.mockResolvedValue(1000);
		await expect(f.service.post('game1', alice, 'full')).rejects.toMatchObject({ code: 'LIMIT' });
		expect(f.messages.save).toHaveBeenCalledOnce();
	});

	test('permission withdrawal before the locked write, blocking and invalid inputs cannot persist text', async () => {
		const f = fixture();
		f.game.allowSpectate = false;
		await expect(f.service.post('game1', alice, 'private')).rejects.toMatchObject({ code: 'NOT_FOUND' });
		f.game.allowSpectate = true; f.blocked.add(viewer.id);
		await expect(f.service.post('game1', viewer, 'blocked')).rejects.toMatchObject({ code: 'NOT_FOUND' });
		for (const text of ['', '  ', 'x'.repeat(501), 'hidden\u0000text']) await expect(f.service.post('game1', alice, text)).rejects.toMatchObject({ code: 'INVALID_ACTION' });
		await expect(f.service.post('game1', { ...alice, host: 'remote' }, 'remote')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(f.messages.save).not.toHaveBeenCalled();
	});

	test('only safety moderators can delete; packed tombstones omit text and all moderation metadata', async () => {
		const f = fixture(); const message = await f.service.post('game1', alice, 'remove this');
		await expect(f.service.delete(message.id, alice, 'abuse')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(f.service.delete(message.id, moderator, 'spam', 'anotherRoom')).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await f.service.delete(message.id, moderator, 'spam');
		const packed = await f.service.getPacked(message.id, null, 'game1');
		expect(packed).toMatchObject({ deleted: true, text: null });
		for (const key of ['deletedById', 'deletionReason', 'policyVersion']) expect(packed).not.toHaveProperty(key);
		expect(f.rows.get(message.id)).toMatchObject({ text: null, deletedById: moderator.id, deletionReason: 'spam' });
		expect(f.events.publishHataigoGameStream).toHaveBeenCalledWith('game1', 'chatDeleted', { messageId: message.id });
		const calls = f.messages.save.mock.calls.length;
		await f.service.delete(message.id, moderator, 'abuse');
		expect(f.messages.save.mock.calls).toHaveLength(calls);
	});

	test('expiry is inclusive, cleanup removes expired tombstones, and missing users pack safely', async () => {
		const f = fixture(); const message = await f.service.post('game1', viewer, 'expires');
		f.people.delete(viewer.id);
		expect((await f.service.getPacked(message.id, alice)).user).toBeNull();
		vi.spyOn(Date, 'now').mockReturnValue(NOW + 30 * 86400000);
		await expect(f.service.getPacked(message.id, viewer)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(f.service.list('game1', viewer)).resolves.toEqual([]);
		await f.service.cleanExpired(); expect(f.rows.size).toBe(0);
	});
});

function deferred<T>() {
	let release: (value: T) => void = () => { throw new Error('Deferred resolver not initialized'); };
	const promise = new Promise<T>(resolve => { release = resolve; });
	return { promise, release };
}

test.each(['user1Id', 'user2Id'] as const)('a remaining participant cannot read or post public chat after %s is withdrawn', async missing => {
	const f = fixture();
	if (missing === 'user1Id') { f.game.user1Id = 'bob'; f.game.user2Id = alice.id; }
	const message = await f.service.post('game1', alice, 'formerly public');
	f.game[missing] = null;
	await expect(f.service.list('game1', alice)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	await expect(f.service.getPacked(message.id, alice)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	await expect(f.service.post('game1', alice, 'remaining private participant')).rejects.toMatchObject({ code: 'NOT_FOUND' });
	expect(f.messages.save).toHaveBeenCalledOnce();
});

test.each(['deletion', 'withdrawal', 'expiry'] as const)('user packing cannot return an old chat body after concurrent %s', async change => {
	const f = fixture();
	const message = await f.service.post('game1', alice, 'sensitive old body');
	const started = deferred<void>();
	const packed = deferred<{ id: string }>();
	f.packer.pack.mockImplementationOnce(() => { started.release(); return packed.promise; });
	const reading = f.service.getPacked(message.id, alice, 'game1');
	await started.promise;
	if (change === 'deletion') await f.service.delete(message.id, moderator, 'abuse');
	if (change === 'withdrawal') f.game.allowSpectate = false;
	if (change === 'expiry') vi.spyOn(Date, 'now').mockReturnValue(NOW + 30 * 86400000);
	packed.release({ id: alice.id });
	if (change === 'deletion') await expect(reading).resolves.toMatchObject({ deleted: true, text: null });
	else await expect(reading).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('a batch rechecks room publication after the final individual message was packed', async () => {
	const f = fixture();
	await f.service.post('game1', alice, 'public before batch');
	const original = f.service.getPacked;
	vi.spyOn(f.service, 'getPacked').mockImplementationOnce(async (...args) => {
		const message = await original(...args);
		f.game.allowSpectatorChat = false;
		return message;
	});
	await expect(f.service.list('game1', alice)).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test.each(['missing', 'softDeleted'] as const)('public chat rejects a %s participant even for the remaining participant and anonymous readers', async state => {
	const f = fixture();
	const message = await f.service.post('game1', alice, 'formerly public');
	if (state === 'missing') f.people.delete('bob');
	else f.people.set('bob', { ...alice, id: 'bob', isDeleted: true });
	for (const viewer of [alice, null]) {
		await expect(f.service.list('game1', viewer)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(f.service.getPacked(message.id, viewer)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	}
	await expect(f.service.post('game1', alice, 'private leftover chat')).rejects.toMatchObject({ code: 'NOT_FOUND' });
	expect(f.messages.save).toHaveBeenCalledOnce();
	expect(f.games.assertPublicParticipants).toHaveBeenCalled();
});

test('approved production chat policy enables exactly 30-day retention with a fixed disclosure version', () => {
	expect(hataigoChatRetentionPolicy).toEqual({ retentionDays: 30, disclosureVersion: 'hataigo-chat-2026-10-20-v1' });
	const f = fixture(hataigoChatRetentionPolicy);
	expect(f.service.capability()).toEqual({ enabled: true, retentionDays: 30, disclosureVersion: 'hataigo-chat-2026-10-20-v1' });
});

test('stale authenticated author/moderator objects cannot recreate withdrawn user references', async () => {
	const f = fixture();
	const message = await f.service.post('game1', alice, 'existing');
	f.people.set(viewer.id, { ...viewer, isDeleted: true });
	await expect(f.service.post('game1', viewer, 'stale session')).rejects.toMatchObject({ code: 'FORBIDDEN' });
	f.people.set(moderator.id, { ...moderator, isDeleted: true });
	await expect(f.service.delete(message.id, moderator, 'abuse')).rejects.toMatchObject({ code: 'FORBIDDEN' });
	expect(f.messages.save).toHaveBeenCalledOnce();
});

test.each(['softDeleted', 'missing'] as const)('public chat masks a %s author immediately while withdrawal cleanup is pending', async state => {
	const f = fixture(); const message = await f.service.post('game1', viewer, 'body retains its expiry');
	if (state === 'softDeleted') f.people.set(viewer.id, { ...viewer, isDeleted: true });
	else f.people.delete(viewer.id);
	const packed = await f.service.getPacked(message.id, null);
	expect(packed).toMatchObject({ userId: null, user: null, text: 'body retains its expiry', expiresAt: message.expiresAt });
});

test('a soft-deleted author is masked after deferred user packing even before persistent anonymization runs', async () => {
	const f = fixture(); const message = await f.service.post('game1', viewer, 'still public body');
	const started = deferred<void>(); const resume = deferred<{ id: string }>();
	f.packer.pack.mockImplementationOnce(() => { started.release(); return resume.promise; });
	const pending = f.service.getPacked(message.id, alice);
	await started.promise;
	f.people.set(viewer.id, { ...viewer, isDeleted: true });
	resume.release({ id: viewer.id });
	expect(await pending).toMatchObject({ userId: null, user: null, text: 'still public body' });
});
