<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: Hataskey UI 2 の設定ウィンドウ。

- MkWindow ベースのフローティングウィンドウ (裏で Hataskey UI を見ながらリアルタイムに調整可)
- 上部/下部/プロフィール ぼかしや吹き出し、透過率スライダーをまとめて表示
- **バッファ + 明示保存** モデル。編集中の値はローカル ref に貯め、閉じても勝手に永続化しない
- 保存ボタンで一括 commit + localStorage 反映
- 初期値ボタンで default に戻す (ローカル ref のみ、閉じるか保存するまで永続化しない)
- ドラッグ中の透過率スライダーはローカル ref → CSS 変数だけを直接書き換えてライブプレビュー
  (prefer.commit は保存ボタン押下時のみ)
-->
<template>
<!-- 旗鯖fork: 設定画面の右ペインへ埋め込むときは、窓そのものを枠なしへ差し替える。
     ⚠️窓は position: fixed の重ね表示なので、CSSでペインの中へは収められない。
     ⚠️受け口(#header / 本体 / close())は同じ形なので、中身には手を触れない。 -->
<component :is="embedded ? SettingsEmbeddedWindow : MkWindow"
	ref="dialog"
	:initialWidth="560"
	:initialHeight="720"
	:canResize="true"
	:closeButton="true"
	@closed="onWindowClosed"
>
	<template #header><i class="ti ti-sparkles" style="margin-right:.5em;"></i>{{ copy.windowTitle }}</template>

	<div class="_spacer" style="--MI_SPACER-min: 12px; --MI_SPACER-max: 20px;">
		<div :class="$style.hint">
			<i class="ti ti-info-circle"></i>
			<div>
				{{ copy.hintBeforeCompare }}<b>{{ copy.hintCompare }}</b>{{ copy.hintAfterCompare }}<b>{{ copy.hintSave }}</b>{{ copy.hintAfterSave }}
			</div>
		</div>

		<!-- ===== 基本 (旧 Hataskey UI 設定から移設) ===== -->
		<FormSection first>
			<template #label>{{ copy.basic }}</template>
			<MkSwitch v-model="editedShowTrendingTab">
				<template #label>{{ copy.showTrendingTab }}</template>
				<template #caption>{{ copy.showTrendingTabCaption }}</template>
			</MkSwitch>
			<MkSwitch v-model="editedTopNavMode">
				<template #label>{{ copy.showMenuAtTop }}</template>
				<template #caption>{{ copy.showMenuAtTopCaption }}<b>{{ copy.deckOnlyNote }}</b></template>
			</MkSwitch>
			<MkSwitch v-model="editedDeckIgnoreWidth">
				<template #label>{{ copy.ignoreDeckWidth }}</template>
				<template #caption>{{ copy.ignoreDeckWidthCaption }}<b>{{ copy.deviceSpecificSetting }}</b></template>
			</MkSwitch>
			<MkSwitch v-model="editedTabSwipeEnabled">
				<template #label>{{ copy.swipeTabs }}</template>
				<template #caption>{{ copy.swipeTabsCaption }}<b>{{ copy.thisDeviceOnly }}</b>{{ copy.savedSuffix }}</template>
			</MkSwitch>
			<div :class="$style.subActions">
				<button class="_button" :class="$style.subBtn" :disabled="!isHatasabaDeckActive" @click="onReplayDeckTutorial"><i class="ti ti-refresh"></i> {{ copy.replayDeckTutorial }}</button>
			</div>
			<div v-if="!isHatasabaDeckActive" :class="$style.replayHint">
				<i class="ti ti-info-circle"></i>
				<span>{{ copy.replayHintBefore }}<b>{{ copy.replayHintDeck }}</b>{{ copy.replayHintAfter }}</span>
			</div>
		</FormSection>

		<!-- ===== 透過率スライダー ===== -->
		<FormSection>
			<template #label>{{ copy.glassOpacity }}</template>
			<div v-if="!editedGlassUi" :class="$style.warnBanner">
				<i class="ti ti-info-circle"></i>{{ copy.onlyWhenUi2Enabled }}
			</div>
			<div :class="$style.opacityDesc">
				{{ copy.opacityDescriptionBefore }}<b>{{ copy.opacityTerm }}</b>{{ copy.opacityDescriptionAfter }}
			</div>
			<div :class="$style.opacityRow">
				<!-- 旗鯖fork: v-model と @input を併用。v-model がバッファの ref を更新し、
				     @input が同期的に CSS 変数を書き換えてライブプレビューする。 -->
				<input
					type="range"
					min="0" max="100" step="1"
					v-model.number="editedOpacity"
					:disabled="!editedGlassUi"
					:class="$style.opacityRange"
					@wheel.prevent
					@input="onOpacityInput"
				/>
				<div :class="$style.opacityValue">{{ editedOpacity }}%</div>
				<button :class="$style.smallBtn" :disabled="!editedGlassUi || editedOpacity === 55" @click="setOpacity(55)" v-tooltip="copy.restoreOpacity"><i class="ti ti-restore"></i></button>
			</div>
		</FormSection>

		<!-- ===== Hataskey UI 2 / 吹き出し ===== -->
		<FormSection>
			<template #label>{{ copy.ui2Name }}</template>
			<div :class="$style.hataUi2Desc">
				<b>{{ copy.ui2Name }}</b>{{ copy.ui2DescriptionBefore }}<b>{{ copy.alwaysEnabled }}</b>{{ copy.ui2DescriptionAfter }}
			</div>
			<!-- 旗鯖fork: Hataskey UI 2 は強制ON化したため「有効にする」トグルは廃止。 -->
			<MkSwitch v-model="editedGlassUiBubble" @update:modelValue="v => setGlassUiBubble(v)">
				<template #label>{{ copy.showBubbleDesign }}</template>
				<template #caption>{{ copy.showBubbleDesignCaption }}<b>{{ copy.thisDeviceOnly }}</b>{{ copy.savedSuffix }}</template>
			</MkSwitch>
		</FormSection>

		<!-- ===== 背景ヘッダー画像のぼかし ===== -->
		<FormSection>
			<template #label>{{ copy.headerImageBlur }}</template>
			<MkSwitch v-model="editedNormalNoBannerBg">
				<template #label>{{ copy.disableTimelineHeaderBlur }}</template>
				<template #caption>{{ copy.disableTimelineHeaderBlurCaption }}<br><b>{{ copy.noLivePreviewNote }}</b></template>
			</MkSwitch>
			<MkSwitch v-model="editedProfileNoBannerBg" @update:modelValue="v => setProfileNoBannerBg(v)">
				<template #label>{{ copy.disableProfileHeaderBlur }}</template>
				<template #caption>{{ copy.disableProfileHeaderBlurCaption }}</template>
			</MkSwitch>
		</FormSection>

		<!-- ===== ノートの表示（デッキ） ===== -->
		<FormSection>
			<template #label>{{ copy.noteDisplayDeck }}</template>
			<MkSwitch v-model="editedDisableBubbleInHatasabaDeck">
				<template #label>{{ copy.enableSimpleNotesInDeck }}</template>
				<template #caption>{{ copy.enableSimpleNotesInDeckCaption }}<br><b>{{ copy.noLivePreviewNote }}</b></template>
			</MkSwitch>
		</FormSection>

		<!-- ===== 上部ナビバー (旧 Hataskey UI 設定から移設・バッファ保存) ===== -->
		<FormSection>
			<template #label>{{ copy.topNavSection }}</template>
			<div :class="$style.reorderHead">
				<div :class="$style.reorderHint">{{ copy.topNavReorderHint }}</div>
				<button :class="$style.navResetBtn" @click="resetTopNav"><i class="ti ti-restore"></i> {{ copy.resetOrder }}</button>
			</div>
			<draggable v-model="editedTopNav" :class="$style.reorderList" itemKey="id" handle=".htkNavDragHandle" ghostClass="htkNavDragGhost" :animation="150">
				<template #item="{element: item, index: idx}">
					<div :class="[$style.reorderItem, item.visible === false ? $style.reorderItemHidden : '']">
						<button :class="['htkNavDragHandle', $style.handle]" v-tooltip="copy.dragToReorder" tabindex="-1"><i class="ti ti-grip-vertical"></i></button>
						<MkSwitch :modelValue="item.visible !== false" :class="$style.reorderToggle" @update:modelValue="v => setTopNavVisible(idx, v)"/>
						<i :class="[item.icon, $style.reorderIcon]"></i>
						<span :class="$style.reorderLabel">{{ navDisplayLabel(item) }}</span>
					</div>
				</template>
			</draggable>
		</FormSection>

		<!-- ===== 下部ナビバー (モバイルのみ有効・バッファ保存) ===== -->
		<FormSection>
			<template #label>{{ copy.bottomNavSection }}</template>
			<div v-if="!isBottomNavVisible" :class="$style.disabledNote">
				<i class="ti ti-device-desktop"></i>
				<div>{{ copy.bottomNavUnavailableBefore }}<b>{{ copy.mobileNarrow }}</b>{{ copy.bottomNavUnavailableAfter }}<br>{{ copy.openOnPhone }}</div>
			</div>
			<fieldset :class="[$style.bottomNavFieldset, !isBottomNavVisible ? $style.bottomNavFieldsetDisabled : '']" :disabled="!isBottomNavVisible">
				<div :class="$style.reorderHead">
					<div :class="$style.reorderHint">{{ copyx.bottomNavReorderHint({ max: HATASABA_BOTTOM_NAV_MAX }) }}</div>
					<button :class="$style.navResetBtn" :disabled="!isBottomNavVisible" @click="resetBottomNav"><i class="ti ti-restore"></i> {{ copy.resetOrder }}</button>
				</div>
				<draggable v-model="editedBottomNav" :class="$style.reorderList" itemKey="id" handle=".htkNavDragHandle" ghostClass="htkNavDragGhost" :animation="150" :disabled="!isBottomNavVisible">
					<template #item="{element: item, index: idx}">
						<div :class="[$style.reorderItem, item.visible === false ? $style.reorderItemHidden : '']">
							<button :class="['htkNavDragHandle', $style.handle]" v-tooltip="copy.dragToReorder" tabindex="-1"><i class="ti ti-grip-vertical"></i></button>
							<MkSwitch :modelValue="item.visible !== false" :class="$style.reorderToggle" @update:modelValue="v => setBottomNavVisible(idx, v)"/>
							<i :class="[item.icon, $style.reorderIcon]"></i>
							<span :class="$style.reorderLabel">{{ navDisplayLabel(item) }}</span>
						</div>
					</template>
				</draggable>
				<div v-if="editedBottomNav.filter(i => i.visible !== false).length > HATASABA_BOTTOM_NAV_MAX" :class="$style.warning">
					<i class="ti ti-alert-triangle"></i> {{ copyx.maxVisibleItems({ max: HATASABA_BOTTOM_NAV_MAX }) }}
				</div>
			</fieldset>
		</FormSection>

		<!-- ===== サイドメニュー ===== -->
		<FormSection>
			<template #label>{{ copy.sideMenuSection }}</template>
			<div :class="$style.reorderHint" style="margin-bottom:10px;"><b>{{ copy.sideStudioName }}</b>{{ copy.sideStudioDescription }}</div>
			<div :class="$style.subActions">
				<button class="_buttonPrimary" :class="$style.openSidebarBtn" @click="openHataSideStudio"><i class="ti ti-layout-dashboard"></i> {{ copy.openSideStudio }}</button>
				<button class="_button" :class="$style.openSidebarBtn" @click="openSidebarEditDialog"><i class="ti ti-list"></i> {{ copy.openLegacyReorder }}</button>
			</div>
		</FormSection>
	</div>

	<!-- 旗鯖fork: MkWindow は #footer スロットを持たないため、body 末尾に footer を配置 -->
	<div :class="$style.footer">
		<MkButton :class="$style.resetBtn" @click="resetToDefault"><i class="ti ti-restore"></i> {{ copy.resetDefaults }}</MkButton>
		<div :class="$style.footerRight">
			<span v-if="hasChanges" :class="$style.unsavedTag"><i class="ti ti-alert-circle"></i> {{ copy.unsavedChanges }}</span>
			<MkButton @click="closeWithoutSave">{{ copy.close }}</MkButton>
			<MkButton primary :disabled="!hasChanges" @click="save"><i class="ti ti-device-floppy"></i> {{ copy.save }}</MkButton>
		</div>
	</div>
</component>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, useTemplateRef, defineAsyncComponent } from 'vue';
import SettingsEmbeddedWindow from '@/components/SettingsEmbeddedWindow.vue';
import draggable from 'vuedraggable';
import MkWindow from '@/components/MkWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import FormSection from '@/components/form/section.vue';
import { prefer } from '@/preferences.js';
import { PREF_DEF } from '@/preferences/def.js';
import { getInitialPrefValue } from '@/preferences/manager.js';
import {
	glassUiLocal, setGlassUiLocal,
	glassUiBubbleLocal, setGlassUiBubbleLocal,
	deckIgnoreWidth, setDeckIgnoreWidth,
	tabSwipeEnabled, setTabSwipeEnabled,
} from '@/utility/hatasaba-device-prefs.js';
import { miLocalStorage } from '@/local-storage.js';
import { HATASABA_BOTTOM_NAV_MAX, mergeMissingNavItems, normalizeBottomNavItems } from '@/utility/hatasaba-navigation.js';
import * as os from '@/os.js';
import { mainRouter } from '@/router.js';
import { i18n } from '@/i18n.js';

