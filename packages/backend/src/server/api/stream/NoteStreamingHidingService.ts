/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { deepClone } from '@/misc/clone.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { Packed } from '@/misc/json-schema.js';
import type { MiUser } from '@/models/User.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import type { MiMeta } from '@/models/_.js';

/** Streamにおいて、ノートを隠す（hideNote）を適用するためのService */
@Injectable()
export class NoteStreamingHidingService {
	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,

		private noteEntityService: NoteEntityService,
	) {}

	@bindThis
	public async canReceiveUpdates(note: GlobalEvents['note']['payload']['body'], meId: MiUser['id'] | null): Promise<boolean> {
		// Deleted roots cannot restore missing references from the DB. Reject incomplete snapshots.
		if (note.userHost === undefined || note.channelId === undefined || note.replyId === undefined || note.renoteId === undefined) return false;
		return await this.noteEntityService.isVisibleForMe(note, meId);
	}

	private collectRenoteChain(note: Packed<'Note'>): Packed<'Note'>[] {
		const renoteChain: Packed<'Note'>[] = [];

		for (let current: Packed<'Note'> | null | undefined = note; current != null; current = current.renote) {
			renoteChain.push(current);
			// A quote has its own content. Its hidden source must not suppress a
			// renote of that otherwise visible quote.
			if (!isRenotePacked(current) || isQuotePacked(current)) break;
		}

		return renoteChain;
	}

	/**
	 * ストリーミング配信用にノートの内容を隠す（あるいはそもそも送信しない）判定及び処理を行う。
	 *
	 * 隠す処理が必要な場合は元のノートをクローンして変更を適用したものを返し、
	 * 送信すべきでない場合は `null` を返す。
	 * 変更が不要な場合は元のノートの参照をそのまま返す。
	 *
	 * @param note - 処理対象のノート
	 * @param meId - 閲覧者のユーザー ID （未ログインの場合は `null`）
	 * @returns 配信するノートオブジェクト、または配信スキップの場合は `null`
	 */
	@bindThis
	public async filter(note: Packed<'Note'>, meId: MiUser['id'] | null): Promise<Packed<'Note'> | null> {
		if (meId == null) {
			if (this.meta.ugcVisibilityForVisitor === 'none') return null;
			if (this.meta.ugcVisibilityForVisitor === 'local' && note.user.host != null) return null;
		}
		if (!await this.noteEntityService.isChannelVisibleForMe(note, meId)) return null;

		// The fork packs detailed replies recursively as well as renotes. Inspect every
		// attached note, not only the root renote chain and its immediate replies.
		const notes: Packed<'Note'>[] = [];
		const pending = [note];
		while (pending.length > 0) {
			const current = pending.pop()!;
			notes.push(current);
			if (current.reply) pending.push(current.reply);
			if (current.renote) pending.push(current.renote);
		}
		const decisions = await Promise.all(notes.map(n => this.noteEntityService.shouldHideNote(n, meId, { channelVisibilityChecked: true })));
		if (!decisions.some(Boolean)) return note;
		const shouldHide = new Map(notes.map((n, i) => [n, decisions[i]]));

		const renoteChain = this.collectRenoteChain(note);
		if (renoteChain.some(n => shouldHide.get(n)) && renoteChain.some(n => isRenotePacked(n) && !isQuotePacked(n))) {
			// A hidden reply alone must not suppress an otherwise visible pure renote.
			return null;
		}

		const clonedNote = deepClone(note);
		const clonedPairs = [{ original: note, cloned: clonedNote }];
		while (clonedPairs.length > 0) {
			const { original, cloned } = clonedPairs.pop()!;
			if (shouldHide.get(original)) this.noteEntityService.hideNote(cloned);
			if (original.reply && cloned.reply) clonedPairs.push({ original: original.reply, cloned: cloned.reply });
			if (original.renote && cloned.renote) clonedPairs.push({ original: original.renote, cloned: cloned.renote });
		}

		return clonedNote;
	}
}
