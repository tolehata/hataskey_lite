<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal
	ref="modal"
	v-slot="{ maxHeight }"
	class="hatask-flower-detail-modal"
	:data-flower-motion="goesMotion || animations ? 'on' : 'off'"
	:data-hatagoes="goesMotion"
	preferType="popup"
	zPriority="high"
	:anchorElement="source"
	:noOverlap="false"
	:transparentBg="true"
	:disableBgBlur="true"
	:returnFocusTo="returnFocusTo"
	@click="close"
	@esc="dismissWithEscape"
	@opened="onOpened"
	@closed="onClosed"
>
	<section
		ref="panel"
		:class="$style.panel"
		:style="[themeStyle, { '--detail-max-height': maxHeight == null ? 'calc(100dvh - 32px)' : `${Math.max(100, maxHeight - 8)}px`, '--detail-arrow-x': `${arrowX}px` }]"
		:data-theme="theme"
		:data-mode="mode"
		:data-side="side"
		role="dialog"
		aria-modal="true"
		:aria-labelledby="titleId"
		:data-flower-id="flower.id"
		@keydown.stop
		@keydown.esc.stop.prevent="close"
	>
		<button ref="closeButton" type="button" :class="$style.close" :aria-label="labels.close" :disabled="closing" data-flower-detail-action="close" @click="close"><i class="ti ti-x" aria-hidden="true"></i></button>
		<div :class="$style.content">
			<div :class="$style.art"><HataskEmoji :emoji="flower.emoji" :class="$style.emoji"/><span v-if="flower.rare" :class="$style.rare"><i class="ti ti-sparkles" aria-hidden="true"></i>{{ labels.rare }}</span></div>
			<h2 :id="titleId">{{ flower.name }}</h2>
			<p v-if="flower.variety" :class="$style.variety">{{ flower.variety }}</p>
			<div v-if="flower.user" :class="$style.owner"><MkAvatar :user="flower.user" :class="$style.avatar" :link="false" :preview="false" :forceShowDecoration="true" :aria-label="labels.owner"/><span><MkUserName :user="flower.user" :nowrap="false"/></span></div>
			<dl :class="$style.facts"><div v-if="flower.hanakotoba"><dt>{{ labels.meaning }}</dt><dd>{{ flower.hanakotoba }}</dd></div><div><dt>{{ labels.harvested }}</dt><dd><time :datetime="flower.harvestedAt">{{ flower.dateLabel }}</time></dd></div></dl>
		</div>
		<footer :class="$style.actions"><button type="button" :disabled="closing" data-flower-detail-action="primary" @click="chooseAction"><i :class="flower.isOwner ? 'ti ti-pencil' : 'ti ti-flag'" aria-hidden="true"></i>{{ flower.isOwner ? labels.rename : labels.report }}</button></footer>
	</section>
</MkModal>
</template>