const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'done', value: { saved: boolean }): void;
}>();

const dialog = useTemplateRef('dialog');
const copy = i18n.ts._hata._hatasabaUi._editWindow;
const copyx = i18n.tsx._hata._hatasabaUi._editWindow;

function openHataSideStudio() {
	dialog.value?.close();
	mainRouter.push('/hata-side-studio');
}

// ===== 現在値スナップショット (初期値・比較用) =====
const snapshot = {
	glassUi: glassUiLocal.value,
	glassUiBubble: glassUiBubbleLocal.value,
	normalNoBannerBg: prefer.r['simpleUi.normalNoBannerBg'].value,
	profileNoBannerBg: prefer.r['simpleUi.profileNoBannerBg'].value,
	opacity: prefer.r['simpleUi.glassUiCardOpacity'].value as number,
	// 旗鯖fork: Hataskey UIデッキの「ノートの簡易表示を無効にする」(ON=吹き出しOFF=標準カード)。
	disableBubbleInHatasabaDeck: prefer.r['simpleUi.disableBubbleInHatasabaDeck'].value,
	// 旗鯖fork: 基本セクション(旧 Hataskey UI 設定から移設)。
	showTrendingTab: prefer.r['simpleUi.showTrendingTab'].value,
	topNavMode: prefer.r['simpleUi.topNavMode'].value,
	deckIgnoreWidth: deckIgnoreWidth.value,
	tabSwipeEnabled: tabSwipeEnabled.value,
};

