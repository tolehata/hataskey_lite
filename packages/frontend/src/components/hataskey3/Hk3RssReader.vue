<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.root" :data-compact="compact ? 'true' : undefined" :data-motion="allowMotion ? 'true' : undefined" @keydown.esc="closeReader()">
	<div :class="$style.bannerSlot">
		<div :class="[$style.banner, interrupted && $style.interrupted, readerOpen && $style.bannerReading]" :inert="interrupted ? true : undefined" :aria-hidden="interrupted ? 'true' : undefined" @mouseenter="hovered = true" @mouseleave="hovered = false" @focusin="focused = true" @focusout="onFocusOut">
			<span v-if="readerOpen">{{ copy.reading }}</span>
			<template v-else-if="article">
				<Rss :size="18" :class="$style.icon" aria-hidden="true"/>
				<span :class="$style.source" :style="{ '--rss-feed-color': article.color || 'currentColor' }">{{ article.source }}</span>
				<div ref="scrollEl" :class="$style.scroll" role="region" tabindex="0" :aria-label="`${article.title || copy.untitled} — ${copy.titleScroll}`" @pointerdown="manualPan" @wheel.passive="manualPan" @keydown.left.prevent="scrollManual(-1)" @keydown.right.prevent="scrollManual(1)">
					<span data-rss-title :class="$style.motionTitle">
						<span v-for="(letter, index) in titleLetters" :key="index" data-rss-letter :class="$style.letter" aria-hidden="true">{{ letter }}</span>
					</span>
				</div>
				<time v-if="article.date" :class="$style.date" :datetime="article.date">{{ formatDate(article.date) }}</time>
				<button ref="readButton" type="button" :class="$style.read" :aria-label="`${copy.openReader}: ${article.title || copy.untitled}`" :aria-expanded="readerOpen" @click="openReader">→</button>
			</template>
			<template v-else>
				<Rss :size="18" aria-hidden="true"/>
				<span>{{ loading ? copy.loading : feeds.length === 0 ? copy.noFeeds : failed ? copy.error : copy.empty }}</span>
				<button v-if="failed" type="button" :class="$style.smallAction" @click="refresh">{{ copy.retry }}</button>
				<button v-else-if="feeds.length === 0" type="button" :class="$style.smallAction" @click="emit('settings')">{{ copy.settings }}</button>
			</template>
		</div>
	</div>
	<div ref="detailsEl" :class="[$style.details, readerOpen && $style.detailsOpen]" :inert="readerOpen ? undefined : true" :aria-hidden="readerOpen ? undefined : 'true'">
		<div :class="$style.detailsInner">
			<div :class="$style.detailsHead"><div :class="$style.copyMeta"><Rss :size="15" aria-hidden="true"/> {{ article?.source }}<time v-if="article?.date" :datetime="article.date">{{ formatDate(article.date) }}</time></div><button type="button" :class="$style.close" :aria-label="copy.close" @click="closeReader()"><X :size="18"/></button></div>
			<div ref="copyStageEl" :class="$style.copyStage">
				<div :key="article?.id" :class="$style.copy">
					<h3>{{ article?.title || copy.untitled }}</h3>
					<p>{{ readerText || copy.noContent }}</p>
					<a v-if="article?.url" :href="article.url" target="_blank" rel="noopener noreferrer nofollow" :class="$style.original">{{ copy.readOriginal }} <ArrowUpRight :size="15"/></a>
				</div>
			</div>
			<div v-if="articles.length > 1" :class="$style.controls">
				<button type="button" @click="navigate(-1)"><ChevronLeft :size="17"/>{{ copy.previous }}</button>
				<button type="button" @click="navigate(1)">{{ copy.next }}<ChevronRight :size="17"/></button>
			</div>
		</div>
	</div>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowUpRight, ChevronLeft, ChevronRight, Rss, X } from '@lucide/vue';
import { fetchRssFeeds } from './hk3-rss.js';
import type { RssArticle, RssFeed } from './hk3-rss.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';

