<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div v-if="expanded && !suspended" :class="$style.scrim" data-mobile-scrim @pointerdown.stop.prevent @click.stop.prevent="closeOverlay" @wheel.prevent @contextmenu.prevent></div>
<section v-show="!suspended" ref="dock" :class="$style.dock" :inert="suspended" :aria-hidden="suspended ? true : undefined" :data-open="opened" :data-search-open="searchOpened" :data-composer-open="composerOpened || confirmationActive" :data-motion="motion" :data-home="home" :data-pull-active="pullVisible" :data-pull-phase="pullVisible ? pullState?.phase : undefined" :data-overflow="composerOverflow" :data-composer-resizing="composerGeometryAnimating" :data-picker-morphing="pickerMorphing" :style="{ '--keyboard-inset': `${keyboardInset}px`, '--guide-height': `${guideHeight}px`, '--dock-clip': `url(#${instanceId}-shape)`, '--compose-right': `${composeRight}px`, '--compose-bottom': `${composeBottom}px`, ...pullDockStyle }" :role="expanded ? 'dialog' : undefined" :aria-modal="expanded ? true : undefined" :aria-label="searchOpened ? i18n.ts.search : copy.timelines" @keydown="keydown" @click.capture="consumeClick">
	<svg :class="$style.clipDefinition" aria-hidden="true"><defs><clipPath :id="`${instanceId}-shape`" clipPathUnits="userSpaceOnUse"><path ref="dockShape"/></clipPath></defs></svg>
	<div :class="$style.body" :style="{ height: `${bodyHeight + pullExtension}px` }">
		<!-- Never conditionally mount: the Timeline owns the teleported composer and its draft. -->
		<div :id="`${instanceId}-composer`" ref="composerTarget" :class="$style.composer" :data-hidden="expanded || !home || !composerOpened && !confirmationActive" :inert="expanded || !home || !composerOpened && !confirmationActive || pullBusy || suspended" :aria-hidden="expanded || !home || !composerOpened && !confirmationActive || pullBusy || suspended" @focusin="dismissGuide" @transitionrun.capture="composerTransitionStarted" @transitionend.capture="composerTransitionFinished" @transitioncancel.capture="composerTransitionFinished"></div>
		<button v-if="home" ref="composeButton" type="button" :class="$style.composeButton" data-compose-opener :data-compose-kind="composeKind ?? 'note'" :data-hidden="expanded || pullVisible || composerOpened || confirmationActive" :inert="expanded || pullBusy || composerOpened || confirmationActive" :aria-hidden="expanded || pullVisible || composerOpened || confirmationActive" :aria-label="composeKind === 'concrnt' ? 'CTLに投稿' : composeKind === 'hatady' ? i18n.ts._hata._hatasabaUi._simple.record : i18n.ts._hata._hataskeyUi3.note" :aria-controls="composeKind !== 'note' && composeKind ? undefined : `${instanceId}-composer`" :aria-expanded="composeKind !== 'note' && composeKind ? undefined : composerOpened || confirmationActive" @click="emit('compose')"><i v-if="composeKind === 'concrnt'" class="concrnt-icon" aria-hidden="true"></i><BookOpen v-else-if="composeKind === 'hatady'" :size="20"/><Pencil v-else :size="20"/></button>
		<div :class="$style.searchSurface" :data-active="searchOpened" :inert="!searchOpened" :aria-hidden="!searchOpened">
			<MkMobileNavbarSearch ref="searchContent" :active="searchOpened" :maxHeight="searchMaxHeight" :motion="motion" @height="updateSearchHeight" @close="closeSearch()"/>
		</div>
		<Transition :css="motion" :enterActiveClass="$style.pickerEnter" :leaveActiveClass="$style.pickerLeave" :enterFromClass="$style.pickerHidden" :leaveToClass="$style.pickerHidden" @beforeLeave="leaveView">
			<div v-if="opened" :class="$style.picker" :data-editing="editing" :inert="!opened" :aria-hidden="!opened">
				<div :class="$style.toolbar">
					<template v-if="branch || optionsOpen">
						<button type="button" data-action="back" :class="$style.control" :data-candidate="candidate === 'back'" :aria-label="copy.back" @click="back"><ArrowLeft :size="18"/></button>
						<span :class="$style.title">{{ optionsOpen ? copy.options : branchLabel }}</span>
						<button v-if="branch" type="button" data-action="settings" :class="$style.control" :data-candidate="candidate === 'settings'" :aria-label="copy.settings" @click="settings"><Settings :size="18"/></button>
					</template>
					<template v-else>
						<span :class="$style.grip" aria-hidden="true"></span>
						<button type="button" :class="$style.control" :aria-label="copy.options" :disabled="editing" @click="showOptions"><Ellipsis :size="18"/></button>
						<button type="button" :class="$style.control" data-edit :aria-label="editing ? copy.done : copy.reorder" :aria-pressed="editing" @click="toggleEditing"><component :is="editing ? Check : Pencil" :size="18"/></button>
					</template>
				</div>
				<Transition :css="motion" :enterActiveClass="$style.viewEnter" :leaveActiveClass="$style.viewLeave" :enterFromClass="$style.viewHidden" :leaveToClass="$style.viewHidden" @beforeLeave="leaveView" @afterEnter="focusCurrentView">
					<div :key="viewKey" :ref="setList" :class="[$style.list, { [$style.single]: branch || optionsOpen }]" :data-view="optionsOpen ? 'options' : branch || 'root'" @lostpointercapture="lostCapture">
						<template v-if="optionsOpen">
							<button v-for="option in navigation?.options" :key="option.id" type="button" :class="$style.option" :role="typeof option.checked === 'boolean' ? 'checkbox' : undefined" :aria-checked="option.checked" :disabled="option.disabled" @click="option.action()">
								<i :class="option.icon" aria-hidden="true"></i><span>{{ option.label }}</span><Check v-if="option.checked" :size="14"/>
							</button>
						</template>
						<template v-else-if="branch">
							<p v-if="loading" :class="$style.status" role="status">{{ copy.loading }}</p>
							<div v-else-if="loadFailed" :class="$style.status" role="status">{{ copy.loadError }} <button type="button" @click="enterBranch(branch!)">{{ copy.retry }}</button></div>
							<p v-else-if="collections.length === 0" :class="$style.status" role="status">{{ copy.empty }}</p>
							<button v-for="item in collections" v-else :key="item.id" type="button" :class="$style.option" :data-choice="item.id" :data-candidate="candidate === item.id" :aria-pressed="navigation?.selected[branch] === item.id" @click="selectCollection(item.id)">
								<i :class="branchIcon" aria-hidden="true"></i><span>{{ item.name }}</span><Check v-if="navigation?.selected[branch] === item.id" :size="14"/>
							</button>
						</template>
						<template v-else>
							<div v-for="(item, index) in choices" :key="item.id" :class="$style.row" :data-reordering="reordering?.choice === item.id">
								<button type="button" :class="$style.option" :data-choice="item.id" :data-candidate="candidate === item.id" :aria-pressed="navigation?.active === item.id" :aria-haspopup="item.branch ? 'menu' : undefined" :aria-label="editing ? `${item.label}, ${index + 1}/${choices.length}` : item.label" @click="activate(item.id)">
									<i :class="item.icon" aria-hidden="true"></i><span>{{ item.label }}</span><Check v-if="!editing && navigation?.active === item.id" :size="14"/><ChevronRight v-else-if="item.branch && !editing" :size="14"/>
								</button>
								<button v-if="editing" type="button" :class="$style.handle" :data-handle="item.id" :aria-label="`${copy.reorder}: ${item.label}, ${index + 1}/${choices.length}`" @pointerdown="startReorder($event, item.id)"><GripVertical :size="18"/></button>
							</div>
						</template>
					</div>
				</Transition>
			</div>
		</Transition>
	</div>
	<div ref="navShell" :class="$style.navShell" data-mobile-pull-target @click.capture="blockPullClick">
	<TransitionGroup tag="nav" :class="$style.nav" :moveClass="$style.navMove" :enterActiveClass="$style.navEnter" :leaveActiveClass="$style.navLeave" :enterFromClass="$style.navHidden" :leaveToClass="$style.navHidden" :css="motion" :aria-label="copy.navigation" :inert="pullBusy || confirmationActive || composerBlocked" :aria-hidden="pullVisible">
		<div key="menu" :class="$style.navSlot">
			<button :ref="!hasHome ? setHomeButton : undefined" type="button" :data-timeline-opener="!hasHome ? '' : undefined" :class="[$style.navButton, { [$style.menuHold]: !hasHome }]" :aria-label="!hasHome && opened ? copy.close : copy.menu" :aria-expanded="!hasHome && opened || drawerOpen" :aria-haspopup="!hasHome ? 'dialog' : undefined" :aria-keyshortcuts="!hasHome ? 'ArrowUp Shift+F10' : undefined" :disabled="searchOpened || opened && hasHome" @pointerdown="!hasHome && startHold($event)" @lostpointercapture="!hasHome && lostCapture($event)" @pointerleave="!hasHome && leaveHome()" @blur="!hasHome && leaveHome()" @contextmenu.prevent @click="menuClick"><component :is="!hasHome && opened ? X : Menu" :size="20"/></button>
		</div>
		<template v-for="item in items.slice(0, MOBILE_NAV_ITEMS_MAX)" :key="item.path">
			<div v-if="item.path === '/'" :key="item.path" :class="$style.homeSlot">
				<button :ref="setHomeButton" type="button" data-home-button :disabled="searchOpened" :class="[$style.navButton, $style.homeButton]" :data-mobile-nav-path="item.path" :aria-label="timelineLabel" :aria-current="!opened && item.active ? 'page' : undefined" :aria-expanded="opened" aria-haspopup="dialog" @pointerdown="startHold" @lostpointercapture="lostCapture" @pointerleave="leaveHome" @blur="leaveHome" @contextmenu.prevent @click="homeClick"><span :class="$style.homeIcons" :data-open="opened"><Transition :css="motion" :enterActiveClass="$style.iconEnter" :leaveActiveClass="$style.iconLeave" :enterFromClass="$style.iconHidden" :leaveToClass="$style.iconHidden"><span :key="activeTimeline?.id ?? 'home'" :class="$style.activeIcon"><i v-if="activeTimeline" :class="activeTimeline.icon" aria-hidden="true"></i><component :is="item.icon" v-else :size="20"/></span></Transition><X :class="$style.closeIcon" :size="20"/></span></button>
			</div>
			<button v-else-if="item.path === '/search'" :key="item.path" :ref="setSearchButton" type="button" :class="$style.navButton" :data-mobile-nav-path="item.path" :data-active="searchOpened || item.active" :aria-current="!searchOpened && item.active ? 'page' : undefined" :aria-label="searchOpened ? i18n.ts.close : item.label" :aria-expanded="searchOpened" aria-haspopup="dialog" :disabled="opened" @click="toggleSearch"><span :class="$style.searchIcons" :data-open="searchOpened"><component :is="item.icon" :class="$style.searchIcon" :size="20"/><X :class="$style.searchCloseIcon" :size="20"/></span></button>
			<button v-else :key="item.path" type="button" :class="$style.navButton" :data-mobile-nav-path="item.path" :data-active="item.active" :data-brand="item.brand" :aria-label="item.label" :aria-current="item.active ? 'page' : undefined" :disabled="expanded" @click="emit('navigate', item.path)"><component :is="item.icon" :size="20"/><span v-if="item.badge" :class="$style.badge" :aria-label="item.badge"></span></button>
		</template>
	</TransitionGroup>
	</div>
	<div :class="$style.pullPrompt" role="status" :aria-hidden="!pullVisible"><i :class="[displayPullPhase === 'success' ? 'ti ti-check' : displayPullPhase === 'error' ? 'ti ti-exclamation-circle' : displayPullPhase === 'refreshing' ? 'ti ti-refresh' : displayPullDirection === 'up' ? 'ti ti-arrow-up' : 'ti ti-arrow-down', $style.pullIcon]" aria-hidden="true"></i><span>{{ displayPullPhase === 'success' ? i18n.ts.done : displayPullPhase === 'error' ? i18n.ts._hata._hataskeyUi3.loadFailed : displayPullPhase === 'refreshing' ? i18n.ts.refreshing : displayPullPhase === 'ready' ? i18n.ts.releaseToRefresh : displayPullDirection === 'up' ? i18n.ts.pullUpToRefresh : i18n.ts.pullDownToRefresh }}</span></div>
	<Transition appear :css="motion" :enterActiveClass="$style.guideEnter" :leaveActiveClass="$style.guideLeave" :enterFromClass="$style.guideAbove" :leaveToClass="$style.guideBelow" @beforeLeave="leaveView">
		<div v-if="!confirmationActive && !guideSeen && !guideDismissed && !expanded && home && !pullBusy" :class="$style.guide" data-guide>
			<div :class="$style.guideDemo" aria-hidden="true">
				<div :class="$style.guideChoices"><i class="ti ti-list"></i><i class="ti ti-antenna"></i></div>
				<span :class="$style.guidePath"></span>
				<span :class="$style.guideStart"><component :is="hasHome ? House : Menu" :size="17"/></span>
				<Pointer :class="$style.guideFinger" :size="22"/>
			</div>
			<p>{{ hasHome ? copy.guide : copy.guideMenu }}</p>
			<button type="button" @click="dismissGuide">{{ copy.gotIt }}</button>
		</div>
	</Transition>
	<span :class="$style.srOnly" aria-live="polite">{{ announcement }}</span>