// ===== 編集バッファ =====
const editedGlassUi = ref(snapshot.glassUi);
const editedGlassUiBubble = ref(snapshot.glassUiBubble);
const editedNormalNoBannerBg = ref(snapshot.normalNoBannerBg);
const editedProfileNoBannerBg = ref(snapshot.profileNoBannerBg);
const editedOpacity = ref<number>(snapshot.opacity);
const editedDisableBubbleInHatasabaDeck = ref(snapshot.disableBubbleInHatasabaDeck);
const editedShowTrendingTab = ref(snapshot.showTrendingTab);
const editedTopNavMode = ref(snapshot.topNavMode);
const editedDeckIgnoreWidth = ref(snapshot.deckIgnoreWidth);
const editedTabSwipeEnabled = ref(snapshot.tabSwipeEnabled);

const hasChanges = computed(() =>
	editedGlassUi.value !== snapshot.glassUi
	|| editedGlassUiBubble.value !== snapshot.glassUiBubble
	|| editedNormalNoBannerBg.value !== snapshot.normalNoBannerBg
	|| editedProfileNoBannerBg.value !== snapshot.profileNoBannerBg
	|| editedOpacity.value !== snapshot.opacity
	|| editedDisableBubbleInHatasabaDeck.value !== snapshot.disableBubbleInHatasabaDeck
	|| editedShowTrendingTab.value !== snapshot.showTrendingTab
	|| editedTopNavMode.value !== snapshot.topNavMode
	|| editedDeckIgnoreWidth.value !== snapshot.deckIgnoreWidth
	|| editedTabSwipeEnabled.value !== snapshot.tabSwipeEnabled
	|| hasNavChanges.value,
);

