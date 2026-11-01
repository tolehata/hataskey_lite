<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root" :data-theme="theme" :data-mode="mode" data-hatask-community-garden>
	<div :class="$style.scene">
		<svg :class="$style.art" viewBox="0 110 1000 405" role="img" :aria-labelledby="titleId"><title :id="titleId">{{ label }}</title>
			<defs>
				<linearGradient :id="ids['soil-gradient']" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--garden-soil-back)"/><stop offset="1" stop-color="var(--garden-soil-front)"/></linearGradient>
				<linearGradient :id="ids['stone-gradient']" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--garden-stone-face)"/><stop offset="1" stop-color="var(--garden-stone-edge)"/></linearGradient>
				<linearGradient :id="ids['leaf-gradient']" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--garden-leaf-light)"/><stop offset=".6" stop-color="var(--garden-leaf)"/><stop offset="1" stop-color="#395d3c"/></linearGradient>
				<radialGradient :id="ids['rare-aura']"><stop stop-color="#fff6ca" stop-opacity=".7"/><stop offset="1" stop-color="#fff6ca" stop-opacity="0"/></radialGradient>
				<radialGradient :id="ids['ground-light']"><stop stop-color="#ffffe8" stop-opacity=".32"/><stop offset="1" stop-color="#ffffe8" stop-opacity="0"/></radialGradient>
				<pattern :id="ids['dirt-grain']" width="47" height="34" patternUnits="userSpaceOnUse"><ellipse cx="4" cy="7" rx="1.5" ry=".9" fill="#d6bb90" opacity=".42"/><ellipse cx="26" cy="14" rx="2" ry="1.1" fill="#2c211b" opacity=".48"/><ellipse cx="39" cy="29" rx="1.5" ry=".9" fill="#e2c499" opacity=".26"/><ellipse cx="14" cy="26" rx="2.8" ry="1.1" fill="#292119" opacity=".24"/><path d="m31 3 4 1M1 22l4 1" stroke="#baa181" stroke-width="1" opacity=".4"/></pattern>
				<filter :id="ids['bed-shadow']" x="-.2" y="-.8" width="1.4" height="2.6"><feGaussianBlur stdDeviation="11"/></filter>
				<filter :id="ids['flower-shadow']" x="-.2" y="-.2" width="1.4" height="1.4" color-interpolation-filters="sRGB"><feDropShadow dx="2" dy="3" stdDeviation="1.2" flood-color="#302719" flood-opacity=".2"/></filter>
			</defs>
			<ellipse cx="475" cy="301" rx="460" ry="231" :fill="paint('ground-light')"/>
			<path d="M40 426q114-81 237-38m520 78q72-34 175-26M103 258q70-26 117-21" fill="none" stroke="#5c7354" stroke-opacity=".07" stroke-width="23" stroke-linecap="round"/>
			<ellipse cx="508" cy="465" rx="375" ry="27" fill="#504736" opacity=".28" :filter="paint('bed-shadow')"/>
			<g aria-hidden="true"><path v-for="(grass, index) in grasses" :key="index" :d="grass" :class="$style.grass"/></g>
			<!-- Raised stone side, its lit top rim, and recessed earth. -->
			<path d="M230 267Q241 250 270 251L734 251Q759 251 773 270L891 417Q904 435 881 453Q870 463 843 467L156 467Q126 461 111 447Q103 435 113 420Z" :fill="paint('stone-gradient')"/>
			<path d="M231 246Q244 233 270 233H734Q758 233 772 248L891 401Q906 420 882 434Q870 444 843 448H156Q125 442 111 429Q102 417 113 402Z" fill="var(--garden-stone-top)" stroke="#fff" stroke-opacity=".24" stroke-width="2"/>
			<path d="M253 260Q262 250 282 250H724Q745 250 754 263L861 400Q875 415 850 423Q842 427 822 429H179Q157 427 142 417Q134 411 145 399Z" :fill="paint('soil-gradient')" stroke="#4b3b2b" stroke-opacity=".28" stroke-width="4"/>
			<path d="M253 260Q262 250 282 250H724Q745 250 754 263L861 400Q875 415 850 423Q842 427 822 429H179Q157 427 142 417Q134 411 145 399Z" :fill="paint('dirt-grain')"/>
			<path d="M232 300q266-13 540 1m-578 55q305-17 622 0m-657 45q339-15 689 0" fill="none" stroke="#271f17" stroke-opacity=".18" stroke-width="8" stroke-linecap="round"/>
			<g fill="none" stroke="var(--garden-stone-edge)" stroke-width="1.6" opacity=".4"><path d="m306 233-4 17m78-17-2 17m80-17-1 17m81-17 1 17m80-17 2 17m77-17 5 17M211 270l22 11m-51 24 24 10m-50 23 28 12m-58 28 28 13m637-118-22 11m48 23-23 11m50 24-28 12m58 28-27 13M191 432l-4 15v20m94-37-3 18v19m95-37-2 18v19m97-37v37m98-37 2 18v19m96-37 3 18v19m96-37 3 18v19m78-35 5 14v20"/></g>
			<path d="M148 449q13 6 32 7H828q23 0 40-8" fill="none" stroke="#efdeba" stroke-opacity=".2" stroke-width="2"/>
			<g v-for="plant in plants" :key="plant.flower.id" :class="$style.plant" :data-flower-id="plant.flower.id" :data-selected="plant.flower.id === selectedId" :transform="`translate(${plant.x} ${plant.y}) scale(${plant.scale})`" aria-hidden="true">
				<ellipse :class="$style.plantShadow" cx="10" cy="4" rx="31" ry="7"/>
				<ellipse cx="0" cy="1" rx="10" ry="3" fill="#271e15" opacity=".7"/>
				<path :class="$style.stem" :d="`M0 1Q${plant.lean + 7} ${plant.headY * .5} ${plant.lean} ${plant.headY + 17}`"/>
				<path :class="$style.stemLight" :d="`M-1-4Q${plant.lean + 5} ${plant.headY * .5} ${plant.lean - 1} ${plant.headY + 18}`"/>
				<path :fill="paint('leaf-gradient')" :d="`M3 ${plant.leafY + 15}Q-31 ${plant.leafY + 19}-39 ${plant.leafY - 14}Q-5 ${plant.leafY - 16}3 ${plant.leafY + 15}ZM3 ${plant.leafY + 4}Q32 ${plant.leafY + 5}39 ${plant.leafY - 25}Q8 ${plant.leafY - 23}3 ${plant.leafY + 4}Z`"/>
				<path :class="$style.vein" :d="`m2 ${plant.leafY + 14}-34-23M4 ${plant.leafY + 3}l27-20`"/>
				<template v-if="plant.flower.rare">
					<ellipse :fill="paint('rare-aura')" :cx="plant.lean" :cy="plant.headY + 15" rx="47" ry="41" opacity=".65"/>
					<path :class="$style.rareSpark" :d="`M-31 ${plant.headY + 2}l2-5 2 5 5 2-5 2-2 5-2-5-5-2ZM34 ${plant.headY + 29}l1.4-4 1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4Z`"/>
				</template>
				<!-- Keep the flower in SVG's coordinate system, including its shadow. -->
				<g :transform="`rotate(${plant.lean} ${plant.lean} ${plant.headY + 10})`">
					<image
						v-if="plant.imageSource"
						:key="plant.imageSource"
						:href="plant.imageSource"
						:x="plant.lean - 32"
						:y="plant.headY - 27"
						width="64"
						height="64"
						preserveAspectRatio="xMidYMid meet"
						:filter="paint('flower-shadow')"
						@error="advanceFlowerImage(plant)"
					/>
					<g v-else :transform="`translate(${plant.lean - 12} ${plant.headY - 7})`" data-flower-image-unavailable fill="none" stroke="var(--garden-leaf)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="m2 2 20 20m-20-7 5-5 7 7m2-8h.01"/></g>
				</g>
				<g v-if="plant.flower.id === selectedId" transform="translate(0 13)"><ellipse rx="13" ry="4" fill="var(--accent)" opacity=".22"/><path d="m0-13 5 7H-5Z" fill="var(--accent)" stroke="var(--surface)" stroke-width="1"/></g>
			</g>
			<g aria-hidden="true" transform="translate(119 453) rotate(-6)"><path d="M13 8v30m56-30v30" stroke="#65513b" stroke-width="5"/><rect width="84" height="26" rx="4" fill="#c7a579" stroke="#f6dbac" stroke-width="1"/><path d="M7 5h69M4 21h73" stroke="#866b4e" opacity=".25"/><text x="42" y="18" text-anchor="middle" fill="#463623" font-size="13" font-weight="700" font-family="system-ui,sans-serif" letter-spacing="1">Hatask</text></g>

		</svg>
		<HataskGardenWeather v-if="season" :season="season" :animations="animations !== false && prefer.r.animation.value"/>
	</div>
	<div :class="$style.activity"><slot/></div>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, useId, watch } from 'vue';
