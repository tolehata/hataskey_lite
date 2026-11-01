/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { ChatService } from '@/core/ChatService.js';
import { ApInboxService } from '@/core/activitypub/ApInboxService.js';
import { MiChatRoom } from '@/models/ChatRoom.js';
import { MiChatRoomInvitation } from '@/models/ChatRoomInvitation.js';
import { MiChatRoomMembership } from '@/models/ChatRoomMembership.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- Runtime service fixtures replace only external dependencies. */

const localUrl = 'https://local.example';
const remoteUrl = 'https://remote.example';
const remote = { id: 'remote', host: 'remote.example', uri: `${remoteUrl}/users/remote` };
const owner = { id: 'owner', host: null, uri: null };
const invitee = { id: 'invitee', host: null, uri: null };
const ownerUri = `${localUrl}/users/owner`;

function fixture(options: { invited?: boolean; memberCount?: number; ownerId?: string; missingRoom?: boolean } = {}) {
	let room: any = options.missingRoom ? null : { id: 'room1', ownerId: options.ownerId ?? owner.id };
	const invitations = new Map<string, any>();
	if (options.invited !== false) invitations.set(remote.id, { id: 'invitation1', roomId: 'room1', userId: remote.id });
	const members = new Map<string, any>(Array.from({ length: options.memberCount ?? 0 }, (_, i) => [`member${i}`, { id: `membership${i}`, roomId: 'room1', userId: `member${i}` }]));
	const users = [owner, invitee, remote];
	let nextId = 1;
	const userEntityService = {
		isLocalUser: (user: any) => user.host == null,
		isRemoteUser: (user: any) => user.host != null,
		genLocalUserUri: (id: string) => `${localUrl}/users/${id}`,
	};
	const matches = (value: any, where: any) => value != null && Object.entries(where).every(([key, expected]) => value[key] === expected);
	const invitationRepository = {
		findOneBy: vi.fn(async (where: any) => [...invitations.values()].find(value => matches(value, where)) ?? null),
		findOneOrFail: vi.fn(async ({ where }: any) => {
			const value = [...invitations.values()].find(row => matches(row, where));
			if (!value) throw new Error('invitation not found');
			return value;
		}),
		insertOne: vi.fn(async (value: any) => { invitations.set(value.userId, value); return value; }),
		delete: vi.fn(async (idOrWhere: any) => {
			const id = typeof idOrWhere === 'string' ? idOrWhere : idOrWhere.id;
			for (const [userId, value] of invitations) if (value.id === id) invitations.delete(userId);
			return { affected: 1 };
		}),
	};
	const membershipRepository = {
		existsBy: vi.fn(async (where: any) => [...members.values()].some(value => matches(value, where))),
		findOneBy: vi.fn(async (where: any) => [...members.values()].find(value => matches(value, where)) ?? null),
		countBy: vi.fn(async (where: any) => [...members.values()].filter(value => matches(value, where)).length),
		insert: vi.fn(async (value: any) => { members.set(value.userId, value); return {}; }),
		findBy: vi.fn(async (where: any) => [...members.values()].filter(value => matches(value, where))),
	};
	let lockTail = Promise.resolve();
	const roomLocks: any[] = [];
	const transaction = vi.fn(async (action: (manager: any) => Promise<unknown>) => {
		let release: (() => void) | undefined;
		let originalMembers: Map<string, any> | undefined;
		let originalInvitations: Map<string, any> | undefined;
		const manager = {
			getRepository: (entity: unknown) => {
				if (entity === MiChatRoom) return {
					findOneOrFail: async (query: any) => {
						roomLocks.push(query);
						// Emulate the requested database row lock, not an unconditional serial transaction.
						if (query.lock?.mode === 'pessimistic_write') {
							const previous = lockTail;
							lockTail = new Promise<void>(resolve => { release = resolve; });
							await previous;
						}
						originalMembers = new Map(members);
						originalInvitations = new Map(invitations);
						if (!matches(room, query.where)) throw new Error('room not found');
						return room;
					},
				};
				if (entity === MiChatRoomInvitation) return invitationRepository;
				if (entity === MiChatRoomMembership) return membershipRepository;
				throw new Error('unexpected repository');
			},
		};
		try {
			return await action(manager);
		} catch (error) {
			if (originalMembers && originalInvitations) {
				members.clear();
				for (const [key, value] of originalMembers) members.set(key, value);
				invitations.clear();
				for (const [key, value] of originalInvitations) invitations.set(key, value);
			}
			throw error;
		} finally {
			release?.();
		}
	});
	const roomRepository = {
		manager: { transaction },
		findOneBy: vi.fn(async (where: any) => matches(room, where) ? room : null),
		findOneByOrFail: vi.fn(async (where: any) => {
			if (!matches(room, where)) throw new Error('room not found');
			return room;
		}),
		insertOne: vi.fn(async (value: any) => { room = value; return value; }),
	};
	const usersRepository = {
		findOneBy: vi.fn(async (where: any) => users.find(user => matches(user, where)) ?? null),
		findOneByOrFail: vi.fn(async (where: any) => {
			const user = users.find(value => matches(value, where));
			if (!user) throw new Error('user not found');
			return user;
		}),
		findBy: vi.fn(async () => []),
	};
	const notificationService = { createNotification: vi.fn() };
	const chat = Object.assign(Object.create(ChatService.prototype), {
		chatRoomsRepository: roomRepository, chatRoomInvitationsRepository: invitationRepository,
		chatRoomMembershipsRepository: membershipRepository, usersRepository, userEntityService,
		idService: { gen: () => `new${nextId++}` }, notificationService,
		// 上流 2026.10.1: ルーム招待時にブロック状態を確認する。
		userBlockingService: { checkBlocked: vi.fn(async () => false) },
	});
	const inbox = Object.assign(Object.create(ApInboxService.prototype), {
		config: { url: localUrl }, chatRoomsRepository: roomRepository, usersRepository,
		chatRoomInvitationsRepository: invitationRepository, chatRoomMembershipsRepository: membershipRepository,
		chatService: chat, userEntityService,
		apResolverService: { createResolver: () => ({ resolve: async (value: any) => value }) },
		apDbResolverService: { getUserFromApId: async (uri: string) => users.find(user => (user.uri ?? `${localUrl}/users/${user.id}`) === uri) ?? null },
		logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
	});
	const invite = (origin = localUrl, overrides: any = {}) => ({
		type: 'Invite', actor: ownerUri, target: remote.uri,
		object: { type: 'Group', id: `${origin}/chat/rooms/room1`, attributedTo: ownerUri }, ...overrides,
	});
	const accept = (object = invite()) => inbox.performOneActivity(remote, {
		type: 'Accept', id: `${remoteUrl}/activities/accept`, actor: remote.uri, object,
	});
	return { inbox, chat, invite, accept, members, invitations, membershipRepository, invitationRepository, roomRepository, roomLocks, transaction, notificationService };
}