</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { ArrowLeft, BookOpen, Check, ChevronRight, Ellipsis, GripVertical, House, Menu, Pencil, Pointer, Settings, X } from '@lucide/vue';
import { containsPoint, mobileArrowOffset, mobileEdgeScroll, moveMobileChoice } from './hk3-mobile-dock-helpers.js';
import type { Hk3MobileCollectionKind, Hk3MobileNavigation, Hk3MobileNavItem } from './hk3-mobile-navigation.js';
import { i18n } from '@/i18n.js';
import MkMobileNavbarSearch from '@/components/MkMobileNavbarSearch.vue';
import { UI_S_BOTTOM_NAV_MAX } from '@/utility/hatasaba-navigation.js';
import type { NavbarPullState } from '@/utility/navbar-pull-refresh.js';

type MobilePullGestureAttacher = (root: HTMLElement, onClaim: () => void, canStart: () => boolean) => { dispose: () => void };
const props = defineProps<{ navigation: Hk3MobileNavigation | null; items: Hk3MobileNavItem[]; home: boolean; drawerOpen: boolean; motion: boolean; guideSeen: boolean; suspended?: boolean; confirmationActive?: boolean; composerBlocked?: boolean; composeKind?: 'note' | 'hatady' | 'concrnt'; pullState?: Readonly<NavbarPullState> | null; attachPullGesture?: MobilePullGestureAttacher | null }>();
const emit = defineEmits<{ navigate: [path: string]; menu: []; requestTimeline: []; menuOpen: [open: boolean]; searchOpen: [open: boolean]; compose: []; dismissGuide: [] }>();
const copy = i18n.ts._hata._hataskeyUi3._mobileNavigation;
const MOBILE_NAV_ITEMS_MAX = UI_S_BOTTOM_NAV_MAX;
const dock = ref<HTMLElement | null>(null);
const navShell = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);

function setList(element: unknown) {
	if (element instanceof HTMLElement) list.value = element;
	else if (!list.value?.isConnected) list.value = null;
}

const homeButton = ref<HTMLButtonElement | null>(null);
const hasHome = computed(() => props.items.slice(0, MOBILE_NAV_ITEMS_MAX).some(item => item.path === '/'));
const lastTimeline = ref<{ id: string; label: string; icon: string } | null>(null);
watch(() => props.navigation, navigation => {
	const active = navigation?.choices.find(item => item.id === navigation.active);
	if (active) lastTimeline.value = { id: active.id, label: active.label, icon: active.icon };
}, { immediate: true });
const activeTimeline = computed(() => lastTimeline.value);
const timelineLabel = computed(() => opened.value ? copy.close : `${hasHome.value ? copy.home : copy.timelines}: ${activeTimeline.value?.label ?? copy.timelines}`);

function setHomeButton(element: unknown) {
	if (element instanceof HTMLButtonElement) homeButton.value = element;
	else if (!homeButton.value?.isConnected) homeButton.value = null;
}

