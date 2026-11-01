/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import type { MiNote } from '@/models/Note.js';
import type { MiChannel } from '@/models/Channel.js';
import type { Packed } from '@/misc/json-schema.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import type { FindOperator } from 'typeorm';

vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/ReactionsBufferingService.js', () => ({ ReactionsBufferingService: class {} }));

function note(id: string, overrides: Partial<MiNote> = {}): MiNote {
	const result = {
		id, userId: 'author', user: null, userHost: null, text: 'body', cw: null,
		visibility: 'public', localOnly: true, channelId: null, channel: null,
		renoteId: null, renote: null, renoteUserId: null, replyId: null, reply: null, replyUserId: null,
		fileIds: [], emojis: [], tags: [], mentions: [], visibleUserIds: [],
		hasPoll: false, hasEvent: false, reactions: {}, reactionAndUserPairCache: [],
		renoteCount: 0, repliesCount: 0, clippedCount: 0,
		...overrides,
	} as MiNote;
	if (result.reply) {
		result.replyId = result.reply.id;
		result.replyUserId = result.reply.userId;
	}
	if (result.renote) {
		result.renoteId = result.renote.id;
		result.renoteUserId = result.renote.userId;
	}
	return result;
}

function fixture() {
	const privateChannel = {
		id: 'private', isPrivate: true, userId: 'owner', moderatorUserIds: ['deputy'],
		name: 'secret', isSensitive: false, allowRenoteToExternal: false,
	} as MiChannel;
	const channels = new Map<string, MiChannel>([['private', privateChannel]]);
	const members = new Set(['member']);
	const notes = new Map<string, MiNote>();
	const notesRepository = { find: vi.fn(async ({ where }: { where: { id: FindOperator<string[]> } }) => where.id.value.flatMap(id => notes.get(id) ?? [])) };
	const channelsRepository = {
		findBy: vi.fn(async ({ id }: { id: FindOperator<string[]> }) => id.value.flatMap(key => channels.get(key) ?? [])),
		findOneBy: vi.fn(async ({ id }: { id: string }) => channels.get(id) ?? null),
	};
	const channelMembersRepository = { findBy: vi.fn(async ({ channelId, userId }: { channelId: FindOperator<string[]>; userId: string }) => members.has(userId) ? channelId.value.map(id => ({ channelId: id, userId })) : []) };
	const roleService = {
		isModerator: vi.fn(async ({ id }: { id: string }) => id === 'moderator'),
		isAdministrator: vi.fn(async ({ id }: { id: string }) => id === 'admin'),
	};
	const packUser = async (value: string | { id: string }) => ({ id: typeof value === 'string' ? value : value.id, host: null });
	const prefetchEmojis = vi.fn(async () => {});
	const service = Object.assign(Object.create(NoteEntityService.prototype), {
		meta: { ugcVisibilityForVisitor: 'all', enableReactionsBuffering: false },
		notesRepository, channelsRepository, channelMembersRepository, roleService,
		noteLoader: { load: vi.fn(async (id: string) => {
			const result = notes.get(id);
			if (result == null) throw new Error(`Unexpected note load: ${id}`);
			return result;
		}) },
		usersRepository: { findOneBy: async () => ({ host: null }), findOneByOrFail: async () => ({ host: null }) },
		followingsRepository: { exists: async () => false, count: async () => 0 },
		noteReactionsRepository: { find: async () => [], findOneBy: async () => null },
		idService: { parse: () => ({ date: new Date('2020-01-01') }) },
		reactionService: { convertLegacyReactions: (value: unknown) => value, decodeReaction: () => ({ name: null, host: null }) },
		reactionsBufferingService: { mergeReactions: (value: unknown) => value },
		customEmojiService: { prefetchEmojis, populateEmojis: async () => ({}) },
		userEntityService: { pack: packUser, packMany: async (users: (string | { id: string })[]) => Promise.all(users.map(packUser)) },
		driveFileEntityService: { packManyByIds: async () => [], packManyByIdsMap: async () => new Map() },
	}) as NoteEntityService;
	return { service, channels, privateChannel, members, notes, notesRepository, channelsRepository, channelMembersRepository, roleService, prefetchEmojis };
}

