<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="example" :data-page="page" :data-motion="motion" :style="{ '--notice-duration': `${noticeDuration}ms` }" aria-hidden="true">
	<div class="screen">
		<div class="screenHead">
			<strong class="brand">HataFeed</strong>
			<div class="tools">
				<div class="createDock">
					<span class="add" :data-open="page === 'create' && !draftOpen"><i class="ti ti-plus"></i></span>
					<span class="project"><i class="ti ti-flag-2"></i><span>Hataskey</span></span>
					<div v-if="page === 'create' && !draftOpen" class="createMenu">
						<div class="row"><i class="ti ti-mood-plus"></i>{{ exampleCopy.emojiRequest }}</div>
						<div class="row"><i class="ti ti-pencil-plus"></i>{{ exampleCopy.newIssue }}</div>
					</div>
				</div>
				<i class="ti ti-bell"></i><i class="ti ti-refresh"></i><i class="ti ti-settings"></i>
			</div>
		</div>
		<div class="navbar">
			<span class="previewExit"><i class="ti ti-logout-2"></i></span>
			<div ref="capsule" class="capsule">
				<svg v-if="page === 'notifications' && noticeOpen" class="noticeRing" data-integrated="true" :viewBox="`0 0 ${outlineSize.width} ${outlineSize.height}`">
					<path v-for="(path, index) in outlinePaths" :key="index" :d="path" pathLength="1"/>
				</svg>
				<div class="navSurface">
					<div class="tabs">
						<span :data-active="page === 'home'"><i class="ti ti-home"></i><small v-if="page === 'home'">{{ exampleCopy.home }}</small></span>
						<span :data-active="page === 'issues' || page === 'create'"><i class="ti ti-clipboard-list"></i><small v-if="page === 'issues' || page === 'create'">{{ exampleCopy.issues }}</small></span>
						<span :data-active="page === 'roadmap'"><i class="ti ti-route"></i><small v-if="page === 'roadmap'">{{ exampleCopy.roadmap }}</small></span>
						<span v-if="isStaff" :data-active="page === 'admin'"><i class="ti ti-mood-cog"></i><small v-if="page === 'admin'">{{ exampleCopy.requestManagement }}</small></span>
						<span><i class="ti ti-flask"></i></span>
					</div>
					<div class="notice" :data-open="page === 'notifications' && noticeOpen" :data-leaving="noticeLeaving">
						<div class="noticeMessage"><i class="ti ti-circle-check"></i>{{ exampleCopy.updated }}<i class="ti ti-x noticeClose"></i></div>
					</div>
				</div>
			</div>
		</div>
		<template v-if="page === 'home'">
			<div class="cards">
				<section class="card"><h4><i class="ti ti-route"></i>{{ exampleCopy.upcomingPlans }}</h4><p>{{ exampleCopy.calendarImprovement }}</p><small>{{ exampleCopy.inProgress }}</small><p>{{ exampleCopy.issueSearchImprovement }}</p><small>{{ exampleCopy.planned }}</small></section>
				<section class="card"><h4><i class="ti ti-mood-smile"></i>{{ exampleCopy.yourEmojiRequests }}</h4><div class="row"><span class="emoji">🌱</span><span>:wakaba:<small class="line">{{ exampleCopy.pending }}</small></span></div><div class="row"><span class="emoji">☕</span><span>:otsukaresama:<small class="line">{{ exampleCopy.approved }}</small></span></div></section>
			</div>
			<section class="card"><h4>{{ exampleCopy.issues }} <small>{{ exampleCopy.viewList }}</small></h4><div class="row"><i class="ti ti-circle-dashed"></i><span>{{ exampleCopy.overlapIssue }}<small class="line">{{ exampleCopy.bugInProgress }}</small></span></div><div class="row"><i class="ti ti-circle-dot"></i><span>{{ exampleCopy.rememberBookFilters }}<small class="line">{{ exampleCopy.featureOpen }}</small></span></div></section>
		</template>
		<template v-else-if="page === 'create'">
			<div class="editorScene">
				<section class="card centered"><h4>{{ exampleCopy.newIssue }}</h4><div class="steps">{{ exampleCopy.issueSteps }}</div><div class="cards choices"><span><i class="ti ti-bug"></i>{{ exampleCopy.bug }}</span><span><i class="ti ti-bulb"></i>{{ exampleCopy.featureRequest }}</span><span><i class="ti ti-help-circle"></i>{{ exampleCopy.unresolved }}</span><span><i class="ti ti-message-circle"></i>{{ exampleCopy.other }}</span></div></section>
				<div v-if="draftOpen" class="draftBackdrop">
					<section class="card centered draftPrompt">
						<h4>{{ exampleCopy.draftQuestion }}</h4><p>{{ exampleCopy.draftHint }}</p>
						<div class="draftActions"><span class="action primary">{{ exampleCopy.saveDraft }}</span><span class="action">{{ exampleCopy.discardDraft }}</span><span class="action">{{ exampleCopy.returnToEdit }}</span></div>
					</section>
				</div>
			</div>
		</template>
		<template v-else-if="page === 'issues'">
			<section class="card"><h4>{{ exampleCopy.issues }}</h4><div class="search"><i class="ti ti-search"></i>{{ exampleCopy.calendar }}<i class="ti ti-arrow-right searchSubmit"></i></div><div class="chips"><span>{{ exampleCopy.open }}</span><span>{{ exampleCopy.category }}</span><span>{{ exampleCopy.status }}</span></div><div class="row"><i class="ti ti-circle-dashed"></i><span>{{ exampleCopy.overlapIssue }}<small class="line">{{ exampleCopy.bugInProgress }}</small></span></div></section>
			<section class="card"><small><i class="ti ti-arrow-left"></i> {{ exampleCopy.issues }}</small><h4>{{ exampleCopy.overlapIssue }}</h4><p>{{ exampleCopy.overlapDetail }}</p><div class="row"><i class="ti ti-message-circle"></i><span>{{ exampleCopy.overlapComment }}</span></div></section>
		</template>
		<template v-else-if="page === 'emoji'">
			<section class="card centered"><h4>{{ exampleCopy.requestEmoji }}</h4><div class="steps">{{ exampleCopy.emojiSteps }}</div><div class="cards choices"><span><i class="ti ti-photo"></i>{{ exampleCopy.ownImage }}</span><span><i class="ti ti-world"></i>{{ exampleCopy.remoteEmoji }}</span></div><div class="row"><span class="emoji large">🌱</span><div class="fields"><small>{{ exampleCopy.emojiName }}</small><span>wakaba</span><small>{{ exampleCopy.license }}</small><span>{{ exampleCopy.selfMadeLicense }}</span></div></div></section>
			<section class="card"><h4>{{ exampleCopy.yourEmojiRequests }}</h4><div class="row"><span class="emoji">🌱</span><span>:wakaba: <small>{{ exampleCopy.approved }}</small><small class="line">{{ exampleCopy.licenseChecked }}</small></span></div></section>
		</template>
		<template v-else-if="page === 'roadmap'">
			<section class="card"><h4><i class="ti ti-route"></i>{{ exampleCopy.roadmap }}</h4><div class="row"><i class="ti ti-circle-dashed"></i><span>{{ exampleCopy.calendarImprovement }}<small class="line">{{ exampleCopy.inProgress }}</small></span></div><div class="row"><i class="ti ti-calendar-clock"></i><span>{{ exampleCopy.issueSearchImprovement }}<small class="line">{{ exampleCopy.planned }}</small></span></div></section>
			<section class="card"><h4><i class="ti ti-flask"></i>{{ exampleCopy.betaFeatures }}</h4><p>{{ exampleCopy.postCountdown }}</p></section>
		</template>
		<template v-else-if="page === 'notifications'">
			<section class="card"><h4><i class="ti ti-bell"></i>{{ exampleCopy.notifications }} <span class="notificationTools"><i class="ti ti-checks"></i><i class="ti ti-filter"></i><i class="ti ti-x"></i></span></h4><div class="row"><i class="ti ti-message-circle"></i><span>{{ exampleCopy.commentReceived }}<small class="line">{{ exampleCopy.confirmed }}</small></span></div><div class="row"><i class="ti ti-mood-smile"></i><span>{{ exampleCopy.emojiApproved }}<small class="line">:wakaba:</small></span></div></section>
		</template>
		<template v-else-if="page === 'admin'">
			<section class="card"><h4>{{ exampleCopy.emojiManagement }}</h4><div class="chips"><span>{{ exampleCopy.pending }}</span><span>{{ exampleCopy.held }}</span><span>{{ exampleCopy.approved }}</span></div><div class="row"><span class="emoji">🌱</span><span>:wakaba:<small class="line">{{ exampleCopy.pending }}</small></span><span class="tag">{{ exampleCopy.review }}</span></div></section>
			<section class="card centered"><h4>{{ exampleCopy.reviewEmoji }}</h4><span class="emoji large">🌱</span><p>wakaba</p><small>{{ exampleCopy.licenseSample }}</small><div class="chips"><span>{{ exampleCopy.hold }}</span><span>{{ exampleCopy.reject }}</span><span class="primary">{{ exampleCopy.approveNext }}</span></div></section>
		</template>
		<template v-else-if="page === 'settings'">
			<section class="card centered"><h4><i class="ti ti-settings"></i>{{ exampleCopy.settings }}</h4><p>{{ exampleCopy.theme }}</p><div class="themes"><span>{{ exampleCopy.light }}</span><span>{{ exampleCopy.dark }}</span><span>{{ exampleCopy.paper }}</span><span>{{ exampleCopy.espresso }}</span></div><p>{{ exampleCopy.project }}</p><div class="projectChoice"><i class="ti ti-flag-2"></i><span>Hataskey</span></div><div v-if="kind === 'update'" class="chips"><span>{{ exampleCopy.export }}</span><span>{{ exampleCopy.editProject }}</span></div><small v-if="kind === 'update'">{{ exampleCopy.permissionOnly }}</small><h4 class="sectionTitle">{{ exampleCopy.tutorial }}</h4><span class="action"><i class="ti ti-book"></i>{{ exampleCopy.howToUse }}</span><span class="action"><i class="ti ti-sparkles"></i>{{ exampleCopy.whatIsNew }}</span></section>
		</template>
	</div>