const composerTarget = ref<HTMLElement | null>(null);
const composeButton = ref<HTMLButtonElement | null>(null);
const dockShape = ref<SVGPathElement | null>(null);
const composeRight = ref(14);
const composeBottom = ref(2);
const dockHeight = ref(0);
const composerHeight = ref(120);
const composerGeometryAnimating = ref(false);
const pickerMorphing = ref(false);
const keyboardInset = ref(0);
const composerOverflow = computed(() => composerHeight.value > Math.max(0, viewportHeight.value - 150));
const guideHeight = ref(180);
const viewportHeight = ref(typeof window === 'undefined' ? 640 : window.innerHeight);
const opened = ref(false);
const searchOpened = ref(false);
const composerOpened = ref(false);
const expanded = computed(() => opened.value || searchOpened.value);
const pullBusy = computed(() => !props.suspended && props.home && props.pullState != null && props.pullState.phase !== 'idle');
const pullVisible = computed(() => pullBusy.value && !props.drawerOpen && !expanded.value && props.pullState?.presentation !== 'navbar');
const displayPullPhase = ref<NavbarPullState['phase']>('pulling');
const displayPullDirection = ref<'up' | 'down'>('down');
watch(() => props.pullState, state => {
	if (!state || state.phase === 'idle') return;
	displayPullPhase.value = state.phase;
	displayPullDirection.value = state.direction ?? 'down';
}, { immediate: true });
const pullHeight = computed(() => pullVisible.value ? Math.max(0, props.pullState?.height ?? 0) : 0);
const pullExtension = computed(() => Math.min(40, pullHeight.value * 0.5));
const pullDockStyle = computed(() => {
	const height = pullHeight.value;
	const progress = Math.min(1, Math.max(0, (height - 3) / 54));
	return {
		'--dock-pull-extension': `${pullExtension.value}px`,
		'--dock-pull-content-opacity': String(pullVisible.value && props.pullState?.phase === 'refreshing' ? 0 : 1 - progress),
		'--dock-pull-prompt-opacity': String(pullVisible.value && props.pullState?.phase === 'refreshing' ? 1 : Math.min(1, Math.max(0, (height - 15) / 40))),
		'--dock-pull-turn': `${Math.min(1, height / 59) * 180}deg`,
		transform: pullVisible.value ? `translateY(-${Math.min(12, height * 0.15)}px)` : undefined,
	};
});
const searchContent = ref<InstanceType<typeof MkMobileNavbarSearch> | null>(null);
const searchButton = ref<HTMLButtonElement | null>(null);
const searchHeight = ref(59);
const searchMaxHeight = computed(() => Math.max(0, viewportHeight.value - 150));
let searchFocusVersion = 0;
let searchLayoutHeight: number | null = null;
let searchReturnTimer: number | undefined;
const pendingOpen = ref(false);
const editing = ref(false);
const optionsOpen = ref(false);
const branch = ref<Hk3MobileCollectionKind | null>(null);
const collections = ref<{ id: string; name: string }[]>([]);
const loading = ref(false);
const loadFailed = ref(false);
const order = ref<string[]>([]);
const candidate = ref<string | null>(null);
const announcement = ref('');
const guideDismissed = ref(false);
const choices = computed(() => order.value.flatMap(id => props.navigation?.choices.filter(item => item.id === id) ?? []));
const branchLabel = computed(() => props.navigation?.choices.find(item => item.branch === branch.value)?.label ?? '');
const viewKey = computed(() => optionsOpen.value ? 'options' : branch.value ?? 'root');
const branchIcon = computed(() => props.navigation?.choices.find(item => item.branch === branch.value)?.icon ?? '');
const bodyHeight = computed(() => searchOpened.value ? Math.min(searchHeight.value, searchMaxHeight.value) : opened.value ? Math.max(72, Math.min((optionsOpen.value ? props.navigation?.options.length ?? 0 : branch.value ? Math.max(1, collections.value.length) : Math.ceil(choices.value.length / 2)) * 58 + 64, viewportHeight.value - 150)) : props.home ? composerOpened.value || props.confirmationActive ? Math.min(composerHeight.value, Math.max(0, viewportHeight.value - 150)) : 44 : 0);
// Stable names are useful to parent integrations and DOM inspection, without global IDs.
const instanceId = useId();
let opener: HTMLElement | null = null;
let preferredFocus: string | undefined;
let loadVersion = 0;
let mounted = true;
let observer: ResizeObserver | undefined;
let composerMutation: MutationObserver | undefined;
const geometryTransitions = new Map<Element, Set<string>>();
let geometrySettleFrame = 0;
let viewportSettleFrame = 0;
let viewportSettleTimers: number[] = [];
let pickerMorphTimer: number | undefined;
let frame = 0;
let lastFrame = 0;
let dwellTimer: number | undefined;
let dwellTarget: string | null = null;
let suppressClick = false;
let hold: { id: number; x: number; y: number; timer: number } | null = null;
let slide: { id: number; x: number; y: number; originX: number; originY: number; armed: boolean } | null = null;
const reordering = ref<{ id: number; choice: string; order: string[]; x: number; y: number; originX: number; originY: number; started: boolean } | null>(null);
let pullGesture: ReturnType<MobilePullGestureAttacher> | null = null;
let outsideComposerPointer: { id: number; x: number; y: number } | null = null;

watch([navShell, () => props.attachPullGesture], ([shell, attach]) => {
	pullGesture?.dispose();
	pullGesture = shell && attach ? attach(shell, () => { clearHold(); suppressClick = true; }, () => !props.suspended && props.home && !props.drawerOpen && !expanded.value && !slide && !reordering.value) : null;
}, { immediate: true, flush: 'post' });

watch(() => props.navigation?.choices.map(item => item.id), (ids, previous) => {
	if (!reordering.value && (ids ?? []).join('\0') !== (previous ?? []).join('\0')) order.value = [...ids ?? []];
}, { immediate: true });
watch(() => props.navigation, navigation => {
	if (navigation && pendingOpen.value) reveal();
	else if (!navigation && opened.value) closeMenu();
});
watch(() => props.drawerOpen, value => { if (value) { closeComposer(true); closeSearch(false); closeMenu(); } });
watch(() => props.home, value => { if (!value) closeComposer(true); });
watch(() => props.composeKind, value => { if (value === 'hatady' || value === 'concrnt') closeComposer(true); });
watch(() => props.confirmationActive, value => { if (value) openComposer(); });
watch(() => props.suspended, suspended => {
	if (suspended) {
		closeComposer(true);
		closeSearch(false);
		closeMenu(false);
		window.clearTimeout(searchReturnTimer);
		searchLayoutHeight = null;
		window.clearTimeout(pickerMorphTimer);
		pickerMorphing.value = false;
	} else void nextTick(() => { if (mounted && !props.suspended) measureGeometry(); });
}, { immediate: true, flush: 'sync' });
watch(() => props.items.slice(0, MOBILE_NAV_ITEMS_MAX).some(item => item.path === '/search'), visible => { if (!visible) closeSearch(false); });

function dismissGuide() {
	if (guideDismissed.value || props.guideSeen) return;
	guideDismissed.value = true;
	emit('dismissGuide');
}

function openComposer() {
	if (props.suspended || !props.home || pullBusy.value) return;
	closeSearch(false);
	closeMenu(false);
	composerOpened.value = true;
	void nextTick(measureGeometry);
}

function closeComposer(force = false) {
	if (!force && (props.composerBlocked || props.confirmationActive || pullBusy.value)) return false;
	if (!composerOpened.value) return true;
	const active = window.document.activeElement;
	if (active instanceof HTMLElement && composerTarget.value?.contains(active)) active.blur();
	composerOpened.value = false;
	void nextTick(measureGeometry);
	return true;
}

function clearDwell() {
	window.clearTimeout(dwellTimer);
	dwellTimer = undefined;
	dwellTarget = null;
}

function clearHold(consume = true) {
	if (!hold) return;
	window.clearTimeout(hold.timer);
	hold = null;
	if (consume) suppressClick = true;
}

function releaseCapture(target: HTMLElement | null, id: number) {
	if (target?.hasPointerCapture?.(id)) target.releasePointerCapture(id);
}

function stopSlide() {
	clearDwell();
	if (!slide) return;
	const id = slide.id;
	slide = null;
	candidate.value = null;
	suppressClick = true;
	stopFrame();
	releaseCapture(homeButton.value, id);
}

function resetArm() {
	clearDwell();
	candidate.value = null;
	if (slide) {
		slide.originX = slide.x;
		slide.originY = slide.y;
		slide.armed = false;
	}
}

function focusCurrentView() { focusChoice(preferredFocus); }

function focusChoice(id?: string) {
	preferredFocus = id;
	void nextTick(() => {
		if (!opened.value || slide) return;
		const buttons = choiceButtons();
		const target = buttons.find(button => button.dataset.choice === id) ?? buttons[0] ?? dock.value?.querySelector<HTMLButtonElement>('[data-action="back"], [data-edit], [data-home-button], [data-timeline-opener]');
		target?.focus({ preventScroll: true });
		if (target) revealRow(target);
	});
}

