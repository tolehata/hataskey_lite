<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs" :hideHeader="true">
	<div ref="rootEl" :class="$style.scope" :data-smartphone="smartphone ? 'true' : 'false'" :data-overview="showOverview ? 'true' : 'false'" :data-motion-enabled="motionEnabled ? 'true' : 'false'" @wheel="onShellWheel">
		<a v-if="!showOverview" href="#settings-redesign-main" :class="$style.skip">{{ copy.skipToContent }}</a>
		<header :class="$style.header">
			<div :class="$style.headerLeading">
				<button type="button" :class="$style.iconButton" :aria-label="showOverview ? bentoCopy.settingsExit : bentoCopy.allCategories" @click="showOverview ? goSettingsBack() : goSettingsTop()"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
				<h1 v-if="!hideShellTitle" :class="$style.title">{{ i18n.ts.settings }}</h1>
			</div>
			<button ref="searchButtonEl" type="button" :class="$style.searchTrigger" :aria-label="copy.search.inputLabel" @click="openSearch"><i class="ti ti-search" aria-hidden="true"></i><span>{{ showSearchHint ? copy.searchHint : copy.searchTrigger }}</span></button>
			<div :class="$style.headerTrailing">
				<button v-if="isHatasabaUi2SurfaceActive" type="button" :class="$style.iconButton" :aria-label="copy.ui2.openPreview" @click="openHatasabaUi2Preview"><i class="ti ti-eye" aria-hidden="true"></i></button>
				<button type="button" :class="$style.iconButton" :aria-label="bentoCopy.profileMenu" :title="bentoCopy.profileMenu" data-settings-search-group-id="settings.group.preferences-backup-suggestion" @click="openPreferencesProfileMenu"><i class="ti ti-settings-2" aria-hidden="true"></i></button>
				<button v-if="$i" type="button" :class="$style.profileButton" :aria-label="i18n.ts.profile" @click="selectBentoCategory('profile')"><MkAvatar :user="$i" :link="false" :class="$style.headerAvatar"/></button>
			</div>
		</header>
		<div ref="layoutEl" :class="$style.layout">
			<aside v-if="showOverview || (!smartphone && !narrowShell)" ref="navEl" :class="$style.nav" :aria-label="copy.settingsCategories">
				<SettingsBentoNavigation :categories="settingsBentoCategories" :activeCategoryId="activeBentoCategoryId" :smartphone="smartphone" :motionEnabled="motionEnabled" @select="selectBentoCategory" @overview="goSettingsTop"/>
				<footer v-if="showOverview" :class="$style.overviewFooter">
					<div :class="$style.sessionActions" :aria-label="bentoCopy.sessionActions">
						<button v-for="item in destructiveItems" :key="item.id" type="button" :data-settings-search-id="item.searchId" data-settings-search-destructive="true" @click="runShellAction(item.id)"><i :class="item.icon" aria-hidden="true"></i>{{ item.label }}</button>
					</div>
					<button type="button" :class="$style.legacyMenu" @click="requestOpenLegacy"><i class="ti ti-history" aria-hidden="true"></i>{{ copy.legacySettings }}</button>
				</footer>
			</aside>
			<main v-show="!showOverview" id="settings-redesign-main" ref="mainEl" :class="$style.main" :aria-label="activeBentoCategory?.label ?? i18n.ts.settings" tabindex="-1">
				<header v-if="activeBentoCategory" :class="$style.categoryHeading">
					<div><span :class="$style.eyebrow">{{ activeBentoCategory.groupLabel }}</span><h2><i :class="activeBentoCategory.icon" aria-hidden="true"></i>{{ activeBentoCategory.label }}</h2><p>{{ activeBentoCategory.description }}</p></div>
					<button v-if="!isBentoCategorySurface" type="button" :class="$style.categoryBack" @click="selectBentoCategory(activeBentoCategory.id)"><i class="ti ti-grid-dots" aria-hidden="true"></i>{{ bentoCopy.categoryBack }}</button>
				</header>
				<SettingsSectionNavigation v-if="isBentoCategorySurface" :items="sectionNavigationItems" :activeId="activeSectionId" :motionEnabled="motionEnabled" @select="jumpToSection"/>
				<SettingsCategoryExplainer v-if="isBentoCategorySurface && requestedBentoCategoryId" :categoryId="requestedBentoCategoryId" :motionEnabled="motionEnabled"/>
				<div ref="sectionContentEl" :class="$style.contentCard" :data-page-enter="pageEnterDirection ?? undefined">
					<SettingsPopupBridge v-if="embeddedPopup != null" :popup="embeddedPopup" :settingsContext="settingsSearchContext" :motionEnabled="motionEnabled" embedded @closed="closeEmbeddedPopup"/>
					<SettingsCategorySurface v-else-if="isBentoCategorySurface && requestedBentoCategoryId" :categoryId="requestedBentoCategoryId" :motionEnabled="motionEnabled" :cacheAction="destructiveItems.find(item => item.id === 'clear-cache')" @openDestination="openBentoDestination" @runShellAction="runShellAction"/>
					<HatasabaUi2SettingsSurface v-else-if="isHatasabaUi2SurfaceActive" ref="hatasabaSurface" :motionEnabled="motionEnabled" @close="onSurfaceClose" @saved="onSurfaceSaved" @sideStudio="onSurfaceSideStudio"/>
					<SettingsPreferencesSurface v-else-if="activePreferenceDestinationId != null" :destinationId="activePreferenceDestinationId"/>
					<SettingsServiceConnectionSurface v-else-if="isServiceConnectionSurfaceActive" :motionEnabled="motionEnabled"/>
					<div v-else-if="!showOverview" :class="$style.legacyContent" @click.capture="onLegacyContentClickCapture"><NestedRouterView/></div>
					<SettingsRelatedLinks v-if="!isBentoCategorySurface && routeRelatedItems.length > 0" :items="routeRelatedItems" @select="goToSetting"/>
				</div>
			</main>
		</div>
	</div>
</PageWithHeader>

<Teleport to="body">
	<Transition
		:enterActiveClass="motionEnabled ? $style.navigationNoticeEnterActive : ''"
		:leaveActiveClass="motionEnabled ? $style.navigationNoticeLeaveActive : ''"
		:enterFromClass="motionEnabled ? $style.navigationNoticeEnterFrom : ''"
		:leaveToClass="motionEnabled ? $style.navigationNoticeLeaveTo : ''"
	>
		<div v-if="navigationNoticeMessage != null" :class="$style.navigationNoticeHost" :style="{ zIndex: navigationNoticeZIndex }">
			<SettingsNavigationNotice
				:key="navigationNoticeKey"
				:message="navigationNoticeMessage"
				:dismissLabel="copy.searchPrerequisite.dismiss"
				:dismissible="true"
				:motionEnabled="motionEnabled"
				@dismiss="clearNavigationNotice"
			/>
		</div>
	</Transition>
</Teleport>

<SettingsSearchPanel :open="searchOpen" :catalog="catalog" :catalogState="catalogState" @close="closeSearch" @select="onSearchSelect" @retry="loadCatalog"/>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, provide, ref, unref, useTemplateRef, watch } from 'vue';
import SettingsSearchPanel from './SettingsSearchPanel.vue';
import SettingsNavigationNotice from './SettingsNavigationNotice.vue';
import SettingsRelatedLinks from './SettingsRelatedLinks.vue';
import SettingsBentoNavigation from './SettingsBentoNavigation.vue';
import SettingsSectionNavigation from './SettingsSectionNavigation.vue';
import { useSettingsSectionNavigation } from './use-settings-section-navigation.js';
import SettingsCategorySurface from './SettingsCategorySurface.vue';
import SettingsCategoryExplainer from './SettingsCategoryExplainer.vue';
import { settingsBentoCategories, bentoCategoryForDestination } from './settings-bento-catalog.js';
import SettingsPopupBridge from './SettingsPopupBridge.vue';
import { createSettingsShellActions } from './settings-shell-actions.js';
import { assertUniqueNavigationIds } from './settings-navigation-ids.js';
import { createSettingsSurfaceLeaveGuard } from './settings-surface-leave-guard.js';
import { waitForSettingsNavigationFocus } from './settings-navigation-focus.js';
import { createSettingsBentoMotion } from './settings-bento-motion.js';
import { settingsDestinationSections, settingsDestinations, destinationForId } from './settings-destinations.js';
import { canonicalSearchIdForDescriptor, destinationForSearchDescriptor, generatedPreferenceSearchId, parsePreferenceDestination } from './settings-preferences-catalog.js';
import { mergeRedesignedPreferenceSearchItems, redesignedPreferenceStableIdAliases, settingsDestinationCatalogItemsV2, suppressLegacyPreferenceSearchMarkers } from './settings-preferences-search-index.js';
import HatasabaUi2SettingsSurface from './HatasabaUi2SettingsSurface.vue';
import SettingsPreferencesSurface from './SettingsPreferencesSurface.vue';
import SettingsServiceConnectionSurface from './SettingsServiceConnectionSurface.vue';
import type { MaybeRef } from 'vue';
import type { RouterFlag } from '@/lib/nirax.js';
import type { SettingsBentoCategoryId } from './settings-bento-catalog.js';
import type { SettingsSearchCloseEvent } from './SettingsSearchPanel.vue';
import type { SearchIndexItem } from '@/utility/inapp-search.js';
import type { SettingsActivationUnmetV2, SettingsControlCatalogItemV2 } from '@/utility/settings-control-search-v2.js';
import type { SettingsCatalogPresentationV2 } from '@/utility/settings-search-v2.js';
import type { SettingsSearchNavigationTargetV2, SettingsSearchV2Context } from '@/utility/settings-search-v2-context.js';
import type { SettingsRelatedLink } from './SettingsRelatedLinks.vue';
import type { SettingsDestinationSection } from './settings-destinations.js';
import type { SettingsShellActionId } from './settings-shell-actions.js';
import { createSearchHintController } from '@/pages/settings-redesign/settings-search-hint.js';
import { genSearchIndexes } from '@/utility/inapp-search.js';
import { initIntlString } from '@/utility/intl-string.js';
import { i18n } from '@/i18n.js';
import { DEFAULT_DEVICE_KIND } from '@/utility/device-kind.js';
import { getPreferencesProfileMenu } from '@/preferences/utility.js';
import { buildSettingsCatalogV2, canonicalStableIdForCatalogV2 } from '@/utility/settings-search-v2.js';
import { toSettingsControlCatalogItemsV2 } from '@/utility/settings-control-search-v2.js';
import { relatedSourcesForSettingsNavigationV2 } from '@/utility/settings-navigation-scope.js';
import {
	settingsSearchV2ContextKey,
} from '@/utility/settings-search-v2-context.js';
import { isFocusable } from '@/utility/focus.js';
import { clearCache } from '@/utility/clear-cache.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { signout, signoutAll } from '@/signout.js';
import { definePage, provideReactiveMetadata } from '@/page.js';
import { mainRouter, useRouter } from '@/router.js';

