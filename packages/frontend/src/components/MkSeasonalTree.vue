<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<figure ref="host" :class="[$style.scene, motionAllowed && $style.motion, !visible && $style.paused]" :style="sceneStyle">
	<svg :class="$style.art" viewBox="0 0 640 420" :preserveAspectRatio="fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'" role="img" :aria-label="ariaLabel">
		<defs>
			<linearGradient :id="ids.sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="palette.skyTop"/><stop offset="1" :stop-color="palette.skyBottom"/></linearGradient>
			<linearGradient :id="ids.ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="palette.groundTop"/><stop offset="1" :stop-color="palette.groundBottom"/></linearGradient>
			<linearGradient :id="ids.trunk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="palette.trunkLight"/><stop offset="1" :stop-color="palette.trunk"/></linearGradient>
			<radialGradient :id="ids.glow"><stop offset="0" :stop-color="palette.celestial" stop-opacity=".28"/><stop offset="1" :stop-color="palette.celestial" stop-opacity="0"/></radialGradient>
			<clipPath :id="ids.frame"><rect width="640" height="420" rx="18"/></clipPath>
		</defs>
		<g :clip-path="`url(#${ids.frame})`">
			<rect width="640" height="420" :fill="`url(#${ids.sky})`"/>
			<g :opacity="palette.starOpacity" :fill="palette.celestial">
				<circle v-for="star in stars" :key="star.x" :cx="star.x" :cy="star.y" :r="star.r"/>
			</g>
			<circle cx="490" :cy="palette.celestialY" r="72" :fill="`url(#${ids.glow})`"/>
			<circle cx="490" :cy="palette.celestialY" :r="displayTime === 'night' ? 16 : 27" :fill="palette.celestial" :opacity="palette.celestialOpacity"/>
			<path d="M0 237 C77 204 131 224 188 203 C240 185 295 222 361 202 C434 176 480 205 552 183 C593 174 619 184 640 178 L640 420 H0Z" :fill="palette.hillFar" opacity=".77"/>
			<path d="M0 272 C70 238 112 254 184 231 C247 210 304 241 360 230 C439 215 492 240 548 222 C592 209 620 218 640 215 L640 420 H0Z" :fill="palette.hillNear" opacity=".88"/>
			<path d="M0 311 C95 290 189 303 276 284 C360 266 432 286 530 270 C578 262 616 270 640 263 L640 420 H0Z" :fill="`url(#${ids.ground})`"/>
			<path d="M0 347 C70 326 127 335 181 328 C232 319 288 332 351 319 C424 303 482 319 540 307 C584 298 615 308 640 299 L640 420 H0Z" :fill="palette.groundLight" opacity=".11"/>
			<path d="M0 381 C82 372 136 382 199 369 C258 357 313 377 382 363 C446 351 501 368 555 355 C597 347 621 353 640 347 L640 420 H0Z" :fill="palette.groundBottom" opacity=".17"/>
			<path d="M0 310 C95 291 186 303 276 285 C359 267 436 287 529 271 C577 264 616 270 640 264" fill="none" :stroke="palette.groundLight" stroke-width="1.5" opacity=".35"/>
			<path d="M190 353 C238 340 260 345 307 341 C347 338 382 345 426 349 C450 352 473 354 494 360 C457 365 420 364 383 365 C331 370 286 365 243 361 C216 361 203 357 190 353Z" :fill="palette.shadow" opacity=".16"/>
			<path d="M286 344 Q302 339 319 341 Q336 338 348 345 Q330 350 309 349 Q294 348 286 344Z" :fill="palette.shadow" opacity=".33"/>
			<path v-if="displaySeason === 'winter'" d="M0 310 Q98 294 178 303 Q235 303 276 285 Q359 268 430 286 Q534 272 640 264 L640 270 Q534 279 430 291 Q359 274 277 292 Q201 309 178 309 Q91 301 0 316Z" :fill="palette.canopyLight" opacity=".56"/>
			<g>
				<g :class="$style.wood">
					<g :fill="palette.trunk"><path v-for="(limb, index) in geometry.limbs" :key="index" :d="limb"/></g>
					<g fill="none" :stroke="palette.trunk" stroke-linecap="round" opacity=".92"><path v-for="(twig, index) in geometry.twigs" :key="index" :d="twig" stroke-width="1.1"/></g>
					<path :d="SEASONAL_TREE_TRUNK" :fill="`url(#${ids.trunk})`"/>
					<path :d="SEASONAL_TREE_BARK" fill="none" :stroke="palette.trunkLight" stroke-width="1.7" stroke-linecap="round" opacity=".68"/>
					<path v-if="displaySeason === 'winter'" :d="geometry.crown.frost" fill="none" :stroke="palette.canopyLight" stroke-width="1.2" stroke-linecap="round" opacity=".36"/>
				</g>
				<g v-if="displaySeason !== 'winter'" :class="$style.crown">
						<path :d="geometry.crown.mass" :fill="palette.canopyDark" :opacity="displaySeason === 'summer' ? .9 : displaySeason === 'spring' ? .59 : .68"/>
						<g :opacity="displaySeason === 'spring' ? .62 : .35" fill="none" :stroke="palette.canopyDark" :stroke-width="displaySeason === 'spring' ? 4 : 7"><path v-for="(halo, index) in geometry.crown.halo" :key="index" :d="halo"/></g>
						<path :d="geometry.crown.back" :fill="leafBackColor" opacity=".91"/>
						<path :d="geometry.crown.mid" :fill="palette.canopyMid"/>
						<path :d="geometry.crown.sun" :fill="palette.canopyLight" opacity=".91"/>
						<path :d="geometry.crown.glints" :fill="palette.accent" :opacity="displaySeason === 'spring' ? .76 : .56"/>
				</g>
			</g>
			<g fill="none" :stroke="palette.groundLight" stroke-linecap="round" :opacity="displaySeason === 'winter' ? .4 : .72">
				<g v-for="blade in grassBlades" :key="blade.x" :class="$style.grass"><path :d="blade.path" stroke-width="1.3"/></g>
			</g>
			<path :d="geometry.turf" fill="none" :stroke="palette.groundLight" stroke-width=".8" stroke-linecap="round" opacity=".33"/>
			<path v-if="displaySeason === 'winter'" d="M280 343 Q296 338 312 341 Q328 338 344 344 Q328 347 314 346 Q293 347 280 343Z" :fill="palette.canopyLight" opacity=".57"/>
			<g v-if="displaySeason === 'spring'" :fill="palette.accent" opacity=".82"><path v-for="(flower, index) in geometry.groundFlowers" :key="index" :d="flower"/></g>
			<path v-if="displaySeason === 'spring' || displaySeason === 'autumn'" :d="geometry.fallen" :fill="displaySeason === 'spring' ? palette.canopyLight : palette.accent" opacity=".57"/>
			<g v-show="motionAllowed" aria-hidden="true">
				<g v-for="(particle, index) in geometry.particles" :key="index" :class="[$style.particle, displaySeason === 'winter' && $style.snow]" :style="particleStyle(particle)">
					<g :class="$style.particleSway"><path :d="particle.path" :fill="palette[particle.color]"/></g>
				</g>
			</g>
		</g>
	</svg>
	<figcaption v-if="showCaption" :class="$style.caption">
		<span :class="$style.captionTitle">{{ copy.title }}</span>
		<span :class="$style.captionDetail">{{ copy.season }}: {{ seasonLabel }} <span aria-hidden="true">·</span> {{ copy.timeOfDay }}: {{ timeLabel }}</span>
	</figcaption>
