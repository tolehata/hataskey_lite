/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Packed } from '@/misc/json-schema.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import Connection from '@/server/api/stream/Connection.js';
import { NoteStreamingHidingService } from '@/server/api/stream/NoteStreamingHidingService.js';
import { HomeTimelineChannelService } from '@/server/api/stream/channels/home-timeline.js';
import { HybridTimelineChannelService } from '@/server/api/stream/channels/hybrid-timeline.js';
import { LocalTimelineChannelService } from '@/server/api/stream/channels/local-timeline.js';
import { GlobalTimelineChannelService } from '@/server/api/stream/channels/global-timeline.js';
import { BubbleTimelineChannelService } from '@/server/api/stream/channels/bubble-timeline.js';
import { UserListChannelService } from '@/server/api/stream/channels/user-list.js';
import { HashtagChannelService } from '@/server/api/stream/channels/hashtag.js';
import { ChannelChannelService } from '@/server/api/stream/channels/channel.js';

vi.mock('@/core/entities/NoteEntityService.js', () => ({ NoteEntityService: class {} }));
vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/MetaService.js', () => ({ MetaService: class {} }));

const kinds = ['home', 'hybrid', 'local', 'global', 'bubble', 'userList', 'hashtag', 'channel'] as const;
type Kind = typeof kinds[number];
type Reaction = Packed<'Note'>['myReaction'];
const connections: Connection[] = [];
afterEach(() => {
	for (const connection of connections.splice(0)) connection.dispose();
});

function renote(kind: Kind = 'home'): Packed<'Note'> {
	return {
		id: 'renote', userId: 'renoter', user: { id: 'renoter', host: kind === 'bubble' ? 'remote.test' : null },
		visibility: 'public', text: null, cw: null, fileIds: [], files: [], reactions: {}, tags: ['example'],
		channelId: kind === 'channel' ? 'public-channel' : null, renoteId: 'original',
		renote: {
			id: 'original', userId: 'author', user: { id: 'author', host: null }, visibility: 'public',
			text: 'body', cw: null, fileIds: [], files: [], reactions: { '👍': 1 },
		},
	} as Packed<'Note'>;
}

