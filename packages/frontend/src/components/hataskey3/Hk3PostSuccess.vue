<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<span :class="$style.root" role="status" :aria-label="text">
	<span :class="$style.flight" aria-hidden="true">
		<span :class="$style.trail" data-post-trail></span>
		<span :class="[$style.trail, $style.trailTwo]" data-post-trail></span>
		<svg ref="planeEl" :class="$style.plane" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 3 9-3 9 19-9Z"/><path d="M6 12h16"/></svg>
	</span>
	<span ref="lettersEl" :class="$style.text" aria-hidden="true"><span v-for="(letter, index) in letters" :key="index" :class="$style.letter">{{ letter }}</span></span>
</span>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
	text: string;
	motion: boolean;
}>();

const letters = computed(() => Array.from(props.text));
const planeEl = ref<SVGElement | null>(null);
const lettersEl = ref<HTMLElement | null>(null);
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0;
let disposed = false;

function smoothstep(start: number, end: number, t: number): number {
	const u = Math.max(0, Math.min(1, (t - start) / (end - start)));
	return u * u * (3 - 2 * u);
}

function render(elapsed: number, still: boolean): void {
	const t = Math.min(1, elapsed / 1100);
	const travel = still ? 0 : Math.pow(t, 1.35);
	const x = still ? 0 : -20 + 46 * travel;
	const y = still ? 0 : 18 - 44 * travel;
	const opacity = still ? 1 : smoothstep(0, .18, t) * (1 - smoothstep(.68, 1, t));
	const trail = still ? 0 : opacity * (1 - smoothstep(.55, 1, t));
	if (planeEl.value) {
		planeEl.value.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(-43deg)`;
		planeEl.value.style.opacity = String(opacity);
	}
	const trails = planeEl.value?.parentElement?.querySelectorAll<HTMLElement>('[data-post-trail]');
	trails?.forEach((el, i) => {
		el.style.opacity = String(trail * (i ? .38 : .62));
		el.style.transform = `translate(${(x + (i ? -5 : 0)).toFixed(2)}px, ${(y + (i ? 5 : 6)).toFixed(2)}px) rotate(-43deg) scaleY(.65)`;
	});
	const stagger = Math.min(35, 680 / Math.max(1, letters.value.length - 1));
	Array.from(lettersEl.value?.children ?? []).forEach((node, index) => {
		const letter = node as HTMLElement;
		const letterT = Math.max(0, Math.min(1, (elapsed - 40 - index * stagger) / 380));
		const eased = still || elapsed >= 1100 ? 1 : 1 - Math.pow(1 - letterT, 3);
		letter.style.opacity = String(eased);
		letter.style.transform = `translate(${(-5 * (1 - eased)).toFixed(2)}px, ${(10 * (1 - eased)).toFixed(2)}px)`;
	});
}

function stop(): void {
	if (frame) cancelAnimationFrame(frame);
	frame = 0;
}

function restart(): void {
	stop();
	if (!props.motion || reducedMotionQuery.matches) {
		render(0, true);
		return;
	}
	render(0, false);
	const started = performance.now();

	function tick(now: number): void {
		const elapsed = Math.min(1100, now - started);
		render(elapsed, false);
		frame = elapsed < 1100 ? requestAnimationFrame(tick) : 0;
	}

	frame = requestAnimationFrame(tick);
}

function onReducedMotionChange(): void {
	restart();
}

onMounted(() => {
	reducedMotionQuery.addEventListener('change', onReducedMotionChange);
	restart();
});
watch(() => [props.text, props.motion], async () => {
	await nextTick();
	if (disposed) return;
	restart();
});
onBeforeUnmount(() => {
	disposed = true;
	stop();
	reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
});
</script>

<style lang="scss" module>
.root {
	display: grid;
	grid-template-columns: minmax(48px, 1fr) minmax(0, max-content) minmax(48px, 1fr);
	width: 100%;
	align-items: center;
	gap: 10px;
	min-width: 0;
	max-width: 100%;
	color: currentColor;
	white-space: nowrap;
}

.flight {
	position: relative;
	justify-self: end;
	flex: 0 0 48px;
	width: 48px;
	height: 48px;
	overflow: hidden;
}

.plane {
	position: absolute;
	left: 15px;
	top: 15px;
	z-index: 2;
	transform-origin: center;
	opacity: 0;
}

.trail {
	position: absolute;
	display: block;
	width: 9px;
	height: 1.5px;
	left: 8px;
	top: 28px;
	border-radius: 2px;
	background: currentColor;
	transform-origin: right center;
	opacity: 0;
}

.trailTwo { top: 32px; width: 5px; left: 11px; }

.text { display: inline-block; min-width: 0; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.letter { display: inline-block; white-space: pre; opacity: 0; transform: translate(-5px, 10px); }
</style>
