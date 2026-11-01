<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="show" ref="el" :class="[$style.root, { [$style.reduceBlurEffect]: !prefer.s.useBlurEffect, [$style.reduceAnimation]: !prefer.s.animation, [$style.scrollToTransparent]: showEl }]">
	<div :class="[$style.upper, { [$style.slim]: narrow, [$style.thin]: thin_ }]">
		<div v-if="hasBackButton" :class="$style.buttonsLeft">
			<button class="_button" :class="[$style.button, $style.goBack]" @click.stop="goBack" @touchstart.passive="preventDrag"><i class="ti ti-chevron-left"></i></button>
		</div>
		<div v-if="!thin_ && (narrow || deviceKind === 'smartphone') && props.displayMyAvatar && $i && !notification" class="_button" :class="$style.buttonsLeft" @click="openAccountMenu">
			<MkAvatar :class="$style.avatar" :user="$i"/>
		</div>
		<div v-else-if="!thin_ && narrow && !hideTitle && canBack" :class="$style.buttonsLeft"/>
		<div v-if="leftSpacing" :class="leftSpacing.class ? $style.buttonsLeft : undefined" :style="leftSpacing.style">
			<div v-for="(width, index) in leftSpacing.children" :key="index" :style="width"/>
		</div>

		<template v-if="props.title || props.icon">
			<div v-if="!hideTitle" :class="[$style.titleContainer, { [$style.titleContainer_canBack]: !canBack, [$style.titleCentered]: shouldCenterTitle }]" @click="top">
				<i v-if="props.icon" :class="[$style.titleIcon, props.icon]"></i>

				<div :class="$style.title">
					<div v-if="props.title">{{ props.title }}</div>
				</div>
			</div>
			<XTabs v-if="(!narrow || hideTitle)" :class="[$style.tabs, { [$style.tabs_canBack]: !canBack }]" :tab="tab" :tabs="tabs" :rootEl="el" @update:tab="key => emit('update:tab', key)" @tabClick="onTabClick"/>
		</template>
		<template v-else-if="pageMetadata">
			<div v-if="!hideTitle" :class="[$style.titleContainer, { [$style.titleContainer_canBack]: !canBack, [$style.titleCentered]: shouldCenterTitle }]" @click="(ev) => topWithMenu(ev)">
				<div v-if="pageMetadata.avatar" :class="$style.titleAvatarContainer">
					<MkAvatar :class="$style.titleAvatar" :user="pageMetadata.avatar" indicator/>
				</div>
				<HataAppLogo v-else-if="pageMetadata.hataApp" :app="pageMetadata.hataApp" :size="20" :monochrome="store.r.darkMode.value" :class="$style.titleBrandLogo"/><i v-else-if="pageMetadata.icon" :class="[$style.titleIcon, pageMetadata.icon]"></i>

				<div :class="$style.title">
					<MkUserName v-if="pageMetadata.userName" :user="pageMetadata.userName" :nowrap="true"/>
					<div v-else-if="pageMetadata.title"><HataAppWordmark v-if="isExactHataAppTitle(pageMetadata)" :app="pageMetadata.hataApp!" inheritColor/><template v-else>{{ pageMetadata.title }}</template></div>
					<div v-if="pageMetadata.subtitle" :class="$style.subtitle">
						{{ pageMetadata.subtitle }}
					</div>
				</div>
			</div>
			<XTabs v-if="(!narrow || hideTitle)" :class="[$style.tabs, { [$style.tabs_canBack]: !canBack }]" :tab="tab" :tabs="tabs" :rootEl="el" @update:tab="key => emit('update:tab', key)" @tabClick="onTabClick"/>
		</template>
		<div v-if="!thin_ && !narrow && (actions && actions.length > 0) && hideTitle && ['index'].includes(<string>router.currentRoute.value.name)" :class="$style.buttonsRight"/>
		<div v-if="(!thin_ && narrow && !hideTitle) || (actions && actions.length > 0)" :class="$style.buttonsRight">
			<template v-for="action in actions">
				<button :id="action.id" v-tooltip.noDelay="action.text" class="_button" :class="[$style.button, { [$style.highlighted]: action.highlighted }]" :aria-label="action.text" :aria-controls="action.controls" :aria-expanded="action.expanded" @click.stop="action.handler" @touchstart.passive="preventDrag"><i :class="action.icon" aria-hidden="true"></i></button>
			</template>
		</div>
		<div v-else-if="hasBackButton && !(actions && actions.length > 0)" :class="$style.buttonsRight"/>
		<div v-if="pageMetadata && pageMetadata.avatar && ($i && $i.id !== pageMetadata.userName?.id) && router.currentRoute.value.name === 'user' && !disableFollowButton && !notification" :class="$style.followButton">
			<MkFollowButton :user="pageMetadata.avatar" :transparent="false" :full="!narrow"/>
		</div>
	</div>
	<div v-if="narrow && !hideTitle && hasTabs" :class="[$style.lower, { [$style.slim]: narrow, [$style.thin]: thin_ }]">
		<XTabs :class="$style.tabs" :tab="tab" :tabs="tabs" :rootEl="el" @update:tab="key => emit('update:tab', key)" @tabClick="onTabClick"/>
	</div>
