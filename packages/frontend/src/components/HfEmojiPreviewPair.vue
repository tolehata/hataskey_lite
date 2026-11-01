<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(HataFeed デザイン改修 §3): 絵文字プレビュー(白背景 + 黒背景の2枚並置)。
  ライト/ダーク両テーマでの視認性を同時に確認するためのペア。2f/2g/3d で共用。
  url 未指定(まだ画像を選んでいない)ときはプレースホルダを出す。
-->
<template>
<div :class="$style.root">
	<div :class="[$style.pane, $style.light]">
		<img v-if="url" :src="url" :alt="alt" :class="$style.img" :style="imgStyle"/>
		<i v-else class="ti ti-photo" :class="$style.ph"></i>
	</div>
	<div :class="[$style.pane, $style.dark]">
		<img v-if="url" :src="url" :alt="alt" :class="$style.img" :style="imgStyle"/>
		<i v-else class="ti ti-photo" :class="[$style.ph, $style.phDark]"></i>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(defineProps<{
	url?: string | null;
	alt?: string;
	size?: number;
}>(), {
	url: null,
	alt: '',
	size: 48,
});

const imgStyle = computed(() => ({ maxWidth: `${props.size}px`, maxHeight: `${props.size}px` }));
</script>

<style lang="scss" module>
.root {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}
.pane {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 72px;
	padding: 10px;
	border-radius: 12px;
	border: 1px solid var(--MI_THEME-divider);
}
.light { background: #ffffff; }
.dark { background: #1b1b1f; }
.img {
	object-fit: contain;
	image-rendering: auto;
}
.ph {
	font-size: 1.6rem;
	color: rgba(0, 0, 0, .25);
}
.phDark { color: rgba(255, 255, 255, .3); }
</style>
