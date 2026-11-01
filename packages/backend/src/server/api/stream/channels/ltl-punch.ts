/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { LtlPunchService } from '@/core/LtlPunchService.js';
import { validLtlPunchId, type LtlPunchState } from '@/misc/ltl-punch.js';
import type { JsonObject, JsonValue } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

export class LtlPunchChannel extends Channel {
	public readonly chName = 'ltlPunch';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'write:notes';
	private disposed = false;
	private allowed = false;
	private lastSync = 0;
	private lastAttack = 0;
	private lastState: LtlPunchState | null = null;

	constructor(private roleService: RoleService, private punchService: LtlPunchService, id: string, connection: Channel['connection']) {
		super(id, connection);
	}

	@bindThis
	public async init(_params: JsonObject): Promise<boolean> {
		if (!this.user || this.user.host !== null || this.user.isSuspended) return false;
		const policies = await this.roleService.getUserPolicies(this.user.id);
		if (this.disposed || !policies.ltlAvailable) return false;
		this.allowed = true;
		this.subscriber.on('ltlPunchStream', this.onState);
		try { this.deliver(await this.punchService.sync(this.user.id)); } catch { /* A later sync retries. */ }
		return !this.disposed;
	}

	private deliver(state: LtlPunchState | null): void {
		if (this.disposed) return;
		if (state === null && this.lastState !== null) return;
		if (state && this.lastState) {
			if (state.startedAt < this.lastState.startedAt || (state.id === this.lastState.id && state.revision < this.lastState.revision)) return;
		}
		this.lastState = state;
		this.send('state', state);
	}

	@bindThis
	private onState(event: { type: 'state'; body: LtlPunchState | null }): void {
		this.deliver(event.body);
	}

	@bindThis
	public onMessage(type: string, body: JsonValue): void {
		if (!this.allowed || this.disposed || !this.user || typeof body !== 'object' || body === null || Array.isArray(body)) return;
		const now = Date.now();
		if (type === 'sync') {
			if (now - this.lastSync < 1000) return;
			this.lastSync = now;
			void this.punchService.sync(this.user.id).then(state => this.deliver(state)).catch(() => {});
		} else if (type === 'attack') {
			if (!validLtlPunchId(body.eventId) || !validLtlPunchId(body.requestId) || now - this.lastAttack < 50) return;
			this.lastAttack = now;
			void this.punchService.attack(this.user.id, body.eventId, body.requestId).then(state => this.deliver(state)).catch(() => {});
		}
	}

	@bindThis
	public dispose(): void {
		this.disposed = true;
		this.allowed = false;
		this.subscriber.off('ltlPunchStream', this.onState);
		// Presence expires naturally: disconnecting one tab must not remove another tab.
	}
}

@Injectable()
export class LtlPunchChannelService implements MiChannelService<true> {
	public readonly shouldShare = LtlPunchChannel.shouldShare;
	public readonly requireCredential = LtlPunchChannel.requireCredential;
	public readonly kind = LtlPunchChannel.kind;
	constructor(private roleService: RoleService, private punchService: LtlPunchService) {}
	public create(id: string, connection: Channel['connection']): LtlPunchChannel {
		return new LtlPunchChannel(this.roleService, this.punchService, id, connection);
	}
}