// ===== ライブプレビュー =====
// 旗鯖fork: watch({immediate:false}) だと初回の変化を拾えないケース (Firefox の
// range input の @input が watch の flush まで DOM 更新を待つ等) があるため、
// 直接 @input / @update:modelValue から即時呼び出しで CSS 変数 / <html> クラスを書き換える。
// 保存押下まで prefer.commit しない (バッファのみ)。
// (キャンセルや閉じる時は snapshot 値に戻して視覚も元通り)
function onOpacityInput(e: Event) {
	const raw = Number((e.target as HTMLInputElement).value);
	if (!Number.isFinite(raw)) return;
	const n = Math.max(0, Math.min(100, Math.round(raw)));
	editedOpacity.value = n;
	document.documentElement.style.setProperty('--htk-glass-card-opacity', n + '%');
}
function setOpacity(n: number) {
	if (!Number.isFinite(n)) return;
	const v = Math.max(0, Math.min(100, Math.round(n)));
	editedOpacity.value = v;
	document.documentElement.style.setProperty('--htk-glass-card-opacity', v + '%');
}
function setGlassUiBubble(v: boolean) {
	editedGlassUiBubble.value = !!v;
	document.documentElement.classList.toggle('hataGlassUiBubble', !!v);
}
function setProfileNoBannerBg(v: boolean) {
	editedProfileNoBannerBg.value = !!v;
	document.documentElement.classList.toggle('hataProfileNoBannerBg', !!v);
}
// 旗鯖fork: normalNoBannerBg は simple.vue の timelineGlassBg computed が prefer.r 経由で読むため、
// バッファだけではライブプレビューできない (保存で prefer.commit → simple.vue 側の computed 更新)。
// UI の caption で「保存後に反映」と明示している。