const props = withDefaults(defineProps<{ interrupted: boolean; paused: boolean; compact?: boolean; motion?: boolean; composerPickerOpen?: boolean }>(), { compact: false, composerPickerOpen: false });
const emit = defineEmits<{ settings: []; readerOpen: [value: boolean] }>();
const copy = i18n.ts._hata._hataskeyUi3._rss;
const feeds = computed<RssFeed[]>(() => prefer.r.hataskeyUi3RssFeeds.value.slice(0, 5));
const autoSwitch = computed(() => prefer.r.hataskeyUi3RssAutoSwitch.value);
const readSeconds = computed(() => prefer.r.hataskeyUi3RssReadSeconds.value);
const readMode = computed(() => prefer.r.hataskeyUi3RssReadMode.value);
const articles = ref<RssArticle[]>([]);
const currentId = ref<string | null>(null);
const article = computed(() => articles.value.find(item => item.id === currentId.value) ?? articles.value[0] ?? null);
const titleLetters = computed(() => graphemes(article.value?.title || copy.untitled));
const readerText = computed(() => readMode.value === 'summary' ? article.value?.summary : article.value?.body);
const loading = ref(true);
const failed = ref(false);
const readerOpen = ref(false);
const hovered = ref(false);
const focused = ref(false);
const hidden = ref(false);
const osReduce = ref(false);
const allowMotion = computed(() => (props.motion ?? prefer.r.animation.value) && !osReduce.value);
const suspended = computed(() => props.interrupted || props.paused || readerOpen.value || hovered.value || focused.value || hidden.value || !allowMotion.value);
const scrollEl = ref<HTMLElement | null>(null);
const readButton = ref<HTMLButtonElement | null>(null);
const detailsEl = ref<HTMLElement | null>(null);
const copyStageEl = ref<HTMLElement | null>(null);
let request: AbortController | null = null;
let requestRevision = 0;
let lastRefreshAt = 0;
let refreshTimer: number | null = null;
let rotationTimer: number | null = null;
let rotationStarted = 0;
let remaining = 0;
let panFrame = 0;
let panManual = false;
let panDone = false;
let panOrigin = 0;
let panStartX = 0;
let panMax = 0;
let panAvailable = 0;
let titleAnimations: Animation[] = [];
let titleGhost: HTMLElement | null = null;
let titleRevision = 0;
let copyAnimation: Animation[] = [];
let copyRevision = 0;
let mounted = false;
let restoreReadFocus = false;
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function graphemes(value: string): string[] {
	if (typeof Intl.Segmenter !== 'function') return Array.from(value);
	return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function stopRotation() {
	if (!rotationTimer) return;
	window.clearTimeout(rotationTimer);
	rotationTimer = null;
	remaining = Math.max(0, remaining - (performance.now() - rotationStarted));
}

function syncRotation() {
	stopRotation();
	if (suspended.value || !autoSwitch.value || articles.value.length < 2) return;
	if (remaining <= 0) remaining = readSeconds.value * 1000;
	rotationStarted = performance.now();
	rotationTimer = window.setTimeout(() => navigate(1), remaining);
}

function stopPan() { if (panFrame) cancelAnimationFrame(panFrame); panFrame = 0; panOrigin = 0; }

function pan(time: number) {
	const el = scrollEl.value;
	if (!el || suspended.value || panManual) { stopPan(); return; }
	if (!panOrigin) panOrigin = time;
	const elapsed = time - panOrigin;
	if (elapsed < 450) el.scrollLeft = panStartX;
	else el.scrollLeft = panStartX + (panMax - panStartX) * Math.min(1, (elapsed - 450) / panAvailable);
	if (elapsed < 450 + panAvailable) panFrame = requestAnimationFrame(pan);
	else { panDone = true; stopPan(); }
}

function syncPan() {
	stopPan();
	const el = scrollEl.value;
	if (suspended.value || panManual || panDone || titleAnimations.length || !el) return;
	panMax = el.scrollWidth - el.clientWidth;
	const available = remainingRead() - 350;
	if (panMax < 2 || available < 1800) return;
	panStartX = el.scrollLeft;
	panAvailable = Math.max(1, available - 450);
	panOrigin = 0;
	panFrame = requestAnimationFrame(pan);
}

function remainingRead() { return rotationTimer ? Math.max(0, remaining - (performance.now() - rotationStarted)) : remaining; }

function manualPan() { panManual = true; stopPan(); }

function scrollManual(direction: number) { manualPan(); scrollEl.value?.scrollBy({ left: direction * 60, behavior: allowMotion.value ? 'smooth' : 'instant' }); }

function onFocusOut(event: FocusEvent) {
	const next = event.relatedTarget;
	if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) focused.value = false;
}

