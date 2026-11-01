/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { entities } from 'cherrypick-js';
import { checkWordMute } from '@/utility/check-word-mute.js';

/** Place the event beside its visible trigger, without bypassing the note's local display filters. */
export function getLtlEmojiVoteAnchor(
	notes: entities.Note[],
	noteId: string | undefined,
	me: entities.UserLite | null | undefined,
	options: { mutedWords: Array<string | string[]>; withSensitive: boolean },
): string | null {
	const note = notes.find(item => item.id === noteId);
	if (!note || note.isHidden || note.user.host != null || note.visibility !== 'public' || note.channelId != null) return null;
	if (note.text?.trim() !== '絵文字を選ぶぞ') return null;
	for (const target of [note, note.reply, note.renote]) {
		if (!target) continue;
		if (target.isHidden || checkWordMute(target, me, options.mutedWords)) return null;
		if (!options.withSensitive && target.files?.some(file => file.isSensitive)) return null;
	}
	return note.id;
}
