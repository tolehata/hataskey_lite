/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { EntityNotFoundError } from 'typeorm';
import { MainChannelService } from '@/server/api/stream/channels/main.js';
import { AntennaChannelService } from '@/server/api/stream/channels/antenna.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import type { Packed } from '@/misc/json-schema.js';

function note(id: string, userId = 'author') {
	return { id, userId, user: { id: userId, host: null }, text: 'body' } as Packed<'Note'>;
}

async function setup(kind: 'main' | 'antenna' = 'main') {
	const denied = new Set(['private']);
	const subscriber = new EventEmitter();
	const sendMessageToWs = vi.fn();
	const noteEntityService = {
		isChannelVisibleForMe: vi.fn(async (value: Packed<'Note'>) => !denied.has(value.id)),
		filterChannelVisibleNotes: vi.fn(async (notes: Packed<'Note'>[]) => notes.filter(value => !denied.has(value.id))),
		pack: vi.fn(async (id: string) => {
			if (denied.has(id)) throw new PrivateChannelNoteVisibilityError();
			return note(id, id === 'public' ? 'public-author' : 'author');
		}),
	};
	const connection = {
		user: { id: 'viewer' }, userProfile: { mutedInstances: [] }, userMutedInstances: new Set<string>(), subscriber, sendMessageToWs,
		userIdsWhoMeMuting: new Set(), userIdsWhoBlockingMe: new Set(), userIdsWhoMeMutingRenotes: new Set(),
		hasPermission: () => true, isChannelConnected: () => true,
		noteStreamingHidingService: { filter: vi.fn(async (value: Packed<'Note'>) => value) },
	};
	const channel = kind === 'main'
		? new MainChannelService(noteEntityService as never).create('stream', connection as never)
		: new AntennaChannelService({ exists: async () => true } as never, noteEntityService as never).create('stream', connection as never);
	await channel.init({ antennaId: 'antenna' });
	const eventName = kind === 'main' ? 'mainStream:viewer' : 'antennaStream:antenna';
	const emit = async (type: string, body: unknown) => {
		const [listener] = subscriber.listeners(eventName);
		await listener({ type, body });
	};
	return { denied, emit, sendMessageToWs, noteEntityService, connection };
}

describe('main stream current private channel access', () => {
	test.each(['mention', 'reply', 'renote'])('drops inaccessible %s and retains the existing visible payload', async type => {
		const f = await setup();
		const visible = note('public');
		await f.emit(type, note('private'));
		expect(f.sendMessageToWs).not.toHaveBeenCalled();
		await f.emit(type, visible);
		expect(f.sendMessageToWs).toHaveBeenCalledWith('channel', { id: 'stream', type, body: visible });
		f.denied.add('public');
		await f.emit(type, visible);
		expect(f.sendMessageToWs).toHaveBeenCalledOnce();
	});

	test.each(['notification', 'unreadNotification'])('drops inaccessible %s, preserving non-note fields for allowed items', async type => {
		const f = await setup();
		await f.emit(type, { id: 'notice', type: 'mention', note: note('private') });
		expect(f.sendMessageToWs).not.toHaveBeenCalled();
		const body = { id: 'notice', type: 'mention', note: note('public'), isRead: false, unreadCount: 8, revision: 4 };
		await f.emit(type, body);
		expect(f.sendMessageToWs).toHaveBeenCalledWith('channel', { id: 'stream', type, body });
	});

	test('filters grouped reactions and drops an empty group without mutating the shared event', async () => {
		const f = await setup();
		const body = { id: 'notice', type: 'reaction:groupedByUser', userId: 'reactor', reactions: [
			{ note: note('private'), reaction: ':secret:' }, { note: note('public'), reaction: ':ok:' },
		], unreadCount: 2, revision: 9 };
		await f.emit('notification', body);
		expect(f.sendMessageToWs).toHaveBeenCalledWith('channel', expect.objectContaining({ body: { ...body, reactions: [body.reactions[1]] } }));
		expect(body.reactions).toHaveLength(2);
		f.denied.add('public');
		await f.emit('notification', body);
		expect(f.sendMessageToWs).toHaveBeenCalledOnce();
	});

	test('filters grouped note IDs and author summaries together and drops an empty group', async () => {
		const f = await setup();
		const publicAuthor = { id: 'public-author' };
		const body = { id: 'notice', type: 'note:grouped', noteIds: ['private', 'public'], users: [{ id: 'private-author' }, publicAuthor], unreadCount: 2, revision: 3 };
		await f.emit('unreadNotification', body);
		expect(f.sendMessageToWs).toHaveBeenCalledWith('channel', expect.objectContaining({ body: { ...body, noteIds: ['public'], users: [publicAuthor] } }));
		expect(body.noteIds).toEqual(['private', 'public']);
		f.denied.add('public');
		await f.emit('unreadNotification', body);
		expect(f.sendMessageToWs).toHaveBeenCalledOnce();
	});

	test('keeps ordinary hidden mentions and tolerates private-channel revocation while repacking', async () => {
		const f = await setup();
		const hidden = { ...note('public'), isHidden: true };
		await f.emit('mention', hidden);
		expect(f.noteEntityService.pack).toHaveBeenCalledWith('public', { id: 'viewer' }, { detail: true });
		expect(f.sendMessageToWs).toHaveBeenCalledOnce();
		f.noteEntityService.pack.mockRejectedValueOnce(new PrivateChannelNoteVisibilityError());
		await f.emit('mention', hidden);
		expect(f.sendMessageToWs).toHaveBeenCalledOnce();
		expect(hidden.isHidden).toBe(true);
	});
});

describe('antenna current private channel access', () => {
	test('ignores inaccessible or deleted notes and keeps visible notes going through the stream filter', async () => {
		const f = await setup('antenna');
		await f.emit('note', { id: 'private' });
		f.noteEntityService.pack.mockRejectedValueOnce(new EntityNotFoundError('Note', 'gone'));
		await f.emit('note', { id: 'gone' });
		expect(f.sendMessageToWs).not.toHaveBeenCalled();
		await f.emit('note', { id: 'public' });
		expect(f.connection.noteStreamingHidingService.filter).toHaveBeenCalledOnce();
		expect(f.sendMessageToWs).toHaveBeenCalledOnce();
	});
});
