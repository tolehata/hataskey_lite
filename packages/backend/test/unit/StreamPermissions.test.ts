/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import Connection from '@/server/api/stream/Connection.js';
import { MainChannelService } from '@/server/api/stream/channels/main.js';
import { DriveChannelService } from '@/server/api/stream/channels/drive.js';
import { StreamingApiServerService } from '@/server/api/StreamingApiServerService.js';
import { WebSocketServer } from 'ws';

async function setup(kind: 'native' | 'app' | 'flash', permissions = ['read:account']) {
	const main = new MainChannelService({ pack: vi.fn() } as never);
	const privateInit = vi.fn();
	const channels = { getChannelService: (name: string) => name === 'main' ? main : name === 'drive' ? new DriveChannelService() : {
		kind: name === 'native' ? null : 'read:chat', requireCredential: true, shouldShare: false,
		create: (id: string) => ({ id, chName: name, init: privateInit }),
	} };
	const notifications = { markNotificationRead: vi.fn().mockResolvedValue(undefined) };
	const user = { id: 'owner' };
	const connection = new Connection(channels as never, notifications as never, {} as never, {} as never,
		user as never, kind === 'app' ? { permission: permissions } as never : null, {} as never,
		kind === 'flash' ? { permissions, user } as never : null);
	const subscriber = new EventEmitter();
	const socket = Object.assign(new EventEmitter(), { readyState: 1, send: vi.fn() });
	await connection.listen(subscriber, socket as never);
	await connection.connectChannel('main-id', {}, 'main');
	return { connection, subscriber, socket, notifications, privateInit };
}

describe('stream credentials and event permissions', () => {
	test.each([true, false])('the WebSocket handshake retains Play credentials (read:account = %s)', async allowed => {
		const flash = { user: { id: 'owner' }, permissions: allowed ? ['read:account'] : ['read:chat'] };
		const init = vi.spyOn(Connection.prototype, 'init').mockResolvedValue(undefined);
		const upgrade = vi.spyOn(WebSocketServer.prototype, 'handleUpgrade').mockImplementation(() => {});
		const authenticate = vi.fn().mockResolvedValue([flash.user, null, flash]);
		// The handshake rereads the account so a suspension racing the upgrade is honored.
		const users = { findOneBy: vi.fn().mockResolvedValue({ ...flash.user, isSuspended: false, isDeleted: false }) };
		const service = new StreamingApiServerService(new EventEmitter() as never, users as never, {} as never,
			{ authenticate } as never, {} as never, {} as never, {} as never, {} as never, {} as never);
		const server = new EventEmitter();
		const socket = Object.assign(new EventEmitter(), { write: vi.fn(), destroy: vi.fn(), destroyed: false });
		try {
			service.attach(server as never);
			server.emit('upgrade', { url: '/streaming?i=play-token', headers: { host: 'local.test' } }, socket, Buffer.alloc(0));
			await new Promise(resolve => setImmediate(resolve));
			if (allowed) {
				expect(upgrade).toHaveBeenCalledOnce();
				const connection = init.mock.contexts[0] as Connection;
				expect(connection.flashToken).toBe(flash);
				expect(connection.hasPermission(null)).toBe(false);
			} else {
				expect(upgrade).not.toHaveBeenCalled();
				expect(socket.write).toHaveBeenCalledWith(expect.stringContaining('401 Unauthorized'));
				expect(socket.destroy).toHaveBeenCalledOnce();
			}
		} finally { await service.detach(); init.mockRestore(); upgrade.mockRestore(); }
	});

	test.each(['app', 'flash'] as const)('%s read:account cannot receive private events or use privileged channel operations', async kind => {
		const current = await setup(kind);
		try {
			for (const type of ['registryUpdated', 'signin', 'newChatMessage', 'notification', 'unreadNotification', 'driveFileCreated', 'urlUploadFinished', 'follow', 'mutingImportCompleted', 'futureEvent', '__proto__']) {
				current.subscriber.emit('mainStream:owner', { type, body: { value: 'private-sentinel' } });
			}
			await current.connection.connectChannel('chat-id', {}, 'chat');
			await current.connection.connectChannel('native-id', {}, 'native');
			await current.connection.connectChannel('drive-id', {}, 'drive');
			current.subscriber.emit('driveStream:owner', { type: 'fileCreated', body: { id: 'private-file', url: 'https://private.example/file' } });
			current.socket.emit('message', Buffer.from(JSON.stringify({ type: 'readNotification', body: { id: 'notice' } })));
			await new Promise(resolve => setImmediate(resolve));
			expect(current.privateInit).not.toHaveBeenCalled();
			expect(current.notifications.markNotificationRead).not.toHaveBeenCalled();
			expect(current.socket.send).not.toHaveBeenCalled();
			current.subscriber.emit('mainStream:owner', { type: 'meUpdated', body: { id: 'owner' } });
			expect(JSON.parse(current.socket.send.mock.calls[0][0]).body.type).toBe('meUpdated');
		} finally { current.connection.dispose(); }
	});

	test.each(['native', 'app', 'flash'] as const)('%s retains legitimately authorized events, subscriptions and notification reads', async kind => {
		const current = await setup(kind, ['read:account', 'read:chat', 'read:notifications', 'read:drive']);
		try {
			for (const type of ['newChatMessage', 'notification', 'driveFileCreated']) current.subscriber.emit('mainStream:owner', { type, body: { id: 'item' } });
			await current.connection.connectChannel('chat-id', {}, 'chat');
			await current.connection.connectChannel('drive-id', {}, 'drive');
			current.subscriber.emit('driveStream:owner', { type: 'fileCreated', body: { id: 'allowed-file' } });
			current.socket.emit('message', Buffer.from(JSON.stringify({ type: 'readNotification', body: { id: 'notice' } })));
			await new Promise(resolve => setImmediate(resolve));
			expect(current.socket.send).toHaveBeenCalledTimes(4);
			expect(current.privateInit).toHaveBeenCalledOnce();
			expect(current.notifications.markNotificationRead).toHaveBeenCalledWith('owner', 'notice');
			current.subscriber.emit('mainStream:owner', { type: 'registryUpdated', body: { value: 'native-private' } });
			expect(current.socket.send).toHaveBeenCalledTimes(kind === 'native' ? 5 : 4);
		} finally { current.connection.dispose(); }
	});

	test('a Play token without read:account cannot subscribe to main', async () => {
		const current = await setup('flash', ['read:chat']);
		try {
			expect(current.subscriber.listenerCount('mainStream:owner')).toBe(0);
		} finally {
			current.connection.dispose();
		}
	});
});
