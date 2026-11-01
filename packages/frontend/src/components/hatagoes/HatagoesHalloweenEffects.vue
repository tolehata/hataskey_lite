<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div v-if="active && motionAllowed" class="hgh-halloween-ambient" aria-hidden="true">
	<span v-for="ghost in ghosts" :key="ghost.top" class="hgh-halloween-ghost" :style="ghost"><i class="ti ti-ghost"></i></span>
</div>
<Teleport v-if="active && motionAllowed" :to="decorationHost ?? 'body'" :disabled="!decorationHost">
	<div class="hgh-halloween-header" :data-shell="!!decorationHost" aria-hidden="true">
		<i v-for="(delay, index) in starDelays" :key="index" class="ti ti-sparkles hgh-halloween-star" :style="{ animationDelay: delay }"></i>
		<span class="hgh-halloween-spider"><span></span><i class="ti ti-spider"></i></span>
	</div>
</Teleport>
<div v-if="active" class="hgh-halloween-effects" :data-motion="motionAllowed" :style="stageStyle">
	<div v-if="burst && motionAllowed" :key="`burst-${burst}`" class="hgh-halloween-burst" aria-hidden="true">
		<i v-for="(particle, index) in burstParticles" :key="index" :class="particle.icon" :style="[particle.style, burstOrigin]"></i>
	</div>
	<div v-if="rain && motionAllowed" :key="`rain-${rain}`" class="hgh-halloween-rain" aria-hidden="true">
		<i v-for="(particle, index) in rainParticles" :key="index" :class="particle.icon" :style="particle.style"></i>
	</div>
	<div v-if="banner" :key="`banner-${banner}`" class="hgh-halloween-banner" :data-animated="bannerAnimated && motionAllowed" role="status" aria-live="polite" aria-atomic="true">
		<strong lang="en">Happy Halloween!</strong>
		<span>きょうの記録がそろいました。</span>
	</div>
</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { prefer } from '@/preferences.js';

const props = defineProps<{
	active: boolean;
	count: number | null;
	day: string;
	origin?: HTMLElement | null;
	container?: HTMLElement | null;
	viewport?: HTMLElement | null;
	decorationHost?: HTMLElement | null;
	/** The local-save revision committed together with the refreshed count. */
	revision: number;
}>();

const reducedMotion = ref(true);
const motionAllowed = computed(() => props.active && prefer.r.animation.value && !reducedMotion.value);
const burst = ref(0);
const rain = ref(0);
const banner = ref(0);
const bannerAnimated = ref(false);
const burstOrigin = ref<{ left: string; top: string; right: string }>();
const stage = ref<{ left: number; top: number; width: number; height: number }>();
const stageStyle = computed(() => stage.value ? {
	left: `${stage.value.left}px`,
	top: `${stage.value.top}px`,
	width: `${stage.value.width}px`,
	height: `${stage.value.height}px`,
	right: 'auto',
	bottom: 'auto',
	'--hgh-stage-height': `${stage.value.height}px`,
} : undefined);
let sequence = 0;
let burstTimer: number | undefined;
let completionTimer: number | undefined;
let motionQuery: MediaQueryList | undefined;
let stageObserver: ResizeObserver | undefined;
let observedViewport: HTMLElement | undefined;
let mounted = false;
let previousCount: number | null = null;
let previousDay = '';
let previousRevision = props.revision;

