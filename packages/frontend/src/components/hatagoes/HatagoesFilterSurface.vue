<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span v-if="embedded" ref="layoutAnchor" :class="$style.anchor" aria-hidden="true"></span>
	<Teleport v-if="embedded" to="body"><HatagoesDialog :open="open" :preferType="narrow ? 'drawer' : 'dialog'" @close="emit('close')">
	<section :class="$style.surface" :data-narrow="narrow" role="dialog" aria-modal="true" :aria-label="title">
		<header :class="$style.header">
			<h2>{{ title }}</h2>
			<button type="button" :class="$style.close" :aria-label="closeLabel" @click="emit('close')"><i class="ti ti-x" aria-hidden="true"></i></button>
		</header>
		<div :class="$style.body"><slot/></div>
	</section>
</HatagoesDialog></Teleport>
<div v-else-if="open"><slot/></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import HatagoesDialog from './HatagoesDialog.vue';

const props = defineProps<{ embedded: boolean; open: boolean; title: string; closeLabel: string }>();
const emit = defineEmits<{ close: [] }>();
const narrow = ref(window.innerWidth <= 700);
const layoutAnchor = ref<HTMLElement>();
let resizeObserver: ResizeObserver | undefined;

function updateNarrow() {
	const parentWidth = layoutAnchor.value?.parentElement?.getBoundingClientRect().width;
	narrow.value = Math.min(window.innerWidth, parentWidth && parentWidth > 0 ? parentWidth : window.innerWidth) <= 700;
}

onMounted(() => {
	if (!props.embedded) return;
	updateNarrow();
	window.addEventListener('resize', updateNarrow);
	if (typeof ResizeObserver !== 'undefined' && layoutAnchor.value?.parentElement) {
		resizeObserver = new ResizeObserver(updateNarrow);
		resizeObserver.observe(layoutAnchor.value.parentElement);
	}
});
onBeforeUnmount(() => { resizeObserver?.disconnect(); window.removeEventListener('resize', updateNarrow); });
</script>

<style lang="scss" module>
.anchor { display: none; }
.surface {
	width: min(620px, calc(100dvw - 32px));
	max-width: 100%;
	max-height: min(720px, calc(100dvh - 48px), calc(100cqh - 48px));
	box-sizing: border-box;
	margin: auto;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border: 1px solid var(--hy-border);
	border-radius: var(--card-radius, 20px);
	background: var(--hy-surface);
	color: var(--hy-ink);
	box-shadow: var(--shadow, 0 16px 48px #0003);
}
.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 14px 18px;
	border-bottom: 1px solid var(--hy-border);
}
.header h2 { margin: 0; font-size: 17px; }
.close {
	width: 44px;
	height: 44px;
	flex: none;
	border: 0;
	border-radius: var(--control-radius, 12px);
	background: transparent;
	color: inherit;
	cursor: pointer;
}
.body { min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 16px 18px; }
.surface[data-narrow='true'] {
	width: 100%;
	max-height: min(85dvh, calc(100cqh - 20px), 820px);
	margin: auto 0 0;
	border-radius: var(--card-radius, 20px) var(--card-radius, 20px) 0 0;
	border-bottom: 0;
}
.surface[data-narrow='true'] .body { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
</style>