// ===== 初期値に戻す =====
async function resetToDefault() {
	const c = await os.confirm({
		type: 'warning',
		title: copy.resetDefaults,
		text: copy.resetAllConfirm,
	});
	if (c.canceled) return;
	editedGlassUi.value = true; // 自動 ON がデフォルト挙動
	editedGlassUiBubble.value = false;
	editedNormalNoBannerBg.value = (PREF_DEF['simpleUi.normalNoBannerBg'].default as boolean);
	editedProfileNoBannerBg.value = (PREF_DEF['simpleUi.profileNoBannerBg'].default as boolean);
	editedOpacity.value = (PREF_DEF['simpleUi.glassUiCardOpacity'].default as number);
	editedDisableBubbleInHatasabaDeck.value = (PREF_DEF['simpleUi.disableBubbleInHatasabaDeck'].default as boolean);
	editedShowTrendingTab.value = (PREF_DEF['simpleUi.showTrendingTab'].default as boolean);
	editedTopNavMode.value = (PREF_DEF['simpleUi.topNavMode'].default as boolean);
	editedDeckIgnoreWidth.value = false;
	editedTabSwipeEnabled.value = true;
}

// 旗鯖fork: デッキUIチュートリアルを「今すぐ」再表示する。
//   従来はフラグを消すだけで、simple.vue の watch(deckActive) 頼みだったため、
//   Hataskey UI のデッキ表示がアクティブでない状況ではフラグが消えるだけで何も表示されなかった。
//   ここではデッキUIがアクティブなときのみ押下可能にし(下の :disabled)、押下時は
//   チュートリアルウィザードを直接ポップアップして確実に表示する。
//   (永続フラグ simpleUi.deckTutorialDone は「初回自動表示」用途なので、再表示ではあえて触らない)
function onReplayDeckTutorial() {
	if (!isHatasabaDeckActive.value) return;
	const { dispose } = os.popup(
		defineAsyncComponent(() => import('@/ui/_common_/HatasabaDeckTutorial.vue')),
		{},
		{ closed: () => dispose() },
	);
}