type SettingsActivation = NonNullable<SettingsSearchNavigationTargetV2['activation']>;
type SettingsActivationStep = NonNullable<SettingsActivation['steps']>[number];
type NavigationFocusTarget = { kind: 'control' | 'group'; id: string };
type ExactNavigationElement =
	| { state: 'missing' }
	| { state: 'ambiguous' }
	| { state: 'found'; element: HTMLElement };

const copy = i18n.ts._hata._settingsRedesign;
const bentoCopy = i18n.ts._hata._settingsBento;
const copyx = i18n.tsx._hata._settingsRedesign;
const omitHeaderTitle = inject<MaybeRef<boolean>>('shouldOmitHeaderTitle', false);
const hideShellTitle = computed(() => unref(omitHeaderTitle));

const settingsCatalogPresentation: SettingsCatalogPresentationV2 = {
	categoryLabels: {
		'hataskey-ui': settingsDestinationSections.find(section => section.id === 'hataskey-ui')?.label ?? copy.catalog.categories.hataskeyUi,
		'display-notes': copy.catalog.categories.displayNotes,
		'theme-font': copy.catalog.categories.themeFont,
		'timeline-posting': copy.catalog.categories.timelinePosting,
		reactions: copy.catalog.categories.reactions,
		'notification-sound': copy.catalog.categories.notificationSound,
		account: copy.catalog.categories.account,
		'hata-tools': copy.catalog.categories.hataTools,
		cherrypick: copy.catalog.categories.cherrypick,
		'data-connect': copy.catalog.categories.dataConnect,
		'misskey-ui': copy.catalog.categories.misskeyUi,
		behavior: copy.catalog.categories.behavior,
	},
	fallback: {
		'/settings/drive/cleaner': copy.catalog.fallback.driveCleaner,
		'/settings/theme/install': copy.catalog.fallback.themeInstall,
		'/settings/theme/manage': copy.catalog.fallback.themeManage,
		'/settings/statusbar': copy.catalog.fallback.statusbar,
		'/settings/plugin/install': copy.catalog.fallback.pluginInstall,
		'/settings/apps': copy.catalog.fallback.apps,
		'/settings/webhook/edit/:webhookId': copy.catalog.fallback.webhookEdit,
		'/settings/webhook/new': copy.catalog.fallback.webhookNew,
		'/settings/custom-css': copy.catalog.fallback.customCss,
		'/settings/account-stats': copy.catalog.fallback.accountStats,
		'/settings/external-account': copy.catalog.fallback.externalAccount,
		'/settings/concrnt': { label: 'コンカレント連携(BETA)' },
		'/settings/hata-custom': copy.catalog.fallback.hataCustom,
		'/settings/hidden-reactions': copy.catalog.fallback.hiddenReactions,
	},
	relationReasons: {
		sameSection: copy.catalog.relation.sameSection,
		sameGroup: copy.catalog.relation.sameGroup,
		sameNestedGroup: copy.catalog.relation.sameNestedGroup,
		samePreference: copy.catalog.relation.samePreference,
		sameFeature: copy.catalog.relation.sameFeature,
		sharedVisibleTerm: copy.catalog.relation.sharedVisibleTerm,
	},
	noRelatedReasons: {
		fallback: copy.catalog.noRelated.fallback,
		marker: copy.catalog.noRelated.marker,
		default: copy.catalog.noRelated.default,
	},
	fallbackReason: copy.catalog.system.fallbackReason,
	activationUnavailableReason: copy.catalog.system.activationUnavailable,
};

const emit = defineEmits<{
	openLegacy: [];
}>();

