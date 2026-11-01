<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3 Beta の画面全体。デスクトップは「メニュー | タイムライン | 右ペイン」、
デッキ表示は既存の HataSaba デッキ、スマホは上タブ＋下ナビ＋ドロワーで構成する。
-->
<template>
<div ref="rootEl" :class="$style.root" :style="themeStyle" :data-hk3-theme="themeMode" :data-glass="prefer.r.hataskeyUi3TimelineBackground.value ? 'true' : undefined" :data-mobile="isMobile ? 'true' : undefined" :data-reduce-motion="reduceMotionActive ? 'true' : undefined" @pointerdown.capture="onPress">
	<Hk3Backdrop v-if="backdropEnabled" :class="$style.backdrop" :bannerUrl="backdropUrls.bannerUrl" :avatarUrl="backdropUrls.avatarUrl" :motion="!reduceMotionActive"/>
	<!-- 通信中の表示。短い通信ではちらつかないよう、少し続いたときだけ上端に細い帯で出す。 -->
	<div :class="$style.busy" :data-on="busyShown ? 'true' : undefined" aria-hidden="true"><span></span></div>
	<!-- ===== デスクトップ ===== -->
	<div v-if="!isMobile" :class="$style.desktop" :style="{ gridTemplateColumns: desktopColumns }">
		<div data-hata-collapse-part :inert="confirmationActive" :class="$style.navCell" :style="{ width: `${sideNavExpanded ? navWidth : 64}px` }" :data-glass-seam="sideNavSeamless ? 'true' : undefined" :data-deck-seam="sideNavSeamless && deckActive ? 'true' : undefined" @pointerenter="onSideNavEnter" @pointerleave="sideNavHovered = false" @focusin="onSideNavFocus" @focusout="onSideNavBlur" @keydown.esc="closeSideNav" @keyup="onSideNavKeyUp">
			<Hk3SideNav :collapsed="!sideNavExpanded" :collapsible="isHataGoesPage" :seamless="sideNavSeamless" :isDeck="deckActive" :deckAvailable="isHome" :postOpen="composeWindowOpen" :dark="themeMode === 'dark'" @post="isHatadyTimeline ? launchHatadyRecord() : toggleComposeWindow()" @toggleTheme="toggleTheme" @mode="switchMode" @navigate="onSideNavigate" @launchPadOpen="sideNavLaunchPadOpen = $event" @instanceMenuOpen="sideNavInstanceMenuOpen = $event" @toggleCollapse="sideNavCollapsed = !sideNavCollapsed"/>
		</div>

		<template v-if="deckActive">
			<div ref="deckBoxEl" data-hk3-stage data-hata-collapse-items :class="$style.deckCell">
				<HatasabaDeck :class="$style.deck" hk3/>
				<div v-if="composeWindowOpen" ref="composeWindowEl" data-hata-collapse-part :class="$style.window" :data-dragging="windowDragging ? 'true' : undefined" :style="windowStyle">
					<div :class="$style.windowBar" @pointerdown="startWindowDrag" @dblclick="windowPos = null">
						<GripHorizontal :size="16" :class="$style.windowGrip"/>
						<Pencil :size="15"/>
						<b :class="$style.windowTitle">{{ copy.note }}</b>
						<button type="button" :class="$style.windowBtn" :title="copy.resetWindow" @pointerdown.stop @click="windowPos = null"><PanelBottom :size="16"/></button>
						<button type="button" :class="[$style.windowBtn, $style.windowClose]" :title="i18n.ts.close" @pointerdown.stop @click="composeWindowOpen = false"><X :size="16"/></button>
					</div>
					<Hk3Composer ref="composerRef" deck menuPlacement="down"/>
				</div>
			</div>
		</template>
		<template v-else>
			<main data-hk3-stage :class="$style.main" :style="{ '--hk3-composer-left-inset': `${sideNavExpanded && isHome ? navWidth - 64 : 0}px` }">
				<Hk3SideWorkspace :class="$style.workspace" :mode="isHataGoesPage ? 'full' : workspaceMode" :pageActive="!isHome" :pageInert="confirmationActive" :timelineActive="timelineVisible && !isHataGoesPage" :controls="isHataGoesPage ? false : sidePageSession" :preservePageNavigation="preservePageNavigation" :title="props.pageMetadata?.title ?? ''" :reduceMotion="reduceMotionActive" :glass="prefer.r.hataskeyUi3TimelineBackground.value" :pageClass="$style.page" :expandLabel="copy.sidePageExpand" :restoreLabel="copy.sidePageRestore" :closeLabel="copy.sidePageClose" @toggle="toggleSidePage" @close="closeSidePage">
					<template #page><RouterView v-if="!isHome"/></template>
					<template #timeline>
						<Hk3Timeline v-if="isHome || sidePageSession" ref="timelineRef" :active="timelineVisible" :narrow="sidePageSplit" :confirmationActive="confirmationActive" @punchBusy="punchBusy = $event">
							<Hk3Composer v-show="!isHatadyTimeline && !isConcrntTimeline" ref="composerRef" :inert="isHatadyTimeline || isConcrntTimeline" :aria-hidden="isHatadyTimeline || isConcrntTimeline" :menuPlacement="prefer.r.hataskeyUi3ComposerPosition.value === 'top' ? 'down' : 'up'"/>
							<button v-if="isHatadyTimeline" type="button" :class="$style.hatadyRecordBar" @click="launchHatadyRecord"><BookOpen :size="18"/>{{ i18n.ts._hata._hatasabaUi._simple.record }}</button>
						</Hk3Timeline>
					</template>
				</Hk3SideWorkspace>
			</main>
			<Hk3RightPane v-if="showRightPane" :collapsible="isHataGoesPage" :collapsed="rightPaneCollapsed" :inert="confirmationActive" data-hk3-stage data-hata-collapse-part :class="$style.right" @toggleCollapse="rightPaneCollapsed = !rightPaneCollapsed"/>
		</template>
	</div>

	<!-- ===== スマホ ===== -->
	<div v-else :class="$style.mobile" :data-page="!isHome ? 'true' : undefined" :data-dock-suspended="mobileDockSuspended ? 'true' : undefined">
		<div :class="$style.safeTop"></div>
		<div :class="$style.scrim" :data-open="drawerOpen ? 'true' : undefined" :inert="confirmationActive || mobileDockExpanded || mobilePane != null" @click="drawerOpen = false"></div>
		<div :class="$style.drawer" :data-glass="prefer.r.hataskeyUi3SideMenuBackground.value ? 'true' : undefined" :data-open="drawerOpen ? 'true' : undefined" :data-hata-collapse-part="drawerOpen ? '' : undefined" :aria-hidden="!drawerOpen" :inert="confirmationActive || mobileDockExpanded || mobilePane != null">
			<div :class="$style.safeTop"></div>
			<div :class="$style.drawerBody">
				<Hk3SideNav :dark="themeMode === 'dark'" :deckAvailable="false" @toggleTheme="toggleTheme" @mode="drawerOpen = false" @navigate="onMobileSideNavigate"/>
			</div>
		</div>

		<Hk3SideWorkspace :class="$style.mobileWorkspace" :mode="isHome ? 'home' : 'full'" :pageActive="!isHome" :pageInert="confirmationActive" :timelineActive="timelineVisible" :controls="sidePageSession" :preservePageNavigation="preservePageNavigation" :title="props.pageMetadata?.title ?? ''" :inert="confirmationActive || drawerOpen || mobileDockExpanded || mobilePane != null" mobile :reduceMotion="reduceMotionActive" :glass="prefer.r.hataskeyUi3TimelineBackground.value" :pageClass="`${$style.page} ${$style.mobilePage}`" :expandLabel="copy.sidePageExpand" :restoreLabel="copy.sidePageRestore" :closeLabel="copy.sidePageClose" @close="closeSidePage">
			<template #page><RouterView v-if="!isHome"/></template>
			<template #timeline>
				<Hk3Timeline v-if="isHome || sidePageSession" ref="timelineRef" compact :active="timelineVisible" :narrow="false" :confirmationActive="confirmationActive" :mobileComposerTarget="mobileDockRef?.composerTarget ?? null" :mobileComposerOpen="mobileDockRef?.composerOpened ?? false" :mobileDockHeight="mobileDockRef?.dockHeight ?? 0" :mobileMenuOpen="mobileDockExpanded || drawerOpen || mobilePane != null" @punchBusy="punchBusy = $event" @mobileCollection="mobileDockRef?.openCollection($event)" @revealComposer="mobileDockRef?.openComposer()">
					<Hk3Composer v-show="!isHatadyTimeline && !isConcrntTimeline" ref="composerRef" :inert="isHatadyTimeline || isConcrntTimeline" :aria-hidden="isHatadyTimeline || isConcrntTimeline" compact menuPlacement="up" @posted="mobileDockRef?.closeComposer(true)"/>
				</Hk3Timeline>
			</template>
		</Hk3SideWorkspace>

		<Hk3MobileDock ref="mobileDockRef" :confirmationActive="confirmationActive" :composerBlocked="composerRef?.collapseBlocked ?? false" :composeKind="isConcrntTimeline ? 'concrnt' : isHatadyTimeline ? 'hatady' : 'note'" :navigation="isHome ? timelineRef?.mobileNavigation ?? null : null" :items="mobileNav" :home="isHome" :drawerOpen="drawerOpen" :motion="!reduceMotionActive" :guideSeen="mobileGuideSeen" :suspended="mobileDockSuspended" :pullState="isHome && timelineVisible ? timelineRef?.mobilePullState ?? null : null" :attachPullGesture="isHome && timelineVisible ? timelineRef?.attachMobilePullGesture ?? null : null" :inert="mobilePane != null" @compose="onMobileCompose" @navigate="goMobile" @menu="toggleMobileDrawer" @requestTimeline="requestMobileTimeline" @menuOpen="mobileMenuOpen = $event" @searchOpen="onMobileSearchOpen" @dismissGuide="dismissMobileGuide"/>
		<Hk3MobileRightPane :pane="mobilePane" :glass="prefer.r.hataskeyUi3RightPaneBackground.value" :motion="!reduceMotionActive" @close="closeMobilePane" @tabChange="mobilePane = $event"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue';
