<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed デザイン改修 §2.4 / §3): アバター表示。
  既存アバター画像があれば MkAvatar(実画像)を優先し、無い時のみ頭文字 + ユーザー毎の淡色。
  stack 指定で重ね表示(margin-left:-7px + 2px 同色ボーダー)に対応。
-->
<template>
<span
	:class="[$style.root, { [$style.stack]: stack }]"
	:style="{ width: px, height: px }"
	:title="user ? (user.name ?? user.username ?? undefined) : undefined"
>
	<MkAvatar v-if="user && user.avatarUrl" :class="$style.img" :user="(user as Misskey.entities.User)" :link="link" :preview="preview"/>
	<span v-else :class="$style.initial" :style="{ background: color, fontSize: initialSize }">{{ initial }}</span>
</span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { hfAvatarColor, hfInitial } from '@/utility/hatafeed.js';
// MkAvatar / MkUserName 等は components/global/ のグローバル登録コンポーネントのため import 不要
// (現行 hatafeed.vue と同じ流儀)。
// 旗鯖fork(G9): components/index.ts の GlobalComponents 拡張修正でMkAvatarのuser propが
//   厳密チェックされるようになったため、この partial user 形状をキャストで橋渡し(挙動は変えない)。

const props = withDefaults(defineProps<{
	user?: { id?: string; name?: string | null; username?: string | null; avatarUrl?: string | null } | null;
	size?: number;
	stack?: boolean;
	link?: boolean;
	preview?: boolean;
}>(), {
	size: 28,
	stack: false,
	link: false,
	preview: false,
});

const px = computed(() => `${props.size}px`);
const initialSize = computed(() => `${Math.round(props.size * 0.42)}px`);
const initial = computed(() => hfInitial(props.user));
const color = computed(() => hfAvatarColor(props.user?.id ?? props.user?.username ?? props.user?.name));
</script>

<style lang="scss" module>
.root {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 50%;
	overflow: hidden;
	vertical-align: middle;
}
.stack {
	margin-left: -7px;
	box-shadow: 0 0 0 2px var(--MI_THEME-panel);

	&:first-child { margin-left: 0; }
}
.img {
	width: 100%;
	height: 100%;
}
.initial {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	font-weight: 700;
	color: rgba(0, 0, 0, .55);
	line-height: 1;
}
</style>
