/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Xev from 'xev';
import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { isJsonObject } from '@/misc/json-value.js';
import type { JsonObject, JsonValue } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';
import { StatsLogRequests } from '../stats-log-requests.js';

const ev = new Xev();

class ServerStatsChannel extends Channel {
	private readonly logRequests = new StatsLogRequests(ev, 'serverStatsLog', 'requestServerStatsLog', log => this.send('statsLog', log));
	public readonly chName = 'serverStats';
	public static shouldShare = true;
	public static requireCredential = false as const;

	constructor(id: string, connection: Channel['connection']) {
		super(id, connection);
		//this.onStats = this.onStats.bind(this);
		//this.onMessage = this.onMessage.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		ev.addListener('serverStats', this.onStats);
	}

	@bindThis
	private onStats(stats: JsonObject) {
		this.send('stats', stats);
	}

	@bindThis
	public onMessage(type: string, body: JsonValue) {
		switch (type) {
			case 'requestLog':
				if (!isJsonObject(body)) return;
				if (typeof body.id !== 'string' && !(typeof body.id === 'number' && Number.isFinite(body.id))) return;
				this.logRequests.request(body.length);
				break;
		}
	}

	@bindThis
	public dispose() {
		this.logRequests.dispose();
		ev.removeListener('serverStats', this.onStats);
	}
}

@Injectable()
export class ServerStatsChannelService implements MiChannelService<false> {
	public readonly shouldShare = ServerStatsChannel.shouldShare;
	public readonly requireCredential = ServerStatsChannel.requireCredential;
	public readonly kind = ServerStatsChannel.kind;

	constructor(
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): ServerStatsChannel {
		return new ServerStatsChannel(
			id,
			connection,
		);
	}
}
