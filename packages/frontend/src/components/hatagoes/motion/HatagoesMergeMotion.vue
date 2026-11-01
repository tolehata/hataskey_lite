<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import { createHatagoesCompositionClock, HATAGOES_MERGE_CUES, HATAGOES_MERGE_DURATION, HATAGOES_MERGE_STILL_TIME } from '@/utility/hatagoes-composition.js';

const props = withDefaults(defineProps<{ active?: boolean; loop?: boolean }>(), { active: true, loop: true });
const emit = defineEmits<{ complete: [] }>();
const container = ref<HTMLElement>();
const scale = ref(1);
const T = ref(0);
const C = { bg: '#fff7f2', ink: '#2b1f2c', sub: '#6a5566', pink: '#e0567a', cream: '#fff7f2', orange: '#f2a04b' };
const apps = [
	{ head: 'Ha', tail: 'task', ink: '#8a6200', tile: '#f6cf4a', sub: '予定・ToDo・きもち', shape: 'task', cx: 520 },
	{ head: 'Ha', tail: 'tady', ink: '#1d7457', tile: '#9fdcc4', sub: '学び・読書', shape: 'dy', cx: 960 },
	{ head: 'Hata', tail: 'Feed', ink: '#2c64a0', tile: '#b9d7f2', sub: '声・改善', shape: 'feed', cx: 1400 },
] as const;
const fx = (v: number) => 31 + 53 * (v - 21) / 29;
const bands = [
	[[31, 21], [(31 + fx(36)) / 2, 28.5], [fx(36), 36], [fx(36), 36], [31, 36]],
	[[31, 43], [fx(43), 43], [84, 50], [fx(43), 57], [31, 57]],
	[[31, 64], [fx(36), 64], [fx(36), 64], [(31 + fx(36)) / 2, 71.5], [31, 79]],
];
const finals = [C.cream, C.orange, C.cream];
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const easing = {
	enter: (t: number) => 1 - (1 - t) ** 3,
	morph: (t: number) => t < 0.5 ? 4 * t ** 3 : (t - 1) * (2 * t - 2) ** 2 + 1,
	pop: (t: number) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};
