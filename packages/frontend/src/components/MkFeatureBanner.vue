<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-panel :class="[$style.root, { [$style.redesigned]: isSettingsRedesign }]">
	<img :class="$style.img" :src="icon"/>
	<div :class="$style.text">
		<slot></slot>
	</div>
</div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

withDefaults(defineProps<{
	icon: string;
	color: string;
}>(), {
});

const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;
</script>

<style module lang="scss">
.root {
	padding: 20px 24px;
	text-align: center;
	border-radius: var(--MI-radius);
	background: linear-gradient(180deg, color(from v-bind(color) srgb r g b / 0.1), color(from v-bind(color) srgb r g b / 0));
}

.root.redesigned {
	padding: 20px 22px;
	background: linear-gradient(180deg, color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent), var(--MI_THEME-panel) 76%);
	border: solid 0.5px color-mix(in srgb, var(--MI_THEME-divider) 90%, transparent);
	border-radius: 22px;
	box-shadow: 0 2px 10px color-mix(in srgb, var(--MI_THEME-fg) 5%, transparent);
	line-break: strict;
	word-break: normal;
	text-wrap: pretty;
}

.img {
	display: block;
	margin: 0 auto;
	/* Hataskey fork: 絵文字1個と違い立ち絵は40pxだと絵柄が潰れるため拡大する。 */
	width: 64px;
	aspect-ratio: 1;
}

.text {
	margin-top: 12px;
	font-size: 85%;
	mix-blend-mode: luminosity;
}

.root.redesigned .text {
	mix-blend-mode: normal;
	line-height: 1.7;
}
</style>
