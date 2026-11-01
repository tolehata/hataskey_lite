<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	ref="root"
	:class="[$style.root, highlighted ? $style.highlighted : undefined, highlightFading ? $style.highlightFading : undefined]"
	:data-in-app-search-marker-id="markerId"
	:data-motion-enabled="motionEnabled ? 'true' : 'false'"
	:tabindex="markerId != null ? -1 : undefined"
>
	<slot :isParentOfTarget="isParentOfTarget"></slot>
	<Transition :name="motionEnabled ? 'settings-related' : ''">
		<SettingsRelatedLinks
			v-if="relatedItems.length > 0"
			:items="relatedItems"
			@select="navigateToRelatedSetting"
		/>
	</Transition>
</div>
</template>

<script lang="ts" setup>
import {
	onActivated,
	onDeactivated,
	onMounted,
	onUnmounted,
	onBeforeUnmount,
	watch,
	computed,
	nextTick,
	ref,
	useTemplateRef,
	inject,
} from 'vue';
import type { Ref } from 'vue';
import type { SettingsCatalogV2 } from '@/utility/settings-search-v2.js';
import type { SettingsRelatedLink } from '@/pages/settings-redesign/SettingsRelatedLinks.vue';
import type { SettingsSearchV2Context } from '@/utility/settings-search-v2-context.js';
import { DI } from '@/di.js';
import { prefer } from '@/preferences.js';
import { useRouter } from '@/router.js';
import { getRelatedSettingsV2 } from '@/utility/settings-search-v2.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import SettingsRelatedLinks from '@/pages/settings-redesign/SettingsRelatedLinks.vue';

const props = defineProps<{
	markerId?: string;
	label?: string;
	icon?: string;
	keywords?: string[];
	children?: string[];
	inlining?: string[];
}>();

const rootEl = useTemplateRef('root');
const rootElMutationObserver = new MutationObserver(() => {
	checkChildren();
});
let listenersRegistered = false;
let observerRegistered = false;
let markerActive = false;
let activationSynchronizing = false;
let activationRevision = 0;
const router = useRouter();
const injectedSearchMarkerId = inject(DI.inAppSearchMarkerId, null);
const settingsSearchContext = inject(settingsSearchV2ContextKey, null);
const locationHash = ref(window.location.hash.slice(1));
const prefersReducedMotion = ref(false);
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const searchMarkerId = computed(() => {
	const current = router.currentRef.value;
	const hash = current == null ? locationHash.value : router.getCurrentFullPath().split('#')[1] ?? locationHash.value;
	return injectedSearchMarkerId?.value ?? hash;
});
const highlighted = ref(false);
const isParentOfTarget = computed(() => props.children?.includes(searchMarkerId.value));
const motionEnabled = computed(() => prefer.r.animation?.value !== false && !prefersReducedMotion.value);
const descriptor = computed(() => props.markerId == null ? null : settingsSearchContext?.catalog.value?.byLegacyId.get(props.markerId) ?? null);

function hasSettingsCatalog(context: SettingsSearchV2Context | null): context is SettingsSearchV2Context & { catalog: Readonly<Ref<SettingsCatalogV2>> } {
	return context?.catalog.value != null;
}

const relatedItems = computed<SettingsRelatedLink[]>(() => {
	const catalog = settingsSearchContext?.catalog.value;
	if (settingsSearchContext == null || !hasSettingsCatalog(settingsSearchContext) || catalog == null || descriptor.value == null) return [];
	if (settingsSearchContext.inlineRelated === false) return [];
	// The redesigned control inventory already provides granular related links.
	// Do not repeat a marker-level group beneath the controls it contains.
	if (catalog.descriptors.some(item => item.source === 'control' && (
		item.legacyMarkerParentId === props.markerId || item.legacyMarkerAncestorIds?.includes(props.markerId ?? '')
	))) return [];
	const relationReasons = new Map(descriptor.value.related.map(relation => [relation.stableId, relation.reason]));
	// Pass the complete meaningful relation set through to the shared renderer.
	// It owns the initial three-item limit and exposes the remaining candidates
	// without making legacy-only markers silently lose related settings.
	return getRelatedSettingsV2(settingsSearchContext.catalog.value, descriptor.value.stableId, Number.MAX_SAFE_INTEGER).map(related => ({
		stableId: related.stableId,
		route: related.route,
		anchor: related.anchor,
		controlId: related.controlId,
		...(related.activation ? { activation: related.activation } : {}),
		label: related.label,
		reason: relationReasons.get(related.stableId),
	}));
});

function updateLocationHash() {
	locationHash.value = window.location.hash.slice(1);
}

function updateReducedMotion() {
	prefersReducedMotion.value = reducedMotionQuery.matches;
}

function updateHighlight() {
	if (!markerActive) return;
	highlighted.value = props.markerId != null && props.markerId === searchMarkerId.value;
	checkChildren();
}

function checkChildren() {
	if (!markerActive) return;
	if (isParentOfTarget.value) {
		const el = findMarkerElement(searchMarkerId.value);
		highlighted.value = el == null;
	}
}

function findMarkerElement(markerId: string) {
	return Array.from(window.document.querySelectorAll<HTMLElement>('[data-in-app-search-marker-id]'))
		.find(element => element.dataset.inAppSearchMarkerId === markerId) ?? null;
}

