<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div v-if="enabled" ref="root" class="public-post-columns" :data-mobile="mobile" :data-scroll-linked="scrollLinked">
	<div ref="stage" class="public-post-stage">
		<div ref="track" class="public-post-grid" @scroll.self.passive="syncColumn" @scrollend.self="finishScroll" @pointerdown="manualScroll" @wheel.passive="manualScroll">
			<PublicNoteStream v-for="(column, index) in columns" :key="column.key" :feedKey="column.key" :language="language" :title="language === 'en' ? column.en : column.title" :icon="column.icon" :style="{ '--column-delay': `${.34 + index * .12}s` }" :inert="mobile && activeIndex !== index" :aria-hidden="mobile && activeIndex !== index ? true : undefined"/>
		</div>
		<div v-if="mobile" class="public-post-pager" role="group" :aria-label="language === 'en' ? 'Public feeds. Swipe left or right' : '投稿一覧の切り替え。左右にスワイプできます'" @keydown="pageKey">
			<button type="button" data-post-prev :disabled="activeIndex === 0" :aria-label="language === 'en' ? 'Previous feed' : '前の投稿一覧'" @click="move(-1)"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
			<div class="public-post-page-status"><span role="status" aria-live="polite" aria-atomic="true">{{ currentTitle }}<small>{{ activeIndex + 1 }} / {{ columns.length }}</small></span><span class="public-post-dots" aria-hidden="true"><span v-for="(column, index) in columns" :key="column.key" :data-active="activeIndex === index"></span></span></div>
			<button type="button" data-post-next :disabled="activeIndex === columns.length - 1" :aria-label="language === 'en' ? 'Next feed' : '次の投稿一覧'" @click="move(1)"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
		</div>
	</div>
</div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PublicNoteStream from './welcome.entrance.note-stream.vue';
import type { WelcomeFeedKey as FeedKey } from '@/utility/welcome-public-notes.js';
import { useWelcomePublicNotes } from '@/utility/welcome-public-notes.js';
import { prefer } from '@/preferences.js';
const props = defineProps<{ language: 'ja' | 'en' }>();
const { enabled } = useWelcomePublicNotes();
const columns: { key: FeedKey; title: string; en: string; icon: string }[] = [
	{ key: 'latest', title: '最新の投稿', en: 'Latest', icon: 'ti ti-home' },
	{ key: 'popular', title: '人気の投稿', en: 'Popular', icon: 'ti ti-flame' },
	{ key: 'files', title: 'ファイル付き', en: 'With files', icon: 'ti ti-photo' },
	{ key: 'greetings', title: 'あいさつ', en: 'Greetings', icon: 'ti ti-sun-moon' },
];
const root = ref<HTMLElement>(), stage = ref<HTMLElement>(), track = ref<HTMLElement>();
const mobile = ref(false), activeIndex = ref(0), scrollLinked = ref(false);
const currentTitle = computed(() => props.language === 'en' ? columns[activeIndex.value].en : columns[activeIndex.value].title);
let scrollTarget: number | null = null, observer: ResizeObserver | undefined;
let page: HTMLElement | null = null, motionQuery: MediaQueryList | undefined;
let scrollRun = 1, entryTop = 0, lastPageStep = 0, pageFrame = 0;
let measured = false, disposed = false, mounted = false;

function pageStep() {
	if (!root.value || !page) return 0;
	const top = root.value.getBoundingClientRect().top - page.getBoundingClientRect().top;
	return Math.max(0, Math.min(columns.length - 1, Math.floor((entryTop - top) / scrollRun * columns.length)));
}

function rememberPageStep() { lastPageStep = pageStep(); }

function updateFromPage() {
	pageFrame = 0;
	if (!scrollLinked.value) return;
	const step = pageStep(), delta = step - lastPageStep;
	lastPageStep = step;
	if (!delta) return;
	// Keep the reader's focused link or expanded content available. The pager
	// itself stays usable while the vertical story advances.
	const selected = track.value?.children[activeIndex.value];
	if (selected?.contains(window.document.activeElement) || selected?.querySelector('details[open]')) return;
	activeIndex.value = Math.max(0, Math.min(columns.length - 1, activeIndex.value + delta));
	align(true);
}