import type { HataskFlowerView } from './hatask-flower-view.js';
import { prefer } from '@/preferences.js';
import { hataskEmojiSources } from '@/utility/hatask-emoji.js';
import HataskGardenWeather from './HataskGardenWeather.vue';
import type { HataskFlowerSeason } from '@/utility/hatask-flower-v2.js';

const props = defineProps<{
	flowers: readonly HataskFlowerView[];
	selectedId: string | null;
	label: string;
	theme: string;
	mode: 'light' | 'dark';
	season?: HataskFlowerSeason;
	animations?: boolean;
}>();
const instanceId = `hatask-garden-${useId()}`;
const titleId = `${instanceId}-title`;
const definitions = ['soil-gradient', 'stone-gradient', 'leaf-gradient', 'rare-aura', 'ground-light', 'dirt-grain', 'bed-shadow', 'flower-shadow'] as const;
type Paint = typeof definitions[number];
const ids = Object.fromEntries(definitions.map(name => [name, `${instanceId}-${name}`])) as Record<Paint, string>;

function paint(name: Paint): string { return `url(#${ids[name]})`; }

const imageFailures = ref(new Map<string, number>());
watch(() => [props.flowers.map(flower => [flower.id, flower.emoji]), prefer.r.emojiStyle.value], () => {
	imageFailures.value = new Map();
}, { flush: 'sync' });

