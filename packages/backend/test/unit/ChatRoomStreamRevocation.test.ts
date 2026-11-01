/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { ChatService } from '@/core/ChatService.js';
import Connection from '@/server/api/stream/Connection.js';
import { ChatRoomChannelService } from '@/server/api/stream/channels/chat-room.js';

async function fixture(userId = 'member') {
	const room = { id: 'room', ownerId: 'owner', isArchived: false };
	const state = { room: room as typeof room | null, member: true };
	const memberships = { findOneBy: vi.fn(async () => state.member ? { id: 'membership' } : null) };
	const chat = Object.assign(Object.create(ChatService.prototype), {
		chatRoomMembershipsRepository: memberships,
	}) as ChatService;
	Object.defineProperty(chat, 'readRoomChatMessage', { value: vi.fn(async () => undefined), configurable: true });
	const rooms = { findOneBy: vi.fn(async () => state.room) };
	const channelService = new ChatRoomChannelService(rooms as never, chat);
	const connection = new Connection({ getChannelService: () => channelService } as never, {} as never, {} as never, {} as never,
		{ id: userId } as never, null, {} as never);
	const subscriber = new EventEmitter();
	const socket = Object.assign(new EventEmitter(), { readyState: 1, send: vi.fn() });
	await connection.listen(subscriber, socket as never);
	await connection.connectChannel('chat', { roomId: room.id }, 'chatRoom');
	const channel = (connection as unknown as { channels: Array<{
		onEvent: (event: { type: string; body: unknown }) => Promise<void>;
		onMessage: (type: string, body: unknown) => Promise<void>;
	}> }).channels[0];
	return { state, rooms, chat, connection, subscriber, socket, channel, memberships };
}

describe('chat room stream current membership', () => {
	test.each(['message', 'deleted', 'react', 'unreact'])('stops %s events after leaving and detaches the room listener', async type => {
		const f = await fixture();
		try {
			await f.channel.onEvent({ type, body: { id: 'allowed' } });
			expect(f.socket.send).toHaveBeenCalledOnce();
			f.state.member = false;
			await f.channel.onEvent({ type, body: { id: 'private-after-leave' } });
			expect(f.socket.send).toHaveBeenCalledOnce();
			expect(f.subscriber.listenerCount('chatRoomStream:room')).toBe(0);
		} finally { f.connection.dispose(); }
	});

	test('denies read messages from a former member while retaining current member reads', async () => {
		const f = await fixture();
		try {
			await f.channel.onMessage('read', {});
			expect(f.chat.readRoomChatMessage).toHaveBeenCalledWith('member', 'room');
			f.state.member = false;
			await f.channel.onMessage('read', {});
			expect(f.chat.readRoomChatMessage).toHaveBeenCalledOnce();
		} finally { f.connection.dispose(); }
	});

	test('keeps the room owner authorized without a membership row', async () => {
		const f = await fixture('owner');
		try {
			f.state.member = false;
			await f.channel.onEvent({ type: 'message', body: { id: 'owner-message' } });
			await f.channel.onMessage('read', {});
			expect(f.socket.send).toHaveBeenCalledOnce();
			expect(f.chat.readRoomChatMessage).toHaveBeenCalledOnce();
			expect(f.memberships.findOneBy).not.toHaveBeenCalled();
		} finally { f.connection.dispose(); }
	});

	test('drops events when the room no longer exists', async () => {
		const f = await fixture();
		try {
			f.state.room = null;
			await f.channel.onEvent({ type: 'message', body: { id: 'deleted-room' } });
			expect(f.socket.send).not.toHaveBeenCalled();
			expect(f.subscriber.listenerCount('chatRoomStream:room')).toBe(0);
		} finally { f.connection.dispose(); }
	});

	test('drops an in-flight event when its connection is disposed during the membership lookup', async () => {
		const f = await fixture();
		const pending = Promise.withResolvers<{ id: string }>();
		f.memberships.findOneBy.mockReturnValueOnce(pending.promise);
		const delivery = f.channel.onEvent({ type: 'message', body: { id: 'in-flight' } });
		await vi.waitFor(() => expect(f.memberships.findOneBy).toHaveBeenCalledTimes(2));
		f.connection.dispose();
		pending.resolve({ id: 'membership' });
		await delivery;
		expect(f.socket.send).not.toHaveBeenCalled();
	});

	test('does not send on a failed membership lookup and recovers for a valid later event', async () => {
		const f = await fixture();
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			f.memberships.findOneBy.mockRejectedValueOnce(new Error('database unavailable'));
			await f.channel.onEvent({ type: 'message', body: { id: 'not-authorized' } });
			expect(f.socket.send).not.toHaveBeenCalled();
			expect(log).toHaveBeenCalledWith('Chat room stream authorization failed', expect.any(Error));
			await f.channel.onEvent({ type: 'message', body: { id: 'authorized' } });
			expect(f.socket.send).toHaveBeenCalledOnce();
		} finally { f.connection.dispose(); }
	});
});