const prog = (t: number, start: number, end: number, ease = easing.enter) => ease(clamp((t - start) / (end - start)));
const hex = (value: string) => [1, 3, 5].map(i => Number.parseInt(value.slice(i, i + 2), 16));
const mixHex = (a: string, b: string, p: number) => {
	const from = hex(a), to = hex(b);
	return `rgb(${from.map((v, i) => Math.round(mix(v, to[i]!, p))).join(',')})`;
};
const motion = computed(() => {
	const t = T.value, G = HATAGOES_MERGE_CUES.Gather, M = HATAGOES_MERGE_CUES.Merge;
	const R = HATAGOES_MERGE_CUES.Reveal, H = HATAGOES_MERGE_CUES.Hold;
	const lp = prog(t, R, R + 0.9, easing.morph);
	const box = { cx: 960, cy: mix(470, 360, lp), s: mix(440, 320, lp) };
	const project = ([u, v]: number[]) => [box.cx - box.s / 2 + u! / 100 * box.s, box.cy - box.s / 2 + v! / 100 * box.s];
	const spike = prog(t, M + 1, M + 1.35) * (1 - prog(t, M + 1.35, M + 2.4, easing.morph));
	const amp = 4.2 * spike + 1.1 * prog(t, M + 1, M + 2);
	const wave = ([u, v]: number[]) => [u!, v! + amp * Math.sin((u! - 31) / 53 * 4.2 - t * 3.4) * ((u! - 31) / 53)];
	const pinkR = prog(t, M + 0.05, M + 0.9, easing.morph);
	const pole = prog(t, M + 0.55, M + 1.05, easing.pop);
	const cam = 1 + 0.035 * clamp(t / (H + 2));
	const labelsOut = prog(t, G, G + 0.45);
	const outro = prog(t, H + 1.4, H + 2, easing.morph);
	const [poleX, poleY] = project([19, 16]);
	const tiles = apps.map((app, i) => {
		const pIn = prog(t, 0.25 + i * 0.16, 0.95 + i * 0.16, easing.pop);
		const float = 7 * Math.sin(t * 1.6 + i * 1.3) * (1 - prog(t, G, G + 0.8));
		const pm = prog(t, G + 0.35 + i * 0.12, G + 2.15 + i * 0.12, easing.morph);
		const half = 150 * mix(0.6, 1, pIn), ty = 440 + float;
		const rect = [[app.cx - half, ty - half], [app.cx + half, ty - half], [app.cx + half, ty], [app.cx + half, ty + half], [app.cx - half, ty + half]];
		const band = bands[i]!.map(point => project(wave(point)));
		const points = rect.map((r, k) => `${mix(r[0]!, band[k]![0]!, pm).toFixed(1)}px ${mix(r[1]!, band[k]![1]!, pm).toFixed(1)}px`).join(',');
		const colP = prog(t, M + 0.25 + i * 0.08, M + 1 + i * 0.08);
		const labelIn = prog(t, 0.75 + i * 0.16, 1.35 + i * 0.16);
		const ringP = prog(t, M + 1 + i * 0.12, M + 2.3 + i * 0.12);
		const ringR = box.s * (0.55 + ringP * (0.9 + i * 0.25));
		return {
			app, ringP, ringStyle: { left: `${box.cx - ringR}px`, top: `${box.cy - ringR}px`, width: `${ringR * 2}px`, height: `${ringR * 2}px`, border: `${10 * (1 - ringP) + 2}px solid ${app.tile}`, opacity: 1 - ringP },
			fillStyle: { background: colP > 0 ? mixHex(app.tile, finals[i]!, colP) : app.tile, opacity: Math.min(1, pIn * 1.5), clipPath: `polygon(${points})` },
			markStyle: { left: `${mix(app.cx, mix(app.cx, 960, 0.5), pm) - half * 0.86}px`, top: `${ty - half * 0.86 + pm * 40}px`, width: `${half * 1.72}px`, height: `${half * 1.72}px`, opacity: Math.min(pIn, 1) * (1 - prog(t, G + 0.1, G + 0.75)), transform: `scale(${1 - 0.35 * prog(t, G + 0.1, G + 0.75)})` },
			labelStyle: { opacity: labelIn * (1 - labelsOut), transform: `translateY(${(1 - labelIn) * 24 - labelsOut * 16}px)` },
			footStyle: { opacity: prog(t, R + 2.1 + i * 0.12, R + 2.6 + i * 0.12), transform: `translateY(${(1 - prog(t, R + 2.1 + i * 0.12, R + 2.6 + i * 0.12)) * 14}px)` },
		};
	});
	return { box, cam, outro, pinkR, poleStyle: { left: `${poleX}px`, top: `${poleY + (1 - pole) * -box.s * 0.35}px`, width: `${box.s * 0.08}px`, height: `${box.s * 0.7}px`, borderRadius: `${box.s * 0.04}px`, opacity: Math.min(1, pole * 1.4) }, tiles,
		letters: [...'HataGoes'].map((letter, k) => { const p = prog(t, R + 0.45 + k * 0.06, R + 1.05 + k * 0.06, easing.pop); return { letter, style: { color: k >= 4 ? C.pink : C.ink, opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 70}px)` } }; }),
		lineStyle: { opacity: prog(t, R + 1.5, R + 2.2), transform: `translateY(${(1 - prog(t, R + 1.5, R + 2.2)) * 20}px)` },
	};
});

let clock = createHatagoesCompositionClock({ duration: HATAGOES_MERGE_DURATION, endAt: HATAGOES_MERGE_STILL_TIME, loop: props.loop, onFrame: time => { T.value = time; }, onComplete: () => emit('complete') });
let observer: ResizeObserver | undefined;
let activated = true;
const updateVisibility = () => clock.setVisible(activated && !window.document.hidden && !!container.value?.isConnected && (container.value?.clientWidth ?? 0) > 0);
const updateSize = () => { scale.value = (container.value?.clientWidth ?? 0) / 1920; updateVisibility(); };

function play() { clock.play(); }

function pause() { clock.pause(); }

function replay() { clock.replay(); }

function seek(seconds: number) { clock.seek(seconds); }

defineExpose({ play, pause, replay, seek });
watch(() => props.active, value => { if (value) clock.play(); else clock.pause(); });
watch(() => props.loop, value => {
	const time = clock.time, wasPlaying = clock.playing;
	clock.destroy();
	clock = createHatagoesCompositionClock({ duration: HATAGOES_MERGE_DURATION, endAt: HATAGOES_MERGE_STILL_TIME, loop: value, onFrame: t => { T.value = t; }, onComplete: () => emit('complete') });
	clock.seek(time);
	updateVisibility();
	if (wasPlaying && props.active) clock.play();
});
onMounted(() => {
	observer = new ResizeObserver(updateSize);
	if (container.value) observer.observe(container.value);
	updateSize();
	window.document.addEventListener('visibilitychange', updateVisibility);
	updateVisibility();
	if (props.active) clock.play();
});
onActivated(async () => { activated = true; await nextTick(); updateSize(); updateVisibility(); });
onDeactivated(() => { activated = false; updateVisibility(); });
onBeforeUnmount(() => { observer?.disconnect(); window.document.removeEventListener('visibilitychange', updateVisibility); clock.destroy(); });
</script>

<template>
	<div ref="container" class="hatagoes-merge-motion" aria-label="HataGoes Merge Motion">
		<div class="stage" :style="{ transform: `scale(${scale})` }">
			<div class="camera" :style="{ opacity: 1 - motion.outro, transform: `scale(${motion.cam})` }">
				<div class="pink-tile" :style="{ left: `${motion.box.cx - motion.box.s / 2}px`, top: `${motion.box.cy - motion.box.s / 2}px`, width: `${motion.box.s}px`, height: `${motion.box.s}px`, borderRadius: `${motion.box.s * 0.23}px`, clipPath: `circle(${motion.pinkR * 75}% at 50% 50%)` }" />
				<div v-for="(tile, i) in motion.tiles" v-show="tile.ringP > 0 && tile.ringP < 1" :key="`ring-${i}`" class="ring" :style="tile.ringStyle" />
				<div class="pole" :style="motion.poleStyle" />
				<template v-for="(tile, i) in motion.tiles" :key="i">
					<div class="tile" :style="tile.fillStyle" />
					<div class="mark" :style="tile.markStyle">
						<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block">
							<rect x="20" y="18" width="7" height="66" rx="3.5" :fill="C.ink" />
							<g v-if="tile.app.shape === 'task'"><polygon points="30,24 82,50 30,76" :fill="C.ink" :stroke="C.ink" stroke-width="4" stroke-linejoin="round" /><polyline points="37,50 45,58 59,42" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></g>
							<g v-if="tile.app.shape === 'dy'"><polygon points="30,24 80,24 66,50 80,76 30,76" :fill="C.ink" :stroke="C.ink" stroke-width="4" stroke-linejoin="round" /><path d="M39 37 H53 M39 49 H47" stroke="#fff" stroke-width="5.5" stroke-linecap="round" /><line x1="53" y1="62" x2="67" y2="39" stroke="#fff" stroke-width="8" stroke-linecap="round" /><polygon points="46.5,71 48,61.5 55,65.5" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round" /></g>
							<g v-if="tile.app.shape === 'feed'"><path d="M30 26 H72 a9 9 0 0 1 9 9 V57 a9 9 0 0 1 -9 9 H46 L32 78 V66 H30 Z" :fill="C.ink" /><line x1="43" y1="57" x2="60" y2="40" stroke="#fff" stroke-width="7" stroke-linecap="round" /><circle cx="63" cy="37" r="9" fill="#fff" /><circle cx="67.5" cy="32.5" r="4.6" :fill="C.ink" /></g>
						</svg>
					</div>
					<div class="label" :style="[{ left: `${tile.app.cx - 260}px` }, tile.labelStyle]"><span class="app-name">{{ tile.app.head }}<span :style="{ color: tile.app.ink }">{{ tile.app.tail }}</span></span><span class="app-sub">{{ tile.app.sub }}</span></div>
				</template>
				<div class="wordmark"><span v-for="(item, k) in motion.letters" :key="k" :style="item.style">{{ item.letter }}</span></div>
				<div class="line" :style="motion.lineStyle">三つが、ひとつに。そして、進む。</div>
				<div class="footer"><span v-for="(tile, i) in motion.tiles" :key="i" :style="tile.footStyle"><i :style="{ background: tile.app.tile }" />{{ tile.app.head + tile.app.tail }}</span></div>
			</div>
		</div>
	</div>
</template>

<style scoped>
@font-face { font-family: 'HgmRighteous'; src: url('/client-assets/Righteous-Regular.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'HgmZenKaku'; src: url('/client-assets/fonts/zkgn-jp-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'HgmZenMaru'; src: url('/client-assets/fonts/zmg-jp-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
.hatagoes-merge-motion { width: 100%; aspect-ratio: 16 / 9; position: relative; overflow: hidden; background: #fff7f2; }
.stage { width: 1920px; height: 1080px; position: absolute; top: 0; left: 0; transform-origin: top left; overflow: hidden; background: #fff7f2; font-family: 'Zen Kaku Gothic New', 'HgmZenKaku', sans-serif; }
.camera { position: absolute; inset: 0; transform-origin: 960px 480px; }
.pink-tile, .pole, .ring, .mark, .label, .tile { position: absolute; }
.pink-tile { background: #e0567a; }
.pole { background: #fff7f2; }
.ring { border-radius: 50%; box-sizing: border-box; }
.tile { inset: 0; }
.label { width: 520px; top: 638px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.app-name { font: 400 64px/1 'HgmRighteous', Righteous, sans-serif; color: #2b1f2c; }
.app-sub { font-size: 28px; font-weight: 700; color: #6a5566; }
.wordmark { position: absolute; left: 0; right: 0; top: 580px; display: flex; justify-content: center; font: 400 150px/1 'HgmRighteous', Righteous, sans-serif; color: #2b1f2c; letter-spacing: -.01em; }
.wordmark span { display: inline-block; }
.line { position: absolute; left: 0; right: 0; top: 770px; text-align: center; font: 700 48px/1.3 'HgmZenMaru', 'Zen Maru Gothic', sans-serif; color: #2b1f2c; }
.footer { position: absolute; left: 0; right: 0; top: 862px; display: flex; justify-content: center; gap: 44px; }
.footer span { display: inline-flex; align-items: center; gap: 12px; font: 400 30px 'HgmRighteous', Righteous, sans-serif; color: #6a5566; }
.footer i { width: 18px; height: 18px; border-radius: 4px; }
</style>
