<!-- SPDX-License-Identifier: AGPL-3.0-only -->

<template>
<section
	ref="cardRoot"
	:class="$style.row"
	:style="themeTextColors"
	:data-phase="phase"
	:data-motion="motion"
	:data-navbar="navbar"
	:aria-hidden="phase === 'leaving' ? true : undefined"
	:inert="phase === 'leaving'"
	:aria-label="copy.title"
	tabindex="-1"
>
	<div :class="$style.clip">
		<div :class="$style.card">
			<button v-if="contentPhase === 'voting' || isResult" :class="$style.dismiss" class="_button" type="button" data-emoji-vote-dismiss :aria-label="isResult ? copy.closeResults : copy.declineVote" :disabled="!active || submitting || phase === 'leaving'" @click.stop="dismiss">
				<i class="ti ti-x" aria-hidden="true"></i>
			</button>
			<div :class="$style.head">
				<i class="ti ti-mood-smile" aria-hidden="true"></i>
				<span>{{ copy.title }}</span>
				<span v-if="contentPhase !== 'declined'" :class="$style.counter" :aria-label="isResult ? i18n.tsx._hata._ltlEmojiVote.secondsRemaining({ seconds: String(remaining) }) : undefined">
					<i v-if="isResult" class="ti ti-clock" aria-hidden="true"></i>
					<span>{{ isResult ? i18n.tsx._hata._ltlEmojiVote.seconds({ seconds: String(remaining) }) : phase === 'tallying' ? copy.voteClosed : i18n.tsx._hata._ltlEmojiVote.untilClose({ seconds: String(remaining) }) }}</span>
				</span>
			</div>
			<div ref="bodyViewport" :class="$style.bodyViewport" :style="bodyHeight === null ? undefined : { height: `${bodyHeight}px` }">
				<Transition :css="motion" :mode="motion ? 'out-in' : undefined" :enterActiveClass="$style.contentEnterActive" :leaveActiveClass="$style.contentLeaveActive" :enterFromClass="$style.contentHidden" :leaveToClass="$style.contentHidden" @beforeLeave="holdBodyHeight" @enter="measureBodyHeight" @afterEnter="releaseBodyHeight" @enterCancelled="releaseBodyHeight">
					<div :key="contentPhase === 'declined' ? 'declined' : 'round'" :class="$style.body" :data-vote-content="contentPhase">
						<template v-if="contentPhase === 'voting'">
							<h2 :class="$style.title">{{ copy.whichEmoji }}</h2>
							<p :class="$style.subtitle">{{ !canVote ? copy.loginToJoin : submitting ? copy.submitting : copy.chooseOne }}</p>
							<div :class="$style.choices" role="group" :aria-label="copy.chooseCustomEmoji" :aria-busy="submitting">
								<button
									v-for="emoji in round.candidates"
									:key="emoji.id"
									:class="$style.choice"
									class="_button"
									type="button"
									:disabled="submitting || !canVote"
									:aria-label="i18n.tsx._hata._ltlEmojiVote.voteFor({ emoji: `:${emoji.name}:` })"
									:title="`:${emoji.name}:`"
									@click.stop="vote(emoji.id)"
								>
									<span :class="$style.choiceImage" aria-hidden="true"><MkCustomEmoji :name="emoji.name" :url="emoji.url" :host="null"/></span>
									<span :class="$style.emojiName">:{{ emoji.name }}:</span>
								</button>
							</div>
							<p v-if="voteError" :class="$style.error" role="alert">{{ voteError }}</p>
						</template>
						<div v-else-if="contentPhase === 'rain' || contentPhase === 'waiting'" :class="$style.state">
							<span v-if="contentPhase === 'rain'" ref="selectedImage" :class="$style.symbol" aria-hidden="true">
								<MkCustomEmoji v-if="selectedEmoji" :name="selectedEmoji.name" :url="selectedEmoji.url" :host="null"/>
								<i v-else class="ti ti-check"></i>
							</span>
							<div :class="$style.stateCopy">
								<h2>{{ contentPhase === 'rain' ? copy.chosen : copy.waitingForOthers }}</h2>
								<p>{{ copy.voteAccepted }}</p>
								<span :class="$style.waitDots" aria-hidden="true"><i></i><i></i><i></i></span>
							</div>
						</div>
						<div v-else-if="contentPhase === 'tallying'" :class="$style.state">
							<span :class="$style.symbol" aria-hidden="true"><i class="ti ti-hourglass"></i></span>
							<div :class="$style.stateCopy">
								<h2>{{ copy.tallying }}</h2>
								<p>{{ copy.resultsSoon }}</p>
								<span :class="$style.waitDots" aria-hidden="true"><i></i><i></i><i></i></span>
							</div>
						</div>
						<div v-else-if="contentPhase === 'declined'" :class="$style.state">
							<span :class="$style.symbol" aria-hidden="true"><i class="ti ti-check"></i></span>
							<div :class="$style.stateCopy"><h2>{{ copy.declined }}</h2></div>
						</div>
						<template v-else-if="isResult">
							<h2 :class="$style.title">{{ copy.resultsReady }}</h2>
							<ol :class="$style.rankings" role="list" :aria-label="copy.resultsLabel">
								<li v-for="entry in round.rankings" :key="entry.emoji.id" :class="$style.ranking" :data-rank="entry.rank ?? 'none'" :value="entry.rank ?? undefined">
									<span :class="$style.place">
										<i v-if="entry.rank === 1" class="ti ti-trophy" aria-hidden="true"></i>
										<span>{{ rankLabel(entry) }}</span>
									</span>
									<span :class="$style.rankImage" :data-winner="entry.rank === 1"><MkCustomEmoji :name="entry.emoji.name" :url="entry.emoji.url" :host="null"/></span>
									<span :class="$style.rankDetail">
										<span :class="$style.rankName" :title="`:${entry.emoji.name}:`">:{{ entry.emoji.name }}:</span>
										<span :class="$style.rankCount">{{ i18n.tsx._hata._ltlEmojiVote.votes({ count: String(entry.count) }) }}</span>
									</span>
								</li>
							</ol>
							<p :class="$style.caption">{{ round.total > 0 ? i18n.tsx._hata._ltlEmojiVote.participants({ count: String(round.total) }) : copy.noVotes }}</p>
						</template>
					</div>
				</Transition>
			</div>
		</div>
	</div>
	<span :class="$style.announcement" role="status" aria-live="polite" aria-atomic="true">{{ active ? announcement : '' }}</span>
	<Teleport v-if="effectTarget && active" :to="effectTarget">
		<div :class="$style.rain" :data-fading="rainFading" :data-motion="motion" aria-hidden="true">
			<span v-for="(tile, index) in rainTiles" :key="index" :class="$style.rainTile" :style="tile"><img :src="rainImage" alt="" draggable="false" decoding="async"/></span>
		</div>
		<canvas v-if="!navbar" ref="confettiCanvas" :class="$style.confetti" :data-motion="motion" :data-fading="phase === 'leaving'" aria-hidden="true"></canvas>
	</Teleport>