const router = useRouter();
const rootEl = useTemplateRef('rootEl');
const navEl = useTemplateRef<HTMLElement>('navEl');
const mainEl = useTemplateRef('mainEl');
const layoutEl = useTemplateRef('layoutEl');
const sectionContentEl = useTemplateRef<HTMLElement>('sectionContentEl');
const searchButtonEl = useTemplateRef('searchButtonEl');
const searchAnchorEl = searchButtonEl;
type HatasabaUi2SurfaceHandle = { requestDiscard: () => Promise<boolean>; rollback: () => void; hasChanges: boolean; openPreview: () => void };
const hatasabaSurface = useTemplateRef<HatasabaUi2SurfaceHandle>('hatasabaSurface');
const searchOpen = ref(false);
const isApplePlatform = ref(false);
const catalog = ref<ReturnType<typeof buildSettingsCatalogV2> | null>(null);
const catalogState = ref<'pending' | 'ready' | 'error'>('pending');
const compact = ref(false);
const narrowShell = ref(false);
const smartphone = computed(() => (prefer.r.overridedDeviceKind.value ?? DEFAULT_DEVICE_KIND) === 'smartphone');
const prefersReducedMotion = ref(false);
const navigationNoticeMessage = ref<string | null>(null);
const navigationNoticeKey = ref('');
const navigationNoticeZIndex = ref(0);
const motionEnabled = computed(() => prefer.r.animation?.value !== false && !prefersReducedMotion.value);
const currentFullPath = computed(() => {
	return router.currentRef.value == null ? '' : router.getCurrentFullPath();
});
const currentPath = computed(() => currentFullPath.value.replace(/[?#].*$/u, ''));
const isServiceConnectionSurfaceActive = computed(() => currentPath.value === '/settings/connect');
const currentDestinationId = computed(() => {
	const query = currentFullPath.value.split('?')[1]?.split('#')[0];
	return query == null ? null : new URLSearchParams(query).get('destination');
});
const indexInfo = {
	title: i18n.ts.settings,
	icon: 'ti ti-settings',
	hideHeader: true,
};

const hataCustomGlassUiItem = destinationForId('hataskey-ui')!;

const preferenceNavigationTargets = {
	density: generatedPreferenceSearchId('showGapBetweenNotesInTimeline'),
	noteDisplay: generatedPreferenceSearchId('showReplyTargetNote'),
	postForm: generatedPreferenceSearchId('showFixedPostForm'),
	chat: generatedPreferenceSearchId('chat.sendOnEnter'),
} as const;

const preferenceNavigationTargetExpectations = [
	{ controlId: preferenceNavigationTargets.density, preferenceKey: 'showGapBetweenNotesInTimeline' },
	{ controlId: preferenceNavigationTargets.noteDisplay, preferenceKey: 'showReplyTargetNote' },
	{ controlId: preferenceNavigationTargets.postForm, preferenceKey: 'showFixedPostForm' },
	{ controlId: preferenceNavigationTargets.chat, preferenceKey: 'chat.sendOnEnter' },
] as const;

function assertPreferenceNavigationTargets(nextCatalog: ReturnType<typeof buildSettingsCatalogV2>) {
	for (const { controlId, preferenceKey } of preferenceNavigationTargetExpectations) {
		const matches = nextCatalog.descriptors.filter(descriptor => (
			descriptor.source === 'control'
			&& descriptor.controlId === controlId
			&& descriptor.stableId === controlId
		));
		const [match] = matches;
		if (matches.length !== 1
			|| match == null
			|| match.route !== '/settings/preferences'
			|| !match.preferenceKeys.includes(preferenceKey)) {
			throw new Error(`[settings-redesign] stale preference navigation target: ${controlId}`);
		}
	}
}

const navSections: SettingsDestinationSection[] = settingsDestinationSections.map(section => ({
	...section,
	items: section.items.map(item => ({ ...item })),
}));

assertUniqueNavigationIds(navSections);

const primaryDestinationCountByRoute = computed(() => {
	const counts = new Map<string, number>();
	for (const destination of settingsDestinations) {
		if (destination.activation != null) continue;
		counts.set(destination.route, (counts.get(destination.route) ?? 0) + 1);
	}
	return counts;
});

const headerActions = computed(() => []);
const headerTabs = computed(() => []);
const settingsShellActions = createSettingsShellActions({
	clearCache,
	signout,
	signoutAll,
	confirm: os.confirm,
	labels: {
		logoutConfirm: i18n.ts.logoutConfirm,
		logoutAllConfirm: i18n.ts.logoutAllConfirm,
		logoutWillClearClientData: i18n.ts.logoutWillClearClientData,
	},
});

const destructiveItems = computed<Array<{ id: SettingsShellActionId; searchId: string; label: string; icon: string }>>(() => [
	{ id: 'clear-cache', searchId: 'settings.shell.clear-cache', label: i18n.ts.clearCache, icon: 'ti ti-trash' },
	{ id: 'logout', searchId: 'settings.shell.logout', label: i18n.ts.logout, icon: 'ti ti-logout' },
	{ id: 'logout-all', searchId: 'settings.shell.logout-all', label: i18n.ts.logoutAll, icon: 'ti ti-power' },
]);

async function runShellAction(id: string) {
	cancelBentoNavigation();
	if (id !== 'clear-cache' && id !== 'logout' && id !== 'logout-all') return;
	// A shell action can clear local state or terminate the session. Treat it as
	// a route-away operation for the shared UI2 draft, then leave its own
	// existing confirmation flow untouched.
	if (!await requestSurfaceDiscard()) return;
	await settingsShellActions[id as SettingsShellActionId]();
}

function pathWithoutQueryOrHash(fullPath: string) {
	return fullPath.replace(/[?#].*$/u, '');
}

function legacyHashFromPath(fullPath: string) {
	const hashIndex = fullPath.indexOf('#');
	if (hashIndex < 0 || hashIndex === fullPath.length - 1) return null;
	const encoded = fullPath.slice(hashIndex + 1);
	try {
		return decodeURIComponent(encoded);
	} catch {
		// A malformed historical hash must keep the legacy route visible instead
		// of being silently treated as the new default surface.
		return encoded;
	}
}

function isHataCustomPath(fullPath: string) {
	return pathWithoutQueryOrHash(fullPath) === '/settings/hata-custom';
}

// A direct, hashless legacy URL is now the compatible entry point for the
// permanent Hataskey UI.  Determine this before the first render so it does
// not briefly mount the legacy general category on a reload.
const initiallyOpenHatasabaUi2Surface = isHataCustomPath(router.getCurrentFullPath())
	&& legacyHashFromPath(router.getCurrentFullPath()) == null;
const activeHataCustomCategory = ref<string | null>(initiallyOpenHatasabaUi2Surface ? 'glassUi' : null);
const activeNavigationTarget = ref<SettingsSearchNavigationTargetV2 | null>(null);
const isHatasabaUi2SurfaceActive = computed(() => (
	currentPath.value === '/settings/hata-custom' && activeHataCustomCategory.value === 'glassUi'
));

// The redesigned shell owns this route. Queryless/invalid URLs still mount a
// deterministic new destination; the old route component remains reachable
// only through the explicit gateway legacy mode.
const activePreferenceDestinationId = computed(() => {
	if (currentPath.value !== '/settings/preferences') return null;
	const requested = currentDestinationId.value;
	return parsePreferenceDestination(requested ?? '')?.id ?? 'display-general';
});

/**
 * 旗鯖fork: 詳細画面でしばらく何も変えていないとき、見出しの場所に
 * 検索の在り処をそっと出す。理屈は settings-search-hint.ts にある。
 *
 * ⚠️「操作が無い」ではなく「**設定が変わっていない**」で数えること。
 *   読んでいるだけの人にこそ出したい案内なので、スクロールで消してはいけない。
 * ⚠️繋ぎ込みを忘れると、時計が正しくても一生出ない（一度そうなった）。
 *   下の watch を消すときは SettingsSearchHint.test.ts も一緒に見直すこと。
 */
const showSearchHint = ref(false);
const searchHintController = createSearchHintController({
	idleMs: 15000,
	visibleMs: 8000,
	extensionMs: 20000,
	maxExtensions: 3,
	// ⚠️狭い幅の詳細画面だけ。広い幅では検索窓が常に見えている。
	eligible: () => compact.value && !showOverview.value,
	onChange: (visible) => { showSearchHint.value = visible; },
});

const compactPageDirection = ref<'forward' | 'back'>('forward');

/**
 * 旗鯖fork: 画面が入れ替わったときだけ立てる印。CSSのアニメーションを1回流す。
 *
 * ⚠️Transition で要素ごと差し替えないこと。
 *   ⚠️ウィンドウの最大化を切り替えると幅の判定(compact)が反転し、鍵が変わって
 *   出入りの遷移が走る。その遷移が終わらないと**右ペインが白いまま二度と
 *   描かれなくなる**（左から何を選んでも白いまま）。
 *   ⚠️中身を常に置いたままにすれば、この壊れ方は起こり得ない。
 */
const pageEnterDirection = ref<'forward' | 'back' | null>(null);
let pageEnterTimer: number | null = null;

function playPageEnter() {
	if (!compact.value || !motionEnabled.value) return;
	if (pageEnterTimer != null) window.clearTimeout(pageEnterTimer);
	pageEnterDirection.value = null;
	// ⚠️同じ値のままだとアニメーションが再生されない。いったん外してから付ける。
	void nextTick(() => {
		pageEnterDirection.value = compactPageDirection.value;
		pageEnterTimer = window.setTimeout(() => {
			pageEnterDirection.value = null;
			pageEnterTimer = null;
		}, 280);
	});
}

/**
 * 旗鯖fork: いま開いている項目。
 *
 * ⚠️「経路だけの一致」と「はっきりした一致」を混ぜないこと。
 *   Hataskey独自ツールの項目はポップアップを開くだけで**経路が変わらない**ため、
 *   両方を素朴に OR で足すと、開いた項目とその経路の持ち主が**同時に**点いた。
 *   （実測: Hatady を開くと Hatady=true と HataFeed=true が並んだ）
 * ⚠️はっきりした一致が1つでもあれば、経路だけの一致は捨てる。
 *   これで兄弟タブの点灯は常に1つに保たれる。
 */
const activeNavigationItemIds = computed(() => {
	const explicitIds = new Set<string>();
	const routeOnlyIds = new Set<string>();
	const activeTarget = activeNavigationTarget.value;
	const destinationId = currentDestinationId.value;
	const preferenceDestinationId = activePreferenceDestinationId.value;
	const path = currentPath.value;

	for (const item of navSections.flatMap(section => section.items)) {
		const activation = item.activation;
		const activated = (activation?.kind === 'hata-custom-category' || activation?.kind === 'popup')
			&& path === item.route
			&& activeHataCustomCategory.value === activation.category;

		if (activeTarget?.stableId === item.stableId
			|| destinationId === item.id
			|| destinationId === item.stableId
			|| (item.route === '/settings/preferences' && preferenceDestinationId === item.id)
			|| activated) {
			explicitIds.add(item.id);
			continue;
		}

		if (activation == null
			&& path === item.route
			&& item.primary === true
			&& primaryDestinationCountByRoute.value.get(item.route) === 1) {
			routeOnlyIds.add(item.id);
		}
	}

	return explicitIds.size > 0 ? explicitIds : routeOnlyIds;
});

const focusableSelector = [
	'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(', ');

const searchOriginEl = ref<HTMLElement | null>(null);
let controlFocusRevision = 0;
let controlFocusCleanup: (() => void) | null = null;
let navigationRevision = 0;
let navigationWaitCleanup: (() => void) | null = null;
let navigationTargetClearTimer: number | null = null;
let lastNavigationOpener: HTMLElement | null = null;

type SettingsPopupBridgeKind = 'hatasaba-ui2' | 'earthquake' | 'ui-setup' | 'settings-transfer' | 'hatask' | 'hatady' | 'mascot';
type ActiveSettingsPopup = {
	popup: SettingsPopupBridgeKind;
	opener: HTMLElement | null;
	dispose: () => void;
};

let activeSettingsPopup: ActiveSettingsPopup | null = null;

function isSettingsPopupBridgeKind(value: string | undefined): value is SettingsPopupBridgeKind {
	return value === 'hatasaba-ui2'
		|| value === 'earthquake'
		|| value === 'ui-setup'
		|| value === 'settings-transfer'
		|| value === 'hatask'
		|| value === 'hatady'
		|| value === 'mascot';
}

function findFocusableElements() {
	return Array.from(window.document.querySelectorAll<HTMLElement>(focusableSelector)).filter(element => (
		!element.closest('[data-settings-search-overlay]') && isFocusable(element)
	));
}

function focusElement(element: HTMLElement | null | undefined) {
	if (element == null || !element.isConnected || !isFocusable(element)) return false;
	element.focus({ preventScroll: true });
	return true;
}

function focusAdjacentTo(origin: HTMLElement | null, direction: 'next' | 'previous') {
	const focusables = findFocusableElements();
	if (focusables.length === 0) return;
	const index = origin == null ? -1 : focusables.indexOf(origin);
	const offset = direction === 'next' ? 1 : -1;
	const target = focusables[(index + offset + focusables.length) % focusables.length] ?? null;
	if (!focusElement(target)) focusElement(searchAnchorEl.value);
}

function closeSearch(event: SettingsSearchCloseEvent) {
	searchOpen.value = false;
	if (event.reason === 'select') return;
	const origin = searchOriginEl.value ?? searchAnchorEl.value;
	void nextTick(() => window.requestAnimationFrame(() => {
		if (event.reason === 'tab') {
			focusAdjacentTo(origin, event.direction ?? 'next');
			return;
		}
		if (!focusElement(origin)) focusElement(searchAnchorEl.value);
	}));
}

function cancelControlFocus() {
	++controlFocusRevision;
	controlFocusCleanup?.();
	controlFocusCleanup = null;
}

function getControlFallbackFocusTarget(target: HTMLElement) {
	let group: HTMLElement | null = target;
	while (group != null && !group.matches('[data-in-app-search-marker-id], section, fieldset, [role="group"]')) {
		group = group.parentElement;
	}
	const root = group ?? target.parentElement ?? target;
	return root.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]') ?? root;
}

function clearActiveNavigationTarget(target: SettingsSearchNavigationTargetV2) {
	if (activeNavigationTarget.value === target) activeNavigationTarget.value = null;
}

function focusControlAfterNavigation(focusTarget: NavigationFocusTarget): Promise<boolean> {
	cancelControlFocus();
	const revision = controlFocusRevision;
	const targetNavigationRevision = navigationRevision;
	const attribute = focusTarget.kind === 'group' ? 'data-settings-search-group-id' : 'data-settings-search-id';
	const waiter = waitForSettingsNavigationFocus({
		find: () => exactNavigationElement(Array.from(window.document.querySelectorAll<HTMLElement>(`[${attribute}]`))
			.filter(element => element.getAttribute(attribute) === focusTarget.id)),
		focus: target => {
			const destination = [target, ...target.querySelectorAll<HTMLElement>(focusableSelector)]
				.find(element => !element.closest('[data-settings-related]') && isFocusable(element)) ?? getControlFallbackFocusTarget(target);
			const destinationIsFocusable: boolean = isFocusable(destination);
			if (!destinationIsFocusable && !destination.hasAttribute('tabindex')) destination.setAttribute('tabindex', '-1');
			// Center plus scroll-margin (below) keeps the target outside sticky headers.
			target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
			destination.focus({ preventScroll: true });
			return window.document.activeElement === destination;
		},
		isCurrent: () => revision === controlFocusRevision && targetNavigationRevision === navigationRevision,
	});
	controlFocusCleanup = waiter.cancel;
	return waiter.promise.finally(() => {
		if (controlFocusCleanup === waiter.cancel) controlFocusCleanup = null;
	});
}

function cancelPendingNavigation() {
	++navigationRevision;
	navigationWaitCleanup?.();
	navigationWaitCleanup = null;
	if (navigationTargetClearTimer != null) window.clearTimeout(navigationTargetClearTimer);
	navigationTargetClearTimer = null;
	cancelControlFocus();
	return navigationRevision;
}

function exactNavigationElement(elements: HTMLElement[]): ExactNavigationElement {
	if (elements.length === 0) return { state: 'missing' };
	if (elements.length !== 1) return { state: 'ambiguous' };
	return { state: 'found', element: elements[0] };
}

function waitForExactNavigationElement(find: () => ExactNavigationElement, revision: number): Promise<HTMLElement | null> {
	return new Promise(resolve => {
		let observer: MutationObserver | null = null;
		let timeout: number | null = null;
		let complete = false;
		let cancel: () => void = () => {};
		const finish = (element: HTMLElement | null) => {
			if (complete) return;
			complete = true;
			observer?.disconnect();
			if (timeout != null) window.clearTimeout(timeout);
			if (navigationWaitCleanup === cancel) navigationWaitCleanup = null;
			resolve(element);
		};
		cancel = () => finish(null);
		const check = () => {
			if (revision !== navigationRevision) {
				finish(null);
				return;
			}
			const result = find();
			if (result.state === 'ambiguous') {
				finish(null);
				return;
			}
			if (result.state === 'found') finish(result.element);
		};
		navigationWaitCleanup?.();
		navigationWaitCleanup = cancel;
		observer = new MutationObserver(check);
		observer.observe(window.document.body, { childList: true, subtree: true });
		timeout = window.setTimeout(cancel, 2500);
		check();
	});
}

function findHataCustomCategoryButton(category: string) {
	return exactNavigationElement(Array.from(window.document.querySelectorAll<HTMLElement>('[data-settings-category-id]'))
		.filter(element => rootEl.value?.contains(element) && element.dataset.settingsCategoryId === category));
}

async function activateHataCustomCategory(category: string, revision: number) {
	if (category === 'glassUi' && isHatasabaUi2SurfaceActive.value) return true;
	if (category !== 'glassUi' && isHatasabaUi2SurfaceActive.value) {
		// The permanent surface deliberately replaces the old category wrapper.
		// Reveal the requested legacy category first, then use its exact injected
		// button rather than guessing which internal tab should be selected.
		activeHataCustomCategory.value = category;
		await nextTick();
		if (revision !== navigationRevision) return false;
	}
	const button = await waitForExactNavigationElement(() => findHataCustomCategoryButton(category), revision);
	if (button == null || revision !== navigationRevision) return false;
	button.click();
	activeHataCustomCategory.value = category;
	await nextTick();
	return revision === navigationRevision;
}

function findSettingsRevealButton(revealId: string) {
	return exactNavigationElement(Array.from(window.document.querySelectorAll<HTMLElement>('[data-settings-reveal-id]'))
		.filter(element => element.dataset.settingsRevealId === revealId));
}

function findLegacySearchMarker(markerId: string) {
	return exactNavigationElement(Array.from(window.document.querySelectorAll<HTMLElement>('[data-in-app-search-marker-id]'))
		.filter(element => element.dataset.inAppSearchMarkerId === markerId));
}

async function focusLegacyMarkerAfterNavigation(markerId: string, revision: number): Promise<boolean> {
	navigationWaitCleanup?.();
	const waiter = waitForSettingsNavigationFocus({
		find: () => findLegacySearchMarker(markerId),
		focus: marker => {
			if (marker.tabIndex < 0) marker.tabIndex = -1;
			marker.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
			marker.focus({ preventScroll: true });
			return window.document.activeElement === marker;
		},
		isCurrent: () => revision === navigationRevision,
	});
	navigationWaitCleanup = waiter.cancel;
	try {
		return await waiter.promise;
	} finally {
		if (navigationWaitCleanup === waiter.cancel) navigationWaitCleanup = null;
	}
}

async function activateSettingsReveal(revealId: string, revision: number) {
	const button = await waitForExactNavigationElement(() => findSettingsRevealButton(revealId), revision);
	if (button == null || revision !== navigationRevision) return false;
	button.click();
	await nextTick();
	return revision === navigationRevision;
}

function restorePopupOpener(opener: HTMLElement | null) {
	void nextTick(() => window.requestAnimationFrame(() => {
		if (!focusElement(opener)) mainEl.value?.focus({ preventScroll: true });
	}));
}

function closeSettingsPopup(state: ActiveSettingsPopup, restoreOpener = true) {
	if (activeSettingsPopup !== state) return;
	activeSettingsPopup = null;
	state.dispose();
	if (restoreOpener) restorePopupOpener(state.opener);
}

/**
 * 旗鯖fork: 二ペインのときは、窓ではなく右ペインの中身として出す。
 * ⚠️窓のまま出すと、左で選んだ分類と右の中身が食い違ううえ、
 *   画面全体を覆ってしまい兄弟タブへ移れない。
 * ⚠️compact(スマホ幅)は右ペインが1枚しかなく、埋め込むと戻り道が消えるので窓のまま。
 */
const embeddedPopup = ref<SettingsPopupBridgeKind | null>(null);
let embeddedPopupOpener: { categoryId: SettingsBentoCategoryId; destinationId: string } | null = null;

async function closeEmbeddedPopup() {
	const opener = embeddedPopupOpener;
	embeddedPopupOpener = null;
	embeddedPopup.value = null;
	await nextTick();
	if (searchOpen.value || !isSettingsFullPath(router.getCurrentFullPath())) return;
	const button = opener != null && requestedBentoCategoryId.value === opener.categoryId
		? mainEl.value?.querySelector<HTMLElement>(`button[data-settings-destination-id="${opener.destinationId}"]`)
		: null;
	if (!focusElement(button)) mainEl.value?.focus({ preventScroll: true });
}

function openSettingsPopup(popup: SettingsPopupBridgeKind, opener: HTMLElement | null) {
	if (!compact.value) {
		if (embeddedPopup.value === popup) return true;
		// ⚠️窓が残っていると二重に出る。先に畳んでから埋め込みへ移す。
		if (activeSettingsPopup != null) closeSettingsPopup(activeSettingsPopup, false);
		embeddedPopup.value = popup;
		return true;
	}
	if (activeSettingsPopup != null) return activeSettingsPopup.popup === popup;
	const state: ActiveSettingsPopup = { popup, opener, dispose: () => {} };
	activeSettingsPopup = state;
	const { dispose } = os.popup(SettingsPopupBridge, {
		popup,
		settingsContext: settingsSearchContext,
		motionEnabled: motionEnabled.value,
	}, {
		closed: () => closeSettingsPopup(state),
	});
	state.dispose = dispose;
	return true;
}

function resolveNavigationTarget(request: SettingsSearchNavigationTargetV2): SettingsSearchNavigationTargetV2 {
	if (catalog.value == null) return request;
	const stableId = request.stableId == null ? undefined : canonicalStableIdForCatalogV2(catalog.value, request.stableId);
	const controlId = request.controlId == null ? undefined : canonicalStableIdForCatalogV2(catalog.value, request.controlId);
	const descriptor = (stableId != null ? catalog.value.byStableId.get(stableId) : undefined)
		?? (controlId != null ? catalog.value.byStableId.get(controlId) : undefined)
		?? catalog.value.descriptors.find(item => item.route === request.route && item.controlId === controlId);
	if (descriptor == null) return request;
	const resolved = {
		...request,
		...(stableId != null ? { stableId } : {}),
		...(controlId != null ? { controlId } : {}),
		...(request.activation == null && descriptor.activation != null ? { activation: descriptor.activation } : {}),
	};
	if (descriptor.route !== '/settings/preferences') return resolved;
	const canonicalId = canonicalSearchIdForDescriptor(descriptor, catalog.value.descriptors);
	return { ...resolved, stableId: descriptor.stableId, controlId: canonicalId ?? descriptor.controlId, anchor: undefined };
}

function activationSteps(activation: SettingsActivation): SettingsActivationStep[] {
	if (activation.steps != null && activation.steps.length > 0) return activation.steps;
	return [
		{ kind: 'category', id: activation.category },
		...(activation.kind === 'popup' ? [{ kind: 'popup' as const, id: activation.popup }] : []),
	];
}

function categoryForNavigationTarget(target: SettingsSearchNavigationTargetV2): string | null {
	const activation = target.activation;
	if (activation == null) return null;
	return activationSteps(activation).find((step): step is Extract<SettingsActivationStep, { kind: 'category' }> => step.kind === 'category')?.id
		?? activation.category;
}

function popupForNavigationTarget(target: SettingsSearchNavigationTargetV2): SettingsPopupBridgeKind | null {
	const activation = target.activation;
	if (activation == null) return null;
	const popup = activationSteps(activation).find((step): step is Extract<SettingsActivationStep, { kind: 'popup' }> => step.kind === 'popup')?.id;
	return isSettingsPopupBridgeKind(popup) ? popup : null;
}

function closeIrrelevantSettingsPopup(target: SettingsSearchNavigationTargetV2) {
	// ⚠️埋め込みも同じ規則で畳む。残すと、別の項目を選んだのに
	//   右ペインが前のポップアップのままになる。
	if (embeddedPopup.value != null && popupForNavigationTarget(target) !== embeddedPopup.value) {
		embeddedPopup.value = null;
	}
	const active = activeSettingsPopup;
	if (active == null || popupForNavigationTarget(target) === active.popup) return;
	// A related link may originate inside the existing bridge. Dispose it before
	// opening a different popup/route, but never steal focus back to its opener.
	closeSettingsPopup(active, false);
}

/**
 * 旗鯖fork: この項目がポップアップを開くだけのものか。
 * ⚠️MkA は自前のクリック処理で router.pushByPath(to) を必ず走らせる。親側の
 *   @click.prevent はリンクの既定動作しか止められないので、ポップアップ項目を
 *   MkA のまま置くと「ポップアップが開くのに右ペインも遷移する」ことになる。
 *   そのためポップアップ項目だけ <button> で描く。
 */
function staysOnHatasabaUi2Surface(target: SettingsSearchNavigationTargetV2) {
	return target.route === '/settings/hata-custom' && categoryForNavigationTarget(target) === 'glassUi';
}

function legacyHashDescriptor(fullPath: string) {
	const legacyId = legacyHashFromPath(fullPath);
	return legacyId == null ? null : catalog.value?.byLegacyId.get(legacyId) ?? null;
}

function fullPathStaysOnHatasabaUi2Surface(fullPath: string) {
	if (!isHataCustomPath(fullPath)) return false;
	const legacyId = legacyHashFromPath(fullPath);
	if (legacyId == null) return true;
	const target = legacyHashDescriptor(fullPath);
	return target != null && categoryForNavigationTarget(target) === 'glassUi';
}

async function requestSurfaceDiscard() {
	const surface = hatasabaSurface.value;
	return surface == null ? true : surface.requestDiscard();
}

function hasUnsavedHatasabaUi2Draft() {
	return isHatasabaUi2SurfaceActive.value && hatasabaSurface.value?.hasChanges === true;
}

const settingsSurfaceLeaveGuard = createSettingsSurfaceLeaveGuard({
	router: mainRouter,
	shouldBlockNavigation: fullPath => hasUnsavedHatasabaUi2Draft() && !fullPathStaysOnHatasabaUi2Surface(fullPath),
	shouldWarnBeforeUnload: hasUnsavedHatasabaUi2Draft,
	requestDiscard: requestSurfaceDiscard,
});

function pushShellRoute(fullPath: string, flag?: RouterFlag) {
	// Shell actions ask requestDiscard before arriving here. Let the global
	// guard know this one retry is already approved, without bypassing an
	// upstream Nirax hook such as the deck/page-window handler.
	// Nirax does not invoke navHook for an identical path, so do not leave a
	// stale allowance that could authorize a later re-entry into this route.
	if (router === mainRouter && router.getCurrentFullPath() !== fullPath) settingsSurfaceLeaveGuard.allowNextNavigation(fullPath);
	router.pushByPath(fullPath, flag);
}

async function requestSurfaceDiscardBeforeNavigation(target: SettingsSearchNavigationTargetV2) {
	if (!isHatasabaUi2SurfaceActive.value || staysOnHatasabaUi2Surface(target)) return true;
	return requestSurfaceDiscard();
}

function focusTargetForNavigation(target: SettingsSearchNavigationTargetV2): NavigationFocusTarget | null {
	if (target.activation?.focus != null) return target.activation.focus;
	if (target.route === '/settings/preferences' && target.stableId?.startsWith('settings.destination.')) return null;
	const descriptor = descriptorForNavigationTarget(target);
	if (descriptor != null && descriptor.route === '/settings/preferences') {
		if ((descriptor.unmet?.length ?? 0) > 0) return null;
		const canonicalId = canonicalSearchIdForDescriptor(descriptor, catalog.value?.descriptors ?? []);
		if (canonicalId != null) return { kind: 'control', id: canonicalId };
	}
	return target.controlId == null ? null : { kind: 'control', id: target.controlId };
}

function activeTargetForNavigation(target: SettingsSearchNavigationTargetV2, focusTarget: NavigationFocusTarget | null) {
	if (focusTarget != null) return { ...target, controlId: focusTarget.id };
	return target.anchor == null && target.stableId == null ? null : target;
}

function navigationPathForTarget(target: SettingsSearchNavigationTargetV2, focusTarget: NavigationFocusTarget | null) {
	const isShellAction = focusTarget?.kind === 'control'
		&& (focusTarget.id === 'settings.shell.clear-cache' || focusTarget.id === 'settings.shell.logout' || focusTarget.id === 'settings.shell.logout-all');
	if (isShellAction) return '/settings';
	if (target.route === '/settings/preferences') {
		const descriptor = descriptorForNavigationTarget(target);
		const mapped = descriptor == null ? null : destinationForSearchDescriptor(descriptor);
		const explicit = target.stableId?.startsWith('settings.destination.') ? target.stableId.slice('settings.destination.'.length) : null;
		const manifest = settingsDestinations.find(item => item.route === '/settings/preferences' && (item.controlId === target.controlId || item.controlId === target.stableId))?.id ?? null;
		const destinationId = mapped ?? (explicit != null && parsePreferenceDestination(explicit) != null ? explicit : manifest);
		if (destinationId != null) return `${target.route}?destination=${encodeURIComponent(destinationId)}`;
	}
	return target.anchor ? `${target.route}#${target.anchor}` : target.route;
}

function activeNavigationTargetMatchesCurrentPath() {
	const target = activeNavigationTarget.value;
	if (target == null || target.route !== currentPath.value) return target == null;
	return navigationPathForTarget(target, focusTargetForNavigation(target)) === router.getCurrentFullPath();
}

async function scheduleNavigationTargetActivation(target: SettingsSearchNavigationTargetV2, revision: number, opener: HTMLElement | null): Promise<boolean> {
	const focusTarget = focusTargetForNavigation(target);
	const activeTarget = activeTargetForNavigation(target, focusTarget);
	activeNavigationTarget.value = activeTarget;
	await nextTick();
	if (revision !== navigationRevision) {
		if (activeTarget != null) clearActiveNavigationTarget(activeTarget);
		return false;
	}
	const activated = await activateNavigationTarget(target, revision, opener);
	if (!activated || revision !== navigationRevision) {
		if (activeTarget != null) clearActiveNavigationTarget(activeTarget);
		return false;
	}
	if (focusTarget != null) {
		const focused = await focusControlAfterNavigation(focusTarget);
		if (activeTarget != null) clearActiveNavigationTarget(activeTarget);
		return focused;
	}
	if (target.anchor == null) {
		mainEl.value?.scrollTo({ top: 0, behavior: 'auto' });
		layoutEl.value?.scrollTo({ top: 0, behavior: 'auto' });
		mainEl.value?.focus({ preventScroll: true });
		return true;
	}
	const markerFocused = await focusLegacyMarkerAfterNavigation(target.anchor, revision);
	if (!markerFocused) {
		if (activeTarget != null) clearActiveNavigationTarget(activeTarget);
		return false;
	}
	// A confirmed marker keeps its folder-disclosure target only briefly.
	navigationTargetClearTimer = window.setTimeout(() => clearActiveNavigationTarget(target), 2500);
	return true;
}

async function activateNavigationTarget(target: SettingsSearchNavigationTargetV2, revision: number, opener: HTMLElement | null) {
	const activation = target.activation;
	if (activation == null) return true;
	const steps = activationSteps(activation);
	let previousStepOrder = -1;
	const activationHasUnmetPrerequisite = (activation.unmet?.length ?? 0) > 0;

	for (const step of steps) {
		if (revision !== navigationRevision) return false;
		const stepOrder = step.kind === 'category' ? 0 : step.kind === 'popup' ? 1 : 2;
		// Activation metadata is a typed, ordered allow-list. A bad generated
		// sequence must fail rather than clicking a later UI control out of context.
		if (stepOrder < previousStepOrder) return false;
		previousStepOrder = stepOrder;

		if (step.kind === 'category') {
			// The permanent glassUi surface intentionally unmounts the legacy
			// category buttons. A same-category search result is already revealed;
			// waiting for the old DOM here would otherwise incur a 2500ms timeout.
			if (step.id === 'glassUi' && isHatasabaUi2SurfaceActive.value) {
				await nextTick();
				continue;
			}
			if (!await activateHataCustomCategory(step.id, revision)) return false;
			continue;
		}
		if (step.kind === 'popup') {
			// The permanent Hataskey UI surface replaces this popup inside the
			// redesigned shell. Its shared body retains the generated control IDs.
			if (step.id === 'hatasaba-ui2' && isHatasabaUi2SurfaceActive.value) {
				await nextTick();
				continue;
			}
			if (!isSettingsPopupBridgeKind(step.id) || !openSettingsPopup(step.id, opener)) return false;
			await nextTick();
			continue;
		}
		// Unmet policy/consent/preference/runtime-data conditions are descriptive
		// metadata only. We never flip them merely to reveal a nested setting.
		if (activationHasUnmetPrerequisite) continue;
		if (!await activateSettingsReveal(step.id, revision)) return false;
	}

	return revision === navigationRevision;
}

function descriptorForNavigationTarget(target: SettingsSearchNavigationTargetV2) {
	if (catalog.value == null) return null;
	// Search results carry the authoritative stable id. Resolve it first so a
	// same-route related link cannot accidentally inherit another descriptor's
	// prerequisite explanation.
	if (target.stableId != null) {
		const stable = catalog.value.byStableId.get(canonicalStableIdForCatalogV2(catalog.value, target.stableId));
		if (stable != null) return stable;
	}
	if (target.controlId != null) {
		const controlId = canonicalStableIdForCatalogV2(catalog.value, target.controlId);
		const control = catalog.value.descriptors.find(descriptor => descriptor.controlId === controlId);
		if (control != null) return control;
	}
	if (target.anchor != null) return catalog.value.byLegacyId.get(target.anchor) ?? null;
	return null;
}

function navigationPrerequisiteKinds(target: SettingsSearchNavigationTargetV2): SettingsActivationUnmetV2['kind'][] {
	const descriptor = descriptorForNavigationTarget(target);
	const unmet = [
		...(descriptor?.unmet ?? []),
		...(descriptor?.activation?.unmet ?? []),
		...(target.activation?.unmet ?? []),
	];
	return [...new Set(unmet.map(item => item.kind))];
}

function setNavigationNotice(target: SettingsSearchNavigationTargetV2): void {
	const descriptor = descriptorForNavigationTarget(target);
	const kinds = navigationPrerequisiteKinds(target);
	if (descriptor == null || kinds.length === 0) {
		navigationNoticeMessage.value = null;
		navigationNoticeKey.value = '';
		return;
	}
	const messages = kinds.map(kind => copyx.searchPrerequisite[kind === 'runtime-data' ? 'runtimeData' : kind]({ label: descriptor.label }));
	navigationNoticeKey.value = `${descriptor.stableId}:${kinds.join(',')}`;
	navigationNoticeZIndex.value = os.claimZIndex('high');
	navigationNoticeMessage.value = messages.join(' ');
}

function clearNavigationNotice(): void {
	navigationNoticeMessage.value = null;
	navigationNoticeKey.value = '';
}

async function goToSetting(request: SettingsSearchNavigationTargetV2): Promise<boolean> {
	cancelBentoNavigation();
	embeddedPopupOpener = null;
	compactPageDirection.value = 'forward';
	const target = resolveNavigationTarget(request);
	if (!await requestSurfaceDiscardBeforeNavigation(target)) return false;
	if (!isSettingsFullPath(router.getCurrentFullPath())) return false;
	clearNavigationNotice();
	closeIrrelevantSettingsPopup(target);
	const revision = cancelPendingNavigation();
	const focusTarget = focusTargetForNavigation(target);
	const opener = searchOpen.value ? searchOriginEl.value : lastNavigationOpener;
	lastNavigationOpener = null;
	const directPopup = popupForNavigationTarget(target);
	if (directPopup != null && target.route === '/settings/hata-custom' && !staysOnHatasabaUi2Surface(target)) {
		const opened = openSettingsPopup(directPopup, opener);
		if (opened) activeNavigationTarget.value = target;
		return opened;
	}
	const path = navigationPathForTarget(target, focusTarget);
	pushShellRoute(path);
	const navigated = await scheduleNavigationTargetActivation(target, revision, opener);
	if (navigated) setNavigationNotice(target);
	return navigated;
}

async function onSearchSelect(target: SettingsSearchNavigationTargetV2) {
	// Keep the combobox mounted until the route/category/popup activation has
	// actually been accepted. A declined draft discard or failed exact target
	// leaves keyboard focus in the search panel instead of losing it to the page.
	if (await goToSetting(target)) closeSearch({ reason: 'select' });
}

function matchesFallbackRoute(sourceRoute: string | undefined, path: string) {
	if (sourceRoute == null) return false;
	const expected = sourceRoute.split('/').filter(Boolean);
	const actual = path.split('/').filter(Boolean);
	return expected.length === actual.length && expected.every((segment, index) => segment.startsWith(':') || segment === actual[index]);
}

const routeFallback = computed(() => catalog.value?.descriptors.find(descriptor => descriptor.isFallback && matchesFallbackRoute(descriptor.sourceRoute, currentPath.value)) ?? null);

function relatedSourcesForCurrentNavigation() {
	if (catalog.value == null) return [];
	return relatedSourcesForSettingsNavigationV2({
		descriptors: catalog.value.descriptors,
		byStableId: catalog.value.byStableId,
		currentRoute: currentPath.value,
		activeTarget: activeNavigationTarget.value,
		activeHataCustomCategory: activeHataCustomCategory.value,
		fallback: routeFallback.value,
	});
}

const pageOwnedRelatedRoutes: Readonly<Record<string, readonly string[]>> = {
	'/settings/profile': ['/settings/avatar-decoration', '/settings/note-charm'],
};

const routeRelatedItems = computed<SettingsRelatedLink[]>(() => {
	if (catalog.value == null) return [];
	const sources = relatedSourcesForCurrentNavigation();
	const items: SettingsRelatedLink[] = [];
	for (const source of sources) {
		for (const relation of source.related) {
			const related = catalog.value.byStableId.get(relation.stableId);
			if (related == null || !related.searchable || items.some(item => item.stableId === related.stableId)) continue;
			if (pageOwnedRelatedRoutes[currentPath.value]?.includes(related.route) === true) continue;
			const relatedTarget = { stableId: related.stableId, route: related.route, anchor: related.anchor, controlId: related.controlId, ...(related.activation ? { activation: related.activation } : {}) } satisfies SettingsSearchNavigationTargetV2;
			const relatedDestination = related.route === '/settings/preferences' ? destinationForSearchDescriptor(related) : null;
			if (related.route !== '/settings/preferences' && related.route === currentPath.value) continue;
			if (related.route === '/settings/preferences' && relatedDestination != null && relatedDestination === activePreferenceDestinationId.value) continue;
			if (navigationPathForTarget(relatedTarget, focusTargetForNavigation(relatedTarget)) === router.getCurrentFullPath()) continue;
			items.push({
				stableId: related.stableId,
				route: related.route,
				anchor: related.anchor,
				controlId: related.controlId,
				...(related.activation ? { activation: related.activation } : {}),
				label: related.label,
				reason: relation.reason,
				destructive: related.destructive === true,
			});
		}
	}
	return items;
});

function closestFromEventTarget(target: EventTarget | null, selector: string) {
	return target instanceof Element ? target.closest<HTMLElement>(selector) : null;
}

async function activateManualHataCustomCategory(category: string, button: HTMLElement) {
	if (isHatasabaUi2SurfaceActive.value && category !== 'glassUi' && !await requestSurfaceDiscard()) return;
	cancelPendingNavigation();
	activeNavigationTarget.value = null;
	button.click();
	activeHataCustomCategory.value = category;
}

function onLegacyContentClickCapture(event: MouseEvent) {
	const categoryButton = closestFromEventTarget(event.target, '[data-settings-category-id]');
	if (categoryButton?.dataset.settingsCategoryId != null) {
		if (event.isTrusted && isHatasabaUi2SurfaceActive.value && categoryButton.dataset.settingsCategoryId !== 'glassUi') {
			event.preventDefault();
			event.stopPropagation();
			void activateManualHataCustomCategory(categoryButton.dataset.settingsCategoryId, categoryButton);
			return;
		}
		if (event.isTrusted) {
			cancelPendingNavigation();
			activeNavigationTarget.value = null;
		}
		activeHataCustomCategory.value = categoryButton.dataset.settingsCategoryId;
		return;
	}

	const launcher = closestFromEventTarget(event.target, '[data-settings-popup-launcher]');
	const popup = launcher?.dataset.settingsPopupLauncher;
	if (launcher != null && isSettingsPopupBridgeKind(popup)) {
		// This capture handler exists only in the redesigned shell. It prevents the
		// legacy button's own os.popup call, so a direct click cannot create two windows.
		event.preventDefault();
		event.stopPropagation();
		if (popup === 'hatasaba-ui2') {
			void goToSetting(hataCustomGlassUiItem);
			return;
		}
		if (event.isTrusted) {
			cancelPendingNavigation();
			activeNavigationTarget.value = null;
		}
		void openSettingsPopup(popup, launcher);
		return;
	}

	const navigationOpener = closestFromEventTarget(event.target, 'button, a[href]');
	if (event.isTrusted && navigationOpener != null) {
		cancelPendingNavigation();
		activeNavigationTarget.value = null;
		lastNavigationOpener = navigationOpener;
	}
}

async function requestOpenLegacy() {
	cancelBentoNavigation();
	if (!await requestSurfaceDiscard()) return;
	emit('openLegacy');
}

async function onSurfaceClose() {
	// The body has already asked the draft to discard before emitting close.
	await goSettingsTop();
}

function onSurfaceSaved() {
	activeNavigationTarget.value = null;
}

async function onSurfaceSideStudio() {
	cancelBentoNavigation();
	if (!await requestSurfaceDiscard()) return;
	if (!isSettingsFullPath(router.getCurrentFullPath())) return;
	settingsSurfaceLeaveGuard.allowNextNavigation('/hata-side-studio');
	mainRouter.push('/hata-side-studio');
}

function activeHatasabaUi2Surface(): HatasabaUi2SurfaceHandle | null {
	return isHatasabaUi2SurfaceActive.value ? hatasabaSurface.value ?? null : null;
}

/**
 * A compact overview can request preview before the route's permanent surface
 * has mounted.  Watch the template ref rather than assuming one nextTick is
 * enough for a nested router/category activation, and never create a second
 * editor just to satisfy the preview request.
 */
function waitForHatasabaUi2Surface(): Promise<HatasabaUi2SurfaceHandle | null> {
	const current = activeHatasabaUi2Surface();
	if (current != null) return Promise.resolve(current);

	return new Promise(resolve => {
		let finished = false;
		let timeout: number | null = null;
		let stop: (() => void) | null = null;
		const finish = (surface: HatasabaUi2SurfaceHandle | null) => {
			if (finished) return;
			finished = true;
			stop?.();
			if (timeout != null) window.clearTimeout(timeout);
			resolve(surface);
		};
		const check = () => {
			const surface = activeHatasabaUi2Surface();
			if (surface != null) finish(surface);
		};
		stop = watch(() => [isHatasabaUi2SurfaceActive.value, hatasabaSurface.value], check, { flush: 'post' });
		timeout = window.setTimeout(() => finish(null), 2500);
		void nextTick(check);
	});
}

async function openHatasabaUi2Preview() {
	if (!isHatasabaUi2SurfaceActive.value) {
		await goToSetting(hataCustomGlassUiItem);
	}
	// The permanent surface owns the one shared editor object. Do not create a
	// popup or a second draft simply to show a mobile preview.
	const surface = await waitForHatasabaUi2Surface();
	surface?.openPreview();
}

function openSearch() {
	cancelBentoNavigation();
	// ⚠️案内を見たあとに検索へ手が伸びたなら、用は足りている。
	//   この滞在のあいだ、もう同じ案内は出さない（controller 側で判断する）。
	searchHintController.noteSearchUsed();
	searchOriginEl.value = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : searchAnchorEl.value;
	searchOpen.value = true;
}

function isTextEntryTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || target.matches('input, textarea, select, [contenteditable="true"]');
}

function onGlobalKeydown(event: KeyboardEvent) {
	if (event.defaultPrevented || event.isComposing || searchOpen.value) return;
	if (event.key.toLocaleLowerCase('en-US') !== 'k') return;
	const searchModifierPressed = isApplePlatform.value ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
	if (!searchModifierPressed || event.altKey || event.shiftKey || isTextEntryTarget(event.target)) return;

	event.preventDefault();
	openSearch();
}

async function loadCatalog() {
	catalog.value = null;
	catalogState.value = 'pending';
	await initIntlString(true).catch(error => { if (_DEV_) console.warn('[settings-search-v2] intl initialization failed', error); });
	const [legacyResult, controlResult] = await Promise.allSettled([
		import('search-index:settings'),
		import('search-index-v2:settings'),
	]);
	const legacyItems = legacyResult.status === 'fulfilled' ? genSearchIndexes(legacyResult.value.searchIndexes as SearchIndexItem[]) : [];
	let generatedControlItems: SettingsControlCatalogItemV2[] = [];
	if (controlResult.status === 'fulfilled') {
		try { generatedControlItems = toSettingsControlCatalogItemsV2(controlResult.value.settingsControlSearchIndexV2, i18n.ts as unknown as Record<string, unknown>); } catch (error) { if (_DEV_) console.warn('[settings-search-v2] control catalog adapter failed', error); }
	}
	try {
		const controlItems = mergeRedesignedPreferenceSearchItems(generatedControlItems);
		const stableIdAliases = redesignedPreferenceStableIdAliases(generatedControlItems);
		const destinationItems = settingsDestinationCatalogItemsV2();
		if (legacyItems.length === 0 && controlItems.length === 0) { catalogState.value = 'error'; return; }
		const nextCatalog = buildSettingsCatalogV2(legacyItems, controlItems, settingsCatalogPresentation, destinationItems, stableIdAliases);
		suppressLegacyPreferenceSearchMarkers(nextCatalog);
		assertPreferenceNavigationTargets(nextCatalog);
		catalog.value = nextCatalog;
		catalogState.value = 'ready';
		syncHataCustomRoutePresentation();
	} catch (error) {
		if (_DEV_) console.warn('[settings-search-v2] catalog build failed', error);
		catalogState.value = 'error';
	}
}

let appliedHataCustomDeepLink: string | null = null;

/**
 * Keep the old deep-link contract without mounting its general tab by default.
 * A plain `/settings/hata-custom` becomes the permanent glassUi surface, while
 * a known historical marker hash is resolved through the catalog exactly once.
 */
function syncHataCustomRoutePresentation() {
	const fullPath = router.getCurrentFullPath();
	if (!isHataCustomPath(fullPath)) {
		appliedHataCustomDeepLink = null;
		return;
	}

	const legacyId = legacyHashFromPath(fullPath);
	if (legacyId == null) {
		appliedHataCustomDeepLink = fullPath;
		// Do not cancel an explicit search/category activation that has already
		// claimed this route. It will choose glassUi or the requested old tab.
		if (activeNavigationTarget.value?.route !== currentPath.value) activeHataCustomCategory.value = 'glassUi';
		return;
	}
	if (catalogState.value !== 'ready' || catalog.value == null || appliedHataCustomDeepLink === fullPath) return;
	appliedHataCustomDeepLink = fullPath;
	const descriptor = catalog.value.byLegacyId.get(legacyId);
	if (descriptor == null) {
		// Unknown historical anchors must retain the old page rather than being
		// silently redirected to glassUi.
		activeHataCustomCategory.value = null;
		return;
	}
	if (descriptor.activation == null) {
		// A known legacy marker without a proved activation is still meaningful;
		// mount the old wrapper so its existing marker/folder behavior can handle it.
		activeHataCustomCategory.value = null;
	}
	if (descriptor.route !== currentPath.value) {
		// A hash on this compatibility route is never permission to jump to an
		// unrelated settings route. Keep the historical surface visible instead.
		activeHataCustomCategory.value = null;
		return;
	}

	const revision = cancelPendingNavigation();
	const target: SettingsSearchNavigationTargetV2 = {
		stableId: descriptor.stableId,
		route: descriptor.route,
		anchor: descriptor.anchor,
		controlId: descriptor.controlId,
		activation: descriptor.activation,
	};
	closeIrrelevantSettingsPopup(target);
	void scheduleNavigationTargetActivation(target, revision, null);
}

/**
 * 旗鯖fork: シェル上のホイールを、近い方のペインへ渡す。
 *
 * ⚠️すでにスクロールできる場所の上なら何もしないこと。二重に動いて飛ぶ。
 * ⚠️端まで来ているときも何もしない。外側へ伝播させる（親の器が動けるように）。
 * ⚠️横方向のホイールには手を出さない。
 */
function onShellWheel(ev: WheelEvent) {
	if (ev.deltaY === 0 || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;

	const root = rootEl.value;
	let node = ev.target instanceof HTMLElement ? ev.target : null;
	while (node != null && node !== root) {
		const overflowY = window.getComputedStyle(node).overflowY;
		if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) return;
		node = node.parentElement;
	}

	// ⚠️どちらのペインを動かすかは「指している位置に近い方」で決める。
	//   ⚠️横位置だけで決めないこと。狭い幅では左右ペインが縦に積まれ、
	//   横の範囲が重なるので、いつも片方だけが動いてしまう。
	const candidates = [navEl.value, mainEl.value].filter((pane): pane is HTMLElement => (
		pane != null && pane.scrollHeight > pane.clientHeight + 1 && pane.getBoundingClientRect().height > 0
	));
	if (candidates.length === 0) return;
	const distance = (pane: HTMLElement) => {
		const box = pane.getBoundingClientRect();
		const dx = Math.max(box.left - ev.clientX, 0, ev.clientX - box.right);
		const dy = Math.max(box.top - ev.clientY, 0, ev.clientY - box.bottom);
		return Math.hypot(dx, dy);
	};
	const pane = candidates.reduce((nearest, candidate) => (distance(candidate) < distance(nearest) ? candidate : nearest));

	const next = Math.max(0, Math.min(pane.scrollHeight - pane.clientHeight, pane.scrollTop + ev.deltaY));
	if (next === pane.scrollTop) return;
	ev.preventDefault();
	notifyManualSectionScroll(pane);
	pane.scrollTop = next;
}

const navMotion = createSettingsBentoMotion({
	enabled: () => motionEnabled.value,
	nextTick,
});
let pendingBentoPath: string | null = null;

function cancelBentoNavigation() {
	navMotion.cancel(true);
	pendingBentoPath = null;
}

watch(motionEnabled, enabled => { if (!enabled) navMotion.cancel(); });

const requestedBentoCategoryId = computed<SettingsBentoCategoryId | null>(() => {
	if (currentPath.value !== '/settings') return null;
	const id = new URLSearchParams(currentFullPath.value.split('?')[1]?.split('#')[0]).get('category');

	return settingsBentoCategories.find(category => category.id === id)?.id ?? null;
});
const isBentoCategorySurface = computed(() => requestedBentoCategoryId.value != null && embeddedPopup.value == null);
const { items: sectionNavigationItems, activeId: activeSectionId, select: jumpToSection, notifyManualScroll: notifyManualSectionScroll } = useSettingsSectionNavigation({
	content: sectionContentEl,
	scrollRoot: computed(() => smartphone.value ? layoutEl.value : mainEl.value),
	enabled: isBentoCategorySurface,
	categoryId: requestedBentoCategoryId,
	motionEnabled,
});
const activeBentoCategoryId = computed<SettingsBentoCategoryId | null>(() => {
	if (embeddedPopup.value === 'ui-setup' || embeddedPopup.value === 'hatasaba-ui2') return 'appearance';
	if (embeddedPopup.value === 'settings-transfer') return 'data';
	if (embeddedPopup.value != null) return 'apps';
	if (requestedBentoCategoryId.value != null) return requestedBentoCategoryId.value;
	if (currentPath.value === '/settings/note-charm') return 'profile';
	for (const id of activeNavigationItemIds.value) {
		const category = bentoCategoryForDestination(id);
		if (category != null) return category;
	}
	const destination = settingsDestinations.find(item => item.route === currentPath.value)
		?? settingsDestinations.find(item => currentPath.value.startsWith(`${item.route}/`));
	return destination == null ? null : bentoCategoryForDestination(destination.id) ?? null;
});
const activeBentoCategory = computed(() => settingsBentoCategories.find(category => category.id === activeBentoCategoryId.value) ?? null);
const showOverview = computed(() => currentPath.value === '/settings' && requestedBentoCategoryId.value == null && embeddedPopup.value == null);

async function selectBentoCategory(id: string) {
	const category = settingsBentoCategories.find(item => item.id === id);
	if (category == null || !await requestSurfaceDiscard()) return;
	if (!isSettingsFullPath(router.getCurrentFullPath())) return;
	cancelPendingNavigation();
	clearNavigationNotice();
	if (activeSettingsPopup != null) closeSettingsPopup(activeSettingsPopup, false);
	embeddedPopup.value = null;
	activeNavigationTarget.value = null;
	compactPageDirection.value = 'forward';
	const path = `/settings?category=${category.id}`;
	pendingBentoPath = path;
	await navMotion.transition(() => pushShellRoute(path));
	if (pendingBentoPath === path) pendingBentoPath = null;
	await nextTick();
	if (searchOpen.value || requestedBentoCategoryId.value !== category.id || embeddedPopup.value != null) return;
	mainEl.value?.scrollTo({ top: 0 });
	layoutEl.value?.scrollTo({ top: 0 });
	mainEl.value?.focus({ preventScroll: true });
}

async function openBentoDestination(id: string, event?: MouseEvent) {
	const destination = destinationForId(id);
	if (destination == null) return;
	const categoryId = requestedBentoCategoryId.value;
	const opener = event?.currentTarget ?? window.document.activeElement;
	lastNavigationOpener = opener instanceof HTMLElement ? opener : null;
	const accepted = await goToSetting(destination);
	if (!accepted || embeddedPopup.value == null) return;
	if (categoryId != null) embeddedPopupOpener = { categoryId, destinationId: id };
	await nextTick();
	if (!searchOpen.value && embeddedPopup.value != null) mainEl.value?.focus({ preventScroll: true });
}

async function openPreferencesProfileMenu(event: MouseEvent) {
	const anchor = event.currentTarget ?? event.target;
	cancelBentoNavigation();
	if (!await requestSurfaceDiscard()) return;
	if (!isSettingsFullPath(router.getCurrentFullPath())) return;
	os.popupMenu(getPreferencesProfileMenu(), anchor);
}

let previousShellWidth: number | null = null;

function updateCompact(width: number) {
	if (!(width > 0)) return;
	if (width !== previousShellWidth) navMotion.cancel();
	previousShellWidth = width;
	compact.value = width <= 680;
	narrowShell.value = width <= 600;
}

async function goSettingsTop() {
	if (!await requestSurfaceDiscard()) return;
	// ⚠️確認を待つ間に別の画面へ移っていることがある。そこで無条件に /settings を
	//   押すと、行こうとした先から設定へ引き戻してしまう。設定にいるときだけ押す。
	if (!isSettingsFullPath(router.getCurrentFullPath())) return;
	const categoryId = activeBentoCategoryId.value;
	cancelPendingNavigation();
	clearNavigationNotice();
	if (activeSettingsPopup != null) closeSettingsPopup(activeSettingsPopup, false);
	embeddedPopup.value = null;
	activeNavigationTarget.value = null;
	compactPageDirection.value = 'back';
	pendingBentoPath = '/settings';
	await navMotion.transition(() => pushShellRoute('/settings'));
	if (pendingBentoPath === '/settings') pendingBentoPath = null;
	await nextTick();
	if (searchOpen.value || !showOverview.value) return;
	const tile = navEl.value?.querySelector<HTMLElement>(`[data-settings-category-id="${categoryId}"]`);
	tile?.scrollIntoView({ block: 'nearest' });
	focusElement(tile);
}

/** 旗鯖fork: いま設定の中にいるか。⚠️下位ルートも含める。 */
function isSettingsFullPath(fullPath: string) {
	const path = fullPath.split('?')[0].split('#')[0];
	return path === '/settings' || path.startsWith('/settings/');
}

async function goSettingsBack() {
	cancelBentoNavigation();
	if (!await requestSurfaceDiscard()) return;
	// 旗鯖fork: ⚠️ここで history.back() を使わないこと。設定の中で分類や項目を
	//   選ぶたびに履歴を積むため、戻る操作が設定内を巡回する事故が起きる。
	//   設定へ入る前の場所は追えないので、確実に外へ出られる行き先を選ぶ。
	// ⚠️確認を待つ間に設定外へ移動済みなら、設定へ引き戻さない。
	if (!isSettingsFullPath(router.getCurrentFullPath())) return;
	// Deck can open ordinary links in a new window. Closing its main settings
	// page must navigate that page; independent settings windows keep their router.
	pushShellRoute(settingsExitRoute(), router === mainRouter ? 'forcePage' : undefined);
}

/**
 * 旗鯖fork: 設定から出るときの行き先。
 * 離脱先を帰還先として記録すると、設定を帰還先に持つアプリと往復する。
 * 設定を閉じる操作では、必ずTLへ出る。
 */
function settingsExitRoute(): string {
	return '/';
}

const resizeObserver = new ResizeObserver(([entry]) => {
	if (entry != null) updateCompact(entry.contentRect.width);
});
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let shellListenersActive = false;

function syncReducedMotion(event?: MediaQueryListEvent) {
	prefersReducedMotion.value = event?.matches ?? reducedMotionQuery.matches;
}

function activateShell() {
	settingsSurfaceLeaveGuard.install();
	const root = rootEl.value;
	if (!shellListenersActive) {
		if (root != null) resizeObserver.observe(root);
		window.addEventListener('keydown', onGlobalKeydown);
		reducedMotionQuery.addEventListener('change', syncReducedMotion);
		shellListenersActive = true;
	}
	syncReducedMotion();
	if (root != null) {
		const style = getComputedStyle(root);
		const width = root.getBoundingClientRect().width
			- parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
			- parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		updateCompact(width);
	}
}

function deactivateShell() {
	cancelBentoNavigation();
	if (pageEnterTimer != null) window.clearTimeout(pageEnterTimer);
	pageEnterTimer = null;
	pageEnterDirection.value = null;
	searchHintController.stop();
	settingsSurfaceLeaveGuard.dispose();
	cancelPendingNavigation();
	activeNavigationTarget.value = null;
	if (!shellListenersActive) return;
	resizeObserver.disconnect();
	window.removeEventListener('keydown', onGlobalKeydown);
	reducedMotionQuery.removeEventListener('change', syncReducedMotion);
	shellListenersActive = false;
}

onMounted(() => {
	isApplePlatform.value = /Mac|iPhone|iPad|iPod/u.test(navigator.platform);
	activateShell();
	void loadCatalog();
});

onActivated(activateShell);
onDeactivated(deactivateShell);

// ⚠️prefer.r は「素のオブジェクト＋ref」。JSON.stringify では .value ゲッターを
//   踏まないので依存が一切登録されず、watch は一生発火しない（実測で確認済み）。
//   各 ref の .value を実際に読むこと。
watch(() => Object.values(prefer.r).map(entry => entry.value), () => searchHintController.restart());

// ⚠️起動直後も含めて数え始める。狭さの判定は onMounted の後に決まるので、
//   compact を見張っていないと「PCで開いて狭くした」場合に永遠に出ない。
watch([compact, currentFullPath], () => searchHintController.restart(), { immediate: true });

watch(currentFullPath, (next, previous) => {
	if (next === previous) return;
	// Native callbacks can run before Vue's next render. Cancel immediately
	// when the router changes so an old callback cannot pull us into settings.
	if (next !== pendingBentoPath) cancelBentoNavigation();
}, { flush: 'sync' });

watch(currentFullPath, (next, previous) => {
	if (next === previous) return;
	embeddedPopup.value = null;
	if (activeSettingsPopup != null) closeSettingsPopup(activeSettingsPopup, false);
});

watch(router.currentRef, () => {
	const fullPath = router.getCurrentFullPath();
	if (!isSettingsFullPath(fullPath)) {
		// ⚠️設定から出た。入り直せばまた出すが、待ち時間は20秒ずつ延びる。
		searchHintController.noteLeftSettings();
	}
	playPageEnter();
	if (!activeNavigationTargetMatchesCurrentPath()) activeNavigationTarget.value = null;
	if (currentPath.value !== '/settings/hata-custom') activeHataCustomCategory.value = null;
	syncHataCustomRoutePresentation();
});
onUnmounted(deactivateShell);

const settingsSearchContext: SettingsSearchV2Context = {
	catalog,
	navigateToSetting: goToSetting,
	activeNavigationTarget,
	motionEnabled,
	inlineRelated: false,
};

provide(settingsSearchV2ContextKey, settingsSearchContext);

provideReactiveMetadata(ref(indexInfo));
definePage(() => indexInfo);
</script>

<style lang="scss">
@use './settings-redesign-brand.scss';

html:active-view-transition-type(settings-bento)::view-transition-old(root),
html:active-view-transition-type(settings-bento)::view-transition-new(root) {
	animation: none;
}
</style>

<style lang="scss" module>
.scope {
	display: grid;
	grid-template-rows: auto minmax(0, 1fr);
	box-sizing: border-box;
	block-size: calc(100cqh - (var(--MI-stickyTop, 0px) + var(--MI-stickyBottom, 0px)));
	min-block-size: 0;
	overflow: clip;
	container: settings-shell / inline-size;
	position: relative;
	background: var(--MI_THEME-bg);
	color: var(--MI_THEME-fg);
	line-break: strict;
	word-break: normal;
	text-wrap: pretty;
}
.header { display: grid; grid-template-columns: minmax(160px, 1fr) minmax(0, 640px) minmax(160px, 1fr); grid-template-areas: 'leading search trailing'; align-items: center; gap: 12px; padding: 20px 28px; min-width: 0; }
.headerLeading, .headerTrailing { display: flex; align-items: center; gap: 12px; min-width: 0; }
.headerLeading { grid-area: leading; }
.headerTrailing { grid-area: trailing; justify-content: flex-end; }
.title { margin: 0; min-width: 0; font-size: 1.5em; line-height: 1.3; overflow-wrap: anywhere; }
.iconButton, .profileButton, .categoryBack, .legacyMenu, .sessionActions > button {
	appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
	min-height: 44px; border: 0; border-radius: 22px; padding: 10px 14px;
	background: transparent; color: var(--MI_THEME-fg); cursor: pointer; font: inherit;
	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: -2px; }
}
.iconButton { flex: none; width: 44px; padding: 8px; font-size: 20px; }
.profileButton { flex: none; width: 44px; padding: 0; }
.headerAvatar { width: 38px; height: 38px; }
.searchTrigger {
	display: flex; align-items: center; gap: 10px; grid-area: search; justify-self: center; box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px;
	max-width: 640px; padding: 10px 18px; border-radius: 24px;
	border: 1px solid var(--MI_THEME-divider); background: var(--MI_THEME-panel); color: var(--MI_THEME-fgMuted);
	font: inherit; text-align: start; cursor: pointer; appearance: none;
	> span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: 2px; }
}
.layout { display: grid; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); min-height: 0; gap: 28px; padding: 0 28px 24px; }
.nav, .main { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; }
.nav::-webkit-scrollbar, .main::-webkit-scrollbar { display: none; }
.nav { padding: 2px; }
.main { outline: 0; padding: 2px 4px 24px; }
.main :deep([data-settings-search-id]) { scroll-margin-block: 24px; }
.main :deep([data-settings-section-anchor]) { scroll-margin-block-start: 76px; }
.main :deep([data-settings-section-anchor]:focus-visible) { outline: 2px solid var(--MI_THEME-focus); outline-offset: -3px; }
.scope[data-overview='true'] .header { box-sizing: border-box; width: 100%; max-width: 1236px; margin-inline: auto; }
.scope[data-overview='true'] .layout { display: block; overflow: auto; }
.scope[data-overview='true'] .nav { max-width: 1180px; margin: 0 auto; overflow: visible; }
.overviewFooter { display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--MI_THEME-divider); }
.sessionActions { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; }
.sessionActions > button { color: var(--MI_THEME-error); font-size: .8em; }
.legacyMenu { font-size: .8em; }
.categoryHeading { display: flex; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.eyebrow { font-size: .75em; font-weight: 700; color: var(--MI_THEME-accent); }
.categoryHeading h2 { display: flex; align-items: center; gap: 10px; margin: 4px 0; font-size: 1.6em; }
.categoryHeading p { margin: 0; font-size: .88em; color: var(--MI_THEME-fgMuted); }
.categoryBack { flex: none; border: 1px solid var(--MI_THEME-divider); font-size: .8em; }
.contentCard { min-width: 0; }
.legacyContent { padding: 20px; border: 1px solid var(--MI_THEME-divider); border-radius: 22px; background: var(--MI_THEME-panel); }
.legacyContent :deep(.rfqxtzch > .toggle) { display: grid; place-items: center; }
.skip { position: absolute; z-index: 2; top: 8px; left: 12px; transform: translateY(-160%); border-radius: 20px; padding: 8px 12px; background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); &:focus { transform: translateY(0); } }
.navigationNoticeHost { position: fixed; inset: max(12px, env(safe-area-inset-top)) 12px auto; display: flex; justify-content: center; width: calc(100% - 24px); pointer-events: none; }
.navigationNoticeHost > * { width: min(100%, 720px); pointer-events: auto; }
.navigationNoticeEnterActive, .navigationNoticeLeaveActive { transition: opacity 180ms ease, transform 180ms ease; }
.navigationNoticeEnterFrom, .navigationNoticeLeaveTo { opacity: 0; transform: translateY(-4px); }
@keyframes settingsPageForward { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
@keyframes settingsPageBack { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
.contentCard[data-page-enter='forward'] { animation: settingsPageForward 220ms ease; }
.contentCard[data-page-enter='back'] { animation: settingsPageBack 220ms ease; }
.scope[data-smartphone='true'] {
	/* 旗鯖fork: モバイルでは見出しを戻るボタンと右側ボタンの間で中央に置く。 */
	.header { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); grid-template-areas: 'leading title trailing' 'search search search'; gap: 8px; padding: 12px 16px; }
	.headerLeading { display: contents; }
	.headerLeading > .iconButton { grid-area: leading; justify-self: start; }
	.headerTrailing { gap: 8px; }
	.title { grid-area: title; font-size: 1.2em; text-align: center; }
	.searchTrigger { max-width: none; }
	.layout { display: block; overflow-y: auto; padding: 0 16px 24px; }
	.nav, .main { overflow: visible; padding: 0; }
	.categoryHeading { flex-wrap: wrap; margin-bottom: 16px; }
	.categoryHeading h2 { font-size: 1.4em; }
	.categoryBack { min-height: 44px; }
	.overviewFooter { flex-direction: column; align-items: stretch; gap: 4px; }
	.sessionActions { flex-direction: column; gap: 4px; }
	.sessionActions > button, .legacyMenu { justify-content: center; padding-inline: 12px; }
	.legacyContent { padding: 16px; }
}
@container settings-shell (max-width: 900px) {
	.layout { grid-template-columns: minmax(180px, 220px) minmax(0, 1fr); gap: 16px; padding-inline: 16px; }
	.header { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'leading trailing' 'search search'; padding-inline: 16px; gap: 8px; }
	.headerLeading, .headerTrailing { gap: 8px; }
	.searchTrigger { max-width: none; }
	.categoryHeading { flex-wrap: wrap; }
}
/* Narrow submenus use the whole pane, regardless of the selected device kind. */
@container settings-shell (max-width: 600px) {
	.layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 20px; }
}
.scope[data-motion-enabled='false'] :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
@media (prefers-reduced-motion: reduce) {
	.scope :deep(*), .navigationNoticeEnterActive, .navigationNoticeLeaveActive { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
</style>
