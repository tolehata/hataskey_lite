<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="shellRoot" data-hatagoes-root :data-active="shellActive" :data-narrow="narrowShell" :class="[$style.shell, themeClasses]" :data-hatask-theme="hataskPaletteTheme" :data-hatask-mode="hataskPaletteMode" :data-hatady-theme="activeTheme" :style="shellStyle">
	<header ref="shellHeader" :class="$style.header" :data-home="location.view === 'home'">
		<div :class="$style.brandGroup"><button ref="exitButton" type="button" :class="$style.iconButton" aria-label="終了" title="終了" @click="requestExit"><i class="ti ti-x" aria-hidden="true"></i></button><button type="button" :class="$style.brand" :aria-label="brandLabel" @click="openBrandHome"><HataAppLogo :key="brandApp" :monochrome="brandOnDark" :app="brandApp" :size="narrowShell ? 28 : 24" motion="startup" :active="shellActive" :tapSequence="logoTapSequence[brandApp]"/><Transition mode="out-in" :enterActiveClass="$style.brandEnter" :leaveActiveClass="$style.brandLeave" :enterFromClass="$style.brandHidden" :leaveToClass="$style.brandHidden"><HataAppWordmark :key="brandApp" :class="$style.brandText" :app="brandApp" :onDark="brandOnDark"/></Transition></button></div>
		<div :class="$style.appsSlot"><nav ref="appsCapsule" :class="$style.apps" :style="{ '--hg-app-count': apps.length + 1 }" aria-label="アプリ" @pointerenter="onNoticePointerEnter" @pointerleave="noticeHovered = false" @pointercancel="noticeHovered = false" @focusin="onNoticeFocusIn" @focusout="onNoticeFocusOut">
			<div v-if="shellActive && !dialogNoticeTarget && noticeGlowVisible && !narrowShell && noticeGeometryReady" :class="$style.noticeBloom" :data-leaving="noticeGlowLeaving" aria-hidden="true"><svg :viewBox="noticeViewBox" :style="noticeSvgStyle"><path v-for="path in noticePaths" :key="path" :d="path" pathLength="100" :style="{ strokeDashoffset: noticeProgress }"/></svg></div>
			<button type="button" aria-label="HataGoesホーム" title="HataGoesホーム" :aria-current="location.view === 'home' ? 'page' : undefined" @click="tapLogo('hatagoes'); common('home')"><HataAppLogo bare app="hatagoes" :size="20" :active="shellActive" :tapSequence="logoTapSequence.hatagoes"/><span>ホーム</span></button>
			<button v-for="app in apps" :key="app.id" type="button" :aria-label="app.label" :title="app.label" :aria-pressed="location.view === 'app' && location.app === app.id" @click="tapLogo(app.id); openApp(app.id)"><HataAppLogo bare :app="app.id" :size="20" :active="shellActive" :tapSequence="logoTapSequence[app.id]"/><HataAppWordmark :app="app.id" :onDark="brandOnDark" :inheritColor="location.view === 'app' && location.app === app.id"/></button>
			<span :class="$style.activePill" :style="appsPillStyle" aria-hidden="true"></span>
			<div ref="desktopNoticeHost" :class="$style.noticeHost" :style="noticeHostStyle"></div>
		</nav></div>
		<div :class="$style.actions">
			<button type="button" :class="$style.createButton" aria-label="作成" title="作成" @pointerdown="startLongPress" @pointerup="endLongPress" @pointerleave="cancelLongPress" @pointercancel="cancelLongPress" @click="showCreate"><i class="ti ti-plus"></i></button>
			<button ref="searchButton" type="button" aria-label="横断検索" title="横断検索" @click="openSearch"><i class="ti ti-search"></i></button>
			<div v-show="hatadyHeaderVisible && narrowShell" ref="hatadyMobileOverview" :class="$style.hatadyOverview"></div>
			<button type="button" aria-label="3アプリの通知" title="3アプリの通知" @click="common('notifications')"><i class="ti ti-bell"></i><span v-if="unread" :class="$style.badge">{{ unread > 99 ? '99+' : unread }}</span></button>
			<button v-if="currentScreen?.id !== 'hatask.support-admin'" type="button" aria-label="設定" title="設定" @click="openShellSettings"><i class="ti ti-settings"></i></button>
			<button type="button" aria-label="再読み込み" title="再読み込み" :disabled="refreshing" @click="refresh"><i class="ti ti-refresh" aria-hidden="true"></i></button>
		</div>
	</header>
	<nav ref="screenNav" :class="$style.screenNav" :data-home="location.view === 'home'" :data-hatady="hatadyHeaderVisible" :data-mobile-hatask="narrowShell && location.view === 'app' && location.app === 'hatask' && hasScreenCapsule" :data-notification="noticeGlowVisible" aria-label="画面一覧">
		<div v-show="hatadyHeaderVisible && !narrowShell" ref="hatadyHeaderDate" :class="$style.hatadyDate"></div>
		<button v-if="location.view !== 'home' && !isHataIntro" type="button" :class="$style.navBack" aria-label="戻る" title="戻る" @click="back"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
		<div v-show="hasScreenCapsule" :class="$style.screenCapsuleSlot"><div ref="mobileNoticeSurface" :class="$style.mobileNoticeSurface" @pointerenter="onNoticePointerEnter" @pointerleave="noticeHovered = false" @pointercancel="noticeHovered = false" @focusin="onNoticeFocusIn" @focusout="onNoticeFocusOut">
			<div v-if="shellActive && !dialogNoticeTarget && noticeGlowVisible && narrowShell && hasScreenCapsule && noticeGeometryReady" :class="$style.noticeBloom" :data-leaving="noticeGlowLeaving" aria-hidden="true"><svg :viewBox="noticeViewBox" :style="noticeSvgStyle"><path v-for="path in noticePaths" :key="path" :d="path" pathLength="100" :style="{ strokeDashoffset: noticeProgress }"/></svg></div>
			<div ref="screenCapsule" :class="$style.screenCapsule">
			<template v-if="location.view === 'app'">
				<button v-for="screen in appCapsuleScreens" :key="screen.id" type="button" :class="{ [$style.temporaryScreen]: isTemporaryScreen(screen) }" :aria-label="screenLabel(screen)" :title="screenLabel(screen)" :aria-current="isCurrent(screen) ? 'page' : undefined" @click="openScreen(screen)"><HataFeatureIcon v-if="hataFeatureForScreen(screen.id)" bare :feature="hataFeatureForScreen(screen.id)!" :size="20"/><i v-else :class="screen.icon" aria-hidden="true"></i><Transition :enterActiveClass="$style.navEnter" :leaveActiveClass="$style.navLeave" :enterFromClass="$style.navHidden" :leaveToClass="$style.navHidden"><span v-if="isCurrent(screen)" :class="screen.id === 'hatask.apps' || screen.id === 'hatask.tools' ? $style.wordmark : undefined">{{ screenLabel(screen) }}</span></Transition></button>
			</template>
				<span :class="$style.activePill" :style="screensPillStyle" aria-hidden="true"></span>
			</div>
			<div ref="mobileNoticeHost" :class="$style.mobileNoticeHost" :style="noticeHostStyle"></div>
		</div></div>
		<div v-show="hatadyHeaderVisible" ref="hatadyHeaderActions" :class="$style.hatadyActions"></div>
		<button v-if="!isDetail && (narrowShell || location.view === 'home' || location.view === 'app' && location.app === 'hatask')" type="button" :class="$style.directoryButton" aria-label="全てのアプリ" title="全てのアプリ" :aria-current="location.view === 'screens' ? 'page' : undefined" @click="openDirectory"><i class="ti ti-layout-grid" aria-hidden="true"></i></button>
		<HatagoesSupportButton v-if="location.view === 'app' && location.app === 'hatask'" :monochrome="brandOnDark" :class="$style.staffButton" @open="navigate('/hatask?tab=support')"/>
		<button v-for="screen in activeStaffScreens" :key="screen.id" type="button" :class="$style.staffButton" :aria-label="screenLabel(screen)" :title="screenLabel(screen)" :aria-current="isCurrent(screen) ? 'page' : undefined" @click="openScreen(screen)"><HataFeatureIcon v-if="hataFeatureForScreen(screen.id)" :feature="hataFeatureForScreen(screen.id)!" :size="24" :mode="brandOnDark ? 'mono-dark' : 'color'"/><i v-else :class="screen.icon" aria-hidden="true"></i></button>
		<button v-if="location.view === 'app' && location.app === 'hatafeed'" type="button" :class="$style.projectButton" :aria-label="`プロジェクト切替: ${appearances.hatafeed?.projectName || '現在のプロジェクト'}`" :title="appearances.hatafeed?.projectName || 'プロジェクト切替'" @click="openProjectSwitch"><i class="ti ti-folders" aria-hidden="true"></i><span>{{ appearances.hatafeed?.projectName || 'プロジェクト切替' }}</span><i class="ti ti-chevron-down" aria-hidden="true"></i></button>
		<div ref="fallbackNoticeSurface" :class="$style.fallbackNoticeSurface" :data-notification="shellActive && narrowShell && !hasScreenCapsule && !dialogNoticeTarget && ownsNoticeSurface && noticeGlowVisible" @pointerenter="onNoticePointerEnter" @pointerleave="noticeHovered = false" @pointercancel="noticeHovered = false" @focusin="onNoticeFocusIn" @focusout="onNoticeFocusOut"><div v-if="shellActive && !dialogNoticeTarget && noticeGlowVisible && narrowShell && !hasScreenCapsule && noticeGeometryReady" :class="$style.noticeBloom" :data-leaving="noticeGlowLeaving" aria-hidden="true"><svg :viewBox="noticeViewBox" :style="noticeSvgStyle"><path v-for="path in noticePaths" :key="path" :d="path" pathLength="100" :style="{ strokeDashoffset: noticeProgress }"/></svg></div><div ref="fallbackNoticeHost" :class="$style.mobileNoticeHost" :style="noticeHostStyle"></div></div>
	</nav>
	<div :class="$style.body">
		<div ref="contentSurface" :class="$style.content">
			<div v-if="message" :class="$style.message" role="alert">{{ message }} <button type="button" aria-label="閉じる" @click="message = ''">×</button></div>
			<div v-show="location.view === 'home' || location.view === 'search'" ref="homeScrollEl" data-hatagoes-home-scroll :class="[$style.common, $style.homeScroll]"><HatagoesHome ref="homeRef" :monochrome="brandOnDark" :cards="prefs.cards.value" :cardsV3="prefs.cardsV3?.value" :launcherApps="launcherApps" :halloween="prefs.theme.value.theme === 'halloween'" :recordRevision="homeRecordRevision" :revision="revision" :viewport="homeScrollEl" :decorationHost="shellRoot" :active="shellActive && (location.view === 'home' || location.view === 'search')" :busyTodoIds="busyTodoIds" :busyActions="busyActions" @navigate="navigate" @create="create" @toggleTodo="toggleTodo" @recordMood="recordMood" @water="water" @recordMeal="recordMeal" @recordReading="recordReading" @openApp="openHomeLauncherScreen" @allApps="openAllDirectory"/></div>
			<div v-show="location.view === 'notifications'" :class="$style.common"><HatagoesNotifications :active="shellActive && location.view === 'notifications'" :pollingActive="shellActive" :revision="revision" @count="unread = $event" @navigate="navigate"/></div>
			<div v-if="visited.settings" v-show="location.view === 'settings'" :class="$style.common">
				<HatagoesSettings :monochrome="brandOnDark" :pins="visiblePins" :appPins="visibleAppPins" :availableApps="apps.map(app => app.id)" :cards="prefs.cards.value" :cardsV3="prefs.cardsV3?.value" :theme="prefs.theme.value" :ready="prefs.ready.value" :saving="prefs.saving.value" :error="prefs.error.value" :screens="screens" @save="saveSetting" @retry="prefs.load" @appSettings="openAppSettings" @editAppPins="editAppPins" @navigate="navigate"/>
			</div>
			<HatagoesPane v-for="slot in slots" v-show="location.view === 'app' && hatagoesPaneKey(location.path) === slot.key" :key="slot.key" :class="$style.appPane" :monochrome="brandOnDark" :app="slot.app" :path="slot.path" :appearance="appearances[slot.app]" :launcherApps="launcherApps" :wide="!narrowShell" :hatadyHeaderDate="narrowShell ? null : hatadyHeaderDate" :hatadyHeaderActions="hatadyHeaderActions" :hatadyHeaderOverview="narrowShell ? hatadyMobileOverview : hatadyHeaderActions" :active="shellActive && location.view === 'app' && hatagoesPaneKey(location.path) === slot.key" @navigate="(path, replace) => navigateFromPane(slot, path, replace)" @register="registerBridge" @unregister="unregisterBridge" @appearance="appearances[slot.app] = $event" @mode="appModes[slot.app] = $event" @changed="changed" @exit="exit" @leave="router.pushByPath($event)" @openLauncherScreen="openHomeLauncherScreen" @openAllApps="openDirectory"/>
		</div>
	</div>
	<HatagoesCreateHost :open="createOpen" :mobile="narrowShell" :maxHeight="mobileCreateMaxHeight" :returnFocus="mobileCreateButton" @close="closeCreate" @closed="clearCreate">
		<section :class="[$style.createMenu, $style.overlayTheme, themeClasses]" :data-mobile="narrowShell" :data-hatask-theme="hataskPaletteTheme" :data-hatask-mode="hataskPaletteMode" :data-hatady-theme="activeTheme" :style="shellStyle" role="dialog" aria-label="作成" :aria-modal="narrowShell ? 'true' : undefined">
			<header><h2>{{ inlineCreateLabel || '作成' }}</h2><button v-if="!narrowShell" type="button" aria-label="閉じる" @click="closeCreate">×</button></header>
			<p v-if="createLoading" role="status">作成画面を開いています…</p>
			<p v-if="message" role="alert">{{ message }}</p>
			<div ref="createSurface" class="htk-root htk-goes-inline" :class="$style.createSurface" data-embedded="true" :data-theme="appearances.hatask?.theme" :style="appearances.hatask?.cssVars"></div>
			<template v-if="location.view !== 'app' && recentCreates.length">
				<h3>最近使った作成</h3><button v-for="item in recentCreates" :key="`${item.app}:${item.kind}`" type="button" @click="create(item.app, item.kind)">{{ appNames[item.app] }} · {{ item.label }}</button>
			</template>
			<section :class="$style.appPins">
				<header><h3>＋メニューに表示する項目</h3><button type="button" aria-label="＋メニューに表示する項目を編集" title="＋メニューに表示する項目を編集" @click="editAppPins"><i class="ti ti-pin" aria-hidden="true"></i>編集</button></header>
				<div :class="$style.appPinGrid"><button v-for="screen in appPinned" :key="screen.id" type="button" :aria-label="screen.label" @pointerdown="startAppPinPress" @pointerup="cancelLongPress" @pointerleave="cancelLongPress" @pointercancel="cancelLongPress" @contextmenu.prevent="editAppPins" @click="openAppPin(screen)"><HataFeatureIcon v-if="hataFeatureForScreen(screen.id)" :feature="hataFeatureForScreen(screen.id)!" :size="28" :mode="brandOnDark ? 'mono-dark' : 'color'"/><i v-else :class="screen.icon" aria-hidden="true"></i>{{ screen.label }}</button><button type="button" @click="editAppPins"><i class="ti ti-plus" aria-hidden="true"></i>追加</button></div>
			</section>
			<section><h3>{{ appNames[createApp] }} · 作成と移動</h3><div :class="$style.quickGrid"><button v-for="item in contextualCreates(createApp)" :key="item.kind" type="button" @click="create(createApp, item.kind)"><i :class="item.icon" aria-hidden="true"></i>{{ item.label }}</button></div></section>
			<section :class="$style.otherApps">
				<h3>ほかのアプリ</h3><div v-for="app in apps.filter(item => item.id !== createApp)" :key="app.id">
					<button type="button" :class="$style.appDisclosure" :aria-expanded="expandedCreateApps.includes(app.id)" :aria-controls="`hg-create-${app.id}`" @click="toggleCreateApp(app.id)"><HataAppLogo :app="app.id" :size="18" :monochrome="brandOnDark"/><HataAppWordmark :app="app.id" :onDark="brandOnDark"/><i class="ti ti-chevron-down" aria-hidden="true"></i></button>
					<Transition :enterActiveClass="$style.disclosureActive" :leaveActiveClass="$style.disclosureActive" :enterFromClass="$style.disclosureClosed" :leaveToClass="$style.disclosureClosed"><div v-show="expandedCreateApps.includes(app.id)" :id="`hg-create-${app.id}`" :class="$style.createOptions"><div><div :class="$style.quickGrid"><button v-for="item in createKinds[app.id]" :key="item.kind" type="button" @click="create(app.id, item.kind)"><i :class="item.icon" aria-hidden="true"></i>{{ item.label }}</button></div></div></div></Transition>
				</div>
			</section>
		</section>
	</HatagoesCreateHost>
	<div ref="mobileDock" :class="$style.mobileDock" :data-create-expanded="createOpen && narrowShell" :data-create-layer="mobileCreateExpanded">
	<nav ref="mobileCapsule" :class="$style.mobileNav" aria-label="モバイルアプリ">
		<button type="button" aria-label="HataGoesホーム" :aria-current="location.view === 'home' ? 'page' : undefined" @click="tapLogo('hatagoes'); common('home')"><HataAppLogo bare app="hatagoes" :size="location.view === 'home' ? 28 : 32" :active="shellActive" :tapSequence="logoTapSequence.hatagoes"/><span v-if="location.view === 'home'">ホーム</span></button>
		<button type="button" aria-label="Hatask" :aria-current="location.view === 'app' && location.app === 'hatask' ? 'page' : undefined" @click="tapLogo('hatask'); openApp('hatask')"><HataAppLogo bare app="hatask" :size="location.view === 'app' && location.app === 'hatask' ? 28 : 32" :active="shellActive" :tapSequence="logoTapSequence.hatask"/><HataAppWordmark v-if="location.view === 'home' || location.view === 'app' && location.app === 'hatask'" app="hatask" :inheritColor="true"/></button>
		<button ref="mobileCreateButton" type="button" :class="$style.mobileCreate" :data-open="createOpen" :aria-label="createOpen ? '作成を閉じる' : '作成'" :aria-expanded="createOpen" title="作成" @pointerdown="startLongPress" @pointerup="endLongPress" @pointerleave="cancelLongPress" @pointercancel="cancelLongPress" @click="showCreate"><i class="ti ti-plus" aria-hidden="true"></i></button>
		<button type="button" aria-label="Hatady" :aria-current="location.view === 'app' && location.app === 'hatady' ? 'page' : undefined" @click="tapLogo('hatady'); openApp('hatady')"><HataAppLogo bare app="hatady" :size="location.view === 'app' && location.app === 'hatady' ? 28 : 32" :active="shellActive" :tapSequence="logoTapSequence.hatady"/><HataAppWordmark v-if="location.view === 'home' || location.view === 'app' && location.app === 'hatady'" app="hatady" :inheritColor="true"/></button>
		<button v-if="canFeed" type="button" aria-label="HataFeed" :aria-current="location.view === 'app' && location.app === 'hatafeed' ? 'page' : undefined" @click="tapLogo('hatafeed'); openApp('hatafeed')"><HataAppLogo bare app="hatafeed" :size="location.view === 'app' && location.app === 'hatafeed' ? 28 : 32" :active="shellActive" :tapSequence="logoTapSequence.hatafeed"/><HataAppWordmark v-if="location.view === 'home' || location.view === 'app' && location.app === 'hatafeed'" app="hatafeed" :inheritColor="true"/></button>
		<span :class="$style.activePill" :style="mobilePillStyle" aria-hidden="true"></span>
	</nav>
	</div>
	<MkHataskeyNotificationToasts v-if="shellActive && !inheritedNotices" :context="noticeContext" :receiveExternal="ownsNoticeSurface"/>
	<Teleport to="body">
		<HatagoesDialog :open="shellActive && searchOpen" preferType="dialog" keepRendered @close="closeSearch" @closed="restoreSearchFocus">
			<div :class="[$style.overlayTheme, themeClasses]" :data-hatask-theme="hataskPaletteTheme" :data-hatask-mode="hataskPaletteMode" :data-hatady-theme="activeTheme" :style="shellStyle">
				<HatagoesSearch v-if="visited.search" :active="shellActive && searchOpen" :revision="revision" :monochrome="brandOnDark" @open="openSearchResult" @close="closeSearch"/>
			</div>
		</HatagoesDialog>
		<HatagoesDialog :open="settingsChoiceOpen" @close="settingsChoiceOpen = false">
			<section :class="[$style.choiceMenu, $style.overlayTheme, themeClasses]" :data-hatask-theme="hataskPaletteTheme" :data-hatask-mode="hataskPaletteMode" :data-hatady-theme="activeTheme" :style="shellStyle" role="dialog" aria-label="設定の選択">
				<h2>{{ appNames[settingsChoiceApp] }}設定に移動しますか？</h2>
				<div :class="$style.choiceActions">
					<button type="button" :class="$style.choicePrimary" @click="chooseAppSettings"><i class="ti ti-settings" aria-hidden="true"></i><span>{{ appNames[settingsChoiceApp] }} の設定</span></button>
					<button type="button" @click="chooseCommonSettings"><i class="ti ti-apps" aria-hidden="true"></i><span>共通設定</span></button>
					<button type="button" :class="$style.choiceCancel" @click="settingsChoiceOpen = false"><i class="ti ti-x" aria-hidden="true"></i><span>キャンセル</span></button>
				</div>
			</section>
		</HatagoesDialog>
		<HatagoesDialog :open="exitConfirmOpen" preferType="dialog" @close="cancelExit" @closed="restoreExitFocus">
			<section :class="[$style.choiceMenu, $style.overlayTheme, themeClasses]" :data-hatask-theme="hataskPaletteTheme" :data-hatask-mode="hataskPaletteMode" :data-hatady-theme="activeTheme" :style="shellStyle" role="dialog" aria-label="HataGoesの終了確認">
				<h2 :class="$style.exitChoiceTitle"><i class="ti ti-logout-2" aria-hidden="true"></i>HataGoesを終了しますか？</h2>
				<div :class="$style.choiceActions">
					<button type="button" :class="$style.choicePrimary" @click="confirmExit"><i class="ti ti-logout-2" aria-hidden="true"></i><span>終了する</span></button>
					<button type="button" :class="$style.choiceCancel" @click="cancelExit"><i class="ti ti-x" aria-hidden="true"></i><span>キャンセル</span></button>
				</div>
			</section>
		</HatagoesDialog>
		<HatagoesDialog :open="shellActive && location.view === 'screens'" responsiveSheet @close="closeScreens">
			<div :class="[$style.overlayTheme, themeClasses]" :data-hatask-theme="hataskPaletteTheme" :data-hatask-mode="hataskPaletteMode" :data-hatady-theme="activeTheme" :style="shellStyle">
				<HatagoesScreenPicker :title="directoryApp ? `${appNames[directoryApp]} の全てのアプリ` : '全てのアプリ'" :screens="directoryScreens" :pins="directoryApp === 'hatask' ? activeHataskPins : visiblePins" :appPins="visibleAppPins" :pinLimit="directoryApp === 'hatask' ? narrowShell ? 5 : 6 : undefined" :fixedPinIds="directoryApp === 'hatask' ? ['hatask.today'] : undefined" :pinnableIds="directoryApp === 'hatask' ? HATAGOES_HATASK_PIN_CANDIDATES : undefined" :pinLabel="directoryApp === 'hatask' ? 'Hataskのナビに表示するアプリ' : 'ナビに表示するアプリ'" :inlineReorder="directoryApp === 'hatask'" :showNavigationPins="directoryApp === 'hatask'" :monochrome="brandOnDark" :ready="prefs.ready.value" :saving="prefs.saving.value" @open="openPickerScreen" @close="closeScreens" @savePins="saveSetting(directoryApp === 'hatask' ? narrowShell ? 'hataskPins' : 'hataskPinsDesktop' : 'pins', $event)" @saveAppPins="saveSetting('appPins', $event)" @editPins="openPinSettings"/>
			</div>
		</HatagoesDialog>
		<HatagoesDialog :open="appPinsOpen" responsiveSheet @close="appPinsEditor?.requestClose()">
			<div :class="[$style.overlayTheme, themeClasses]" :data-hatask-theme="hataskPaletteTheme" :data-hatask-mode="hataskPaletteMode" :data-hatady-theme="activeTheme" :style="shellStyle">
				<HatagoesAppPins ref="appPinsEditor" :monochrome="brandOnDark" :pins="visibleAppPins" :screens="screens" :ready="prefs.ready.value" :saving="prefs.saving.value" :error="prefs.error.value" @save="saveSetting('appPins', $event)" @close="appPinsOpen = false"/>
			</div>
		</HatagoesDialog>
	</Teleport>
