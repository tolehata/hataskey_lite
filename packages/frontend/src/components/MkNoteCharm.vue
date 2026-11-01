<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<span v-if="supportedDevice" ref="source" :class="$style.source" aria-hidden="true" :style="{ '--note-charm-fallback-size': `${requestedSize}px` }"></span>
<Teleport v-if="supportedDevice" to="body">
	<div :class="$style.layer" :style="layerStyle" :inert="!interactive || portalInert" data-note-charm-layer>
		<div ref="rail" :class="$style.rail" :style="rootStyle" :data-near="near" :data-held="held" :data-motion="canMove" :data-outline="artwork.kind" data-note-charm>
			<svg :class="$style.hardware" :width="geometry.railWidth" :height="geometry.height" :viewBox="`0 0 ${geometry.railWidth} ${geometry.height}`" aria-hidden="true">
				<g :transform="`translate(${geometry.anchorX - 3} 0)`">
					<ellipse :class="$style.punch" cx="-4" cy=".3" rx="1.8" ry="1.15" transform="rotate(24 -4 .3)" data-note-charm-punch-hole/>
					<path :class="$style.noteRing" d="M -4.1 .1 C -.8 -.8 4.1 1.3 3 4"/>
				</g>
				<path :class="$style.chainPath" :d="pose.chain"/>
				<circle v-for="(ball, index) in pose.balls" :key="index" :class="$style.ball" :cx="ball.x" :cy="ball.y" r=".92" data-note-charm-ball/>
				<ellipse :class="$style.jumpRing" :cx="pose.ring.x" :cy="pose.ring.y" rx="2" :ry="pose.ring.ry" :transform="`rotate(${pose.ring.angle} ${pose.ring.x} ${pose.ring.y})`"/>
			</svg>
			<div ref="pendulum" :class="$style.pendulum" :style="{ width: `${geometry.width}px`, height: `${artwork.height}px`, transform: pose.transform }">
				<button
					ref="button"
					type="button"
					:class="$style.grip"
					:style="{ width: `${geometry.width}px`, height: `${artwork.height}px` }"
					:data-cutout="charm.pattern === 'cutout'"
					:disabled="!interactive"
					:aria-label="held ? i18n.ts._noteCharm.lower : i18n.ts._noteCharm.lift"
					:aria-pressed="held"
					@click.stop="click"
					@dblclick.stop
					@pointerdown.stop="pointerDown"
					@pointermove.stop="pointerMove"
					@pointerup.stop="pointerEnd"
					@pointercancel.stop="pointerEnd"
					@lostpointercapture.stop="pointerEnd"
					@blur="blur"
					@dragstart.stop.prevent
					@contextmenu.stop.prevent
					@keydown.stop="keydown"
					@keyup.stop
				>
					<svg :class="$style.plate" :width="geometry.width" :height="artwork.height" :viewBox="`0 0 ${geometry.width} ${artwork.height}`" aria-hidden="true">
						<defs>
							<mask :id="`${id}-plate`" maskUnits="userSpaceOnUse" x="0" y="0" :width="geometry.width" :height="artwork.height">
								<path :d="artwork.outline" fill="white"/>
								<circle :cx="geometry.width / 2" cy="3.5" r="1.4" fill="black"/>
							</mask>
							<mask :id="`${id}-band`" maskUnits="userSpaceOnUse" x="0" y="0" :width="geometry.width" :height="artwork.height">
								<path :d="artwork.outline" fill="white"/>
								<path :d="artwork.outline" fill="black" stroke="white" stroke-width="5" stroke-linejoin="round"/>
								<circle :cx="geometry.width / 2" cy="3.5" r="2.2" fill="black"/>
							</mask>
							<pattern :id="`${id}-pattern`" width="8" height="8" patternUnits="userSpaceOnUse">
								<circle v-if="charm.pattern === 'dots'" cx="2" cy="2" r=".85" fill="var(--note-charm-color)"/>
								<path v-else-if="charm.pattern === 'stripes'" d="M -2 2 L 2 -2 M 0 8 L 8 0 M 6 10 L 10 6" stroke="var(--note-charm-color)" stroke-width="1.4" opacity=".8"/>
								<g v-else-if="charm.pattern === 'check'" fill="var(--note-charm-color)" opacity=".65">
									<rect x="0" y="0" width="4" height="4"/>
									<rect x="4" y="4" width="4" height="4"/>
								</g>
							</pattern>
						</defs>
						<g v-if="charm.pattern !== 'cutout'">
							<path :d="artwork.outline" fill="var(--charm-glass)" :mask="`url(#${id}-plate)`"/>
							<path :d="artwork.outline" :fill="`url(#${id}-pattern)`" :mask="`url(#${id}-band)`" opacity=".6" data-note-charm-pattern/>
							<path :class="$style.plateEdge" :d="artwork.outline"/>
							<path :class="$style.highlight" :d="artwork.highlight"/>
						</g>
						<path v-else :class="$style.tab" :d="artwork.tab" :mask="`url(#${id}-plate)`"/>
						<circle :class="$style.plateHole" :cx="geometry.width / 2" cy="3.5" r="1.45" data-note-charm-plate-hole/>
					</svg>
					<img v-if="imageUrl" :class="$style.image" :src="imageUrl" alt="" :width="artwork.image.width" :height="artwork.image.height" :style="imageStyle" loading="lazy" decoding="async" :draggable="false">
				</button>
			</div>
		</div>
	</div>