</div>
</template>

<script lang="ts">
import type { PageHeaderItem } from '@/types/page-header.js';
import type { PageMetadata } from '@/page.js';
import type { Tab } from './MkPageHeader.tabs.vue';

export type PageHeaderProps = {
	overridePageMetadata?: PageMetadata;
	tabs?: Tab[];
	tab?: string;
	actions?: PageHeaderItem[] | null;
	thin?: boolean;
	hideTitle?: boolean;
	canOmitTitle?: boolean;
	displayMyAvatar?: boolean;
	disableFollowButton?: boolean;
	notification?: boolean;
	/** 履歴ではなく、ページ固有の戻り先へ移動するときに指定する。 */
	backPath?: string;
	title?: string;
	icon?: string;
};
</script>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, inject, useTemplateRef, computed, unref } from 'vue';
import { getScrollPosition, scrollToTop } from '@@/js/scroll.js';
import type { MaybeRef } from 'vue';
import { deviceKind } from '@/utility/device-kind.js';
import XTabs from './MkPageHeader.tabs.vue';
import { globalEvents } from '@/events.js';
import { getAccountMenu } from '@/accounts.js';
import { $i } from '@/i.js';
import { DI } from '@/di.js';
import * as os from '@/os.js';
import { mainRouter, useRouter } from '@/router.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { miLocalStorage } from '@/local-storage.js';
import { scrollToVisibility } from '@/utility/scroll-to-visibility.js';
import MkFollowButton from '@/components/MkFollowButton.vue';
import { haptic } from '@/utility/haptic.js';
import { getVisibleBottomNav } from '@/utility/hatasaba-navigation.js';
import { isExactHataAppTitle } from '@/page.js';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { store } from '@/store.js';

const { showEl } = scrollToVisibility();
const router = useRouter();

/*
旗鯖fork: canBack は名前に反して「根の画面なので戻るボタンを出さない」の意（true で非表示）。
⚠️Hataskey UI の下部ナビには 探索 と チャット が無いため、本家の一覧をそのまま使うと
  「みつける」へ入った先で戻る導線が消えて前の画面に帰れなくなる（利用者報告）。
⚠️そこで simple UI のときは、実際に下部ナビへ出ている項目だけを根として扱う。
  ⚠️simpleUi.bottomNav に無い画面は必ず戻るボタンを出す（出しすぎても実害は無いが、
  出ないと詰む）。他UI（default / deck）は下部フッターに探索・チャットがあるため従来どおり。
*/
const rootPageNames = (() => {
	if (miLocalStorage.getItem('ui') !== 'simple') return ['index', 'explore', 'my-notifications', 'chat'];
	const bottomNav = prefer.s['simpleUi.bottomNav'] as { id: string; visible: boolean }[] | undefined;
	const visibleIds = new Set(getVisibleBottomNav(bottomNav ?? []).map((t) => t.id));
	const names = ['index'];
	if (visibleIds.has('notifications')) names.push('my-notifications');
	return names;
})();
const canBack = computed(() => rootPageNames.includes(<string>router.currentRoute.value.name));

const props = withDefaults(defineProps<PageHeaderProps>(), {
	tabs: () => ([] as Tab[]),
});

const emit = defineEmits<{
	(ev: 'update:tab', key: string);
}>();

//const viewId = inject(DI.viewId);
const injectedPageMetadata = inject(DI.pageMetadata, ref(null));
const pageMetadata = computed(() => props.overridePageMetadata ?? injectedPageMetadata.value);

const omitHeaderTitle = inject<MaybeRef<boolean>>('shouldOmitHeaderTitle', false);
const omitHeaderBack = inject<MaybeRef<boolean>>('shouldOmitHeaderBack', false);
const hideTitle = computed(() => unref(omitHeaderTitle) || props.hideTitle || (props.canOmitTitle && props.tabs.length > 0));
const thin_ = props.thin || inject('shouldHeaderThin', false);