const ghosts = [
	{ top: '38%', fontSize: '26px', opacity: 0.22, animationDuration: '16s', animationDelay: '0s' },
	{ top: '52%', fontSize: '18px', opacity: 0.16, animationDuration: '22s', animationDelay: '-9s' },
	{ top: '68%', fontSize: '22px', opacity: 0.18, animationDuration: '19s', animationDelay: '-4s' },
];
const starDelays = ['0s', '1.1s', '1.8s', '0.6s'];
const burstIcons = ['ti ti-candy', 'ti ti-sparkles', 'ti ti-pumpkin-scary', 'ti ti-ghost-2', 'ti ti-star-filled'];
const rainIcons = ['ti ti-candy', 'ti ti-pumpkin-scary', 'ti ti-ghost-2', 'ti ti-sparkles', 'ti ti-lollipop'];
const burstParticles = Array.from({ length: 12 }, (_, index) => {
	const angle = index / 12 * Math.PI * 2;
	const distance = 46 + index % 3 * 16;
	return {
		icon: burstIcons[index % burstIcons.length],
		style: {
			fontSize: `${12 + index % 3 * 4}px`,
			color: index % 2 ? 'var(--accent)' : 'var(--candy-1)',
			'--hgh-particle-x': `${Math.cos(angle) * distance}px`,
			'--hgh-particle-y': `${Math.sin(angle) * distance}px`,
			'--hgh-particle-rotation': `${(index % 2 ? 1 : -1) * 160}deg`,
		},
	};
});
const rainParticles = Array.from({ length: 22 }, (_, index) => ({
	icon: rainIcons[index % rainIcons.length],
	style: {
		left: `${index * 37 % 97}%`,
		fontSize: `${16 + index % 4 * 5}px`,
		color: ['var(--accent)', 'var(--candy-1)', 'var(--accent2)'][index % 3],
		animationDuration: `${2 + index % 4 * 0.2}s`,
		animationDelay: `${index % 7 * 0.1}s`,
		'--hgh-particle-rotation': `${(index % 2 ? 1 : -1) * 240}deg`,
	},
}));

function clearBurst() {
	window.clearTimeout(burstTimer);
	burstTimer = undefined;
	burst.value = 0;
}

function clearEffects() {
	clearBurst();
	window.clearTimeout(completionTimer);
	completionTimer = undefined;
	rain.value = 0;
	banner.value = 0;
	bannerAnimated.value = false;
}

function celebrate(complete: boolean) {
	const id = ++sequence;
	clearBurst();
	measureStage();
	if (motionAllowed.value) {
		const origin = props.origin?.getBoundingClientRect();
		const container = props.container?.getBoundingClientRect();
		burstOrigin.value = undefined;
		if (origin && container && origin.width > 0 && origin.height > 0 && container.width > 0 && container.height > 0) {
			let left = origin.left + origin.width / 2 - container.left - (stage.value?.left ?? 0);
			let top = origin.top + origin.height / 2 - container.top - (stage.value?.top ?? 0);
			if (stage.value && (left < 0 || left > stage.value.width || top < 0 || top > stage.value.height)) {
				const inset = Math.min(80, stage.value.width / 2, stage.value.height / 2);
				left = Math.max(inset, Math.min(stage.value.width - inset, left));
				top = Math.max(inset, Math.min(stage.value.height - inset, top));
			}
			burstOrigin.value = { left: `${left}px`, top: `${top}px`, right: 'auto' };
		}
		burst.value = id;
		burstTimer = window.setTimeout(clearBurst, 900);
	}
	if (!complete) return;
	window.clearTimeout(completionTimer);
	banner.value = id;
	bannerAnimated.value = motionAllowed.value;
	rain.value = motionAllowed.value ? id : 0;
	completionTimer = window.setTimeout(() => {
		completionTimer = undefined;
		banner.value = 0;
		rain.value = 0;
		bannerAnimated.value = false;
	}, 3300);
}

function syncReducedMotion(event: MediaQueryListEvent | MediaQueryList) {
	reducedMotion.value = event.matches;
}

function stopMotionQuery() {
	motionQuery?.removeEventListener?.('change', syncReducedMotion);
	motionQuery = undefined;
}

function syncMotionQuery() {
	stopMotionQuery();
	if (!mounted || !props.active) return;
	if (typeof window.matchMedia !== 'function') {
		reducedMotion.value = false;
		return;
	}
	motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	syncReducedMotion(motionQuery);
	motionQuery.addEventListener?.('change', syncReducedMotion);
}

function measureStage() {
	if (!props.active || !props.viewport || !props.container) {
		stage.value = undefined;
		return;
	}
	const viewport = props.viewport.getBoundingClientRect();
	const container = props.container.getBoundingClientRect();
	const viewportLeft = viewport.left + props.viewport.clientLeft;
	const viewportTop = viewport.top + props.viewport.clientTop;
	const left = Math.max(container.left, viewportLeft);
	const top = Math.max(container.top, viewportTop);
	const right = Math.min(container.right, viewportLeft + (props.viewport.clientWidth || viewport.width));
	const bottom = Math.min(container.bottom, viewportTop + (props.viewport.clientHeight || viewport.height));
	stage.value = right > left && bottom > top
		? { left: left - container.left, top: top - container.top, width: right - left, height: bottom - top }
		: undefined;
}

