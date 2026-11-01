/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: CTL の絵文字パックと最近使った絵文字の、タブ内だけのキャッシュ。
// 端末へは保存しない（アカウント切替や連携解除で必ず捨てる）。

import { ref, watch } from 'vue';
import { concrntState } from './runtime.js';
import type { ConcrntEmoji, ConcrntEmojiPackage } from './types.js';

export const concrntRecentEmojis = ref<ConcrntEmoji[]>([]);

let packs: { revision: number; promise: Promise<ConcrntEmojiPackage[]> } | null = null;

export function rememberConcrntEmoji(emoji: ConcrntEmoji): void {
	concrntRecentEmojis.value = [emoji, ...concrntRecentEmojis.value.filter(item => item.imageUrl !== emoji.imageUrl || item.shortcode !== emoji.shortcode)].slice(0, 32);
}

/** One fetch per connection generation; a failure is not cached. */
export function loadConcrntEmojiPacks(fetcher: () => Promise<ConcrntEmojiPackage[]>): Promise<ConcrntEmojiPackage[]> {
	if (packs?.revision === concrntState.revision) return packs.promise;
	const entry = { revision: concrntState.revision, promise: fetcher() };
	packs = entry;
	entry.promise.catch(() => { if (packs === entry) packs = null; });
	return entry.promise;
}

watch(() => concrntState.revision, () => { packs = null; concrntRecentEmojis.value = []; });