const el = useTemplateRef('el');
const narrow = ref(false);
const hasTabs = computed(() => props.tabs.length > 0);

// 旗鯖fork: 戻るボタンがあり、かつ上段(.upper)にタブが無いときはタイトルを中央寄せにする(PC/モバイル問わず)。
//   上段にタブがある場合は競合するため中央化しない(タブはモバイルでは下段に移るのでその場合は中央化される)。
const tabsInUpper = computed(() => hasTabs.value && (!narrow.value || hideTitle.value));
const shouldCenterTitle = computed(() => !canBack.value && !hideTitle.value && !tabsInUpper.value);
const hasActions = computed(() => props.actions && props.actions.length > 0);
const hasBackButton = computed(() => !thin_ && !canBack.value && !props.notification && !unref(omitHeaderBack));
const hasAccountButton = computed(() => !thin_ && (narrow.value || deviceKind === 'smartphone') && props.displayMyAvatar && !!$i && !props.notification);
const hasFollowButton = computed(() => !!pageMetadata.value?.avatar && !!$i && $i.id !== pageMetadata.value.userName?.id && router.currentRoute.value.name === 'user' && !props.disableFollowButton && !props.notification);
const show = computed(() => {
	return !hideTitle.value || hasTabs.value || hasActions.value || hasBackButton.value || hasAccountButton.value || hasFollowButton.value;
});

const leftSpacing = computed(() => {
	if (thin_ || props.notification) return null;
	if (unref(omitHeaderBack) && !canBack.value) return null;

	const actions = props.actions;
	const actionsLength = actions?.length ?? 0;

	if (!narrow.value && actionsLength > 1 && router.currentRoute.value.name === 'index') {
		return { class: true, style: 'margin-right: auto;', children: ['width: 84px;'] };
	}

	if (narrow.value && actionsLength > 1 && router.currentRoute.value.name !== 'index') {
		return { class: false, style: '', children: ['width: 34px;'] };
	}

	if (pageMetadata.value?.avatar && router.currentRoute.value.name === 'user' && $i?.id !== pageMetadata.value.avatar.id) {
		return { class: false, style: '', children: ['width: 50px;'] };
	}

	return null;
});

const preventDrag = (ev: TouchEvent) => {
	ev.stopPropagation();
};

const top = () => {
	if (el.value) {
		scrollToTop(el.value as HTMLElement, { behavior: 'smooth' });
	}
};

const topWithMenu = (ev: MouseEvent) => {
	const pos = getScrollPosition(el.value as HTMLElement);
	if (el.value && pos !== 0) {
		scrollToTop(el.value as HTMLElement, { behavior: 'smooth' });
	} else if (pos === 0) {
		os.popupMenu([{
			text: i18n.ts.reload,
			icon: 'ti ti-refresh',
			action: () => {
				window.location.reload();
			},
		}], ev.currentTarget ?? ev.target);
	}
};

async function openAccountMenu(ev: MouseEvent) {
	haptic();

	const menuItems = await getAccountMenu({
		withExtraOperation: true,
	});

	os.popupMenu(menuItems, ev.currentTarget ?? ev.target);
}

function onTabClick(): void {
	top();
}

function goBack() {
	haptic();
	if (props.backPath) {
		router.pushByPath(props.backPath);
		return;
	}
	if (router !== mainRouter) {
		router.push('/');
		return;
	}

	// 旗鯖fork: PWAを通知から起動した場合など、戻れる履歴が無いと history.back() が無反応になる。
	//   その場合はホームへフォールバックして「◁が効かない」状態を防ぐ。
	if (window.history.length > 1) {
		window.history.back();
	} else {
		router.push('/');
	}
}

let ro: ResizeObserver | null;

onMounted(() => {
	if (el.value?.parentElement) {
		narrow.value = el.value.parentElement.offsetWidth < 500;
		ro = new ResizeObserver((entries, observer) => {
			if (el.value?.parentElement && window.document.body.contains(el.value as HTMLElement)) {
				narrow.value = el.value.parentElement.offsetWidth < 500;
			}
		});
		ro.observe(el.value.parentElement as HTMLElement);
	}
});

onUnmounted(() => {
	if (ro) ro.disconnect();
});
</script>