</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import tinycolor from 'tinycolor2';
import type { LtlEmojiVoteChoice, LtlEmojiVotePhase, LtlEmojiVoteRanking, LtlEmojiVoteRound } from '@/utility/ltl-emoji-vote-types.js';
import MkCustomEmoji from '@/components/global/MkCustomEmoji.vue';
import { LTL_EMOJI_VOTE_EXIT_MS, LTL_EMOJI_VOTE_RAIN_MS } from '@/utility/ltl-emoji-vote-types.js';
import { makeLtlEmojiRain, playLtlEmojiConfetti } from '@/utility/ltl-emoji-vote-effects.js';
import { prefer } from '@/preferences.js';
import { useGlobalEvent } from '@/events.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	round: LtlEmojiVoteRound;
	choice: LtlEmojiVoteChoice | null;
	now: number;
	phase: LtlEmojiVotePhase;
	active: boolean;
	effectTarget: HTMLElement | null;
	claimEffect: (kind: 'rain' | 'confetti', roundId: string) => boolean;
	submitting?: boolean;
	voteError?: string | null;
	canVote?: boolean;
	navbar?: boolean;
	declined?: boolean;
}>(), { submitting: false, voteError: null, canVote: true, navbar: false, declined: false });
const emit = defineEmits<{ vote: [emojiId: string]; dismiss: [] }>();
const copy = i18n.ts._hata._ltlEmojiVote;
const cardRoot = useTemplateRef<HTMLElement>('cardRoot');
const bodyViewport = useTemplateRef<HTMLElement>('bodyViewport');
const bodyHeight = ref<number | null>(null);
const selectedImage = useTemplateRef<HTMLElement>('selectedImage');
const confettiCanvas = useTemplateRef<HTMLCanvasElement>('confettiCanvas');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = ref(reducedMotionQuery.matches);
const visible = ref(!window.document.hidden);
const hostVisible = ref(false);
const visibleWinners = shallowRef(new Set<HTMLElement>());
const motion = computed(() => prefer.r.animation.value && !reducedMotion.value);
// Keep the last visible content while either dismissal path collapses the row.
const contentPhase = ref<LtlEmojiVotePhase>('idle');
watch(() => [props.phase, props.declined] as const, ([phase, declined]) => {
	if (declined) contentPhase.value = 'declined';
	else if (phase === 'leaving' && contentPhase.value === 'idle') contentPhase.value = props.round.phase;
	else if (phase !== 'leaving' && phase !== 'idle') contentPhase.value = phase;
}, { immediate: true, flush: 'sync' });
const isResult = computed(() => contentPhase.value === 'result');
const remaining = computed(() => Math.max(0, Math.ceil(((isResult.value ? props.round.expiresAt : props.round.closesAt) - props.now) / 1000)));
const selectedEmoji = computed(() => props.round.candidates.find(emoji => emoji.id === props.choice?.emojiId));
const rainTiles = ref<ReturnType<typeof makeLtlEmojiRain>>([]);
const rainImage = ref('');
const rainFading = ref(false);
const themeTextColors = ref<Record<string, string>>({});
let rainFadeTimer: number | undefined;
let rainEndTimer: number | undefined;
let effectExitTimer: number | undefined;
let stopConfetti: (() => void) | undefined;
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let observedHost: HTMLElement | null = null;
let observedWinners = new Set<HTMLElement>();
let observedSize = { width: 0, height: 0 };
let effectGeneration = 0;
let focusAfterVote = false;
let unmounted = false;

