<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template><span ref="host" :class="$style.window" aria-hidden="true"><span ref="current">{{ value }}</span></span></template>
<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue';
import { prefer } from '@/preferences.js';
const props = defineProps<{ value: number }>();
const host = useTemplateRef('host');
const current = useTemplateRef('current');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let animations: Animation[] = [];
let outgoing: HTMLElement | null = null;

function clear() { animations.splice(0).forEach(a => a.cancel()); outgoing?.remove(); outgoing = null; }

watch(() => props.value, (value, previous) => {
	const element = current.value;
	if (!element || !host.value) return;
	const style = getComputedStyle(element);
	const transform = style.transform, opacity = style.opacity;
	clear();
	if (value === previous || !prefer.r.animation.value || motionQuery.matches || window.document.hidden || !host.value.getClientRects().length) return;
	const old = element.cloneNode(false) as HTMLElement;
	old.textContent = String(previous);
	old.style.cssText = 'position:absolute;inset:0;';
	outgoing = old;
	host.value.append(old);
	const direction = value > previous ? 1 : -1;
	const timing = { duration: 280, easing: 'cubic-bezier(.22,.61,.36,1)' };
	animations = [
		old.animate([{ transform, opacity }, { transform: `translateY(${-direction * 100}%)`, opacity: 0 }], { ...timing, fill: 'forwards' }),
		element.animate([{ transform: `translateY(${direction * 100}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], timing),
	];
	const active = animations;
	Promise.all(active.map(a => a.finished)).then(() => { if (animations === active) clear(); }).catch(() => {});
}, { flush: 'post' });
watch(prefer.r.animation, clear);
const hidden = () => { if (window.document.hidden) clear(); };
onMounted(() => { motionQuery.addEventListener('change', clear); window.document.addEventListener('visibilitychange', hidden); });
onUnmounted(() => { clear(); motionQuery.removeEventListener('change', clear); window.document.removeEventListener('visibilitychange', hidden); });
</script>
<style lang="scss" module>
.window { display: inline-block; position: relative; overflow: hidden; width: 2ch; height: 1.5em; line-height: 1.5em; text-align: right; vertical-align: bottom; font-variant-numeric: tabular-nums; > span { display: block; } }
</style>