<script lang="ts" setup>
import { inject, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import type { HataskFlowerView } from './hatask-flower-view.js';
import HataskEmoji from '@/components/HataskEmoji.vue';
import MkModal from '@/components/MkModal.vue';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';

export type HataskFlowerDetailLabels = {
	close: string;
	meaning: string;
	harvested: string;
	rename: string;
	report: string;
	rare: string;
	owner: string;
};

const goesMotion = !!inject(HATA_GOES_HOST, null);
const props = withDefaults(defineProps<{
	flower: HataskFlowerView;
	source: HTMLElement;
	returnFocusTo: HTMLElement | null;
	theme: string;
	mode: 'light' | 'dark';
	animations: boolean;
	labels: HataskFlowerDetailLabels;
	isOpen?: boolean;
}>(), { isOpen: true });
const emit = defineEmits<{ closed: []; action: [] }>();
const modal = useTemplateRef('modal');
const panel = useTemplateRef('panel');
const closeButton = useTemplateRef('closeButton');
const titleId = `hatask-flower-detail-${useId()}`;
const themeStyle = ref<Record<string, string>>({});
const closing = ref(false);
const side = ref<'above' | 'below' | 'overlap'>('below');
const arrowX = ref(150);
let pendingAction = false;
let disposed = false;
let didClose = false;
let sourceBounds: DOMRect | null = null;
let resizeObserver: ResizeObserver | null = null;
let sourceObserver: MutationObserver | null = null;

// os.popup renders outside Hatask. Copy only the values this small panel needs.
const inheritedTokens = ['--bg', '--surface', '--masthead', '--fg', '--fg-2', '--rule', '--accent', '--accent-ink', '--on-accent', '--card-radius', '--card-border', '--htk-font-body', '--htk-font-head', '--htk-fallback', '--shadow'] as const;

function inheritTheme(): void {
	const style = window.getComputedStyle(props.source);
	const values: Record<string, string> = { fontFamily: style.fontFamily };
	for (const token of inheritedTokens) {
		const value = style.getPropertyValue(token).trim();
		if (value) values[token] = value;
	}
	themeStyle.value = values;
}

function updateArrow(): void {
	if (closing.value || !panel.value) return;
	const anchor = props.source.getBoundingClientRect();
	const popup = panel.value.getBoundingClientRect();
	arrowX.value = Math.max(20, Math.min(popup.width - 20, anchor.left + anchor.width / 2 - popup.left));
	side.value = popup.bottom <= anchor.top + 1 ? 'above' : popup.top >= anchor.bottom - 1 ? 'below' : 'overlap';
}

function close(): void {
	if (closing.value || disposed) return;
	closing.value = true;
	modal.value?.close();
}

function dismissWithEscape(event: KeyboardEvent): void {
	event.preventDefault();
	event.stopPropagation();
	close();
}

function chooseAction(): void {
	if (closing.value) return;
	pendingAction = true;
	close();
}

function onClosed(): void {
	if (didClose) return;
	didClose = true;
	// MkModal has released its focus trap and restored the opener before this event.
	// A new rename/report dialog may now safely take focus.
	emit('closed');
	if (pendingAction) emit('action');
}

function onViewportChange(event: Event): void {
	if (event.type === 'scroll' && event.target instanceof Node && panel.value?.contains(event.target)) return;
	if (event.type === 'scroll' && props.source.isConnected && sourceBounds) {
		const current = props.source.getBoundingClientRect();
		// A queued scroll from the stopped rail, or another rail, did not move this anchor.
		if (current.left === sourceBounds.left && current.top === sourceBounds.top && current.right === sourceBounds.right && current.bottom === sourceBounds.bottom) return;
	}
	close();
}

function onOpened(): void {
	if (closing.value || disposed) return;
	updateArrow();
	// MkModal aligns on nextTick. A queued rail scroll while that layout settles
	// must not dismiss the detail before it has finished opening.
	sourceBounds = props.source.getBoundingClientRect();
	window.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
	window.addEventListener('resize', onViewportChange, { passive: true });
	window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
	window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true });
	closeButton.value?.focus({ preventScroll: true });
}

onMounted(() => {
	inheritTheme();
	if (!props.isOpen || !props.source.isConnected) {
		close();
		return;
	}
	resizeObserver = new ResizeObserver(() => { void nextTick(updateArrow); });
	if (panel.value) resizeObserver.observe(panel.value);
	// An owner can remove/rebuild the stream during loading or a page switch.
	sourceObserver = new MutationObserver(() => { if (!props.source.isConnected) close(); });
	const host = props.source.closest('[data-hatask-flower-stream]') ?? props.source.parentElement;
	if (host) sourceObserver.observe(host, { childList: true, subtree: true });
});
watch(() => props.isOpen, open => { if (!open) close(); });
watch(() => props.source, () => close());
watch([() => props.theme, () => props.mode], () => { inheritTheme(); });
onBeforeUnmount(() => {
	disposed = true;
	resizeObserver?.disconnect();
	sourceObserver?.disconnect();
	window.removeEventListener('scroll', onViewportChange, true);
	window.removeEventListener('resize', onViewportChange);
	window.visualViewport?.removeEventListener('resize', onViewportChange);
	window.visualViewport?.removeEventListener('scroll', onViewportChange);
});
defineExpose({ close });
</script>