// ===== ナビ (旧 Hataskey UI 設定から移設・バッファ保存) =====
//   現在値を deep clone してバッファに置き、明示保存(下部の「保存」ボタン)まで prefer.commit しない。
const editedTopNav = ref<any[]>(JSON.parse(JSON.stringify(prefer.s['simpleUi.topNav'] ?? [])));
const editedBottomNav = ref<any[]>(mergeMissingNavItems(
	normalizeBottomNavItems(JSON.parse(JSON.stringify(prefer.s['simpleUi.bottomNav'] ?? []))),
	normalizeBottomNavItems(JSON.parse(JSON.stringify(getInitialPrefValue('simpleUi.bottomNav')))),
));
const initialTopNavSnapshot = JSON.stringify(editedTopNav.value);
const initialBottomNavSnapshot = JSON.stringify(editedBottomNav.value);
const hasNavChanges = computed(() =>
	JSON.stringify(editedTopNav.value) !== initialTopNavSnapshot
	|| JSON.stringify(editedBottomNav.value) !== initialBottomNavSnapshot,
);
function setTopNavVisible(idx: number, visible: boolean) {
	editedTopNav.value = editedTopNav.value.map((it, i) => i === idx ? { ...it, visible } : it);
}
function setBottomNavVisible(idx: number, visible: boolean) {
	editedBottomNav.value = editedBottomNav.value.map((it, i) => i === idx ? { ...it, visible } : it);
}
async function resetTopNav() {
	const c = await os.confirm({ type: 'warning', title: copy.resetDefaults, text: copy.resetTopNavConfirm });
	if (c.canceled) return;
	editedTopNav.value = JSON.parse(JSON.stringify(getInitialPrefValue('simpleUi.topNav')));
}
async function resetBottomNav() {
	const c = await os.confirm({ type: 'warning', title: copy.resetDefaults, text: copy.resetBottomNavConfirm });
	if (c.canceled) return;
	editedBottomNav.value = normalizeBottomNavItems(JSON.parse(JSON.stringify(getInitialPrefValue('simpleUi.bottomNav'))));
}

// 下部ナビ現在表示中判定 (グレーアウト条件)。simple.vue と同じロジック。
const DESKTOP_THRESHOLD = 1100;
const windowWidth = ref(typeof window === 'undefined' ? DESKTOP_THRESHOLD : window.innerWidth);
function onResize() { windowWidth.value = window.innerWidth; }
onMounted(() => { window.addEventListener('resize', onResize, { passive: true }); });
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); });
const isHatasabaUi = computed(() => miLocalStorage.getItem('ui') === 'simple');
const isDeckModeOn = computed(() => (prefer.r['simpleUi.deckMode']?.value as boolean | undefined) === true);
const isDesktop = computed(() => (deckIgnoreWidth.value && isDeckModeOn.value) ? true : windowWidth.value >= DESKTOP_THRESHOLD);
const isBottomNavVisible = computed(() => isHatasabaUi.value && !isDesktop.value);
// 旗鯖fork: Hataskey UI のデッキUIが「今まさにアクティブ」か。
//   simple.vue の deckActive と同条件 (ui=simple かつ deckMode かつ デスクトップ相当)。
//   デッキUIチュートリアルの再表示ボタンは、この状態のときのみ押下できる。
const isHatasabaDeckActive = computed(() => isHatasabaUi.value && isDeckModeOn.value && isDesktop.value);

// 保存済みの label は互換性のため変更せず、既定項目だけ表示時に翻訳する。
const navLabelById: Record<string, string> = {
	following: copy.navHome,
	local: copy.navLocal,
	social: copy.navSocial,
	mixed: copy.navGlobal,
	search: copy.navSearch,
	home: copy.navHome,
	notifications: copy.navNotifications,
	widgets: copy.navWidgets,
};

function navDisplayLabel(item: { id: string; label?: string }): string {
	return navLabelById[item.id] ?? item.label ?? item.id;
}

// サイドメニュー編集モーダル起動。
async function openSidebarEditDialog() {
	const { dispose } = os.popup(
		(await import('@/components/MkSidebarEditDialog.vue')).default,
		{},
		{ done: () => { /* noop */ }, closed: () => dispose() },
	);
}

