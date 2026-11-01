<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
The caller keeps the dialog queue and records the displayed version on closed.
-->
<template>
<MkModal ref="modal" preferType="dialog" zPriority="middle" :motionPreset="modalMotionPreset" @click="dismiss" @esc="dismiss" @close="stop" @opened="startOpening" @closed="onClosed">
	<section ref="releaseRoot" :class="$style.releasePanel" data-release-opening-shell :data-opening="!contentReady" :data-page="page" :data-motion="motion" :data-arrival="arrival" :data-mode="mode" :inert="!opened" :aria-hidden="!opened" role="dialog" aria-modal="true" aria-labelledby="hata-whats-new-title">
		<ReleaseOpening v-if="opened && !contentReady" ref="opening" :motion="motion"/>
		<header :class="$style.releaseHeader">
			<div :class="$style.releaseHeading" data-release-heading><MkHatakyuIllustration v-if="useHatakyuBranding()" :class="$style.releaseMascot" asset="treasureFound" :size="40"/><h1 id="hata-whats-new-title">{{ copy.title }}<wbr><span style="white-space: nowrap;">({{ displayVersion }})</span></h1></div>
			<button :class="$style.closeButton" aria-label="更新案内を閉じる" @click="dismiss"><i class="ti ti-x" aria-hidden="true"></i></button>
		</header>

		<div ref="pageBody" :class="[$style.releaseBody, $style.simpleBody]" :data-feature="currentStory.feature" :inert="!contentReady" :aria-hidden="!contentReady" role="region" aria-label="更新内容の本文">
			<section v-if="(opened || closing) && contentReady" :key="currentStory.id" :class="[$style.storyPage, $style.simplePage]" data-story="updates" :data-feature="currentStory.feature" :data-summary="currentStory.id">
				<div :class="$style.updatesHeading" data-reveal="lead">
					<p :class="[$style.eyebrow, { [$style.brandLabel]: isBrandLabel }]">{{ currentStory.label }}</p>
					<h2 ref="pageTitle" tabindex="-1">{{ currentStory.title }}</h2>
				</div>
				<div v-if="currentStory.feature === 'hatagoes'" :class="$style.mergeStage" data-reveal="stage" data-feature-mock aria-hidden="true" inert>
					<HatagoesMergeMotion :active="mergeActive" :loop="true"/>
				</div>
				<HataigoShowcase v-else-if="currentStory.feature === 'hataigo'" data-reveal="stage" :animate="hataigoActive" @start="startHataigo"/>
				<a v-else :class="$style.releaseNotesLink" :href="currentStory.cards[0].link?.url" target="_blank" rel="noopener noreferrer" data-reveal="stage">{{ currentStory.cards[0].link?.label }}<i class="ti ti-external-link" aria-hidden="true"></i></a>
			</section>
		</div>

		<footer :class="$style.releaseFooter" :inert="!contentReady" :aria-hidden="!contentReady">
			<button v-if="page > 1" :class="[$style.backButton, $style.pageArrow]" aria-label="戻る" :disabled="changing" @click="move(page - 1)"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
			<div :class="$style.stepCaption" aria-live="polite"><span :class="{ [$style.brandLabel]: isBrandLabel }">{{ currentStory.label }}</span><div :class="$style.stepTrack" aria-hidden="true"><i v-for="n in totalPages" :key="n" :data-current="page === n"></i></div><small>{{ page }} / {{ totalPages }}</small></div>
			<button v-if="page < totalPages" :class="[$style.primaryButton, $style.pageArrow]" aria-label="次へ" :disabled="changing" @click="move(page + 1)"><i class="ti ti-arrow-right" aria-hidden="true"></i></button>
			<button v-else :class="$style.primaryButton" @click="dismiss">{{ copy.gotIt }}<i class="ti ti-check" aria-hidden="true"></i></button>
		</footer>
	</section>
</MkModal>
</template>
<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import ReleaseOpening from './hata-whats-new/ReleaseOpening.vue';
import HatagoesMergeMotion from './hatagoes/motion/HatagoesMergeMotion.vue';
import HataigoShowcase from './hata-whats-new/HataigoShowcase.vue';
import { createReveal } from './hata-whats-new/reveal.js';
import { getHataWhatsNewStories, getHataWhatsNewDisplayVersion, HATA_WHATS_NEW } from '@/utility/hata-whats-new.js';
import MkHatakyuIllustration from '@/components/MkHatakyuIllustration.vue';
import MkModal from '@/components/MkModal.vue';
import { useHatakyuBranding } from '@/utility/hatakyu-assets.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { i18n } from '@/i18n.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const emit = defineEmits<{ closed: [] }>();
const hataGoesHost = inject(HATA_GOES_HOST, null);
const copy = i18n.ts._hata._whatsNew._window;
const displayVersion = getHataWhatsNewDisplayVersion(HATA_WHATS_NEW.version);
const modal = useTemplateRef('modal');
const releaseRoot = useTemplateRef('releaseRoot');
const pageTitle = useTemplateRef('pageTitle');
const pageBody = useTemplateRef('pageBody');
const opening = useTemplateRef('opening');
const stories = getHataWhatsNewStories();
const pageId = ref(HATA_WHATS_NEW.groups[0].cards[0].id);
const page = computed(() => Math.max(0, stories.findIndex(story => story.id === pageId.value || story.cards.some(card => card.id === pageId.value))) + 1);
const totalPages = computed(() => stories.length);
const currentStory = computed(() => stories[page.value - 1]);
const isBrandLabel = computed(() => ['HataGoes', 'HataIgo', 'Hataskey UI S 2', 'HataFeed', 'Hatask'].includes(currentStory.value.label));
const opened = ref(true);
const closing = ref(false);
const contentReady = ref(false);
const changing = ref(true);
const arrival = ref('settled');
const mode = computed(() => store.r.darkMode.value ? 'dark' : 'light');
const media = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = ref(media.matches);
const documentVisible = ref(!window.document.hidden);
const motion = computed(() => opened.value && prefer.r.animation.value && !reduced.value && documentVisible.value);
const mergeActive = computed(() => opened.value && contentReady.value && !changing.value && currentStory.value.feature === 'hatagoes' && documentVisible.value);
const hataigoActive = computed(() => motion.value && contentReady.value && !changing.value && currentStory.value.feature === 'hataigo');
const modalMotionPreset = computed<'none' | 'dissolve' | undefined>(() => !documentVisible.value ? 'none' : hataGoesHost ? undefined : !prefer.r.animation.value || reduced.value ? 'none' : contentReady.value ? 'dissolve' : undefined);
const reveal = createReveal();
let transitionRevision = 0;
let entranceRevision = 0;
let disposed = false;
let openingStarted = false;
let closedEmitted = false;

