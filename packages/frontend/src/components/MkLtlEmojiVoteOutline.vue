<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<Teleport v-if="target" :to="target">
	<svg :class="$style.outline" data-integrated="true" data-emoji-vote-outline="true" :viewBox="`0 0 ${size.width} ${size.height}`" :stroke="`url(#${gradientId})`" aria-hidden="true">
		<defs>
			<linearGradient :id="gradientId" gradientUnits="userSpaceOnUse" x1="0" y1="0" :x2="size.width" :y2="size.height">
				<stop offset="0%" stop-color="#ff3864"/>
				<stop offset="16.667%" stop-color="#ff942f"/>
				<stop offset="33.333%" stop-color="#ffe54a"/>
				<stop offset="50%" stop-color="#48e887"/>
				<stop offset="66.667%" stop-color="#35caff"/>
				<stop offset="83.333%" stop-color="#6474ff"/>
				<stop offset="100%" stop-color="#ce52ff"/>
			</linearGradient>
		</defs>
		<path v-for="(path, index) in paths" :key="index" :d="path"/>
	</svg>
</Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useId, watch } from 'vue';
import { notificationOutlinePaths } from '@/utility/hataskey-notification-toast.js';

const props = defineProps<{ target: HTMLElement | null }>();
const gradientId = `emoji-vote-outline-${useId()}`;
const size = shallowRef({ width: 1, height: 1, radius: 24 });
const paths = computed(() => notificationOutlinePaths(size.value.width, size.value.height, size.value.radius, true));
const observer = new ResizeObserver(measure);

function measure() {
	if (!props.target) return;
	const rect = props.target.getBoundingClientRect();
	size.value = { width: rect.width, height: rect.height, radius: parseFloat(window.getComputedStyle(props.target).borderTopLeftRadius) || 0 };
}

watch(() => props.target, target => {
	observer.disconnect();
	if (target) observer.observe(target);
	measure();
}, { immediate: true, flush: 'post' });
onUnmounted(() => observer.disconnect());
</script>

<style module lang="scss">
.outline {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	fill: none;
	path { vector-effect: non-scaling-stroke; }
}
</style>
