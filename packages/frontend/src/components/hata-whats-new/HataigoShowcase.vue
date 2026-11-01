<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: hata-12.9 の更新案内で HataIgo を紹介する。HataIgo 本体の部品は読み込まない（撤去時に案内が壊れないように）。
-->
<template>
<div :class="$style.showcase" data-hataigo-showcase>
	<div :class="$style.hero">
		<div :class="$style.brand">
			<HataAppLogo app="hataigo" :size="56"/>
			<span :class="$style.wordmark"><HataAppWordmark app="hataigo"/></span>
		</div>
		<p :class="$style.tagline">囲碁を、<span :class="$style.brandName">Hataskey</span>で。</p>
		<ul :class="$style.badges">
			<li><i class="ti ti-palette" aria-hidden="true"></i>盤の見た目6種</li>
			<li><i class="ti ti-file-text" aria-hidden="true"></i>SGFの読み込み・保存</li>
			<li><i class="ti ti-eye" aria-hidden="true"></i>観戦とチャット</li>
		</ul>
		<button type="button" :class="$style.start" @click="emit('start')">HataIgoをはじめる<i class="ti ti-arrow-right" aria-hidden="true"></i></button>
	</div>
	<div :class="$style.boardFrame" aria-hidden="true">
		<svg :class="$style.board" viewBox="0 0 100 100" :data-clearing="clearing" focusable="false">
			<rect x="0" y="0" width="100" height="100" rx="6" fill="#e6e0f2"/>
			<path :d="gridPath" fill="none" stroke="#4f4862" stroke-width=".5" stroke-linecap="square"/>
			<circle v-for="[x, y] in STAR_POINTS" :key="`star-${x}-${y}`" :cx="at(x)" :cy="at(y)" r="1" fill="#4f4862"/>
			<g v-for="(move, index) in visibleMoves" :key="index" :class="$style.stone" :data-color="move.color">
				<circle :cx="at(move.x)" :cy="at(move.y)" r="4.6" :fill="move.color === 'black' ? 'url(#hataigo-showcase-black)' : 'url(#hataigo-showcase-white)'" :stroke="move.color === 'black' ? '#141216' : '#9a93a8'" stroke-width=".35"/>
				<circle v-if="index === visibleMoves.length - 1" :cx="at(move.x)" :cy="at(move.y)" r="1.8" fill="none" :stroke="move.color === 'black' ? '#ffffff' : '#2b1f2c'" stroke-width=".55"/>
			</g>
			<defs>
				<radialGradient id="hataigo-showcase-black" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#5a5560"/><stop offset="1" stop-color="#121014"/></radialGradient>
				<radialGradient id="hataigo-showcase-white" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ddd8e6"/></radialGradient>
			</defs>
		</svg>
	</div>
	<ul :class="$style.modes">
		<li v-for="mode in MODES" :key="mode.title">
			<i :class="mode.icon" aria-hidden="true"></i>
			<div><strong>{{ mode.title }}</strong><span>{{ mode.text }}</span></div>
		</li>
	</ul>
</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';

const props = defineProps<{ animate: boolean }>();
const emit = defineEmits<{ start: [] }>();

const MODES = [
	{ icon: 'ti ti-grid-dots', title: 'ひとりで並べる', text: '自由に並べて検討したり、棋譜を読み込んだりできます' },
	{ icon: 'ti ti-robot', title: 'AIと打つ', text: '強さは3段階。ヒントや形勢の目安も見られます' },
	{ icon: 'ti ti-users', title: '人と打つ', text: 'フリーマッチや招待で対局。持ち時間も選べます' },
] as const;

// 盤の飾りの手順（取りが起きない、自作の並び）。
const MOVES: { x: number; y: number; color: 'black' | 'white' }[] = [
	[4, 4], [6, 4], [5, 6], [2, 5], [3, 2], [6, 6], [5, 5], [6, 2],
	[3, 6], [2, 6], [4, 7], [6, 5], [2, 3], [3, 4], [4, 2], [5, 2],
].map(([x, y], index) => ({ x, y, color: index % 2 === 0 ? 'black' : 'white' }));
const STAR_POINTS = [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]] as const;
const STEP_MS = 560;
const HOLD_MS = 2600;
const CLEAR_MS = 480;

const gridPath = Array.from({ length: 9 }, (_, i) => `M${at(0)} ${at(i)}H${at(8)}M${at(i)} ${at(0)}V${at(8)}`).join('');
const count = ref(MOVES.length);
const clearing = ref(false);
const visibleMoves = computed(() => MOVES.slice(0, count.value));
let timer: number | undefined;

function at(index: number): number { return 10 + index * 10; }

function stop() {
	if (timer !== undefined) window.clearTimeout(timer);
	timer = undefined;
	clearing.value = false;
	count.value = MOVES.length;
}

function schedule(ms: number, next: () => void) { timer = window.setTimeout(next, ms); }

function step() {
	if (count.value < MOVES.length) {
		count.value++;
		schedule(count.value < MOVES.length ? STEP_MS : HOLD_MS, step);
		return;
	}
	clearing.value = true;
	schedule(CLEAR_MS, () => { clearing.value = false; count.value = 0; schedule(STEP_MS, step); });
}