</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import type { HataFeedTutorialKind } from '@/utility/hatafeed-tutorial-content.js';
import { NOTIFICATION_TOAST_DURATION, notificationOutlinePaths } from '@/utility/hataskey-notification-toast.js';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

const exampleCopy = i18n.ts._hata._hatafeed._tutorialExample;
const props = defineProps<{ page: string; kind: HataFeedTutorialKind; isStaff: boolean }>();
const capsule = useTemplateRef('capsule');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = ref(reducedMotionQuery.matches);
const motion = computed(() => prefer.r.animation.value && !reducedMotion.value);
const noticeDuration = NOTIFICATION_TOAST_DURATION;
const noticeOpen = ref(false);
const noticeLeaving = ref(false);
const draftOpen = ref(false);
const outlineSize = shallowRef({ width: 1, height: 1, radius: 20 });
const outlinePaths = computed(() => notificationOutlinePaths(outlineSize.value.width, outlineSize.value.height, outlineSize.value.radius, true));

function measureOutline() {
	const element = capsule.value;
	if (!element) return;
	// The guide scales its preview; paths need layout dimensions before that scale.
	outlineSize.value = { width: element.offsetWidth, height: element.offsetHeight, radius: parseFloat(getComputedStyle(element).borderTopLeftRadius) || 20 };
}