function reveal() {
	if (props.suspended || pullBusy.value || opened.value || !props.navigation) return;
	if (props.confirmationActive || props.composerBlocked) return;
	closeComposer(true);
	pendingOpen.value = false;
	opener = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : homeButton.value;
	branch.value = null;
	optionsOpen.value = false;
	editing.value = false;
	opened.value = true;
	startPickerMorph();
	dismissGuide();
	emit('menuOpen', true);
	if (slide) homeButton.value?.focus({ preventScroll: true });
	else focusChoice(props.navigation.active);
}

function openMenu() {
	if (props.suspended || pullBusy.value || props.confirmationActive || props.composerBlocked) return;
	closeComposer(true);
	closeSearch(false);
	if (opened.value || pendingOpen.value) return;
	if (!props.navigation) {
		pendingOpen.value = true;
		dismissGuide();
		emit('requestTimeline');
	} else reveal();
}

async function openCollection(kind: Hk3MobileCollectionKind) {
	if (props.suspended || pullBusy.value || !props.home || !props.navigation) return;
	openMenu();
	await nextTick();
	if (!mounted || props.suspended || !props.home || !props.navigation || !opened.value) return;
	finishReorder(true);
	editing.value = false;
	await enterBranch(kind);
}

function closeMenu(restoreFocus = true) {
	const wasOpen = opened.value;
	pendingOpen.value = false;
	clearHold();
	stopSlide();
	finishReorder(true);
	clearDwell();
	loadVersion++;
	opened.value = false;
	editing.value = false;
	branch.value = null;
	optionsOpen.value = false;
	if (wasOpen) {
		startPickerMorph();
		emit('menuOpen', false);
		if (restoreFocus && !props.suspended && opener?.isConnected) opener.focus({ preventScroll: true });
	}
}

function setSearchButton(element: unknown) {
	searchButton.value = element instanceof HTMLButtonElement ? element : null;
}

function updateSearchHeight(height: number) {
	if (Number.isFinite(height) && height > 0) searchHeight.value = height;
}

function openSearch() {
	if (props.suspended || pullBusy.value || searchOpened.value || props.confirmationActive || props.composerBlocked) return;
	closeComposer(true);
	searchFocusVersion++;
	const focusOrigin = window.document.activeElement;
	window.clearTimeout(searchReturnTimer);
	searchLayoutHeight ??= dockHeight.value;
	closeMenu(false);
	suppressClick = false;
	searchOpened.value = true;
	startPickerMorph();
	dismissGuide();
	emit('searchOpen', true);
	void nextTick(() => {
		const active = window.document.activeElement;
		if (!props.suspended && searchOpened.value && !dock.value?.closest('[inert]') && (active === focusOrigin || active === window.document.body || active instanceof Node && dock.value?.contains(active))) searchContent.value?.focus();
	});
}

function closeSearch(restoreFocus = true) {
	const version = ++searchFocusVersion;
	if (!searchOpened.value) return;
	searchOpened.value = false;
	startPickerMorph();
	emit('searchOpen', false);
	const releaseHeight = () => {
		if (searchOpened.value) return;
		searchLayoutHeight = null;
		measureGeometry();
	};
	if (mounted && props.motion) searchReturnTimer = window.setTimeout(releaseHeight, 460);
	else if (mounted) void nextTick(releaseHeight);
	if (restoreFocus) void nextTick(() => {
		const active = window.document.activeElement;
		if (mounted && !props.suspended && version === searchFocusVersion && !searchOpened.value && searchButton.value?.isConnected && (active === window.document.body || active instanceof Node && dock.value?.contains(active))) searchButton.value.focus({ preventScroll: true });
	});
}

function toggleSearch() { if (pullBusy.value) return; if (searchOpened.value) closeSearch(); else openSearch(); }

function blockPullClick(event: MouseEvent) {
	if (!pullBusy.value) return;
	event.preventDefault();
	event.stopImmediatePropagation();
}

function closeOverlay() { if (searchOpened.value) closeSearch(); else closeMenu(); }

async function enterBranch(kind: Hk3MobileCollectionKind) {
	if (!opened.value || editing.value) return;
	const navigation = props.navigation;
	if (!navigation) return;
	const version = ++loadVersion;
	branch.value = kind;
	optionsOpen.value = false;
	collections.value = [];
	loading.value = true;
	loadFailed.value = false;
	resetArm();
	try {
		const result = await navigation.load(kind);
		if (version !== loadVersion || !mounted || !opened.value || branch.value !== kind) return;
		collections.value = result ?? [];
		loadFailed.value = result === null;
	} catch {
		if (version === loadVersion && mounted && branch.value === kind) loadFailed.value = true;
	} finally {
		if (version === loadVersion && mounted && branch.value === kind) {
			loading.value = false;
			// Loading may replace the row under a held finger: require fresh movement again.
			resetArm();
			focusChoice(navigation.selected[kind] ?? undefined);
		}
	}
}

function back() {
	const id = props.navigation?.choices.find(item => item.branch === branch.value)?.id;
	loadVersion++;
	branch.value = null;
	optionsOpen.value = false;
	resetArm();
	focusChoice(id);
}

function settings() {
	const kind = branch.value;
	const navigation = props.navigation;
	if (!kind || !navigation) return;
	closeMenu();
	navigation.settings(kind);
}

function showOptions() {
	if (editing.value || slide) return;
	optionsOpen.value = true;
	resetArm();
	void nextTick(() => dock.value?.querySelector<HTMLButtonElement>('[data-action="back"]')?.focus());
}

function activate(id: string) {
	if (editing.value || !opened.value) return;
	const item = choices.value.find(choice => choice.id === id);
	if (!item) return;
	if (item.branch) void enterBranch(item.branch);
	else { props.navigation?.select(id); closeMenu(); }
}

function selectCollection(id: string) {
	if (!branch.value || !collections.value.some(item => item.id === id)) return;
	props.navigation?.selectCollection(branch.value, id);
	closeMenu();
}

function toggleEditing() {
	if (slide || branch.value || optionsOpen.value) return;
	finishReorder(true);
	editing.value = !editing.value;
	clearDwell();
}

function homeClick() {
	if (pullBusy.value || suppressClick || slide) return;
	if (props.confirmationActive || props.composerBlocked) return;
	clearHold(false);
	closeComposer(true);
	if (opened.value) closeMenu();
	else emit('navigate', '/');
}

function menuClick() {
	if (pullBusy.value || suppressClick || slide) return;
	if (props.confirmationActive || props.composerBlocked) return;
	clearHold(false);
	closeComposer(true);
	if (opened.value) closeMenu();
	else emit('menu');
}

function consumeClick(event: MouseEvent) {
	if (!suppressClick && !slide && !reordering.value) return;
	event.preventDefault();
	event.stopImmediatePropagation();
}

function startHold(event: PointerEvent) {
	if (props.suspended || pullBusy.value || event.button !== 0 || event.isPrimary === false || opened.value) return;
	clearHold(false);
	suppressClick = false;
	hold = { id: event.pointerId, x: event.clientX, y: event.clientY, timer: window.setTimeout(() => {
		if (!hold || window.document.hidden) return;
		const pending = hold;
		clearHold();
		slide = { id: pending.id, x: pending.x, y: pending.y, originX: pending.x, originY: pending.y, armed: false };
		try { homeButton.value?.setPointerCapture?.(pending.id); } catch { slide = null; }
		openMenu();
		startFrame();
	}, 500) };
}

function leaveHome() { if (!slide) clearHold(); }

function leaveView(element: Element) { element.setAttribute('inert', ''); element.setAttribute('aria-hidden', 'true'); }

function choiceButtons(): HTMLButtonElement[] { return Array.from(list.value?.querySelectorAll<HTMLButtonElement>('[data-choice]') ?? []).filter(button => !button.closest('[inert]')); }

function hit(x: number, y: number): string | null {
	if (!opened.value) return null;
	for (const button of Array.from(dock.value?.querySelectorAll<HTMLButtonElement>('[data-action]') ?? [])) {
		if (!button.closest('[inert]') && containsPoint(button.getBoundingClientRect(), x, y)) return button.dataset.action ?? null;
	}
	if (!list.value || !containsPoint(list.value.getBoundingClientRect(), x, y)) return null;
	return choiceButtons().find(button => containsPoint(button.getBoundingClientRect(), x, y))?.dataset.choice ?? null;
}

function navigateTarget(id: string) {
	if (id === 'back') back();
	else if (id === 'settings') settings();
	else activate(id);
}

