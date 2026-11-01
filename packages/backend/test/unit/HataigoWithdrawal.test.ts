/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { HataigoWithdrawalService } from '@/core/HataigoWithdrawalService.js';
import { HataigoService } from '@/core/HataigoService.js';
import { HataigoGameEntityService } from '@/core/entities/HataigoGameEntityService.js';
import { HataigoChatService } from '@/core/HataigoChatService.js';
import { MiHataigoGame } from '@/models/HataigoGame.js';
import { MiHataigoChatMessage } from '@/models/HataigoChatMessage.js';
import { MiUser } from '@/models/User.js';
import { announcementVote, emptyAnnouncementState, visibilityVote, defaultSettings } from '@/misc/hataigo/types.js';
import { createClock } from '@/misc/hataigo/clock.js';
import type { EntityManager } from 'typeorm';

vi.mock('@/core/GlobalEventService.js', () => ({ GlobalEventService: class {} }));
vi.mock('@/core/IdService.js', () => ({ IdService: class {} }));
vi.mock('@/core/NoteCreateService.js', () => ({ NoteCreateService: class {} }));
vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/entities/UserEntityService.js', () => ({ UserEntityService: class {} }));

const NOW = 10000000;
const alice = { id: 'alice', host: null, isDeleted: false, isSuspended: false } as MiUser;
const bob = { ...alice, id: 'bob' };
const carol = { ...alice, id: 'carol' };
afterEach(() => { vi.restoreAllMocks(); });

function game(id: string, patch: Partial<MiHataigoGame> = {}): MiHataigoGame {
	const settings = defaultSettings(9);
	return { id, createdAt: new Date(0), startedAt: new Date(0), endedAt: null, user1Id: alice.id, user2Id: bob.id, black: 1, phase: 'playing', settings, user1Ready: true, user2Ready: true, isInvitation: false, invitationAccepted: true, result: null, actions: [], clockState: createClock(settings.clock, 'black', NOW), deadlineAt: new Date(NOW + 10000), visibility: { user1: visibilityVote({ allowSpectate: true, allowSpectatorChat: true, publicAfterEnd: true }), user2: visibilityVote({ allowSpectate: true, allowSpectatorChat: true, publicAfterEnd: true }) }, announcements: { user1: announcementVote({ enabled: true, allowName: true }), user2: announcementVote({ enabled: true, allowName: true }) }, announcementState: { user1: { ...emptyAnnouncementState(), status: 'pending', text: 'Bob versus Alice', noteId: 'ownnote' }, user2: { ...emptyAnnouncementState(), status: 'sent', text: 'Alice versus Bob', noteId: 'opponentnote' } }, allowSpectate: true, allowSpectatorChat: true, publicAfterEnd: true, revision: 1, ...patch };
}

function matches(row: object, where: object): boolean {
	return Object.entries(where).every(([key, expected]) => {
		const actual = (row as Record<string, unknown>)[key];
		if (expected && typeof expected === 'object' && '_type' in expected) {
			const op = expected as { _type: string; _value: unknown };
			if (op._type === 'moreThan') return typeof actual === 'string' && typeof op._value === 'string' && actual > op._value;
			if (op._type === 'isNull') return actual === null;
		}
		return actual === expected;
	});
}

