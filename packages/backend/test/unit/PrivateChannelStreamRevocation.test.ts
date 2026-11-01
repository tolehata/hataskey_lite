/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import Connection from '@/server/api/stream/Connection.js';
import { NoteStreamingHidingService } from '@/server/api/stream/NoteStreamingHidingService.js';
import { ChannelChannelService } from '@/server/api/stream/channels/channel.js';
import type { Packed } from '@/misc/json-schema.js';

async function fixture(viewer: string | null) {
	const state = { member: viewer === 'member', isPrivate: true };
	const notes = Object.assign(Object.create(NoteEntityService.prototype), {
		meta: { ugcVisibilityForVisitor: 'all' },
		channelsRepository: { findBy: async () => [{ id: 'private', userId: 'owner', moderatorUserIds: [], isPrivate: state.isPrivate }] },
		channelMembersRepository: { findBy: async () => state.member ? [{ channelId: 'private' }] : [] },
		roleService: { isModerator: async () => false, isAdministrator: async () => false },
		notesRepository: { find: async () => [] },
	}) as NoteEntityService;
	const hiding = new NoteStreamingHidingService({ ugcVisibilityForVisitor: 'all' } as never, notes);
	const channels = new ChannelChannelService(notes);
	const connection = new Connection({ getChannelService: () => channels } as never, {} as never, {} as never, {} as never,
		viewer == null ? null : { id: viewer } as never, null, hiding);
	const subscriber = new EventEmitter();
	const socket = Object.assign(new EventEmitter(), { readyState: 1, send: vi.fn() });
	await connection.listen(subscriber, socket as never);
	await connection.connectChannel('private-column', { channelId: 'private' }, 'channel');
	const channel = (connection as unknown as { channels: Array<{ onNote: (note: Packed<'Note'>) => Promise<void> }> }).channels[0];
	const note = {
		id: 'private-note', userId: 'author', user: { id: 'author', host: null }, visibility: 'public', channelId: 'private',
		replyId: null, renoteId: null, text: 'secret', files: [], fileIds: [], createdAt: '2026-10-17T00:00:00.000Z',
	} as unknown as Packed<'Note'>;
	return { state, connection, socket, channel, note };
}

describe('existing private-channel streaming boundary', () => {
	test.each([null, 'outsider'])('sends no note object or metadata to %s', async viewer => {
		const f = await fixture(viewer);
		try {
			await f.channel.onNote(f.note);
			expect(f.socket.send).not.toHaveBeenCalled();
			f.state.isPrivate = false;
			await f.channel.onNote(f.note);
			expect(f.socket.send).toHaveBeenCalledOnce();
		} finally { f.connection.dispose(); }
	});

	test('rechecks membership for an existing channel subscription', async () => {
		const f = await fixture('member');
		try {
			await f.channel.onNote(f.note);
			expect(f.socket.send).toHaveBeenCalledOnce();
			f.state.member = false;
			await f.channel.onNote({ ...f.note, id: 'after-removal' });
			expect(f.socket.send).toHaveBeenCalledOnce();
		} finally { f.connection.dispose(); }
	});
});
