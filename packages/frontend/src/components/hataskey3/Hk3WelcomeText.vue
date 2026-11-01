<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<span :class="$style.root" role="status" :aria-label="text">
	<span ref="lettersEl" :class="$style.letters" aria-hidden="true">
		<span v-for="(letter, index) in letters" :key="index" :class="$style.letter">{{ letter }}</span>
	</span>
</span>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
	text: string;
	motion: boolean;
	active: boolean;
}>();

function graphemes(text: string): string[] {
	if (typeof Intl.Segmenter === 'function') {
		return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => item.segment);
	}
	return Array.from(text);
}

const letters = computed(() => graphemes(props.text));
const lettersEl = ref<HTMLElement | null>(null);
let reducedMotionQuery: MediaQueryList | null = null;
let animations: Animation[] = [];
let generation = 0;

function stop(): void {
	generation++;
	for (const animation of animations) animation.cancel();
	animations = [];
}

function settle(letter: HTMLElement, animation: Animation, opacity: string, transform: string, run: number): void {
	void animation.finished.then(() => {
		if (generation !== run) return;
		letter.style.opacity = opacity;
		letter.style.transform = transform;
		animation.cancel();
	}, () => {});
}

function update(enter: boolean): void {
	const nodes = Array.from(lettersEl.value?.children ?? []) as HTMLElement[];
	const from = !enter ? nodes.map(node => {
		const style = getComputedStyle(node);
		return { opacity: style.opacity, transform: style.transform };
	}) : [];
	stop();
	const run = generation;
	const still = !props.motion || reducedMotionQuery?.matches || !nodes.every(node => typeof node.animate === 'function');
	if (still) {
		for (const node of nodes) {
			node.style.opacity = props.active ? '1' : '0';
			node.style.transform = 'none';
		}
		return;
	}

	for (const [index, node] of nodes.entries()) {
		const delay = enter ? Math.min(index * 22, 350) : Math.min((nodes.length - 1 - index) * 22, 320);
		const end = enter ? { opacity: '1', transform: 'translate(0, 0)' } : { opacity: '0', transform: 'translate(-6px, 12px)' };
		const start = enter ? { opacity: '0', transform: 'translate(-6px, 12px)' } : from[index];
		const animation = node.animate([start, end], {
			duration: enter ? 380 : 260,
			delay,
			easing: enter ? 'cubic-bezier(.2,.7,.25,1)' : 'cubic-bezier(.25,.7,.25,1)',
			fill: 'both',
		});
		animations.push(animation);
		settle(node, animation, end.opacity, end.transform, run);
	}
}

function onReducedMotionChange(): void {
	update(props.active);
}

onMounted(() => {
	reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	reducedMotionQuery.addEventListener('change', onReducedMotionChange);
	update(props.active);
});

watch(() => [props.text, props.motion, props.active] as const, ([text, motion, active], [oldText, oldMotion, oldActive]) => {
	if (!lettersEl.value) return;
	if (text !== oldText || motion !== oldMotion || active !== oldActive) update(active);
}, { flush: 'post' });

onBeforeUnmount(() => {
	stop();
	reducedMotionQuery?.removeEventListener('change', onReducedMotionChange);
});
</script>

<style lang="scss" module>
.root {
	display: inline-block;
	min-width: 0;
	max-width: 100%;
	white-space: nowrap;
	font-size: inherit;
	font-weight: inherit;
	color: inherit;
}

.letters { display: inline-block; white-space: nowrap; }
.letter { display: inline-block; white-space: pre; opacity: 0; }
</style>