function updateSlide() {
	if (!slide || !opened.value) return;
	const target = slide.armed ? hit(slide.x, slide.y) : null;
	candidate.value = target;
	const navigationTarget = target === 'back' || target === 'settings' || (!branch.value && choices.value.some(item => item.id === target && item.branch)) ? target : null;
	if (navigationTarget === dwellTarget) return;
	clearDwell();
	if (!navigationTarget) return;
	dwellTarget = navigationTarget;
	dwellTimer = window.setTimeout(() => {
		if (slide?.armed && candidate.value === navigationTarget) navigateTarget(navigationTarget);
		clearDwell();
	}, 300);
}

function startFrame() {
	if (frame) return;
	lastFrame = 0;
	frame = requestAnimationFrame(scrollFrame);
}

function stopFrame() { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; }

function scrollFrame(timestamp: number) {
	frame = 0;
	const gesture = reordering.value ?? slide;
	if (!gesture) return;
	if (list.value && opened.value) {
		list.value.scrollTop += mobileEdgeScroll(list.value.getBoundingClientRect(), gesture.x, gesture.y, lastFrame ? timestamp - lastFrame : 16);
		if (reordering.value) updateReorder();
		else updateSlide();
	}
	lastFrame = timestamp;
	frame = requestAnimationFrame(scrollFrame);
}

function startReorder(event: PointerEvent, choice: string) {
	if (!editing.value || branch.value || slide || event.button !== 0 || event.isPrimary === false) return;
	event.preventDefault();
	reordering.value = { id: event.pointerId, choice, order: [...order.value], x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, started: false };
	try { list.value?.setPointerCapture?.(event.pointerId); } catch { finishReorder(true); return; }
	startFrame();
}

function reorderHit(x: number, y: number): string | null {
	if (!list.value || !containsPoint(list.value.getBoundingClientRect(), x, y)) return null;
	return choiceButtons().find(button => {
		const row = button.parentElement?.getBoundingClientRect();
		return containsPoint(row && row.width > 0 ? row : button.getBoundingClientRect(), x, y);
	})?.dataset.choice ?? null;
}

function updateReorder() {
	const gesture = reordering.value;
	if (!gesture) return;
	if (Math.hypot(gesture.x - gesture.originX, gesture.y - gesture.originY) >= 8) gesture.started = true;
	if (!gesture.started) return;
	const target = reorderHit(gesture.x, gesture.y);
	if (target && order.value.includes(target)) order.value = moveMobileChoice(order.value, gesture.choice, order.value.indexOf(target));
}

function saveOrder(previous: string[]) {
	if (previous.join('\0') === order.value.join('\0')) return;
	props.navigation?.reorder([...order.value]);
	announcement.value = choices.value.map(item => item.label).join(', ');
}

function finishReorder(cancel: boolean) {
	const gesture = reordering.value;
	if (!gesture) return;
	reordering.value = null;
	if (cancel) order.value = gesture.order;
	else saveOrder(gesture.order);
	suppressClick = true;
	stopFrame();
	releaseCapture(list.value, gesture.id);
}

function pointerDown(event: PointerEvent) {
	outsideComposerPointer = null;
	if (pullBusy.value) return;
	if ((hold && hold.id !== event.pointerId) || (slide && slide.id !== event.pointerId) || (reordering.value && reordering.value.id !== event.pointerId)) { interrupt(); return; }
	if (!slide && !reordering.value) suppressClick = false;
	if (!composerOpened.value || !props.home || props.composerBlocked || props.confirmationActive) return;
	const target = event.target;
	if (!(target instanceof Element) || !target.closest('[data-hk3-theme]') || composerTarget.value?.contains(target) || composeButton.value?.contains(target) || target.closest('[data-mobile-scrim], [role="dialog"], [role="menu"], [data-popup], [data-emoji-picker]')) return;
	// Let the TL gesture sample the open composer before an outside tap closes it.
	if (props.attachPullGesture && target.closest('[data-timeline-tab-gestures]') && !target.closest('button,a,input,textarea,select')) {
		outsideComposerPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
		return;
	}
	closeComposer();
}

function timelineWheel(event: WheelEvent) {
	if (Math.abs(event.deltaY) < 4 || !(event.target instanceof Element) || !event.target.closest('[data-timeline-tab-gestures]')) return;
	closeComposer();
}

function timelineKey(event: KeyboardEvent) {
	if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || !composerOpened.value) return;
	if (event.key === 'Escape' && (composerTarget.value?.contains(event.target as Node) || composeButton.value?.contains(event.target as Node))) {
		if (closeComposer()) { event.preventDefault(); event.stopPropagation(); void nextTick(() => composeButton.value?.focus({ preventScroll: true })); }
		return;
	}
	if (!(event.target instanceof Element) || !event.target.closest('[data-timeline-tab-gestures]')) return;
	if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) closeComposer();
}

function pointerMove(event: PointerEvent) {
	if (outsideComposerPointer?.id === event.pointerId) {
		const dx = Math.abs(event.clientX - outsideComposerPointer.x);
		const dy = event.clientY - outsideComposerPointer.y;
		if (dy < -7 || dx > 7 && dx > Math.abs(dy)) { outsideComposerPointer = null; closeComposer(); }
	}
	if (hold?.id === event.pointerId && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10) clearHold();
	const gesture = reordering.value ?? slide;
	if (!gesture || gesture.id !== event.pointerId) return;
	gesture.x = event.clientX;
	gesture.y = event.clientY;
	if (reordering.value) updateReorder();
	else if (slide) {
		if (Math.hypot(slide.x - slide.originX, slide.y - slide.originY) >= 10) slide.armed = true;
		updateSlide();
	}
}

function pointerUp(event: PointerEvent) {
	if (outsideComposerPointer?.id === event.pointerId) { outsideComposerPointer = null; closeComposer(); }
	if (reordering.value?.id === event.pointerId) {
		pointerMove(event);
		finishReorder(!reordering.value?.started || !order.value.includes(reorderHit(event.clientX, event.clientY) ?? ''));
		return;
	}
	if (slide?.id === event.pointerId) {
		const target = slide.armed ? hit(event.clientX, event.clientY) : null;
		stopSlide();
		if (target === 'back' || target === 'settings') navigateTarget(target);
		else if (target) { if (branch.value) selectCollection(target); else activate(target); }
		if (opened.value) focusChoice();
		return;
	}
	if (hold?.id === event.pointerId) {
		const outside = !homeButton.value || !containsPoint(homeButton.value.getBoundingClientRect(), event.clientX, event.clientY);
		clearHold(outside || Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10);
	}
}

function pointerCancel(event: PointerEvent) {
	if (outsideComposerPointer?.id === event.pointerId) outsideComposerPointer = null;
	if (hold?.id === event.pointerId || slide?.id === event.pointerId || reordering.value?.id === event.pointerId) interrupt();
}

function lostCapture(event: PointerEvent) { pointerCancel(event); }

function interrupt() {
	outsideComposerPointer = null;
	stopViewportSettle();
	clearHold();
	stopSlide();
	finishReorder(true);
	clearDwell();
	pendingOpen.value = false;
	if (opened.value) focusChoice();
}

function viewportChanged() {
	const viewport = window.visualViewport;
	viewportHeight.value = viewport?.height ?? window.innerHeight;
	// scale>1 represents pinch zoom, not the software keyboard.
	keyboardInset.value = viewport && viewport.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
	measureGeometry();
}

function resized() { viewportChanged(); interrupt(); }

function stopViewportSettle() {
	window.cancelAnimationFrame(viewportSettleFrame);
	viewportSettleFrame = 0;
	for (const timer of viewportSettleTimers) window.clearTimeout(timer);
	viewportSettleTimers = [];
}

function resumeViewport() {
	stopViewportSettle();
	if (!mounted || window.document.hidden) return;
	viewportChanged();
	const recheck = () => { if (mounted && !window.document.hidden) viewportChanged(); };
	viewportSettleFrame = window.requestAnimationFrame(() => { viewportSettleFrame = 0; recheck(); });
	viewportSettleTimers = [100, 350].map(delay => window.setTimeout(recheck, delay));
}

function startPickerMorph() {
	window.clearTimeout(pickerMorphTimer);
	if (!props.motion) { pickerMorphing.value = false; return; }
	pickerMorphing.value = true;
	pickerMorphTimer = window.setTimeout(() => { pickerMorphing.value = false; pickerMorphTimer = undefined; }, 460);
}

function isGeometryTransition(property: string) {
	return property === 'height' || property === 'grid-template-rows' || property === 'margin' || property === 'margin-top' || property === 'margin-bottom';
}

