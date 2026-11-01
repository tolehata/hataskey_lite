<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span
	:class="$style.tile"
	:data-app="app"
	:data-monochrome="monochrome"
	:data-bare="bare"
	:data-active="active"
	data-hata-app-logo
	:style="{ width: `${size}px`, height: `${size}px` }"
	aria-hidden="true"
>
	<svg :viewBox="bare ? '10 10 80 80' : '0 0 100 100'" width="100%" height="100%" focusable="false">
		<!-- In capsule tabs, black details cut through to the actual tab background. -->
		<component :is="bare ? 'mask' : 'g'" :id="bare ? maskId : undefined" :maskUnits="bare ? 'userSpaceOnUse' : undefined" :x="bare ? 0 : undefined" :y="bare ? 0 : undefined" :width="bare ? 100 : undefined" :height="bare ? 100 : undefined" :style="bare ? { maskType: 'luminance' } : undefined">
			<rect
				v-if="app !== 'hataigo'"
				:class="{ [$style.startPole]: starting }"
				:x="app === 'hatagoes' ? 19 : 20"
				:y="app === 'hatagoes' ? 16 : 18"
				:width="app === 'hatagoes' ? 8 : 7"
				:height="app === 'hatagoes' ? 70 : 66"
				:rx="app === 'hatagoes' ? 4 : 3.5"
				:fill="markColor"
			/>
			<g ref="tapGroup" :class="{ [$style.tap]: tapping }" @animationend.self="tapping = false">
				<g :class="{ [$style.startWave]: starting }" @animationend.self="starting = false">
					<template v-if="app === 'hatagoes'">
						<g v-for="(band, index) in parentBands" :key="index" :class="{ [$style.startBand]: starting }" :style="{ '--band-index': index }">
							<polygon :class="{ [$style.loadBand]: isLoading }" :points="band" :fill="parentBandColor(index)" :stroke="parentBandColor(index)" stroke-width="3" stroke-linejoin="round" :style="{ '--band-index': index }"/>
						</g>
					</template>
					<g v-else :class="{ [$style.startBand]: starting }" style="--band-index: 0">
						<g :class="{ [$style.loadShape]: isLoading }">
							<template v-if="app === 'hatask'">
								<polygon points="30,24 82,50 30,76" :fill="markColor" :stroke="markColor" stroke-width="4" stroke-linejoin="round"/>
								<polyline points="37,50 45,58 59,42" fill="none" :stroke="cutColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
							</template>
							<template v-else-if="app === 'hatady'">
								<polygon points="30,24 80,24 66,50 80,76 30,76" :fill="markColor" :stroke="markColor" stroke-width="4" stroke-linejoin="round"/>
								<path d="M39 37 H53 M39 49 H47" :stroke="cutColor" stroke-width="5.5" stroke-linecap="round"/>
								<g transform="translate(46 70) rotate(-55)">
									<polygon points="0,0 10,-4.6 10,4.6" :fill="cutColor" :stroke="cutColor" stroke-width="1.6" stroke-linejoin="round"/>
									<line x1="2.6" y1="0" x2="7" y2="0" :stroke="markColor" stroke-width="1.6" stroke-linecap="round"/>
									<rect x="12" y="-4.6" width="18" height="9.2" rx="1.6" :fill="cutColor"/>
									<rect x="32" y="-4.6" width="6" height="9.2" rx="3" :fill="cutColor"/>
								</g>
							</template>
							<template v-else-if="app === 'hatafeed'">
								<path d="M30 26 H72 a9 9 0 0 1 9 9 V57 a9 9 0 0 1 -9 9 H46 L32 78 V66 H30 Z" :fill="markColor"/>
								<line x1="43" y1="57" x2="60" y2="40" :stroke="cutColor" stroke-width="7" stroke-linecap="round"/>
								<circle cx="63" cy="37" r="9" :fill="cutColor"/>
								<circle cx="67.5" cy="32.5" r="4.6" :fill="markColor"/>
							</template>
							<template v-else>
								<circle cx="52" cy="42" r="19" :fill="markColor"/>
								<circle cx="66" cy="62" r="14" :fill="cutColor" :stroke="markColor" stroke-width="5"/>
							</template>
						</g>
					</g>
				</g>
			</g>
		</component>
		<rect v-if="bare" width="100" height="100" fill="currentColor" :mask="`url(#${maskId})`"/>
	</svg>
</span>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';
import type { HataApp } from '@/utility/hata-app-brand.js';