async function setup(kind: Kind, viewer: string | null, reaction: Reaction, columns = 1) {
	const populateMyReaction = vi.fn(async () => reaction);
	const shouldHideNote = vi.fn(async (_note: Packed<'Note'>, _viewer: string | null) => false);
	const noteEntity = { populateMyReaction, shouldHideNote, isChannelVisibleForMe: vi.fn(async () => true) } as unknown as NoteEntityService;
	const meta = { fetch: async () => ({ bubbleInstances: ['remote.test'] }) } as never;
	const roles = { getUserPolicies: async () => ({ ltlAvailable: true, gtlAvailable: true, btlAvailable: true }) } as never;
	const services = {
		home: new HomeTimelineChannelService(noteEntity),
		hybrid: new HybridTimelineChannelService(meta, roles, noteEntity),
		local: new LocalTimelineChannelService(meta, roles, noteEntity),
		global: new GlobalTimelineChannelService(meta, roles, noteEntity),
		bubble: new BubbleTimelineChannelService(meta, roles, noteEntity),
		userList: new UserListChannelService({ exists: async () => true } as never,
			{ find: async () => [{ userId: 'renoter', withReplies: true }] } as never, noteEntity),
		hashtag: new HashtagChannelService(noteEntity),
		channel: new ChannelChannelService(noteEntity),
	};
	const hiding = new NoteStreamingHidingService({ ugcVisibilityForVisitor: 'all' } as never, noteEntity);
	const connection = new Connection({ getChannelService: () => services[kind] } as never,
		{} as never, {} as never, {} as never, viewer == null ? null : { id: viewer } as never, null, hiding);
	connections.push(connection);
	connection.following = { renoter: { withReplies: true } };
	connection.followingChannels.add('public-channel');
	const subscriber = new EventEmitter();
	const messages: { id: string; type: string; body: Packed<'Note'> }[] = [];
	const socket = Object.assign(new EventEmitter(), {
		readyState: 1,
		send: (data: string) => { messages.push(JSON.parse(data).body); },
	});
	await connection.listen(subscriber, socket as never);
	for (let column = 0; column < columns; column++) {
		await connection.connectChannel(`column-${column}`, { listId: 'list', q: [['example']], channelId: 'public-channel' }, kind);
	}
	expect(subscriber.listenerCount('notesStream')).toBe(columns);
	return { subscriber, messages, populateMyReaction, shouldHideNote };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

function deliver(note: Packed<'Note'>, ...viewers: Fixture[]): Promise<unknown[]> {
	// Redis fanout supplies the same object to each connection's EventEmitter.
	// Invoke its actual registered listeners in order, retaining their promises.
	return Promise.all(viewers.flatMap(({ subscriber }) => subscriber.listeners('notesStream').map(listener => listener(note))));
}

describe.each(kinds)('%s streaming reactions', kind => {
	test.each([
		[undefined, '👍'],
		['👍', undefined],
	] as const)('keeps concurrent viewers isolated (%s / %s)', async (firstReaction, secondReaction) => {
		const first = await setup(kind, 'first', firstReaction);
		const second = await setup(kind, 'second', secondReaction);
		const original = renote(kind);
		const before = structuredClone(original);
		await deliver(original, first, second);
		expect(first.messages).toHaveLength(1);
		expect(second.messages).toHaveLength(1);
		expect(first.messages[0].body.renote?.myReaction).toBe(firstReaction);
		expect(second.messages[0].body.renote?.myReaction).toBe(secondReaction);
		expect(first.populateMyReaction).toHaveBeenCalledWith(original.renote, 'first');
		expect(second.populateMyReaction).toHaveBeenCalledWith(original.renote, 'second');
		expect(original).toStrictEqual(before);
	});

	test('loads the viewer reaction even when the event reaction totals are stale and empty', async () => {
		const viewer = await setup(kind, 'viewer', '👍');
		const original = renote(kind);
		original.renote!.reactions = {};
		const before = structuredClone(original);
		await deliver(original, viewer);
		expect(viewer.populateMyReaction).toHaveBeenCalledWith(original.renote, 'viewer');
		expect(viewer.messages.map(message => message.body.renote?.myReaction)).toEqual(['👍']);
		expect(original).toStrictEqual(before);
	});
});

test('multiple deck columns retain their viewer reaction while another viewer receives the same event', async () => {
	const first = await setup('home', 'first', '👍', 2);
	const second = await setup('home', 'second', undefined);
	const original = renote();
	const before = structuredClone(original);
	await deliver(original, first, second);
	expect(first.messages.map(message => [message.id, message.body.renote?.myReaction])).toEqual([
		['column-0', '👍'], ['column-1', '👍'],
	]);
	expect(second.messages.map(message => message.body.renote?.myReaction)).toEqual([undefined]);
	expect(original).toStrictEqual(before);
});

test('an anonymous stream does not inherit a signed-in viewer reaction', async () => {
	const signedIn = await setup('global', 'first', '👍');
	const anonymous = await setup('global', null, undefined);
	const original = renote('global');
	await deliver(original, signedIn, anonymous);
	expect(signedIn.messages.map(message => message.body.renote?.myReaction)).toEqual(['👍']);
	expect(anonymous.messages.map(message => message.body.renote?.myReaction)).toEqual([undefined]);
	expect(anonymous.populateMyReaction).not.toHaveBeenCalled();
	expect(original.renote).not.toHaveProperty('myReaction');
});

test('viewer-specific reactions still pass through the visibility filter', async () => {
	const allowed = await setup('home', 'allowed', '👍');
	const hidden = await setup('home', 'hidden', undefined);
	hidden.shouldHideNote.mockImplementation(async note => note.id === 'original');
	const original = renote();
	const before = structuredClone(original);
	await deliver(original, allowed, hidden);
	expect(allowed.messages.map(message => message.body.renote?.myReaction)).toEqual(['👍']);
	expect(hidden.messages).toEqual([]);
	expect(hidden.shouldHideNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'original' }), 'hidden', { channelVisibilityChecked: true });
	expect(original).toStrictEqual(before);
});
