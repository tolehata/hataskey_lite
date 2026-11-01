<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<Teleport v-if="target" :to="target">
	<svg :class="$style.ring" :viewBox="`0 0 ${width} ${height}`" :data-visible="state === 'shown'" :data-active="state !== 'hidden'" :data-motion="motion" :data-paused="hidden" data-navbar-loading-ring aria-hidden="true">
		<rect v-if="!motion" :class="$style.still" x="1" y="1" :width="Math.max(0, width - 2)" :height="Math.max(0, height - 2)" :rx="radius" :ry="radius" pathLength="100"/>
		<template v-else>
			<rect v-for="segment in segments" :key="segment.index" :class="$style.segment" x="1" y="1" :width="Math.max(0, width - 2)" :height="Math.max(0, height - 2)" :rx="radius" :ry="radius" pathLength="100" :style="segment.style"/>
		</template>
	</svg>
	<span v-if="state !== 'hidden'" :class="$style.status" role="status">{{ i18n.ts.loading }}</span>
</Teleport>
</template>

<script lang="ts" setup>
import { onUnmounted, ref, watch } from 'vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	target: HTMLElement | null;
	active: boolean;
	motion: boolean;
}>();
const emit = defineEmits<{
	(ev: 'visibleChange', visible: boolean): void;
}>();

const width = ref(0);
const height = ref(0);
const radius = ref(23);
const state = ref<'hidden' | 'shown' | 'fading'>('hidden');
const hidden = ref(window.document.hidden);
const segments = Array.from({ length: 32 }, (_, index) => {
	const phase = (31 - index) * 27 / 31;
	return {
		index,
		style: {
			'--phase': `${phase}px`,
			'--phase-end': `${phase - 100}px`,
			'--strength': .02 + .63 * Math.pow(index / 31, 1.8),
		},
	};
});
let observer: ResizeObserver | null = null;
let revision = 0;
let shownAt = 0;
const timers = new Set<number>();

function clearTimers() {
	timers.forEach(timer => window.clearTimeout(timer));
	timers.clear();
}

function later(callback: () => void, duration: number) {
	const token = revision;
	const timer = window.setTimeout(() => {
		timers.delete(timer);
		if (token === revision) callback();
	}, duration);
	timers.add(timer);
}

function hide() {
	const wasVisible = state.value !== 'hidden';
	state.value = 'hidden';
	if (wasVisible) emit('visibleChange', false);
}

function reveal() {
	if (!props.active || !props.target) return;
	const wasVisible = state.value !== 'hidden';
	shownAt = performance.now();
	state.value = 'shown';
	if (!wasVisible) emit('visibleChange', true);
}

function finish() {
	if (state.value === 'hidden') return;
	later(() => {
		if (!props.motion) {
			hide();
			return;
		}
		state.value = 'fading';
		later(hide, 250);
	}, Math.max(0, 500 - (performance.now() - shownAt)));
}

function measure() {
	if (!props.target) return;
	width.value = props.target.clientWidth;
	height.value = props.target.clientHeight;
	const style = getComputedStyle(props.target);
	const corner = Number.parseFloat(style.borderTopLeftRadius);
	radius.value = Math.max(0, Math.min(Number.isFinite(corner) ? corner : 24, width.value / 2, height.value / 2) - 1);
}

watch([() => props.target, () => props.active], ([target, active], previous) => {
	++revision;
	clearTimers();
	if (target !== previous?.[0]) {
		observer?.disconnect();
		observer = null;
		hide();
		if (target) {
			measure();
			observer = new ResizeObserver(measure);
			observer.observe(target);
		}
	}
	if (!target) return;
	if (active) {
		if (state.value === 'hidden') later(reveal, 200);
		else reveal();
	} else finish();
}, { immediate: true, flush: 'sync' });

watch(() => props.motion, motion => {
	if (!motion && state.value === 'fading') {
		++revision;
		clearTimers();
		hide();
	}
}, { flush: 'sync' });

function onVisibilityChange() { hidden.value = window.document.hidden; }

window.document.addEventListener('visibilitychange', onVisibilityChange);
onUnmounted(() => {
	++revision;
	clearTimers();
	observer?.disconnect();
	window.document.removeEventListener('visibilitychange', onVisibilityChange);
	hide();
});
</script>

<style lang="scss" module>
.ring {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 2;
	pointer-events: none;
	overflow: visible;
	color: var(--MI_THEME-accent);
	opacity: 0;
	transition: opacity .25s ease;
	&[data-visible='true'] { opacity: 1; }
	&[data-motion='false'] { transition: none; }
	rect { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: butt; }
}

.segment {
	stroke-dasharray: .95 99.05;
	stroke-dashoffset: var(--phase);
	stroke-opacity: var(--strength);
	.ring[data-active='true'] & { animation: perimeter 3.8s linear infinite; }
	.ring[data-paused='true'] & { animation-play-state: paused; }
}

.still { stroke-opacity: .26; }

.status {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

@keyframes perimeter {
	from { stroke-dashoffset: var(--phase); }
	to { stroke-dashoffset: var(--phase-end); }
}
</style>