function fixture() {
	vi.spyOn(Date, 'now').mockReturnValue(NOW);
	const rows = new Map([game('playing'), game('scoring', { phase: 'scoring' }), game('waiting', { phase: 'waiting', startedAt: null }), game('ended', { phase: 'ended', endedAt: new Date(1), result: { reason: 'resign', winner: 'black' }, actions: [{ type: 'resign', color: 'white' }] }), game('unrelated', { user1Id: bob.id, user2Id: carol.id })].map(row => [row.id, row]));
	const chat = new Map<string, MiHataigoChatMessage>([['message', { id: 'message', gameId: 'playing', userId: alice.id, text: 'public chat', createdAt: new Date(0), expiresAt: new Date(NOW + 30 * 86400000), policyVersion: 'approved', deletedAt: null, deletedById: alice.id, deletionReason: null }], ['spectator', { id: 'spectator', gameId: 'unrelated', userId: alice.id, text: 'spectator post', createdAt: new Date(0), expiresAt: new Date(NOW + 30 * 86400000), policyVersion: 'approved', deletedAt: null, deletedById: null, deletionReason: null }]]);
	const people = new Map([alice, bob, carol].map(person => [person.id, person]));
	const select = <T extends object>(values: Iterable<T>, where: object | object[]) => [...values].filter(row => Array.isArray(where) ? where.some(condition => matches(row, condition)) : matches(row, where));
	const games = {
		find: vi.fn(async ({ where, take }: { where: object | object[]; take?: number }) => select(rows.values(), where).sort((a, b) => a.id.localeCompare(b.id)).slice(0, take ?? Infinity).map(row => structuredClone(row))),
		findOneBy: vi.fn(async (where: object) => structuredClone(select(rows.values(), where)[0] ?? null)),
		findOne: vi.fn(async ({ where, lock }: { where: object; lock: { mode: string } }) => { expect(lock.mode).toBe('pessimistic_write'); return structuredClone(select(rows.values(), where)[0] ?? null); }),
		save: vi.fn(async (row: MiHataigoGame) => { rows.set(row.id, structuredClone(row)); return row; }),
	};
	const messages = {
		find: vi.fn(async ({ where, take }: { where: object; take?: number }) => select(chat.values(), where).slice(0, take ?? Infinity).map(row => structuredClone(row))),
		findOneBy: vi.fn(async (where: object) => structuredClone(select(chat.values(), where)[0] ?? null)),
		update: vi.fn(async (where: object, patch: Partial<MiHataigoChatMessage>) => { const found = select(chat.values(), where); for (const row of found) chat.set(row.id, { ...row, ...patch }); return { affected: found.length }; }),
	};
	const users = { findOneBy: vi.fn(async (where: object) => select(people.values(), where)[0] ?? null) };
	const manager = { getRepository: (entity: unknown) => entity === MiHataigoGame ? games : entity === MiHataigoChatMessage ? messages : users };
	let serial = Promise.resolve();
	const db = { transaction: vi.fn(<T>(operation: (manager: EntityManager) => Promise<T>) => { const result = serial.then(() => operation(manager as unknown as EntityManager)); serial = result.then(() => undefined, () => undefined); return result; }) };
	const values = new Map([['hataigo:queue-user:alice', 'hataigo:queue:9:byoyomi'], ['hataigo:queue-options:alice', 'options']]);
	const redis = { set: vi.fn(async (key: string, value: string) => { if (values.has(key)) return null; values.set(key, value); return 'OK'; }), get: vi.fn(async (key: string) => values.get(key) ?? null), del: vi.fn(async (...keys: string[]) => { keys.forEach(key => values.delete(key)); return 1; }), zrem: vi.fn(async () => 1), eval: vi.fn(async (_script: string, _n: number, key: string, token: string) => { if (values.get(key) === token) values.delete(key); return 1; }) };
	const events = { publishHataigoGameStream: vi.fn() };
	const withdrawal = new HataigoWithdrawalService(db as never, redis as never, games as never, messages as never, events as never);
	const service = new HataigoService(db as never, redis as never, games as never, users as never, {} as never, { findOne: async () => null } as never, { find: async () => [] } as never, {} as never, events as never, {} as never, {} as never, {} as never);
	const packer = new HataigoGameEntityService(service, { pack: async (person: MiUser) => ({ id: person.id }) } as never);
	const chatService = new HataigoChatService(db as never, messages as never, users as never, service, {} as never, events as never, {} as never, { pack: async (person: MiUser) => ({ id: person.id }) } as never, { retentionDays: 30, disclosureVersion: 'test' });
	return { withdrawal, service, packer, chatService, rows, chat, people, games, messages, values, events };
}

