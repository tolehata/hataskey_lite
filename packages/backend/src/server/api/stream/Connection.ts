/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as WebSocket from 'ws';
import promiseLimit from 'promise-limit';
import type { NoteStreamingHidingService } from './NoteStreamingHidingService.js';
import type { MiUser } from '@/models/User.js';
import type { MiAccessToken } from '@/models/AccessToken.js';
import type { FlashToken } from '@/misc/flash-token.js';
import type { Packed } from '@/misc/json-schema.js';
import type { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import { MiFollowing, MiUserProfile } from '@/models/_.js';
import type { StreamEventEmitter, GlobalEvents } from '@/core/GlobalEventService.js';
import { ChannelFollowingService } from '@/core/ChannelFollowingService.js';
import { isJsonObject } from '@/misc/json-value.js';
import type { JsonObject, JsonValue } from '@/misc/json-value.js';
import type { ChannelsService } from './ChannelsService.js';
import type { EventEmitter } from 'events';
import type Channel from './channel.js';

const MAX_CHANNELS_PER_CONNECTION = 32;
const MAX_SUBSCRIBING_NOTES_PER_CONNECTION = 1536;
const MAX_BUFFERED_AMOUNT_PER_CONNECTION = 1024 * 1024 * 8; // 8MiB

/**
 * Main stream connection
 */
// eslint-disable-next-line import/no-default-export
export default class Connection {
	public user?: MiUser;
	public token?: MiAccessToken;
	private wsConnection: WebSocket.WebSocket;
	public subscriber: StreamEventEmitter;
	private channels: Channel[] = [];
	private messageQueue = promiseLimit<void>(1);
	private noteUpdateQueue = promiseLimit<void>(1);
	private disposed = false;
	private subscribingNotes: Map<string, number> = new Map();
	public userProfile: MiUserProfile | null = null;
	public following: Record<string, Pick<MiFollowing, 'withReplies'> | undefined> = {};
	public followingChannels: Set<string> = new Set();
	public userIdsWhoMeMuting: Set<string> = new Set();
	public userIdsWhoBlockingMe: Set<string> = new Set();
	public userIdsWhoMeMutingRenotes: Set<string> = new Set();
	public userMutedInstances: Set<string> = new Set();
	private fetchIntervalId: NodeJS.Timeout | null = null;

	constructor(
		private channelsService: ChannelsService,
		private notificationService: NotificationService,
		private cacheService: CacheService,
		private channelFollowingService: ChannelFollowingService,

		user: MiUser | null | undefined,
		token: MiAccessToken | null | undefined,
		public noteStreamingHidingService: NoteStreamingHidingService,
		public readonly flashToken: FlashToken | null = null,
	) {
		if (user) this.user = user;
		if (token) this.token = token;
	}

	/** A null permission denotes an operation reserved for a native session. */
	public hasPermission(permission: string | null): boolean {
		if (this.user == null) return false;
		if (this.token == null && this.flashToken == null) return true;
		if (permission == null) return false;
		return (this.token == null || this.token.permission.includes(permission))
			&& (this.flashToken == null || this.flashToken.permissions.includes(permission));
	}

	@bindThis
	public async fetch() {
		if (this.user == null) return;
		const [userProfile, following, followingChannels, userIdsWhoMeMuting, userIdsWhoBlockingMe, userIdsWhoMeMutingRenotes] = await Promise.all([
			this.cacheService.userProfileCache.fetch(this.user.id),
			this.cacheService.userFollowingsCache.fetch(this.user.id),
			this.channelFollowingService.userFollowingChannelsCache.fetch(this.user.id),
			this.cacheService.userMutingsCache.fetch(this.user.id),
			this.cacheService.userBlockedCache.fetch(this.user.id),
			this.cacheService.renoteMutingsCache.fetch(this.user.id),
		]);
		this.userProfile = userProfile;
		this.following = following;
		this.followingChannels = followingChannels;
		this.userIdsWhoMeMuting = userIdsWhoMeMuting;
		this.userIdsWhoBlockingMe = userIdsWhoBlockingMe;
		this.userIdsWhoMeMutingRenotes = userIdsWhoMeMutingRenotes;
		this.userMutedInstances = new Set(userProfile.mutedInstances);
	}

	@bindThis
	public async init() {
		if (this.user != null) {
			await this.fetch();

			if (!this.fetchIntervalId) {
				this.fetchIntervalId = setInterval(this.fetch, 1000 * 10);
			}
		}
	}

	@bindThis
	public async listen(subscriber: EventEmitter, wsConnection: WebSocket.WebSocket) {
		this.subscriber = subscriber;

		this.wsConnection = wsConnection;
		this.wsConnection.on('message', data => {
			void this.messageQueue(() => this.onWsConnectionMessage(data)).catch(() => {});
		});

		this.subscriber.on('broadcast', data => {
			this.onBroadcastMessage(data);
		});
	}

	/**
	 * クライアントからメッセージ受信時
	 */
	@bindThis
	private async onWsConnectionMessage(data: WebSocket.RawData) {
		if (this.disposed || this.wsConnection.readyState !== WebSocket.WebSocket.OPEN) return;
		let obj: JsonObject;

		try {
			obj = JSON.parse(data.toString());
		} catch (e) {
			return;
		}

		const { type, body } = obj;

		switch (type) {
			case 'readNotification': this.onReadNotification(body); break;
			case 'subNote': this.onSubscribeNote(body); break;
			case 's': this.onSubscribeNote(body); break; // alias
			case 'sr': this.onSubscribeNote(body); break;
			case 'unsubNote': this.onUnsubscribeNote(body); break;
			case 'un': this.onUnsubscribeNote(body); break; // alias
			case 'connect': await this.onChannelConnectRequested(body); break;
			case 'disconnect': this.onChannelDisconnectRequested(body); break;
			case 'channel': this.onChannelMessageRequested(body); break;
			case 'ch': this.onChannelMessageRequested(body); break; // alias
		}
	}

	@bindThis
	private onBroadcastMessage(data: GlobalEvents['broadcast']['payload']) {
		this.sendMessageToWs(data.type, data.body);
	}

	@bindThis
	private onReadNotification(payload: JsonValue | undefined) {
		if (this.user == null || !this.hasPermission('read:notifications')) return;
		if (!isJsonObject(payload) || typeof payload.id !== 'string' || !/^[a-zA-Z0-9]{1,80}$/.test(payload.id)) return;
		void this.notificationService.markNotificationRead(this.user.id, payload.id).catch(() => {});
	}

	/**
	 * 投稿購読要求時
	 */
	@bindThis
	private onSubscribeNote(payload: JsonValue | undefined) {
		if (!isJsonObject(payload)) return;
		if (!payload.id || typeof payload.id !== 'string') return;

		const current = this.subscribingNotes.get(payload.id) ?? 0;
		if (current === 0 && this.subscribingNotes.size >= MAX_SUBSCRIBING_NOTES_PER_CONNECTION) {
			const oldestId = this.subscribingNotes.keys().next().value;
			if (oldestId != null) {
				this.subscriber.off(`noteStream:${oldestId}`, this.onNoteStreamMessage);
				this.subscribingNotes.delete(oldestId);
			}
		} else {
			// 再購読時も順序を更新して、古い購読から解除する。
			this.subscribingNotes.delete(payload.id);
		}
		const updated = current + 1;
		this.subscribingNotes.set(payload.id, updated);

		if (updated === 1) {
			this.subscriber.on(`noteStream:${payload.id}`, this.onNoteStreamMessage);
		}
	}

	/**
	 * 投稿購読解除要求時
	 */
	@bindThis
	private onUnsubscribeNote(payload: JsonValue | undefined) {
		if (!isJsonObject(payload)) return;
		if (!payload.id || typeof payload.id !== 'string') return;

		const current = this.subscribingNotes.get(payload.id);
		if (current == null) return;
		const updated = current - 1;
		if (updated <= 0) {
			this.subscribingNotes.delete(payload.id);
			this.subscriber.off(`noteStream:${payload.id}`, this.onNoteStreamMessage);
		} else {
			this.subscribingNotes.set(payload.id, updated);
		}
	}

	@bindThis
	private onNoteStreamMessage(data: GlobalEvents['note']['payload']) {
		void this.noteUpdateQueue(() => this.processNoteStreamMessage(data)).catch(() => {});
	}

	private async processNoteStreamMessage(data: GlobalEvents['note']['payload']) {
		if (this.disposed || !this.subscribingNotes.has(data.body.id)) return;
		if (!await this.noteStreamingHidingService.canReceiveUpdates(data.body, this.user?.id ?? null)) return;
		if (!this.subscribingNotes.has(data.body.id)) return;

		this.sendMessageToWs('noteUpdated', {
			id: data.body.id,
			type: data.type,
			body: data.body.body,
		});
	}

	/**
	 * チャンネル接続要求時
	 */
	@bindThis
	private async onChannelConnectRequested(payload: JsonValue | undefined) {
		if (!isJsonObject(payload)) return;
		const { channel, id, params, pong } = payload;
		if (typeof id !== 'string') return;
		if (typeof channel !== 'string') return;
		if (typeof pong !== 'boolean' && typeof pong !== 'undefined' && pong !== null) return;
		if (typeof params !== 'undefined' && !isJsonObject(params)) return;
		await this.connectChannel(id, params, channel, pong ?? undefined);
	}

	/**
	 * チャンネル切断要求時
	 */
	@bindThis
	private onChannelDisconnectRequested(payload: JsonValue | undefined) {
		if (!isJsonObject(payload)) return;
		const { id } = payload;
		if (typeof id !== 'string') return;
		this.disconnectChannel(id);
	}

	/**
	 * クライアントにメッセージ送信
	 */
	@bindThis
	public sendMessageToWs(type: string, payload: JsonObject) {
		if (this.disposed || this.wsConnection.readyState !== WebSocket.WebSocket.OPEN) return;
		const message = JSON.stringify({
			type: type,
			body: payload,
		});

		// 受信が追いつかないクライアントのために送信バッファを溜め続けないよう、閾値を超えたら切断して再接続させる
		if (this.wsConnection.bufferedAmount + Buffer.byteLength(message) > MAX_BUFFERED_AMOUNT_PER_CONNECTION) {
			this.wsConnection.terminate();
			return;
		}

		this.wsConnection.send(message);
	}

	/**
	 * チャンネルに接続
	 */
	@bindThis
	public async connectChannel(id: string, params: JsonObject | undefined, channel: string, pong = false) {
		if (this.disposed || this.wsConnection.readyState !== WebSocket.WebSocket.OPEN || this.channels.some(c => c.id === id) || this.channels.length >= MAX_CHANNELS_PER_CONNECTION) {
			return;
		}

		const channelService = this.channelsService.getChannelService(channel);

		if (channelService.requireCredential && this.user == null) {
			return;
		}

		if ((channelService.kind && !this.hasPermission(channelService.kind))
			|| (!channelService.kind && channelService.requireCredential && !this.hasPermission(null))) {
			return;
		}

		// 共有可能チャンネルに接続しようとしていて、かつそのチャンネルに既に接続していたら無意味なので無視
		if (channelService.shouldShare && this.channels.some(c => c.chName === channel)) {
			return;
		}

		const ch: Channel = channelService.create(id, this);
		this.channels.push(ch);
		let valid: void | boolean;
		try {
			valid = await ch.init(params ?? {});
		} catch (error) {
			this.disconnectChannel(id);
			throw error;
		}
		if (this.disposed || this.wsConnection.readyState !== WebSocket.WebSocket.OPEN || !this.channels.includes(ch)) {
			ch.dispose?.();
			this.channels = this.channels.filter(c => c !== ch);
			return;
		}
		if (typeof valid === 'boolean' && !valid) {
			// 初期化処理の結果、接続拒否されたので切断
			this.disconnectChannel(id);
			return;
		}

		if (pong) {
			this.sendMessageToWs('connected', {
				id: id,
			});
		}
	}

	public isChannelConnected(channel: Channel): boolean {
		return !this.disposed && this.channels.includes(channel);
	}

	/**
	 * チャンネルから切断
	 * @param id チャンネルコネクションID
	 */
	@bindThis
	public disconnectChannel(id: string) {
		const channel = this.channels.find(c => c.id === id);

		if (channel) {
			if (channel.dispose) channel.dispose();
			this.channels = this.channels.filter(c => c.id !== id);
		}
	}

	/**
	 * チャンネルへメッセージ送信要求時
	 * @param data メッセージ
	 */
	@bindThis
	private onChannelMessageRequested(data: JsonValue | undefined) {
		if (!isJsonObject(data)) return;
		if (typeof data.id !== 'string') return;
		if (typeof data.type !== 'string') return;
		if (typeof data.body === 'undefined') return;

		const channel = this.channels.find(c => c.id === data.id);
		if (channel != null && channel.onMessage != null) {
			channel.onMessage(data.type, data.body);
		}
	}

	/**
	 * ストリームが切れたとき
	 */
	@bindThis
	public dispose() {
		this.disposed = true;
		if (this.fetchIntervalId) clearInterval(this.fetchIntervalId);
		for (const c of this.channels.filter(c => c.dispose)) {
			if (c.dispose) c.dispose();
		}
		this.channels = [];
		for (const id of this.subscribingNotes.keys()) {
			this.subscriber.off(`noteStream:${id}`, this.onNoteStreamMessage);
		}
		this.subscribingNotes.clear();
	}
}
