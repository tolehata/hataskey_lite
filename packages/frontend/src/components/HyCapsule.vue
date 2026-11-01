<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div
	ref="root"
	:class="$style.case"
	role="group"
	data-hy-page-controls
	:aria-label="label"
	:data-sliding="sliding === true"
	:style="{ '--hy-label-width': `${labelWidth}px` }"
>
	<span v-if="sliding" :class="$style.indicator" :data-animate="indicator.animate.value" :style="indicator.style.value" aria-hidden="true"></span>
	<button
		v-for="option in options"
		:key="option.value"
		type="button"
		:class="$style.tab"
		:data-active="modelValue === option.value"
		:aria-pressed="modelValue === option.value"
		:aria-label="option.label"
		:title="option.label"
		:disabled="option.disabled"
		@click="emit('update:modelValue', option.value)"
	>
		<slot name="icon" :option="option"><i :class="option.icon" aria-hidden="true"></i></slot>
		<span v-if="modelValue === option.value" :class="$style.label">{{ option.label }}</span>
	</button>
	<div :class="$style.measure" aria-hidden="true">
		<span v-for="option in options" :key="option.value">{{ option.label }}</span>
	</div>
</div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { useSlidingIndicator } from '@/utility/sliding-indicator.js';

const props = defineProps<{
	modelValue: string;
	options: ReadonlyArray<{ value: string; label: string; icon: string; disabled?: boolean }>;
	label: string;
	/** 選択の下地をタブの間で滑らせる（旗鯖fork: HataIgo で使う。既定はオフで従来どおり） */
	sliding?: boolean;
}>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();
const root = useTemplateRef('root');
const labelWidth = ref(84);
const indicator = useSlidingIndicator(root, '[data-active="true"]', () => props.modelValue);
let observer: ResizeObserver | undefined;

function measure(): void {
	const labels = root.value?.lastElementChild?.children;
	if (labels?.length) labelWidth.value = Math.ceil(Math.max(...Array.from(labels, (item) => item.getBoundingClientRect().width)));
}

onMounted(() => {
	measure();
	observer = new ResizeObserver(measure);
	if (root.value?.lastElementChild) observer.observe(root.value.lastElementChild);
});
watch(
	() => props.options,
	() => nextTick(measure),
	{ deep: true },
);
onUnmounted(() => observer?.disconnect());
</script>

<style lang="scss" module>
.case {
	position: relative;
	display: flex;
	align-items: center;
	gap: 4px;
	width: max-content;
	max-width: 100%;
	padding: 5px;
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	background: var(--hy-surface);
	box-shadow: var(--hy-shadow);
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: none;
}
.indicator {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 0;
	border-radius: 999px;
	background: var(--hy-soft);
	pointer-events: none;
}
.indicator[data-animate='true'] {
	transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), width 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease;
}
@media (prefers-reduced-motion: reduce) {
	.indicator[data-animate='true'] {
		transition: none;
	}
}
.case[data-sliding='true'] > .tab {
	position: relative;
	z-index: 1;
}
.case[data-sliding='true'] > .tab[data-active='true'] {
	background: transparent;
}
.case::-webkit-scrollbar {
	display: none;
}
.tab {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 auto;
	gap: 8px;
	min-width: 44px;
	min-height: 44px;
	border: 0;
	padding: 9px 12px;
	border-radius: 999px;
	background: transparent;
	color: var(--hy-ink);
	font: inherit;
	font-size: 14px;
	white-space: nowrap;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;
}
.tab > i {
	font-size: 20px;
}
.tab[data-active='true'] {
	background: var(--hy-soft);
	color: var(--hy-accent);
	font-weight: 700;
}
.tab:not([data-active='true']):hover {
	color: var(--hy-accent);
}
.tab:focus-visible {
	outline: 3px solid var(--hy-accent);
	outline-offset: -2px;
}
.tab:disabled {
	opacity: 0.5;
	cursor: default;
}
.label {
	display: block;
	inline-size: var(--hy-label-width);
	text-align: center;
}
.measure {
	position: absolute;
	inset: 0 auto auto 0;
	visibility: hidden;
	pointer-events: none;
	display: grid;
	width: max-content;
	font-size: 14px;
	font-weight: 700;
	white-space: nowrap;
}
.measure > span {
	grid-area: 1 / 1;
	width: max-content;
}
</style>