function holdBodyHeight(element: Element) {
	bodyHeight.value = bodyViewport.value?.getBoundingClientRect().height ?? null;
	// The fading choices stay in the DOM briefly; they must no longer take focus.
	element.setAttribute('inert', '');
	element.setAttribute('aria-hidden', 'true');
}

function measureBodyHeight(element: Element) {
	if (bodyHeight.value !== null) bodyHeight.value = element.getBoundingClientRect().height;
	void updateEffects();
}

function releaseBodyHeight() { bodyHeight.value = null; }

function updateThemeTextColors() {
	if (!cardRoot.value) return;
	const style = window.getComputedStyle(cardRoot.value);
	const foreground = tinycolor(style.getPropertyValue('--MI_THEME-fg'));
	const colors: Record<string, string> = {};
	for (const surface of ['panel', 'bg']) {
		const background = tinycolor(style.getPropertyValue(`--MI_THEME-${surface}`));
		// 透過テーマの背面は利用者の配置によるため、推測した背景色で補正しない。
		if (!foreground.isValid() || !background.isValid() || background.getAlpha() !== 1) continue;
		const contrast = (color: tinycolor.Instance) => tinycolor.readability(background, tinycolor.mix(background, color, color.getAlpha() * 100));
		if (contrast(foreground) >= 4.5) continue;
		const targets = [tinycolor('#000'), tinycolor('#fff')];
		const target = contrast(targets[0]) > contrast(targets[1]) ? targets[0] : targets[1];
		// テーマの色味を保ち、読める明暗差に達したところで補正を止める。
		for (let amount = 1; amount <= 100; amount++) {
			const color = tinycolor.mix(foreground, target, amount);
			if (contrast(color) < 4.5) continue;
			colors[`--ltl-emoji-vote-${surface}-fg`] = color.toRgbString();
			break;
		}
	}
	themeTextColors.value = colors;
}

useGlobalEvent('themeChanging', updateThemeTextColors);
watch(() => props.navbar, updateThemeTextColors, { flush: 'post' });

function rankLabel(entry: LtlEmojiVoteRanking) {
	return entry.rank === null ? copy.unranked : entry.tied ? i18n.tsx._hata._ltlEmojiVote.tiedRank({ rank: String(entry.rank) }) : i18n.tsx._hata._ltlEmojiVote.rank({ rank: String(entry.rank) });
}