describe('federated room invitation authority', () => {
	test('synthetic Accept without a stored invitation cannot join', async () => {
		const f = fixture({ invited: false });
		await expect(f.accept()).rejects.toThrow('invitation not found');
		expect(f.members.has(remote.id)).toBe(false);
		expect(f.membershipRepository.insert).not.toHaveBeenCalled();
	});

	test.each([localUrl, remoteUrl])('valid invitation accepts canonical or legacy invitee origin %s once', async origin => {
		const f = fixture();
		expect(await f.accept(f.invite(origin))).toBe('ok');
		expect(await f.accept(f.invite(origin))).toBe('ok');
		expect(f.members.has(remote.id)).toBe(true);
		expect(f.invitations.has(remote.id)).toBe(false);
		expect(f.membershipRepository.insert).toHaveBeenCalledOnce();
		expect(f.invitationRepository.findOneOrFail).toHaveBeenCalledWith({ where: { roomId: 'room1', userId: remote.id }, lock: { mode: 'pessimistic_write' } });
	});

	test.each([
		{ actor: `${localUrl}/users/someoneelse` },
		{ target: `${remoteUrl}/users/someoneelse` },
		{ object: { id: 'https://third.example/chat/rooms/room1', attributedTo: ownerUri } },
		{ object: { id: `${remoteUrl}/chat/rooms/room2`, attributedTo: ownerUri } },
		{ object: { id: `${localUrl}/chat/rooms/room1?alias=1`, attributedTo: ownerUri } },
		{ object: { id: `${localUrl}/chat/rooms/room1#alias`, attributedTo: ownerUri } },
		{ object: { id: `${localUrl}/chat/rooms/room1`, attributedTo: [ownerUri, remote.uri] } },
	])('Accept rejects unbound nested fields %j', async overrides => {
		const f = fixture();
		expect(await f.accept(f.invite(localUrl, overrides))).toMatch(/^skip:/);
		expect(f.transaction).not.toHaveBeenCalled();
		expect(f.invitations.has(remote.id)).toBe(true);
	});

	test.each(['Invite', 'Undo'])('%s cannot mutate another owner room even using its ID under signer origin', async type => {
		const f = fixture();
		f.invitations.set(invitee.id, { id: 'localInvitation', roomId: 'room1', userId: invitee.id });
		const activity = f.invite(remoteUrl, { actor: remote.uri, target: `${localUrl}/users/${invitee.id}`, object: { id: `${remoteUrl}/chat/rooms/room1`, attributedTo: remote.uri } });
		const result = await f.inbox.performOneActivity(remote, type === 'Invite' ? activity : { type, actor: remote.uri, object: activity });
		expect(result).toMatch(/^skip:/);
		expect(f.invitationRepository.insertOne).not.toHaveBeenCalled();
		expect(f.invitationRepository.delete).not.toHaveBeenCalled();
	});

	test.each([
		{ origin: localUrl, attributedTo: remote.uri },
		{ origin: remoteUrl, attributedTo: ownerUri },
		{ origin: remoteUrl, attributedTo: [remote.uri, ownerUri] },
	])('new remote room rejects origin or attributed owner mismatch %j', async ({ origin, attributedTo }) => {
		const f = fixture({ missingRoom: true, invited: false });
		const activity = f.invite(origin, { actor: remote.uri, target: `${localUrl}/users/${invitee.id}`, object: { id: `${origin}/chat/rooms/room1`, attributedTo } });
		expect(await f.inbox.performOneActivity(remote, activity)).toMatch(/^skip:/);
		expect(f.roomRepository.insertOne).not.toHaveBeenCalled();
		expect(f.notificationService.createNotification).not.toHaveBeenCalled();
	});

	test.each(['Invite', 'Undo'])('%s rejects a forged nested inviter even for a signer-owned room', async type => {
		const f = fixture({ ownerId: remote.id });
		const activity = f.invite(remoteUrl, {
			actor: ownerUri, target: `${localUrl}/users/${invitee.id}`,
			object: { id: `${remoteUrl}/chat/rooms/room1`, attributedTo: remote.uri },
		});
		const result = await f.inbox.performOneActivity(remote, type === 'Invite' ? activity : { type, actor: remote.uri, object: activity });
		expect(result).toMatch(/^skip:/);
		expect(f.invitationRepository.insertOne).not.toHaveBeenCalled();
		expect(f.invitationRepository.delete).not.toHaveBeenCalled();
	});

	test('remote Invite respects the shared room capacity check', async () => {
		const f = fixture({ ownerId: remote.id, memberCount: 50, invited: false });
		const activity = f.invite(remoteUrl, {
			actor: remote.uri, target: `${localUrl}/users/${invitee.id}`,
			object: { id: `${remoteUrl}/chat/rooms/room1`, attributedTo: remote.uri },
		});
		await expect(f.inbox.performOneActivity(remote, activity)).rejects.toThrow('room is full');
		expect(f.invitationRepository.insertOne).not.toHaveBeenCalled();
		expect(f.notificationService.createNotification).not.toHaveBeenCalled();
	});

	test('remote owner can invite a local user, then undo that invitation', async () => {
		const f = fixture({ missingRoom: true, invited: false });
		const activity = f.invite(remoteUrl, { actor: remote.uri, target: `${localUrl}/users/${invitee.id}`, object: { id: `${remoteUrl}/chat/rooms/room1`, attributedTo: { id: remote.uri }, name: 'Remote room' } });
		expect(await f.inbox.performOneActivity(remote, activity)).toBe('ok');
		expect(f.roomRepository.insertOne).toHaveBeenCalledWith(expect.objectContaining({ id: 'room1', ownerId: remote.id }));
		expect(f.invitations.has(invitee.id)).toBe(true);
		expect(f.notificationService.createNotification).toHaveBeenCalledOnce();
		expect(await f.inbox.performOneActivity(remote, { type: 'Undo', actor: remote.uri, object: activity })).toBe('ok: invitation cancelled');
		expect(f.invitations.has(invitee.id)).toBe(false);
	});
});