</Teleport>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type { NoteCharm } from '@/utility/note-charm-physics.js';
import { CHARM_COMPACT_MAX_SIZE, CHARM_DEFAULT_SIZE, CHARM_MAX_SIZE, CHARM_MIN_SIZE, clampCharm } from '@/utility/note-charm-physics.js';
import { createCharmArtwork, loadCharmArtwork } from '@/utility/note-charm-artwork.js';
import { acquireNoteCharmImage } from '@/utility/note-charm-image-cache.js';
import { useNoteCharm } from '@/composables/use-note-charm.js';
import { getStaticImageUrl } from '@/utility/media-proxy.js';
import { genId } from '@/utility/id.js';
import { i18n } from '@/i18n.js';
import { useNoteCharmMobileDisplay } from '@/utility/note-charm-device.js';

const props = withDefaults(defineProps<{
	charm: NoteCharm;
	motion?: boolean;
	wind?: boolean;
	interactive?: boolean;
	compact?: boolean;
}>(), { motion: true, wind: true, interactive: true, compact: false });

const id = `note-charm-${genId()}`;
const mobileDisplay = useNoteCharmMobileDisplay();
const supportedDevice = computed(() => !mobileDisplay.value);
const source = ref<HTMLElement | null>(null);
const rail = ref<HTMLElement | null>(null);
const pendulum = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
const requestedSize = computed(() => clampCharm(Number.isFinite(props.charm.size) ? props.charm.size : CHARM_DEFAULT_SIZE, CHARM_MIN_SIZE, props.compact ? CHARM_COMPACT_MAX_SIZE : CHARM_MAX_SIZE));
const artwork = shallowRef(createCharmArtwork(requestedSize.value, props.charm.pattern));
const { pose, geometry, portalStyle, layerStyle, portalInert, held, near, canMove, pointerDown, pointerMove, pointerEnd, click, keydown, blur, reset } = useNoteCharm({
	source, rail, pendulum, button,
	motion: () => props.motion,
	wind: () => props.wind,
	interactive: () => props.interactive,
	size: () => requestedSize.value,
	artworkHeight: () => artwork.value.height,
});
const rootStyle = computed(() => ({
	...portalStyle.value,
	width: `${geometry.value.railWidth}px`,
	height: `${geometry.value.height}px`,
	'--note-charm-color': /^#[0-9a-f]{6}$/i.test(props.charm.color) ? props.charm.color : '#6ba5e3',
}) as CSSProperties);
const imageStyle = computed(() => ({
	left: `${artwork.value.image.x}px`, top: `${artwork.value.image.y}px`,
	width: `${artwork.value.image.width}px`, height: `${artwork.value.image.height}px`,
}));
// Resolve the static variant before obtaining a blob URL: proxies cannot read blobs.
const sourceImageUrl = computed(() => /^(?:blob:|data:)/.test(props.charm.url) || canMove.value ? props.charm.url : getStaticImageUrl(props.charm.url));
const imageUrl = ref<string>();
let displayedSource = '';
let artworkKey = '';
watch([sourceImageUrl, () => geometry.value.width, () => props.charm.pattern === 'cutout', () => supportedDevice.value && layerStyle.value.visibility === 'visible'], async ([url, width, cutout, visible], _previous, onCleanup) => {
	let disposed = false;
	let decoding = false;
	let image: Awaited<ReturnType<typeof acquireNoteCharmImage>> | undefined;

	function releaseImage() {
		if (!image || decoding) return;
		const previous = image;
		image = undefined;
		// Wait for Vue to remove the previous <img> before its last lease is released.
		void nextTick().then(() => previous.release());
	}

	onCleanup(() => { disposed = true; releaseImage(); });
	const pattern = props.charm.pattern;
	const key = JSON.stringify([props.charm.url, width, cutout]);
	if (key !== artworkKey) {
		artworkKey = key;
		reset();
		artwork.value = createCharmArtwork(width, pattern);
	}
	if (!visible || displayedSource !== url) imageUrl.value = undefined;
	// Offscreen notes do not acquire image bytes or inspect alpha.
	if (!visible) return;
	image = await acquireNoteCharmImage(url);
	if (disposed) { releaseImage(); return; }
	displayedSource = url;
	imageUrl.value = image.url;
	decoding = true;
	try {
		// Rendering and alpha analysis share the same cached image bytes.
		const next = await loadCharmArtwork(image.url, width, pattern);
		if (!disposed) artwork.value = next;
	} finally {
		decoding = false;
		if (disposed) releaseImage();
	}
}, { immediate: true });
</script>