const observer = new ResizeObserver(measureOutline);

function updateMotion(event: MediaQueryListEvent) { reducedMotion.value = event.matches; }

watch([() => props.page, () => props.kind, motion], ([page, kind, animate], _, onCleanup) => {
	const timers: number[] = [];
	noticeOpen.value = page === 'notifications' && !animate;
	noticeLeaving.value = false;
	draftOpen.value = page === 'create' && kind === 'update' && !animate;
	if (page === 'notifications' && animate) {
		timers.push(window.setTimeout(() => { noticeOpen.value = true; }, 500));
		timers.push(window.setTimeout(() => { noticeLeaving.value = true; noticeOpen.value = false; }, 500 + noticeDuration));
	}
	if (page === 'create' && kind === 'update' && animate) {
		timers.push(window.setTimeout(() => { draftOpen.value = true; }, 2400));
	}
	onCleanup(() => timers.forEach(timer => window.clearTimeout(timer)));
}, { immediate: true });

onMounted(() => {
	if (capsule.value) observer.observe(capsule.value);
	measureOutline();
	reducedMotionQuery.addEventListener('change', updateMotion);
});
onUnmounted(() => { observer.disconnect(); reducedMotionQuery.removeEventListener('change', updateMotion); });
</script>

<style scoped>
.example { container: hf-tutorial-example / inline-size; width: 100%; color: var(--hy-ink); font-family: 'Hatady Body', system-ui, sans-serif; font-size: 12px; line-height: 1.65; }
.example *, .example *::before, .example *::after { box-sizing: border-box; }
.screen { position: relative; display: grid; gap: 12px; padding: 16px; border: 1px solid var(--hy-border); border-radius: 24px; background: var(--hy-bg); box-shadow: var(--hy-shadow); }
.screenHead, .tools, .notificationTools, .createDock, .row, .tabs, .tabs > span, .chips, h4 { display: flex; align-items: center; gap: 8px; }
.screenHead { flex-wrap: wrap; justify-content: space-between; }
.brand { font: 24px 'Hatady Brand', sans-serif; color: var(--hy-accent); }
.tools, .notificationTools { margin-left: auto; font-size: 16px; }
.tools { position: relative; flex: none; gap: 6px; }
.createDock { gap: 4px; }
.project { display: flex; align-items: center; gap: 4px; font-size: 10px; }
.add, .primary { background: var(--hy-accent) !important; color: var(--hy-on-accent) !important; }
.add { flex: none; display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border-radius: 50%; }
.add > i { display: grid; place-items: center; width: 1em; height: 1em; line-height: 1; transition: transform .22s ease; }
.add > i::before { font-size: 100%; line-height: 1; }
.add[data-open='true'] > i { transform: rotate(45deg); }
/* Match HataFeedHeader: reserve the tabs only and float the expanded surface. */
.navbar { display: flex; align-items: flex-start; justify-content: center; gap: 8px; height: 40px; min-width: 0; }
.previewExit { display: grid; place-items: center; flex: none; width: 30px; height: 30px; margin-top: 5px; border: 1px solid var(--hy-border); border-radius: 50%; background: var(--hy-surface); }
.capsule { position: relative; z-index: 2; isolation: isolate; width: max-content; max-width: 100%; min-width: 0; border-radius: 20px; }
.navSurface { position: relative; display: flex; flex-direction: column; align-items: center; max-width: 100%; border: 1px solid var(--hy-border); border-radius: inherit; background: var(--hy-surface); box-shadow: var(--hy-shadow); overflow: hidden; }
.tabs { justify-content: center; gap: 2px; padding: 4px; }
.tabs > span { padding: 5px 9px; border-radius: 99px; }
.tabs [data-active='true'] { color: var(--hy-accent); background: var(--hy-soft); }
.tabs small { color: inherit; font-size: 11px; }
.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.card { min-width: 0; padding: 14px; border: 1px solid var(--hy-border); border-radius: 18px; background: var(--hy-surface); }
h4 { margin: 0 0 12px; font-size: 13px; line-height: 1.5; }
h4 > small { margin-left: auto; }
p { margin: 8px 0 2px; }
small { color: var(--hy-muted); font-size: 10px; }
.row { padding: 9px 0; }
.row + .row { border-top: 1px solid var(--hy-border); }
.row .ti { color: var(--hy-accent); font-size: 17px; flex: none; }
.line { display: block; }
.emoji { display: inline-grid; place-items: center; flex: none; width: 34px; height: 36px; font-size: 24px; background: var(--hy-soft); border-radius: 10px; }
.emoji.large { width: 70px; height: 74px; font-size: 46px; margin: 0 auto; }
.centered { text-align: center; }
.centered h4 { justify-content: center; }
.createMenu { position: absolute; top: calc(100% + 8px); left: 0; z-index: 4; display: grid; width: 180px; max-width: 100%; padding: 6px; border: 1px solid var(--hy-border); border-radius: 16px; background: var(--hy-surface); box-shadow: var(--hy-shadow); font-size: 12px; }
.createMenu .row { padding: 10px; }
.createMenu .row + .row { border: 0; }
.editorScene { min-width: 0; border-radius: inherit; }
.draftBackdrop { position: absolute; z-index: 5; inset: 0; display: grid; place-items: center; padding: 12px; border-radius: inherit; background: color-mix(in srgb, var(--hy-ink) 28%, transparent); }
.draftPrompt { width: min(100%, 330px); margin: auto; box-shadow: var(--hy-shadow); }
.draftPrompt h4 { margin-bottom: 8px; }
.draftPrompt p { color: var(--hy-muted); font-size: 10px; }
.draftActions { display: grid; gap: 8px; margin-top: 14px; }
.draftActions .action { margin: 0; }
.choices > span { display: grid; place-items: center; gap: 6px; padding: 12px 4px; border: 1px solid var(--hy-border); border-radius: 12px; }
.choices .ti { font-size: 22px; color: var(--hy-accent); }
.steps { margin: 6px 0 12px; color: var(--hy-accent); font-size: 11px; }
.action { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; padding: 9px; border: 1px solid var(--hy-border); border-radius: 99px; background: var(--hy-soft); }
.search, .projectChoice { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 99px; background: var(--hy-bg); }
.searchSubmit { margin-left: auto; }
.projectChoice { position: relative; justify-content: center; padding-inline: 38px; text-align: center; }
.projectChoice > i { position: absolute; left: 12px; }
.chips { justify-content: center; flex-wrap: wrap; margin-top: 10px; gap: 6px; }
.chips > span, .tag { padding: 4px 8px; border-radius: 99px; background: var(--hy-soft); font-size: 10px; }
.tag { margin-left: auto; }
.fields { display: grid; flex: 1; gap: 4px; text-align: left; }
.fields > span { padding: 6px 10px; border: 1px solid var(--hy-border); border-radius: 9px; }
.notice { position: relative; flex: none; width: 0; min-width: 100%; height: 0; overflow: hidden; transition: height .35s cubic-bezier(.22,1,.36,1); }
.notice[data-open='true'] { height: 48px; }
.noticeMessage { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; height: 48px; padding: 8px 28px 8px 12px; white-space: nowrap; opacity: 0; transform: translateY(-12px); transition: opacity .28s ease, transform .3s cubic-bezier(.22,1,.36,1); }
.notice[data-open='true'] .noticeMessage { opacity: 1; transform: translateY(0); }
.notice[data-leaving='true'] .noticeMessage { transform: translateY(calc(100% + 12px)); }
.noticeClose { position: absolute; right: 8px; }
.noticeRing { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; z-index: -1; fill: none; stroke: var(--MI_THEME-accent); stroke-width: 40; stroke-linecap: round; filter: blur(14px); opacity: .55; pointer-events: none; }
.noticeRing path { vector-effect: non-scaling-stroke; stroke-dasharray: 1 1; stroke-dashoffset: 1; animation: noticeTimer var(--notice-duration) linear forwards; }
@keyframes noticeTimer { to { stroke-dashoffset: 0; } }
.example[data-motion='false'] .add > i, .example[data-motion='false'] .notice, .example[data-motion='false'] .noticeMessage { transition: none; }
.example[data-motion='false'] .noticeRing path { animation: none; stroke-dashoffset: .35; }
@media (prefers-reduced-motion: reduce) {
	.add > i, .notice, .noticeMessage { transition: none; }
	.noticeRing path { animation: none; stroke-dashoffset: .35; }
}
.themes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 6px; }
.themes > span { padding: 18px 0; border: 1px solid var(--hy-border); border-radius: 10px; background: var(--hy-bg); font-size: 9px; }
.sectionTitle { margin-top: 18px; }
@container hf-tutorial-example (max-width: 340px) {
	.tabs small { display: none; }
}
</style>