function cancelTitleAnimation() {
	titleRevision++;
	for (const animation of titleAnimations) animation.cancel();
	titleAnimations = [];
	titleGhost?.remove(); titleGhost = null;
}

function snapshotTitle() {
	cancelTitleAnimation();
	const el = scrollEl.value;
	if (!el || !allowMotion.value || props.interrupted || hidden.value || readerOpen.value) return null;
	const current = el.querySelector<HTMLElement>('[data-rss-title]');
	return current ? { ghost: current.cloneNode(true) as HTMLElement, scrollLeft: el.scrollLeft } : null;
}

async function animateTitle(snapshot: { ghost: HTMLElement; scrollLeft: number } | null) {
	const revision = ++titleRevision;
	await nextTick();
	const el = scrollEl.value;
	if (!mounted || revision !== titleRevision || !el) return;
	stopPan();
	el.scrollLeft = 0;
	if (!snapshot || !allowMotion.value || props.interrupted || hidden.value || readerOpen.value) { syncPan(); return; }
	const incoming = el.querySelector<HTMLElement>('[data-rss-title]');
	if (!incoming || typeof incoming.animate !== 'function') { syncPan(); return; }
	const ghost = snapshot.ghost;
	ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
	ghost.style.position = 'absolute'; ghost.style.top = '50%'; ghost.style.left = `${-snapshot.scrollLeft}px`; ghost.style.transform = 'translateY(-50%)'; ghost.style.pointerEvents = 'none';
	el.append(ghost); titleGhost = ghost;
	const oldLetters = ghost.querySelectorAll<HTMLElement>('[data-rss-letter]');
	const newLetters = incoming.querySelectorAll<HTMLElement>('[data-rss-letter]');
	titleAnimations = [
		...Array.from(oldLetters, (letter, index) => letter.animate([{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: 'translate(-3px,-13px)' }], { duration: 260, delay: Math.min(index * 16, 350), fill: 'both' })),
		...Array.from(newLetters, (letter, index) => letter.animate([{ opacity: 0, transform: 'translate(-7px,13px)' }, { opacity: 1, transform: 'translate(0,0)' }], { duration: 360, delay: 330 + Math.min(index * 16, 350), fill: 'both' })),
	];
	await Promise.allSettled(titleAnimations.map(animation => animation.finished));
	if (revision !== titleRevision) return;
	cancelTitleAnimation(); syncPan();
}

function cancelCopyAnimation() {
	copyRevision++;
	for (const animation of copyAnimation) animation.cancel();
	copyAnimation = [];
	copyStageEl.value?.querySelectorAll('[data-rss-outgoing]').forEach(node => node.remove());
	if (copyStageEl.value) { copyStageEl.value.style.height = ''; copyStageEl.value.style.overflow = ''; }
}

