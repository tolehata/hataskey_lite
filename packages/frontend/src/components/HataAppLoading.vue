<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span :class="$style.loading" :role="loading ? 'status' : undefined" :aria-label="loading ? label : undefined">
	<HataAppLogo :app="app" :size="size" :monochrome="monochrome" :active="active" :motion="loading ? 'loading' : 'idle'"/>
</span>
</template>

<script setup lang="ts">
import HataAppLogo from '@/components/HataAppLogo.vue';
import type { HataApp } from '@/utility/hata-app-brand.js';

withDefaults(defineProps<{
	app: HataApp;
	size?: number;
	monochrome?: boolean;
	active?: boolean;
	loading?: boolean;
	label?: string;
}>(), {
	size: 48,
	monochrome: false,
	active: true,
	loading: true,
	label: '読み込み中',
});
</script>

<style lang="scss" module>
.loading { display: inline-flex; align-items: center; justify-content: center; }
</style>