import { Bell, BookOpen, GripHorizontal, House, LayoutGrid, MessageSquareWarning, PanelBottom, Pencil, Search, Sparkles, X } from '@lucide/vue';
import Hk3Backdrop from './Hk3Backdrop.vue';
import type * as Misskey from 'cherrypick-js';
import type { Component } from 'vue';
import type { PostFormProps } from '@/types/post-form.js';
import type { PageMetadata } from '@/page.js';
import Hk3SideNav from './Hk3SideNav.vue';
import Hk3SideWorkspace from './Hk3SideWorkspace.vue';
import { useHk3SidePage } from './use-hk3-side-page.js';
import Hk3Timeline from './Hk3Timeline.vue';
import Hk3Composer from './Hk3Composer.vue';
import Hk3RightPane from './Hk3RightPane.vue';
import Hk3MobileDock from './Hk3MobileDock.vue';
import Hk3MobileRightPane from './Hk3MobileRightPane.vue';
import { createHk3NoteConfirmationHost } from './hk3-note-confirmation-host.js';
import { registerNoteActionConfirmation } from '@/utility/note-action-confirmation.js';
import { dismissHk3Toast, hk3CanAdoptPostForm, hk3Toasts, pushHk3Toast } from './hk3-state.js';
import type { Hk3Toast } from './hk3-state.js';
import { HK3_THEME_CONTEXT, hk3ThemeStyle, readHk3ThemeBase } from './hk3-theme.js';
import type { Hk3ThemeBase, Hk3ThemeMode } from './hk3-theme.js';
import RouterView from '@/components/global/RouterView.vue';
import * as os from '@/os.js';
import { useGlobalEvent } from '@/events.js';
import { misskeyApi, pendingApiRequestsCount } from '@/utility/misskey-api.js';
import { getStaticImageUrl } from '@/utility/media-proxy.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { store } from '@/store.js';
import { prefer } from '@/preferences.js';
import { getInitialPrefValue } from '@/preferences/manager.js';
import { normalizeUiSBottomNav, resolveUiSBottomNav } from '@/utility/hatasaba-navigation.js';
import { mainRouter } from '@/router.js';
import { miLocalStorage } from '@/local-storage.js';
import { createHataskeyNotificationToasts, getToastDuration, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import type { HataskeyNavbarNotice, HataskeyToast } from '@/utility/hataskey-notification-toast.js';
import { useHataskeyNavbarNotices } from '@/composables/use-hataskey-navbar-notices.js';
import { getActiveHataSideProfile, hataSideStudioStore, startHataSideStudioSync, stopHataSideStudioSync } from '@/utility/hata-side-studio.js';
import { createHataTimelineCollapseEffect } from '@/utility/hata-timeline-collapse-effect.js';
import { useStream } from '@/stream.js';
import { openHatadyRecord } from '@/utility/hatady-record-launcher.js';
import { acceptNotificationUnreadState } from '@/utility/notification-unread-state.js';
import { useHatagoesBarCollapse } from '@/utility/hatagoes-bar-collapse.js';
import { concrntPagePostContextKey, interceptConcrntPostRequest } from '@/utility/concrnt/post-interceptor.js';
import { CONCRNT_NOTIFICATION_EVENT } from '@/utility/concrnt/events.js';
import { concrntDisplayName, concrntNotificationLabels } from '@/utility/concrnt/content.js';
import type { ConcrntNotification } from '@/utility/concrnt/types.js';

const HatasabaDeck = defineAsyncComponent(() => import('@/ui/_common_/hatasaba-deck.vue'));

const props = defineProps<{ pageMetadata?: PageMetadata | null }>();
const copy = i18n.ts._hata._hataskeyUi3;
const MOBILE_MAX = 700;
const DECK_MIN = 1000;
const RIGHT_PANE_MIN = 1200;

const rootEl = shallowRef<HTMLElement | null>(null);
const deckBoxEl = shallowRef<HTMLElement | null>(null);
const composeWindowEl = shallowRef<HTMLElement | null>(null);
const punchBusy = ref(false);
const timelineRef = shallowRef<InstanceType<typeof Hk3Timeline> | null>(null);
const isHatadyTimeline = computed(() => timelineVisible.value && timelineRef.value?.mobileNavigation.active === 'hatady' && !deckActive.value);
const isConcrntTimeline = computed(() => timelineVisible.value && timelineRef.value?.mobileNavigation.active === 'ctl' && !deckActive.value);

function launchHatadyRecord() { void openHatadyRecord({ variant: 'uis', onDone: () => timelineRef.value?.reload() }); }

function onMobileCompose() {
	if (mainRouter.currentRoute.value.name === 'concrnt' || mainRouter.currentRoute.value.path === '/timeline') { void os.post(); return; }
	if (isConcrntTimeline.value) { void timelineRef.value?.focusConcrntComposer(); return; }
	if (isHatadyTimeline.value) launchHatadyRecord();
	else composerRef.value?.focus();
}

const composerRef = shallowRef<InstanceType<typeof Hk3Composer> | null>(null);
const confirmationActive = computed(() => composerRef.value?.confirmationActive ?? false);
const mobileDockRef = shallowRef<InstanceType<typeof Hk3MobileDock> | null>(null);
const mobileMenuOpen = ref(false);
const mobileSearchOpen = ref(false);
const mobileDockExpanded = computed(() => !mobileDockSuspended.value && (mobileMenuOpen.value || mobileSearchOpen.value));
const mobileGuideKey = `hataskeyUi3MobileGuideShown:${$i?.id ?? 'guest'}` as const;
const mobileGuideSeen = ref(miLocalStorage.getItem(mobileGuideKey) === 'true');

// UI3 内のノートは、本体のリアルタイム設定に関係なく表示中の更新(リアクション等)を受け取る。
provide('forceNoteRealtimeCapture', true);

const width = ref(window.innerWidth);
const isMobile = computed(() => width.value <= MOBILE_MAX);
const path = computed(() => mainRouter.currentRoute.value.path);
const isHataGoesPage = computed(() => path.value === '/hatagoes');
const mobileDockSuspended = computed(() => ['/hatask', '/hata-docs', '/hatagoes']
	.some(root => path.value === root || path.value.startsWith(`${root}/`)));
const preservePageNavigation = computed(() => ['/hatask', '/hatady', '/hatafeed', '/hata-side-studio', '/hata-docs', '/hatagoes']
	.some(root => path.value === root || path.value.startsWith(`${root}/`)));
const showRightPane = computed(() => width.value >= RIGHT_PANE_MIN && path.value !== '/hata-side-studio');
const isHome = computed(() => path.value === '/');
const deckMode = ref(miLocalStorage.getItem('hataskeyUi3DeckMode') === 'true');
const deckActive = computed(() => deckMode.value && isHome.value && width.value >= DECK_MIN);
const sidePage = useHk3SidePage({
	router: mainRouter,
	currentRoute: () => mainRouter.currentRef.value,
	isHome: () => isHome.value,
	isMobile: () => isMobile.value,
	isDesktopDeck: () => deckMode.value && width.value >= DECK_MIN,
});
const sidePageSession = sidePage.session;
const sidePageSplit = sidePage.split;
const timelineVisible = sidePage.timelineVisible;
const workspaceMode = sidePage.mode;
provide(concrntPagePostContextKey, () => !isHome.value && !deckActive.value);
let sidePageOpener: HTMLElement | null = null;

function onSideNavigate(to?: string) {
	if (to === '/' && isHome.value && !sidePageSession.value && !deckActive.value) {
		timelineRef.value?.scrollHomeTop();
	}
	if (!sidePage.sidebarNavigated(to)) return;
	const active = window.document.activeElement;
	if (active instanceof HTMLElement && rootEl.value?.contains(active)) sidePageOpener = active;
}

function onMobileSideNavigate(to?: string) {
	drawerOpen.value = false;
	onSideNavigate(to);
}

function toggleSidePage() {
	const timelineHadFocus = rootEl.value?.querySelector('[data-hk3-side-timeline]')?.contains(window.document.activeElement);
	if (!sidePage.toggle()) return;
	if (timelineHadFocus && sidePage.expanded.value) void nextTick(() => rootEl.value?.querySelector<HTMLElement>('[data-hk3-side-page] button')?.focus({ preventScroll: true }));
}

function closeSidePage() {
	if (!sidePage.close()) return;
	const opener = sidePageOpener;
	sidePageOpener = null;
	void nextTick(() => {
		if (opener?.isConnected && !isMobile.value) opener.focus({ preventScroll: true });
		else (rootEl.value?.querySelector<HTMLElement>('[data-hk3-side-timeline] button') ?? (!mobileDockSuspended.value ? rootEl.value?.querySelector<HTMLElement>('[data-mobile-nav-path="/"]') : null))?.focus({ preventScroll: true });
	});
}

const restoreSidePageOnPopstate = sidePage.restoreOnPopstate;

const sideNavSeamless = computed(() => (isHome.value || sidePageSession.value)
	&& prefer.r.hataskeyUi3TimelineBackground.value && prefer.r.hataskeyUi3SideMenuBackground.value);
const drawerOpen = ref(false);
const mobilePane = ref<'widgets' | 'hatask' | null>(null);
let mobilePaneOpener: HTMLElement | null = null;

const profile = computed(() => getActiveHataSideProfile(hataSideStudioStore.value));
const navWidth = computed(() => profile.value.expanded.width === 'wide' ? 232 : 200);
const sideNavHovered = ref(false);
const sideNavFocused = ref(false);
let sideNavFocusTransfer: symbol | null = null;
let sideNavPointerInput = false;
const sideNavLaunchPadOpen = ref(false);
const sideNavInstanceMenuOpen = ref(false);
const sideNavCollapsed = useHatagoesBarCollapse(isHataGoesPage, () => !(sideNavHovered.value || sideNavFocused.value || sideNavLaunchPadOpen.value || sideNavInstanceMenuOpen.value));
const sideNavExpanded = computed(() => !sideNavCollapsed.value);
const rightPaneCollapsed = useHatagoesBarCollapse(isHataGoesPage, () => false);

function onDocumentPointerDown() {
	if (isMobile.value) return;
	sideNavPointerInput = true;
	sideNavFocusTransfer = null;
	sideNavFocused.value = false;
}

function onDocumentKeyDown(event: KeyboardEvent) {
	sideNavPointerInput = false;
	if (!isHatadyTimeline.value || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing || !['p', 'n'].includes(event.key.toLowerCase())) return;
	const target = event.target;
	if (!(target instanceof HTMLElement) || !rootEl.value?.contains(target) || target.closest('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	launchHatadyRecord();
}

function onSideNavEnter(event: PointerEvent) {
	if (event.pointerType === 'mouse' || event.pointerType === 'pen') sideNavHovered.value = true;
}

async function onSideNavFocus(event: FocusEvent) {
	const target = event.target;
	if (isHataGoesPage.value || sideNavPointerInput || !(target instanceof HTMLElement) || sideNavFocused.value || !target.matches(':focus-visible')) return;
	await holdSideNavKeyboardFocus(target, event.currentTarget as HTMLElement);
}

function onSideNavKeyUp(event: KeyboardEvent) {
	if (isHataGoesPage.value || sideNavPointerInput || sideNavFocused.value || !['Tab', 'Enter', ' '].includes(event.key)) return;
	const target = event.target;
	const container = event.currentTarget as HTMLElement;
	if (target instanceof HTMLElement && container.contains(target) && container.ownerDocument.activeElement === target) {
		void holdSideNavKeyboardFocus(target, container);
	}
}

async function holdSideNavKeyboardFocus(target: HTMLElement, container: HTMLElement) {
	const transfer = Symbol();
	sideNavFocusTransfer = transfer;
	sideNavFocused.value = true;
	try {
		await nextTick();
		// Escapeや外部への移動、新しい移送が始まった場合はフォーカスを戻さない。
		if (sideNavFocusTransfer !== transfer || !sideNavFocused.value) return;
		const doc = container.ownerDocument;
		const active = doc.activeElement;
		if (!container.isConnected) {
			sideNavFocused.value = false;
			return;
		}
		if (container.contains(active)) return;
		if (target.isConnected || (active && active !== doc.body && active !== doc.documentElement)) {
			sideNavFocused.value = false;
			return;
		}
		// DOM差し替えでbodyへ落ちた場合だけ、展開後の同じ項目へ移送する。
		const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
		(buttons.find(button => button.title === target.title) ?? buttons[0])?.focus({ preventScroll: true });
		if (sideNavFocusTransfer === transfer && !container.contains(doc.activeElement)) sideNavFocused.value = false;
	} finally {
		if (sideNavFocusTransfer === transfer) sideNavFocusTransfer = null;
	}
}

function onSideNavBlur(event: FocusEvent) {
	const related = event.relatedTarget;
	if (related instanceof Node && (event.currentTarget as HTMLElement).contains(related)) return;
	// v-ifによる元ボタンの削除中は、移送完了まで展開状態を保つ。
	// Escapeは先にsideNavFocusedを解除するので、このガードには入らない。
	if (related == null && sideNavFocusTransfer != null && sideNavFocused.value) return;
	sideNavFocusTransfer = null;
	sideNavFocused.value = false;
}

function closeSideNav(event: KeyboardEvent) {
	if (isHataGoesPage.value) sideNavCollapsed.value = true;
	sideNavHovered.value = false;
	sideNavFocusTransfer = null;
	sideNavFocused.value = false;
	(event.target as HTMLElement).blur();
}

watch(isMobile, mobile => {
	if (!mobile) return;
	sideNavHovered.value = false;
	sideNavFocusTransfer = null;
	sideNavFocused.value = false;
	sideNavPointerInput = false;
});

const desktopColumns = computed(() => {
	if (deckActive.value) return '64px minmax(0, 1fr)';
	return `64px minmax(0, 1fr)${showRightPane.value ? rightPaneCollapsed.value ? ' 64px' : ' 320px' : ''}`;
});

// ===== テーマ =====
const themeMode = computed<Hk3ThemeMode>(() => store.r.darkMode.value ? 'dark' : 'light');
// ユーザーのテーマ色に従う。テーマの切り替え・明暗の切り替えのたびに読み直す。
const themeBase = shallowRef<Hk3ThemeBase | null>(readHk3ThemeBase());

function refreshThemeBase() {
	themeBase.value = readHk3ThemeBase();
}

useGlobalEvent('themeChanged', refreshThemeBase);
const themeStyle = computed(() => {
	const dense = prefer.r.hataskeyUi3GlassDensity.value === 'dense';
	return {
		...hk3ThemeStyle(themeMode.value, themeBase.value),
		'--hk3-glass-pane-alpha': dense ? '92%' : '76%',
		'--hk3-glass-note-alpha': dense ? '86%' : '62%',
		'--hk3-glass-soft-alpha': dense ? '60%' : '30%',
		'--hk3-glass-overlay-alpha': dense ? '56%' : '36%',
		'--hk3-glass-menu': `color-mix(in srgb, var(--hk3-bg) ${dense ? '76%' : '56%'}, transparent)`,
		'--hk3-glass-control': `color-mix(in srgb, var(--hk3-bg) ${dense ? '46%' : '28%'}, transparent)`,
		'--hk3-glass-control-tint-alpha': '12%',
	};
});
provide(HK3_THEME_CONTEXT, themeStyle);
// 「UIのアニメーションを減らす」と端末の動きを減らす設定の両方に従う。CSSの遷移も含めて止める。
const systemReduceMotion = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const reduceMotionActive = computed(() => !prefer.r.animation.value || systemReduceMotion.value);
const backdropEnabled = computed(() => prefer.r.hataskeyUi3TimelineBackground.value
	|| prefer.r.hataskeyUi3SideMenuBackground.value
	|| prefer.r.hataskeyUi3RightPaneBackground.value);
const backdropUrls = computed(() => {
	const staticImages = reduceMotionActive.value
		|| prefer.r.disableShowingAnimatedImages.value
		|| prefer.r.dataSaver.value.avatar
		|| ['interaction', 'inactive'].includes(prefer.r.showingAnimatedImages.value);
	const resolveUrl = (url: string | null | undefined) => url && staticImages ? getStaticImageUrl(url) : url;
	return { bannerUrl: resolveUrl($i?.bannerUrl), avatarUrl: resolveUrl($i?.avatarUrl) };
});
const reduceMotion = () => reduceMotionActive.value;
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const timelineCollapseEffect = createHataTimelineCollapseEffect({
	root: () => rootEl.value,
	animationEnabled: () => !reduceMotionActive.value,
});
const timelineCollapseStream = useStream();

watch(punchBusy, busy => {
	if (busy) timelineCollapseEffect.cancel();
});

function onHataTimelineCollapse() {
	if (punchBusy.value || confirmationActive.value) return;
	timelineCollapseEffect.play();
}

watch(reduceMotionActive, active => {
	if (active) timelineCollapseEffect.cancel();
});

function onReduceMotionChange(ev: MediaQueryListEvent) {
	systemReduceMotion.value = ev.matches;
}

watch(themeMode, () => {
	void nextTick(refreshThemeBase);
	if (reduceMotion()) return;
	rootEl.value?.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' });
});

function toggleTheme() {
	const toDark = themeMode.value !== 'dark';
	// 端末のダークモード同期中でも、UI3 のボタンは手動切替として扱う。
	if (prefer.s.syncDeviceDarkMode) prefer.commit('syncDeviceDarkMode', false);
	store.set('darkMode', toDark);
	pushHk3Toast({ icon: toDark ? 'moon' : 'sun', text: toDark ? copy.darkModeOn : copy.lightModeOn });
}

// ===== 標準/デッキ切替 =====
let switching = false;

async function switchMode(deck: boolean) {
	if (deck === deckMode.value || switching) return;
	const apply = () => {
		deckMode.value = deck;
		miLocalStorage.setItem('hataskeyUi3DeckMode', deck ? 'true' : 'false');
		if (!deck) composeWindowOpen.value = false;
	};
	if (reduceMotion() || !isHome.value) {
		apply();
		return;
	}
	switching = true;
	try {
		const stages = () => Array.from(rootEl.value?.querySelectorAll<HTMLElement>('[data-hk3-stage]') ?? []);
		const outs = stages().map((el, i, all) => el.animate([
			{ opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
			{ opacity: 0, transform: 'translateY(-20px)', clipPath: 'inset(0 0 100% 0)' },
		], { duration: 280, delay: (all.length - 1 - i) * 30, easing: 'cubic-bezier(0.64, 0, 0.78, 0)', fill: 'forwards' }));
		await Promise.allSettled(outs.map(a => a.finished));
		apply();
		await nextTick();
		outs.forEach(a => a.cancel());
		stages().forEach((el, i) => el.animate([
			{ opacity: 0, transform: 'translateY(-24px)', clipPath: 'inset(0 0 100% 0)' },
			{ opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
		], { duration: 560, delay: i * 90, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }));
	} finally {
		switching = false;
	}
}

// ===== 通信中の表示 =====
const BUSY_DELAY_MS = 300;
const busyShown = ref(false);
let busyTimer: number | null = null;
watch(() => pendingApiRequestsCount.value > 0, pending => {
	if (busyTimer != null) window.clearTimeout(busyTimer);
	busyTimer = null;
	if (!pending) {
		busyShown.value = false;
		return;
	}
	busyTimer = window.setTimeout(() => {
		busyTimer = null;
		busyShown.value = true;
	}, BUSY_DELAY_MS);
}, { immediate: true });
onBeforeUnmount(() => {
	if (busyTimer != null) window.clearTimeout(busyTimer);
});

// ===== デッキ時の投稿ウィンドウ =====
const composeWindowOpen = ref(false);
const windowPos = ref<{ x: number; y: number } | null>(null);
const windowDragging = ref(false);
const windowBounds = ref<{ boxWidth: number; boxHeight: number; winWidth: number; winHeight: number } | null>(null);
watch([deckBoxEl, composeWindowEl], ([box, win], _previous, onCleanup) => {
	if (!box || !win) { windowBounds.value = null; return; }
	const measure = () => {
		windowBounds.value = { boxWidth: box.clientWidth, boxHeight: box.clientHeight, winWidth: win.offsetWidth, winHeight: win.offsetHeight };
	};
	const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
	observer?.observe(box);
	observer?.observe(win);
	measure();
	onCleanup(() => observer?.disconnect());
}, { flush: 'post' });
// 既定の位置は画面中央より少し上。動かした後はその位置を保つ。
const windowStyle = computed(() => {
	const bounds = windowBounds.value;
	if (!bounds) return windowPos.value
		? { left: `${windowPos.value.x}px`, top: `${windowPos.value.y}px` }
		: { left: '50%', top: '42%', transform: 'translate(-50%, -50%)' };
	const desired = windowPos.value ?? { x: bounds.boxWidth * 0.5 - bounds.winWidth / 2, y: bounds.boxHeight * 0.42 - bounds.winHeight / 2 };
	if (!windowPos.value && desired.x >= 8 && desired.y >= 8 && desired.x + bounds.winWidth <= bounds.boxWidth - 8 && desired.y + bounds.winHeight <= bounds.boxHeight - 8) {
		return { left: '50%', top: '42%', transform: 'translate(-50%, -50%)' };
	}
	return {
		left: `${Math.max(8, Math.min(bounds.boxWidth - bounds.winWidth - 8, desired.x))}px`,
		top: `${Math.max(8, Math.min(bounds.boxHeight - bounds.winHeight - 8, desired.y))}px`,
	};
});

function toggleComposeWindow() {
	if (mainRouter.currentRoute.value.name === 'concrnt' || mainRouter.currentRoute.value.path === '/timeline') { void os.post(); return; }
	if (isConcrntTimeline.value) { void timelineRef.value?.focusConcrntComposer(); return; }
	composeWindowOpen.value = !composeWindowOpen.value;
	if (composeWindowOpen.value) void nextTick(() => composerRef.value?.focus());
}

function startWindowDrag(ev: PointerEvent) {
	if (ev.button !== 0) return;
	const win = composeWindowEl.value;
	const box = deckBoxEl.value;
	if (!win || !box) return;
	ev.preventDefault();
	// 既定位置は transform で中央寄せしているため、見た目の位置から始める。
	const winRect = win.getBoundingClientRect();
	const boxRect = box.getBoundingClientRect();
	const x0 = winRect.left - boxRect.left;
	const y0 = winRect.top - boxRect.top;
	const px = ev.clientX;
	const py = ev.clientY;
	const maxX = box.offsetWidth - win.offsetWidth;
	const maxY = box.offsetHeight - win.offsetHeight;
	windowDragging.value = true;
	windowPos.value = { x: x0, y: y0 };
	const move = (e: PointerEvent) => {
		windowPos.value = {
			x: Math.max(0, Math.min(maxX, x0 + e.clientX - px)),
			y: Math.max(0, Math.min(maxY, y0 + e.clientY - py)),
		};
	};
	const up = () => {
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
		windowDragging.value = false;
	};
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', up);
}

// ===== 投稿要求の受け取り =====
// 返信・引用などは、表示中の UI3 投稿欄へ移す。デッキ中は投稿ウィンドウを開いて受け取る。
function interceptPostForm(request: PostFormProps): boolean {
	// The current timeline page owns its request even when the home timeline is retained.
	if (mainRouter.currentRoute.value.name === 'concrnt' || mainRouter.currentRoute.value.path === '/timeline') return false;
	if (isConcrntTimeline.value) {
		return interceptConcrntPostRequest(request, () => {
			if (isMobile.value) {
				mobileDockRef.value?.closeMenu();
				closeMobilePane();
				drawerOpen.value = false;
			}
			return timelineRef.value?.focusConcrntComposer();
		});
	}
	if (!hk3CanAdoptPostForm(request)) return false;
	if (isMobile.value) {
		mobileDockRef.value?.closeMenu();
		closeMobilePane();
	}
	// スマホでは、ほかの画面からの投稿要求もホームへ戻って下の投稿欄で受け取る(古い投稿モーダルは使わない)。
	if (!isHome.value && isMobile.value) {
		pendingAdopt = request;
		drawerOpen.value = false;
		mainRouter.pushByPath('/' as never);
		if (!isHome.value) {
			pendingAdopt = null;
			return false;
		}
		return true;
	}
	if (sidePageSession.value && !isMobile.value && !timelineVisible.value) {
		const composer = composerRef.value;
		return sidePage.restoreForComposer(() => composer?.adopt(request) ?? false);
	}
	if (!timelineVisible.value) return false;
	if (composerRef.value) return composerRef.value.adopt(request);
	if (!deckActive.value) return false;
	composeWindowOpen.value = true;
	void nextTick(() => {
		if (composerRef.value?.adopt(request) !== true) void os.postDirect(request);
	});
	return true;
}

// Only the visible standard composer accepts confirmations; other UIs keep their existing dialog.
const noteConfirmationHost = createHk3NoteConfirmationHost({
	composer: () => composerRef.value,
	available: () => !!$i && !deckActive.value && timelineVisible.value && !punchBusy.value
		&& !drawerOpen.value && mobilePane.value == null && !mobileDockExpanded.value,
	beforeOpen: () => { timelineCollapseEffect.cancel(); },
});
watch([path, () => $i?.id, isMobile, deckActive, timelineVisible], () => noteConfirmationHost.cancel(), { flush: 'sync' });

// ===== スマホ =====
// UI S 専用の並びを優先し、未保存なら従来のカスタム設定を引き継ぐ。
// 左端のメニューと最大5項目。ホームは必ず表示する。
const sharedBottomNavDefaults = getInitialPrefValue('simpleUi.bottomNav');
const mobileNav = computed(() => {
	const unread = $i?.unreadNotificationsCount ?? 0;
	const catalog: Record<string, { path: string; label: string; icon: Component; badge: string | null; brand?: boolean }> = {
		home: { path: '/', label: copy.tabHome, icon: House, badge: null },
		search: { path: '/search', label: i18n.ts.search, icon: Search, badge: null },
		notifications: { path: '/my/notifications', label: i18n.ts.notifications, icon: Bell, badge: unread > 0 ? (unread > 99 ? '99+' : String(unread)) : null },
		hatagoes: { path: '/hatagoes', label: 'HataGoes', icon: Sparkles, badge: null, brand: true },
		widgets: { path: '/widgets', label: copy.paneWidgets, icon: LayoutGrid, badge: null },
		hatafeed: { path: '/hatafeed', label: 'HataFeed', icon: MessageSquareWarning, badge: null, brand: true },
	};
	return normalizeUiSBottomNav(resolveUiSBottomNav(prefer.r.hataskeyUi3BottomNav.value, prefer.r['simpleUi.bottomNav'].value, sharedBottomNavDefaults))
		.map(item => catalog[item.id])
		.map(item => ({ ...item, active: item.path === '/hatask' && mobilePane.value === 'hatask'
			|| item.path === '/widgets' && mobilePane.value === 'widgets'
			|| mobilePane.value == null && (item.path === '/' ? isHome.value : path.value.startsWith(item.path)) }));
});

function dismissMobileGuide() {
	mobileGuideSeen.value = true;
	miLocalStorage.setItem(mobileGuideKey, 'true');
}

function requestMobileTimeline() {
	drawerOpen.value = false;
	if (!isHome.value) mainRouter.pushByPath('/' as never);
}

function toggleMobileDrawer() {
	mobileDockRef.value?.closeSearch(false);
	mobileDockRef.value?.closeMenu();
	drawerOpen.value = !drawerOpen.value;
}

let pendingAdopt: PostFormProps | null = null;
// The retained composer ref does not change when a side page returns home.
watch([composerRef, isHome], ([composer, home]) => {
	if (!home || !composer) return;
	if (pendingAdopt) {
		const request = pendingAdopt;
		pendingAdopt = null;
		void nextTick(() => {
			if (composerRef.value?.adopt(request) !== true) void os.postDirect(request);
		});
	}
}, { flush: 'post' });

function goMobile(to: string) {
	mobileDockRef.value?.closeSearch(false);
	mobileDockRef.value?.closeMenu();
	drawerOpen.value = false;
	if (to === '/hatask' || to === '/widgets') {
		mobilePaneOpener = Array.from(rootEl.value?.querySelectorAll<HTMLButtonElement>('[data-mobile-nav-path]') ?? [])
			.find(button => button.dataset.mobileNavPath === to) ?? null;
		mobilePane.value = to === '/hatask' ? 'hatask' : 'widgets';
		return;
	}
	closeMobilePane();
	if (to === '/' && isHome.value) {
		timelineRef.value?.scrollHomeTop();
		return;
	}
	mainRouter.pushByPath(to as never);
}

function onMobileSearchOpen(open: boolean) {
	mobileSearchOpen.value = open;
	if (open) {
		drawerOpen.value = false;
		closeMobilePane();
	}
}

function closeMobilePane() {
	if (!mobilePane.value) return;
	mobilePane.value = null;
	const opener = mobilePaneOpener;
	mobilePaneOpener = null;
	void nextTick(() => {
		const active = window.document.activeElement;
		if (!mobileDockSuspended.value && !mobileSearchOpen.value && opener?.isConnected && (active === window.document.body || active instanceof Node && rootEl.value?.contains(active))) opener.focus({ preventScroll: true });
	});
}

watch(path, (_next, previous) => {
	mobileDockRef.value?.closeComposer(true);
	mobileDockRef.value?.closeSearch(false);
	drawerOpen.value = false;
	closeMobilePane();
	// Keep the captured home button alive when its long press opens the timeline.
	if (previous === '/') mobileDockRef.value?.closeMenu(!mobileDockSuspended.value);
});
watch(mainRouter.currentRef, () => {
	mobileDockRef.value?.closeComposer(true);
	mobileDockRef.value?.closeSearch(false);
	closeMobilePane();
});
watch([drawerOpen, mobilePane], ([drawer, pane]) => {
	if (drawer || pane) {
		mobileDockRef.value?.closeComposer(true);
		mobileDockRef.value?.closeSearch(false);
	}
});
watch(isMobile, mobile => { mobileMenuOpen.value = false; if (!mobile) { mobileDockRef.value?.closeSearch(false); mobileSearchOpen.value = false; closeMobilePane(); } });

// ===== 通知・お知らせをバナーへ =====
// Hataskey UI が上部ナビバーへ統合していた通知(通知・外部通知・時報・絵文字追加・お気に入り/クリップ/編集/削除など)を、
// タイムライン表示中は同じ受け口で受け取り、新着バナーに流す。タイムライン以外では従来どおりの通知表示に戻る。
const noticeContext = createHataskeyNotificationToasts(computed(() => false), computed(() => true));
let releaseNoticeContext: (() => void) | null = null;
useHataskeyNavbarNotices(noticeContext, computed(() => $i != null && timelineVisible.value));

function notificationToast(notification: Misskey.entities.Notification, host?: string): Omit<Hk3Toast, 'id'> {
	const user = 'user' in notification ? (notification.user as Misskey.entities.UserLite | undefined) ?? null : null;
	const name = user ? (user.name || user.username) : '';
	const open = () => mainRouter.pushByPath((host !== undefined ? '/my/external-notifications' : '/my/notifications') as never);
	const base = { user, emojiHost: host, onClick: open, notificationId: host === undefined ? notification.id : undefined };
	switch (notification.type) {
		case 'hatady': {
			const copy = i18n.ts._hata._hatady._push;
			const text = notification.subtype === 'follow' ? copy.follow
				: notification.subtype === 'comment' || notification.subtype === 'mediaComment' || notification.subtype === 'mediaReply' ? copy.comment
				: notification.subtype === 'reaction' || notification.subtype === 'mediaReaction' ? copy.reaction : copy.update;
			return { ...base, icon: 'bell', text, onClick: host === undefined ? () => mainRouter.pushByPath(`/hatady?notificationId=${encodeURIComponent(notification.id)}`) : open };
		}
		case 'reaction': return { ...base, icon: 'heart', text: i18n.tsx._hata._hataskeyUi3.toastReaction({ name }) };
		case 'reply': return { ...base, icon: 'reply', text: i18n.tsx._hata._hataskeyUi3.toastReply({ name }) };
		case 'renote': return { ...base, icon: 'repeat', text: i18n.tsx._hata._hataskeyUi3.toastRenote({ name }) };
		case 'quote': return { ...base, icon: 'quote', text: i18n.tsx._hata._hataskeyUi3.toastQuote({ name }) };
		case 'mention': return { ...base, icon: 'mention', text: i18n.tsx._hata._hataskeyUi3.toastMention({ name }) };
		case 'follow': return { ...base, icon: 'userPlus', text: i18n.tsx._hata._hataskeyUi3.toastFollow({ name }) };
		case 'receiveFollowRequest': return { ...base, icon: 'userPlus', text: i18n.tsx._hata._hataskeyUi3.toastFollowRequest({ name }) };
		case 'pollEnded': return { ...base, icon: 'poll', text: copy.toastPollEnded };
		default: return { ...base, icon: 'bell', text: copy.toastGeneric };
	}
}

function navbarNoticeToast(notice: HataskeyNavbarNotice): Omit<Hk3Toast, 'id'> {
	const navCopy = i18n.ts._hata._navbarNotice;
	switch (notice.kind) {
		case 'hourlyTime': return { icon: 'clock', text: i18n.tsx._hata._navbarNotice.timeSignal({ time: notice.time }) };
		case 'emojiAdded': return { icon: 'smile', emojiUrl: notice.emoji.url, text: `${navCopy.emojiPrefix} :${notice.emoji.name}: ${navCopy.emojiRest}` };
		case 'noteAction': {
			const icon = ({ favorite: 'star', clip: 'clip', edit: 'pencil', delete: 'trash' } as const)[notice.action];
			const target = notice.target;
			return { icon, text: notice.message, onClick: typeof target === 'string' && target.startsWith('/') ? () => mainRouter.pushByPath(target as never) : undefined };
		}
		case 'status': return { icon: notice.icon === 'posted' ? 'send' : 'check', text: notice.message };
	}
}

// 旗鯖fork: コンカレントの通知は外部の通知としてバナーへ（本人のIDは出さない）。
function concrntToast(notification: ConcrntNotification): Omit<Hk3Toast, 'id'> {
	const icons = { reaction: 'smile', like: 'heart', reply: 'reply', reroute: 'repeat', mention: 'mention', follow: 'userPlus', other: 'bell' } as const;
	const uri = notification.type === 'reply' || notification.type === 'mention' ? notification.messageUri ?? notification.targetUri : notification.targetUri ?? notification.messageUri;
	return {
		icon: icons[notification.type], user: null, emojiUrl: notification.emoji?.imageUrl,
		text: `コンカレント：${concrntDisplayName(notification.authorName)}が${concrntNotificationLabels[notification.type]}`,
		onClick: () => { if (uri) void import('@/utility/concrnt/composer.js').then(({ openConcrntMessage }) => openConcrntMessage(uri)); else mainRouter.pushByPath('/my/notifications?tab=concrnt'); },
	};
}

function toastFromItem(item: HataskeyToast): Omit<Hk3Toast, 'id'> {
	if (item.source === 'concrnt') return concrntToast(item.notification);
	if (item.source !== 'status') return notificationToast(item.notification, item.source === 'external' ? item.host ?? '' : undefined);
	if (item.navbarNotice) return navbarNoticeToast(item.navbarNotice);
	return { icon: item.favoriteSaved ? 'star' : 'check', user: item.welcomeUser ?? null, welcome: !!item.welcomeUser, text: item.message };
}

// 受け口に入った順にバナーへ渡し、受け口自体は空にしておく(表示時間はバナー側で管理する)。
watch(noticeContext.items, items => {
	if (items.length === 0) return;
	const incoming = [...items].reverse();
	noticeContext.clear();
	if (!timelineVisible.value || isMobile.value && (drawerOpen.value || mobilePane.value != null)) return;
	for (const item of incoming) pushHk3Toast(toastFromItem(item), getToastDuration(item));
});

function onExternalNotification(ev: Event) {
	if (!timelineVisible.value) return;
	const notification = (ev as CustomEvent<Misskey.entities.Notification>).detail;
	if (notification) noticeContext.enqueue(notification, 'external', performance.now(), prefer.s['external.host'] || undefined);
}

function onConcrntNotification(ev: Event) {
	if (!timelineVisible.value) return;
	const notification = (ev as CustomEvent<ConcrntNotification>).detail;
	if (notification) noticeContext.enqueueConcrnt(notification, performance.now());
}

let releaseNotificationChannel: (() => void) | null = null;

function watchNotificationReads(): void {
	if (!store.s.realtimeMode || !$i) return;
	const ownerId = $i.id;
	const channel = timelineCollapseStream.useChannel('main');
	const accept = (state: { unreadNotificationsCount: number; revision: string }) =>
		$i?.id === ownerId && acceptNotificationUnreadState(ownerId, state) !== null;
	const dismiss = (ids: readonly string[]) => {
		const readIds = new Set(ids);
		for (const toast of hk3Toasts.value) {
			if (toast.notificationId && readIds.has(toast.notificationId)) dismissHk3Toast(toast.id);
		}
	};
	channel.on('readNotification', event => { if ($i?.id === ownerId) dismiss([event.id]); accept(event); });
	channel.on('notificationChanged', event => { if ($i?.id === ownerId) dismiss(event.ids); accept(event); });
	channel.on('readAllNotifications', event => { if ($i?.id === ownerId) dismiss(event.ids); accept(event); });
	channel.on('notificationFlushed', event => {
		accept(event);
		if ($i?.id !== ownerId) return;
		const ids = [...new Set(hk3Toasts.value.flatMap(toast => toast.notificationId ? [toast.notificationId] : []))];
		if (ids.length === 0) return;
		void (async () => {
			for (let offset = 0; offset < ids.length; offset += 100) {
				const batch = ids.slice(offset, offset + 100);
				try {
					const retained = await misskeyApi('notifications/show', { notificationIds: batch });
					if ($i?.id !== ownerId) return;
					const retainedIds = new Set(retained.map(notification => notification.id));
					dismiss(batch.filter(id => !retainedIds.has(id)));
				} catch { /* Preserve this batch on a failed reconciliation. */ }
			}
		})();
	});
	channel.on('unreadNotification', accept);
	releaseNotificationChannel = () => channel.dispose();
}

// ===== 押下時のアイコン演出 =====
function onPress(ev: PointerEvent) {
	if (reduceMotion()) return;
	const button = (ev.target as HTMLElement | null)?.closest('button');
	const icon = button?.querySelector('svg.lucide');
	if (!icon || !rootEl.value?.contains(button!)) return;
	icon.animate([
		{ transform: 'scale(1) translateY(0) rotate(0)' },
		{ transform: 'scale(0.7) translateY(3px) rotate(-8deg)', offset: 0.25 },
		{ transform: 'scale(1.22) translateY(-4px) rotate(6deg)', offset: 0.6 },
		{ transform: 'scale(1) translateY(0) rotate(0)' },
	], { duration: 460, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
}

function onResize() {
	width.value = window.innerWidth;
}

let releaseNoteConfirmation: (() => void) | null = null;
let releasePostFormInterceptor: (() => void) | null = null;

onMounted(() => {
	watchNotificationReads();
	timelineCollapseStream.on('hataTimelineCollapse', onHataTimelineCollapse);
	window.document.addEventListener('pointerdown', onDocumentPointerDown, true);
	window.document.addEventListener('keydown', onDocumentKeyDown, true);
	window.addEventListener('resize', onResize, { passive: true });
	window.addEventListener('popstate', restoreSidePageOnPopstate);
	reduceMotionQuery.addEventListener('change', onReduceMotionChange);
	startHataSideStudioSync();
	releasePostFormInterceptor = os.registerPostFormInterceptor(interceptPostForm);
	releaseNoteConfirmation = registerNoteActionConfirmation(noteConfirmationHost.offer);
	// MkToast などが統合表示を選べるよう、受け口の表示先を持たせる。
	noticeContext.target.value = rootEl.value;
	releaseNoticeContext = registerNotificationPageContext(noticeContext, () => timelineVisible.value && !(isMobile.value && (drawerOpen.value || mobilePane.value != null)));
	window.addEventListener('external-notification', onExternalNotification);
	window.addEventListener(CONCRNT_NOTIFICATION_EVENT, onConcrntNotification);
});

onBeforeUnmount(() => {
	releaseNotificationChannel?.();
	timelineCollapseStream.off('hataTimelineCollapse', onHataTimelineCollapse);
	timelineCollapseEffect.destroy();
	window.document.removeEventListener('pointerdown', onDocumentPointerDown, true);
	window.document.removeEventListener('keydown', onDocumentKeyDown, true);
	window.removeEventListener('resize', onResize);
	window.removeEventListener('popstate', restoreSidePageOnPopstate);
	reduceMotionQuery.removeEventListener('change', onReduceMotionChange);
	stopHataSideStudioSync();
	noteConfirmationHost.cancel();
	releaseNoteConfirmation?.();
	releasePostFormInterceptor?.();
	releaseNoticeContext?.();
	window.removeEventListener('external-notification', onExternalNotification);
	window.removeEventListener(CONCRNT_NOTIFICATION_EVENT, onConcrntNotification);
});
</script>

<style lang="scss" module>
.busy {
	position: fixed;
	top: var(--MI-fixed-top-inset, 0px);
	left: 0;
	right: 0;
	z-index: 4000000;
	height: 10px;
	overflow: hidden;
	pointer-events: none;
	opacity: 0;
	transition: opacity 200ms ease;

	&[data-on] { opacity: 1; }
	&:not([data-on]) > span { animation-play-state: paused; }

	> span {
		position: absolute;
		top: 1px;
		height: 3px;
		width: 40%;
		background: var(--hk3-accent);
		opacity: 0.85;
		filter: blur(3px);
		animation: hk3Busy 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite;
	}

	.root[data-reduce-motion] & > span { left: 0; width: 100%; animation: none; opacity: 0.7; }
}

@keyframes hk3Busy {
	from { left: -40%; }
	to { left: 100%; }
}

.root {
	--hk3-glass-pane: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-pane-alpha), transparent);
	--hk3-glass-panel: var(--hk3-glass-pane);
	--hk3-glass-note: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-note-alpha), transparent);
	--hk3-glass-soft: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-soft-alpha), transparent);
	position: relative;
	isolation: isolate;
	width: 100%;
	height: var(--MI-viewport-height, 100dvh);
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	background: var(--hk3-bg);
	color: var(--hk3-text);
	font-family: 'LINE Seed JP', var(--MI-font, sans-serif);

	:global(button), :global(input), :global(textarea), :global(select) { font-family: inherit; }
	:global(a) { color: var(--hk3-accent-700); }
	:global(button:focus-visible), :global(a:focus-visible) { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
	::selection { background: var(--hk3-accent-200); }

	// 動きを減らす設定中は、UI3 内のCSS遷移・アニメーションを止める（アプリロゴを除く）。
	&[data-reduce-motion],
	&[data-reduce-motion] :global(*:not([data-hata-app-logo], [data-hata-app-logo] *)),
	&[data-reduce-motion] :global(*:not([data-hata-app-logo], [data-hata-app-logo] *))::before,
	&[data-reduce-motion] :global(*:not([data-hata-app-logo], [data-hata-app-logo] *))::after {
		transition: none !important;
		animation: none !important;
	}
}

.backdrop {
	position: absolute;
	inset: 0;
	z-index: -1;
}

@supports not ((backdrop-filter: blur(16px)) or (-webkit-backdrop-filter: blur(16px))) {
	.root {
		--hk3-glass-pane: color-mix(in srgb, var(--hk3-bg) 96%, transparent);
		--hk3-glass-panel: color-mix(in srgb, var(--hk3-bg) 96%, transparent);
		--hk3-glass-note: color-mix(in srgb, var(--hk3-bg) 94%, transparent);
		--hk3-glass-soft: color-mix(in srgb, var(--hk3-bg) 90%, transparent);
	}
}

.root:not([data-glass]) {
	--hk3-glass-panel: var(--hk3-bg);
	--hk3-glass-note: var(--hk3-bg);
	--hk3-glass-soft: var(--hk3-bg);
}

.desktop {
	display: grid;
	width: 100%;
	height: 100%;
	min-height: 0;
}

.navCell {
	position: relative;
	z-index: 50;
	height: 100%;
	min-width: 0;
	min-height: 0;
	isolation: isolate;
	overflow: hidden;
	transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);

	&[data-glass-seam] {
		overflow: visible;

		&::before, &::after {
			content: '';
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			pointer-events: none;
		}

		// グリッドの予約幅だけにTLと同じ下地を敷き、展開部分で二重にしない。
		&::before {
			z-index: -2;
			width: 64px;
			background: var(--hk3-glass-note);
		}

		// 内容はSideNav内でクリップし、ガラスの右縁だけをTLへなじませる。
		&::after {
			z-index: -1;
			right: -24px;
			background: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-overlay-alpha), transparent);
			-webkit-backdrop-filter: blur(20px);
			backdrop-filter: blur(20px);
			-webkit-mask-image: linear-gradient(to right, #000, #000 calc(100% - 40px), transparent);
			mask-image: linear-gradient(to right, #000, #000 calc(100% - 40px), transparent);
		}
	}

	// デッキの列間にはTLの下地がないため、1枚のガラスを直接背景へ溶かす。
	&[data-deck-seam] {
		&::before { background: transparent; }
		&::after { background: var(--hk3-glass-pane); }
	}
}

.main {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
}

.workspace, .mobileWorkspace {
	flex: 1;
	min-width: 0;
	min-height: 0;
}

// 各領域は独立した重なり順を持たせ、中のページの z-index(検索欄の固定ヘッダーなど)が
// UI3 の引き出し・投稿窓・バナーより上に出ないようにする。body 直下のポップアップには影響しない。
.page {
	position: relative;
	isolation: isolate;
	flex: 1;
	min-width: 0;
	min-height: 0;
	overflow: auto;
	overscroll-behavior: contain;
	background: var(--hk3-glass-panel, var(--hk3-bg));
	container-type: inline-size;
}

.right {
	position: relative;
	isolation: isolate;
	min-width: 0;
	min-height: 0;

	.root[data-glass] &[data-glass] {
		background: var(--hk3-glass-note);
		-webkit-backdrop-filter: none;
		backdrop-filter: none;

		// TLと下地を揃え、本文をマスクせず背景のガラスだけを左端でフェードする。
		&::before {
			content: '';
			position: absolute;
			inset: 0;
			z-index: -1;
			pointer-events: none;
			background: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-overlay-alpha), transparent);
			-webkit-backdrop-filter: blur(20px);
			backdrop-filter: blur(20px);
			-webkit-mask-image: linear-gradient(to right, transparent 0, rgba(0, 0, 0, 0.02) 8px, rgba(0, 0, 0, 0.1) 20px, rgba(0, 0, 0, 0.3) 36px, rgba(0, 0, 0, 0.55) 52px, rgba(0, 0, 0, 0.78) 68px, rgba(0, 0, 0, 0.94) 84px, #000 96px);
			mask-image: linear-gradient(to right, transparent 0, rgba(0, 0, 0, 0.02) 8px, rgba(0, 0, 0, 0.1) 20px, rgba(0, 0, 0, 0.3) 36px, rgba(0, 0, 0, 0.55) 52px, rgba(0, 0, 0, 0.78) 68px, rgba(0, 0, 0, 0.94) 84px, #000 96px);
		}
	}
}

.deckCell {
	position: relative;
	min-width: 0;
	min-height: 0;
	display: flex;
	flex-direction: column;
	background: transparent;
}

.deck {
	position: relative;
	isolation: isolate;
	flex: 1;
	min-height: 0;
}

.window {
	position: absolute;
	z-index: 30;
	width: 560px;
	max-width: calc(100% - 16px);
	max-height: calc(100% - 16px);
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	background: var(--hk3-glass-panel, var(--hk3-bg));
	-webkit-backdrop-filter: blur(16px);
	backdrop-filter: blur(16px);
	border: 2px solid var(--hk3-text);
	box-shadow: var(--hk3-shadow-lg);
	transition: box-shadow 200ms ease;

	&[data-dragging] { box-shadow: var(--hk3-shadow-lg), 0 0 0 4px var(--hk3-accent-200); }
}

.windowBar {
	position: sticky;
	top: 0;
	z-index: 1;
	display: flex;
	align-items: center;
	gap: 10px;
	height: 38px;
	padding: 0 4px 0 12px;
	flex: none;
	background: var(--hk3-text);
	color: var(--hk3-bg);
	cursor: grab;
	user-select: none;
	touch-action: none;

	.window[data-dragging] & { cursor: grabbing; }
}

.windowGrip { opacity: 0.7; }

.windowTitle {
	flex: 1;
	font-size: 13px;
}

.windowBtn {
	width: 32px;
	height: 32px;
	border: 0;
	background: transparent;
	color: var(--hk3-bg);
	cursor: pointer;
	display: grid;
	place-items: center;

	&:hover { background: var(--hk3-neutral-800); }
}

.windowClose:hover { background: var(--hk3-accent); }

// ===== スマホ =====
.mobile {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: hidden;
}

.safeTop {
	height: env(safe-area-inset-top, 0px);
	flex: none;
}

.mobilePage {
	flex: 1;
	--hk3-page-dock-inset: calc(92px + env(safe-area-inset-bottom, 0px));
	--MI-page-bottom-inset: var(--hk3-page-dock-inset);
	// Fade only the page surface behind the floating dock; scrolling content stays opaque and clickable.
	background: linear-gradient(to bottom, var(--hk3-glass-panel, var(--hk3-bg)) calc(100% - 122px), transparent 100%);

	// RouterView's immediate page is the scrollport (PageWithHeader, Drive, etc.).
	// Keep its viewport full height and reserve dock space inside the scrollable content.
	> :global(._pageContainer) > :global(._pageScrollable),
	> :global(._pageContainer) > :global(._pageScrollableReversed) {
		box-sizing: border-box;
		padding-bottom: var(--hk3-page-dock-inset);
		scroll-padding-bottom: var(--hk3-page-dock-inset);
	}

	// Redesigned settings scroll within the main and category panes independently.
	:global(#settings-redesign-main),
	:global([data-nav-mode] > aside[aria-label]) {
		padding-bottom: var(--hk3-page-dock-inset);
		scroll-padding-bottom: var(--hk3-page-dock-inset);
	}

	// MkStickyContainer's footer follows its body; lift it above the dock.
	> :global(._pageContainer) > :global(._pageScrollable) > :global(div) > :global([data-sticky-container-footer-height] + div),
	> :global(._pageContainer) > :global(._pageScrollableReversed) > :global(div) > :global([data-sticky-container-footer-height] + div) {
		bottom: var(--hk3-page-dock-inset);
	}
}

.mobile[data-dock-suspended] .mobilePage {
	--hk3-page-dock-inset: 0px;
	background: none;
}

// Blend page-owned frames into the floating dock without filtering its buttons.
.mobile[data-page]::after {
	content: '';
	position: absolute;
	inset-inline: 0;
	bottom: 0;
	height: calc(108px + env(safe-area-inset-bottom, 0px));
	z-index: 104;
	pointer-events: none;
	background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--hk3-bg) 20%, transparent));
	-webkit-backdrop-filter: blur(20px);
	backdrop-filter: blur(20px);
	-webkit-mask-image: linear-gradient(to bottom, transparent, #000 40%);
	mask-image: linear-gradient(to bottom, transparent, #000 40%);
}

.mobile[data-dock-suspended]::after { display: none; }

// 引き出しと背面の幕は、ページが body 直下に出す固定要素(検索欄など z-index 100 前後)より上、
// メニュー・ダイアログなどのポップアップ(z-index 100万台)より下に置く。
.scrim {
	position: absolute;
	inset: 0;
	z-index: 900;
	background: color-mix(in srgb, var(--hk3-neutral-900) 45%, transparent);
	opacity: 0;
	pointer-events: none;
	transition: opacity 320ms ease;

	&[data-open] { opacity: 1; pointer-events: auto; }
}

.drawer {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	z-index: 901;
	width: min(300px, 86vw);
	display: flex;
	flex-direction: column;
	background: var(--hk3-bg);
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
	border-right: 2px solid var(--hk3-divider);
	transform: translateX(-104%);
	visibility: hidden;
	transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 420ms ease, visibility 0s linear 420ms;

	&[data-glass] {
		background: transparent;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
		border-right: 0;

		&::after {
			content: '';
			position: absolute;
			top: 0;
			bottom: 0;
			right: -24px;
			z-index: 0;
			left: 0;
			pointer-events: none;
			background: var(--hk3-glass-pane, var(--hk3-bg));
			-webkit-backdrop-filter: blur(20px);
			backdrop-filter: blur(20px);
			-webkit-mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent);
			mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent);
		}
	}

	&[data-open] {
		transform: translateX(0);
		visibility: visible;
		box-shadow: var(--hk3-shadow-lg);
		&[data-glass] { box-shadow: none; }
		transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 420ms ease, visibility 0s;
	}
}

.drawerBody {
	position: relative;
	z-index: 1;
	flex: 1;
	min-height: 0;

	// ドロワーが背景を描くため、内側のメニューには重ねない。
	.drawer & > :global(nav) {
		background: transparent;
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}
}

.hatadyRecordBar {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	width: 100%;
	min-height: 56px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 12px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	font-weight: 700;
	cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
	.scrim, .drawer, .window { transition: none !important; }
}
</style>

<style>
/* Hataskey UI 3 のロゴ・独自ツール名(Hatask など)に使う書体。UI3 だけを開いたときも読み込まれるようここで宣言する。 */
@font-face {
	font-family: 'Righteous';
	font-style: normal;
	font-weight: 400;
	font-display: swap;
	src: url('/client-assets/Righteous-Regular.woff2') format('woff2');
}
</style>