function stopStageTracking() {
	observedViewport?.removeEventListener('scroll', measureStage);
	observedViewport = undefined;
	stageObserver?.disconnect();
	stageObserver = undefined;
	window.removeEventListener('resize', measureStage);
}

function syncStageTracking() {
	stopStageTracking();
	if (!mounted || !props.active) {
		stage.value = undefined;
		return;
	}
	measureStage();
	if (!props.viewport || !props.container) return;
	observedViewport = props.viewport;
	observedViewport.addEventListener('scroll', measureStage, { passive: true });
	window.addEventListener('resize', measureStage);
	if (typeof ResizeObserver !== 'undefined') {
		stageObserver = new ResizeObserver(measureStage);
		stageObserver.observe(props.viewport);
		stageObserver.observe(props.container);
	}
}

watch(() => [props.active, props.day, props.count, props.revision] as const, ([active, day, count, revision]) => {
	if (!active || !day || day !== previousDay) {
		clearEffects();
		previousDay = day;
		previousCount = active ? count : null;
		previousRevision = revision;
		return;
	}
	// Keep the last known value while a local save is being reloaded.
	if (count == null) return;
	const increased = previousCount != null && count > previousCount && revision > previousRevision;
	previousCount = count;
	previousRevision = revision;
	if (increased) celebrate(count === 5);
}, { immediate: true });

watch(() => props.active, syncMotionQuery);
watch(() => [props.active, props.viewport, props.container], syncStageTracking);
watch(motionAllowed, allowed => {
	if (allowed) return;
	clearBurst();
	rain.value = 0;
	bannerAnimated.value = false;
});

onMounted(() => {
	mounted = true;
	syncMotionQuery();
	syncStageTracking();
});
onBeforeUnmount(() => {
	mounted = false;
	stopMotionQuery();
	stopStageTracking();
	clearEffects();
});
</script>