test.each(['soft', 'hard'] as const)('%s withdrawal anonymizes retained shared records, closes uncompleted games without a winner, and stops all public access', async mode => {
	const f = fixture();
	if (mode === 'soft') f.people.set(alice.id, { ...alice, isDeleted: true });
	else f.people.delete(alice.id);
	await f.withdrawal.cleanup(alice.id);
	for (const id of ['playing', 'scoring', 'waiting', 'ended']) {
		const row = f.rows.get(id);
		if (!row) throw new Error('Missing retained game');
		expect(row).toMatchObject({ user1Id: null, user2Id: bob.id, phase: 'ended', allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false, deadlineAt: null });
		expect(row.visibility).toEqual({ user1: visibilityVote(), user2: visibilityVote() });
		expect(row.announcements).toEqual({ user1: announcementVote(), user2: announcementVote() });
		for (const slot of ['user1', 'user2'] as const) expect(row.announcementState[slot]).toMatchObject({ status: 'cancelled', text: null, noteId: null, lastError: null });
		if (id === 'ended') expect(row.result).toEqual({ reason: 'resign', winner: 'black' });
		else expect(row.result).toBeNull();
		if (row.clockState) expect(row.clockState).toMatchObject({ runningColor: null, turnStartedAtMs: null });
		for (const outsider of [carol, null]) await expect(f.service.get(id, outsider)).rejects.toMatchObject({ code: 'NOT_FOUND' });
		const packed = await f.packer.packDetail(id, bob);
		expect(packed.user1).toBeNull(); expect(packed.user2).toEqual({ id: bob.id });
	}
	expect(f.rows.size).toBe(5); expect(f.rows.get('unrelated')?.allowSpectate).toBe(true);
	expect(f.chat.get('message')).toMatchObject({ userId: null, deletedById: null, text: 'public chat', expiresAt: new Date(NOW + 30 * 86400000) });
	await expect(f.chatService.getPacked('message', bob)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	expect(await f.chatService.getPacked('spectator', null)).toMatchObject({ userId: null, user: null });
	expect(f.values.has('hataigo:queue-user:alice') || f.values.has('hataigo:queue-options:alice')).toBe(false);
});

test('duplicate cleanup preserves original end time/results and does not repeat game mutations or events', async () => {
	const f = fixture(); await f.withdrawal.cleanup(alice.id);
	const before = structuredClone([...f.rows.values()]);
	const calls = f.games.save.mock.calls.length; const events = f.events.publishHataigoGameStream.mock.calls.length;
	await f.withdrawal.cleanup(alice.id);
	expect([...f.rows.values()]).toEqual(before); expect(f.games.save.mock.calls).toHaveLength(calls); expect(f.events.publishHataigoGameStream.mock.calls).toHaveLength(events);
});

test('remaining participant cannot re-enable publication or announcements after counterpart withdrawal', async () => {
	const f = fixture(); await f.withdrawal.cleanup(alice.id);
	const current = f.rows.get('ended');
	if (!current) throw new Error('Missing ended game');
	// Redis quota is irrelevant to the retained record authorization; stub only that counter.
	vi.spyOn(f.service, 'rateLimit').mockResolvedValue();
	const changed = await f.service.updateSettings(current.id, bob, { allowSpectate: true, allowSpectatorChat: true, publicAfterEnd: true }, current.revision);
	expect(changed.allowSpectate || changed.allowSpectatorChat || changed.publicAfterEnd).toBe(false);
	await expect(f.service.get(current.id, null)).rejects.toMatchObject({ code: 'NOT_FOUND' });
	await expect(f.service.updateSettings(current.id, bob, { announcement: { enabled: true } }, changed.revision)).rejects.toMatchObject({ code: 'INVALID_STATE' });
});
