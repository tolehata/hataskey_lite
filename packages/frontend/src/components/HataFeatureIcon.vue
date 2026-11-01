<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span :class="$style.icon" :data-hata-feature="feature" :data-bare="bare" :style="iconStyle" aria-hidden="true">
	<svg :viewBox="bare ? '10 10 80 80' : '0 0 100 100'" width="100%" height="100%" focusable="false">
		<rect v-if="!bare" :x="mode === 'mono-light' ? 1 : 0" :y="mode === 'mono-light' ? 1 : 0" :width="mode === 'mono-light' ? 98 : 100" :height="mode === 'mono-light' ? 98 : 100" rx="23" fill="var(--hfi-tile)" :stroke="mode === 'mono-light' ? 'var(--hfi-ink)' : undefined" :stroke-width="mode === 'mono-light' ? 2 : undefined"/>
		<!-- In capsule tabs, black details cut through to the actual tab background. -->
		<component :is="bare ? 'mask' : 'g'" :id="bare ? maskId : undefined" :maskUnits="bare ? 'userSpaceOnUse' : undefined" :x="bare ? 0 : undefined" :y="bare ? 0 : undefined" :width="bare ? 100 : undefined" :height="bare ? 100 : undefined" :style="bare ? { maskType: 'luminance' } : undefined">
			<g v-if="shape === 'home'">
				<path d="M50 18 L83 46 H76 V80 H24 V46 H17 Z" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="4" stroke-linejoin="round"/>
				<path d="M43 81 V65 a7 7 0 0 1 14 0 V81 Z" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'cal'">
				<rect x="20" y="28" width="60" height="52" rx="9" fill="var(--hfi-ink)"/>
				<rect x="32" y="18" width="8" height="18" rx="4" fill="var(--hfi-ink)"/>
				<rect x="60" y="18" width="8" height="18" rx="4" fill="var(--hfi-ink)"/>
				<path d="M28 44 H72" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
				<rect x="30" y="53" width="9" height="8" rx="2" fill="var(--hfi-cut)"/>
				<rect x="45.5" y="53" width="9" height="8" rx="2" fill="var(--hfi-cut)"/>
				<rect x="61" y="53" width="9" height="8" rx="2" fill="var(--hfi-cut)"/>
				<rect x="30" y="66" width="9" height="8" rx="2" fill="var(--hfi-cut)"/>
				<rect x="45.5" y="66" width="9" height="8" rx="2" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'todo'">
				<rect x="22" y="22" width="56" height="56" rx="14" fill="var(--hfi-ink)"/>
				<path d="M35 51 L45 61 L65 39" fill="none" stroke="var(--hfi-cut)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'mood'">
				<circle cx="50" cy="50" r="31" fill="var(--hfi-ink)"/>
				<circle cx="39" cy="45" r="4.5" fill="var(--hfi-cut)"/>
				<circle cx="61" cy="45" r="4.5" fill="var(--hfi-cut)"/>
				<path d="M37 57 Q50 70 63 57" fill="none" stroke="var(--hfi-cut)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'meal'">
				<path d="M18 50 H82 A32 30 0 0 1 18 50Z" fill="var(--hfi-ink)"/>
				<rect x="38" y="77" width="24" height="7" rx="3.5" fill="var(--hfi-ink)"/>
				<path d="M38 40 q-6 -7 0 -14 M50 40 q-6 -7 0 -14 M62 40 q-6 -7 0 -14" fill="none" stroke="var(--hfi-ink)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M28 59 H72" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'recipe'">
				<circle cx="35" cy="42" r="14" fill="var(--hfi-ink)"/>
				<circle cx="50" cy="33" r="17" fill="var(--hfi-ink)"/>
				<circle cx="65" cy="42" r="14" fill="var(--hfi-ink)"/>
				<rect x="33" y="42" width="34" height="26" fill="var(--hfi-ink)"/>
				<rect x="31" y="68" width="38" height="13" rx="4" fill="var(--hfi-ink)"/>
				<path d="M33 68 H67" fill="none" stroke="var(--hfi-cut)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M43 50 V60 M57 50 V60" fill="none" stroke="var(--hfi-cut)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'flower'">
				<path d="M50 56 V84" fill="none" stroke="var(--hfi-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M50 76 C57 66 68 65 75 67 C71 77 59 80 50 76Z" fill="var(--hfi-ink)"/>
				<circle cx="50.0" cy="25.0" r="11" fill="var(--hfi-ink)"/>
				<circle cx="64.3" cy="35.4" r="11" fill="var(--hfi-ink)"/>
				<circle cx="58.8" cy="52.1" r="11" fill="var(--hfi-ink)"/>
				<circle cx="41.2" cy="52.1" r="11" fill="var(--hfi-ink)"/>
				<circle cx="35.7" cy="35.4" r="11" fill="var(--hfi-ink)"/>
				<circle cx="50" cy="40" r="7" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'rank'">
				<rect x="18" y="54" width="19" height="28" rx="4" fill="var(--hfi-ink)"/>
				<rect x="41" y="40" width="18" height="42" rx="4" fill="var(--hfi-ink)"/>
				<rect x="63" y="62" width="19" height="20" rx="4" fill="var(--hfi-ink)"/>
				<polygon points="40,34 43,20 50,28 57,20 60,34" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="3" stroke-linejoin="round"/>
				<path d="M46 52 L51 48 V68" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'look'">
				<path d="M50 20 C72 20 84 36 82 52 C80 64 68 62 62 66 C56 70 62 80 52 80 C32 80 18 66 18 48 C18 32 32 20 50 20Z" fill="var(--hfi-ink)"/>
				<circle cx="36" cy="40" r="5.5" fill="var(--hfi-cut)"/>
				<circle cx="52" cy="32" r="5.5" fill="var(--hfi-cut)"/>
				<circle cx="67" cy="42" r="5.5" fill="var(--hfi-cut)"/>
				<circle cx="32" cy="58" r="5.5" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'shield'">
				<path d="M50 16 L80 26 V48 C80 66 66 78 50 84 C34 78 20 66 20 48 V26 Z" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="3" stroke-linejoin="round"/>
				<path d="M37 50 L46 59 L63 42" fill="none" stroke="var(--hfi-cut)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'apps'">
				<rect x="19" y="19" width="26" height="26" rx="7" fill="var(--hfi-ink)"/>
				<rect x="55" y="19" width="26" height="26" rx="7" fill="var(--hfi-ink)"/>
				<rect x="19" y="55" width="26" height="26" rx="7" fill="var(--hfi-ink)"/>
				<rect x="55" y="55" width="26" height="26" rx="7" fill="var(--hfi-ink)"/>
				<circle cx="32" cy="32" r="4.5" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'appsplus'">
				<rect x="19" y="19" width="26" height="26" rx="7" fill="var(--hfi-ink)"/>
				<rect x="55" y="19" width="26" height="26" rx="7" fill="var(--hfi-ink)"/>
				<rect x="19" y="55" width="26" height="26" rx="7" fill="var(--hfi-ink)"/>
				<path d="M68 56 V80 M56 68 H80" fill="none" stroke="var(--hfi-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="32" cy="32" r="4.5" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'card'">
				<rect x="16" y="26" width="68" height="48" rx="9" fill="var(--hfi-ink)"/>
				<circle cx="33" cy="45" r="8" fill="var(--hfi-cut)"/>
				<path d="M27 62 H39" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M50 42 H72 M50 53 H65" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'lyze'">
				<path d="M62 62 L80 80" fill="none" stroke="var(--hfi-ink)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="44" cy="44" r="25" fill="var(--hfi-ink)"/>
				<circle cx="36" cy="40" r="3.8" fill="var(--hfi-cut)"/>
				<circle cx="52" cy="40" r="3.8" fill="var(--hfi-cut)"/>
				<path d="M34 50 Q44 59 54 50" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'studio'">
				<rect x="16" y="22" width="68" height="56" rx="9" fill="var(--hfi-ink)"/>
				<path d="M38 28 V72" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
				<rect x="23" y="32" width="9" height="7" rx="2" fill="var(--hfi-cut)"/>
				<rect x="23" y="44" width="9" height="7" rx="2" fill="var(--hfi-cut)"/>
				<rect x="23" y="56" width="9" height="7" rx="2" fill="var(--hfi-cut)"/>
				<path d="M52 64 L68 40" fill="none" stroke="var(--hfi-cut)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
				<polygon points="47,71 49,63 55,67" fill="var(--hfi-cut)" stroke="var(--hfi-cut)" stroke-width="2" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'mascot'">
				<polygon points="24,44 27,16 46,30" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="6" stroke-linejoin="round"/>
				<polygon points="76,44 73,16 54,30" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="6" stroke-linejoin="round"/>
				<ellipse cx="50" cy="54" rx="31" ry="27" fill="var(--hfi-ink)"/>
				<circle cx="39" cy="51" r="4.5" fill="var(--hfi-cut)"/>
				<circle cx="61" cy="51" r="4.5" fill="var(--hfi-cut)"/>
				<path d="M43 62 q3.5 4 7 0 q3.5 4 7 0" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'game'">
				<path d="M30 34 H70 a16 16 0 0 1 14 22 l-6 14 a8 8 0 0 1 -13 2 l-7 -8 H38 l-7 8 a8 8 0 0 1 -13 -2 l-6 -14 A16 16 0 0 1 30 34Z" fill="var(--hfi-ink)"/>
				<path d="M24 50 H38 M31 43 V57" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="63" cy="46" r="4" fill="var(--hfi-cut)"/>
				<circle cx="71" cy="54" r="4" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'igo'">
				<rect x="20" y="20" width="60" height="60" rx="9" fill="var(--hfi-ink)"/>
				<path d="M34 28 V72 M50 28 V72 M66 28 V72 M28 34 H72 M28 50 H72 M28 66 H72" fill="none" stroke="var(--hfi-cut)" stroke-width="3.5" stroke-linecap="round"/>
				<circle cx="34" cy="34" r="8" fill="var(--hfi-ink)" stroke="var(--hfi-cut)" stroke-width="3.5"/>
				<circle cx="66" cy="66" r="8" fill="var(--hfi-cut)" stroke="var(--hfi-ink)" stroke-width="3.5"/>
			</g>
			<g v-else-if="shape === 'intro'">
				<path d="M50 30 C40 24 28 24 18 28 V76 C28 72 40 72 50 78 C60 72 72 72 82 76 V28 C72 24 60 24 50 30Z" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="3" stroke-linejoin="round"/>
				<path d="M50 33 V74" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M26 41 H42 M26 51 H39 M58 41 H74" fill="none" stroke="var(--hfi-cut)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'draw'">
				<path d="M78 20 L52 48" fill="none" stroke="var(--hfi-ink)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M54 37 L62 45" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M48 48 C40 48 34 54 34 62 C34 70 28 74 20 78 C36 84 54 78 56 62 C57 56 54 50 48 48Z" fill="var(--hfi-ink)"/>
				<path d="M43 59 Q43 66 37 70" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'support'">
				<path d="M50 80 C34 68 18 56 18 40 C18 29 26 22 35 22 C42 22 47 26 50 31 C53 26 58 22 65 22 C74 22 82 29 82 40 C82 56 66 68 50 80Z" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="3" stroke-linejoin="round"/>
				<path d="M30 48 H40 L44 40 L52 58 L57 48 H70" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'note'">
				<rect x="24" y="16" width="52" height="68" rx="8" fill="var(--hfi-ink)"/>
				<path d="M36 22 V78" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M46 36 H66 M46 48 H62" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'shelf'">
				<rect x="18" y="22" width="15" height="60" rx="3" fill="var(--hfi-ink)"/>
				<rect x="37" y="30" width="15" height="52" rx="3" fill="var(--hfi-ink)"/>
				<rect x="58" y="24" width="15" height="56" rx="3" fill="var(--hfi-ink)" transform="rotate(-14 65.5 80)"/>
				<path d="M22 34 H29 M41 40 H48" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M62 36 H69" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" transform="rotate(-14 65.5 80)"/>
				<path d="M16 84 H84" fill="none" stroke="var(--hfi-ink)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'person'">
				<circle cx="50" cy="35" r="15" fill="var(--hfi-ink)"/>
				<path d="M21 82 C21 64 34 56 50 56 C66 56 79 64 79 82 Z" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="3" stroke-linejoin="round"/>
				<path d="M43 68 Q50 73 57 68" fill="none" stroke="var(--hfi-cut)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'gear'">
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(0 50 50)"/>
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(45 50 50)"/>
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(90 50 50)"/>
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(135 50 50)"/>
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(180 50 50)"/>
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(225 50 50)"/>
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(270 50 50)"/>
				<rect x="44" y="14" width="12" height="16" rx="3" fill="var(--hfi-ink)" transform="rotate(315 50 50)"/>
				<circle cx="50" cy="50" r="24" fill="var(--hfi-ink)"/>
				<circle cx="50" cy="50" r="9" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'issue'">
				<rect x="18" y="20" width="64" height="48" rx="12" fill="var(--hfi-ink)"/>
				<polygon points="32,64 32,82 50,66" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="3" stroke-linejoin="round"/>
				<path d="M50 31 V47" fill="none" stroke="var(--hfi-cut)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="50" cy="57" r="4.2" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'map'">
				<polygon points="18,26 38,18 62,26 82,18 82,74 62,82 38,74 18,82" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="4" stroke-linejoin="round"/>
				<path d="M38 23 V70 M62 31 V77" fill="none" stroke="var(--hfi-cut)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'beta'">
				<path d="M42 20 H58 V40 L79 75 C82 80 78 84 73 84 H27 C22 84 18 80 21 75 L42 40 Z" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="3" stroke-linejoin="round"/>
				<path d="M37 18 H63" fill="none" stroke="var(--hfi-ink)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M31 64 H69" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="45" cy="74" r="3.2" fill="var(--hfi-cut)"/>
				<circle cx="56" cy="72" r="2.4" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'emoji'">
				<circle cx="50" cy="50" r="31" fill="var(--hfi-ink)"/>
				<path d="M34 45 Q39 38 44 45 M56 45 Q61 38 66 45" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M35 55 H65 Q65 71 50 71 Q35 71 35 55Z" fill="var(--hfi-cut)"/>
			</g>
			<g v-else-if="shape === 'news'">
				<path d="M50 14 L58 32 L77 30 L68 47 L82 60 L63 64 L60 83 L50 72 L40 83 L37 64 L18 60 L32 47 L23 30 L42 32 Z" fill="var(--hfi-ink)" stroke="var(--hfi-ink)" stroke-width="4" stroke-linejoin="round"/>
				<path d="M41 42 V58 L59 42 V58" fill="none" stroke="var(--hfi-cut)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
			<g v-else-if="shape === 'quake'">
				<rect x="18" y="18" width="64" height="64" rx="14" fill="var(--hfi-ink)"/>
				<path d="M26 52 H35 L40 40 L47 66 L54 32 L60 58 L65 48 H74" fill="none" stroke="var(--hfi-cut)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
			</g>
		</component>
		<rect v-if="bare" width="100" height="100" fill="currentColor" :mask="`url(#${maskId})`"/>
	</svg>
