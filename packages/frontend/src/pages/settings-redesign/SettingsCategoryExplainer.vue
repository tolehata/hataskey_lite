<!-- SPDX-License-Identifier: AGPL-3.0-only -->

<template>
<div v-if="caption" ref="root" :class="$style.root" :data-compact="compact" :data-motion-enabled="motionEnabled" :data-animation-visible="animationVisible" :data-category-explainer="categoryId">
	<svg :class="$style.scene" viewBox="0 0 220 112" aria-hidden="true" focusable="false">
		<foreignObject width="220" height="112">
			<div :class="$style.canvas" :data-scene="categoryId">
				<div v-if="categoryId === 'profile'" :class="$style.center">
					<span :class="$style.avatar"></span>
					<span :class="$style.profileLines"><span :class="$style.bar"></span><span :class="$style.bar"></span></span>
					<span :class="$style.profileLock"><i class="ti ti-lock"></i></span>
				</div>
				<div v-else-if="categoryId === 'privacy' || categoryId === 'access'" :class="$style.center">
					<i v-if="categoryId === 'privacy'" class="ti ti-lock" :class="$style.lock"></i>
					<i v-else class="ti ti-accessible" :class="$style.access"></i>
					<span :class="$style.switch"><span :class="$style.switchKnob"></span></span>
				</div>
				<div v-else-if="categoryId === 'security'" :class="$style.center"><span :class="$style.shield"><i class="ti ti-shield"></i><i class="ti ti-check" :class="$style.shieldCheck"></i></span></div>
				<div v-else-if="categoryId === 'appearance'" :class="$style.theme">
					<span :class="$style.themeLines"><span :class="$style.bar"></span><span :class="$style.bar"></span><span :class="$style.bar"></span></span>
					<i class="ti ti-sun" :class="$style.sun"></i><i class="ti ti-moon" :class="$style.moon"></i>
				</div>
				<div v-else-if="categoryId === 'timeline'" :class="$style.feed">
					<div v-for="index in 4" :key="index" :class="$style.feedRow" :data-new="index === 1"><span :class="$style.rowAvatar"></span><span :class="$style.rowLines"><span :class="$style.bar"></span><span :class="$style.bar"></span></span></div>
				</div>
				<div v-else-if="categoryId === 'post'" :class="$style.compose">
					<span :class="$style.typing"></span>
					<span :class="$style.composeTools"><i class="ti ti-mood-smile"></i><i class="ti ti-hash"></i><span :class="$style.send"><i class="ti ti-send"></i></span></span>
				</div>
				<div v-else-if="categoryId === 'notify'" :class="$style.center"><span :class="$style.bell"><i class="ti ti-bell"></i><span :class="$style.notificationBadge">3</span></span><i class="ti ti-volume" :class="$style.volume"></i></div>
				<div v-else-if="categoryId === 'mute'" :class="$style.muteRows">
					<div v-for="index in 3" :key="index" :class="$style.feedRow" :data-muted="index === 2"><span :class="$style.rowAvatar"></span><span :class="$style.rowLines"><span :class="$style.bar"></span><span :class="$style.bar"></span></span><i v-if="index === 2" class="ti ti-eye-off" :class="$style.hiddenIcon"></i></div>
				</div>
				<div v-else-if="categoryId === 'drive'" :class="$style.upload"><i class="ti ti-cloud" :class="$style.cloud"></i><i class="ti ti-photo" :class="$style.uploadFile"></i></div>
				<div v-else-if="categoryId === 'apps'" :class="$style.apps"><span v-for="(app, index) in apps" :key="app" :class="$style.app" :style="{ '--app-index': index }"><HataAppLogo :app="app" :size="40" :active="motionEnabled && animationVisible"/></span></div>
				<div v-else-if="categoryId === 'data'" :class="$style.center"><i class="ti ti-arrow-down" :class="$style.download"></i><span :class="$style.package"><i class="ti ti-package"></i></span><i class="ti ti-arrow-up" :class="$style.export"></i></div>
				<div v-else-if="categoryId === 'advanced'" :class="$style.sliders"><span v-for="index in 3" :key="index" :class="$style.slider"><span :class="$style.sliderTrack"></span><span :class="$style.sliderKnob" :style="{ '--slider-index': index - 1 }"></span></span></div>
			</div>
		</foreignObject>
	</svg>
	<div :class="$style.text"><span v-if="!compact" :class="$style.eyebrow">{{ copy.categoryExplainerHeading }}</span><span :class="$style.caption">{{ caption }}</span></div>
