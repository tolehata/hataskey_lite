/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { char2fluentEmojiFilePath, char2twemojiFilePath } from '@@/js/emoji-base.js';

export type HataskEmojiStyle = 'twemoji' | 'fluentEmoji' | 'native';

/**
 * HataskではApple Color EmojiなどのOSネイティブ絵文字へ戻さない。
 * 利用者の画像スタイルを優先し、欠損時はもう一方の同梱画像へ切り替える。
 */
export function hataskEmojiSources(emoji: string, style: HataskEmojiStyle | string): string[] {
	const twemoji = char2twemojiFilePath(emoji);
	const fluent = char2fluentEmojiFilePath(emoji);
	const preferred = style === 'fluentEmoji' ? fluent : twemoji;
	return [...new Set([preferred, twemoji, fluent, '/client-assets/unknown.png'])];
}
