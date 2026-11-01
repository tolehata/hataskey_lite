<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HataAppLogo ref="logo" :app="app" :size="size" :monochrome="monochrome"/>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import HataAppLogo from './HataAppLogo.vue';
import type { HataApp } from '@/utility/hata-app-brand.js';

withDefaults(defineProps<{ app: HataApp; size?: number; monochrome?: boolean }>(), {
	size: 22,
	monochrome: false,
});

const logo = ref<InstanceType<typeof HataAppLogo> | null>(null);
let action: Element | null = null;

function replayTap() { void logo.value?.replayTap(); }

onMounted(() => {
	action = (logo.value?.$el as Element | undefined)?.closest('button, a') ?? null;
	action?.addEventListener('click', replayTap, true);
});
onBeforeUnmount(() => action?.removeEventListener('click', replayTap, true));
</script>