const props = withDefaults(defineProps<{
	app: HataApp;
	size?: number;
	monochrome?: boolean;
	bare?: boolean;
	motion?: 'idle' | 'startup' | 'loading';
	loading?: boolean;
	active?: boolean;
	tapSequence?: number;
}>(), {
	size: 48,
	monochrome: false,
	bare: false,
	motion: 'idle',
	loading: false,
	active: true,
	tapSequence: 0,
});

const maskId = `hata-logo-${useId()}`;
const starting = ref(props.motion === 'startup' && !props.loading);
const tapping = ref(false);
const tapGroup = ref<SVGGElement | null>(null);
const isLoading = computed(() => props.loading || props.motion === 'loading');
const markColor = computed(() => props.bare || props.monochrome ? '#ffffff' : props.app === 'hatagoes' ? '#fff7f2' : '#2b1f2c');
const cutColor = computed(() => props.bare ? '#000000' : props.monochrome ? '#1d1b1f' : '#ffffff');
const parentBands = computed(() => props.size <= 16
	? ['31,21 74.862,45 31,45', '31,55 74.862,55 31,79']
	: ['31,21 58.414,36 31,36', '31,43 71.207,43 84,50 71.207,57 31,57', '31,64 58.414,64 31,79']);

function parentBandColor(index: number): string {
	return props.bare || props.monochrome ? '#ffffff' : props.size > 16 && index === 1 ? '#f2a04b' : '#fff7f2';
}

async function replayTap(): Promise<void> {
	if (!props.active) return;
	tapping.value = false;
	await nextTick();
	// The layout read separates two taps in the same frame without changing the tile.
	tapGroup.value?.getBoundingClientRect();
	tapping.value = true;
}

async function replayStartup(): Promise<void> {
	if (isLoading.value || !props.active) return;
	starting.value = false;
	await nextTick();
	tapGroup.value?.getBoundingClientRect();
	starting.value = true;
}

watch(() => props.tapSequence, () => { void replayTap(); });
watch(isLoading, loading => { if (loading) starting.value = false; });
defineExpose({ replayTap, replayStartup });
</script>

<style lang="scss" module>
.tile {
	display: inline-block;
	flex: none;
	border-radius: 25%;
	overflow: hidden;
	vertical-align: middle;
	background: #e0567a;
}
.tile[data-app='hatask'] { background: #f6cf4a; }
.tile[data-app='hatady'] { background: #9fdcc4; }
.tile[data-app='hatafeed'] { background: #b9d7f2; }
.tile[data-app='hataigo'] { background: #d6cbf3; }
.tile[data-monochrome='true'] { background: #1d1b1f; }
.tile[data-bare='true'] { border-radius: 0; background: transparent; overflow: visible; }
.tile svg { display: block; }
.tile[data-bare='true'] svg { overflow: visible; }
.tile[data-active='false'] svg * { animation-play-state: paused !important; }
.startPole {
	transform-box: view-box;
	transform-origin: 23px 86px;
	animation: hataLogoDrop .5s cubic-bezier(.3, 1.4, .5, 1) both;
}
.startBand {
	transform-box: view-box;
	transform-origin: 30px 50px;
	animation: hataLogoSlide .45s cubic-bezier(.2, 1, .3, 1) calc(.35s + var(--band-index) * .12s) both;
}
.startWave {
	transform-box: view-box;
	transform-origin: 27px 50px;
	animation: hataLogoWave .9s ease-in-out 1s both;
}
.loadBand, .loadShape {
	transform-box: view-box;
	transform-origin: 30px 50px;
	animation: hataLogoLoad 1.2s ease-in-out calc(var(--band-index, 0) * .16s) infinite;
}
.tap {
	transform-box: view-box;
	transform-origin: 27px 50px;
	animation: hataLogoTap .35s cubic-bezier(.3, 1.5, .5, 1) both;
}
@keyframes hataLogoDrop { 0% { transform: translateY(-44px); opacity: 0; } 60% { transform: translateY(4px); opacity: 1; } 100% { transform: none; opacity: 1; } }
@keyframes hataLogoSlide { from { transform: translateX(-34px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes hataLogoWave { 0%, 100% { transform: none; } 35% { transform: skewY(-7deg) scaleX(.95); } 70% { transform: skewY(3deg); } }
@keyframes hataLogoLoad { 0%, 100% { transform: translateX(0); opacity: 1; } 30% { transform: translateX(-12px); opacity: .35; } 60% { transform: translateX(2px); opacity: 1; } }
@keyframes hataLogoTap { 0% { transform: none; } 25% { transform: scale(.9, .94); } 55% { transform: scale(1.06) translateX(3px); } 100% { transform: none; } }
</style>