</figure>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, shallowRef, useId, watch } from 'vue';
import type { SeasonalTreeSeason, SeasonalTreeTimeOfDay } from '@/utility/seasonal-tree.js';
import type { SeasonalTreeParticle } from '@/utility/seasonal-tree-geometry.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { getSeasonalTreeClock, getSeasonalTreePalette } from '@/utility/seasonal-tree.js';
import { getSeasonalTreeGeometry, SEASONAL_TREE_BARK, SEASONAL_TREE_TRUNK } from '@/utility/seasonal-tree-geometry.js';

const props = withDefaults(defineProps<{
	season?: SeasonalTreeSeason | 'auto';
	timeOfDay?: SeasonalTreeTimeOfDay | 'auto';
	animated?: boolean;
	showCaption?: boolean;
	windStrength?: number;
	fit?: 'contain' | 'cover';
}>(), { season: 'auto', timeOfDay: 'auto', animated: true, showCaption: true, windStrength: 60, fit: 'contain' });

const copy = i18n.ts._hata._seasonalTree;
const prefix = `seasonal-tree-${useId()}`;
const ids = { sky: `${prefix}-sky`, ground: `${prefix}-ground`, trunk: `${prefix}-trunk`, glow: `${prefix}-glow`, frame: `${prefix}-frame` };
const host = ref<HTMLElement | null>(null);
const now = shallowRef(new Date());
const inViewport = ref(false);
const documentVisible = ref(true);
const active = ref(true);
const reducedMotion = ref(false);
const mounted = ref(false);
const clock = computed(() => getSeasonalTreeClock(now.value));
const displaySeason = computed(() => props.season === 'auto' ? clock.value.season : props.season);
const displayTime = computed(() => props.timeOfDay === 'auto' ? clock.value.timeOfDay : props.timeOfDay);
const minute = computed(() => props.timeOfDay === 'auto' ? clock.value.minuteOfDay : undefined);
const palette = computed(() => getSeasonalTreePalette(displaySeason.value, displayTime.value, minute.value));
const geometry = shallowRef(getSeasonalTreeGeometry(displaySeason.value));
watch(displaySeason, season => { geometry.value = getSeasonalTreeGeometry(season); });
const seasonLabel = computed(() => copy._seasons[displaySeason.value]);
const timeLabel = computed(() => copy._times[displayTime.value]);
const ariaLabel = computed(() => `${copy.title}。${copy.season}: ${seasonLabel.value}。${copy.timeOfDay}: ${timeLabel.value}。${copy.description}`);
const leafBackColor = computed(() => {
	const a = palette.value.canopyDark, b = palette.value.canopyMid, t = displaySeason.value === 'spring' ? .55 : .24;
	const channel = (at: number) => Math.round(parseInt(a.slice(at, at + 2), 16) * (1 - t) + parseInt(b.slice(at, at + 2), 16) * t).toString(16).padStart(2, '0');
	return `#${channel(1)}${channel(3)}${channel(5)}`;
});
const wind = computed(() => Number.isFinite(props.windStrength) ? Math.max(0, Math.min(100, props.windStrength)) : 60);
const sceneStyle = computed(() => ({
	'--scene-bg': palette.value.groundBottom,
	'--sway-angle': `${Math.round(wind.value * 1.1) / 100}deg`,
	'--drift-x': `${Math.round((18 + wind.value * 1.25) * 10) / 10}px`,
	'--particle-sway': `${Math.round(wind.value * 12) / 100}px`,
}));
const visible = computed(() => mounted.value && active.value && documentVisible.value && inViewport.value);
const motionAllowed = computed(() => props.animated && prefer.r.animation.value && !reducedMotion.value);