/**
 * 旗鯖fork: 強調表示は「どこへ着いたか」を伝えるための一時的なもの。
 * ⚠️出したままにすると、その設定がずっと選択中のように見えてしまう。
 * 点滅（blink 1s ×3.5）が終わるのに合わせて降ろす。
 * ⚠️動きを減らす設定では点滅しないので、短めに消す。
 */
const HIGHLIGHT_HOLD_MS = 3600;
const HIGHLIGHT_HOLD_REDUCED_MS = 1600;
let highlightTimer: number | null = null;
const highlightFading = ref(false);

function clearHighlightTimer() {
	if (highlightTimer != null) {
		window.clearTimeout(highlightTimer);
		highlightTimer = null;
	}
	highlightFading.value = false;
}

/** ⚠️薄れきるまでの時間。CSS 側の transition と必ず揃えること。 */
const HIGHLIGHT_FADE_MS = 420;

function scheduleHighlightRelease() {
	clearHighlightTimer();
	highlightFading.value = false;
	if (!highlighted.value) return;
	const hold = motionEnabled.value ? HIGHLIGHT_HOLD_MS : HIGHLIGHT_HOLD_REDUCED_MS;
	highlightTimer = window.setTimeout(() => {
		// ⚠️いきなり外すとブツッと消える。まず薄れさせ、消えきってから外す。
		highlightFading.value = true;
		highlightTimer = window.setTimeout(() => {
			highlightTimer = null;
			highlightFading.value = false;
			highlighted.value = false;
		}, motionEnabled.value ? HIGHLIGHT_FADE_MS : 0);
	}, hold);
}

watch(highlighted, () => scheduleHighlightRelease());

onUnmounted(clearHighlightTimer);

function focusHighlightedMarker() {
	if (!markerActive || !highlighted.value || rootEl.value == null) return;
	rootEl.value.scrollIntoView({
		behavior: motionEnabled.value ? 'smooth' : 'auto',
		block: 'center',
	});
	rootEl.value.focus({ preventScroll: true });
}

watch([
	searchMarkerId,
	() => props.markerId,
	() => props.children,
], async () => {
	if (!markerActive || activationSynchronizing) return;
	updateHighlight();
	await nextTick();
	focusHighlightedMarker();
}, { flush: 'post' });

function init() {
	updateLocationHash();
	updateReducedMotion();
	updateHighlight();

	if (rootEl.value != null && !observerRegistered) {
		rootElMutationObserver.observe(rootEl.value, {
			childList: true,
			subtree: true,
		});
		observerRegistered = true;
	}
}

function dispose() {
	if (!observerRegistered) return;
	rootElMutationObserver.disconnect();
	observerRegistered = false;
}

function registerListeners() {
	if (listenersRegistered) return;
	reducedMotionQuery.addEventListener('change', updateReducedMotion);
	window.addEventListener('hashchange', updateLocationHash);
	listenersRegistered = true;
}

function unregisterListeners() {
	if (!listenersRegistered) return;
	reducedMotionQuery.removeEventListener('change', updateReducedMotion);
	window.removeEventListener('hashchange', updateLocationHash);
	listenersRegistered = false;
}

function activate() {
	if (markerActive) return;
	markerActive = true;
	activationSynchronizing = true;
	const revision = ++activationRevision;
	registerListeners();
	init();
	void nextTick().then(() => {
		if (!markerActive || revision !== activationRevision) return;
		focusHighlightedMarker();
		void nextTick().then(() => {
			if (markerActive && revision === activationRevision) activationSynchronizing = false;
		});
	});
}

function deactivate() {
	markerActive = false;
	activationSynchronizing = false;
	++activationRevision;
	dispose();
	unregisterListeners();
}

function navigateToRelatedSetting(item: SettingsRelatedLink) {
	settingsSearchContext?.navigateToSetting(item);
}

onMounted(() => {
	activate();
});
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(() => {
	deactivate();
});
</script>

<style lang="scss" module>
.root {
	position: relative;
}

.highlighted {
	&::after {
		content: '';
		position: absolute;
		top: -8px;
		left: -8px;
		width: calc(100% + 16px);
		height: calc(100% + 16px);
		border-radius: 6px;
		background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 75%, transparent);
		pointer-events: none;
	}
}

.highlighted[data-motion-enabled='true']::after {
	animation: blink 1s 3.5;
}

/* 旗鯖fork: 消え際。⚠️JS 側の HIGHLIGHT_FADE_MS と揃えること。
   ⚠️animation を切らないと、点滅の指定が transition を上書きしてしまう。 */
.highlightFading::after {
	animation: none !important;
	opacity: 0;
	transform: scale(1.015);
	transition: opacity 420ms ease, transform 420ms ease;
}

@media (prefers-reduced-motion: reduce) {
	.highlightFading::after { transition: none; }
}

@keyframes blink {
	0%, 100% {
		background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 75%, transparent);
	}
	50% {
		background: transparent;
		border: 1px solid transparent;
	}
}

:global(.settings-related-enter-active),
:global(.settings-related-leave-active) {
	transition: opacity 160ms ease, transform 160ms ease;
}

:global(.settings-related-enter-from),
:global(.settings-related-leave-to) {
	opacity: 0;
	transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
	:global(.settings-related-enter-active),
	:global(.settings-related-leave-active) {
		transition: none;
	}
}
</style>