async function animateCopy(step: number, oldCopy: HTMLElement | null) {
	const revision = ++copyRevision;
	const stage = copyStageEl.value;
	const oldHeight = stage?.getBoundingClientRect().height ?? 0;
	const clone = allowMotion.value && readerOpen.value && typeof stage?.animate === 'function' && oldCopy ? oldCopy.cloneNode(true) as HTMLElement : null;
	await nextTick();
	if (revision !== copyRevision || !stage || !clone || !mounted) return;
	const fresh = stage.firstElementChild as HTMLElement | null;
	if (!fresh) return;
	const newHeight = fresh.getBoundingClientRect().height;
	clone.dataset.rssOutgoing = '';
	clone.setAttribute('aria-hidden', 'true');
	clone.inert = true;
	Object.assign(clone.style, { position: 'absolute', inset: '0', width: '100%' });
	stage.append(clone);
	stage.style.height = `${oldHeight}px`;
	stage.style.overflow = 'hidden';
	const direction = step > 0 ? 1 : -1;
	const animations = [
		stage.animate([{ height: `${oldHeight}px` }, { height: `${newHeight}px` }], { duration: 200, fill: 'both' }),
		fresh.animate([{ opacity: 0, transform: `translateX(${direction * 12}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 200, fill: 'both' }),
		clone.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 12}px)` }], { duration: 200, fill: 'both' }),
	];
	copyAnimation = animations;
	await Promise.allSettled(animations.map(animation => animation.finished));
	if (revision !== copyRevision) return;
	for (const animation of animations) animation.cancel();
	copyAnimation = [];
	clone.remove(); stage.style.height = ''; stage.style.overflow = '';
}

function navigate(step: number) {
	if (articles.value.length < 2) return;
	const titleSnapshot = snapshotTitle();
	const oldCopy = copyStageEl.value?.firstElementChild as HTMLElement | null;
	stopRotation();
	cancelCopyAnimation();
	const index = articles.value.findIndex(item => item.id === currentId.value);
	currentId.value = articles.value[(index + step + articles.value.length) % articles.value.length].id;
	remaining = readSeconds.value * 1000;
	panManual = false; panDone = false;
	stopPan();
	void animateTitle(titleSnapshot);
	void animateCopy(step, oldCopy);
	syncRotation();
}

function openReader() { if (props.composerPickerOpen) return; stopRotation(); restoreReadFocus = false; readerOpen.value = true; emit('readerOpen', true); void nextTick(() => { if (readerOpen.value && !props.composerPickerOpen) detailsEl.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }); }

function closeReader(restoreFocus = true) {
	if (!readerOpen.value) return;
	readerOpen.value = false;
	cancelCopyAnimation();
	emit('readerOpen', false);
	restoreReadFocus = restoreFocus;
	if (restoreFocus) void nextTick(restoreFocusToRead);
}

function restoreFocusToRead() {
	if (!mounted || readerOpen.value || props.interrupted || !restoreReadFocus) return;
	readButton.value?.focus({ preventScroll: true });
	restoreReadFocus = false;
}

async function refresh() {
	request?.abort();
	const revision = ++requestRevision;
	lastRefreshAt = Date.now();
	const controller = new AbortController(); request = controller;
	if (!articles.value.length) loading.value = true;
	try {
		const result = await fetchRssFeeds(feeds.value, controller.signal);
		if (!mounted || revision !== requestRevision) return;
		const oldId = currentId.value;
		stopRotation();
		const nextId = oldId && result.articles.some(item => item.id === oldId) ? oldId : result.articles[0]?.id ?? null;
		const titleSnapshot = nextId !== oldId ? snapshotTitle() : (cancelTitleAnimation(), null);
		articles.value = result.articles;
		currentId.value = nextId;
		failed.value = result.successes === 0 && feeds.value.length > 0;
		if (oldId !== currentId.value) { remaining = readSeconds.value * 1000; panManual = false; panDone = false; stopPan(); void animateTitle(titleSnapshot); }
	} catch { if (revision === requestRevision && !controller.signal.aborted) failed.value = true; } finally { if (revision === requestRevision) { loading.value = false; syncRotation(); } }
}

function onVisibility() { hidden.value = window.document.hidden; if (!hidden.value && Date.now() - lastRefreshAt >= 600_000) void refresh(); }

function onReduce(event: MediaQueryListEvent) { osReduce.value = event.matches; }