const stars = [
	{ x: 58, y: 38, r: 1 }, { x: 100, y: 86, r: .8 }, { x: 161, y: 48, r: 1.2 }, { x: 225, y: 27, r: .6 }, { x: 282, y: 55, r: .8 },
	{ x: 395, y: 32, r: 1 }, { x: 432, y: 63, r: .8 }, { x: 530, y: 37, r: .9 }, { x: 594, y: 83, r: 1 }, { x: 568, y: 142, r: .7 },
] as const;
const grassBlades = [[38, 325, 11], [70, 341, 15], [108, 354, 12], [154, 338, 15], [202, 370, 14], [251, 376, 12], [372, 376, 15], [434, 369, 12], [491, 355, 14], [547, 340, 12], [589, 353, 13], [615, 332, 10]].map(([x, y, h]) => ({ x, path: `M${x} ${y} Q${x - 2} ${y - h * .55} ${x - 7} ${y - h} M${x} ${y} Q${x + 2} ${y - h * .65} ${x + 6} ${y - h * .9}` }));

function particleStyle(particle: SeasonalTreeParticle) {
	return {
		'--start-x': `${particle.x}px`, '--start-y': `${particle.y}px`, '--fall-y': `${particle.fall}px`,
		'--duration': `${particle.duration}s`, '--delay': `${particle.delay}s`, '--particle-opacity': particle.opacity,
	};
}

let timer: number | undefined;
let observer: IntersectionObserver | undefined;
let media: MediaQueryList | undefined;

function stopTimer() { if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; } }

function refreshClock() { now.value = new Date(); }

function syncClock() {
	stopTimer();
	if (!visible.value) return;
	refreshClock();
	if (props.season === 'auto' || props.timeOfDay === 'auto') {
		const wait = Math.max(1000, 60_000 - (Date.now() % 60_000));
		timer = window.setTimeout(syncClock, wait);
	}
}

function onVisibilityChange() { documentVisible.value = !window.document.hidden; syncClock(); }

function onMotionChange(event: MediaQueryListEvent) { reducedMotion.value = event.matches; }

