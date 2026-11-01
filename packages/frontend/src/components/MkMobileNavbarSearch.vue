<!--
SPDX-FileCopyrightText: syuilo and misskey-project / hatacha
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :inert="!active" :aria-hidden="!active" data-mobile-navbar-search>
	<Suspense @resolve="onReady">
		<SearchPage ref="search" embedded :active="active" :maxHeight="maxHeight" :motion="motion" @height="onHeight" @close="onClose"/>
		<template #fallback><div :style="{ height: `${fallbackHeight}px` }" :aria-label="i18n.ts.search" aria-busy="true"></div></template>
	</Suspense>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import SearchPage from '@/pages/search.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	active: boolean;
	maxHeight: number;
	motion: boolean;
}>();
const emit = defineEmits<{
	height: [height: number];
	close: [];
}>();
const search = useTemplateRef<{ focus: () => void }>('search');
const ready = ref(false);
const fallbackHeight = computed(() => Math.min(59, Math.max(0, props.maxHeight)));
let pendingFocus = false;
let generation = 0;
let disposed = false;

function focus() {
	if (!props.active || disposed) return;
	if (ready.value && search.value) search.value.focus();
	else pendingFocus = true;
}

function onReady() {
	ready.value = true;
	const current = generation;
	void nextTick(() => {
		if (!props.active || disposed || current !== generation || !pendingFocus) return;
		pendingFocus = false;
		search.value?.focus();
	});
}

function onHeight(height: number) {
	if (props.active && !disposed) emit('height', Math.max(0, Math.min(props.maxHeight, height)));
}

function onClose() {
	if (props.active && !disposed) emit('close');
}

watch(() => props.active, active => {
	if (active) return;
	generation++;
	pendingFocus = false;
}, { flush: 'sync' });

watch([() => props.active, fallbackHeight], () => {
	if (props.active && !ready.value && !disposed) emit('height', fallbackHeight.value);
}, { immediate: true });

onBeforeUnmount(() => {
	disposed = true;
	generation++;
	pendingFocus = false;
});

defineExpose({ focus });
</script>

<style lang="scss" module>
.root {
	min-width: 0;
	min-height: 0;
	border-radius: inherit;
}
</style>