<style lang="scss">
.hgh-halloween-ambient,
.hgh-halloween-header,
.hgh-halloween-effects {
	position: absolute;
	inset: 0;
	overflow: hidden;
	pointer-events: none;
	user-select: none;
}
.hgh-halloween-ambient { z-index: 2; }
.hgh-halloween-header { bottom: auto; height: 120px; z-index: 2; }
.hgh-halloween-header[data-shell="true"] { z-index: 1; }
.hgh-halloween-effects { z-index: 3; }
.hgh-halloween-ghost {
	position: absolute;
	left: 0;
	width: 100%;
	color: var(--accent2);
	animation: hghHalloweenDrift 16s linear infinite;
}
.hgh-halloween-ghost > i { display: block; width: fit-content; animation: hghHalloweenBob 2.2s ease-in-out infinite; }
.hgh-halloween-star { position: absolute; color: var(--candy-1); font-size: 11px; animation: hghHalloweenTwinkle 2.6s ease-in-out infinite; }
.hgh-halloween-star:nth-child(1) { left: 62%; top: 18px; }
.hgh-halloween-star:nth-child(2) { left: 78%; top: 40px; }
.hgh-halloween-star:nth-child(3) { left: 48%; top: 46px; }
.hgh-halloween-star:nth-child(4) { display: none; }
.hgh-halloween-spider { --hgh-thread-height: 22px; --hgh-thread-scale: 2.090909; --hgh-thread-travel: 24px; --hgh-spider-duration: 3.2s; position: absolute; right: min(120px, 31%); top: 44px; display: flex; flex-direction: column; align-items: center; color: var(--fg); font-size: 16px; transform-origin: top center; animation: hghHalloweenSway var(--hgh-spider-duration) ease-in-out infinite; }
.hgh-halloween-spider > span { width: 1px; height: var(--hgh-thread-height); background: var(--fg-2); opacity: 0.6; transform-origin: top center; animation: hghHalloweenThread var(--hgh-spider-duration) ease-in-out infinite; }
.hgh-halloween-spider > i { animation: hghHalloweenDangle var(--hgh-spider-duration) ease-in-out infinite; }
@container (min-width: 851px) {
	.hgh-halloween-header[data-shell="true"] { height: 280px; }
	.hgh-halloween-header[data-shell="true"] > .hgh-halloween-star { font-size: 12px; }
	.hgh-halloween-header[data-shell="true"] > .hgh-halloween-star:nth-child(1) { left: 22%; top: 18px; }
	.hgh-halloween-header[data-shell="true"] > .hgh-halloween-star:nth-child(2) { left: 70%; top: 22px; }
	.hgh-halloween-header[data-shell="true"] > .hgh-halloween-star:nth-child(3) { left: 84%; top: 52px; }
	.hgh-halloween-header[data-shell="true"] > .hgh-halloween-star:nth-child(4) { display: block; left: 36%; top: 58px; }
	.hgh-halloween-header[data-shell="true"] > .hgh-halloween-spider { --hgh-thread-height: 30px; --hgh-thread-scale: 2.133333; --hgh-thread-travel: 34px; --hgh-spider-duration: 3.4s; right: 40px; top: 178px; font-size: 18px; }
}
.hgh-halloween-burst > i { position: absolute; right: 12%; top: 108px; animation: hghHalloweenBurst 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) forwards; }
.hgh-halloween-rain > i { position: absolute; top: 0; opacity: 0; animation: hghHalloweenRain ease-in forwards; }
.hgh-halloween-banner {
	position: absolute;
	left: clamp(12px, 7%, 28px);
	right: clamp(12px, 7%, 28px);
	top: min(180px, calc(var(--hgh-stage-height, 600px) * 0.3));
	max-width: 420px;
	margin-inline: auto;
	padding: 18px 20px;
	border-radius: 24px;
	background: var(--accent);
	color: var(--on-accent);
	box-shadow: 0 20px 40px -18px color-mix(in srgb, var(--fg) 65%, transparent);
	text-align: center;
}
.hgh-halloween-banner[data-animated="true"] { animation: hghHalloweenPop 3.3s ease forwards; }
.hgh-halloween-banner > strong { display: block; font-size: clamp(22px, 7cqw, 30px); font-weight: 800; line-height: 1.15; letter-spacing: 0.02em; }
.hgh-halloween-banner > span { display: block; margin-top: 6px; font-size: 13px; font-weight: 700; }
@keyframes hghHalloweenDrift { from { transform: translateX(-8%); } to { transform: translateX(108%); } }
@keyframes hghHalloweenBob { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-10px) rotate(6deg); } }
@keyframes hghHalloweenTwinkle { 0%, 100% { opacity: 0.25; transform: scale(0.75); } 50% { opacity: 0.85; transform: scale(1.15); } }
@keyframes hghHalloweenSway { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
@keyframes hghHalloweenThread { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(var(--hgh-thread-scale)); } }
@keyframes hghHalloweenDangle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(var(--hgh-thread-travel)); } }
@keyframes hghHalloweenBurst {
	from { opacity: 1; transform: translate(0, 0) scale(0.5); }
	to { opacity: 0; transform: translate(var(--hgh-particle-x), var(--hgh-particle-y)) rotate(var(--hgh-particle-rotation)) scale(1.15); }
}
@keyframes hghHalloweenRain {
	0% { opacity: 0; transform: translateY(-30px) rotate(0); }
	10%, 80% { opacity: 1; }
	100% { opacity: 0; transform: translateY(var(--hgh-stage-height, 520px)) rotate(var(--hgh-particle-rotation)); }
}
@keyframes hghHalloweenPop {
	0% { opacity: 0; transform: translateY(12px) scale(0.92); }
	12%, 85% { opacity: 1; transform: translateY(0) scale(1); }
	100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
}
@media (prefers-reduced-motion: reduce) {
	.hgh-halloween-ambient, .hgh-halloween-header, .hgh-halloween-burst, .hgh-halloween-rain { display: none; }
	.hgh-halloween-banner[data-animated="true"] { animation: none; }
}
</style>
