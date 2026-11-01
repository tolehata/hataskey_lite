/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';
import { ref, shallowRef, watch } from 'vue';
import MkEmojiPickerDialog from '@/components/MkEmojiPickerDialog.vue';
import { popup } from '@/os.js';
import { prefer } from '@/preferences.js';

class ReactionPicker {
	private reactionsRef = ref<string[]>([]);

	constructor() {
		// nop
	}

	public init() {
		watch([prefer.r.emojiPaletteForReaction, prefer.r.emojiPalettes], () => {
			this.reactionsRef.value = prefer.s.emojiPaletteForReaction == null ? prefer.s.emojiPalettes[0].emojis : prefer.s.emojiPalettes.find(palette => palette.id === prefer.s.emojiPaletteForReaction)?.emojis ?? [];
		}, {
			immediate: true,
		});
	}

	public show(
		anchorElement: HTMLElement | null,
		targetNote: Misskey.entities.Note | null,
		onChosen?: (reaction: string) => void,
		onClosed?: () => void,
		launcher: typeof popup = popup,
	) {
		const anchorRef = shallowRef(anchorElement);
		const targetNoteRef = ref(targetNote);

		// iOS PWAではdefineAsyncComponentをタップ後に解決すると、ユーザー
		// アクティベーションやfocusが失われ、ピッカーが開かない場合がある。
		// 静的に読み込んだコンポーネントを、このクリック処理内で同期的に開く。
		const { dispose } = launcher(MkEmojiPickerDialog, {
			anchorElement: anchorRef,
			pinnedEmojis: this.reactionsRef,
			asReactionPicker: true,
			targetNote: targetNoteRef,
		}, {
			done: (reaction: string) => {
				onChosen?.(reaction);
			},
			closed: () => {
				onClosed?.();
				dispose();
			},
		});
	}
}

export const reactionPicker = new ReactionPicker();
