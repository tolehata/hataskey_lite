<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<button v-if="visible" type="button" :class="$style.button" aria-label="支援情報" title="支援情報" @click="emit('open')">
	<HataFeatureIcon feature="support" :size="24" :mode="monochrome ? 'mono-dark' : 'color'"/>
</button>
</template>

<script lang="ts" setup>
import { onActivated, onMounted, onUnmounted, ref } from 'vue';
import HataFeatureIcon from '@/components/HataFeatureIcon.vue';
import { misskeyApi } from '@/utility/misskey-api.js';

defineProps<{ monochrome?: boolean }>();

const emit = defineEmits<{ open: [] }>();
const visible = ref(false);
let request: AbortController | undefined;
let generation = 0;

async function refresh(force = false) {
	if (request && !force) return;
	request?.abort();
	const controller = new AbortController();
	request = controller;
	const current = ++generation;
	try {
		const result = await misskeyApi('hatask/support/show', {}, undefined, controller.signal);
		if (!controller.signal.aborted && current === generation) visible.value = result.navButtonVisible;
	} catch {
		if (!controller.signal.aborted && current === generation) visible.value = false;
	} finally {
		if (current === generation) request = undefined;
	}
}

function onFocus() { void refresh(true); }

onMounted(() => { void refresh(); window.addEventListener('focus', onFocus); });
onActivated(() => { void refresh(true); });
onUnmounted(() => { generation++; request?.abort(); window.removeEventListener('focus', onFocus); });
</script>

<style lang="scss" module>
.button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border: 0;
	border-radius: 10px;
	background: transparent;
	color: inherit;
	cursor: pointer;
}
.button:hover, .button:focus-visible { background: var(--MI_THEME-buttonHoverBg); }
</style>
