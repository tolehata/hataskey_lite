/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ClipsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

// 旗鯖fork: 上流 2026.10.1 のクリップのチャンネルを、このフォークのチャンネルの作り(クラス + ChannelService)に合わせた。
class ClipChannel extends Channel {
	public readonly chName = 'clip';
	public static shouldShare = false;
	public static requireCredential = false as const;
	private clipId: string;

	constructor(
		private clipsRepository: ClipsRepository,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
	}

	@bindThis
	public async init(params: JsonObject): Promise<boolean> {
		if (typeof params.clipId !== 'string') return false;
		this.clipId = params.clipId;

		const clip = await this.clipsRepository.findOneBy({ id: this.clipId });
		if (clip == null) return false;
		if (!clip.isPublic && (this.user == null || clip.userId !== this.user.id)) return false;

		// Subscribe stream
		this.subscriber.on(`clipStream:${this.clipId}`, this.onEvent);

		return true;
	}

	@bindThis
	private onEvent(data: GlobalEvents['clip']['payload']) {
		if (data.type === 'updated' || data.type === 'deleted') {
			this.send(data.type, null);
		}
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off(`clipStream:${this.clipId}`, this.onEvent);
	}
}

@Injectable()
export class ClipChannelService implements MiChannelService<false> {
	public readonly shouldShare = ClipChannel.shouldShare;
	public readonly requireCredential = ClipChannel.requireCredential;
	public readonly kind = ClipChannel.kind;

	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): ClipChannel {
		return new ClipChannel(
			this.clipsRepository,
			id,
			connection,
		);
	}
}