</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import type { HataApp } from '@/utility/hata-app-brand.js';
import HataAppLogo from '@/components/HataAppLogo.vue';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	categoryId: string;
	motionEnabled: boolean;
	compact?: boolean;
}>(), { compact: false });
const copy = i18n.ts._hata._settingsBento;
const apps: readonly HataApp[] = ['hatagoes', 'hatask', 'hatady', 'hatafeed'];
const captions: Record<string, string> = copy.explainer;
const caption = computed(() => Object.hasOwn(captions, props.categoryId) ? captions[props.categoryId] : undefined);
const root = useTemplateRef('root');
const intersects = ref(true);
const documentVisible = ref(true);
const animationVisible = computed(() => intersects.value && documentVisible.value);
let observer: IntersectionObserver | null = null;

function updateDocumentVisibility(): void {
	documentVisible.value = window.document.visibilityState !== 'hidden';
}

onMounted(() => {
	updateDocumentVisibility();
	window.document.addEventListener('visibilitychange', updateDocumentVisibility);
	if (root.value && typeof IntersectionObserver !== 'undefined') {
		observer = new IntersectionObserver(entries => {
			intersects.value = entries.some(entry => entry.isIntersecting);
		});
		observer.observe(root.value);
	}
});

onBeforeUnmount(() => {
	window.document.removeEventListener('visibilitychange', updateDocumentVisibility);
	observer?.disconnect();
});
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	gap: 16px;
	margin: 16px 0;
	padding: 14px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 22px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
}

