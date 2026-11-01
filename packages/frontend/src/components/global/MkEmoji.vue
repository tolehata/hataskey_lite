<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<img v-if="shouldMute" :class="$style.root" src="/client-assets/unknown.png" :alt="props.emoji" decoding="async" @pointerenter="computeTitle" @click.stop="onClick"/>
<!-- 旗鯖fork: twemoji/fluent-emoji の SVG/PNG が同梱されていない絵文字 (例: 新しい Unicode の
     1f985 / 1f359 / 1f979 等) は 404 し、壊れた画像アイコンが表示されてしまう。img の読み込み
     失敗時 (@error) は native (システムフォント) 絵文字描画にフォールバックする。 -->
<img v-else-if="!useOsNativeEmojis && !imgLoadError" :class="$style.root" :src="url" :alt="props.emoji" decoding="async" @error="imgLoadError = true" @pointerenter="computeTitle" @click.stop="onClick"/>
<span v-else :alt="props.emoji" @pointerenter="computeTitle" @click.stop="onClick">{{ colorizedNativeEmoji }}</span>
</template>

<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue';
import { colorizeEmoji, getEmojiName } from '@@/js/emojilist.js';
import { char2fluentEmojiFilePath, char2twemojiFilePath } from '@@/js/emoji-base.js';
import type { MenuItem } from '@/types/menu.js';
import * as os from '@/os.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { DI } from '@/di.js';
import { mute as muteEmoji, unmute as unmuteEmoji, checkMuted as checkMutedEmoji } from '@/utility/emoji-mute.js';
// 旗鯖fork: 本家 2026.6.0 から取り込み: 絵文字メニューから直接パレット追加
import { addToEmojiPalette } from '@/utility/emoji-palette.js';

const props = defineProps<{
	emoji: string;
	menu?: boolean;
	menuReaction?: boolean;
	ignoreMuted?: boolean;
}>();

const react = inject(DI.mfmEmojiReactCallback, null);

// 旗鯖fork: char2path をリアクティブに (prefer.r.emojiStyle を購読する computed)。
//   旧実装は `prefer.s.emojiStyle` を setup 時に一度だけ評価していたため、以下の症状が出ていた:
//   - 起動時点の値 (2026.6.0 マージ以降は fluentEmoji が最初に入っている端末があった) で
//     char2path が Fluent 用に固定されてしまい、
//   - ユーザーが設定で Twemoji に切り替えても char2path は再評価されず Fluent URL のまま
//   - 結果「設定は Twemoji なのに Fluent Emoji が表示される」不整合が発生していた。
const char2path = computed(() => prefer.r.emojiStyle.value === 'twemoji' ? char2twemojiFilePath : char2fluentEmojiFilePath);

const useOsNativeEmojis = computed(() => prefer.r.emojiStyle.value === 'native');
const url = computed(() => char2path.value(props.emoji));
// 旗鯖fork: 画像 (twemoji/fluent) の読み込みに失敗したら native 描画にフォールバックするためのフラグ。
// props.emoji が変わったら再評価するためリセットする (リスト再利用時の取り違え防止)。
const imgLoadError = ref(false);
watch(() => props.emoji, () => { imgLoadError.value = false; });
const colorizedNativeEmoji = computed(() => colorizeEmoji(props.emoji));
const isMuted = checkMutedEmoji(props.emoji);
const shouldMute = computed(() => isMuted.value && !props.ignoreMuted);

// Searching from an array with 2000 items for every emoji felt like too energy-consuming, so I decided to do it lazily on pointerenter
function computeTitle(event: PointerEvent): void {
	(event.target as HTMLElement).title = getEmojiName(props.emoji);
}

function mute() {
	os.confirm({
		type: 'question',
		title: i18n.tsx.muteX({ x: props.emoji }),
	}).then(({ canceled }) => {
		if (canceled) {
			return;
		}
		muteEmoji(props.emoji);
	});
}

function unmute() {
	os.confirm({
		type: 'question',
		title: i18n.tsx.unmuteX({ x: props.emoji }),
	}).then(({ canceled }) => {
		if (canceled) {
			return;
		}
		unmuteEmoji(props.emoji);
	});
}

function onClick(ev: MouseEvent) {
	if (props.menu) {
		const menuItems: MenuItem[] = [];

		menuItems.push({
			type: 'label',
			text: props.emoji,
		}, {
			text: i18n.ts.copy,
			icon: 'ti ti-copy',
			action: () => {
				copyToClipboard(props.emoji);
			},
		});

		if (props.menuReaction && react) {
			menuItems.push({
				text: i18n.ts.doReaction,
				icon: 'ti ti-mood-plus',
				action: () => {
					react(props.emoji);
				},
			});
		}

		menuItems.push({
			type: 'divider',
		}, isMuted.value ? {
			text: i18n.ts.emojiUnmute,
			icon: 'ti ti-mood-smile',
			action: () => {
				unmute();
			},
		} : {
			text: i18n.ts.emojiMute,
			icon: 'ti ti-mood-off',
			action: () => {
				mute();
			},
		});

		menuItems.push({
			text: i18n.ts.addToEmojiPalette,
			icon: 'ti ti-palette',
			action: () => {
				addToEmojiPalette(props.emoji);
			},
		});

		os.popupMenu(menuItems, ev.currentTarget ?? ev.target);
	}
}
</script>

<style lang="scss" module>
.root {
	height: 1.1em;
	vertical-align: -0.235em;
}
</style>