// ===== 保存 =====
function save() {
	if (!hasChanges.value) {
		dialog.value?.close();
		return;
	}
	try {
		// glassUi / glassUiBubble は端末ローカル (miLocalStorage + <html> クラス反映)
		if (editedGlassUi.value !== snapshot.glassUi) setGlassUiLocal(editedGlassUi.value);
		if (editedGlassUiBubble.value !== snapshot.glassUiBubble) setGlassUiBubbleLocal(editedGlassUiBubble.value);
		// prefer 系はサーバー同期
		if (editedNormalNoBannerBg.value !== snapshot.normalNoBannerBg) prefer.commit('simpleUi.normalNoBannerBg', editedNormalNoBannerBg.value);
		if (editedProfileNoBannerBg.value !== snapshot.profileNoBannerBg) prefer.commit('simpleUi.profileNoBannerBg', editedProfileNoBannerBg.value);
		if (editedOpacity.value !== snapshot.opacity) {
			const n = Math.max(0, Math.min(100, Math.round(editedOpacity.value)));
			prefer.commit('simpleUi.glassUiCardOpacity', n);
		}
		if (editedDisableBubbleInHatasabaDeck.value !== snapshot.disableBubbleInHatasabaDeck) prefer.commit('simpleUi.disableBubbleInHatasabaDeck', editedDisableBubbleInHatasabaDeck.value);
		if (editedShowTrendingTab.value !== snapshot.showTrendingTab) prefer.commit('simpleUi.showTrendingTab', editedShowTrendingTab.value);
		if (editedTopNavMode.value !== snapshot.topNavMode) prefer.commit('simpleUi.topNavMode', editedTopNavMode.value);
		if (editedDeckIgnoreWidth.value !== snapshot.deckIgnoreWidth) setDeckIgnoreWidth(editedDeckIgnoreWidth.value);
		if (editedTabSwipeEnabled.value !== snapshot.tabSwipeEnabled) setTabSwipeEnabled(editedTabSwipeEnabled.value);
		// ナビバー(上部/下部)は変更があればまとめて commit。
		if (hasNavChanges.value) {
			prefer.commit('simpleUi.topNav', JSON.parse(JSON.stringify(editedTopNav.value)));
			prefer.commit('simpleUi.bottomNav', normalizeBottomNavItems(JSON.parse(JSON.stringify(editedBottomNav.value))));
		}
		os.toast(copy.savedReloading);
		emit('done', { saved: true });
		// 旗鯖fork: 保存後に即座にリロード。ライブプレビューで裏で書き換えた <html> クラス・
		// CSS 変数と、実際の prefer 値との間の齟齬を確実に解消 (フルリロードで全描画を刷新)。
		// 短い遅延でトーストの成功メッセージが視認できるようにする。
		setTimeout(() => { window.location.reload(); }, 300);
		// dialog.value?.close(); ← リロードするので不要
	} catch (err) {
		os.alert({
			type: 'error',
			title: copy.saveFailedTitle,
			text: err instanceof Error ? copyx.tryAgainWithDetails({ details: err.message }) : copy.tryAgain,
		});
	}
}

// ===== 破棄して閉じる =====
// バッファに未保存変更があれば確認、破棄時はライブプレビューを snapshot に戻す
async function closeWithoutSave() {
	if (hasChanges.value) {
		const c = await os.confirm({
			type: 'warning',
			title: copy.discardChangesTitle,
			text: copy.discardChangesText,
		});
		if (c.canceled) return;
	}
	// ライブプレビューで書き換えていた CSS 変数 / <html> クラスを snapshot に戻す
	restoreLivePreviewToSnapshot();
	emit('done', { saved: false });
	dialog.value?.close();
}

// MkWindow の close ボタン (X) 経由の閉じ処理
function onWindowClosed() {
	// snapshot に戻す (破棄扱い)
	restoreLivePreviewToSnapshot();
	emit('done', { saved: false });
	emit('closed');
}

function restoreLivePreviewToSnapshot() {
	document.documentElement.classList.toggle('hataGlassUi', snapshot.glassUi);
	document.documentElement.classList.toggle('hataGlassUiBubble', snapshot.glassUiBubble);
	document.documentElement.classList.toggle('hataProfileNoBannerBg', snapshot.profileNoBannerBg);
	document.documentElement.style.setProperty('--htk-glass-card-opacity', snapshot.opacity + '%');
}

/** 旗鯖fork: true なら窓の枠を持たず、設定画面の右ペインの中身として描く。 */
defineProps<{ embedded?: boolean }>();
</script>