.scene { display: block; width: min(220px, 44%); height: auto; flex: none; aspect-ratio: 220 / 112; border-radius: 16px; overflow: hidden; background: var(--MI_THEME-bg); box-shadow: inset 0 0 0 1px var(--MI_THEME-divider); }
.canvas { width: 220px; height: 112px; position: relative; overflow: hidden; color: var(--MI_THEME-accent); }
.text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.eyebrow { color: var(--MI_THEME-accent); font-size: .73em; font-weight: 800; letter-spacing: .06em; }
.caption { font-size: 1em; font-weight: 800; line-height: 1.45; overflow-wrap: anywhere; text-wrap: pretty; }
.root[data-compact='true'] { border: 0; border-radius: 0; background: transparent; gap: 12px; padding: 0; margin: 10px 0 4px; }
.root[data-compact='true'] .scene { width: min(120px, 38%); }
.root[data-compact='true'] .caption { font-size: .83em; font-weight: normal; color: var(--MI_THEME-fgMuted); }
.center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 14px; }
.bar { display: block; height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent); }
.bar:last-child { width: 60%; }
.avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--MI_THEME-accentedBg); flex: none; }
.profileLines { display: flex; flex-direction: column; gap: 6px; width: 80px; }
.profileLock { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; color: var(--MI_THEME-fgOnAccent); background: var(--MI_THEME-accent); animation: pop 4s cubic-bezier(.22, .9, .24, 1) infinite; }
.lock { font-size: 24px; animation: pop 3s cubic-bezier(.22, .9, .24, 1) .3s infinite; }
.access { font-size: 28px; }
.switch { position: relative; width: 30px; height: 18px; border-radius: 999px; flex: none; background: var(--MI_THEME-buttonBg); animation: switchColor 3s cubic-bezier(.22, .9, .24, 1) infinite; }
.switchKnob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--MI_THEME-fgOnAccent); box-shadow: 0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 20%, transparent); animation: switchMove 3s cubic-bezier(.22, .9, .24, 1) infinite; }
.shield { position: relative; display: inline-flex; font-size: 34px; color: var(--MI_THEME-fgMuted); }
.shieldCheck { position: absolute; inset: 0; display: grid; place-items: center; color: var(--MI_THEME-accent); font-size: 16px; animation: pop 3s cubic-bezier(.22, .9, .24, 1) infinite; }
.theme { position: absolute; inset: 0; background: var(--MI_THEME-panel); animation: themeColor 5s cubic-bezier(.22, .9, .24, 1) infinite; }
.themeLines { position: absolute; left: 14px; top: 14px; right: 56px; display: flex; flex-direction: column; gap: 7px; }
.themeLines .bar { background: var(--MI_THEME-fgMuted); width: 90%; }
.themeLines .bar:nth-child(2) { width: 60%; }
.themeLines .bar:last-child { width: 75%; }
.sun, .moon { position: absolute; right: 14px; top: 42px; font-size: 28px; }
.sun { animation: fadeDay 5s cubic-bezier(.22, .9, .24, 1) infinite; }
.moon { opacity: 0; animation: fadeNight 5s cubic-bezier(.22, .9, .24, 1) infinite; }
.feed { position: absolute; inset: 6px 0 0; animation: feed 3s cubic-bezier(.22, .9, .24, 1) infinite; }
.feedRow { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; }
.rowAvatar { width: 16px; height: 16px; flex: none; border-radius: 50%; background: var(--MI_THEME-buttonBg); }
.rowLines { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.rowLines .bar { width: 70%; }
.rowLines .bar:last-child { width: 45%; }
.feedRow[data-new='true'] { background: var(--MI_THEME-accentedBg); animation: newRow 3s cubic-bezier(.22, .9, .24, 1) infinite; }
.feedRow[data-new='true'] .rowAvatar { background: var(--MI_THEME-accent); }
.compose { position: absolute; inset: 14px; border-radius: 12px; background: var(--MI_THEME-panel); box-shadow: inset 0 0 0 1px var(--MI_THEME-divider); padding: 10px; display: flex; flex-direction: column; justify-content: space-between; }
.typing { display: block; height: 8px; width: 78%; border-radius: 999px; background: var(--MI_THEME-fg); opacity: .55; transform-origin: left; animation: type 3.2s cubic-bezier(.22, .9, .24, 1) infinite; }
.composeTools { display: flex; align-items: center; gap: 6px; font-size: 18px; color: var(--MI_THEME-fgMuted); }
.send { display: grid; place-items: center; margin-left: auto; width: 30px; height: 22px; border-radius: 999px; color: var(--MI_THEME-fgOnAccent); background: var(--MI_THEME-accent); font-size: 13px; animation: send 3.2s cubic-bezier(.22, .9, .24, 1) infinite; }
.bell { position: relative; display: inline-block; font-size: 40px; transform-origin: 50% 10%; animation: shake 3s cubic-bezier(.22, .9, .24, 1) infinite; }
.notificationBadge { position: absolute; top: -2px; right: -6px; min-width: 18px; height: 18px; border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: var(--MI_THEME-fg); color: var(--MI_THEME-panel); animation: pop 3s cubic-bezier(.22, .9, .24, 1) infinite; }
.volume { font-size: 26px; color: var(--MI_THEME-fgMuted); }
.muteRows { position: absolute; inset: 14px 0 0; }
.feedRow[data-muted='true'] .rowLines { flex-direction: row; align-items: center; gap: 5px; }
.feedRow[data-muted='true'] .bar { width: 30%; }
.feedRow[data-muted='true'] .bar:last-child { width: 34%; background: var(--MI_THEME-accent); animation: blur 4s cubic-bezier(.22, .9, .24, 1) infinite; }
.hiddenIcon { font-size: 18px; animation: pop 4s cubic-bezier(.22, .9, .24, 1) infinite; }
.upload { position: absolute; inset: 0; display: flex; justify-content: center; padding-top: 10px; }
.cloud { font-size: 44px; color: var(--MI_THEME-fgMuted); }
.uploadFile { position: absolute; left: 98px; top: 52px; font-size: 24px; animation: up 2.6s cubic-bezier(.22, .9, .24, 1) infinite; }
.apps { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; }
.app { display: inline-flex; animation: pop 4s cubic-bezier(.22, .9, .24, 1) calc(var(--app-index) * .2s) infinite; }
.package { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 16px; background: var(--MI_THEME-accentedBg); font-size: 30px; }
.download { color: var(--MI_THEME-fgMuted); font-size: 22px; animation: down 2.4s cubic-bezier(.22, .9, .24, 1) infinite; }
.export { font-size: 22px; animation: up 2.4s cubic-bezier(.22, .9, .24, 1) 1.2s infinite; }
.sliders { position: absolute; inset: 18px 20px; display: flex; flex-direction: column; justify-content: space-around; }
.slider { position: relative; height: 14px; }
.sliderTrack { position: absolute; inset: 5px 0 auto; height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--MI_THEME-fg) 15%, transparent); }
.sliderKnob { position: absolute; left: 8%; top: 0; width: 14px; height: 14px; border-radius: 50%; background: var(--MI_THEME-accent); box-shadow: 0 1px 3px color-mix(in srgb, var(--MI_THEME-fg) 20%, transparent); animation: slide 3.6s ease-in-out calc(var(--slider-index) * .5s) infinite; }

