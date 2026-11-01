/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'events';
import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import * as WebSocket from 'ws';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, MiAccessToken } from '@/models/_.js';
import { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import type { MiLocalUser } from '@/models/User.js';
import { UserService } from '@/core/UserService.js';
import { ChannelFollowingService } from '@/core/ChannelFollowingService.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { FlashToken } from '@/misc/flash-token.js';
import { AuthenticateService, AuthenticationError } from './AuthenticateService.js';
import MainStreamConnection from './stream/Connection.js';
import { NoteStreamingHidingService } from './stream/NoteStreamingHidingService.js';
import { ChannelsService } from './stream/ChannelsService.js';
import type * as http from 'node:http';

type StreamingSession = {
	stream: MainStreamConnection;
	connection?: WebSocket.WebSocket;
	revoked: boolean;
};

@Injectable()
export class StreamingApiServerService {
	#wss: WebSocket.WebSocketServer;
	#connections = new Map<WebSocket.WebSocket, number>();
	#cleanConnectionsIntervalId: NodeJS.Timeout | null = null;
	#userSessions = new Map<string, Set<StreamingSession>>();
	#globalEv = new EventEmitter();
	// 上流 2026.10.1: 同じユーザーの複数接続で最終アクセス日時の更新を重ねない
	#activeUsers = new Map<MiLocalUser['id'], { connections: number; intervalId: NodeJS.Timeout; }>();

	constructor(
		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private cacheService: CacheService,
		private authenticateService: AuthenticateService,
		private channelsService: ChannelsService,
		private noteStreamingHidingService: NoteStreamingHidingService,
		private notificationService: NotificationService,
		private usersService: UserService,
		private channelFollowingService: ChannelFollowingService,
	) {
	}

	@bindThis
	private onRedisMessage(_: string, data: string): void {
		const parsed = JSON.parse(data);
		if (parsed.channel === 'internal') {
			const { type, body } = parsed.message as GlobalEvents['internal']['payload'];
			if ((type === 'userChangeSuspendedState' && body.isSuspended)
				|| (type === 'userChangeDeletedState' && body.isDeleted)) {
				for (const session of this.#userSessions.get(body.id) ?? []) {
					session.revoked = true;
					// Dispose first: queued inbound work and outbound sends must stop
					// before the socket's asynchronous close callback runs.
					session.stream.dispose();
					session.connection?.terminate();
				}
			}
		}
		this.#globalEv.emit('message', parsed);
	}

	private removeSession(userId: string, session: StreamingSession): void {
		const sessions = this.#userSessions.get(userId);
		sessions?.delete(session);
		if (sessions?.size === 0) this.#userSessions.delete(userId);
	}

	@bindThis
	public attach(server: http.Server): void {
		this.#wss = new WebSocket.WebSocketServer({
			noServer: true,
			maxPayload: 1024 * 1024, // 1MiB
			perMessageDeflate: false,
		});

		server.on('upgrade', async (request, socket, head) => {
			if (request.url == null) {
				socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
				socket.destroy();
				return;
			}

			const q = new URL(request.url, `http://${request.headers.host}`).searchParams;

			let user: MiLocalUser | null = null;
			let app: MiAccessToken | null = null;
			let flashToken: FlashToken | null = null;

			// https://datatracker.ietf.org/doc/html/rfc6750.html#section-2.1
			// Note that the standard WHATWG WebSocket API does not support setting any headers,
			// but non-browser apps may still be able to set it.
			const token = request.headers.authorization?.startsWith('Bearer ')
				? request.headers.authorization.slice(7)
				: q.get('i');

			try {
				[user, app, flashToken] = await this.authenticateService.authenticate(token);

				if ((app !== null && !app.permission.includes('read:account')) || (flashToken !== null && !flashToken.permissions.includes('read:account'))) {
					throw new AuthenticationError('Your app does not have necessary permissions to use websocket API.');
				}
			} catch (e) {
				if (e instanceof AuthenticationError) {
					socket.write([
						'HTTP/1.1 401 Unauthorized',
						'WWW-Authenticate: Bearer realm="CherryPick", error="invalid_token", error_description="Failed to authenticate"',
					].join('\r\n') + '\r\n\r\n');
				} else {
					socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
				}
				socket.destroy();
				return;
			}

			if (user?.isSuspended || user?.isDeleted) {
				socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
				socket.destroy();
				return;
			}

			const stream = new MainStreamConnection(
				this.channelsService,
				this.notificationService,
				this.cacheService,
				this.channelFollowingService,
				user, app,
				this.noteStreamingHidingService,
				flashToken,
			);

			const session: StreamingSession = { stream, revoked: false };
			if (user) {
				const sessions = this.#userSessions.get(user.id) ?? new Set<StreamingSession>();
				sessions.add(session);
				this.#userSessions.set(user.id, sessions);
			}
			const cleanup = () => {
				stream.dispose();
				if (user) this.removeSession(user.id, session);
			};
			socket.once('close', cleanup);
			try {
				await stream.init();
				// Register before this lookup so a revocation racing with initialization
				// is remembered even if the lookup itself returns an earlier snapshot.
				const currentUser = user ? await this.usersRepository.findOneBy({ id: user.id }) : null;
				if (session.revoked || (user && (currentUser == null || currentUser.isSuspended || currentUser.isDeleted))) {
					socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
					socket.destroy();
					cleanup();
					return;
				}
				if (currentUser) stream.user = currentUser;
				if (socket.destroyed) {
					cleanup();
					return;
				}
				this.#wss.handleUpgrade(request, socket, head, (ws) => {
					session.connection = ws;
					this.#wss.emit('connection', ws, request, {
						stream, user, app,
					});
					ws.once('close', cleanup);
				});
			} catch {
				cleanup();
				socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
				socket.destroy();
			}
		});

		this.redisForSub.on('message', this.onRedisMessage);

		this.#wss.on('connection', async (connection: WebSocket.WebSocket, request: http.IncomingMessage, ctx: {
			stream: MainStreamConnection,
			user: MiLocalUser | null;
			app: MiAccessToken | null
		}) => {
			const { stream, user, app } = ctx;

			const ev = new EventEmitter();

			function onRedisMessage(data: any): void {
				ev.emit(data.channel, data.message);
			}

			this.#globalEv.on('message', onRedisMessage);
			connection.once('close', () => {
				ev.removeAllListeners();
				stream.dispose();
				this.#globalEv.off('message', onRedisMessage);
				this.#connections.delete(connection);
			});

			await stream.listen(ev, connection);
			if (connection.readyState !== WebSocket.WebSocket.OPEN) return;

			this.#connections.set(connection, Date.now());

			if (user) this.onUserConnected(user);

			connection.once('close', () => {
				if (user) this.onUserDisconnected(user);
			});

			connection.on('pong', () => {
				this.#connections.set(connection, Date.now());
			});
		});

		// 一定期間通信が無いコネクションは実際には切断されている可能性があるため定期的にterminateする
		this.#cleanConnectionsIntervalId = setInterval(() => {
			const now = Date.now();
			for (const [connection, lastActive] of this.#connections.entries()) {
				if (now - lastActive > 1000 * 60 * 2) {
					connection.terminate();
					this.#connections.delete(connection);
				} else {
					connection.ping();
				}
			}
		}, 1000 * 60);
	}

	// 旗鯖fork: 本家 2026.6.0 から取り込み: detach() を Promise 化して wss.close() の完了を待ち、リークした WS 接続による shutdown 警告(UnhandledPromiseRejectionWarning 経路) を抑止
	@bindThis
	private onUserConnected(user: MiLocalUser): void {
		const activeUser = this.#activeUsers.get(user.id);
		if (activeUser) {
			activeUser.connections++;
			return;
		}

		this.usersService.updateLastActiveDate(user);
		this.#activeUsers.set(user.id, {
			connections: 1,
			intervalId: setInterval(() => {
				this.usersService.updateLastActiveDate(user);
			}, 1000 * 60 * 5),
		});
	}

	@bindThis
	private onUserDisconnected(user: MiLocalUser): void {
		const activeUser = this.#activeUsers.get(user.id);
		if (!activeUser) return;

		activeUser.connections--;
		if (activeUser.connections <= 0) {
			clearInterval(activeUser.intervalId);
			this.#activeUsers.delete(user.id);
		}
	}

	@bindThis
	public detach(): Promise<void> {
		this.redisForSub.off('message', this.onRedisMessage);
		if (this.#cleanConnectionsIntervalId) {
			clearInterval(this.#cleanConnectionsIntervalId);
			this.#cleanConnectionsIntervalId = null;
		}
		// 旗鯖独自: 既存 client を即時 terminate して wss.close() のハングを防ぐ
		this.#wss.clients.forEach(client => client.terminate());
		return new Promise((resolve) => {
			this.#wss.close(() => resolve());
		});
	}
}