<style lang="scss" module>
.panel {
	--detail-surface: var(--masthead, var(--surface, var(--MI_THEME-panel)));
	position: relative;
	box-sizing: border-box;
	width: min(300px, calc(100dvw - 32px));
	max-height: min(var(--detail-max-height), calc(100dvh - 32px));
	padding: 17px;
	border: 1px solid var(--rule, var(--MI_THEME-divider));
	border-radius: min(var(--card-radius, 19px), 19px);
	color: var(--fg, var(--MI_THEME-fg));
	background: linear-gradient(var(--detail-surface), var(--detail-surface)), var(--bg, var(--MI_THEME-bg));
	box-shadow: 0 14px 40px #0003;
	font: 13px/1.6 var(--htk-font-body, inherit);
	line-break: strict;
	overflow-wrap: anywhere;
	caret-color: transparent;
}
.panel::before { content: ''; position: absolute; left: var(--detail-arrow-x); width: 11px; height: 11px; border: 1px solid var(--rule, var(--MI_THEME-divider)); background: linear-gradient(var(--detail-surface), var(--detail-surface)), var(--bg, var(--MI_THEME-bg)); transform: translateX(-50%) rotate(45deg); pointer-events: none; }
.panel[data-side='above']::before { bottom: -6px; border-top: 0; border-left: 0; }
.panel[data-side='below']::before { top: -6px; border-bottom: 0; border-right: 0; }
.panel[data-side='overlap']::before { display: none; }
.panel ::selection { color: var(--on-accent, var(--MI_THEME-fgOnAccent)); background: var(--accent-ink, var(--accent, var(--MI_THEME-accent))); }
.panel button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; box-sizing: border-box; border: 1px solid var(--rule, var(--MI_THEME-divider)); border-radius: min(var(--card-radius, 11px), 11px); padding: 8px 12px; color: var(--fg, var(--MI_THEME-fg)); background: transparent; font: inherit; cursor: pointer; touch-action: manipulation; }
.panel button:hover:not(:disabled) { background: color-mix(in srgb, var(--accent, var(--MI_THEME-accent)) 8%, transparent); }
.panel button:focus-visible { outline: 3px solid var(--accent-ink, var(--accent, var(--MI_THEME-accent))); outline-offset: 3px; }
.panel button:disabled { opacity: .5; cursor: default; }
.panel .close { position: absolute; z-index: 1; top: 3px; right: 3px; width: 44px; padding: 0; border: 0; border-radius: 50%; font-size: 19px; }
.content { max-height: max(0px, min(calc(var(--detail-max-height) - 93px), calc(100dvh - 125px))); overflow-y: auto; overscroll-behavior: contain; }
.art { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding-right: 28px; }
.emoji { flex: 0 0 61px; width: 61px; height: 61px; }
.rare { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border: 1px solid color-mix(in srgb, #b38836 50%, transparent); border-radius: 999px; color: #866012; font-size: 12px; }
.panel[data-mode='dark'] .rare { color: #ffe1a1; }
.panel h2 { margin: 0; padding-right: 18px; color: var(--fg, var(--MI_THEME-fg)); font: 700 17px/1.45 var(--htk-font-head, inherit); }
.variety { margin: 3px 0 0; color: var(--fg-2, var(--MI_THEME-fgMuted)); font-size: 12px; }
.owner { display: flex; align-items: center; gap: 11px; min-height: 34px; margin-top: 13px; padding-inline: 4px; }
.avatar { flex: 0 0 31px; width: 31px; height: 31px; overflow: visible; }
.owner > span { min-width: 0; }
.facts { display: grid; gap: 7px; margin: 13px 0 2px; font-size: 12px; }
.facts > div { display: grid; grid-template-columns: minmax(42px, max-content) minmax(0, 1fr); gap: 10px; }
.facts dt { color: var(--fg-2, var(--MI_THEME-fgMuted)); }
.facts dd { min-width: 0; margin: 0; }
.actions { margin-top: 13px; }
.actions > button { width: 100%; font-size: 12px; }
</style>

<style lang="scss">
.hatask-flower-detail-modal[data-flower-motion='off'] > * { transition: none !important; animation: none !important; transform: none !important; opacity: 1 !important; }
.hatask-flower-detail-modal[data-flower-motion='off'] * { animation: none !important; }
@media (prefers-reduced-motion: reduce) {
	.hatask-flower-detail-modal:not([data-hatagoes='true']) > * { transition: none !important; animation: none !important; transform: none !important; opacity: 1 !important; }
	.hatask-flower-detail-modal:not([data-hatagoes='true']) * { animation: none !important; }
}
</style>