.root[data-animation-visible='false'] .canvas * { animation-play-state: paused !important; }
.root[data-motion-enabled='false'] .canvas * { animation: none !important; }

@keyframes pop { 0%, 15% { transform: scale(0); opacity: 0; } 25% { transform: scale(1.15); opacity: 1; } 32%, 85% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
@keyframes switchColor { 0%, 35%, 95%, 100% { background: var(--MI_THEME-buttonBg); } 45%, 85% { background: var(--MI_THEME-accent); } }
@keyframes switchMove { 0%, 35%, 95%, 100% { transform: none; } 45%, 85% { transform: translateX(12px); } }
@keyframes themeColor { 0%, 40%, 100% { background: var(--MI_THEME-panel); } 50%, 90% { background: var(--MI_THEME-fg); } }
@keyframes fadeDay { 0%, 40%, 100% { opacity: 1; } 50%, 90% { opacity: 0; } }
@keyframes fadeNight { 0%, 40%, 100% { opacity: 0; } 50%, 90% { opacity: 1; } }
@keyframes feed { 0%, 20% { transform: translateY(-30px); } 40%, 100% { transform: translateY(0); } }
@keyframes newRow { 0%, 20% { opacity: 0; } 40%, 100% { opacity: 1; } }
@keyframes type { 0% { transform: scaleX(0); } 60%, 100% { transform: scaleX(1); } }
@keyframes send { 0%, 62%, 78%, 100% { transform: scale(1); } 70% { transform: scale(1.25); } }
@keyframes shake { 0%, 50%, 75%, 100% { transform: rotate(0); } 55% { transform: rotate(16deg); } 60% { transform: rotate(-14deg); } 65% { transform: rotate(10deg); } 70% { transform: rotate(-6deg); } }
@keyframes blur { 0%, 30%, 100% { filter: none; opacity: 1; } 50%, 90% { filter: blur(4px); opacity: .35; } }
@keyframes up { 0% { transform: translateY(34px); opacity: 0; } 20% { opacity: 1; } 70% { transform: translateY(-6px); opacity: 1; } 85%, 100% { transform: translateY(-14px); opacity: 0; } }
@keyframes down { 0% { transform: translateY(-24px); opacity: 0; } 20% { opacity: 1; } 70% { transform: translateY(18px); opacity: 1; } 85%, 100% { transform: translateY(24px); opacity: 0; } }
@keyframes slide { 0%, 100% { left: 8%; } 50% { left: 72%; } }

@media (prefers-reduced-motion: reduce) {
	.canvas * { animation: none !important; }
}
</style>