const announcement = computed(() => {
	switch (props.phase) {
		case 'voting': return i18n.tsx._hata._ltlEmojiVote.announcementStarted({ count: String(props.round.candidates.length) });
		case 'rain':
		case 'waiting': return copy.announcementAccepted;
		case 'tallying': return copy.announcementTallying;
		case 'declined': return copy.declined;
		case 'result': return props.round.total > 0
			? i18n.tsx._hata._ltlEmojiVote.announcementResults({ results: props.round.rankings.map(entry => i18n.tsx._hata._ltlEmojiVote.announcementEntry({ rank: rankLabel(entry), emoji: `:${entry.emoji.name}:`, votes: i18n.tsx._hata._ltlEmojiVote.votes({ count: String(entry.count) }) })).join(copy.announcementSeparator) })
			: copy.announcementNoVotes;
		default: return '';
	}
});

function vote(emojiId: string) {
	if (!props.active || !props.canVote || props.submitting || props.choice || props.phase !== 'voting') return;
	focusAfterVote = true;
	emit('vote', emojiId);
}

function dismiss() {
	if (!props.active || props.submitting || (props.phase !== 'voting' && props.phase !== 'result')) return;
	if (props.phase === 'voting' && props.choice) return;
	cardRoot.value?.focus({ preventScroll: true });
	emit('dismiss');
}

function clearRain() {
	window.clearTimeout(rainFadeTimer);
	window.clearTimeout(rainEndTimer);
	rainFadeTimer = undefined;
	rainEndTimer = undefined;
	rainTiles.value = [];
	rainImage.value = '';
	rainFading.value = false;
}

function clearEffects() {
	effectGeneration++;
	window.clearTimeout(effectExitTimer);
	effectExitTimer = undefined;
	clearRain();
	stopConfetti?.();
	stopConfetti = undefined;
}

function canAnimate() {
	return !unmounted && props.active && visible.value && motion.value && hostVisible.value && !!props.effectTarget?.isConnected;
}

function syncIntersectionTargets() {
	const target = props.active ? props.effectTarget : null;
	if (target !== observedHost) {
		if (observedHost) {
			intersectionObserver?.unobserve(observedHost);
			clearEffects();
		}
		observedHost = target;
		hostVisible.value = false;
		if (target) intersectionObserver?.observe(target);
	}
	const winners = new Set(props.active && !props.navbar && props.phase === 'result'
		? cardRoot.value?.querySelectorAll<HTMLElement>('[data-winner="true"] img') ?? []
		: []);
	const previous = observedWinners;
	observedWinners = winners;
	for (const image of previous) {
		if (winners.has(image)) continue;
		intersectionObserver?.unobserve(image);
		if (visibleWinners.value.has(image)) visibleWinners.value = new Set([...visibleWinners.value].filter(winner => winner !== image));
	}
	for (const image of winners) {
		if (!previous.has(image)) intersectionObserver?.observe(image);
	}
}

function onIntersection(entries: IntersectionObserverEntry[]) {
	for (const entry of entries) {
		// root:null includes viewport and all scroll/overflow ancestors. Merely
		// intersecting the canvas bounds would let an offscreen deck column win.
		const isVisible = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
		if (entry.target === observedHost) {
			hostVisible.value = isVisible;
		} else if (observedWinners.has(entry.target as HTMLElement)) {
			const image = entry.target as HTMLElement;
			if (visibleWinners.value.has(image) === isVisible) continue;
			const next = new Set(visibleWinners.value);
			if (isVisible) next.add(image);
			else next.delete(image);
			visibleWinners.value = next;
		}
	}
}

