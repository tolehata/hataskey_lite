<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span :class="$style.wordmark" :data-app="app" :data-monochrome="monochrome" :data-on-dark="onDark" :data-inherit-color="inheritColor">
	<span>{{ parts.head }}</span><span :class="$style.tail">{{ parts.tail }}</span>
</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { hataAppNames } from '@/utility/hata-app-brand.js';
import type { HataApp } from '@/utility/hata-app-brand.js';

const props = withDefaults(defineProps<{ app: HataApp; monochrome?: boolean; onDark?: boolean; inheritColor?: boolean }>(), {
	monochrome: false,
	onDark: false,
	inheritColor: false,
});
const parts = computed(() => hataAppNames[props.app]);
</script>

<style lang="scss" module>
@font-face {
	font-family: 'HataAppRighteous';
	font-style: normal;
	font-weight: 400;
	font-display: swap;
	src: url('/client-assets/Righteous-Regular.woff2') format('woff2');
}
.wordmark {
	display: inline-flex;
	white-space: nowrap;
	font: 400 1em/1 'HataAppRighteous', Righteous, system-ui, sans-serif;
	font-synthesis: none;
	color: #2b1f2c;
}
.tail { color: #c23a62; }
.wordmark[data-app='hataigo'] .tail { color: #6b4fb8; }
.wordmark[data-app='hatask'] .tail { color: #8a6200; }
.wordmark[data-app='hatady'] .tail { color: #1d7457; }
.wordmark[data-app='hatafeed'] .tail { color: #2c64a0; }
.wordmark[data-monochrome='true'] .tail { color: inherit; }
.wordmark[data-on-dark='true'] { color: #ffffff; }
.wordmark[data-on-dark='true'] .tail { color: inherit; }
.wordmark[data-inherit-color='true'], .wordmark[data-inherit-color='true'] .tail { color: inherit; }
</style>
