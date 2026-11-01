/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type Connection from '@/server/api/stream/Connection.js';

const observed = vi.hoisted(() => ({ onConnection: undefined as ((stream: Connection, socket: unknown) => void) | undefined }));

vi.mock('ws', async importOriginal => {
	const original = await importOriginal<typeof import('ws')>();
	const { EventEmitter: Emitter } = await import('node:events');
	return {
		...original,
		// emitDecoratorMetadata may read this type-only namespace member at runtime.
		RawData: undefined,
		WebSocketServer: class extends Emitter {
			clients = new Set();
			emit(event: string | symbol, ...args: unknown[]): boolean {
				if (event === 'connection') observed.onConnection?.((args[2] as { stream: Connection }).stream, args[0]);
				return super.emit(event, ...args);
			}
			handleUpgrade(_request: unknown, _socket: unknown, _head: unknown, done: (ws: unknown) => void) {
				const ws = Object.assign(new Emitter(), {
					readyState: original.WebSocket.OPEN as number,
					send: vi.fn(), ping: vi.fn(),
					terminate: vi.fn(() => {
						ws.readyState = original.WebSocket.CLOSED;
						ws.emit('close');
						this.clients.delete(ws);
					}),
				});
				this.clients.add(ws);
				done(ws);
			}
			close(done: () => void) { done(); }
		},
	};
});

import { StreamingApiServerService } from '@/server/api/StreamingApiServerService.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
	await Promise.all(cleanup.splice(0).map(dispose => dispose()));
});

function fixture() {
	const redis = new EventEmitter();
	const server = new EventEmitter();
	const users = new Map(['alice', 'bob'].map(id => [id, { id, host: null, isSuspended: false, isDeleted: false }]));
	const snapshots = new Map([...users].map(([id, user]) => [id, { ...user }]));
	const repository = { findOneBy: vi.fn(async ({ id }: { id: string }) => users.get(id) ?? null) };
	const markNotificationRead = vi.fn(async () => undefined);
	const cache = {
		userProfileCache: { fetch: vi.fn(async () => ({ mutedInstances: [] })) },
		userFollowingsCache: { fetch: async () => ({}) },
		userMutingsCache: { fetch: async () => new Set() },
		userBlockedCache: { fetch: async () => new Set() },
		renoteMutingsCache: { fetch: async () => new Set() },
	};
	const service = new StreamingApiServerService(redis as never, repository as never, cache as never,
		{ authenticate: async (token: string | null) => [token ? snapshots.get(token) : null, null, null] } as never,
		{} as never, {} as never, { markNotificationRead } as never,
		{ updateLastActiveDate: vi.fn() } as never, { userFollowingChannelsCache: { fetch: async () => new Set() } } as never);
	const streams: Connection[] = [];
	const sockets: Array<EventEmitter & { readyState: number; send: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }> = [];
	observed.onConnection = (stream, ws) => {
		streams.push(stream);
		sockets.push(ws as never);
	};
	service.attach(server as never);
	cleanup.push(async () => { await service.detach(); observed.onConnection = undefined; });
	const upgrade = async (token: string | null = 'alice') => {
		const socket = Object.assign(new EventEmitter(), {
			destroyed: false, write: vi.fn(),
			destroy: vi.fn(() => { socket.destroyed = true; socket.emit('close'); }),
		});
		await server.listeners('upgrade')[0]({ url: `/streaming${token ? `?i=${token}` : ''}`, headers: { host: 'local.invalid' } }, socket, Buffer.alloc(0));
		return socket;
	};
	const revoke = (type = 'userChangeSuspendedState', id = 'alice', value = true) => {
		redis.emit('message', 'redis', JSON.stringify({ channel: 'internal', message: { type, body: { id, [type === 'userChangeSuspendedState' ? 'isSuspended' : 'isDeleted']: value } } }));
	};
	return { service, redis, users, repository, cache, markNotificationRead, upgrade, revoke, streams, sockets };
}

async function flushInbound(stream: Connection): Promise<void> {
	await (stream as unknown as { messageQueue: (work: () => Promise<void>) => Promise<void> }).messageQueue(async () => {});
}

describe('streaming account revocation', () => {
	test.each(['userChangeSuspendedState', 'userChangeDeletedState'])('closes only the revoked user and stops queued inbound/outbound work for %s', async type => {
		const f = fixture();
		await f.upgrade('alice');
		await f.upgrade('bob');
		await f.upgrade(null);
		const [alice, bob, anonymous] = f.sockets;
		const [stream] = f.streams;
		alice.emit('message', Buffer.from(JSON.stringify({ type: 'readNotification', body: { id: 'notification' } })));
		await flushInbound(stream);
		expect(f.markNotificationRead).toHaveBeenCalledWith('alice', 'notification');
		stream.sendMessageToWs('before', {});
		expect(alice.send).toHaveBeenCalledOnce();
		// Queue work and revoke before its promise-limited callback runs.
		const pending = Promise.withResolvers<void>();
		const blocking = (stream as unknown as { messageQueue: (work: () => Promise<void>) => Promise<void> }).messageQueue(() => pending.promise);
		alice.emit('message', Buffer.from(JSON.stringify({ type: 'readNotification', body: { id: 'after' } })));
		f.revoke(type);
		pending.resolve();
		await blocking;
		await flushInbound(stream);
		stream.sendMessageToWs('after', {});
		expect(alice.terminate).toHaveBeenCalledOnce();
		expect(bob.terminate).not.toHaveBeenCalled();
		expect(anonymous.terminate).not.toHaveBeenCalled();
		expect(alice.send).toHaveBeenCalledOnce();
		expect(f.markNotificationRead).toHaveBeenCalledOnce();
	});

	test('ignores unsuspension and unrelated events for active sockets', async () => {
		const f = fixture();
		await f.upgrade();
		f.revoke('userChangeSuspendedState', 'alice', false);
		f.revoke('userChangeDeletedState', 'alice', false);
		f.revoke('userChangeSuspendedState', 'unconnected-user');
		f.streams[0].sendMessageToWs('still-active', {});
		expect(f.sockets[0].send).toHaveBeenCalledOnce();
		expect(f.sockets[0].terminate).not.toHaveBeenCalled();
	});

	test.each(['isSuspended', 'isDeleted', 'missing'] as const)('rejects a stale authentication snapshot when the current account is %s', async state => {
		const f = fixture();
		if (state === 'missing') f.users.delete('alice');
		else f.users.get('alice')![state] = true;
		const socket = await f.upgrade();
		expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 403 Forbidden\r\n\r\n');
		expect(socket.destroy).toHaveBeenCalled();
		expect(f.streams).toHaveLength(0);
	});

	test('remembers a suspension during the final database lookup even if that lookup returns an old row', async () => {
		const f = fixture();
		const pending = Promise.withResolvers<NonNullable<ReturnType<typeof f.users.get>>>();
		f.repository.findOneBy.mockReturnValueOnce(pending.promise);
		const upgrading = f.upgrade();
		await vi.waitFor(() => expect(f.repository.findOneBy).toHaveBeenCalled());
		f.revoke();
		pending.resolve({ ...f.users.get('alice')! });
		const socket = await upgrading;
		expect(socket.write).toHaveBeenCalledWith('HTTP/1.1 403 Forbidden\r\n\r\n');
		expect(f.streams).toHaveLength(0);
	});

	test('removes the account listener when the streaming server detaches', async () => {
		const f = fixture();
		await f.upgrade();
		expect(f.redis.listenerCount('message')).toBe(1);
		await f.service.detach();
		expect(f.redis.listenerCount('message')).toBe(0);
	});
});
