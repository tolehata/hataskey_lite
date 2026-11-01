/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import type { RolesRepository } from '@/models/_.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

class RoleTimelineChannel extends Channel {
	public readonly chName = 'roleTimeline';
	public static shouldShare = false;
	public static requireCredential = false as const;
	private roleId: string;

	constructor(
		private noteEntityService: NoteEntityService,
		private rolesRepository: RolesRepository,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		if (typeof params.roleId !== 'string') return false;
		this.roleId = params.roleId;
		if (!await this.isAvailable()) return false;

		this.subscriber.on(`roleTimelineStream:${this.roleId}`, this.onEvent);
		return true;
	}

	private async isAvailable(): Promise<boolean> {
		return await this.rolesRepository.exists({ where: { id: this.roleId, isPublic: true, isExplorable: true } });
	}

	@bindThis
	private async onEvent(data: GlobalEvents['roleTimeline']['payload']) {
		if (!await this.isAvailable()) return;
		if (data.type === 'note') {
			const note = data.body;

			if (note.visibility !== 'public') return;

			if (this.isNoteMutedOrBlocked(note)) return;

			await this.sendNote(note);
		} else {
			this.send(data.type, data.body);
		}
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off(`roleTimelineStream:${this.roleId}`, this.onEvent);
	}
}

@Injectable()
export class RoleTimelineChannelService implements MiChannelService<false> {
	public readonly shouldShare = RoleTimelineChannel.shouldShare;
	public readonly requireCredential = RoleTimelineChannel.requireCredential;
	public readonly kind = RoleTimelineChannel.kind;

	constructor(
		private noteEntityService: NoteEntityService,
		@Inject(DI.rolesRepository)
		private rolesRepository: RolesRepository,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): RoleTimelineChannel {
		return new RoleTimelineChannel(
			this.noteEntityService,
			this.rolesRepository,
			id,
			connection,
		);
	}
}