describe('private channel note access', () => {
	test.each([
		[null, false], ['outsider', false], ['author', true], ['owner', true],
		['deputy', true], ['member', true], ['moderator', true], ['admin', true],
	] as const)('viewer %s has access %s with current membership and management exceptions', async (viewer, allowed) => {
		const f = fixture();
		expect(await f.service.isChannelVisibleForMe(note('private-note', { channelId: 'private' }), viewer)).toBe(allowed);
	});

	test('does not reuse stale public channel snapshots or membership across calls', async () => {
		const f = fixture();
		const target = note('target', { channelId: 'private', channel: { ...f.privateChannel, isPrivate: false } });
		expect(await f.service.isChannelVisibleForMe(target, 'outsider')).toBe(false);
		expect(await f.service.isChannelVisibleForMe(target, 'member')).toBe(true);
		f.members.delete('member');
		expect(await f.service.isChannelVisibleForMe(target, 'member')).toBe(false);
		expect(await f.service.isChannelVisibleForMe(target, 'author')).toBe(true);
		f.privateChannel.isPrivate = false;
		expect(await f.service.isChannelVisibleForMe(target, null)).toBe(true);
	});

	test('loads an omitted channel ID for both a root and an already joined child', async () => {
		const f = fixture();
		const hidden = note('hidden', { channelId: 'private' });
		f.notes.set(hidden.id, hidden);
		const incomplete = { id: hidden.id, userId: hidden.userId, replyId: null, renoteId: null };
		expect(await f.service.isChannelVisibleForMe(incomplete, 'outsider')).toBe(false);
		expect(await f.service.isChannelVisibleForMe({ id: 'parent', userId: 'outsider', channelId: null, replyId: hidden.id, reply: incomplete, renoteId: null }, 'outsider')).toBe(false);
	});

	test('drops every parent of a deep inaccessible reply or quote, including a self-authored parent', async () => {
		const f = fixture();
		const hidden = note('hidden', { channelId: 'private' });
		const quoted = note('quote', { renote: hidden });
		const parent = note('parent', { userId: 'outsider', reply: quoted });
		const publicNote = note('public');
		expect(await f.service.filterChannelVisibleNotes([publicNote, parent, hidden, quoted], 'outsider')).toEqual([publicNote]);
		expect(await f.service.filterChannelVisibleNotes([parent, hidden], 'member')).toEqual([parent, hidden]);
	});

	test('loads unjoined descendants in batches and applies one channel and membership lookup', async () => {
		const f = fixture();
		const hidden = note('hidden', { channelId: 'private' });
		const intermediate = note('middle', { renoteId: hidden.id, renote: undefined });
		f.notes.set(hidden.id, hidden);
		f.notes.set(intermediate.id, intermediate);
		const roots = [note('one', { replyId: intermediate.id, reply: undefined }), note('two', { renoteId: intermediate.id, renote: undefined })];
		expect(await f.service.filterChannelVisibleNotes(roots, 'outsider')).toEqual([]);
		expect(f.notesRepository.find).toHaveBeenCalledTimes(2);
		expect(f.channelsRepository.findBy).toHaveBeenCalledOnce();
		expect(f.channelMembersRepository.findBy).toHaveBeenCalledOnce();
		expect(f.roleService.isModerator).toHaveBeenCalledOnce();
	});

	test('fills missing root references but uses the supplied snapshot after root deletion', async () => {
		const f = fixture();
		const hidden = note('hidden', { channelId: 'private' });
		f.notes.set('root', note('root', { replyId: hidden.id, reply: undefined }));
		f.notes.set(hidden.id, hidden);
		expect(await f.service.isChannelVisibleForMe({ id: 'root', userId: 'author', channelId: null }, 'outsider')).toBe(false);
		expect(await f.service.isChannelVisibleForMe({ id: 'deleted', userId: 'author', channelId: 'private' }, 'outsider')).toBe(false);
		expect(await f.service.isChannelVisibleForMe({ id: 'deleted', userId: 'author', channelId: 'private' }, 'author')).toBe(true);
	});

	test('allows deleted reference targets and terminates cycles while propagating inaccessible descendants', async () => {
		const f = fixture();
		expect(await f.service.isChannelVisibleForMe(note('deleted-child-parent', { replyId: 'deleted', reply: undefined }), null)).toBe(true);
		const one = note('one');
		const two = note('two', { reply: one });
		one.reply = two;
		one.replyId = two.id;
		expect(await f.service.isChannelVisibleForMe(one, 'outsider')).toBe(true);
		two.renote = note('hidden', { channelId: 'private' });
		two.renoteId = two.renote.id;
		expect(await f.service.filterChannelVisibleNotes([one, two], 'outsider')).toEqual([]);
	});

	test('normal visibility restrictions do not become channel exclusions', async () => {
		const f = fixture();
		const followers = note('followers', { visibility: 'followers' });
		const specified = note('specified', { visibility: 'specified' });
		expect(await f.service.filterChannelVisibleNotes([followers, specified], 'outsider')).toEqual([followers, specified]);
		expect(await f.service.isVisibleForMe(followers, 'outsider')).toBe(false);
		expect(await f.service.isVisibleForMe(specified, 'outsider')).toBe(false);
		expect(await f.service.isVisibleForMe(note('self', { channelId: 'private' }), 'author')).toBe(true);
	});
});