function isClosed() { return disposed || !opened.value; }

function syncMotion() { reduced.value = media.matches; }

// Start after MkModal's own entrance; keep its first child stable for focus
// trapping and outside-click handling throughout this decorative sequence.
async function startOpening() {
	if (isClosed() || openingStarted) return;
	openingStarted = true;
	const ticket = transitionRevision;
	await nextTick();
	if (isClosed() || ticket !== transitionRevision) return;
	await opening.value?.play();
	if (isClosed() || ticket !== transitionRevision) return;
	contentReady.value = true;
	changing.value = false;
	await nextTick();
	if (isClosed()) return;
	focusTitle();
	void enter(true);
}

async function enter(initial = false) {
	const ticket = ++entranceRevision;
	await nextTick();
	if (isClosed() || !contentReady.value) return;
	arrival.value = motion.value && !window.document.hidden ? 'arriving' : 'settled';
	await reveal.play([
		...(initial ? [
			{ element: releaseRoot.value?.querySelector<HTMLElement>('header') ?? null, duration: 440, y: 5 },
			{ element: releaseRoot.value?.querySelector('footer') ?? null, delay: 420, duration: 440, y: 5 },
		] : []),
		{ element: pageBody.value?.querySelector<HTMLElement>('[data-reveal="lead"]') ?? null, duration: 480, y: 10 },
		{ element: pageBody.value?.querySelector<HTMLElement>('[data-reveal="stage"]') ?? null, delay: 110, duration: 650, y: 0, scale: .988 },
	], motion.value);
	if (ticket === entranceRevision) arrival.value = 'settled';
}

async function move(next: number) {
	if (isClosed() || changing.value || next < 1 || next > totalPages.value) return;
	const destinationId = stories[next - 1].id;
	const ticket = ++transitionRevision;
	changing.value = true;
	entranceRevision++;
	await reveal.play([{ element: pageBody.value?.firstElementChild as HTMLElement, duration: 150, x: next > page.value ? -12 : 12, y: 0, exit: true }], motion.value);
	if (isClosed() || ticket !== transitionRevision) return;
	pageId.value = destinationId;
	await nextTick();
	if (isClosed()) return;
	if (pageBody.value) pageBody.value.scrollTop = 0;
	pageTitle.value?.focus({ preventScroll: true });
	changing.value = false;
	void enter();
}

function stop() {
	transitionRevision++;
	entranceRevision++;
	opened.value = false;
	changing.value = false;
	arrival.value = 'settled';
	opening.value?.cancel();
	reveal.cancel();
}

function dismiss() {
	if (!opened.value) return;
	closing.value = contentReady.value && motion.value;
	stop();
	modal.value?.close();
}

// 旗鯖fork: 案内を閉じてから HataIgo へ移る。ルーターは押されたときだけ読み込む。
async function startHataigo() {
	dismiss();
	const { mainRouter } = await import('@/router.js');
	mainRouter.pushByPath('/hataigo');
}

function onClosed() {
	closing.value = false;
	if (closedEmitted) return;
	closedEmitted = true;
	emit('closed');
}

function settle() {
	entranceRevision++;
	opening.value?.cancel();
	reveal.cancel();
	arrival.value = 'settled';
	if (!contentReady.value) void startOpening();
}

function visibility() { documentVisible.value = !window.document.hidden; if (!documentVisible.value) settle(); }

function focusTitle() { if (opened.value && contentReady.value) pageTitle.value?.focus({ preventScroll: true }); }

watch(motion, enabled => { if (!enabled) settle(); });
onMounted(() => {
	media.addEventListener('change', syncMotion);
	window.document.addEventListener('visibilitychange', visibility);
	if (!motion.value || window.document.hidden) void startOpening();
});
onBeforeUnmount(() => { disposed = true; stop(); media.removeEventListener('change', syncMotion); window.document.removeEventListener('visibilitychange', visibility); });
</script>
<style module src="./hata-whats-new/release.module.css"></style>
<style lang="scss">
@use "./hatask/hatask-fonts.scss";
</style>
