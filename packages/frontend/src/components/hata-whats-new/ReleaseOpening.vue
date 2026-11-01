<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.opening" data-release-opening aria-hidden="true" inert>
	<div ref="surface" :class="$style.surface" data-opening-surface></div>
	<div :class="$style.wordStage"><span ref="word" :class="$style.word" data-opening-word>Introduce</span></div>
</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { createReveal, REVEAL_EASE } from './reveal.js';

const props = defineProps<{ motion: boolean }>();
const surface = ref<HTMLElement | null>(null);
const word = ref<HTMLElement | null>(null);
const reveal = createReveal();

function play() {
	return reveal.play([
		{
			element: surface.value, duration: 2200, easing: 'linear',
			frames: [
				{ offset: 0, opacity: 0, clipPath: 'inset(42% 18% round 64px)', easing: REVEAL_EASE },
				{ offset: .18, opacity: 1, clipPath: 'inset(42% 18% round 64px)' },
				{ offset: .52, opacity: 1, clipPath: 'inset(42% 18% round 64px)', easing: REVEAL_EASE },
				{ offset: 1, opacity: 1, clipPath: 'inset(0% 0% round 0px)' },
			],
		},
		{
			element: word.value, duration: 2200, easing: 'linear',
			frames: [
				{ offset: 0, opacity: 0, transform: 'scale(.72)', letterSpacing: '-.065em', filter: 'blur(10px)', easing: REVEAL_EASE },
				{ offset: .18, opacity: 1, transform: 'scale(1)', letterSpacing: '-.04em', filter: 'blur(0px)' },
				{ offset: .64, opacity: 1, transform: 'scale(1)', letterSpacing: '-.04em', filter: 'blur(0px)', easing: REVEAL_EASE },
				{ offset: 1, opacity: 0, transform: 'scale(1.65)', letterSpacing: '.14em', filter: 'blur(12px)' },
			],
		},
	], props.motion);
}

function cancel() { reveal.cancel(); }

watch(() => props.motion, enabled => { if (!enabled) cancel(); });
onBeforeUnmount(cancel);
defineExpose({ play, cancel });
</script>

<style module>
.opening { position: absolute; inset: 0; z-index: 1; overflow: clip; pointer-events: none; border-radius: inherit; }
.surface { position: absolute; inset: 0; border: 1px solid var(--MI_THEME-divider); border-radius: inherit; background: var(--MI_THEME-panel); opacity: 0; }
.wordStage { position: absolute; inset: 0; display: grid; place-items: center; }
.word { display: block; font: 400 clamp(42px, 10cqw, 100px)/1.15 Righteous, sans-serif; letter-spacing: -.04em; white-space: nowrap; color: var(--MI_THEME-accent); opacity: 0; transform-origin: center; }
/* Keep the final layout measurable while its surface opens from the word. */
:global([data-release-opening-shell]) { position: relative; transition: box-shadow .36s ease; }
:global([data-release-opening-shell][data-opening='true']) { border-color: transparent; background: transparent; box-shadow: none; }
:global([data-release-opening-shell][data-opening='true'] > header) { visibility: hidden; opacity: 0; border-bottom-color: transparent; }
:global([data-release-opening-shell][data-opening='true'] > footer) { opacity: 0; }
:global([data-release-opening-shell][data-motion='false']) { transition: none; }
@media (prefers-reduced-motion: reduce) {
	:global([data-release-opening-shell]) { transition: none; }
}
</style>
