<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: HataFeed ホームの装飾。若葉が画面全体をゆっくり横断するように舞う。
  - 親(HataFeedダッシュボードの .stage)を埋める absolute オーバーレイ。HataFeed のコンテンツ領域だけに
    かかり、右サイドのウィジェット列(HataFeed外)には被らない。
  - pointer-events: none で操作を妨げず、低不透明度で視覚の邪魔をしない。
  - 落下は top の 0%→100% で親の高さ全体を縦断、横揺れ/回転は transform で表現。
  - prefers-reduced-motion 時はアニメーションを止める(チカチカさせない)。
-->
<template>
<div :class="$style.field" aria-hidden="true">
	<svg
		v-for="(leaf, i) in leaves"
		:key="i"
		:class="$style.leaf"
		:style="leafStyle(leaf)"
		viewBox="0 0 32 32"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M28 4C14 4 4 14 4 27c0 .6.5 1 1 1 12.5 0 23-9.5 23-23 0-.6-.4-1-1-1Z"
			:fill="leaf.color"
		/>
		<path
			d="M24 8C16 13 10 19 7 26"
			fill="none"
			stroke="rgba(255,255,255,.5)"
			stroke-width="1.4"
			stroke-linecap="round"
		/>
	</svg>
</div>
</template>

<script lang="ts" setup>
const COLORS = ['#9ed75b', '#86c84a', '#b6e07a', '#7bbf57', '#a8db66'];

// 若葉の配置・動きを少しずつ散らす。画面全体に薄く分布させる。
const leaves = Array.from({ length: 14 }, (_, i) => ({
	left: Math.random() * 100, // 画面全幅に散らす(%)
	size: 13 + Math.random() * 15, // px
	delay: -Math.random() * 24, // 開始タイミングをばらけさせる(マイナスで初期からバラバラ)
	duration: 14 + Math.random() * 12, // s ゆっくり
	sway: 20 + Math.random() * 40, // px 横揺れ幅
	spin: Math.random() > 0.5 ? 1 : -1,
	color: COLORS[i % COLORS.length],
}));

function leafStyle(leaf: typeof leaves[number]) {
	return {
		left: `${leaf.left}%`,
		width: `${leaf.size}px`,
		height: `${leaf.size}px`,
		'--sway': `${leaf.sway}px`,
		'--spin': `${leaf.spin * 360}deg`,
		animationDelay: `${leaf.delay}s`,
		animationDuration: `${leaf.duration}s`,
	};
}
</script>

<style lang="scss" module>
.field {
	position: absolute;
	inset: 0;
	overflow: hidden;
	pointer-events: none;
	// コンテンツ(.content, z-index:1)より前に薄く舞わせる。
	z-index: 2;
}

.leaf {
	position: absolute;
	top: -8%;
	opacity: 0;
	will-change: transform, top, opacity;
	animation-name: hfLeafFall;
	animation-timing-function: linear;
	animation-iteration-count: infinite;
	filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, .12));
}

// 視覚を邪魔しないよう低い不透明度で。top で全高を縦断、transform で横揺れ/回転。
@keyframes hfLeafFall {
	0%   { top: -8%; transform: translateX(0) rotate(0deg); opacity: 0; }
	8%   { opacity: .34; }
	30%  { transform: translateX(calc(var(--sway) * -1)) rotate(calc(var(--spin) * .3)); }
	55%  { transform: translateX(var(--sway)) rotate(calc(var(--spin) * .6)); }
	80%  { transform: translateX(calc(var(--sway) * -.6)) rotate(calc(var(--spin) * .85)); }
	92%  { opacity: .3; }
	100% { top: 108%; transform: translateX(var(--sway)) rotate(var(--spin)); opacity: 0; }
}

// チカチカ・揺れを好まない設定では動かさない。
@media (prefers-reduced-motion: reduce) {
	.leaf { animation: none; opacity: 0; }
}
</style>
