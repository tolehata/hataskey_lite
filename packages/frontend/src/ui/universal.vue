<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[$style.root, { '_forceShrinkSpacer': deviceKind === 'smartphone' }]" :data-note-charm-lane="noteCharmShellAvailable ? 'on' : undefined" :style="{ '--note-charm-rail-width': `${CHARM_RAIL_WIDTH}px` }">
	<XTitlebar v-if="prefer.r.showTitlebar.value" style="flex-shrink: 0;"/>

	<div :class="$style.nonTitlebarArea">
		<XSidebar v-if="!isMobile" :collapsed="isHataGoesPage ? sidebarCollapsed : undefined" :class="$style.sidebar" :showWidgetButton="!isDesktop" @widgetButtonClick="widgetsShowing = true" @toggleCollapse="sidebarCollapsed = !sidebarCollapsed"/>

		<div :class="[$style.contents, !isMobile && prefer.r.showTitlebar.value ? $style.withSidebarAndTitlebar : null]" @contextmenu.stop="onContextmenu">
			<div>
				<XReloadSuggestion v-if="shouldSuggestReload"/>
				<XPreferenceRestore v-if="shouldSuggestRestoreBackup"/>
				<XAnnouncements v-if="$i"/>
				<XStatusBars :class="$style.statusbars"/>
			</div>
			<StackingRouterView v-if="prefer.s['experimental.stackingRouterView']" :class="$style.content"/>
			<RouterView v-else :class="$style.content"/>
			<XMobileFooterMenu v-if="isMobile && mainRouter.currentRoute.value.path !== '/hatagoes'" ref="navFooter" v-model:drawerMenuShowing="drawerMenuShowing" v-model:widgetsShowing="widgetsShowing"/>
		</div>

		<div v-if="isDesktop && !pageMetadata?.needWideArea && prefer.s.enableWidgetsArea" data-note-charm-exclusion :class="$style.widgets" :data-collapsed="rightWidgetsCollapsed" :data-motion="prefer.r.animation.value" :data-widget-border="prefer.r['simpleUi.widgetBorder']?.value ? 'on' : 'off'">
			<div :class="$style.widgetsInner">
				<XWidgets collapsible :collapsed="rightWidgetsCollapsed" @toggleCollapse="rightWidgetsCollapsed = !rightWidgetsCollapsed"/>
			</div>
		</div>

		<XCommon v-model:drawerMenuShowing="drawerMenuShowing" v-model:widgetsShowing="widgetsShowing"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, provide, onMounted, computed, ref, onUnmounted } from 'vue';
import { instanceName } from '@@/js/config.js';
import { isLink } from '@@/js/is-link.js';
import XCommon from './_common_/common.vue';
import { showLoginBonusIfNeeded } from './_common_/common.js';
import type { PageMetadata } from '@/page.js';
import XMobileFooterMenu from '@/ui/_common_/mobile-footer-menu.vue';
import XPreferenceRestore from '@/ui/_common_/PreferenceRestore.vue';
import XReloadSuggestion from '@/ui/_common_/ReloadSuggestion.vue';
import XTitlebar from '@/ui/_common_/titlebar.vue';
import XSidebar from '@/ui/_common_/navbar.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { provideMetadataReceiver, provideReactiveMetadata } from '@/page.js';
import { deviceKind } from '@/utility/device-kind.js';
import { miLocalStorage } from '@/local-storage.js';
import { mainRouter } from '@/router.js';
import { prefer } from '@/preferences.js';
import { shouldSuggestRestoreBackup } from '@/preferences/utility.js';
import { DI } from '@/di.js';
import { concrntPagePostContextKey } from '@/utility/concrnt/post-interceptor.js';
import { shouldSuggestReload } from '@/utility/reload-suggest.js';
import { rightWidgetsCollapsed as savedRightWidgetsCollapsed, setRightWidgetsCollapsed } from '@/utility/hatasaba-device-prefs.js';
import { useHatagoesBarCollapse } from '@/utility/hatagoes-bar-collapse.js';
import { useNoteCharmAvailability } from '@/composables/use-note-charm-context.js';
import { CHARM_RAIL_WIDTH } from '@/utility/note-charm-physics.js';

const XWidgets = defineAsyncComponent(() => import('./_common_/widgets.vue'));
const XStatusBars = defineAsyncComponent(() => import('@/ui/_common_/statusbars.vue'));
const XAnnouncements = defineAsyncComponent(() => import('@/ui/_common_/announcements.vue'));

const isRoot = computed(() => mainRouter.currentRoute.value.name === 'index');
const isHataGoesPage = computed(() => mainRouter.currentRoute.value.path === '/hatagoes');
const sidebarCollapsed = useHatagoesBarCollapse(isHataGoesPage, () => false);
const rightWidgetsCollapsed = useHatagoesBarCollapse(isHataGoesPage, () => savedRightWidgetsCollapsed.value, setRightWidgetsCollapsed);
const noteCharmShellAvailable = useNoteCharmAvailability();