watch(() => feeds.value.map(feed => `${feed.id}\u0000${feed.url}\u0000${feed.name ?? ''}\u0000${feed.color ?? ''}`).join('\u0001'), () => { if (mounted) void refresh(); });
watch(readSeconds, () => { stopRotation(); remaining = readSeconds.value * 1000; syncRotation(); });
watch([suspended, autoSwitch, () => articles.value.length], () => { syncRotation(); syncPan(); });
watch([() => props.interrupted, allowMotion, hidden, readerOpen], () => {
	if (props.interrupted || !allowMotion.value || hidden.value || readerOpen.value) cancelTitleAnimation();
	if (!allowMotion.value || hidden.value) cancelCopyAnimation();
});
watch(() => props.interrupted, value => { if (!value) void nextTick(restoreFocusToRead); });
watch(() => props.composerPickerOpen, value => { if (value) { restoreReadFocus = false; closeReader(false); } });
onMounted(() => {
	mounted = true; hidden.value = window.document.hidden; osReduce.value = reduceQuery.matches;
	window.document.addEventListener('visibilitychange', onVisibility);
	reduceQuery.addEventListener('change', onReduce);
	remaining = readSeconds.value * 1000;
	void refresh();
	refreshTimer = window.setInterval(() => { if (!window.document.hidden) void refresh(); }, 600_000);
});
onBeforeUnmount(() => {
	mounted = false; requestRevision++; request?.abort();
	if (refreshTimer) window.clearInterval(refreshTimer);
	stopRotation(); stopPan(); cancelTitleAnimation(); cancelCopyAnimation();
	window.document.removeEventListener('visibilitychange', onVisibility);
	reduceQuery.removeEventListener('change', onReduce);
});
</script>