</div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, provide, reactive, ref, shallowRef, watch } from 'vue';
import type { Endpoints } from 'cherrypick-js';
import type { HatagoesApp, HatagoesCatalogEntry } from '@/utility/hatagoes-catalog.js';
import type { HatagoesCommonView } from '@/utility/hatagoes-navigation.js';
import type { HataGoesAppearance, HataGoesBridge } from '@/utility/hatagoes-context.js';
import { captureHatagoesPageTurn } from '@/utility/hatagoes-page-motion.js';
import { readAkatsukiUsage } from '@/utility/hatask-akatsuki-usage.js';
import { rankHatagoesLauncherScreens, recordHatagoesScreenUsage } from '@/utility/hatagoes-launcher-usage.js';
import { $i } from '@/i.js';
import { DI } from '@/di.js';
import { useRouter } from '@/router.js';
import { definePage, provideMetadataReceiver } from '@/page.js';
import { store } from '@/store.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { hatadyDialogSurfaces, hatadyNotice } from '@/utility/hatady-ui.js';
import { hataFeedDraftPromptOpen, registerHataFeedNoticeHost } from '@/utility/hatafeed-ui.js';
import MkHataskeyNotificationToasts from '@/components/MkHataskeyNotificationToasts.vue';
import { createHataskeyNotificationToasts, getToastDuration, hataskeyNotificationToastsKey, notificationOutlinePaths, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { HATAGOES_CATALOG, getHatagoesScreen, isHatagoesVisibleScreen } from '@/utility/hatagoes-catalog.js';
import { getHatagoesOrigin, hatagoesAppForPath, hatagoesPaneKey, hatagoesScreenPath, hatagoesUrl, isHatagoesCurrentScreen, isHatagoesIntroPath, isHatagoesPath, readHatagoesLocation } from '@/utility/hatagoes-navigation.js';
import { hatagoesSearchResultUrl } from '@/utility/hatagoes-search.js';
import { readHatagoesDeviceCache, writeHatagoesDeviceCache } from '@/utility/hatasaba-device-prefs.js';
import { useHatagoesPreferences } from '@/utility/hatagoes-preferences.js';
import { HATAGOES_HATASK_PIN_CANDIDATES, isHatagoesHataskPinCandidate } from '@/utility/hatagoes-hatask-pins.js';
import { HATA_GOES_SESSION } from '@/utility/hatagoes-context.js';
import { createHataGoesPopupSession } from '@/utility/hatagoes-popup.js';
import HatagoesPane from '@/components/hatagoes/HatagoesPane.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataFeatureIcon from '@/components/HataFeatureIcon.vue';
import { hataFeatureForScreen } from '@/utility/hata-feature-icon.js';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import type { HataApp } from '@/utility/hata-app-brand.js';
import HatagoesHome from '@/components/hatagoes/HatagoesHome.vue';
import HatagoesSearch from '@/components/hatagoes/HatagoesSearch.vue';
import HatagoesNotifications from '@/components/hatagoes/HatagoesNotifications.vue';
import HatagoesSettings from '@/components/hatagoes/HatagoesSettings.vue';
import HatagoesScreenPicker from '@/components/hatagoes/HatagoesScreenPicker.vue';
import HatagoesAppPins from '@/components/hatagoes/HatagoesAppPins.vue';
import HatagoesSupportButton from '@/components/hatask/HatagoesSupportButton.vue';
import { useHataMascotSuppression } from '@/utility/hata-mascot-suppression.js';
import HatagoesDialog from '@/components/hatagoes/HatagoesDialog.vue';
import HatagoesCreateHost from '@/components/hatagoes/HatagoesCreateHost.vue';

const router = useRouter();
const closeWindow = inject(DI.pageWindowClose, null);
const prefs = useHatagoesPreferences();
const homeRef = ref<InstanceType<typeof HatagoesHome> | null>(null);
const homeRecordRevision = ref(0);
const location = ref(readHatagoesLocation(router.getCurrentFullPath()));
const shellActive = ref(true);

useHataMascotSuppression(shellActive);
const shellRoot = ref<HTMLElement>();
const shellHeader = ref<HTMLElement>();
const searchButton = ref<HTMLButtonElement>();
const appsCapsule = ref<HTMLElement>();
const screenNav = shallowRef<HTMLElement | null>(null);
const hatadyHeaderDate = shallowRef<HTMLElement | null>(null);
const hatadyHeaderActions = shallowRef<HTMLElement | null>(null);
const hatadyMobileOverview = shallowRef<HTMLElement | null>(null);
const mobileNoticeSurface = shallowRef<HTMLElement | null>(null);
const fallbackNoticeSurface = shallowRef<HTMLElement | null>(null);
const desktopNoticeHost = shallowRef<HTMLElement | null>(null);
const mobileNoticeHost = shallowRef<HTMLElement | null>(null);
const fallbackNoticeHost = shallowRef<HTMLElement | null>(null);
const narrowShell = ref(false);
const noticeHovered = ref(false);
const noticeFocused = ref(false);

function onNoticePointerEnter(event: PointerEvent) { noticeHovered.value = shellActive.value && ownsNoticeSurface.value && !dialogNoticeTarget.value && event.currentTarget === shellNoticeOutline.value && event.pointerType === 'mouse'; }

function onNoticeFocusIn(event: FocusEvent) { noticeFocused.value = shellActive.value && ownsNoticeSurface.value && !dialogNoticeTarget.value && event.currentTarget === shellNoticeOutline.value && event.target instanceof Element && event.target.matches(':focus-visible'); }

function onNoticeFocusOut(event: FocusEvent) { noticeFocused.value = shellActive.value && ownsNoticeSurface.value && !dialogNoticeTarget.value && event.currentTarget === shellNoticeOutline.value && event.currentTarget instanceof Element && event.relatedTarget instanceof Element && event.currentTarget.contains(event.relatedTarget) && event.relatedTarget.matches(':focus-visible'); }

const inheritedNotices = inject(hataskeyNotificationToastsKey, null);
const noticeContext = inheritedNotices ?? createHataskeyNotificationToasts(computed(() => false), computed(() => false));
provide(hataskeyNotificationToastsKey, noticeContext);
const dialogNoticeTarget = computed(() => shellActive.value ? hatadyDialogSurfaces.value.findLast(element => element.isConnected && !element.closest('[inert]')) ?? null : null);
const noticeTarget = computed(() => dialogNoticeTarget.value ?? (narrowShell.value ? hasScreenCapsule.value ? mobileNoticeHost.value : fallbackNoticeHost.value : desktopNoticeHost.value));
const shellNoticeOutline = computed(() => (narrowShell.value ? hasScreenCapsule.value ? mobileNoticeSurface.value : fallbackNoticeSurface.value : appsCapsule.value) ?? null);
const noticeOutline = computed(() => dialogNoticeTarget.value ?? shellNoticeOutline.value);
const noticeSurface = {
	active: computed(() => shellActive.value),
	target: noticeTarget,
	outline: noticeOutline,
	animations: computed(() => true),
	forceAnimations: computed(() => true),
	paused: computed(() => noticeHovered.value || noticeFocused.value || hataFeedDraftPromptOpen.value),
};
let releaseNoticeSurface = noticeContext.registerSurface(noticeSurface);
let noticeSurfaceRegistered = true;

function unregisterNoticeSurface() { if (noticeSurfaceRegistered) { releaseNoticeSurface(); noticeSurfaceRegistered = false; } }

function registerNoticeSurface() { if (!noticeSurfaceRegistered) { releaseNoticeSurface = noticeContext.registerSurface(noticeSurface); noticeSurfaceRegistered = true; } }

const ownsNoticeSurface = computed(() => noticeContext.surface.value === noticeSurface);
const heldNoticeHeight = ref(64);
const noticeHostStyle = computed(() => ({ height: shellActive.value && ownsNoticeSurface.value && !dialogNoticeTarget.value && noticeGlowVisible.value ? `${heldNoticeHeight.value}px` : '0px' }));
const noticeGlowVisible = ref(false);
const noticeGlowLeaving = ref(false);
const noticeSize = ref({ width: 0, height: 0, radius: 24 });
const noticeGeometryReady = computed(() => noticeSize.value.width > 4 && noticeSize.value.height > 4);
const noticeSvgStyle = computed(() => ({ width: `${noticeSize.value.width}px`, height: `${noticeSize.value.height}px` }));
const noticeViewBox = computed(() => `0 0 ${noticeSize.value.width} ${noticeSize.value.height}`);
const noticePaths = computed(() => notificationOutlinePaths(noticeSize.value.width, noticeSize.value.height, noticeSize.value.radius, true));
const lastNoticeProgress = ref(100);
const noticeProgress = computed(() => {
	const item = ownsNoticeSurface.value ? noticeContext.items.value[0] : undefined;
	return item ? 100 * (1 - item.elapsed / getToastDuration(item)) : lastNoticeProgress.value;
});
let noticeGlowTimer: number | undefined;

function measureNoticeOutline() {
	const outline = shellNoticeOutline.value;
	if (!outline) return;
	const rect = outline.getBoundingClientRect();
	noticeSize.value = { width: rect.width, height: rect.height, radius: parseFloat(getComputedStyle(outline).borderTopLeftRadius) || 24 };
}

const releaseNoticeReceiver = registerNotificationPageContext(noticeContext, () => shellActive.value && ownsNoticeSurface.value);
const releaseFeedNotice = registerHataFeedNoticeHost({ active: () => shellActive.value && ownsNoticeSurface.value, notify: message => noticeContext.enqueueStatus(message) });
provide(HATA_GOES_SESSION, createHataGoesPopupSession(shellActive));
const contentSurface = ref<HTMLElement>();
const homeScrollEl = ref<HTMLElement>();
const screenCapsule = ref<HTMLElement>();
const mobileCapsule = ref<HTMLElement>();
const mobileDock = ref<HTMLElement>();
type PillStyle = { transform: string; width: string; height: string; top: string; opacity: string };
const hiddenPill: PillStyle = { transform: 'translateX(0)', width: '0px', height: '0px', top: '0px', opacity: '0' };
const appsPillStyle = ref<PillStyle>(hiddenPill);
const screensPillStyle = ref<PillStyle>(hiddenPill);
const mobilePillStyle = ref<PillStyle>(hiddenPill);
let surfaceMotion: ReturnType<typeof captureHatagoesPageTurn> | undefined;
const appNames = { hatask: 'Hatask', hatady: 'Hatady', hatafeed: 'HataFeed' };
const brandLabel = computed(() => location.value.view === 'app' ? appNames[location.value.app] : 'HataGoes');
const brandApp = computed<'hatagoes' | HatagoesApp>(() => location.value.view === 'app' ? location.value.app : 'hatagoes');
const logoTapSequence = reactive<Record<HataApp, number>>({ hatagoes: 0, hatask: 0, hatady: 0, hatafeed: 0, hataigo: 0 });

function tapLogo(app: HataApp): void { logoTapSequence[app]++; }

function openBrandHome() {
	const app = brandApp.value;
	tapLogo(app);
	if (app === 'hatagoes') common('home');
	else openApp(app);
}

function screenLabel(screen: HatagoesCatalogEntry): string {
	const prefix = `${appNames[screen.app]} `;
	return screen.label.startsWith(prefix) ? screen.label.slice(prefix.length) : screen.label;
}

const canFeed = computed(() => !!$i && ($i.isAdmin || $i.isModerator || ($i.policies as Record<string, unknown>)?.canAccessHataFeed === true));
const apps = computed(() => ([{ id: 'hatask', label: 'Hatask' }, { id: 'hatady', label: 'Hatady' }, { id: 'hatafeed', label: 'HataFeed' }] as const).filter(app => app.id !== 'hatafeed' || canFeed.value));
const screens = computed<readonly HatagoesCatalogEntry[]>(() => HATAGOES_CATALOG.filter((screen: HatagoesCatalogEntry) => {
	if (!isHatagoesVisibleScreen(screen)) return false;
	if (screen.app === 'hatafeed' && !canFeed.value) return false;
	if (screen.access === 'admin') return !!$i?.isAdmin;
	if (screen.access === 'moderator' || screen.access === 'hatafeedStaff') return !!($i?.isAdmin || $i?.isModerator);
	if (screen.access === 'canUseMascot') return ($i?.policies as Record<string, unknown>)?.canUseMascot !== false;
	return true;
}));
const launcherUsage = ref(readAkatsukiUsage($i?.id));
const launcherApps = computed(() => rankHatagoesLauncherScreens(screens.value, launcherUsage.value));
const visiblePins = computed(() => prefs.pins.value.filter(id => { const screen = getHatagoesScreen(id); return !!screen && isHatagoesVisibleScreen(screen); }));
const visibleAppPins = computed(() => prefs.appPins.value.filter(id => { const screen = getHatagoesScreen(id); return !!screen && isHatagoesVisibleScreen(screen); }));
const appPinned = computed(() => visibleAppPins.value.map(getHatagoesScreen).filter((screen): screen is HatagoesCatalogEntry => !!screen && screens.value.some(s => s.id === screen.id)));
const appPinsOpen = ref(false);
const appPinsEditor = ref<InstanceType<typeof HatagoesAppPins> | null>(null);
const directoryApp = ref<HatagoesApp | null>(null);
const staffScreens = computed(() => screens.value.filter(screen => screen.access === 'admin' || screen.access === 'moderator' || screen.access === 'hatafeedStaff'));
const activeStaffScreens = computed(() => {
	const currentLocation = location.value;
	return currentLocation.view === 'app' ? staffScreens.value.filter(screen => screen.app === currentLocation.app && screen.id !== 'hatask.support-admin' && screen.id !== 'hatady.moderation') : [];
});
const appScreens = computed(() => screens.value.filter(screen => location.value.view === 'app' && screen.app === location.value.app && !screen.action && (!staffScreens.value.includes(screen) || screen.id === 'hatady.moderation') && (screen.path === `/${screen.app}` || screen.path.startsWith(`/${screen.app}?`) || screen.id === 'hatafeed.beta')));
const activeHataskPins = computed(() => narrowShell.value ? prefs.hataskPins.value : prefs.hataskPinsDesktop.value);
const hataskPinnedScreens = computed(() => activeHataskPins.value.map(getHatagoesScreen).filter((screen): screen is HatagoesCatalogEntry => !!screen && screens.value.some(item => item.id === screen.id)));
const appCapsuleScreens = computed(() => {
	if (location.value.view !== 'app' || location.value.app !== 'hatask') return appScreens.value;
	const current = screens.value.find(screen => isHatagoesHataskPinCandidate(screen) && isCurrent(screen));
	return current && !hataskPinnedScreens.value.some(screen => screen.id === current.id) ? [...hataskPinnedScreens.value, current] : hataskPinnedScreens.value;
});
const directoryScreens = computed(() => directoryApp.value ? screens.value.filter(screen => screen.app === directoryApp.value && (!staffScreens.value.includes(screen) || screen.id === 'hatask.review')) : screens.value);
const isHataIntro = computed(() => isHatagoesIntroPath(router.currentRef.value._parsedRoute.fullPath));
const isDetail = computed(() => {
	if (location.value.view !== 'app') return false;
	const url = new URL(location.value.path, 'https://hatagoes.invalid');
	return url.searchParams.has('hgId') || /^\/hatafeed\/(?!beta(?:\/|$))[^/]/u.test(url.pathname);
});
const hasScreenCapsule = computed(() => !isDetail.value && location.value.view === 'app' && appCapsuleScreens.value.length > 0);
const hatadyHeaderVisible = computed(() => location.value.view === 'app' && location.value.app === 'hatady' && hasScreenCapsule.value);
watch([() => shellActive.value && ownsNoticeSurface.value && !dialogNoticeTarget.value, () => noticeContext.items.value[0]?.id], ([integrated, id]) => {
	window.clearTimeout(noticeGlowTimer);
	if (!integrated) { noticeGlowVisible.value = false; noticeGlowLeaving.value = false; return; }
	if (id != null) { noticeGlowVisible.value = true; noticeGlowLeaving.value = false; } else if (noticeGlowVisible.value) {
		noticeGlowLeaving.value = true;
		noticeGlowTimer = window.setTimeout(() => { noticeGlowVisible.value = false; noticeGlowLeaving.value = false; }, 550);
	}
});
watch(() => noticeContext.height.value, height => { if (height > 0) heldNoticeHeight.value = Math.max(64, height); }, { immediate: true });
watch([shellNoticeOutline, noticeTarget], () => { noticeHovered.value = false; noticeFocused.value = false; void nextTick(measureNoticeOutline); });
watch(noticeProgress, progress => { if (noticeContext.items.value.length) lastNoticeProgress.value = progress; });
watch(hatadyNotice, notice => { if (!notice || !shellActive.value || !ownsNoticeSurface.value) return; noticeContext.enqueueStatus(notice.message); hatadyNotice.value = null; });
watch(() => noticeContext.surface.value, surface => {
	if (!shellActive.value || surface === noticeSurface || !noticeTarget.value) return;
	const previous = releaseNoticeSurface;
	releaseNoticeSurface = noticeContext.registerSurface(noticeSurface);
	previous();
});
const currentScreen = computed(() => screens.value.find(isCurrent));

function revealCurrentScreen() {
	const capsule = screenCapsule.value;
	const current = capsule?.querySelector<HTMLElement>('[aria-current="page"]');
	if (!capsule || !current || !capsule.clientWidth) return;
	const bounds = capsule.getBoundingClientRect();
	const active = current.getBoundingClientRect();
	const delta = active.left < bounds.left + 4 ? active.left - bounds.left - 4 : active.right > bounds.right - 4 ? active.right - bounds.right + 4 : 0;
	if (delta) capsule.scrollTo({ left: capsule.scrollLeft + delta, behavior: 'smooth' });
}

function measurePill(container: HTMLElement | undefined, destination: typeof appsPillStyle) {
	const current = container?.querySelector<HTMLElement>('button[aria-current="page"], button[aria-pressed="true"]');
	if (!container || !current || !current.offsetWidth) { destination.value = hiddenPill; return; }
	destination.value = { transform: `translateX(${current.offsetLeft}px)`, width: `${current.offsetWidth}px`, height: `${current.offsetHeight}px`, top: `${current.offsetTop}px`, opacity: '1' };
}

function measurePills() {
	measurePill(appsCapsule.value, appsPillStyle);
	measurePill(screenCapsule.value, screensPillStyle);
	measurePill(mobileCapsule.value, mobilePillStyle);
}

function measureMobileCreateHeight() {
	const height = shellRoot.value?.clientHeight ?? 0;
	if (height <= 0) return;
	mobileCreateMaxHeight.value = Math.max(0, height
		- (shellHeader.value?.offsetHeight ?? 0)
		- (screenNav.value?.offsetHeight ?? 0)
		- (mobileDock.value?.offsetHeight ?? 0)
		- 32);
}

function syncShellSize() {
	narrowShell.value = (shellRoot.value?.clientWidth ?? 1000) <= 850;
	measurePills();
	measureNoticeOutline();
	measureMobileCreateHeight();
}

watch([location, appCapsuleScreens], () => { void nextTick(() => { revealCurrentScreen(); measurePills(); measureNoticeOutline(); }); }, { flush: 'post', immediate: true });

function isCurrent(screen: HatagoesCatalogEntry) {
	return location.value.view === 'app' && isHatagoesCurrentScreen(screen, location.value.path);
}

function isTemporaryScreen(screen: HatagoesCatalogEntry) {
	return location.value.view === 'app' && location.value.app === 'hatask' && !hataskPinnedScreens.value.some(pin => pin.id === screen.id);
}

const slots = reactive<{ key: string; app: HatagoesApp; path: string }[]>([]);
const bridges = new Map<HatagoesApp, HataGoesBridge>();
const waiting = new Map<HatagoesApp, (() => void)[]>();
const visited = reactive({ search: false, settings: false });
const searchOpen = ref(false);
const restoreFocusOnSearchClose = ref(false);
const appearances = reactive<Partial<Record<HatagoesApp, HataGoesAppearance>>>({});
const history = ref<string[]>([]);
const revision = ref(0);
const unread = ref(0);
const message = ref('');
const createOpen = ref(false);
const mobileCreateExpanded = ref(false);
const mobileCreateButton = ref<HTMLButtonElement>();
const mobileCreateMaxHeight = ref(500);

watch([createOpen, narrowShell], ([open, mobile]) => {
	if (open && mobile) mobileCreateExpanded.value = true;
	else if (!mobile) mobileCreateExpanded.value = false;
});

const createSurface = ref<HTMLElement>();
const createLoading = ref(false);
const inlineCreateLabel = ref('');
const expandedCreateApps = ref<HatagoesApp[]>([]);

function toggleCreateApp(app: HatagoesApp) {
	if (expandedCreateApps.value.includes(app)) expandedCreateApps.value = expandedCreateApps.value.filter(item => item !== app);
	else expandedCreateApps.value = narrowShell.value && location.value.view === 'home' ? [...expandedCreateApps.value, app] : [app];
}

const deviceKey = `hatagoes:state:${$i?.id ?? 'anonymous'}` as const;
const lastPaths: Partial<Record<HatagoesApp, string>> = {};
try {
	const saved = JSON.parse(readHatagoesDeviceCache(deviceKey) ?? '{}');
	for (const app of ['hatask', 'hatady', 'hatafeed'] as const) if (typeof saved[app] === 'string' && hatagoesAppForPath(saved[app]) === app) lastPaths[app] = saved[app];
} catch { /* A corrupt device cache must not affect account records. */ }

function ensureSlot(app: HatagoesApp, path?: string) {
	const key = hatagoesPaneKey(path ?? `/${app}`);
	let slot = slots.find(s => s.key === key);
	if (!slot) { slot = reactive({ key, app, path: path ?? `/${app}` }); slots.push(slot); } else if (path) slot.path = path;
	return slot;
}

function applyLocation(path: string) {
	const next = readHatagoesLocation(path);
	const previous = location.value;
	const previousKey = location.value.view === 'app' ? hatagoesPaneKey(location.value.path) : location.value.view;
	const nextKey = next.view === 'app' ? hatagoesPaneKey(next.path) : next.view;
	location.value = next;
	if (next.view === 'search') { visited.search = true; searchOpen.value = true; } else if (searchOpen.value && (previous.view !== next.view || (previous.view === 'app' && next.view === 'app' && previous.path !== next.path))) { searchOpen.value = false; restoreFocusOnSearchClose.value = false; }
	if (previousKey !== nextKey && createOpen.value) closeCreate();
	if (previousKey !== nextKey && nextKey !== 'screens') {
		surfaceMotion?.cancel();
		const order = ['home', 'hatask', 'hatady', 'hatafeed', 'search', 'notifications', 'settings'];
		const from = previous.view === 'app' ? previous.app : previous.view;
		const to = next.view === 'app' ? next.app : next.view;
		const motion = captureHatagoesPageTurn(contentSurface.value, order.indexOf(to) < order.indexOf(from) ? -1 : 1);
		surfaceMotion = motion;
		void nextTick(() => { if (shellActive.value) motion.play(); });
	}
	if (next.view === 'settings') visited.settings = true;
	if (next.view === 'app') {
		ensureSlot(next.app, next.path);
		lastPaths[next.app] = next.path;
		writeHatagoesDeviceCache(deviceKey, lastPaths);
		const current = screens.value.find(screen => isHatagoesCurrentScreen(screen, next.path));
		if (current) launcherUsage.value = recordHatagoesScreenUsage($i?.id, current.id, screens.value);
		void openTarget(next.app, next.path);
	} else if (next.view === 'home') launcherUsage.value = readAkatsukiUsage($i?.id);
}

router.useListener('push', ({ beforeFullPath, fullPath }) => {
	if (isHatagoesPath(beforeFullPath) && isHatagoesPath(fullPath) && beforeFullPath !== fullPath) history.value.push(beforeFullPath);
});
router.useListener('change', ({ fullPath }) => {
	if (!isHatagoesPath(fullPath)) return;
	if (history.value.at(-1) === fullPath) history.value.pop();
	applyLocation(fullPath);
});

function navigateFromPane(slot: { key: string; app: HatagoesApp; path: string }, path: string, replace = false) {
	if (shellActive.value && location.value.view === 'app' && hatagoesPaneKey(location.value.path) === slot.key) navigate(path, replace);
	else if (hatagoesAppForPath(path) === slot.app && hatagoesPaneKey(path) === slot.key) {
		// A background form or number resolution may update its own app, never
		// the user's visible screen or the outer browser history.
		slot.path = path;
		lastPaths[slot.app] = path;
		writeHatagoesDeviceCache(deviceKey, lastPaths);
	}
}

function navigate(path: string, replace = false) {
	const destination = hatagoesAppForPath(path) ? hatagoesUrl(path) : path;
	if (replace) router.replaceByPath(destination); else router.pushByPath(destination);
}

function scrollHomeTop() { homeRef.value?.scrollToTop(); }

function common(view: HatagoesCommonView) { if (createOpen.value) closeCreate(); if (view === 'search') { openSearch(); return; } if (view === 'home' && location.value.view === 'home') { scrollHomeTop(); return; } router.pushByPath(hatagoesUrl(view)); }

function openSearch() {
	if (createOpen.value) closeCreate();
	visited.search = true;
	restoreFocusOnSearchClose.value = false;
	searchOpen.value = true;
}

function closeSearch() {
	if (!searchOpen.value) return;
	restoreFocusOnSearchClose.value = true;
	searchOpen.value = false;
	if (location.value.view === 'search') back();
}

function restoreSearchFocus() {
	if (!restoreFocusOnSearchClose.value || !shellActive.value) return;
	restoreFocusOnSearchClose.value = false;
	void nextTick(() => searchButton.value?.focus({ preventScroll: true }));
}

const settingsChoiceOpen = ref(false);
const exitConfirmOpen = ref(false);
const exitButton = ref<HTMLButtonElement>();
const restoreExitFocusOnClose = ref(false);
const settingsChoiceApp = ref<HatagoesApp>('hatask');

function openShellSettings() {
	if (location.value.view !== 'app') { common('settings'); return; }
	settingsChoiceApp.value = location.value.app;
	settingsChoiceOpen.value = true;
}

function chooseAppSettings() {
	settingsChoiceOpen.value = false;
	void openAppSettings(settingsChoiceApp.value);
}

function chooseCommonSettings() { settingsChoiceOpen.value = false; common('settings'); }

const refreshing = ref(false);

async function refresh() {
	if (refreshing.value || !shellActive.value) return;
	refreshing.value = true;
	try {
		if (location.value.view === 'app') await (await ensureBridge(location.value.app)).refresh();
		else if (location.value.view === 'settings') await prefs.load();
		else revision.value++;
	} catch { message.value = '再読み込みできませんでした。もう一度お試しください。'; } finally { refreshing.value = false; }
}

function openDirectory() {
	directoryApp.value = location.value.view === 'app' ? location.value.app : null;
	common('screens');
}

function openAllDirectory() { directoryApp.value = null; common('screens'); }

function openHomeLauncherScreen(screenId: string) {
	const screen = screens.value.find(candidate => candidate.id === screenId);
	if (screen) void openScreen(screen);
}

function closeScreens() { if (location.value.view === 'screens') back(); }

function openPickerScreen(screen: HatagoesCatalogEntry) {
	if (screen.action) closeScreens();
	void openScreen(screen);
}

function openPinSettings() { common('settings'); }

function editAppPins() { closeCreate(); appPinsOpen.value = true; }

function openAppPin(screen: HatagoesCatalogEntry) {
	if (longPressed) { longPressed = false; return; }
	closeCreate();
	void openScreen(screen);
}

function startAppPinPress(event: PointerEvent) {
	cancelLongPress();
	longPressed = false;
	if (event.button !== 0) return;
	pressTimer = window.setTimeout(() => { longPressed = true; editAppPins(); }, 550);
}

function openApp(app: HatagoesApp) { if (createOpen.value) closeCreate(); navigate(`/${app}`); }

async function openScreen(screen: HatagoesCatalogEntry) {
	if (screen.action === 'settings') { await openAppSettings(screen.app); launcherUsage.value = recordHatagoesScreenUsage($i?.id, screen.id, screens.value); return; }
	if (screen.action) {
		try { const bridge = await ensureBridge(screen.app); if (!shellActive.value) return; if (!bridge.openTool) throw new Error('tool'); await bridge.openTool(screen.action); launcherUsage.value = recordHatagoesScreenUsage($i?.id, screen.id, screens.value); } catch { message.value = 'この画面を開けませんでした。'; }
		return;
	}
	// 旗鯖fork: HataIgo などは HataGoes の中で展開せず、独立した画面へ移る（アプリ内の openStandalone と同じ移り方）
	if (screen.standalone) { launcherUsage.value = recordHatagoesScreenUsage($i?.id, screen.id, screens.value); router.pushByPath(screen.path); return; }
	navigate(hatagoesScreenPath(screen));
}

function back() {
	const target = history.value.at(-1);
	if (!target) { common('home'); return; }
	router.replaceByPath(target);
}

function requestExit() { if (narrowShell.value) { restoreExitFocusOnClose.value = false; exitConfirmOpen.value = true; } else exit(); }

function cancelExit() { restoreExitFocusOnClose.value = true; exitConfirmOpen.value = false; }

function restoreExitFocus() {
	if (!restoreExitFocusOnClose.value || !shellActive.value) return;
	restoreExitFocusOnClose.value = false;
	void nextTick(() => exitButton.value?.focus({ preventScroll: true }));
}

function confirmExit() { restoreExitFocusOnClose.value = false; exitConfirmOpen.value = false; exit(); }

function exit() { deactivateShell(); if (closeWindow) closeWindow(); else router.pushByPath(getHatagoesOrigin(router)); }

function registerBridge(app: HatagoesApp, bridge: HataGoesBridge) {
	bridges.set(app, bridge);
	for (const resolve of waiting.get(app) ?? []) resolve();
	waiting.delete(app);
}

function unregisterBridge(app: HatagoesApp, bridge: HataGoesBridge) { if (bridges.get(app) === bridge) bridges.delete(app); }

async function ensureBridge(app: HatagoesApp, signal?: AbortSignal) {
	signal?.throwIfAborted();
	if (app === 'hatafeed' && !canFeed.value) throw new Error('access');
	ensureSlot(app);
	await nextTick();
	signal?.throwIfAborted();
	if (!bridges.has(app)) await new Promise<void>((resolve, reject) => {
		const cleanup = () => {
			window.clearTimeout(timeout);
			signal?.removeEventListener('abort', abort);
			waiting.set(app, (waiting.get(app) ?? []).filter(item => item !== done));
		};
		const timeout = window.setTimeout(() => { cleanup(); reject(new Error('load')); }, 20000);
		const done = () => { cleanup(); resolve(); };
		const abort = () => { cleanup(); reject(signal?.reason ?? new Error('cancelled')); };
		waiting.set(app, [...(waiting.get(app) ?? []), done]);
		signal?.addEventListener('abort', abort, { once: true });
	});
	signal?.throwIfAborted();
	const bridge = bridges.get(app);
	if (!bridge) throw new Error('load');
	return bridge;
}

let targetRequest = 0;

async function openTarget(app: HatagoesApp, path: string) {
	const request = ++targetRequest;
	const url = new URL(path, 'https://hatagoes.invalid');
	const kind = url.searchParams.get('hgKind');
	const id = url.searchParams.get('hgId');
	if (!kind || !id) return;
	const closed = () => {
		// A delayed close must not replace a newer result or another screen.
		if (!shellActive.value || request !== targetRequest || location.value.view !== 'app' || location.value.path !== path) return;
		url.searchParams.delete('hgKind');
		url.searchParams.delete('hgId');
		router.replaceByPath(hatagoesUrl(`${url.pathname}${url.search}${url.hash}`));
	};
	try {
		const bridge = await ensureBridge(app);
		await nextTick();
		if (request === targetRequest && location.value.view === 'app' && location.value.path === path) {
			if (!bridge.openResult) throw new Error('detail');
			await bridge.openResult(kind, id, closed);
		}
	} catch {
		if (request === targetRequest) {
			message.value = '指定された情報を開けませんでした。画面を再読み込みしてお試しください。';
			closed();
		}
	}
}

function openSearchResult(item: Endpoints['hata/hatagoes/search']['res']['items'][number]) {
	searchOpen.value = false;
	restoreFocusOnSearchClose.value = false;
	router.pushByPath(hatagoesSearchResultUrl(item));
}

function changed() { revision.value++; if (shellActive.value && location.value.view === 'home') homeRecordRevision.value++; }

const busyTodoIds = ref<string[]>([]);
const busyActions = ref<string[]>([]);

async function homeAction(key: string, app: HatagoesApp, action: (bridge: HataGoesBridge) => Promise<void>, error: string): Promise<void> {
	if (busyActions.value.includes(key) || !shellActive.value) return;
	busyActions.value = [...busyActions.value, key];
	try {
		const bridge = await ensureBridge(app);
		if (!shellActive.value) return;
		await action(bridge);
		// Journal saves already notify this shell through their mounted owner.
		if (key === 'water') changed();
	} catch { message.value = error; } finally { busyActions.value = busyActions.value.filter(value => value !== key); }
}

function recordMood(level: 1 | 2 | 3 | 4 | 5) { return homeAction('mood', 'hatask', async bridge => { if (!bridge.recordMood) throw new Error('unavailable'); await bridge.recordMood(level); }, 'きもちを記録できませんでした。保存状態を確認して、もう一度お試しください。'); }

function water(day: string) { return homeAction('water', 'hatask', async bridge => { if (!bridge.water) throw new Error('unavailable'); await bridge.water(day); homeRef.value?.markWatered(day); }, '水やりできませんでした。花しずくとおはなの状態を確認してください。'); }

async function recordMeal(slot: 'breakfast' | 'lunch' | 'dinner') {
	if (busyActions.value.includes('meal') || !shellActive.value) return;
	createController?.abort();
	const controller = new AbortController();
	createController = controller;
	createOpen.value = true;
	if (narrowShell.value) mobileCreateExpanded.value = true;
	inlineCreateLabel.value = 'ごはん';
	createLoading.value = true;
	busyActions.value = [...busyActions.value, 'meal'];
	try {
		await nextTick();
		const bridge = await ensureBridge('hatask', controller.signal);
		controller.signal.throwIfAborted();
		if (!bridge.recordMeal || !createSurface.value) throw new Error('unavailable');
		await bridge.recordMeal(slot, controller.signal, createSurface.value);
	} catch { if (!controller.signal.aborted) { message.value = 'ごはんの記録画面を開けませんでした。'; closeCreate(); } } finally { if (createController === controller) createLoading.value = false; busyActions.value = busyActions.value.filter(value => value !== 'meal'); }
}

function recordReading(bookId: string) { return homeAction('reading', 'hatady', async bridge => { if (!bridge.recordReading) throw new Error('unavailable'); await bridge.recordReading(bookId); }, '読書の記録画面を開けませんでした。'); }

async function toggleTodo(id: string) {
	if (busyTodoIds.value.includes(id)) return;
	busyTodoIds.value = [...busyTodoIds.value, id];
	try {
		const bridge = await ensureBridge('hatask');
		if (!shellActive.value || !bridge.toggleTodo) return;
		await bridge.toggleTodo(id);
		changed();
	} catch { message.value = 'ToDoを更新できませんでした。保存状態を確認して、もう一度お試しください。'; } finally { busyTodoIds.value = busyTodoIds.value.filter(value => value !== id); }
}

async function openProjectSwitch(event: MouseEvent) {
	try {
		const bridge = await ensureBridge('hatafeed');
		if (shellActive.value) await bridge.openProjectSwitch?.(event);
	} catch { message.value = 'プロジェクトを切り替えられませんでした。'; }
}

async function openAppSettings(app: HatagoesApp, section?: string) {
	try { const bridge = await ensureBridge(app); if (shellActive.value) await bridge.openSettings(section); } catch { message.value = 'アプリの設定を開けませんでした。'; }
}

async function saveSetting(key: 'pins' | 'hataskPins' | 'hataskPinsDesktop' | 'appPins' | 'cards' | 'cardsV3' | 'theme', value: unknown) { try { await prefs.save(key, value); } catch { message.value = '設定を保存できませんでした。保存済みの設定を維持しています。'; } }

const createKinds = {
	hatask: [{ kind: 'event', label: '予定', icon: 'ti ti-calendar-plus' }, { kind: 'todo', label: 'ToDo', icon: 'ti ti-checkbox' }, { kind: 'mood', label: 'きもちを開く', icon: 'ti ti-mood-smile' }, { kind: 'meal', label: 'ごはんを開く', icon: 'ti ti-bowl' }, { kind: 'garden', label: '水やり', icon: 'ti ti-flower' }, { kind: 'recipe', label: 'レシピ', icon: 'ti ti-chef-hat' }],
	hatady: [{ kind: 'activity', label: '記録', icon: 'ti ti-notebook' }, { kind: 'book', label: '本', icon: 'ti ti-book' }, { kind: 'movie', label: '映像作品', icon: 'ti ti-movie' }, { kind: 'game', label: 'ゲーム', icon: 'ti ti-device-gamepad' }, { kind: 'work', label: '作業', icon: 'ti ti-sparkles' }],
	hatafeed: [{ kind: 'issue', label: 'イシュー', icon: 'ti ti-message-report' }, { kind: 'emoji', label: '絵文字申請', icon: 'ti ti-mood-smile' }],
};
const createApp = computed(() => location.value.view === 'app' ? location.value.app : 'hatask');
type RecentCreate = { app: HatagoesApp; kind: string; label: string };
const recentCreates = ref<RecentCreate[]>([]);
const recentKey = `hatagoes:create:${$i?.id ?? 'anonymous'}` as const;
try {
	const values: unknown = JSON.parse(readHatagoesDeviceCache(recentKey) ?? '[]');
	if (Array.isArray(values)) for (const v of values.slice(0, 3)) {
		if (!v || !Object.hasOwn(createKinds, v.app)) continue;
		const app = v.app as HatagoesApp;
		const kind = createKinds[app].find(item => item.kind === (app === 'hatask' && v.kind === 'cooking' ? 'recipe' : v.kind));
		if (kind && kind.kind !== 'mood' && kind.kind !== 'meal' && !recentCreates.value.some(item => item.app === app && item.kind === kind.kind)) recentCreates.value.push({ app, ...kind });
	}
} catch { /* Optional cache. */ }

function contextualCreates(app: HatagoesApp) {
	const tab = currentScreen.value?.tab ?? (location.value.view === 'app' ? new URL(location.value.path, 'https://hatagoes.invalid').searchParams.get('tab') : '');
	const kind = tab === 'cal' ? 'event' : tab;
	return [...createKinds[app]].sort((a, b) => Number(b.kind === kind) - Number(a.kind === kind));
}

let createController: AbortController | undefined;

async function create(app: HatagoesApp, kind: string) {
	if (!shellActive.value) return;
	if (app === 'hatask' && (kind === 'mood' || kind === 'meal')) {
		closeCreate();
		navigate(hatagoesUrl(`/hatask?tab=${kind}`));
		return;
	}
	if (app === 'hatask' && (kind === 'garden' || kind === 'recipe' || kind === 'cooking')) {
		closeCreate();
		navigate(hatagoesUrl(`/hatask?tab=${kind === 'garden' ? 'garden' : 'recipe'}`));
		const item = createKinds.hatask.find(value => value.kind === kind);
		if (item) { recentCreates.value = [{ app, ...item }, ...recentCreates.value.filter(value => value.app !== app || value.kind !== kind)].slice(0, 3); writeHatagoesDeviceCache(recentKey, recentCreates.value); }
		return;
	}
	createController?.abort();
	const controller = new AbortController();
	createController = controller;
	createOpen.value = app === 'hatask';
	if (createOpen.value && narrowShell.value) mobileCreateExpanded.value = true;
	inlineCreateLabel.value = app === 'hatask' ? createKinds.hatask.find(item => item.kind === kind)?.label ?? '作成' : '';
	createLoading.value = app === 'hatask';
	message.value = '';
	try {
		if (app === 'hatask') await nextTick();
		const bridge = await ensureBridge(app, controller.signal);
		controller.signal.throwIfAborted();
		await bridge.create(kind, controller.signal, app === 'hatask' ? createSurface.value : undefined);
		if (controller.signal.aborted) return;
		const item = createKinds[app].find(item => item.kind === kind);
		if (item) {
			recentCreates.value = [{ app, ...item }, ...recentCreates.value.filter(v => v.app !== app || v.kind !== kind)].slice(0, 3);
			writeHatagoesDeviceCache(recentKey, recentCreates.value);
		}
	} catch { if (!controller.signal.aborted) message.value = '作成画面を開けませんでした。もう一度お試しください。'; } finally { if (createController === controller) createLoading.value = false; }
}

function closeCreate() { createController?.abort(); createOpen.value = false; createLoading.value = false; }

function clearCreate() { if (!createOpen.value) { inlineCreateLabel.value = ''; mobileCreateExpanded.value = false; } }

let pressTimer: number | undefined;
let longPressed = false;

function startLongPress() {
	longPressed = false;
	pressTimer = window.setTimeout(() => { const recent = recentCreates.value[0]; if (recent) { longPressed = true; void create(recent.app, recent.kind); } }, 550);
}

function cancelLongPress() { window.clearTimeout(pressTimer); }

function endLongPress() { cancelLongPress(); }

function showCreate() {
	if (createOpen.value) { closeCreate(); longPressed = false; return; }
	if (!longPressed) {
		expandedCreateApps.value = narrowShell.value && location.value.view === 'home' ? apps.value.filter(app => app.id !== createApp.value).map(app => app.id) : expandedCreateApps.value.slice(-1);
		createOpen.value = true;
		if (narrowShell.value) mobileCreateExpanded.value = true;
		if (location.value.view === 'app' && location.value.app === 'hatask') {
			const tab = new URL(location.value.path, 'https://hatagoes.invalid').searchParams.get('tab');
			if (tab && ['cal', 'todo'].includes(tab)) void create('hatask', tab === 'cal' ? 'event' : tab);
		}
	}
	longPressed = false;
}

const appearanceApp = computed<HatagoesApp | null>(() => location.value.view === 'app' ? location.value.app : location.value.view === 'screens' ? directoryApp.value : null);
const homeAppearance = computed(() => appearanceApp.value === null);
const appModes = reactive<Partial<Record<HatagoesApp, string>>>({});
const activeAppearance = computed(() => appearanceApp.value ? appearances[appearanceApp.value] : undefined);
const activeTheme = computed(() => appearanceApp.value === 'hatady' ? hatadyTheme.value : activeAppearance.value?.theme);
const homeMode = computed(() => (prefs.theme.value.autoTheme ? store.r.darkMode.value : prefs.theme.value.darkMode) ? 'dark' : 'light');
const hataskPaletteTheme = computed(() => homeAppearance.value ? prefs.theme.value.theme : appearanceApp.value === 'hatask' ? activeAppearance.value?.theme ?? prefs.theme.value.theme : undefined);
const hataskPaletteMode = computed(() => homeAppearance.value ? homeMode.value : appearanceApp.value === 'hatask' ? appModes.hatask ?? homeMode.value : undefined);
const brandOnDark = computed(() => appearanceApp.value === 'hatask'
	? hataskPaletteMode.value === 'dark'
	: appearanceApp.value === 'hatady' || appearanceApp.value === 'hatafeed'
		? activeTheme.value === 'dark' || activeTheme.value === 'espresso' || (activeTheme.value === 'hataskey' && store.r.darkMode.value)
		: homeMode.value === 'dark');
const themeClasses = computed(() => appearanceApp.value === 'hatady' || appearanceApp.value === 'hatafeed' ? 'hatady-scope' : '');
const shellStyle = computed(() => {
	if (homeAppearance.value) return undefined;
	const vars = activeAppearance.value?.cssVars;
	if (!vars || appearanceApp.value !== 'hatask') return vars;
	// Hatask reports computed variables from its pane. Its background may reflect
	// the host's dark canvas while the app itself is light. The shell resolves
	// background from the selected Hatask theme and mode instead.
	return Object.fromEntries(Object.entries(vars).filter(([name]) => name !== '--bg' && name !== '--bg-image'));
});

function onFocus() { if (shellActive.value) void prefs.load(); }

function resetHomeScrollOnEntry() {
	if (location.value.view !== 'home') return;
	void nextTick(() => {
		if (!shellActive.value || location.value.view !== 'home') return;
		if (homeScrollEl.value) homeScrollEl.value.scrollTop = 0;
	});
}

function deactivateShell() {
	shellActive.value = false;
	unregisterNoticeSurface();
	noticeHovered.value = false;
	noticeFocused.value = false;
	settingsChoiceOpen.value = false;
	exitConfirmOpen.value = false;
	restoreExitFocusOnClose.value = false;
	searchOpen.value = false;
	restoreFocusOnSearchClose.value = false;
	surfaceMotion?.cancel();
	targetRequest++;
	createOpen.value = false;
	mobileCreateExpanded.value = false;
	appPinsOpen.value = false;
	createController?.abort();
	cancelLongPress();
}

let shellSizeObserver: ResizeObserver | undefined;
onMounted(() => {
	resetHomeScrollOnEntry();
	void prefs.load(); window.addEventListener('focus', onFocus);
	if (typeof ResizeObserver !== 'undefined') {
		shellSizeObserver = new ResizeObserver(syncShellSize);
		for (const element of [shellRoot.value, shellHeader.value, appsCapsule.value, screenCapsule.value, mobileNoticeSurface.value, fallbackNoticeSurface.value, mobileCapsule.value, mobileDock.value, screenNav.value]) if (element) shellSizeObserver.observe(element);
	}
	syncShellSize();
	void nextTick(syncShellSize);
	window.addEventListener('resize', syncShellSize);
});
onActivated(() => { shellActive.value = true; registerNoticeSurface(); applyLocation(router.getCurrentFullPath()); resetHomeScrollOnEntry(); });
onDeactivated(deactivateShell);
onBeforeUnmount(() => { window.removeEventListener('focus', onFocus); window.removeEventListener('resize', syncShellSize); shellSizeObserver?.disconnect(); window.clearTimeout(noticeGlowTimer); releaseFeedNotice(); releaseNoticeReceiver(); deactivateShell(); });
applyLocation(router.getCurrentFullPath());
definePage(() => ({ title: brandLabel.value, icon: 'ti ti-sparkles', hataApp: brandApp.value, hideHeader: true }));
// Embedded pages keep their own metadata, but only this shell owns the outer title.
provideMetadataReceiver(() => undefined);
</script>

<style lang="scss" src="../components/hatask/hatask-themes.scss"></style>
<style module>
@font-face { font-family: 'Righteous'; font-style: normal; font-weight: 400; font-display: swap; src: url('/client-assets/Righteous-Regular.woff2') format('woff2'); }
.shell { --hg-case: var(--case-radius, 999px); --hg-radius: var(--card-radius, 24px); --hg-button: var(--control-radius, 999px); position: relative; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; color: var(--fg, var(--MI_THEME-fg)); background: var(--bg-image, none), var(--bg, var(--MI_THEME-bg)); container-type: inline-size; transition: background-color 240ms ease, color 240ms ease; }
.overlayTheme { color: var(--fg, var(--MI_THEME-fg)); }
:is(.shell, .overlayTheme):not([data-hatask-theme]):not(:global(.hatady-scope)) { --bg: var(--MI_THEME-bg); --surface: var(--MI_THEME-panel); --fg: var(--MI_THEME-fg); --rule: var(--MI_THEME-divider); --accent: var(--MI_THEME-accent); }
:is(.shell, .overlayTheme, :global([data-hatagoes-palette]))[data-hatask-theme='akatsuki'] { --bg: #fff3ec; --bg-image: none; --surface: #fffaf7; --fg: #2b1f2c; --rule: #ead8df; --accent: #b02e56; --accent-ink: #b02e56; --fg-2: #66525d; --fg-3: #806c75; --on-accent: #fff; --card-radius: 24px; --case-radius: 999px; --control-radius: 999px; --shadow: 0 20px 40px -28px #5a32468c; }
:is(.shell, .overlayTheme, :global([data-hatagoes-palette]))[data-hatask-theme='akatsuki'][data-hatask-mode='dark'] { --bg: #211825; --surface: #302035; --fg: #f6ecf3; --fg-2: #d8c0d0; --fg-3: #bda3b4; --rule: #654052; --accent: #ff7fa3; --accent-ink: #ff7fa3; --on-accent: #211825; }
:is(.shell, .overlayTheme)[data-hatask-theme='akatsuki'] { background: linear-gradient(135deg, #ffede2, #f4effc); }
:is(.shell, .overlayTheme)[data-hatask-theme='akatsuki'][data-hatask-mode='dark'] { background: linear-gradient(135deg, #35212c, #211825); }
:global([data-hatagoes-palette]) { color: var(--MI_THEME-fg); }
.shell:global(.hatady-scope), .overlayTheme:global(.hatady-scope) { --bg: var(--hy-bg); --surface: var(--hy-surface); --fg: var(--hy-ink); --rule: var(--hy-border); --accent: var(--hy-accent); --on-accent: var(--hy-on-accent); --card-radius: 24px; --case-radius: 999px; --control-radius: 999px; }
:is(.shell, .overlayTheme, :global([data-hatagoes-palette]))[data-hatask-theme] {
	--MI_THEME-bg: var(--bg);
	--MI_THEME-panel: var(--surface);
	--MI_THEME-panelHighlight: color-mix(in srgb, var(--accent) 10%, var(--surface));
	--MI_THEME-fg: var(--fg);
	--MI_THEME-divider: var(--rule);
	--MI_THEME-accent: var(--accent-ink, var(--accent));
	--MI_THEME-fgOnAccent: var(--on-accent);
	--MI_THEME-fgMuted: var(--fg-2, var(--fg));
	--MI_THEME-fgTransparent: var(--fg-2, var(--fg));
	--MI_THEME-fgTransparentWeak: var(--fg-3, var(--fg-2, var(--fg)));
	--MI_THEME-fgOnPanel: var(--fg);
	--MI_THEME-buttonBg: var(--fill, color-mix(in srgb, var(--accent) 6%, var(--surface)));
	--MI_THEME-buttonHoverBg: var(--fill-2, color-mix(in srgb, var(--accent) 12%, var(--surface)));
	--MI_THEME-inputBorder: var(--rule);
	--MI_THEME-inputBorderHover: var(--accent);
	--MI_THEME-panelBorder: var(--rule);
	--MI_THEME-panelHeaderBg: var(--surface);
	--MI_THEME-panelHeaderFg: var(--fg);
	--MI_THEME-popup: var(--surface);
	--MI_THEME-windowHeader: var(--surface);
	--MI_THEME-pageHeaderBg: var(--surface);
	--MI_THEME-pageHeaderFg: var(--fg);
	--MI_THEME-focus: var(--accent);
}
:is(.shell, .overlayTheme, :global([data-hatagoes-palette])):global(.hatady-scope):not([data-hatady-theme='hataskey']) {
	--MI_THEME-bg: var(--hy-bg);
	--MI_THEME-panel: var(--hy-surface);
	--MI_THEME-panelHighlight: var(--hy-soft);
	--MI_THEME-fg: var(--hy-ink);
	--MI_THEME-divider: var(--hy-border);
	--MI_THEME-accent: var(--hy-accent);
	--MI_THEME-fgOnAccent: var(--hy-on-accent);
	--MI_THEME-fgMuted: var(--hy-muted);
	--MI_THEME-fgTransparent: var(--hy-muted);
	--MI_THEME-fgTransparentWeak: var(--hy-muted);
	--MI_THEME-fgOnPanel: var(--hy-ink);
	--MI_THEME-buttonBg: var(--hy-soft);
	--MI_THEME-buttonHoverBg: color-mix(in srgb, var(--hy-accent) 18%, var(--hy-surface));
	--MI_THEME-inputBorder: var(--hy-border);
	--MI_THEME-inputBorderHover: var(--hy-accent);
	--MI_THEME-panelBorder: var(--hy-border);
	--MI_THEME-panelHeaderBg: var(--hy-header-bg);
	--MI_THEME-panelHeaderFg: var(--hy-ink);
	--MI_THEME-popup: var(--hy-surface);
	--MI_THEME-windowHeader: var(--hy-surface);
	--MI_THEME-pageHeaderBg: var(--hy-surface);
	--MI_THEME-pageHeaderFg: var(--hy-ink);
	--MI_THEME-focus: var(--hy-accent);
}
.brandGroup > button, .apps > button, .actions > button, .mobileNav > button, .screenNav > button, .screenCapsule > button { font: inherit; color: inherit; }
:is(.shell, .overlayTheme, :global([data-hatagoes-palette]))[data-hatask-theme='halloween'] { background-size: var(--bg-size, auto); --MI_THEME-fgOnAccent: var(--htk-on-ink); }
/* The wide shell's app capsule covers the mobile moon position. Follow the shell width, including in windows. */
.shell[data-hatask-theme='halloween'][data-hatask-mode='dark'][data-narrow='false'] { background-image: radial-gradient(circle at 24% 34px, #ffe9b8 0 16px, #ffcf7a44 17px, transparent 90px), radial-gradient(ellipse at 100% 100%, #6b3fa066, transparent 55%), linear-gradient(180deg, #1e1530, #120c1a); }
.shell[data-hatask-theme='halloween'][data-hatask-mode='light'][data-narrow='false'] { background-image: radial-gradient(circle at 24% 34px, #fff4c7 0 15px, #96632c 15px 16px, #e7b45a55 17px, transparent 90px), radial-gradient(circle at 92% 0%, #ffd58a80, transparent 22%), radial-gradient(#6b3fa014 1.2px, transparent 1.5px); }
.header { position: relative; z-index: 6; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; padding: 16px 28px 8px; flex-shrink: 0; }
.brandGroup > button, .apps > button, .actions > button, .mobileNav > button, .screenNav > button, .screenCapsule > button, .screenGrid > button { border: 0; border-radius: var(--hg-button); background: transparent; cursor: pointer; min-height: 44px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
.brandGroup > button, .apps > button, .actions > button, .mobileNav > button, .screenNav > button, .screenCapsule > button { transition: background-color 140ms ease, color 140ms ease, box-shadow 140ms ease; }
.brandGroup { display: flex; align-items: center; justify-self: start; min-width: 0; gap: 5px; }
.brandGroup .iconButton { min-width: 36px; width: 36px; padding: 6px; color: var(--fg, var(--MI_THEME-fg)); }
.navEnter { transition: opacity 160ms ease, transform 160ms ease; }
.navLeave { position: absolute; transition: opacity 120ms ease, transform 120ms ease; pointer-events: none; }
.navHidden { opacity: 0; transform: translateX(8px); }
.brandGroup > button > i, .apps > button > i, .actions > button > i, .screenNav > button > i, .screenCapsule > button > i { font-size: 20px; }
.brandGroup > button:focus-visible, .apps > button:focus-visible, .actions > button:focus-visible, .mobileNav > button:focus-visible, .screenNav > button:focus-visible, .screenCapsule > button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.brandGroup > button:disabled, .apps > button:disabled, .actions > button:disabled, .mobileNav > button:disabled, .screenNav > button:disabled, .screenCapsule > button:disabled { opacity: .4; cursor: default; }
.brandGroup > button:hover, .apps > button:hover, .actions > button:hover, .screenNav > button:hover, .screenCapsule > button:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.brand { justify-self: start; font-family: Righteous, var(--htk-font-head, sans-serif) !important; font-weight: 400 !important; font-synthesis: none; font-size: 25px !important; white-space: nowrap; padding-left: 0 !important; min-width: 0; }
.wordmark { font-family: Righteous, sans-serif; font-weight: 400; font-synthesis: none; }
.brandEnter { transition: opacity 110ms ease, transform 110ms ease; }
.brandLeave { transition: opacity 90ms ease, transform 90ms ease; }
.brandHidden { opacity: 0; transform: translateY(3px); }
.appsSlot { position: relative; height: 56px; z-index: 1; }
.apps { position: relative; isolation: isolate; display: grid; grid-template-columns: repeat(var(--hg-app-count), max-content); grid-template-rows: auto auto; align-items: center; column-gap: 4px; row-gap: 0; padding: 5px; border: 1px solid var(--rule); border-radius: min(var(--hg-case), 30px); background: var(--surface); box-shadow: var(--shadow, 0 12px 32px -24px #0004); }
.noticeBloom { position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none; opacity: 1; transition: opacity 550ms cubic-bezier(.4,0,.2,1); }
.noticeBloom svg { position: absolute; width: 100%; height: 100%; overflow: visible; fill: none; stroke: var(--accent); stroke-width: 40; stroke-linecap: round; filter: blur(14px); opacity: .55; transition: filter 550ms ease; }
.noticeBloom path { stroke-dasharray: 100; transition: stroke-dashoffset 100ms linear; }
.noticeBloom[data-leaving='true'] { opacity: 0; }
.noticeBloom[data-leaving='true'] svg { filter: blur(20px); }
.apps > .noticeBloom::after, .mobileNoticeSurface > .noticeBloom::after, .fallbackNoticeSurface > .noticeBloom::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--surface); }
.apps > svg[data-integrated='true'], .mobileNoticeSurface > svg[data-integrated='true'], .fallbackNoticeSurface > svg[data-integrated='true'] { display: none; }
.apps > button { min-width: 46px; }
.noticeHost { grid-column: 1 / -1; grid-row: 2; width: 0; min-width: 100%; overflow: hidden; transition: height 350ms ease; }
.mobileNoticeHost { display: none; width: 0; min-width: 100%; overflow: hidden; transition: height 350ms ease; }
.apps > button[aria-pressed=true], .apps > button[aria-current=page] { color: var(--on-accent, var(--MI_THEME-fgOnAccent)); font-weight: 800; }
.activePill { position: absolute; z-index: 0; left: 0; pointer-events: none; border-radius: var(--hg-button); background: var(--accent); transition: transform 280ms cubic-bezier(.22,1,.36,1), width 280ms cubic-bezier(.22,1,.36,1), height 280ms cubic-bezier(.22,1,.36,1), top 280ms cubic-bezier(.22,1,.36,1), border-radius 280ms cubic-bezier(.22,1,.36,1), opacity 120ms ease; }
.apps > button, .screenCapsule > button, .mobileNav > button { position: relative; z-index: 1; }
.screenCapsule > button[aria-current=page] { color: var(--on-accent, var(--MI_THEME-fgOnAccent)); }
:is(.screenNav, .mobileNav) > button[aria-current=page] { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); color: var(--accent); font-weight: 800; }
.screenCapsule > button[aria-current=page], .mobileNav > button[aria-current=page] { background: transparent; color: var(--on-accent, var(--MI_THEME-fgOnAccent)); }
.actions { display: flex; align-items: center; justify-content: flex-end; }
.actions > button { position: relative; }
.actions .createButton { background: var(--accent); color: var(--on-accent, var(--MI_THEME-fgOnAccent)); }
.shell[data-hatask-theme='kashin'] :is(.createButton, .mobileCreate) { color: #fff; }
.screenNav { position: relative; z-index: 5; isolation: isolate; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 2px 24px 14px; border-radius: min(var(--hg-case), 26px); }
.screenNav[data-hatady='true'] {
	display: grid;
	grid-auto-flow: column;
	grid-template-columns: minmax(0, 224px) 54px minmax(44px, 320px) minmax(96px, 232px);
	grid-auto-columns: 54px;
}
.screenNav[data-hatady='true'] > :not(.fallbackNoticeSurface) { grid-row: 1; }
.hatadyDate { flex: 0 1 auto; min-width: 0; }
.hatadyActions { display: flex; flex: 0 0 auto; min-width: 0; align-items: center; justify-content: flex-start; gap: 8px; }
.hatadyActions > button { flex-shrink: 0; }
.hatadyOverview { display: flex; align-items: center; }
.hatadyOverview:empty { display: none; }
.header .actions > .hatadyOverview > button { box-sizing: border-box; flex: none; width: 44px; min-width: 44px; height: 44px; padding: 0; }
.hatadyDate:empty, .hatadyActions:empty { display: none; }
.screenNav[data-hatady='true'] > .hatadyDate:empty { display: block; }
.screenNav[data-hatady='true'] > .hatadyActions:empty { display: flex; }
.screenNav[data-hatady='true'] .screenCapsuleSlot { width: 100%; min-width: 44px; }
.screenNav[data-hatady='true'] .screenCapsule { justify-content: safe center; }
.screenNav[data-hatady='true'] .screenCapsule > button { min-width: 44px; }
.screenNav[data-home='true'] { padding: 0; min-height: 0; }
.screenNav[data-home='true'] > :not(.fallbackNoticeSurface) { display: none; }
.screenCapsuleSlot { position: relative; height: 54px; min-width: 0; width: max-content; max-width: 100%; }
.mobileNoticeSurface { position: relative; isolation: isolate; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; border: 1px solid var(--rule); border-radius: min(var(--hg-case), 26px); background: var(--surface); box-shadow: var(--shadow, 0 12px 32px -24px #0004); }
.fallbackNoticeSurface { display: none; }
.screenCapsule { position: relative; min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: auto; display: flex; gap: 3px; padding: 4px; border: 0; border-radius: min(var(--hg-case), 26px); background: transparent; box-shadow: none; }
.screenCapsule > button { flex-shrink: 0; white-space: nowrap; min-width: 40px; font-weight: 700; font-size: 13px; }
/* Keep the capsule geometry fixed while giving transparent marks more room. */
.screenCapsule > button > [data-hata-feature], .apps > button > [data-hata-app-logo] { transform: scale(1.2); }
.screenCapsule > button:not([aria-current=page]) > [data-hata-feature], .apps > button:not([aria-current=page]):not([aria-pressed='true']) > [data-hata-app-logo] { transform: scale(1.4); }
.screenCapsule > button:not([aria-current=page]) > i { transform: scale(1.2); }
.screenCapsule .navLeave { left: 100%; top: 50%; white-space: nowrap; transform: translateY(-50%); }
.screenCapsule .navLeave.navHidden { transform: translate(8px, -50%); }
.screenCapsule .temporaryScreen { border: 1px dashed var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.screenNav > :is(.navBack, .directoryButton, .staffButton) { flex: none; width: 54px; height: 54px; padding: 0; border: 1px solid var(--rule); border-radius: min(var(--hg-case), 26px); background: var(--surface); box-shadow: var(--shadow, 0 12px 32px -24px #0004); }
.screenNav > .navBack { margin-right: 2px; }
.screenNav > .staffButton { color: var(--accent); }
.screenNav > .projectButton { max-width: 190px; overflow: hidden; white-space: nowrap; border: 1px solid var(--rule); background: var(--surface); }
.projectButton span { overflow: hidden; text-overflow: ellipsis; }
.badge { position: absolute; top: 0; right: 0; padding: 1px 4px; border-radius: 8px; font-size: 10px; background: var(--accent); color: var(--on-accent, var(--MI_THEME-fgOnAccent)); }
.body { position: relative; z-index: 0; display: flex; flex: 1; min-height: 0; }
.content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; position: relative; }
.common, .appPane { flex: 1; min-height: 0; overflow: auto; }
.mobileNav { display: none; }
.mobileDock, .mobileCreate { display: none; }
.message { padding: 12px 20px; background: var(--surface); border-bottom: 1px solid var(--rule); }
.allScreens { padding: 24px; }
.screenGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.screenGrid button { display: flex; align-items: center; gap: 12px; text-align: left; padding: 16px; border: 1px solid var(--rule); background: var(--surface); border-radius: var(--hg-radius); }
.createMenu { width: min(480px, calc(100vw - 32px)); max-height: 80dvh; overflow: auto; padding: 20px; box-sizing: border-box; border-radius: 20px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); }
.createMenu[data-mobile='true'] { position: relative; inset: auto; width: 100%; max-height: none; overflow: visible; padding: 16px 18px 20px; border-radius: 0; background: transparent; color: var(--fg); }
.choiceMenu { width: min(420px, calc(100dvw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 24px; box-sizing: border-box; border-radius: var(--hg-radius, 24px); background: var(--surface, var(--MI_THEME-panel)); box-shadow: 0 18px 48px #0004; }
.choiceMenu h2 { margin: 0 0 18px; font-size: 18px; line-height: 1.4; }
.exitChoiceTitle { display: flex; align-items: center; gap: 9px; }
.exitChoiceTitle i { color: var(--accent); font-size: 22px; }
.choiceActions { display: grid; gap: 10px; }
.choiceActions button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 10px 16px; border: 1px solid var(--rule); border-radius: var(--hg-button, 999px); background: var(--surface); color: var(--fg, var(--MI_THEME-fg)); font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
.choiceActions button i { flex: none; font-size: 20px; color: var(--accent); }
.choiceActions button span { min-width: 0; overflow-wrap: anywhere; }
.choiceActions .choicePrimary { border-color: var(--accent); background: var(--accent); color: var(--on-accent, var(--MI_THEME-fgOnAccent)); }
.choiceActions .choicePrimary i { color: inherit; }
.choiceActions .choiceCancel { color: var(--fg-2, var(--fg, var(--MI_THEME-fg))); }
.choiceActions button:hover { filter: brightness(.96); }
.choiceActions button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.createMenu header { display: flex; align-items: center; justify-content: space-between; }
.createMenu > header { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; }
.createMenu > header::before { content: ''; grid-column: 1; }
.createMenu > header h2 { grid-column: 2; text-align: center; }
.createMenu > header button { grid-column: 3; justify-self: end; }
.createMenu h2 { margin: 0 0 12px; }
.createMenu > header button, .createMenu > button, .createMenu > section button { min-height: 44px; padding: 10px 16px; margin: 4px; color: inherit; background: var(--MI_THEME-buttonBg); border: 0; border-radius: 12px; font: inherit; cursor: pointer; }
.createMenu details { padding: 12px 0; }
.createMenu summary { cursor: pointer; }
.createSurface:empty { display: none; }
.createSurface { margin-bottom: 16px; }
.appPins { margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--rule); }
.appPins h3 { font-size: 15px; }
.appPinGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.appPinGrid button { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; padding: 14px 5px; font-size: 11px; overflow-wrap: anywhere; border: 1px solid var(--rule); border-radius: var(--card-radius, 16px); margin: 0; }
.appPinGrid i { font-size: 24px; }
.quickGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.quickGrid button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; margin: 0; border: 1px solid var(--rule); background: var(--surface); border-radius: var(--card-radius, 16px); font-size: 12px; }
.quickGrid i { font-size: 24px; color: var(--accent); }
.otherApps { margin-top: 20px; }
.otherApps .appDisclosure { display: flex; align-items: center; gap: 10px; width: 100%; margin: 0; padding: 14px 4px; border-radius: 0; background: transparent; }
.appDisclosure i:last-child { margin-left: auto; transition: transform 160ms ease; }
.appDisclosure[aria-expanded=true] i:last-child { transform: rotate(180deg); }
.createOptions { display: grid; grid-template-rows: 1fr; }
.createOptions > div { min-height: 0; overflow: hidden; }
.disclosureActive { transition: grid-template-rows 160ms ease, opacity 160ms ease; }
.disclosureClosed { grid-template-rows: 0fr; opacity: 0; }
@media (max-width: 700px) { .createMenu { position: fixed; bottom: 0; left: 0; width: 100dvw; max-height: 85dvh; border-radius: 24px 24px 0 0; padding-bottom: max(20px, env(safe-area-inset-bottom)); } }
@container (min-width: 851px) and (max-width: 1100px) {
	.header { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 8px; }
	.brandGroup { grid-column: 1; grid-row: 1; }
	.actions { grid-column: 2; grid-row: 1; justify-self: end; }
	.appsSlot { grid-column: 1 / -1; grid-row: 2; justify-self: center; max-width: 100%; }
}
@container (max-width: 850px) {
	.header { display: flex; gap: 4px; padding: 8px 12px 4px; flex-wrap: wrap; }
	.header[data-home='true'] { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: 44px; gap: 4px; min-height: 0; padding: 8px 6px 4px; }
	.header[data-home='true'] .brandGroup { grid-column: 1; grid-row: 1; width: 100%; gap: 2px; }
	.header[data-home='true'] .brandGroup .iconButton { width: 32px; min-width: 32px; padding: 6px; }
	.header[data-home='true'] .brand { min-height: 44px; padding: 0 !important; }
	.header[data-home='true'] .actions { grid-column: 2; grid-row: 1; justify-self: end; position: relative; z-index: 1; max-width: 100%; }
	.header[data-home='true'] .actions button { min-width: 32px; padding: 6px; }
	.brand { gap: 4px !important; font-size: 22px !important; }
	.appsSlot { display: none; }
	.screenNav { padding: 2px 12px 8px; }
	/* Give Hatady tabs their own row; tools no longer squeeze the capsule. */
	.screenNav[data-hatady='true'] { display: flex; padding-inline: 6px; }
	.screenNav[data-hatady='true'] > .hatadyActions { flex: 1; justify-content: flex-end; gap: 4px; }
	.screenNav[data-hatady='true'] > .screenCapsuleSlot { order: 1; flex: 0 0 100%; }
	.screenNav[data-hatady='true'] .mobileNoticeSurface { max-width: 320px; margin-inline: auto; }
	.screenCapsuleSlot { flex: 0 1 auto; }
	.mobileNoticeSurface { width: 100%; }
	.screenCapsule { width: 100%; }
	.mobileNoticeHost { display: block; }
	.fallbackNoticeSurface { position: absolute; display: block; top: 100%; left: 50%; transform: translateX(-50%); width: min(320px, calc(100% - 24px)); min-height: 54px; padding: 5px; border: 1px solid var(--rule); border-radius: min(var(--hg-case), 30px); background: var(--surface); box-shadow: var(--shadow, 0 12px 32px -24px #0004); box-sizing: border-box; opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 350ms ease, visibility 0s 350ms; }
	.fallbackNoticeSurface[data-notification='true'] { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity 350ms ease, visibility 0s; }
	.screenNav { flex-wrap: wrap; }
	.screenNav[data-mobile-hatask='true'] .screenCapsuleSlot { order: 1; flex: 0 0 100%; width: 100%; }
	.screenNav[data-mobile-hatask='true'] .screenCapsule { justify-content: safe center; }
	.screenCapsule { max-width: 100%; }
	.screenCapsule button { padding: 7px 9px; font-size: 12px; }
	.actions { margin-left: auto; }
	.header .actions button { padding: 8px; min-width: 36px; }
	.header .actions .createButton { display: none; }
	.screenNav { gap: 4px; }
	.screenNav > :is(.navBack, .directoryButton, .staffButton) { width: 44px; height: 54px; }
	.screenNav > .projectButton { flex: none; width: 44px; height: 54px; padding: 0; }
	.screenNav > .projectButton span, .screenNav > .projectButton i:last-child { display: none; }
	.mobileDock { position: relative; display: flex; flex-shrink: 0; align-items: stretch; gap: 0; margin: 8px 12px max(10px, env(safe-area-inset-bottom)); transition: margin-top 360ms cubic-bezier(.22,1,.36,1), gap 360ms cubic-bezier(.22,1,.36,1), background-color 360ms ease, border-radius 360ms cubic-bezier(.22,1,.36,1); }
	.mobileDock[data-create-layer='true'] { z-index: 7; }
	.mobileDock[data-create-expanded='true'] { margin-top: 0; border-radius: 0 0 min(var(--hg-case), 30px) min(var(--hg-case), 30px); }
	.mobileNav { position: relative; isolation: isolate; display: flex; flex: 1; min-width: 0; align-items: center; justify-content: space-around; gap: 4px; padding: 5px; border: 1px solid var(--rule); border-radius: min(var(--hg-case), 30px); background: var(--surface); box-shadow: var(--shadow, 0 12px 32px -24px #0004); transition: border-radius 360ms cubic-bezier(.22,1,.36,1), border-color 360ms ease; }
	.mobileNav > .activePill { clip-path: inset(0 round var(--hg-pill-edge-radius)); }
	.mobileNav { --hg-pill-edge-radius: max(0px, calc(min(var(--hg-case), 30px) - 6px)); }
	.mobileNav:has(> button:first-of-type[aria-current='page']) > .activePill { border-top-left-radius: var(--hg-pill-edge-radius); border-bottom-left-radius: var(--hg-pill-edge-radius); }
	.mobileNav:has(> button:last-of-type[aria-current='page']) > .activePill { border-top-right-radius: var(--hg-pill-edge-radius); border-bottom-right-radius: var(--hg-pill-edge-radius); }
	.mobileDock[data-create-expanded='true'] .mobileNav { border-top-color: transparent; border-radius: 0 0 min(var(--hg-case), 30px) min(var(--hg-case), 30px); }
	.mobileDock[data-create-expanded='true'] .mobileNav:has(> button:first-of-type[aria-current='page']) > .activePill { border-top-left-radius: var(--hg-button); }
	.mobileDock[data-create-expanded='true'] .mobileNav:has(> button:last-of-type[aria-current='page']) > .activePill { border-top-right-radius: var(--hg-button); }
	.mobileNav button { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 8px 2px; min-height: 46px; }
	.mobileNav i { font-size: 23px; }
	.mobileNav button span { font-size: 10px; line-height: 1.2; }
	.mobileNav button[aria-current=page] { color: var(--on-accent, var(--MI_THEME-fgOnAccent)); }
	.mobileCreate { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 48px; width: 48px; height: 48px; align-self: center; border: 0; border-radius: min(var(--hg-case), 30px); color: var(--on-accent, var(--MI_THEME-fgOnAccent)); background: var(--accent); box-shadow: var(--shadow); cursor: pointer; font-size: 24px; }
	.mobileNav .mobileCreate { flex: 0 0 48px; width: 48px; height: 48px; background: var(--accent); color: var(--on-accent, var(--MI_THEME-fgOnAccent)); }
	.shell[data-hatask-theme='kashin'] .mobileNav .mobileCreate { background: var(--accent); color: #fff; }
	.mobileCreate i { transition: transform 300ms cubic-bezier(.22,1,.36,1); }
	.homeScroll { scroll-snap-type: y proximity; }
	.mobileCreate[data-open='true'] i { transform: rotate(45deg); }
}
</style>