describe('private channel packing', () => {
	test('rejects a single inaccessible note before content packing but keeps internal broadcast packing', async () => {
		const f = fixture();
		const target = note('target', { channelId: 'private' });
		await expect(f.service.pack(target, { id: 'outsider' })).rejects.toBeInstanceOf(PrivateChannelNoteVisibilityError);
		expect(f.prefetchEmojis).not.toHaveBeenCalled();
		expect((await f.service.pack(target, null, { skipHide: true })).text).toBe('body');
	});

	test('filters private roots and parents from packMany while retaining ordinary hidden placeholders', async () => {
		const f = fixture();
		const hidden = note('hidden', { channelId: 'private' });
		const parent = note('parent', { renote: hidden });
		const publicNote = note('public');
		const followers = note('followers', { visibility: 'followers' });
		const packed = await f.service.packMany([hidden, parent, publicNote, followers], { id: 'outsider' });
		expect(packed.map(item => item.id)).toEqual(['public', 'followers']);
		expect(packed[0].text).toBe('body');
		expect(packed[1]).toMatchObject({ text: null, isHidden: true });
		expect(f.roleService.isModerator).toHaveBeenCalledOnce();
	});

	test('shares the permission snapshot throughout nested packing and keeps latest channel metadata', async () => {
		const f = fixture();
		const child = note('child', { channelId: 'private', channel: { ...f.privateChannel, isPrivate: false } });
		const parent = note('parent', { reply: child });
		const packed = await f.service.packMany([parent, child], { id: 'member' });
		expect(packed[0].reply?.text).toBe('body');
		expect(packed[0].reply?.channel?.isPrivate).toBe(true);
		expect(f.channelsRepository.findBy).toHaveBeenCalledOnce();
		expect(f.channelMembersRepository.findBy).toHaveBeenCalledOnce();
		expect(f.roleService.isModerator).toHaveBeenCalledOnce();
	});

	test('does not turn a descendant permission denial into a null child', async () => {
		const f = fixture();
		const parent = note('parent', { reply: note('child', { renote: note('hidden', { channelId: 'private' }) }) });
		await expect(f.service.pack(parent, { id: 'outsider' })).rejects.toBeInstanceOf(PrivateChannelNoteVisibilityError);
	});

	test('terminates cycles during packing', async () => {
		const f = fixture();
		const one = note('one');
		const two = note('two', { reply: one });
		one.replyId = two.id;
		one.reply = two;
		const packed = await f.service.pack(one, null);
		expect(packed.reply?.id).toBe(two.id);
		expect(packed.reply?.reply).toBeNull();
	});

	test('omits a permission-raced element without failing other packed notes', async () => {
		const f = fixture();
		vi.spyOn(f.service, 'pack').mockImplementation(async source => {
			if (typeof source !== 'string' && source.id === 'revoked') throw new PrivateChannelNoteVisibilityError();
			return { id: 'public' } as Packed<'Note'>;
		});
		expect(await f.service.packMany([note('revoked'), note('public')], null)).toEqual([{ id: 'public' }]);
	});
});
