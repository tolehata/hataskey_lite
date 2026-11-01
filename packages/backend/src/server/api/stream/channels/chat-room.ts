/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import promiseLimit from 'promise-limit';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import { ChatService } from '@/core/ChatService.js';
import type { ChatRoomsRepository } from '@/models/_.js';
import Channel, { type MiChannelService } from '../channel.js';

class ChatRoomChannel extends Channel {
	public readonly chName = 'chatRoom';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'read:chat';
	private roomId: string;
	private eventQueue = promiseLimit<void>(1);

	constructor(
		private chatService: ChatService,
		private chatRoomsRepository: ChatRoomsRepository,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
	}

	@bindThis
	public async init(params: JsonObject): Promise<boolean> {
		if (typeof params.roomId !== 'string') return false;
		if (!this.user) return false;

		this.roomId = params.roomId;

		if (!await this.hasAccess()) return false;

		this.subscriber.on(`chatRoomStream:${this.roomId}`, this.onEvent);

		return true;
	}

	@bindThis
	private onEvent(data: GlobalEvents['chatRoom']['payload']) {
		return this.eventQueue(async () => {
			if (!await this.checkAccess()) return;
			this.send(data.type, data.body);
		}).catch(error => console.error('Chat room stream authorization failed', error));
	}

	private async hasAccess(): Promise<boolean> {
		if (!this.user || !this.roomId) return false;
		const room = await this.chatRoomsRepository.findOneBy({ id: this.roomId });
		return room != null && await this.chatService.isRoomMember(room, this.user.id);
	}

	private async checkAccess(): Promise<boolean> {
		if (!this.connection.isChannelConnected(this)) return false;
		if (!await this.hasAccess()) {
			this.connection.disconnectChannel(this.id);
			return false;
		}
		return this.connection.isChannelConnected(this);
	}

	@bindThis
	public onMessage(type: string, body: any) {
		if (type !== 'read') return;
		return this.eventQueue(async () => {
			if (!await this.checkAccess()) return;
			await this.chatService.readRoomChatMessage(this.user!.id, this.roomId);
		}).catch(error => console.error('Chat room stream read failed', error));
	}

	@bindThis
	public dispose() {
		this.subscriber.off(`chatRoomStream:${this.roomId}`, this.onEvent);
	}
}

@Injectable()
export class ChatRoomChannelService implements MiChannelService<true> {
	public readonly shouldShare = ChatRoomChannel.shouldShare;
	public readonly requireCredential = ChatRoomChannel.requireCredential;
	public readonly kind = ChatRoomChannel.kind;

	constructor(
		@Inject(DI.chatRoomsRepository)
		private chatRoomsRepository: ChatRoomsRepository,

		private chatService: ChatService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): ChatRoomChannel {
		return new ChatRoomChannel(
			this.chatService,
			this.chatRoomsRepository,
			id,
			connection,
		);
	}
}