<style lang="scss" module>
.source {
	position: absolute;
	top: 0;
	left: 0;
	width: var(--note-charm-effective, var(--note-charm-fallback-size));
	height: 0;
	pointer-events: none;
}

.layer {
	position: fixed;
	left: 0;
	right: 0;
	overflow: hidden;
	pointer-events: none;
}

.rail {
	--charm-metal: light-dark(#7d8a9b, #a7aebd);
	--charm-shine: light-dark(#f9fcff, #e3e7f1);
	--charm-edge: light-dark(#a4b2bf, #aab8cf80);
	--charm-glass: light-dark(#e8f1f322, #e3edf60b);
	--charm-shadow: light-dark(#2333481c, #0000002b);
	position: absolute;
	left: var(--note-charm-left);
	top: var(--note-charm-top, 32px);
	z-index: 2;
	pointer-events: none;
	isolation: isolate;
	transform-origin: 0 0;
	transition: opacity .16s ease;

	&[data-near=true] { opacity: .2; }
	&[data-held=true], &:focus-within { opacity: 1; }
	&[data-motion=false] { transition: none; }
}

.hardware, .plate {
	position: absolute;
	inset: 0;
	overflow: visible;
	pointer-events: none;
}

.punch { fill: color-mix(in srgb, var(--MI_THEME-fg) 8%, var(--MI_THEME-bg)); }
.noteRing { fill: none; stroke: color-mix(in srgb, var(--charm-metal) 72%, var(--MI_THEME-panel)); stroke-width: .75; stroke-linecap: round; }
.chainPath { fill: none; stroke: var(--charm-metal); stroke-width: .85; stroke-linecap: round; }
.ball { fill: var(--charm-shine); stroke: var(--charm-metal); stroke-width: .45; }
.jumpRing { fill: none; stroke: var(--charm-metal); stroke-width: .9; }
.plateEdge { fill: none; stroke: color-mix(in srgb, var(--note-charm-color) 25%, var(--charm-edge)); stroke-width: .85; }
.highlight { fill: none; stroke: var(--charm-shine); stroke-width: .65; opacity: .55; stroke-linecap: round; }
.tab { fill: var(--charm-glass); stroke: var(--charm-edge); stroke-width: .8; }
.plateHole { fill: none; stroke: var(--charm-edge); stroke-width: .8; }

.pendulum {
	position: absolute;
	left: 0;
	top: 0;
	transform-origin: 50% 0;
}

.grip {
	display: block;
	position: relative;
	min-width: 44px;
	min-height: 44px;
	padding: 0;
	margin: 0;
	border: 0;
	border-radius: 5px;
	background: transparent;
	color: var(--MI_THEME-fg);
	filter: drop-shadow(0 1.5px 1.2px var(--charm-shadow));
	pointer-events: auto;
	touch-action: none;
	user-select: none;
	-webkit-touch-callout: none;
	cursor: grab;

	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 4px; }
	&:disabled { cursor: default; pointer-events: none; }
}

.rail[data-held=true] .grip { cursor: grabbing; filter: drop-shadow(0 3px 2px var(--charm-shadow)); }
.image { position: absolute; display: block; object-fit: contain; pointer-events: none; user-select: none; }
.grip[data-cutout=true] .image { filter: drop-shadow(0 .5px .6px var(--charm-edge)); }

@media (prefers-reduced-motion: reduce) {
	.rail { transition: none; }
}
</style>