async function updateEffects() {
	const generation = ++effectGeneration;
	if (props.phase === 'leaving') {
		if (!canAnimate()) { clearEffects(); return; }
		// Fade the existing canvas before clearing it, for manual and timed exits.
		effectExitTimer ??= window.setTimeout(clearEffects, LTL_EMOJI_VOTE_EXIT_MS);
		return;
	}
	if (props.phase !== 'rain') clearRain();
	if (props.phase !== 'result' || props.navbar) { stopConfetti?.(); stopConfetti = undefined; }
	await nextTick();
	if (generation !== effectGeneration || unmounted) return;
	syncIntersectionTargets();
	if (!canAnimate()) { clearEffects(); return; }
	if (props.phase === 'rain' && props.choice && props.effectTarget) {
		if (rainTiles.value.length > 0) return;
		const image = selectedImage.value?.querySelector('img');
		const bounds = props.effectTarget.getBoundingClientRect();
		if (!image || bounds.width <= 0 || bounds.height <= 0 || !props.claimEffect('rain', props.round.id)) return;
		rainImage.value = image.currentSrc || image.src;
		rainTiles.value = makeLtlEmojiRain(bounds.width, bounds.height);
		rainFadeTimer = window.setTimeout(() => { rainFading.value = true; }, 1160);
		rainEndTimer = window.setTimeout(clearRain, LTL_EMOJI_VOTE_RAIN_MS);
	} else if (!props.navbar && props.phase === 'result' && confettiCanvas.value && props.round.total > 0) {
		const origins = () => [...visibleWinners.value].filter(image => image.isConnected && observedWinners.has(image));
		if (origins().length === 0) { stopConfetti?.(); stopConfetti = undefined; return; }
		if (stopConfetti) return;
		const bounds = confettiCanvas.value.getBoundingClientRect();
		const hasVisibleWinner = origins().some(img => {
			const rect = img.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0 && rect.right > bounds.left && rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom;
		});
		if (!hasVisibleWinner || !props.claimEffect('confetti', props.round.id)) return;
		stopConfetti = playLtlEmojiConfetti(confettiCanvas.value, origins, () => canAnimate() && !props.navbar && (props.phase === 'leaving' || (props.phase === 'result' && origins().length > 0)), () => props.phase === 'result');
	}
}

function onMotionChange(event: MediaQueryListEvent) { reducedMotion.value = event.matches; }

function onVisibilityChange() {
	visible.value = !window.document.hidden;
	if (!visible.value) clearEffects();
}

function onPageHide() { visible.value = false; clearEffects(); }

function onPageShow() { onVisibilityChange(); }

function observeTarget(target: HTMLElement | null) {
	resizeObserver?.disconnect();
	if (!target) return;
	observedSize = { width: target.clientWidth, height: target.clientHeight };
	resizeObserver?.observe(target);
}

function onTargetResize() {
	const target = props.effectTarget;
	if (!target || (target.clientWidth === observedSize.width && target.clientHeight === observedSize.height)) return;
	observedSize = { width: target.clientWidth, height: target.clientHeight };
	clearEffects();
}

