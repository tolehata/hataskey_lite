/* SPDX-License-Identifier: AGPL-3.0-only */
import type * as Misskey from 'cherrypick-js';
import { emojiPicker } from '@/utility/emoji-picker.js';
import { reactionPicker } from '@/utility/reaction-picker.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';

/** Picker components stay synchronously available during the tap on iOS. */
export function useHataGoesEmojiPickers() {
	const popup = useHataGoesPopup();
	return {
		showReactionPicker(anchor: HTMLElement | null, note: Misskey.entities.Note | null, onChosen?: (reaction: string) => void, onClosed?: () => void) {
			reactionPicker.show(anchor, note, onChosen, onClosed, popup);
		},
		showEmojiPicker(anchor: HTMLElement, onChosen?: (emoji: string) => void, onClosed?: () => void) {
			emojiPicker.show(anchor, onChosen, onClosed, popup);
		},
	};
}