function composerTransitionStarted(event: TransitionEvent) {
	if (!isGeometryTransition(event.propertyName) || !(event.target instanceof Element) || event.target === composerTarget.value) return;
	window.cancelAnimationFrame(geometrySettleFrame);
	geometrySettleFrame = 0;
	let properties = geometryTransitions.get(event.target);
	if (!properties) { properties = new Set(); geometryTransitions.set(event.target, properties); }
	properties.add(event.propertyName);
	composerGeometryAnimating.value = true;
}

function composerTransitionFinished(event: TransitionEvent) {
	if (!isGeometryTransition(event.propertyName) || !(event.target instanceof Element)) return;
	const properties = geometryTransitions.get(event.target);
	if (!properties) return;
	properties.delete(event.propertyName);
	if (properties.size === 0) geometryTransitions.delete(event.target);
	scheduleGeometrySettle();
}

function scheduleGeometrySettle() {
	if (geometryTransitions.size || geometrySettleFrame) return;
	// Let a reversed transition start and the final ResizeObserver sample land first.
	geometrySettleFrame = window.requestAnimationFrame(() => {
		measureGeometry();
		geometrySettleFrame = 0;
		if (!geometryTransitions.size) composerGeometryAnimating.value = false;
	});
}

function measureGeometry() {
	if (props.suspended) return;
	if (geometryTransitions.size) {
		for (const target of geometryTransitions.keys()) {
			if (!composerTarget.value?.contains(target)) geometryTransitions.delete(target);
		}
		if (!geometryTransitions.size) scheduleGeometrySettle();
	}
	// Keep background scroll padding stable while the search surface grows or returns.
	dockHeight.value = searchLayoutHeight ?? dock.value?.getBoundingClientRect().height ?? 0;
	const child = composerTarget.value?.firstElementChild;
	// The zero-height auto-collapsed Timeline wrapper is authoritative.
	const naturalHeight = child?.getBoundingClientRect().height;
	composerHeight.value = naturalHeight === undefined ? 120 : naturalHeight > 0 ? naturalHeight + 14 : 0;
	const dockRect = dock.value?.getBoundingClientRect();
	const composerRect = composerTarget.value?.getBoundingClientRect();
	const send = composerTarget.value?.querySelector<HTMLElement>('[data-hk3-send]');
	const sendRect = send?.getBoundingClientRect();
	if (dockRect && composerRect && sendRect?.width && sendRect.height && composerHeight.value > 0) {
		composeRight.value = Math.max(0, dockRect.right - sendRect.right);
		// Both rects share the same reveal transform, so closed content cannot shift the opener.
		composeBottom.value = Math.max(0, composerHeight.value - (sendRect.bottom - composerRect.top));
	}
	updateDockShape();
	const top = dock.value?.getBoundingClientRect().top ?? viewportHeight.value - bodyHeight.value - 70;
	guideHeight.value = Math.max(0, Math.min(180, top - (window.visualViewport?.offsetTop ?? 0) - 24));
}

function updateDockShape() {
	const bounds = dock.value?.getBoundingClientRect();
	if (!bounds || !dockShape.value || bounds.width <= 0) return;
	const w = bounds.width;
	const h = bounds.height || bodyHeight.value + 70;
	const body = composerTarget.value?.parentElement;
	const animatedHeight = body?.getBoundingClientRect().height || parseFloat(body?.style.height ?? '') || bodyHeight.value;
	const openHeight = Math.max(44, Math.min(composerHeight.value, Math.max(0, viewportHeight.value - 150)));
	const normal = !props.home || opened.value || searchOpened.value;
	const progress = normal ? 1 : openHeight > 44 ? Math.max(0, Math.min(1, (animatedHeight - 44) / (openHeight - 44))) : composerOpened.value || props.confirmationActive ? 1 : 0;
	const offset = 44; // The backdrop begins above the dock to hold a raised send button.
	const buttonWidth = 44;
	const buttonLeft = Math.max(36, w - composeRight.value - buttonWidth);
	const buttonRight = w - composeRight.value;
	const plateau = (44 - composeBottom.value - 40) * (1 - progress);
	const y = offset + (plateau + 44 * (1 - progress));
	const capY = offset + plateau - 6 * (1 - progress);
	const r = 28 + 3 * progress;
	const shoulder = Math.max(r, buttonLeft - 26);
	const rightRadius = (w - buttonRight) * (1 - progress) + 31 * progress;
	const bottom = offset + h;
	dockShape.value.setAttribute('d', `M ${r} ${y} H ${shoulder} C ${shoulder + 8} ${y} ${buttonLeft - 12} ${capY} ${buttonLeft} ${capY} H ${w - rightRadius} Q ${w} ${capY} ${w} ${capY + rightRadius} V ${bottom - r} Q ${w} ${bottom} ${w - r} ${bottom} H ${r} Q 0 ${bottom} 0 ${bottom - r} V ${y + r} Q 0 ${y} ${r} ${y} Z`);
}

function visibility() {
	if (window.document.hidden) {
		interrupt();
		closeComposer();
	} else {
		resumeViewport();
	}
}

function pageHidden() { interrupt(); closeComposer(); }

function revealRow(button: HTMLElement) {
	if (!list.value || !list.value.contains(button)) return;
	const bounds = button.getBoundingClientRect();
	const viewport = list.value.getBoundingClientRect();
	if (bounds.top < viewport.top) list.value.scrollTop -= viewport.top - bounds.top;
	else if (bounds.bottom > viewport.bottom) list.value.scrollTop += bounds.bottom - viewport.bottom;
}

function searchFocusTargets(root: HTMLElement | null): HTMLElement[] {
	return Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []).filter(element => {
		if (element.closest('[inert], [aria-hidden="true"], [hidden]')) return false;
		for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
			const style = window.getComputedStyle(ancestor);
			if (style.display === 'none' || style.visibility === 'hidden') return false;
		}
		return true;
	});
}

function keydown(event: KeyboardEvent) {
	if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
	if (searchOpened.value) {
		// Inner search panels handle Escape first; trap only the outer Tab edges.
		if (event.key === 'Escape') {
			event.preventDefault(); event.stopPropagation(); closeSearch();
		} else if (event.key === 'Tab') {
			const elements = searchFocusTargets(dock.value);
			const index = elements.indexOf(window.document.activeElement as HTMLElement);
			if (elements.length && (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === elements.length - 1)) {
				event.preventDefault();
				elements[event.shiftKey ? elements.length - 1 : 0]?.focus({ preventScroll: true });
			}
		}
		return;
	}
	if (!opened.value) {
		if (event.key === 'Enter' || event.key === ' ') suppressClick = false;
		if (homeButton.value?.contains(event.target as Node) && (event.key === 'ArrowUp' || event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey)) {
			event.preventDefault();
			suppressClick = false;
			openMenu();
		}
		return;
	}
	if (event.key === 'Escape') {
		event.preventDefault(); event.stopPropagation();
		if (slide || hold || reordering.value) interrupt();
		else if (editing.value) editing.value = false;
		else if (branch.value || optionsOpen.value) back();
		else closeMenu();
		return;
	}
	if (slide || reordering.value) {
		if (event.key === 'Tab') event.preventDefault();
		return;
	}
	suppressClick = false;
	// Restrict the trap to our own dialog; external popup/keyboard focus is not stolen.
	const buttons = Array.from(dock.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []).filter(button => !composerTarget.value?.contains(button) && !button.closest('[inert]'));
	if (event.key === 'Tab') {
		event.preventDefault();
		const index = buttons.indexOf(window.document.activeElement as HTMLButtonElement);
		buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus({ preventScroll: true });
		return;
	}
	const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-choice], [data-handle]') : null;
	if (!target) return;
	const id = target.dataset.choice ?? target.dataset.handle;
	const options = choiceButtons();
	const index = options.findIndex(button => button.dataset.choice === id);
	const offset = mobileArrowOffset(event.key, branch.value ? 1 : 2);
	if (editing.value && event.altKey && offset !== null && id) {
		event.preventDefault();
		const previous = [...order.value];
		order.value = moveMobileChoice(order.value, id, index + offset);
		saveOrder(previous);
		void nextTick(() => {
			const attribute = target.dataset.handle ? 'data-handle' : 'data-choice';
			Array.from(list.value?.querySelectorAll<HTMLButtonElement>(`[${attribute}]`) ?? []).find(button => button.getAttribute(attribute) === id)?.focus({ preventScroll: true });
		});
	} else if (offset !== null || event.key === 'Home' || event.key === 'End') {
		event.preventDefault();
		const destination = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (offset ?? 0)));
		options[destination]?.focus({ preventScroll: true });
		if (options[destination]) revealRow(options[destination]);
	}
}