</span>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import type { HataFeature } from '@/utility/hata-feature-icon.js';
import { HATA_FEATURE_ICONS } from '@/utility/hata-feature-icon.js';

const props = withDefaults(defineProps<{
	feature: HataFeature;
	size?: number;
	bare?: boolean;
	mode?: 'color' | 'mono-light' | 'mono-dark';
}>(), { size: 24, bare: false, mode: 'color' });

const maskId = `hata-feature-${useId()}`;
const tileColors = { hatask: '#f6cf4a', hataskey: '#a6e3f0', hatady: '#9fdcc4', hatafeed: '#b9d7f2' } as const;
const shape = computed(() => HATA_FEATURE_ICONS[props.feature].shape);
const iconStyle = computed(() => ({
	width: `${props.size}px`,
	height: `${props.size}px`,
	'--hfi-tile': props.mode !== 'color' ? '#ffffff' : tileColors[HATA_FEATURE_ICONS[props.feature].family],
	'--hfi-ink': props.bare ? '#ffffff' : props.mode === 'color' ? '#2b1f2c' : '#1d1b1f',
	'--hfi-cut': props.bare ? '#000000' : '#ffffff',
}));
</script>

<style lang="scss" module>
.icon { display: inline-block; flex: none; vertical-align: middle; }
.icon svg { display: block; }
</style>
