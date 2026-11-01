/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import type { AntennasRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { Inject } from '@nestjs/common';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import type { Packed } from '@/misc/json-schema.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

class AntennaChannel extends Channel {
	public readonly chName = 'antenna';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'read:account';
	private antennaId: string;

	constructor(
		private noteEntityService: NoteEntityService,
		private antennasRepository: AntennasRepository,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onEvent = this.onEvent.bind(this);
	}

	@bindThis
	public async init(params: JsonObject): Promise<boolean> {
		if (typeof params.antennaId !== 'string') return false;
		if (!this.user) return false;

		this.antennaId = params.antennaId;

		const antennaExists = await this.antennasRepository.exists({
			where: {
				id: this.antennaId,
				userId: this.user.id,
			},
		});

		if (!antennaExists) return false;

		// Subscribe stream
		this.subscriber.on(`antennaStream:${this.antennaId}`, this.onEvent);

		return true;
	}

	@bindThis
	private async onEvent(data: GlobalEvents['antenna']['payload']) {
		if (data.type === 'note') {
			const user = this.user;
			if (!user) return;

			let note: Packed<'Note'>;
			try {
				note = await this.noteEntityService.pack(data.body.id, user, { detail: true });
			} catch (error) {
				if (error instanceof PrivateChannelNoteVisibilityError || error instanceof EntityNotFoundError) return;
				throw error;
			}

			if (this.isNoteMutedOrBlocked(note)) return;

			await this.sendNote(note, async () => {
				// Recheck after packing, queueing, and visibility checks have completed.
				// Other authors' replies/renotes/quotes need no lookup.
				if (note.userId !== user.id) return true;
				const antenna = await this.antennasRepository.findOneBy({ id: this.antennaId, userId: user.id });
				return antenna != null && !antenna.excludeOwnNotes;
			});
		} else {
			this.send(data.type, data.body);
		}
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off(`antennaStream:${this.antennaId}`, this.onEvent);
	}
}

@Injectable()
export class AntennaChannelService implements MiChannelService<true> {
	public readonly shouldShare = AntennaChannel.shouldShare;
	public readonly requireCredential = AntennaChannel.requireCredential;
	public readonly kind = AntennaChannel.kind;

	constructor(
		@Inject(DI.antennasRepository)
		private antennasRepository: AntennasRepository,

		private noteEntityService: NoteEntityService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): AntennaChannel {
		return new AntennaChannel(
			this.noteEntityService,
			this.antennasRepository,
			id,
			connection,
		);
	}
}
