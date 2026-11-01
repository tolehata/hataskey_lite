/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
vi.mock('@/core/entities/UserEntityService.js', () => ({ UserEntityService: class {} }));
vi.mock('@/core/entities/DriveFileEntityService.js', () => ({ DriveFileEntityService: class {} }));
vi.mock('@/core/MfmService.js', () => ({ MfmService: class {} }));
vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/ReactionsBufferingService.js', () => ({ ReactionsBufferingService: class {} }));
import { CHANNEL_VISIBILITY_NODE_TTL_MS, NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { NoteStreamingHidingService } from '@/server/api/stream/NoteStreamingHidingService.js';
import { ChannelChannelService } from '@/server/api/stream/channels/channel.js';
import { RoleTimelineChannelService } from '@/server/api/stream/channels/role-timeline.js';
import { FeedService } from '@/server/web/FeedService.js';
import { QueryService } from '@/core/QueryService.js';
import Connection from '@/server/api/stream/Connection.js';
import type { Packed } from '@/misc/json-schema.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated service fixtures. */
function fixture(policy = 'all') {
	const service = Object.assign(Object.create(NoteEntityService.prototype), {
		meta: { ugcVisibilityForVisitor: policy, enableReactionsBuffering: false },
		roleService: { isAdministrator: vi.fn(async ({ id }) => id === 'admin'), isModerator: vi.fn(async () => false) },
		idService: { parse: () => ({ date: new Date('2020-01-01') }) },
		usersRepository: { findOneBy: vi.fn(async () => ({ host: null })), findOneByOrFail: vi.fn(async () => ({ host: null })) },
		channelsRepository: { findBy: vi.fn(async () => [{ id: 'private', isPrivate: true, userId: 'owner', moderatorUserIds: [] }]) },
		channelMembersRepository: { findBy: vi.fn(async ({ userId }) => userId === 'member' ? [{ channelId: 'private' }] : []) },
		followingsRepository: { exists: vi.fn(async () => false), count: vi.fn(async () => 0) },
		notesRepository: { find: vi.fn(async () => []) },
		reactionService: { convertLegacyReactions: (r: unknown) => r },
		reactionsBufferingService: { mergeReactions: (r: unknown) => r },
		customEmojiService: { populateEmojis: vi.fn(async () => ({})) },
	});
	const streaming = new NoteStreamingHidingService(service.meta, service);
	return { service, streaming };
}

function note(overrides: Record<string, unknown> = {}): Packed<'Note'> {
	return { id: 'note', userId: 'author', user: { id: 'author', host: null }, createdAt: '2020-01-01T00:00:00Z', visibility: 'public', text: 'body', cw: null, fileIds: [], files: [], reactions: {}, mentions: [], channelId: null, ...overrides } as Packed<'Note'>;
}

describe('visitor content visibility', () => {
	test.each([['all', null, true], ['all', 'remote.test', true], ['local', null, true], ['local', 'remote.test', false], ['none', null, false]])('%s / %s streaming', async (policy, host, visible) => {
		const { streaming } = fixture(policy as string);
		expect(await streaming.filter(note({ user: { host } }), null) !== null).toBe(visible);
	});
	test('hides remote quote and reply bodies without mutating shared events', async () => {
		const { streaming } = fixture('local');
		const original = note({ renote: note({ id: 'quote', user: { host: 'remote.test' } }), reply: note({ id: 'reply', user: { host: 'remote.test' }, event: { title: 'private event' }, tags: ['private'] }) });
		const result = await streaming.filter(original, null);
		expect(result?.text).toBe('body');
		expect(result?.renote?.isHidden).toBe(true);
		expect(result?.reply?.isHidden).toBe(true);
		expect(result?.reply?.event).toBeUndefined();
		expect(result?.reply?.tags).toBeUndefined();
		expect(original.renote?.text).toBe('body');
		expect(original.reply?.text).toBe('body');
	});
	test('conceals all reply and renote descendants while retaining visible parents', async () => {
		const { streaming } = fixture();
		const original = note({ reply: note({
			id: 'visible-parent', reply: note({ id: 'hidden-child', user: { host: null, requireSigninToViewContents: true },
				reply: note({ id: 'signin-grandchild', user: { requireSigninToViewContents: true }, event: { title: 'secret event' } }),
				renote: note({ id: 'followers-grandchild', visibility: 'followers' }),
			}),
			renote: note({ id: 'quote-grandchild', visibility: 'specified', visibleUserIds: [] }),
		}) });
		const result = await streaming.filter(original, null);
		expect(result?.text).toBe('body');
		expect(result?.reply?.text).toBe('body');
		expect(result?.reply?.reply?.text).toBeNull();
		expect(result?.reply?.reply?.reply?.text).toBeNull();
		expect(result?.reply?.reply?.reply?.event).toBeUndefined();
		expect(result?.reply?.reply?.renote?.text).toBeNull();
		expect(result?.reply?.renote?.text).toBeNull();
		expect(original.reply?.reply?.reply?.text).toBe('body');
		expect(original.reply?.reply?.renote?.text).toBe('body');
	});
	test.each(['reply', 'renote'] as const)('drops the whole outer note for a private %s descendant', async (key) => {
		const { streaming } = fixture();
		const original = note({ [key]: note({ id: 'middle', reply: note({ id: 'secret', channelId: 'private' }) }) });
		const before = structuredClone(original);
		expect(await streaming.filter(original, 'outsider')).toBeNull();
		expect(await streaming.filter(original, null)).toBeNull();
		expect(await streaming.filter(original, 'member')).toBe(original);
		expect(original).toEqual(before);
	});
	test('accepts already-concealed specified notes without requiring removed recipient IDs', async () => {
		const { streaming } = fixture();
		const result = await streaming.filter(note({ visibility: 'specified', isHidden: true, visibleUserIds: undefined, text: null }), 'outsider');
		expect(result?.isHidden).toBe(true);
		expect(result?.text).toBeNull();
	});
	test('drops a pure renote whose target is hidden', async () => {
		const { streaming } = fixture('local');
		expect(await streaming.filter(note({ text: null, renoteId: 'remote', renote: note({ user: { host: 'remote.test' } }) }), null)).toBeNull();
	});
	test('a hidden reply alone does not drop a pure renote', async () => {
		const { streaming } = fixture();
		const result = await streaming.filter(note({ text: null, renoteId: 'target', renote: note({ reply: note({ visibility: 'specified', visibleUserIds: [] }) }) }), null);
		expect(result?.renote?.reply?.isHidden).toBe(true);
	});
	test('retains a pure renote of a visible quote whose quoted source is hidden', async () => {
		const { streaming } = fixture();
		const original = note({ text: null, renoteId: 'quote', renote: note({
			id: 'quote', text: 'public commentary', renoteId: 'source', renote: note({
				id: 'source', user: { host: null, requireSigninToViewContents: true },
			}),
		}) });
		const result = await streaming.filter(original, null);
		expect(result?.renote?.text).toBe('public commentary');
		expect(result?.renote?.renote?.isHidden).toBe(true);
		expect(result?.renote?.renote?.text).toBeNull();
		expect(original.renote?.renote?.text).toBe('body');
	});
	test('retains private-channel membership and administrator time exceptions', async () => {
		const { service, streaming } = fixture();
		const privateNote = note({ channelId: 'private' });
		expect(await service.shouldHideNote(privateNote, 'outsider')).toBe(true);
		expect(await service.shouldHideNote(privateNote, 'member')).toBe(false);
		const old = note({ user: { host: null, makeNotesHiddenBefore: 1900000000 } });
		expect((await streaming.filter(old, 'outsider'))?.isHidden).toBe(true);
		expect((await streaming.filter(old, 'admin'))?.text).toBe('body');
		const followers = note({ user: { host: null, makeNotesFollowersOnlyBefore: 1900000000 } });
		expect(await service.shouldHideNote(followers, 'outsider')).toBe(true);
		expect(await service.shouldHideNote(followers, 'admin')).toBe(false);
	});
	test('partial reactions select channelId and omit inaccessible notes', async () => {
		const { service } = fixture();
		service.notesRepository.find.mockResolvedValue([{ id: 'secret', userId: 'author', channelId: 'private', userHost: null, visibility: 'public', reactions: {} }]);
		expect(await service.fetchDiffs(['secret'], 'outsider')).toEqual([]);
		expect(service.notesRepository.find.mock.calls[0][0].select.channelId).toBe(true);
		expect(await service.fetchDiffs(['secret'], 'member')).toEqual([{ id: 'secret', reactions: {}, reactionEmojis: {} }]);
	});
	test('anonymous partial reactions respect local and none', async () => {
		for (const policy of ['local', 'none']) {
			const { service } = fixture(policy);
			service.notesRepository.find.mockResolvedValue([{ id: 'remote', userId: 'author', channelId: null, userHost: 'remote.test', visibility: 'public' }]);
			expect(await service.fetchDiffs(['remote'])).toEqual([]);
		}
	});
	test('time-hidden partial content stays hidden while administrators retain access', async () => {
		const { service } = fixture();
		service.usersRepository.findOneBy.mockResolvedValue({ makeNotesHiddenBefore: 1900000000 });
		const snapshot = { id: 'old', userId: 'author', visibility: 'public', userHost: null, channelId: null };
		expect(await service.isVisibleForMe(snapshot, 'outsider')).toBe(false);
		expect(await service.isVisibleForMe(snapshot, 'admin')).toBe(true);
	});
	test.each([
		['makeNotesHiddenBefore', 1577836800],
		['makeNotesFollowersOnlyBefore', 1577836800],
		['makeNotesHiddenBefore', -3600],
		['makeNotesFollowersOnlyBefore', -3600],
	] as const)('partial content matches packed visibility exactly at the %s = %s cutoff', async (setting, cutoff) => {
		vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2020-01-01T01:00:00Z'));
		const { service } = fixture();
		const user = { host: null, [setting]: cutoff };
		service.usersRepository.findOneBy.mockResolvedValue(user);
		const packed = note({ user });
		const snapshot = { id: 'note', userId: 'author', visibility: 'public', userHost: null, channelId: null };
		expect(await service.shouldHideNote(packed, 'outsider')).toBe(false);
		expect(await service.isVisibleForMe(snapshot, 'outsider')).toBe(true);
	});
	test('joined reaction queries restrict the note host, not the reaction alias', () => {
		const query = { alias: 'reaction', andWhere: vi.fn() };
		const service = Object.assign(Object.create(QueryService.prototype), { meta: { ugcVisibilityForVisitor: 'local' } });
		service.generateVisibilityQuery(query, null);
		expect(query.andWhere).toHaveBeenCalledWith('note.userHost IS NULL');
		expect(query.andWhere).not.toHaveBeenCalledWith('reaction.userHost IS NULL');
	});
	test('deleted note updates use publisher visibility snapshot including private channel', async () => {
		const { streaming } = fixture('local');
		const snapshot = { id: 'deleted', userId: 'author', visibility: 'public', visibleUserIds: [], userHost: null, channelId: 'private', replyId: null, renoteId: null, replyUserId: null, mentions: [], body: {} } as any;
		expect(await streaming.canReceiveUpdates(snapshot, null)).toBe(false);
		expect(await streaming.canReceiveUpdates(snapshot, 'member')).toBe(true);
		expect(await streaming.canReceiveUpdates({ ...snapshot, channelId: null, userHost: 'remote.test' }, null)).toBe(false);
	});
	test.each(['replyId', 'renoteId'] as const)('deleted public parent retains its private %s in the published snapshot', async (key) => {
		const { service, streaming } = fixture();
		const child = { id: 'secret', userId: 'secret-author', channelId: 'private', replyId: null, renoteId: null };
		service.notesRepository.find.mockImplementation(async ({ where }) => where.id.value.includes(child.id) ? [child] : []);
		const publisher = Object.create(GlobalEventService.prototype);
		Object.defineProperty(publisher, 'publish', { value: vi.fn(async () => 1) });
		const parent = { id: 'deleted', userId: 'author', userHost: null, visibility: 'public', visibleUserIds: [], mentions: [], channelId: null, replyId: null, renoteId: null, replyUserId: null, [key]: child.id };
		const body = { deletedAt: new Date('2020-01-01') };
		await publisher.publishNoteStream(parent, 'deleted', body);
		const [topic, type, snapshot] = publisher.publish.mock.calls[0];
		expect([topic, type]).toEqual(['noteStream:deleted', 'deleted']);
		expect(snapshot).toMatchObject({ replyId: parent.replyId, renoteId: parent.renoteId, body });
		for (const viewer of [null, 'outsider', 'author']) expect(await streaming.canReceiveUpdates(snapshot, viewer)).toBe(false);
		for (const viewer of ['member', 'admin']) expect(await streaming.canReceiveUpdates(snapshot, viewer)).toBe(true);
		service.notesRepository.find.mockResolvedValue([]);
		// Ancestors are cached because they never change; a deleted one is remembered for at most the
		// cache lifetime, which can only hide the parent longer, never reveal the private child.
		expect(await streaming.canReceiveUpdates(snapshot, 'outsider')).toBe(false);
		const now = Date.now();
		const clock = vi.spyOn(Date, 'now').mockReturnValue(now + CHANNEL_VISIBILITY_NODE_TTL_MS + 1);
		try {
			expect(await streaming.canReceiveUpdates(snapshot, 'outsider')).toBe(true);
		} finally { clock.mockRestore(); }
	});
	test.each(['userHost', 'channelId', 'replyId', 'renoteId'] as const)('rejects an older update snapshot missing %s', async (key) => {
		const { streaming } = fixture();
		const snapshot = { id: 'deleted', userId: 'author', visibility: 'public', visibleUserIds: [], userHost: null, channelId: null, replyId: null, renoteId: null, replyUserId: null, mentions: [], body: {} } as any;
		expect(await streaming.canReceiveUpdates(snapshot, null)).toBe(true);
		expect(await streaming.canReceiveUpdates({ ...snapshot, [key]: undefined }, null)).toBe(false);
	});
});

test('RSS excludes private channels and aged notes while retaining public-channel notes', async () => {
	const candidates = [
		{ id: 'old', channel: null },
		{ id: 'private', channel: { isPrivate: true } },
		{ id: 'public-channel', channel: { isPrivate: false } },
		{ id: 'public', channel: null },
	].map(n => ({ ...n, fileIds: [], text: null, cw: null }));
	const notesRepository = { find: vi.fn(async () => candidates) };
	const service = Object.assign(Object.create(FeedService.prototype), {
		config: { url: 'https://local.test', host: 'local.test' }, notesRepository,
		noteEntityService: { filterChannelVisibleNotes: async (notes: unknown[]) => notes },
		userProfilesRepository: { findOneByOrFail: vi.fn(async () => ({})) },
		userEntityService: { getIdenticonUrl: () => 'https://local.test/avatar.png' },
		idService: { parse: (id: string) => ({ date: new Date(id === 'old' ? '2020-01-01' : '2025-01-01') }) },
	});
	const feed = await service.packFeed({ id: 'author', username: 'author', makeNotesHiddenBefore: 1700000000 });
	expect(feed.items.map((item: { link: string }) => item.link)).toEqual(['https://local.test/notes/public-channel', 'https://local.test/notes/public']);
	expect(notesRepository.find.mock.calls[0][0].relations).toEqual({ channel: true });
});

describe('role timeline visibility', () => {
	test('refuses private roles and stops delivery after role visibility changes', async () => {
		let available = false;
		const repository = { exists: vi.fn(async () => available) };
		const channels = new RoleTimelineChannelService({} as never, repository as never);
		const subscriber = new EventEmitter();
		const sendMessageToWs = vi.fn();
		const connection = {
			subscriber, sendMessageToWs, isChannelConnected: () => true,
			userIdsWhoMeMuting: new Set(), userIdsWhoBlockingMe: new Set(), userIdsWhoMeMutingRenotes: new Set(),
			noteStreamingHidingService: fixture().streaming,
		};
		const channel = channels.create('role', connection as never);
		expect(await channel.init({ roleId: 'role' })).toBe(false);
		expect(subscriber.listenerCount('roleTimelineStream:role')).toBe(0);
		available = true;
		expect(await channel.init({ roleId: 'role' })).toBe(true);
		await (channel as any).onEvent({ type: 'note', body: note() });
		expect(sendMessageToWs).toHaveBeenCalledOnce();
		available = false;
		await (channel as any).onEvent({ type: 'note', body: note() });
		expect(sendMessageToWs).toHaveBeenCalledOnce();
		expect(repository.exists).toHaveBeenLastCalledWith({ where: { id: 'role', isPublic: true, isExplorable: true } });
		channel.dispose();
	});
});

describe('websocket connection ordering', () => {
	function channelFixture(filter: ReturnType<typeof vi.fn>) {
		const subscriber = new EventEmitter();
		const sendMessageToWs = vi.fn();
		const connection = {
			subscriber, sendMessageToWs, isChannelConnected: vi.fn(() => true),
			userIdsWhoMeMuting: new Set(), userIdsWhoBlockingMe: new Set(), userIdsWhoMeMutingRenotes: new Set(),
			noteStreamingHidingService: { filter },
		};
		const channel = new ChannelChannelService({} as never).create('channel', connection as never);
		return { channel, connection, sendMessageToWs };
	}

	test('channel notes retain publish order when their visibility checks finish out of order', async () => {
		let finish!: () => void;
		const first = note({ id: 'first', channelId: 'public-channel' });
		const second = note({ id: 'second', channelId: 'public-channel' });
		const filter = vi.fn().mockImplementationOnce(() => new Promise<Packed<'Note'>>(resolve => { finish = () => resolve(first); })).mockResolvedValue(second);
		const { channel, sendMessageToWs } = channelFixture(filter);
		await channel.init({ channelId: 'public-channel' });
		const firstDelivery = (channel as any).onNote(first);
		const secondDelivery = (channel as any).onNote(second);
		await vi.waitFor(() => expect(filter).toHaveBeenCalled());
		finish();
		await Promise.all([firstDelivery, secondDelivery]);
		expect(sendMessageToWs.mock.calls.map(([, payload]) => payload.body.id)).toEqual(['first', 'second']);
		channel.dispose();
	});

	test('disconnect drops an in-flight channel note and skips queued visibility checks', async () => {
		let finish!: () => void;
		const first = note({ id: 'first', channelId: 'public-channel' });
		const filter = vi.fn(() => new Promise<Packed<'Note'>>(resolve => { finish = () => resolve(first); }));
		const { channel, connection, sendMessageToWs } = channelFixture(filter);
		await channel.init({ channelId: 'public-channel' });
		const firstDelivery = (channel as any).onNote(first);
		const secondDelivery = (channel as any).onNote(note({ id: 'second', channelId: 'public-channel' }));
		await vi.waitFor(() => expect(filter).toHaveBeenCalledOnce());
		channel.dispose();
		connection.isChannelConnected.mockReturnValue(false);
		finish();
		await Promise.all([firstDelivery, secondDelivery]);
		expect(sendMessageToWs).not.toHaveBeenCalled();
		expect(filter).toHaveBeenCalledOnce();
	});

	test('a failed channel visibility check does not stall subsequent notes', async () => {
		const second = note({ id: 'second', channelId: 'public-channel' });
		const filter = vi.fn().mockRejectedValueOnce(new Error('temporary database failure')).mockResolvedValue(second);
		const { channel, sendMessageToWs } = channelFixture(filter);
		await channel.init({ channelId: 'public-channel' });
		const results = await Promise.allSettled([
			(channel as any).onNote(note({ id: 'first', channelId: 'public-channel' })),
			(channel as any).onNote(second),
		]);
		expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled']);
		expect(sendMessageToWs.mock.calls.map(([, payload]) => payload.body.id)).toEqual(['second']);
		channel.dispose();
	});

	test('note updates retain publish order when the first visibility check is delayed', async () => {
		let finish!: () => void;
		const canReceiveUpdates = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = () => resolve(true); })).mockResolvedValue(true);
		const connection = new Connection({} as never, {} as never, {} as never, {} as never, null, null, { canReceiveUpdates } as never);
		const subscriber = new EventEmitter();
		const socket = Object.assign(new EventEmitter(), { readyState: 1, send: vi.fn() });
		await connection.listen(subscriber, socket as never);
		socket.emit('message', Buffer.from(JSON.stringify({ type: 'subNote', body: { id: 'note' } })));
		await (connection as any).messageQueue(() => Promise.resolve());
		for (const text of ['first', 'second']) subscriber.emit('noteStream:note', { type: 'updated', body: { id: 'note', body: { text } } });
		await vi.waitFor(() => expect(canReceiveUpdates).toHaveBeenCalledOnce());
		expect(socket.send).not.toHaveBeenCalled();
		finish();
		await (connection as any).noteUpdateQueue(() => Promise.resolve());
		expect(socket.send.mock.calls.map(([payload]) => JSON.parse(payload).body.body.text)).toEqual(['first', 'second']);
		connection.dispose();
	});

	test('disposal drops both an in-flight note update and queued updates', async () => {
		let finish!: () => void;
		const canReceiveUpdates = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = () => resolve(true); })).mockResolvedValue(true);
		const connection = new Connection({} as never, {} as never, {} as never, {} as never, null, null, { canReceiveUpdates } as never);
		const subscriber = new EventEmitter();
		const socket = Object.assign(new EventEmitter(), { readyState: 1, send: vi.fn() });
		await connection.listen(subscriber, socket as never);
		socket.emit('message', Buffer.from(JSON.stringify({ type: 'subNote', body: { id: 'note' } })));
		await (connection as any).messageQueue(() => Promise.resolve());
		for (const text of ['first', 'second']) subscriber.emit('noteStream:note', { type: 'updated', body: { id: 'note', body: { text } } });
		await vi.waitFor(() => expect(canReceiveUpdates).toHaveBeenCalledOnce());
		connection.dispose();
		finish();
		await (connection as any).noteUpdateQueue(() => Promise.resolve());
		expect(socket.send).not.toHaveBeenCalled();
		expect(canReceiveUpdates).toHaveBeenCalledOnce();
	});
	test('disconnect waits for init and disposes its completed subscription', async () => {
		let finish!: () => void;
		const init = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
		const dispose = vi.fn();
		const channel = { id: 'one', chName: 'test', init, dispose };
		const connection = new Connection({ getChannelService: () => ({ create: () => channel }) } as never, {} as never, {} as never, {} as never, null, null, {} as never);
		const socket = Object.assign(new EventEmitter(), { readyState: 1, send: vi.fn() });
		await connection.listen(new EventEmitter(), socket as never);
		socket.emit('message', Buffer.from(JSON.stringify({ type: 'connect', body: { channel: 'test', id: 'one' } })));
		socket.emit('message', Buffer.from(JSON.stringify({ type: 'disconnect', body: { id: 'one' } })));
		await vi.waitFor(() => expect(init).toHaveBeenCalledOnce());
		expect(dispose).not.toHaveBeenCalled();
		finish();
		await (connection as any).messageQueue(() => Promise.resolve());
		expect(dispose).toHaveBeenCalledOnce();
		expect(connection.isChannelConnected(channel as never)).toBe(false);
		connection.dispose();
	});
});