function onPageHide() { documentVisible.value = false; stopTimer(); }

function onPageShow() { documentVisible.value = !window.document.hidden; syncClock(); }

onMounted(() => {
	mounted.value = true;
	documentVisible.value = !window.document.hidden;
	media = window.matchMedia('(prefers-reduced-motion: reduce)');
	reducedMotion.value = media.matches;
	media.addEventListener('change', onMotionChange);
	window.document.addEventListener('visibilitychange', onVisibilityChange);
	window.addEventListener('pagehide', onPageHide);
	window.addEventListener('pageshow', onPageShow);
	if (typeof IntersectionObserver === 'undefined') {
		inViewport.value = true;
		syncClock();
	} else if (host.value) {
		observer = new IntersectionObserver(entries => {
			inViewport.value = entries[0]?.isIntersecting ?? false;
			syncClock();
		});
		observer.observe(host.value);
	}
});
onActivated(() => { active.value = true; if (mounted.value) syncClock(); });
onDeactivated(() => { active.value = false; stopTimer(); });
onUnmounted(() => {
	mounted.value = false;
	stopTimer();
	observer?.disconnect();
	window.document.removeEventListener('visibilitychange', onVisibilityChange);
	window.removeEventListener('pagehide', onPageHide);
	window.removeEventListener('pageshow', onPageShow);
	media?.removeEventListener('change', onMotionChange);
});
watch(() => [props.season, props.timeOfDay], () => { if (mounted.value) syncClock(); });
</script>

<style module>
.scene { display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; min-height: 0; margin: 0; color: var(--fg, var(--MI_THEME-fg)); }
.art { display: block; flex: 1 1 auto; width: 100%; min-height: 0; aspect-ratio: 640 / 420; border-radius: 18px; background: var(--scene-bg); }
.caption { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 3px 14px; padding: 0 3px 3px; font-size: 12px; line-height: 1.4; }
.captionTitle { font-weight: 700; letter-spacing: .03em; }
.captionDetail { opacity: .74; }
.wood, .crown { transform-box: view-box; transform-origin: 318px 330px; }
.motion .wood, .motion .crown { animation: tree-breathe 6.8s ease-in-out infinite alternate; }
.motion .crown { animation-duration: 8.4s; animation-delay: -3.8s; }
.grass { transform-box: fill-box; transform-origin: bottom center; }
.motion .grass { animation: grass-breathe 3.8s ease-in-out infinite alternate; }
.motion .grass:nth-child(2n) { animation-delay: -2.4s; animation-duration: 4.7s; }
.particle { opacity: 0; }
.motion .particle { animation: particle-drift var(--duration) linear infinite; animation-delay: var(--delay); }
.motion .particleSway { animation: particle-sway 2.9s ease-in-out infinite alternate; }
.motion .particleSway > path { transform-box: fill-box; transform-origin: center; animation: petal-flutter 2.3s ease-in-out infinite alternate; }
.motion .particle:nth-child(3n) .particleSway { animation-duration: 1.8s; animation-delay: -1.2s; }
.motion .snow .particleSway > path { animation: none; }
.paused svg * { animation-play-state: paused !important; }
@keyframes tree-breathe { from { rotate: calc(var(--sway-angle) * -.45); } to { rotate: var(--sway-angle); } }
@keyframes grass-breathe { from { rotate: calc(var(--sway-angle) * -6); } to { rotate: calc(var(--sway-angle) * 7); } }
@keyframes particle-sway { from { transform: translateX(calc(var(--particle-sway) * -1)); } to { transform: translateX(var(--particle-sway)); } }
@keyframes petal-flutter { from { scale: 1 .52; rotate: -26deg; } to { scale: 1 1; rotate: 38deg; } }
@keyframes particle-drift { 0% { opacity: 0; transform: translate(var(--start-x),var(--start-y)) rotate(0deg); } 10% { opacity: var(--particle-opacity); } 42% { transform: translate(calc(var(--start-x) + var(--drift-x) * .37),calc(var(--start-y) + var(--fall-y) * .42)) rotate(112deg); } 88% { opacity: var(--particle-opacity); } 100% { opacity: 0; transform: translate(calc(var(--start-x) + var(--drift-x)),calc(var(--start-y) + var(--fall-y))) rotate(300deg); } }
@media (prefers-reduced-motion: reduce) { .motion svg * { animation: none !important; } .particle { opacity: 0 !important; } }
</style>