function pageScroll(event: Event) {
	if (event.target !== page || !scrollLinked.value || pageFrame) return;
	pageFrame = requestAnimationFrame(updateFromPage);
}

// Follow the existing welcome activity pager: native scrolling and a pending
// target keep rapid arrow presses in sync while smooth scrolling is in flight.
function align(smooth = false) {
	const element = track.value;
	if (!element) return;
	const animated = smooth && prefer.r.animation.value && !motionQuery?.matches;
	const left = mobile.value ? activeIndex.value * element.clientWidth : 0;
	scrollTarget = animated ? left : null;
	element.scrollTo({ left, behavior: animated ? 'smooth' : 'auto' });
}

function select(index: number) {
	if (!mobile.value || index < 0 || index >= columns.length) return;
	activeIndex.value = index;
	rememberPageStep();
	align(true);
}

function move(direction: -1 | 1) { select(activeIndex.value + direction); }

function syncColumn() {
	const element = track.value;
	if (!mobile.value || !element?.clientWidth) return;
	if (scrollTarget !== null && Math.abs(element.scrollLeft - scrollTarget) > 1) return;
	scrollTarget = null;
	const index = Math.max(0, Math.min(columns.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
	if (index !== activeIndex.value) {
		activeIndex.value = index;
		rememberPageStep();
	}
}

function manualScroll() { scrollTarget = null; syncColumn(); }

function finishScroll() { scrollTarget = null; syncColumn(); }

function pageKey(event: KeyboardEvent) {
	if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
	event.preventDefault();
	if (event.key === 'Home') select(0);
	else if (event.key === 'End') select(columns.length - 1);
	else move(event.key === 'ArrowRight' ? 1 : -1);
}

async function measure() {
	mobile.value = (page?.clientWidth || window.innerWidth) <= 760;
	await nextTick();
	if (disposed || !root.value || !stage.value) return;
	const height = page?.clientHeight || window.innerHeight;
	const stageHeight = stage.value.getBoundingClientRect().height;
	const visibleTop = (page?.querySelector('.site-header')?.getBoundingClientRect().height || 56) + 8;
	// Use the distance the fully visible carousel naturally travels through the
	// viewport. Reserving a separate sticky runway leaves a large blank below it.
	entryTop = height - stageHeight - 24;
	scrollRun = Math.max(1, entryTop - visibleTop);
	scrollLinked.value = mobile.value && prefer.r.animation.value && !motionQuery?.matches && scrollRun >= 120;
	if (!measured && scrollLinked.value) activeIndex.value = pageStep();
	measured = true;
	rememberPageStep();
	align();
}

function connectPage() {
	observer?.disconnect();
	page?.removeEventListener('scroll', pageScroll);
	measured = false;
	page = root.value?.closest<HTMLElement>('[data-hataskey-entrance]') ?? null;
	page?.addEventListener('scroll', pageScroll, { passive: true });
	void measure();
	if (root.value) {
		observer?.observe(root.value);
		if (stage.value) observer?.observe(stage.value);
		if (page) observer?.observe(page);
	}
}

watch(root, () => { if (mounted) connectPage(); }, { flush: 'post' });
watch(prefer.r.animation, () => { void measure(); });
onMounted(() => {
	mounted = true;
	motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
	motionQuery.addEventListener('change', measure);
	observer = new ResizeObserver(() => { void measure(); });
	connectPage();
});
onBeforeUnmount(() => {
	disposed = true;
	observer?.disconnect();
	page?.removeEventListener('scroll', pageScroll);
	motionQuery?.removeEventListener('change', measure);
	if (pageFrame) cancelAnimationFrame(pageFrame);
});
</script>
