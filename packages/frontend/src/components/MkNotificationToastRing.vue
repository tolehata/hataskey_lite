<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<Teleport v-if="target" :to="target">
	<svg v-if="ready" :class="$style.ring" :data-integrated="integrated" :viewBox="`0 0 ${size.width} ${size.height}`" :style="{ width: `${size.width}px`, height: `${size.height}px` }" aria-hidden="true">
		<path v-for="(path, index) in paths" :key="index" :d="path" pathLength="1" :stroke-dashoffset="integrated ? 1 - progress : -progress"/>
	</svg>
</Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue';
import { NOTIFICATION_TOAST_DURATION, notificationOutlinePaths } from '@/utility/hataskey-notification-toast.js';

const props = withDefaults(defineProps<{ target: HTMLElement | null; elapsed: number; integrated: boolean; motion: boolean; duration?: number }>(), { duration: NOTIFICATION_TOAST_DURATION });
const size = shallowRef({ width: 0, height: 0, radius: 24 });
const measuredTarget = shallowRef<HTMLElement | null>(null);
const ready = computed(() => measuredTarget.value === props.target && size.value.width > 4 && size.value.height > 4);
const paths = computed(() => notificationOutlinePaths(size.value.width, size.value.height, size.value.radius, props.integrated));
const progress = computed(() => (props.motion ? props.elapsed : Math.floor(props.elapsed / 1000) * 1000) / props.duration);
const observer = new ResizeObserver(() => measure());

function measure() {
	if (!props.target) return;
	const rect = props.target.getBoundingClientRect();
	size.value = { width: rect.width, height: rect.height, radius: parseFloat(getComputedStyle(props.target).borderTopLeftRadius) || 0 };
	measuredTarget.value = props.target;
}

watch(() => props.target, (target) => {
	observer.disconnect();
	measuredTarget.value = null;
	if (target) observer.observe(target);
	measure();
}, { immediate: true, flush: 'post' });
onUnmounted(() => observer.disconnect());
</script>

<style module lang="scss">
.ring {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	color: var(--MI_THEME-accent);
	pointer-events: none;
	z-index: 2;
	fill: none;
	stroke: currentColor;
	stroke-width: 2;
	stroke-dasharray: 1 1;
	stroke-linecap: butt;
	path { vector-effect: non-scaling-stroke; }
}
</style>