// The caller supplies the current 12-flower page, in the same order as its stream.
const plants = computed(() => props.flowers.slice(0, 12).map((flower, index) => {
	const row = Math.floor(index / 4);
	const column = index % 4;
	const headY = [-108, -99, -110, -118][column];
	return {
		flower,
		imageSource: hataskEmojiSources(flower.emoji, prefer.r.emojiStyle.value).at(imageFailures.value.get(flower.id) ?? 0),
		x: [326, 278, 228][row] + column * [116, 148, 180][row],
		y: [289, 350, 410][row] + [0, 3, -2, 1][column],
		scale: [.81, .95, 1.08][row],
		lean: [-6, 2, -3, 5][column], headY, leafY: headY * .44,
	};
}));

function advanceFlowerImage(failed: (typeof plants.value)[number]): void {
	const current = plants.value.find(plant => plant.flower.id === failed.flower.id);
	// Ignore errors from an image replaced by a fallback or a different page/style.
	if (!current?.imageSource || current.imageSource !== failed.imageSource) return;
	imageFailures.value.set(failed.flower.id, (imageFailures.value.get(failed.flower.id) ?? 0) + 1);
}

const grasses = Array.from({ length: 42 }, (_, index) => {
	const x = index % 2 === 0 ? 83 + (index * 31) % 110 : 818 + (index * 37) % 115;
	const y = 368 + (index * 17) % 99;
	const size = 4 + index % 7;
	return `M${x} ${y}q-9-${size + 7}-12-${size}m12 ${size}q1-${size + 10}5-${size + 15}m-5 ${size + 15}q8-${size + 4}13-${size + 2}`;
});
</script>

<style lang="scss" module>
.root {
	--garden-soil-back: #816346;
	--garden-soil-front: #513c31;
	--garden-stone-top: #ebe3cd;
	--garden-stone-face: #baa888;
	--garden-stone-edge: #8a775e;
	--garden-leaf: #55864f;
	--garden-leaf-light: #91b375;
	container: hatask-garden / inline-size;
	min-width: 0;
	overflow: hidden;
	border-radius: max(0px, calc(var(--card-radius, 24px) - 9px));
	background: radial-gradient(ellipse at 25% 16%, #ffffff8c, transparent 58%), linear-gradient(150deg, #f5ead5, #e5dfc0);
}
.root[data-mode='dark'] {
	--garden-soil-back: #6e5747;
	--garden-soil-front: #382e2c;
	--garden-stone-top: #a59f8b;
	--garden-stone-face: #787566;
	--garden-stone-edge: #53564c;
	--garden-leaf: #48745b;
	--garden-leaf-light: #7ea07b;
	background: radial-gradient(ellipse at 30% 10%, #47584b80, transparent 62%), linear-gradient(150deg, #2c3432, #344235);
}
.scene { position: relative; isolation: isolate; overflow: hidden; }
.art { display: block; width: 100%; height: clamp(152px, 32cqi, 330px); }
.grass { fill: none; stroke: var(--garden-leaf); stroke-width: 1.5; stroke-linecap: round; opacity: .45; }
.plantShadow { fill: #271d17; opacity: .28; }
.plant[data-selected='true'] .plantShadow { fill: var(--accent); opacity: .4; }
.stem { stroke: var(--garden-leaf); stroke-width: 5; stroke-linecap: round; fill: none; }
.stemLight { stroke: var(--garden-leaf-light); stroke-width: 1.2; stroke-linecap: round; fill: none; opacity: .7; }
.vein { fill: none; stroke: #d9e8b8; stroke-width: .7; opacity: .35; }
.rareSpark { fill: #fff5d7; stroke: #ab7c1c; stroke-width: .5; }
.activity { min-width: 0; padding-bottom: 4px; }
.activity:empty { display: none; }
</style>
