/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { normalizeTag } from '@/misc/normalize-tag.js';
import type { Packed } from '@/misc/json-schema.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

class HashtagChannel extends Channel {
	public readonly chName = 'hashtag';
	public static shouldShare = false;
	public static requireCredential = false as const;
	private q: string[][];

	constructor(
		private noteEntityService: NoteEntityService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		if (!Array.isArray(params.q)) return;
		// 上流 2026.10.1 のセキュリティ修正: 空のタグ組・長すぎるタグを拒否し、照合前に正規化する。
		if (!params.q.every((x): x is string[] => (
			Array.isArray(x) &&
			x.length >= 1 &&
			x.every(y => typeof y === 'string' && Array.from(y).length <= 128)
		))) return;
		this.q = params.q.map(tags => tags.map(tag => normalizeTag(tag)));

		// Subscribe stream
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		const noteTags = note.tags ? note.tags.map((t: string) => t.toLowerCase()) : [];
		const matched = this.q.some(tags => tags.every(tag => noteTags.includes(tag)));
		if (!matched) return;

		if (this.isNoteMutedOrBlocked(note)) return;

		let noteToSend = note;
		if (this.user && isRenotePacked(note) && !isQuotePacked(note)) {
			if (note.renote) {
				const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
				// The stream event is shared by other viewers until asynchronous delivery.
				noteToSend = { ...note, renote: { ...note.renote, myReaction: myRenoteReaction } };
			}
		}

		await this.sendNote(noteToSend);
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class HashtagChannelService implements MiChannelService<false> {
	public readonly shouldShare = HashtagChannel.shouldShare;
	public readonly requireCredential = HashtagChannel.requireCredential;
	public readonly kind = HashtagChannel.kind;

	constructor(
		private noteEntityService: NoteEntityService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): HashtagChannel {
		return new HashtagChannel(
			this.noteEntityService,
			id,
			connection,
		);
	}
}