// 動きを止める設定・非表示・ページ外では、最後の局面を静止して見せる。
watch(() => props.animate, animate => {
	stop();
	if (animate) { count.value = 0; schedule(STEP_MS, step); }
}, { immediate: true });
onBeforeUnmount(stop);
</script>

<style module>
/* 上の2枚と下のカードで、角の丸み・余白・間隔・枠線を同じ値にそろえる。 */
.showcase { --hi-fuji: #6b4fb8; --hi-radius: 18px; --hi-pad: 20px; --hi-gap: 12px; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); grid-template-areas: 'hero board' 'modes modes'; gap: var(--hi-gap); width: min(100%, 900px); min-width: 0; }
.hero { grid-area: hero; display: flex; flex-direction: column; justify-content: center; gap: 10px; min-width: 0; padding: var(--hi-pad); border: 1px solid color-mix(in srgb, var(--hi-fuji) 22%, transparent); border-radius: var(--hi-radius); color: #2b1f2c; background: radial-gradient(circle at 88% 12%, #ffffff99 0 18%, transparent 40%), linear-gradient(150deg, #f4f0fc 0%, #e3daf7 55%, #d6cbf3 100%); box-shadow: 0 12px 32px color-mix(in srgb, var(--hi-fuji) 18%, transparent); }
.brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
.wordmark { font-size: clamp(40px, 6cqw, 56px); line-height: 1; }
.tagline { margin: 4px 0 0; font: 700 clamp(20px, 2.6cqw, 26px)/1.45 'Zen Maru Gothic', sans-serif; letter-spacing: -.02em; }
/* HataAppWordmark が読み込む Righteous と同じ書体。 */
.brandName { font-family: 'HataAppRighteous', Righteous, sans-serif; font-weight: 400; font-synthesis: none; letter-spacing: 0; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 0; padding: 0; list-style: none; }
.badges li { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; background: #ffffffb3; color: #3e3352; font-size: 12px; font-weight: 700; }
.badges i { color: var(--hi-fuji); }
.start { display: inline-flex; align-self: flex-start; align-items: center; gap: 8px; min-height: 46px; margin-top: 6px; padding: 10px 20px; border: none; border-radius: 999px; background: var(--hi-fuji); color: #ffffff; font: inherit; font-weight: 700; cursor: pointer; transition: filter .15s ease; }
.start:hover { filter: brightness(1.08); }
.start:focus-visible { outline: 3px solid color-mix(in srgb, var(--hi-fuji) 45%, #ffffff); outline-offset: 2px; }
.boardFrame { grid-area: board; display: grid; place-items: center; min-width: 0; padding: var(--hi-pad); border-radius: var(--hi-radius); background: linear-gradient(160deg, color-mix(in srgb, var(--hi-fuji) 10%, var(--MI_THEME-panel)), var(--MI_THEME-panel)); border: 1px solid var(--MI_THEME-divider); }
/* PC(1280×800)で3枚のカードまでスクロールなしで収まる大きさ。 */
.board { display: block; width: 100%; max-width: 280px; height: auto; filter: drop-shadow(0 8px 18px #2b1f2c26); }
.stone { transform-box: fill-box; transform-origin: center; animation: hataigo-showcase-place .26s cubic-bezier(.22, 1, .36, 1) both; }
.board[data-clearing='true'] .stone { opacity: 0; transition: opacity .42s ease; }
.modes { grid-area: modes; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--hi-gap); margin: 0; padding: 0; list-style: none; }
.modes li { display: flex; align-items: flex-start; gap: 12px; min-width: 0; padding: var(--hi-pad); border-radius: var(--hi-radius); background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); }
.modes i { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--hi-fuji) 16%, transparent); color: color-mix(in srgb, var(--hi-fuji) 70%, var(--MI_THEME-fg)); font-size: 18px; }
.modes div { display: grid; gap: 3px; min-width: 0; }
.modes strong { font-size: 14px; }
.modes span { font-size: 12px; line-height: 1.6; color: var(--MI_THEME-fgTransparentWeak); overflow-wrap: anywhere; }
@keyframes hataigo-showcase-place { from { opacity: 0; transform: scale(.55); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .stone { animation: none; } .board[data-clearing='true'] .stone { transition: none; } }
@container release (max-width: 620px) {
	.showcase { --hi-radius: 16px; --hi-pad: 16px; --hi-gap: 10px; grid-template-columns: minmax(0, 1fr); grid-template-areas: 'hero' 'board' 'modes'; }
	.wordmark { font-size: 40px; }
	/* スマホでは紹介のカードをロゴと文字だけにする。 */
	.hero { align-items: center; }
	.tagline, .badges, .start { display: none; }
	.board { max-width: 240px; }
	.modes { grid-template-columns: minmax(0, 1fr); }
}
@container release-body (max-height: 380px) {
	.boardFrame { display: none; }
	.showcase { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'hero' 'modes'; }
}
</style>