<style lang="scss" module>
.root {
	background: var(--MI-page-header-background, color(from var(--MI_THEME-pageHeaderBg) srgb r g b / 0.75));
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
	border-bottom: solid 0.5px transparent;
	width: 100%;
	color: var(--MI_THEME-pageHeaderFg);
	transition: background-color 0.5s;

	&.reduceBlurEffect {
		background-color: color(from var(--MI_THEME-bg) srgb r g b / 1);
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	&.reduceAnimation {
		transition: background-color 0s;
	}

	&.scrollToTransparent {
		background-color: transparent;
	}
}

@container style(--MI_THEME-pageHeaderBg: var(--MI_THEME-bg)) {
	.root {
		border-bottom: solid 0.5px var(--MI-page-header-divider, var(--MI_THEME-divider));
	}
}

.upper,
.lower {
	width: 100%;
	background: transparent;
}

.upper {
	--height: 50px;
	display: flex;
	gap: var(--MI-margin);
	height: var(--height);

	.tabs:first-child {
		margin-left: auto;
		padding: 0 12px;
	}
	.tabs {
		margin-right: auto;
	}

	.tabs_canBack {
		padding: 0 12px;
	}

	&.thin {
		--height: 40px;

		> .buttons {
			> .button {
				font-size: 0.9em;
			}
		}
	}

	&.slim {
		text-align: center;
		gap: 0;

		.tabs:first-child {
			margin-left: 0;
		}
		> .titleContainer {
			margin: 0 auto;
			max-width: 100%;
		}
	}
}

.lower {
	--height: 40px;
	height: var(--height);

	.tabs {
		margin-right: auto;
	}
}

.hideTitle {
	display: none;
}

.buttons {
	--MI-margin: 8px;
	display: flex;
	align-items: center;
	min-width: var(--height);
	height: var(--height);
	&:empty {
		width: var(--height);
	}
}

.buttonsLeft {
	composes: buttons;
	margin: 0 var(--MI-margin) 0 0;
}

.buttonsRight {
	composes: buttons;
	margin: 0 0 0 var(--MI-margin);
}

.button[aria-expanded] {
	min-width: 44px;
	min-height: 44px;
}

.upper:has(.button[aria-expanded]) {
	min-height: 44px;
}

.followButton {
  composes: buttons;
  margin: 0 var(--MI-margin) 0 0;
}

.goBack {
	margin-left: 8px;

	> i {
		margin: auto;
		font-size: medium;
	}
}

.avatar {
	$size: 32px;
	display: inline-block;
	width: $size;
	height: $size;
	vertical-align: bottom;
	margin: 0 8px;
}

.button {
	display: flex;
	align-items: center;
	justify-content: center;
	height: var(--height);
	width: calc(var(--height) - (var(--MI-margin)));
	box-sizing: border-box;
	position: relative;
	border-radius: 5px;

	&:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	&.highlighted {
		color: var(--MI_THEME-accent);
	}
}

.fullButton {
	& + .fullButton {
		margin-left: 12px;
	}
}

.titleContainer {
	display: flex;
	align-items: center;
	max-width: min(30vw, 400px);
	overflow: clip;
	white-space: nowrap;
	text-align: left;
	font-weight: bold;
	flex-shrink: 1;
	margin-left: 24px;
  -webkit-tap-highlight-color: transparent;
}

.titleContainer_canBack {
	margin-left: -16px;
}

/* 旗鯖fork: 戻るボタンがあり上段にタブが無いとき、タイトルを中央寄せにする(PC/モバイル問わず)。
   戻るボタンは左・アクションは右のまま、タイトルだけ中央へ寄せる(flexで伸ばして中央寄せ)。 */
.titleCentered {
	flex: 1;
	justify-content: center;
	text-align: center;
	margin-left: 0;
	max-width: none;
}

.titleAvatarContainer {
	$size: 32px;
	contain: strict;
	overflow: clip;
	width: $size;
	height: $size;
	padding: 8px;
	flex-shrink: 0;
}

.titleAvatar {
	width: 100%;
	height: 100%;
	pointer-events: none;
}

.titleIcon {
	margin-right: 8px;
	width: 16px;
	text-align: center;
}

.titleBrandLogo { margin-right: 8px; }

.title {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	line-height: 1.1;
}

.subtitle {
	opacity: 0.6;
	font-size: 0.8em;
	font-weight: normal;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;

	&.activeTab {
		text-align: center;

		> .chevron {
			display: inline-block;
			margin-left: 6px;
		}
	}
}

@container (max-width: 500px) {
  .followButton {
    margin: 0;
  }
}
</style>
