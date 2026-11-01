<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hatask専用。OSネイティブ絵文字へフォールバックせず、同梱画像だけで描画する。
-->
<template>
<img
	v-if="!allSourcesFailed"
	:class="$style.root"
	:src="currentSource"
	alt=""
	aria-hidden="true"
	decoding="async"
	@error="advanceSource"
>
<i v-else class="ti ti-icons-off" :class="$style.root" aria-hidden="true"></i>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { prefer } from '@/preferences.js';
import { hataskEmojiSources } from '@/utility/hatask-emoji.js';

const props = defineProps<{
	emoji: string;
}>();

const sourceIndex = ref(0);
const sources = computed(() => hataskEmojiSources(props.emoji, prefer.r.emojiStyle.value));
const allSourcesFailed = computed(() => sourceIndex.value >= sources.value.length);
const currentSource = computed(() => sources.value[Math.min(sourceIndex.value, sources.value.length - 1)]);

watch(sources, () => {
	sourceIndex.value = 0;
});

function advanceSource(): void {
	sourceIndex.value += 1;
}
</script>

<style lang="scss" module>
.root {
	display: inline-block;
	width: 1em;
	height: 1em;
	object-fit: contain;
	vertical-align: -0.12em;
}
</style>