function onViewportInteraction(event: Event) {
	// End on user scrolling/navigation, not scroll anchoring caused by the card
	// shrinking after a vote. Other deck columns remain independent.
	if (event instanceof KeyboardEvent && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
	const target = event.target;
	if (target instanceof Element && target.closest('[data-emoji-vote-dismiss]') && cardRoot.value?.contains(target)) return;
	const pane = props.effectTarget?.parentElement;
	if (target instanceof Element && pane && (target.contains(pane) || pane.contains(target))) clearEffects();
}

watch(() => [props.round.id, props.phase, props.choice?.emojiId, props.active, props.navbar, props.effectTarget, motion.value, visible.value, hostVisible.value, visibleWinners.value], updateEffects, { flush: 'post' });
watch(() => props.effectTarget, observeTarget);
watch(() => props.choice, async choice => {
	if (!choice || !focusAfterVote) return;
	focusAfterVote = false;
	await nextTick();
	if (props.active && !unmounted) cardRoot.value?.focus({ preventScroll: true });
});

onMounted(() => {
	updateThemeTextColors();
	resizeObserver = new ResizeObserver(onTargetResize);
	if ('IntersectionObserver' in window) intersectionObserver = new IntersectionObserver(onIntersection, { root: null, threshold: 0 });
	observeTarget(props.effectTarget);
	reducedMotionQuery.addEventListener('change', onMotionChange);
	window.document.addEventListener('visibilitychange', onVisibilityChange);
	window.document.addEventListener('wheel', onViewportInteraction, { capture: true, passive: true });
	window.document.addEventListener('pointerdown', onViewportInteraction, { capture: true, passive: true });
	window.document.addEventListener('keydown', onViewportInteraction, true);
	window.addEventListener('resize', clearEffects, { passive: true });
	window.addEventListener('pagehide', onPageHide);
	window.addEventListener('pageshow', onPageShow);
	void updateEffects();
});

onBeforeUnmount(() => {
	unmounted = true;
	clearEffects();
	resizeObserver?.disconnect();
	intersectionObserver?.disconnect();
	reducedMotionQuery.removeEventListener('change', onMotionChange);
	window.document.removeEventListener('visibilitychange', onVisibilityChange);
	window.document.removeEventListener('wheel', onViewportInteraction, true);
	window.document.removeEventListener('pointerdown', onViewportInteraction, true);
	window.document.removeEventListener('keydown', onViewportInteraction, true);
	window.removeEventListener('resize', clearEffects);
	window.removeEventListener('pagehide', onPageHide);
	window.removeEventListener('pageshow', onPageShow);
});
</script>

<style module lang="scss">
.row {
	display: grid;
	grid-template-rows: 1fr;
	min-width: 0;
	margin: 12px 0;
	opacity: 1;
	container-type: inline-size;
	transition: grid-template-rows .48s cubic-bezier(.22, 1, .36, 1), opacity .3s ease, margin .48s cubic-bezier(.22, 1, .36, 1);
	&[data-phase='leaving'] { grid-template-rows: 0fr; opacity: 0; margin-block: 0; pointer-events: none; }
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: 2px; }
}
.clip { overflow: hidden; min-height: 0; }
.card {
	position: relative;
	min-width: 0;
	padding: 18px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-panel);
	color: var(--ltl-emoji-vote-panel-fg, var(--MI_THEME-fg));
	text-align: center;
}
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; min-height: 32px; padding-inline: 36px; box-sizing: border-box; font-size: 12px; }
.dismiss {
	position: absolute; inset-block-start: 6px; inset-inline-end: 6px;
	display: grid; place-items: center; width: 44px; height: 44px;
	border-radius: 50%; color: inherit; font-size: 16px;
	transition: background .15s ease, opacity .15s ease;
	&:hover:not(:disabled) { background: var(--MI_THEME-buttonHoverBg); }
	&:active:not(:disabled) { background: var(--MI_THEME-buttonBg); }
	&:disabled { opacity: .5; cursor: default; }
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: -3px; }
}
.bodyViewport { min-width: 0; overflow: hidden; transition: height .28s cubic-bezier(.22, 1, .36, 1); }
.body { display: flow-root; min-width: 0; }
.contentEnterActive { transition: opacity .28s ease; }
.contentLeaveActive { transition: opacity .18s ease; }
.contentHidden { opacity: 0; }
.counter { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 11px; }
.title { font-size: 17px; margin: 9px 0 4px; line-height: 1.6; text-wrap: balance; }
.subtitle { font-size: 12px; margin: 0; }
.choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; margin-top: 15px; }
.choice {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	min-height: 92px;
	min-width: 0;
	padding: 10px 5px;
	border-radius: 12px;
	border: 1px solid var(--MI_THEME-divider);
	background: var(--MI_THEME-bg);
	color: var(--ltl-emoji-vote-bg-fg, var(--MI_THEME-fg));
	transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: 2px; }
	&:disabled { cursor: default; opacity: 1; }
	&:disabled .choiceImage { opacity: .6; }
}
.choiceImage { display: grid; place-items: center; width: 52px; height: 52px; pointer-events: none; }
.choiceImage :deep(img), .symbol :deep(img), .rankImage :deep(img) { display: block; width: 100%; height: 100% !important; object-fit: contain; transform: none !important; }
.emojiName { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: inherit; }
.error { margin: 10px 0 0; font-size: 12px; }
.state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 15px 0 7px; text-align: center; }
.symbol { width: 45px; height: 45px; flex: 0 0 45px; box-sizing: border-box; padding: 7px; display: grid; place-items: center; background: var(--MI_THEME-bg); color: var(--ltl-emoji-vote-bg-fg, var(--MI_THEME-fg)); border-radius: 50%; pointer-events: none; }
.stateCopy { width: 100%; min-width: 0; h2 { font-size: 14px; margin: 0 0 4px; line-height: 1.6; text-wrap: balance; } p { margin: 2px 0 0; font-size: 12px; line-height: 1.6; } }
.waitDots { display: flex; justify-content: center; gap: 4px; padding-top: 9px; i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: waitDot 1.2s ease-in-out infinite; } i:nth-child(2) { animation-delay: .14s; } i:nth-child(3) { animation-delay: .28s; } }
.rankings { display: grid; gap: 6px; max-width: 430px; margin: 14px auto 10px; padding: 0; list-style: none; }
.ranking {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 72px minmax(0, 1fr);
	align-items: center;
	gap: 8px;
	min-width: 0;
	padding: 8px;
	border-radius: 10px;
	background: var(--MI_THEME-bg);
	color: var(--ltl-emoji-vote-bg-fg, var(--MI_THEME-fg));
	animation: winnerIn .52s cubic-bezier(.22, 1, .36, 1) both;
	&[data-rank='1'] { outline: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 40%, transparent); }
	&[data-rank='1'] .rankImage { width: 72px; height: 72px; }
}
.place { display: flex; flex-direction: column; align-items: center; gap: 3px; font-weight: 700; font-size: 12px; white-space: nowrap; }
.rankImage { display: grid; place-items: center; width: 48px; height: 48px; justify-self: center; pointer-events: none; }
.rankDetail { display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 5px; }
.rankName { max-width: 100%; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rankCount { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.caption { font-size: 12px; margin: 6px 0 0; }
.announcement { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.rain, .confetti { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; contain: strict; }
.rain { z-index: 1; isolation: isolate; &[data-fading='true'] { opacity: 0; transition: opacity .3s ease; } }
.confetti { z-index: 2; opacity: 1; transition: opacity .3s ease; &[data-fading='true'] { opacity: 0; } }
.rainTile {
	position: absolute;
	left: var(--x);
	top: var(--y);
	width: var(--size);
	height: var(--size);
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12px;
	background: var(--MI_THEME-panel);
	box-shadow: 0 3px 8px var(--MI_THEME-shadow);
	opacity: 0;
	animation: emojiFall var(--duration) cubic-bezier(.32, .02, .68, 1) var(--delay) both;
	img { width: 94%; height: 94%; object-fit: contain; }
}
.row[data-motion='false'], .row[data-motion='false'] *, .rain[data-motion='false'] { animation: none !important; transition: none !important; }
.rain[data-motion='false'], .confetti[data-motion='false'] { display: none; }
@keyframes waitDot { 0%, 70%, 100% { opacity: .35; transform: translateY(0); } 35% { opacity: 1; transform: translateY(-3px); } }
@keyframes winnerIn { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes emojiFall { from { opacity: 0; transform: translate(var(--drift), var(--from)) rotate(var(--rotate)); } 12% { opacity: 1; } to { opacity: 1; transform: translate(0, 0) rotate(0); } }
@media (hover: hover) { .choice:hover:not(:disabled) { border-color: var(--MI_THEME-fg); transform: translateY(-3px); box-shadow: 0 5px 12px var(--MI_THEME-shadow); } }
@container (max-width: 350px) { .card { padding: 15px; } .state { gap: 10px; } }
.row[data-navbar='true'] {
	width: 100%;
	margin: 0;
	.card { padding: 12px; border: 0; border-radius: 0; }
	.head { gap: 6px; font-size: 11px; }
	.title { font-size: 14px; margin-top: 6px; }
	.subtitle { font-size: 11px; }
	.choices { grid-template-columns: repeat(auto-fit, minmax(44px, 1fr)); gap: 8px; margin-top: 10px; padding: 2px; }
	.choice { box-sizing: border-box; min-height: 72px; gap: 6px; padding: 7px 3px; border-radius: 9px; }
	.choiceImage { width: 36px; height: 36px; }
	.state { gap: 10px; padding: 10px 0 4px; }
	.symbol { width: 36px; height: 36px; flex-basis: 36px; padding: 6px; }
	.stateCopy h2 { font-size: 13px; }
	.stateCopy p { font-size: 11px; }
	.waitDots { padding-top: 6px; }
	.rankings { max-width: none; gap: 4px; margin: 8px 0; }
	.ranking { grid-template-columns: minmax(48px, .6fr) 36px minmax(0, 1fr); gap: 8px; padding: 5px 8px; border-radius: 8px; }
	.place { flex-direction: row; justify-content: center; gap: 4px; font-size: 11px; }
	.rankImage { width: 32px; height: 32px; }
	.ranking[data-rank='1'] .rankImage { width: 36px; height: 36px; }
	.rankDetail { flex-direction: row; justify-content: space-between; gap: 8px; }
	.rankName { min-width: 0; }
	.rankCount { flex: none; font-size: 12px; }
	.caption { font-size: 11px; margin-top: 4px; }
}
@media (prefers-reduced-motion: reduce) { .row, .row * { animation: none !important; transition: none !important; } .rain, .confetti { display: none !important; } }
</style>