describe('shared local and federated room join transaction', () => {
	test('full room leaves its outstanding invitation intact', async () => {
		const f = fixture({ memberCount: 50 });
		await expect(f.accept()).rejects.toThrow('room is full');
		expect(f.invitations.has(remote.id)).toBe(true);
		expect(f.membershipRepository.insert).not.toHaveBeenCalled();
	});

	test('concurrent local and federated joins cannot take the same last place', async () => {
		const f = fixture({ memberCount: 49 });
		f.invitations.set(invitee.id, { id: 'localInvitation', roomId: 'room1', userId: invitee.id });
		const results = await Promise.allSettled([f.accept(), f.chat.joinToRoom(invitee.id, 'room1')]);
		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
		expect(f.members.size).toBe(50);
		expect(f.invitations.size).toBe(1);
		expect(f.roomLocks).toEqual(Array(2).fill({ where: { id: 'room1' }, lock: { mode: 'pessimistic_write' } }));
	});

	test('failure consuming an invitation rolls back membership creation', async () => {
		const f = fixture();
		f.invitationRepository.delete.mockRejectedValueOnce(new Error('write failed'));
		await expect(f.accept()).rejects.toThrow('write failed');
		expect(f.members.has(remote.id)).toBe(false);
		expect(f.invitations.has(remote.id)).toBe(true);
	});

	test('ordinary local join uses the same transaction', async () => {
		const f = fixture({ invited: false });
		f.invitations.set(invitee.id, { id: 'localInvitation', roomId: 'room1', userId: invitee.id });
		await f.chat.joinToRoom(invitee.id, 'room1');
		expect(f.members.has(invitee.id)).toBe(true);
		expect(f.invitations.has(invitee.id)).toBe(false);
		expect(f.transaction).toHaveBeenCalledOnce();
	});
});