onMounted(() => {
	viewportChanged();
	if (dock.value) dock.value.dataset.mobileDock = instanceId;
	if (typeof ResizeObserver !== 'undefined') {
		observer = new ResizeObserver(measureGeometry);
		composerMutation = new MutationObserver(() => {
			if (composerTarget.value?.firstElementChild) observer?.observe(composerTarget.value.firstElementChild);
			const send = composerTarget.value?.querySelector('[data-hk3-send]');
			if (send) observer?.observe(send);
			measureGeometry();
		});
		if (composerTarget.value) composerMutation.observe(composerTarget.value, { childList: true });
		measureGeometry();
		if (dock.value) observer.observe(dock.value);
		if (composerTarget.value?.parentElement) observer.observe(composerTarget.value.parentElement);
		if (composerTarget.value) observer.observe(composerTarget.value);
	}
	window.addEventListener('pointerdown', pointerDown, true);
	window.addEventListener('wheel', timelineWheel, { passive: true });
	window.addEventListener('keydown', timelineKey, true);
	window.addEventListener('pointermove', pointerMove, { passive: true });
	window.addEventListener('pointerup', pointerUp);
	window.addEventListener('pointercancel', pointerCancel);
	window.addEventListener('resize', resized);
	window.addEventListener('blur', interrupt);
	window.addEventListener('pageshow', resumeViewport);
	window.addEventListener('pagehide', pageHidden);
	window.visualViewport?.addEventListener('resize', resized);
	window.visualViewport?.addEventListener('scroll', viewportChanged);
	window.document.addEventListener('visibilitychange', visibility);
});
onBeforeUnmount(() => {
	mounted = false;
	pullGesture?.dispose();
	pullGesture = null;
	stopViewportSettle();
	window.clearTimeout(searchReturnTimer);
	closeSearch(false);
	closeMenu(false);
	stopFrame();
	observer?.disconnect();
	composerMutation?.disconnect();
	window.cancelAnimationFrame(geometrySettleFrame);
	window.clearTimeout(pickerMorphTimer);
	geometryTransitions.clear();
	window.removeEventListener('pointerdown', pointerDown, true);
	window.removeEventListener('wheel', timelineWheel);
	window.removeEventListener('keydown', timelineKey, true);
	window.removeEventListener('pointermove', pointerMove);
	window.removeEventListener('pointerup', pointerUp);
	window.removeEventListener('pointercancel', pointerCancel);
	window.removeEventListener('resize', resized);
	window.removeEventListener('blur', interrupt);
	window.removeEventListener('pageshow', resumeViewport);
	window.removeEventListener('pagehide', pageHidden);
	window.visualViewport?.removeEventListener('resize', resized);
	window.visualViewport?.removeEventListener('scroll', viewportChanged);
	window.document.removeEventListener('visibilitychange', visibility);
});
defineExpose({ composerTarget, composerOpened, dockHeight, navShell, openComposer, closeComposer, openMenu, closeMenu, openCollection, openSearch, closeSearch });
</script>