const DESKTOP_THRESHOLD = 1100;
const MOBILE_THRESHOLD = 500;

// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = ref(deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD);
const handleResize = () => {
	isMobile.value = deviceKind === 'smartphone' || window.innerWidth <= MOBILE_THRESHOLD;
};

window.addEventListener('resize', handleResize);

const pageMetadata = ref<null | PageMetadata>(null);
const widgetsShowing = ref(false);

provide(DI.router, mainRouter);
provide(concrntPagePostContextKey, () => true);
provideMetadataReceiver((metadataGetter) => {
	const info = metadataGetter();
	pageMetadata.value = info;
	if (pageMetadata.value) {
		if (isRoot.value && pageMetadata.value.title === instanceName) {
			window.document.title = pageMetadata.value.title;
		} else {
			window.document.title = `${pageMetadata.value.title} | ${instanceName}`;
		}
	}
});
provideReactiveMetadata(pageMetadata);

const drawerMenuShowing = ref(false);

mainRouter.on('change', () => {
	drawerMenuShowing.value = false;
});

if (window.innerWidth > 1024) {
	const tempUI = miLocalStorage.getItem('ui_temp');
	if (tempUI) {
		miLocalStorage.setItem('ui', tempUI);
		miLocalStorage.removeItem('ui_temp');
		window.location.reload();
	}
}

onMounted(() => {
	// ログインボーナスダイアログを表示（設定を尊重）
	showLoginBonusIfNeeded();
});

onMounted(() => {
	if (!isDesktop.value) {
		window.addEventListener('resize', () => {
			if (window.innerWidth >= DESKTOP_THRESHOLD) isDesktop.value = true;
		}, { passive: true });
	}
});

onUnmounted(() => {
	window.removeEventListener('resize', handleResize);
});

const onContextmenu = (ev) => {
	if (isLink(ev.target)) return;
	if (['INPUT', 'TEXTAREA', 'IMG', 'VIDEO', 'CANVAS'].includes(ev.target.tagName) || ev.target.attributes['contenteditable']) return;
	if (window.getSelection()?.toString() !== '') return;
	const path = mainRouter.getCurrentFullPath();
	os.contextMenu([{
		type: 'label',
		text: path,
	}, {
		icon: 'ti ti-window-maximize',
		text: i18n.ts.openInWindow,
		action: () => {
			os.pageWindow(path);
		},
	}], ev);
};
</script>

<style lang="scss" module>
$widgets-hide-threshold: 1090px;

.root {
	// This existing containment already moves viewport-fixed descendants with the shell.
	--MI-fixed-top-inset: 0px;
	height: var(--MI-viewport-height, 100dvh);
	overflow: clip;
	contain: strict;
	display: flex;
	flex-direction: column;
	background: var(--MI_THEME-navBg);
}

.nonTitlebarArea {
	display: flex;
	flex: 1;
	min-height: 0;
}

.sidebar {
	border-right: solid 0.5px var(--MI_THEME-divider);
}

.contents {
	display: flex;
	flex-direction: column;
	flex: 1;
	height: 100%;
	min-width: 0;

	&.withSidebarAndTitlebar {
		background: var(--MI_THEME-navBg);
		border-radius: 12px 0 0 0;
		overflow: clip;
	}
}

.content {
	flex: 1;
	min-height: 0;
}

// Keep a stable outside lane even when the widget column is collapsed or absent.
.root[data-note-charm-lane='on'] > .nonTitlebarArea > .contents {
	margin-right: var(--note-charm-rail-width);
}

.statusbars {
	position: sticky;
	top: 0;
	left: 0;
}

.widgets {
	position: relative;
	width: 350px;
	flex-shrink: 0;
	height: 100%;
	box-sizing: border-box;
	overflow: hidden;
	border-left: solid 0.5px var(--MI_THEME-divider);
	background: var(--MI_THEME-bg);
	transition: width .28s cubic-bezier(.22,1,.36,1);

	&[data-collapsed='true'] {
		width: 64px;
		border-left: 0;
	}

	@media (max-width: $widgets-hide-threshold) {
		display: none;
	}
}

// 内容の幅とスクロール領域を保ったまま、外側の列幅だけを開閉する。
.widgetsInner {
	position: absolute;
	top: 0;
	right: 0;
	width: calc(350px - .5px);
	height: 100%;
	box-sizing: border-box;
	overflow: auto;
	padding: var(--MI-margin) var(--MI-margin) calc(var(--MI-margin) + env(safe-area-inset-bottom, 0px));
	transition: padding .28s cubic-bezier(.22,1,.36,1);
}
.widgets[data-collapsed='true'] .widgetsInner {
	padding: calc(10px + env(safe-area-inset-top, 0px)) 8px 0;
	overflow: hidden;
}
.widgets[data-motion='false'], .widgets[data-motion='false'] .widgetsInner { transition: none; }
@media (prefers-reduced-motion: reduce) {
	.widgets, .widgetsInner { transition: none; }
}
</style>