<style module lang="scss">
@use './hk3-glass';
.root {
	@include hk3-glass.banner-fade;
	--hk3-banner-alpha: clamp(66%, calc(var(--hk3-glass-pane-alpha, 76%) - 10%), 82%);
	--hk3-banner-radius: 16px;
	min-width: 0;
}
.bannerSlot { height: 48px; position: relative; }
.root[data-compact="true"] .bannerSlot { height: 44px; }
.banner { position: relative; isolation: isolate; height: 100%; display: flex; align-items: center; gap: calc(9px * var(--hk3-ui-scale, 1)); padding: 0 calc(var(--hk3-banner-edge) + 4px); overflow: hidden; border-radius: var(--hk3-banner-radius, 16px); background: transparent; color: var(--hk3-bg); font: 800 calc(15px * var(--hk3-ui-scale, 1)) 'LINE Seed JP', sans-serif; opacity: 1; transition: opacity 180ms ease; }
.banner::before { background: var(--hk3-rss-banner-background, color-mix(in srgb, var(--hk3-accent) var(--hk3-banner-alpha), transparent)); }
.banner::before, .details::before {
	content: '';
	display: var(--hk3-rss-surface-display, block);
	position: absolute;
	inset: 0;
	z-index: -1;
	border-radius: inherit;
	-webkit-backdrop-filter: var(--hk3-rss-backdrop-filter, blur(24px));
	backdrop-filter: var(--hk3-rss-backdrop-filter, blur(24px));
	@include hk3-glass.banner-mask;
	pointer-events: none;
}
.bannerReading { justify-content: center; text-align: center; }
.interrupted { opacity: 0; pointer-events: none; }
// Suppress underlayer copy immediately while preserving the banner crossfade.
.banner > * { visibility: var(--hk3-rss-underlayer-visibility, visible); opacity: var(--hk3-rss-underlayer-opacity, 1); transition: opacity 180ms ease; }
.interrupted > * { visibility: hidden; opacity: 0; }
.icon { flex: none; }
.source, .date { flex: none; font-size: calc(12px * var(--hk3-ui-scale, 1)); white-space: nowrap; }
.source { max-width: min(22%, 180px); overflow: hidden; text-overflow: ellipsis; border-left: 3px solid var(--rss-feed-color, currentColor); padding-left: calc(6px * var(--hk3-ui-scale, 1)); }
.date { opacity: .7; font-size: calc(11px * var(--hk3-ui-scale, 1)); }
.scroll { position: relative; flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: none; touch-action: pan-x; overscroll-behavior-x: contain; }
.scroll::-webkit-scrollbar { display: none; }
.scroll:focus-visible, .read:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
.details button:focus-visible, .original:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -2px; }
.motionTitle { position: relative; display: inline-block; min-width: 100%; width: max-content; line-height: 1.35; }
.letter { display: inline-block; white-space: pre; }
.read { flex: none; width: 28px; height: 30px; border: 1px solid currentColor; border-radius: 0; display: grid; place-items: center; background: transparent; color: inherit; cursor: pointer; font-size: calc(18px * var(--hk3-ui-scale, 1)); line-height: 1; }
.read:hover, .smallAction:hover { background: var(--hk3-accent-300); }
.smallAction { margin-left: auto; padding: calc(5px * var(--hk3-ui-scale, 1)) calc(9px * var(--hk3-ui-scale, 1)); border: 1px solid var(--hk3-divider); background: transparent; color: inherit; cursor: pointer; }
.details { position: relative; isolation: isolate; display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows 260ms ease, visibility 260ms; border-radius: var(--hk3-banner-radius, 16px); background: transparent; border-bottom: 0 solid transparent; }
.details::before { background: var(--hk3-rss-details-background, color-mix(in srgb, var(--hk3-surface) var(--hk3-banner-alpha), transparent)); box-sizing: border-box; }
.detailsOpen { grid-template-rows: 1fr; visibility: visible; border-bottom-width: 1px; }
.detailsOpen::before { border-bottom: 1px solid var(--hk3-divider); }
.detailsInner { min-height: 0; max-height: min(60dvh, 650px); overflow: hidden; padding: 0 calc(20px * var(--hk3-ui-scale, 1)); display: flex; flex-direction: column; }
.detailsHead { display: flex; align-items: center; position: relative; min-height: 42px; padding-right: calc(36px * var(--hk3-ui-scale, 1)); font-size: calc(12px * var(--hk3-ui-scale, 1)); font-weight: 800; color: var(--hk3-accent); }
.close { position: absolute; right: 0; top: 7px; width: 28px; height: 28px; border: 0; background: transparent; color: var(--hk3-text); cursor: pointer; }
.copyStage { position: relative; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.copy { padding: 2px 0 calc(12px * var(--hk3-ui-scale, 1)); }
.copyMeta { display: flex; align-items: center; gap: calc(5px * var(--hk3-ui-scale, 1)); min-width: 0; overflow-wrap: anywhere; color: var(--hk3-neutral-700); font-size: calc(11px * var(--hk3-ui-scale, 1)); }
.copyMeta svg, .copyMeta time { flex: none; }
.copyMeta time { margin-left: 8px; }
.copy h3 { margin: 8px 0; font-size: calc(17px * var(--hk3-ui-scale, 1)); line-height: 1.5; }
.copy p { margin: 0 0 12px; font-size: calc(13px * var(--hk3-ui-scale, 1)); line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.original { display: inline-flex; align-items: center; gap: calc(4px * var(--hk3-ui-scale, 1)); color: var(--hk3-accent); font-size: calc(12px * var(--hk3-ui-scale, 1)); font-weight: 700; }
.controls { display: flex; gap: calc(8px * var(--hk3-ui-scale, 1)); padding-bottom: calc(14px * var(--hk3-ui-scale, 1)); }
.controls button { flex: 1; display: flex; justify-content: center; align-items: center; gap: calc(4px * var(--hk3-ui-scale, 1)); min-height: 36px; border: 1px solid var(--hk3-divider); background: var(--hk3-neutral-200); color: var(--hk3-text); cursor: pointer; }
.controls button:hover { border-color: var(--hk3-accent); }
@media (max-width: 650px) { .bannerSlot { height: 44px; } .banner { padding: 0 calc(var(--hk3-banner-edge) + 4px); gap: calc(7px * var(--hk3-ui-scale, 1)); font-size: calc(14px * var(--hk3-ui-scale, 1)); } .source, .date { display: none; } .read { height: 28px; } .detailsInner { padding: 0 calc(16px * var(--hk3-ui-scale, 1)); } }
.root:not([data-motion]) .banner, .root:not([data-motion]) .banner > *, .root:not([data-motion]) .details { transition: none; }
@media (prefers-reduced-motion: reduce) { .banner, .banner > *, .details { transition: none; } }
</style>