<style module>
.dock { position: fixed; left: 10px; right: 10px; bottom: calc(12px + env(safe-area-inset-bottom, 0px) + var(--keyboard-inset, 0px)); z-index: 105; isolation: isolate; border-radius: 34px; color: var(--MI_THEME-fg); }
.clipDefinition { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
.dock::before {
	content: '';
	position: absolute;
	inset: -44px 0 0;
	z-index: -1;
	pointer-events: none;
	background: linear-gradient(180deg, var(--hk3-glass-note, var(--MI_THEME-panel)), var(--hk3-glass-pane, var(--MI_THEME-panel)) 45%, var(--hk3-glass-note, var(--MI_THEME-panel)));
	-webkit-backdrop-filter: blur(24px) saturate(1.15);
	backdrop-filter: blur(24px) saturate(1.15);
	-webkit-clip-path: var(--dock-clip);
	clip-path: var(--dock-clip);
}
.dock::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--MI_THEME-accent) 75%, transparent), 0 0 14px color-mix(in srgb, var(--MI_THEME-accent) 18%, transparent); filter: blur(1.5px); transition: opacity .2s ease; }
.dock:has(:global([data-embedded-search] input[type='search']:focus))::after { opacity: 1; }
.nav button, .picker button, .guide button { font: inherit; color: inherit; border: 0; background: transparent; cursor: pointer; min-height: 44px; }
.nav button:focus-visible, .picker button:focus-visible, .guide button:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -2px; }
.nav button:disabled, .picker button:disabled { opacity: .42; cursor: default; }
.body { position: relative; overflow: hidden; border-radius: 34px 34px 0 0; transition: height .46s cubic-bezier(.22,1,.36,1); }
.dock[data-pull-active='true'] .body { transition: none; }
.dock[data-open='false'][data-search-open='false'][data-home='true'][data-composer-resizing='true'][data-picker-morphing='false'] .body { transition: none; }
.composer { position: absolute; top: 0; left: 0; right: 0; min-height: calc(100% - var(--dock-pull-extension, 0px)); padding: calc(12px * var(--hk3-ui-scale, 1)) calc(14px * var(--hk3-ui-scale, 1)) 2px; overflow: visible; opacity: var(--dock-pull-content-opacity, 1); transform: translateY(0); transition: opacity .22s ease .08s, transform .38s cubic-bezier(.22,1,.36,1); box-sizing: border-box; }
.dock[data-pull-active='true'] .composer { transition: none; }
.dock[data-open='false'][data-search-open='false'] .body { overflow: visible; }
.composer[data-hidden='true'] { opacity: 0; transform: translateY(-14px); pointer-events: none; }
.composeButton { position: absolute; right: var(--compose-right, 14px); bottom: var(--compose-bottom, 2px); z-index: 1; display: grid; place-items: center; width: 44px; height: 40px; padding: 0; border: 0; border-radius: 12px; background: transparent; color: var(--MI_THEME-accent); cursor: pointer; opacity: 1; transform: translateY(0); transition: opacity .18s ease, transform .32s cubic-bezier(.22,1,.36,1); }
.composeButton[data-hidden='true'] { opacity: 0; transform: translateY(-10px); pointer-events: none; }
.composeButton > svg { transform: translateY(-3px); transition: opacity .18s ease; }
.composeButton:hover:not([data-hidden='true']) > svg { opacity: .72; }
.composeButton:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -2px; }
.searchSurface { position: absolute; inset: 0; min-height: 0; opacity: 0; transform: translateY(14px); pointer-events: none; transition: opacity .2s ease, transform .38s cubic-bezier(.22,1,.36,1); }
.searchSurface[data-active='true'] { opacity: 1; transform: translateY(0); pointer-events: auto; }
.searchIcons { display: grid; place-items: center; width: 24px; height: 24px; }
.searchIcon, .searchCloseIcon { grid-area: 1 / 1; transition: opacity .2s ease, transform .25s ease; }
.searchCloseIcon { opacity: 0; transform: scale(.55) rotate(-35deg); }
.searchIcons[data-open='true'] .searchCloseIcon { opacity: 1; transform: scale(1); }
.searchIcons[data-open='true'] .searchIcon { opacity: 0; transform: scale(.55) rotate(35deg); }
.navShell { position: relative; display: flex; align-items: flex-end; height: 70px; touch-action: none; }
.dock[data-pull-active='true'] .nav { pointer-events: none; }
.pullPrompt { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; gap: calc(9px * var(--hk3-ui-scale, 1)); padding: 0 calc(12px * var(--hk3-ui-scale, 1)); box-sizing: border-box; color: var(--MI_THEME-fg); font-size: calc(13px * var(--hk3-ui-scale, 1)); font-weight: 700; text-align: center; opacity: var(--dock-pull-prompt-opacity, 0); pointer-events: none; }
.dock[data-pull-active='false'] .nav, .dock[data-pull-active='false'] .pullPrompt { transition: opacity .2s ease; }
.pullIcon { display: inline-block; flex: none; transform: rotate(var(--dock-pull-turn, 0deg)); }
.dock[data-pull-phase='success'] .pullIcon, .dock[data-pull-phase='error'] .pullIcon { transform: none; }
.dock[data-motion='true'][data-pull-phase='refreshing'] .pullIcon { animation: hk3DockPullSpin .9s linear infinite; }
@keyframes hk3DockPullSpin { to { transform: rotate(360deg); } }
.nav { position: relative; display: flex; align-items: center; width: 100%; min-height: 62px; padding: 3px 0 calc(5px * var(--hk3-ui-scale, 1)); opacity: var(--dock-pull-content-opacity, 1); }
.navButton { position: relative; width: 100%; height: 52px; min-width: 44px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 26px; }
.nav > * { flex: 1; min-width: 44px; transition: flex .24s ease; }
.nav > .homeSlot { flex: 1.2; min-width: 44px; }
.navSlot { display: flex; }
.menuHold { touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.homeSlot { display: flex; justify-content: center; min-width: 44px; position: relative; color: var(--MI_THEME-accent); }
.homeButton { width: 100%; flex: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.homeIcons { position: relative; display: grid; place-items: center; width: 24px; height: 24px; }
.activeIcon, .closeIcon { grid-area: 1 / 1; transition: opacity .22s ease, transform .22s ease; }
.activeIcon { display: grid; place-items: center; font-size: calc(21px * var(--hk3-ui-scale, 1)); line-height: 1; }
.closeIcon { opacity: 0; transform: scale(.65); }
.homeIcons[data-open='true'] .activeIcon { opacity: 0; transform: scale(.65); }
.homeIcons[data-open='true'] .closeIcon { opacity: 1; transform: scale(1); }
.iconEnter, .iconLeave { transition: opacity .22s ease, transform .22s ease; }
.iconLeave { position: absolute; }
.iconHidden { opacity: 0; transform: scale(.65); }
.navButton[data-active='true'] { color: var(--MI_THEME-accent) !important; }
.badge { position: absolute; top: 11px; right: calc(50% - 14px); width: 5px; height: 5px; border-radius: 50%; background: var(--MI_THEME-indicator); }
.scrim { position: fixed; inset: 0; z-index: 104; background: #0002; touch-action: none; }
.picker { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; padding: calc(12px * var(--hk3-ui-scale, 1)) calc(10px * var(--hk3-ui-scale, 1)) calc(4px * var(--hk3-ui-scale, 1)); }
.toolbar { position: relative; display: flex; justify-content: flex-end; flex: none; min-height: 44px; margin-bottom: 4px; }
.control { display: grid; place-items: center; width: 44px; padding: 0; flex: none; border-radius: 50%; color: var(--MI_THEME-accent) !important; }
.grip { position: absolute; left: calc(50% - 13px); top: 7px; width: 26px; height: 3px; border-radius: 4px; background: color-mix(in srgb, var(--MI_THEME-fg) 28%, transparent); }
.title { align-self: center; flex: 1; font-size: calc(13px * var(--hk3-ui-scale, 1)); padding: 0 calc(6px * var(--hk3-ui-scale, 1)); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); grid-auto-rows: minmax(56px,auto); align-content: start; gap: 2px calc(6px * var(--hk3-ui-scale, 1)); overflow-y: auto; min-height: 0; padding: 2px; overscroll-behavior: contain; scrollbar-width: thin; touch-action: pan-y; }
.single { grid-template-columns: minmax(0,1fr); }
.row { display: flex; min-width: 0; border-radius: 18px; }
.option { display: grid; grid-template-columns: 22px minmax(0,1fr) 14px; align-items: center; gap: calc(8px * var(--hk3-ui-scale, 1)); text-align: left; min-height: 56px !important; min-width: 0; width: 100%; padding: calc(8px * var(--hk3-ui-scale, 1)) calc(10px * var(--hk3-ui-scale, 1)); border-radius: 18px; }
.option span { font-size: calc(12px * var(--hk3-ui-scale, 1)); overflow-wrap: anywhere; }
.option i { font-size: calc(20px * var(--hk3-ui-scale, 1)); }
.option[aria-pressed='true'], .option[aria-checked='true'] { color: var(--MI_THEME-accent); background: color-mix(in srgb, var(--MI_THEME-accent) 11%, transparent); }
.option[data-candidate='true'], .control[data-candidate='true'], .row[data-reordering='true'] { background: color-mix(in srgb, var(--MI_THEME-accent) 15%, transparent); }
.handle { width: 44px; flex: none; display: grid; place-items: center; touch-action: none; user-select: none; border-radius: 14px; padding: 0; }
.picker[data-editing='true'] .option { grid-template-columns: 18px minmax(0,1fr); gap: calc(5px * var(--hk3-ui-scale, 1)); padding: calc(8px * var(--hk3-ui-scale, 1)) 0 calc(8px * var(--hk3-ui-scale, 1)) calc(8px * var(--hk3-ui-scale, 1)); }
.status { grid-column: 1 / -1; font-size: calc(13px * var(--hk3-ui-scale, 1)); padding: calc(10px * var(--hk3-ui-scale, 1)); margin: 0; }
.guide { position: absolute; left: 6px; right: 6px; bottom: calc(100% + 12px); display: flex; flex-direction: column; align-items: center; gap: 3px; padding: calc(8px * var(--hk3-ui-scale, 1)) calc(14px * var(--hk3-ui-scale, 1)) calc(4px * var(--hk3-ui-scale, 1)); max-height: var(--guide-height, 180px); box-sizing: border-box; overflow-y: auto; border-radius: 22px; clip-path: inset(0 0 0 0 round 22px); text-align: center; background: color-mix(in srgb,var(--MI_THEME-panel) 86%,transparent); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); border: 1px solid color-mix(in srgb,var(--MI_THEME-fg) 14%,transparent); box-shadow: 0 12px 34px #0002; }
.guideDemo { position: relative; width: 112px; height: 56px; flex: none; color: var(--MI_THEME-accent); }
.guideChoices { position: absolute; inset: 0 10px auto; display: flex; justify-content: space-between; }
.guideChoices i { display: grid; place-items: center; width: 31px; height: 25px; border-radius: 10px; background: color-mix(in srgb, var(--MI_THEME-accent) 15%, transparent); font-size: calc(17px * var(--hk3-ui-scale, 1)); }
.guidePath { position: absolute; top: 23px; left: 55px; height: 17px; border-left: 2px dotted color-mix(in srgb, var(--MI_THEME-accent) 45%, transparent); }
.guideStart { position: absolute; left: 42px; bottom: 0; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: color-mix(in srgb, var(--MI_THEME-accent) 16%, transparent); }
.guideFinger { position: absolute; left: 54px; bottom: -3px; filter: drop-shadow(0 2px 2px color-mix(in srgb, var(--MI_THEME-panel) 80%, transparent)); animation: hk3GuideSlide 3s ease-in-out infinite; }
.guide p { font-size: calc(12px * var(--hk3-ui-scale, 1)); line-height: 1.45; margin: 0; text-wrap: balance; white-space: pre-line; }
.guide button { display: block; min-height: 44px; padding: 0 calc(12px * var(--hk3-ui-scale, 1)); color: var(--MI_THEME-accent); }
.guideEnter, .guideLeave { overflow: hidden; transition: clip-path .42s ease, opacity .32s ease, transform .42s ease; }
.guideAbove { clip-path: inset(0 0 100% 0 round 22px); opacity: 0; transform: translateY(-10px); }
.guideBelow { clip-path: inset(100% 0 0 0 round 22px); opacity: 0; transform: translateY(8px); }
@keyframes hk3GuideSlide {
	0%, 12% { opacity: 1; transform: translate(0, 0) scale(1); }
	28% { opacity: 1; transform: translate(0, -18px) scale(.92); }
	52% { opacity: 1; transform: translate(0, -34px) scale(1); }
	76% { opacity: 1; transform: translate(28px, -34px) scale(1); }
	88% { opacity: 1; transform: translate(28px, -34px) scale(1); }
	100% { opacity: 0; transform: translate(28px, -34px) scale(1); }
}
.srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pickerEnter { transition: transform .4s cubic-bezier(.22,1,.36,1), opacity .24s ease .1s; }
.pickerLeave { transition: transform .3s ease, opacity .14s ease; pointer-events: none; }
.pickerHidden { opacity: 0; transform: translateY(16px); }
.viewEnter, .viewLeave { transition: transform .24s ease, opacity .24s ease; }
.viewLeave { position: absolute; inset: 60px 10px 4px; pointer-events: none; }
.viewHidden { opacity: .35; transform: translateX(14px); }
.navMove, .navEnter, .navLeave { transition: transform .24s ease, opacity .24s ease; }
.navHidden { opacity: 0; transform: scale(.8); }
.navLeave { position: absolute; pointer-events: none; }
.dock[data-overflow='true'] .composer { height: calc(100% - var(--dock-pull-extension, 0px)); overflow-y: auto; overscroll-behavior: contain; }
.dock[data-home='false'] .composer { visibility: hidden; }
.dock[data-motion='false'] *, .dock[data-motion='false'] { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) { .dock, .dock * { animation: none !important; transition: none !important; } }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .dock::before { background: var(--hk3-glass-pane, var(--MI_THEME-panel)); } .guide { background: var(--MI_THEME-panel); } }
</style>
