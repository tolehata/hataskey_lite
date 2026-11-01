/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, shallowRef, watch } from 'vue';
import MkEmojiPickerDialog from '@/components/MkEmojiPickerDialog.vue';
import { popup } from '@/os.js';
import { prefer } from '@/preferences.js';

/**
 * 絵文字ピッカーを表示する。
 * 類似の機能として{@link ReactionPicker}が存在しているが、この機能とは動きが異なる。
 * 投稿フォームなどで絵文字を選択する時など、絵文字ピックアップ後でもダイアログが消えずに残り、
 * 一度表示したダイアログを連続で使用できることが望ましいシーンでの利用が想定される。
 */
class EmojiPicker {
	private emojisRef = ref<string[]>([]);

	constructor() {
		// nop
	}

	public init() {
		watch([prefer.r.emojiPaletteForMain, prefer.r.emojiPalettes], () => {
			this.emojisRef.value = prefer.s.emojiPaletteForMain == null ? prefer.s.emojiPalettes[0].emojis : prefer.s.emojiPalettes.find(palette => palette.id === prefer.s.emojiPaletteForMain)?.emojis ?? [];
		}, {
			immediate: true,
		});
	}

	public show(
		anchorElement: HTMLElement,
		onChosen?: (emoji: string) => void,
		onClosed?: () => void,
		launcher: typeof popup = popup,
	) {
		const anchorRef = shallowRef(anchorElement);

		// リアクションピッカーと同じく、iOS PWAのタップ中に同期的に開く。
		const { dispose } = launcher(MkEmojiPickerDialog, {
			anchorElement: anchorRef,
			pinnedEmojis: this.emojisRef,
			asReactionPicker: false,
			choseAndClose: false,
		}, {
			done: (emoji: string) => {
				onChosen?.(emoji);
			},
			closed: () => {
				onClosed?.();
				dispose();
			},
		});
	}
}

export const emojiPicker = new EmojiPicker();
