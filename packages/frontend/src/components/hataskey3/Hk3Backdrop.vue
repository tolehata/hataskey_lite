<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.root" :data-motion="motion" aria-hidden="true" inert>
	<img
		v-if="selection"
		:key="selection.key"
		ref="imageEl"
		:class="[$style.image, { [$style.avatar]: selection.kind === 'avatar' }]"
		:src="selection.url"
		:data-request="selection.key"
		:data-loaded="loaded"
		alt=""
		:draggable="false"
		@load="onLoad"
		@error="onError"
	/>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
	bannerUrl?: string | null;
	avatarUrl?: string | null;
	motion?: boolean;
}>(), { motion: true });

const imageEl = ref<HTMLImageElement | null>(null);
const generation = ref(0);
const bannerFailed = ref(false);
const avatarFailed = ref(false);
const loaded = ref(false);
const selection = computed(() => {
	const kind = props.bannerUrl && !bannerFailed.value ? 'banner' : 'avatar';
	const url = kind === 'banner' ? props.bannerUrl : !avatarFailed.value ? props.avatarUrl : null;
	return url ? { kind, url, key: `${generation.value}:${kind}` } : null;
});

watch(() => [props.bannerUrl, props.avatarUrl], () => {
	generation.value++;
	bannerFailed.value = false;
	avatarFailed.value = false;
	loaded.value = false;
}, { flush: 'sync' });

function currentImage(event: Event): HTMLImageElement | null {
	const image = event.currentTarget as HTMLImageElement | null;
	return image && image === imageEl.value &&
		image.getAttribute('src') === selection.value?.url &&
		image.dataset.request === selection.value?.key ? image : null;
}

function onLoad(event: Event): void {
	if (currentImage(event)) loaded.value = true;
}

function onError(event: Event): void {
	const image = currentImage(event);
	if (!image) return;
	// Hide immediately, including a previously loaded image, before Vue replaces it.
	image.style.visibility = 'hidden';
	loaded.value = false;
	if (selection.value?.kind === 'banner') bannerFailed.value = true;
	else avatarFailed.value = true;
}
</script>

<style module>
.root {
	position: absolute;
	inset: 0;
	z-index: -1;
	overflow: hidden;
	pointer-events: none;
	background: var(--hk3-bg, var(--MI_THEME-bg));
}

.root::after {
	content: '';
	position: absolute;
	inset: 0;
	background: color-mix(in srgb, var(--hk3-bg, var(--MI_THEME-bg)) 38%, transparent);
}

.image {
	position: absolute;
	inset: -64px;
	width: calc(100% + 128px);
	height: calc(100% + 128px);
	object-fit: cover;
	filter: blur(28px) saturate(1.15);
	opacity: 0;
	transition: opacity 400ms ease;
}

.avatar {
	filter: blur(64px) saturate(1.25);
}

.image[data-loaded='true'] {
	opacity: 1;
}

.root[data-motion='false'] .image {
	transition: none;
}

@media (prefers-reduced-motion: reduce) {
	.image {
		transition: none;
	}
}
</style>
