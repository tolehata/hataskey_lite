/*
	* SPDX-FileCopyrightText: Tolehata and hatasaba-project
	* SPDX-License-Identifier: AGPL-3.0-only
	*/

import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

export class HataigoChannel extends Channel {
	public readonly chName = 'hataigo';
	public static shouldShare = true;
	public static requireCredential = true as const;
	public static kind = 'read:account';
	@bindThis public async init(_params: JsonObject): Promise<boolean> {
		if (!this.user || !this.connection.hasPermission('read:account')) return false;
		this.subscriber.on(`hataigoStream:${this.user.id}`, this.send);
		return true;
	}
	@bindThis public dispose(): void {
		if (this.user) this.subscriber.off(`hataigoStream:${this.user.id}`, this.send);
	}
}

@Injectable()
export class HataigoChannelService implements MiChannelService<true> {
	public readonly shouldShare = HataigoChannel.shouldShare;
	public readonly requireCredential = HataigoChannel.requireCredential;
	public readonly kind = HataigoChannel.kind;
	@bindThis public create(id: string, connection: Channel['connection']): HataigoChannel { return new HataigoChannel(id, connection); }
}