<style lang="scss" module>
.hint {
	display: flex;
	gap: 10px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-fg);
	font-size: .82em;
	line-height: 1.55;
	margin-bottom: 12px;

	> i {
		flex-shrink: 0;
		color: var(--MI_THEME-accent);
		font-size: 1.1em;
		margin-top: 2px;
	}
}
.warnBanner {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: .82em;
	color: var(--MI_THEME-warn);
	margin-bottom: 8px;
	padding: 6px 10px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 8px;
	background: var(--MI_THEME-panel);
}
.subActions {
	margin-top: 12px;
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}
.subBtn {
	padding: 8px 14px;
	font-size: .88em;
	border-radius: 999px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	cursor: pointer;
	&:hover:not(:disabled) { background: var(--MI_THEME-accentedBg); border-color: var(--MI_THEME-accent); }
	&:disabled { opacity: .45; cursor: not-allowed; }
}
.replayHint {
	display: flex;
	align-items: flex-start;
	gap: 6px;
	margin-top: 8px;
	font-size: .82em;
	line-height: 1.55;
	opacity: .8;
	> i { flex-shrink: 0; margin-top: 2px; color: var(--MI_THEME-accent); }
}
.opacityDesc, .hataUi2Desc {
	font-size: .85em;
	opacity: .8;
	margin-bottom: 10px;
	line-height: 1.55;
}
.opacityRow {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 4px 2px;
}
.opacityRange {
	flex: 1;
	min-width: 0;
	accent-color: var(--MI_THEME-accent);
	&:disabled { opacity: .4; cursor: not-allowed; }
}
.opacityValue {
	min-width: 3.2em;
	text-align: right;
	font-variant-numeric: tabular-nums;
	font-size: .95em;
	font-weight: 600;
	color: var(--MI_THEME-fg);
}
.smallBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px; height: 32px;
	border-radius: 999px;
	border: 1px solid var(--MI_THEME-divider);
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	cursor: pointer;
	flex-shrink: 0;
	transition: background .15s, border-color .15s, opacity .15s;
	&:hover:not(:disabled) { background: var(--MI_THEME-accentedBg); border-color: var(--MI_THEME-accent); }
	&:disabled { opacity: .35; cursor: not-allowed; }
}

.footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	border-top: 1px solid var(--MI_THEME-divider);
	flex-wrap: wrap;
	position: sticky;
	bottom: 0;
	background: var(--MI_THEME-panel);
}
.resetBtn { font-size: .85em; }
.footerRight {
	display: flex;
	gap: 8px;
	align-items: center;
	margin-left: auto;
}
.unsavedTag {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	color: #e74040;
	font-size: .82em;
	> i { margin-right: 2px; }
}

/* ===== ナビ編集 (旧 Hataskey UI 設定から移設) ===== */
.reorderHead {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 10px;
	flex-wrap: wrap;
}
.reorderHint {
	flex: 1;
	min-width: 180px;
	font-size: .85em;
	opacity: .75;
	line-height: 1.5;
}
.navResetBtn {
	padding: 6px 12px;
	font-size: .82em;
	border-radius: 999px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	cursor: pointer;
	white-space: nowrap;
	&:hover:not(:disabled) { background: var(--MI_THEME-accentedBg); border-color: var(--MI_THEME-accent); }
	&:disabled { opacity: .4; cursor: not-allowed; }
	> i { margin-right: 4px; }
}
.reorderList {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.reorderItem {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 10px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 12px;
	background: var(--MI_THEME-panel);
	transition: opacity .15s;
}
.reorderItemHidden { opacity: .42; }
.handle {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: none;
	background: none;
	color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg));
	cursor: grab;
	border-radius: 8px;
	flex-shrink: 0;
	&:hover { background: var(--MI_THEME-bg); }
	&:active { cursor: grabbing; }
}
.reorderToggle {
	flex-shrink: 0;
	transform: scale(.85);
	transform-origin: left center;
	margin: 0;
}
.reorderIcon {
	font-size: 1.1em;
	color: var(--MI_THEME-fg);
	flex-shrink: 0;
	width: 1.4em;
	text-align: center;
}
.reorderLabel {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.warning {
	margin-top: 8px;
	padding: 6px 10px;
	color: #e74040;
	font-size: .85em;
	border-radius: 8px;
	background: color-mix(in srgb, #e74040 12%, transparent);
}
.disabledNote {
	display: flex;
	gap: 10px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--MI_THEME-panel);
	border: 1px dashed var(--MI_THEME-divider);
	color: var(--MI_THEME-fg);
	font-size: .83em;
	line-height: 1.55;
	margin-bottom: 10px;
	> i {
		flex-shrink: 0;
		color: var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg));
		font-size: 1.15em;
		margin-top: 2px;
	}
}
.bottomNavFieldset {
	border: none;
	padding: 0;
	margin: 0;
}
.bottomNavFieldsetDisabled { opacity: .45; pointer-events: none; }
.openSidebarBtn {
	padding: 10px 20px;
	font-weight: bold;
	> i { margin-right: 6px; }
}
</style>

<style>
/* 旗鯖fork: vuedraggable の ghost クラスは scoped CSS Modules では当たらないため global で定義 */
.htkNavDragGhost {
	opacity: .35;
	background: var(--MI_THEME-accentedBg) !important;
}
</style>
