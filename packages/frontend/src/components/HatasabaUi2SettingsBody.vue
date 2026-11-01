<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<section ref="surfaceEl" :class="$style.surface" :data-mode="mode" :data-motion-enabled="motionEnabled ? 'true' : 'false'" aria-labelledby="hatasaba-ui2-title">
	<header v-if="mode === 'permanent'" :class="[$style.intro, $style.permanentIntro]">
		<div :class="$style.titleRow">
			<div>
				<span :class="$style.recommended">{{ ui === 'simple' ? copy.ui2.recommendedInUse : i18n.ts.recommended }}</span>
				<h2 id="hatasaba-ui2-title"><span class="settingsBrand">Hataskey UI</span></h2>
				<!-- 旗鯖fork: ⚠️2つの文を1行に流さないこと。「どんなUIか」と「いつ反映されるか」は
					     別の話なので、文の切れ目で改行して読み分けられるようにする。
					     ⚠️翻訳を書き換えて改行を埋め込まないこと。訳ごとに切れ目が違う。
					     ⚠️句点で切り出す。句点が無い訳では1行のまま出る（壊れない）。 -->
					<p>{{ permanentDescriptionLead }}<template v-if="permanentDescriptionRest"><br/>{{ permanentDescriptionRest }}</template><b>{{ copy.ui2.permanentDescriptionSave }}</b>{{ copy.ui2.permanentDescriptionAfter }}</p>
			</div>
			<div :class="$style.headerActions">
				<button type="button" :class="$style.previewAction" @click="emit('preview')"><i class="ti ti-eye" aria-hidden="true"></i>{{ copy.ui2.openPreview }}</button>
				<button type="button" @click="editor.resetToDefault"><i class="ti ti-restore" aria-hidden="true"></i>{{ editor.copy.resetDefaults }}</button>
			</div>
		</div>
	</header>
	<header v-else :class="$style.intro">
		<div :class="$style.titleRow">
			<div><p :class="$style.eyebrow"><span class="settingsBrand">Hataskey UI</span></p><h2 id="hatasaba-ui2-title"><span class="settingsBrand">{{ editor.copy.windowTitle }}</span></h2></div>
			<span :class="$style.preview"><i class="ti ti-sparkles" aria-hidden="true"></i>{{ copy.ui2.livePreview }}</span>
		</div>
		<p>{{ editor.copy.hintBeforeCompare }}<b>{{ editor.copy.hintCompare }}</b>{{ editor.copy.hintAfterCompare }}<b>{{ editor.copy.hintSave }}</b>{{ editor.copy.hintAfterSave }}</p>
	</header>
	<!-- 旗鯖fork: ⚠️ヘッダーの中に置かないこと。
	     position: sticky は直近の親の中でしか貼り付けないため、
	     ヘッダー(高さ246px)の中だとそこを抜けた時点で流れて消える。 -->
	<div v-if="mode === 'permanent'" ref="chipsSentinel" :class="$style.chipsSentinel" aria-hidden="true"></div>
	<nav v-if="mode === 'permanent'" :class="$style.chips" :aria-label="copy.ui2.categoryLabel" :data-stuck="chipsStuck ? 'true' : 'false'" data-settings-horizontal-scroll @wheel="onCategoryWheel">
		<button v-for="chip in permanentCategoryChips" :key="chip.target" type="button" :aria-label="chip.label" :title="chip.label" :aria-controls="chip.target" :aria-current="activeCategoryTarget === chip.target ? 'true' : undefined" :data-active="activeCategoryTarget === chip.target ? 'true' : 'false'" @click="focusCategory(chip.target)"><i :class="chip.icon" aria-hidden="true"></i><span v-if="activeCategoryTarget === chip.target" :class="$style.chipLabel">{{ chip.label }}</span></button>
	</nav>

	<!-- 旗鯖fork: 常設表示でも保存ボタンを常に出しておく。
	     ⚠️以前は変更があるときだけ枠ごと現れる作りで、開いた直後は保存ボタンが
	     どこにも無い状態だった。ポップアップ側と同じく、無効にして置いておく。
	     ⚠️破棄は「変更を捨てる」操作なので、変更が無いときは出さない。 -->
	<div v-if="mode === 'permanent'" :class="$style.changeBar" :data-has-changes="editor.hasChanges ? 'true' : 'false'">
		<span :class="$style.unsaved" role="status" aria-live="polite">
			<i :class="editor.hasChanges ? 'ti ti-alert-circle' : 'ti ti-check'" aria-hidden="true"></i>{{ editor.hasChanges ? unsavedMessage : copy.ui2.noChanges }}
		</span>
		<div :class="$style.changeBarActions">
			<button v-if="editor.hasChanges" type="button" @click="requestClose">{{ copy.ui2.discard }}</button>
			<button type="button" :disabled="!editor.hasChanges" :class="$style.save" @click="save"><i class="ti ti-device-floppy" aria-hidden="true"></i>{{ copy.ui2.saveAndReload }}</button>
		</div>
	</div>

	<div v-if="mode !== 'permanent'" :class="$style.chips" :aria-label="copy.ui2.categoryLabel">
		<span><span :class="$style.chipLabel">{{ copy.ui2.chipNavigation }}</span></span><span><span :class="$style.chipLabel">{{ copy.ui2.chipGlass }}</span></span><span><span :class="$style.chipLabel">{{ copy.ui2.chipNote }}</span></span><span><span :class="$style.chipLabel">{{ copy.ui2.chipDeck }}</span></span><span><span :class="$style.chipLabel">{{ copy.ui2.chipDevice }}</span></span>
	</div>

	<section id="hatasaba-ui2-nav" :class="[$style.card, mode === 'permanent' && $style.basicCard]" aria-labelledby="hatasaba-ui2-basic" tabindex="-1">
		<div :class="$style.basicTitle"><h3 id="hatasaba-ui2-basic">{{ editor.copy.basic }}</h3><span>{{ copyx.ui2.basicItemCount({ count: 5 }) }}</span></div>
		<div :class="$style.basicRows" data-settings-ui2-basic-group>
			<MkSwitch v-model="editor.draft.editedShowTrendingTab" :flat="mode === 'permanent'"><template #label>{{ editor.copy.showTrendingTab }}</template><template #caption>{{ editor.copy.showTrendingTabCaption }}</template></MkSwitch>
			<MkSwitch v-model="editor.draft.editedShowHatadyTab" :flat="mode === 'permanent'"><template #label>{{ editor.copy.showHatadyTab }}</template><template #caption>{{ editor.copy.showHatadyTabCaption }}</template></MkSwitch>
			<MkSwitch id="hatasaba-ui2-deck" v-model="editor.draft.editedTopNavMode" tabindex="-1" :flat="mode === 'permanent'"><template #label>{{ editor.copy.showMenuAtTop }}</template><template #caption>{{ editor.copy.showMenuAtTopCaption }}<b>{{ editor.copy.deckOnlyNote }}</b></template></MkSwitch>
			<MkSwitch v-model="editor.draft.editedDeckIgnoreWidth" :flat="mode === 'permanent'"><template #label>{{ editor.copy.ignoreDeckWidth }}</template><template #caption>{{ editor.copy.ignoreDeckWidthCaption }}<b>{{ editor.copy.deviceSpecificSetting }}</b></template></MkSwitch>
			<MkSwitch v-model="editor.draft.editedTabSwipeEnabled" :flat="mode === 'permanent'"><template #label>{{ editor.copy.swipeTabs }}</template><template #caption>{{ editor.copy.swipeTabsCaption }}<b>{{ editor.copy.thisDeviceOnly }}</b>{{ editor.copy.savedSuffix }}</template></MkSwitch>
		</div>
		<div :class="$style.subActions"><button type="button" :disabled="!editor.isHatasabaDeckActive" @click="editor.onReplayDeckTutorial"><i class="ti ti-refresh" aria-hidden="true"></i>{{ editor.copy.replayDeckTutorial }}</button></div>
		<p v-if="!editor.isHatasabaDeckActive" :class="$style.hint"><i class="ti ti-info-circle" aria-hidden="true"></i><span>{{ editor.copy.replayHintBefore }}<b>{{ editor.copy.replayHintDeck }}</b>{{ editor.copy.replayHintAfter }}</span></p>
	</section>

	<section id="hatasaba-ui2-glass-and-blur" :class="$style.card" aria-labelledby="hatasaba-ui2-opacity" tabindex="-1">
		<div :class="$style.cardTitle"><h3 id="hatasaba-ui2-opacity">{{ editor.copy.glassOpacity }}</h3><output :class="$style.value">{{ editor.draft.editedOpacity }}%</output></div>
		<p v-if="!editor.draft.editedGlassUi" :class="$style.warning"><i class="ti ti-info-circle" aria-hidden="true"></i>{{ editor.copy.onlyWhenUi2Enabled }}</p>
		<p :class="$style.description">{{ editor.copy.opacityDescriptionBefore }}<b>{{ editor.copy.opacityTerm }}</b>{{ editor.copy.opacityDescriptionAfter }}</p>
		<div :class="$style.rangeRow"><input v-model.number="editor.draft.editedOpacity" aria-labelledby="hatasaba-ui2-opacity" type="range" min="0" max="100" step="1" :disabled="!editor.draft.editedGlassUi" @input="editor.onOpacityInput"/><button type="button" :aria-label="editor.copy.restoreOpacity" :disabled="!editor.draft.editedGlassUi || editor.draft.editedOpacity === 55" @click="editor.setOpacity(55)"><i class="ti ti-restore" aria-hidden="true"></i></button></div>
	</section>

	<section :class="$style.card" aria-labelledby="hatasaba-ui2-bubble">
		<h3 id="hatasaba-ui2-bubble">{{ editor.copy.ui2Name }}</h3>
		<p :class="$style.description"><b>{{ editor.copy.ui2Name }}</b>{{ editor.copy.ui2DescriptionBefore }}<b>{{ editor.copy.alwaysEnabled }}</b>{{ editor.copy.ui2DescriptionAfter }}</p>
		<MkSwitch v-model="editor.draft.editedGlassUiBubble" @update:modelValue="editor.setGlassUiBubble"><template #label>{{ editor.copy.showBubbleDesign }}</template><template #caption>{{ editor.copy.showBubbleDesignCaption }}<b>{{ editor.copy.thisDeviceOnly }}</b>{{ editor.copy.savedSuffix }}</template></MkSwitch>
	</section>

	<section :class="$style.card" aria-labelledby="hatasaba-ui2-blur">
		<h3 id="hatasaba-ui2-blur">{{ editor.copy.headerImageBlur }}</h3>
		<MkSwitch v-model="editor.draft.editedNormalNoBannerBg"><template #label>{{ editor.copy.disableTimelineHeaderBlur }}</template><template #caption>{{ editor.copy.disableTimelineHeaderBlurCaption }}<br><b>{{ editor.copy.noLivePreviewNote }}</b></template></MkSwitch>
		<MkSwitch v-model="editor.draft.editedProfileNoBannerBg" @update:modelValue="editor.setProfileNoBannerBg"><template #label>{{ editor.copy.disableProfileHeaderBlur }}</template><template #caption>{{ editor.copy.disableProfileHeaderBlurCaption }}</template></MkSwitch>
	</section>

	<section id="hatasaba-ui2-note" :class="$style.card" aria-labelledby="hatasaba-ui2-note-title" tabindex="-1">
		<h3 id="hatasaba-ui2-note-title">{{ editor.copy.noteDisplayDeck }}</h3>
		<MkSwitch v-model="editor.draft.editedDisableBubbleInHatasabaDeck"><template #label>{{ editor.copy.enableSimpleNotesInDeck }}</template><template #caption>{{ editor.copy.enableSimpleNotesInDeckCaption }}<br><b>{{ editor.copy.noLivePreviewNote }}</b></template></MkSwitch>
	</section>

	<section :class="$style.card" aria-labelledby="hatasaba-ui2-top-nav">
		<div :class="$style.cardTitle"><h3 id="hatasaba-ui2-top-nav">{{ editor.copy.topNavSection }}</h3><button type="button" @click="editor.resetTopNav"><i class="ti ti-restore" aria-hidden="true"></i>{{ editor.copy.resetOrder }}</button></div>
		<p :class="$style.description">{{ editor.copy.topNavReorderHint }}</p>
		<p id="hatasaba-ui2-top-nav-reorder-help" :class="$style.srOnly">{{ copy.ui2.reorderKeyboardHint }}</p>
		<draggable v-model="editor.draft.editedTopNav" :class="$style.reorderList" itemKey="id" handle=".htkNavDragHandle" ghostClass="htkNavDragGhost" :animation="draggableAnimation">
			<template #item="{ element: item, index }"><div :class="[$style.reorderItem, item.visible === false && $style.hidden]"><button type="button" class="htkNavDragHandle" :class="$style.handle" :aria-label="reorderHandleLabel(item)" aria-keyshortcuts="ArrowUp ArrowDown" aria-describedby="hatasaba-ui2-top-nav-reorder-help" @keydown="onReorderKeydown($event, 'top', index)"><i class="ti ti-grip-vertical" aria-hidden="true"></i></button><MkSwitch compact :modelValue="item.visible !== false" @update:modelValue="value => editor.setTopNavVisible(index, value)"><template #label><span :class="$style.srOnly">{{ navVisibilityLabel(item) }}</span></template></MkSwitch><i :class="item.icon" aria-hidden="true"></i><span>{{ editor.navDisplayLabel(item) }}</span></div></template>
		</draggable>
	</section>

	<section :class="$style.card" aria-labelledby="hatasaba-ui2-bottom-nav">
		<div :class="$style.cardTitle"><h3 id="hatasaba-ui2-bottom-nav">{{ editor.copy.bottomNavSection }}</h3><button type="button" :disabled="!editor.isBottomNavVisible" @click="editor.resetBottomNav"><i class="ti ti-restore" aria-hidden="true"></i>{{ editor.copy.resetOrder }}</button></div>
		<p v-if="!editor.isBottomNavVisible" :class="$style.hint"><i class="ti ti-device-desktop" aria-hidden="true"></i>{{ editor.copy.bottomNavUnavailableBefore }}<b>{{ editor.copy.mobileNarrow }}</b>{{ editor.copy.bottomNavUnavailableAfter }} {{ editor.copy.openOnPhone }}</p>
		<fieldset :disabled="!editor.isBottomNavVisible" :class="$style.fieldset"><p :class="$style.description">{{ editor.copyx.bottomNavReorderHint({ max: editor.HATASABA_BOTTOM_NAV_MAX }) }}</p><p id="hatasaba-ui2-bottom-nav-reorder-help" :class="$style.srOnly">{{ copy.ui2.reorderKeyboardHint }}</p><draggable v-model="editor.draft.editedBottomNav" :class="$style.reorderList" itemKey="id" handle=".htkNavDragHandle" ghostClass="htkNavDragGhost" :animation="draggableAnimation" :disabled="!editor.isBottomNavVisible"><template #item="{ element: item, index }"><div :class="[$style.reorderItem, item.visible === false && $style.hidden]"><button type="button" class="htkNavDragHandle" :class="$style.handle" :aria-label="reorderHandleLabel(item)" aria-keyshortcuts="ArrowUp ArrowDown" aria-describedby="hatasaba-ui2-bottom-nav-reorder-help" @keydown="onReorderKeydown($event, 'bottom', index)"><i class="ti ti-grip-vertical" aria-hidden="true"></i></button><MkSwitch compact :modelValue="item.visible !== false" @update:modelValue="value => editor.setBottomNavVisible(index, value)"><template #label><span :class="$style.srOnly">{{ navVisibilityLabel(item) }}</span></template></MkSwitch><i :class="item.icon" aria-hidden="true"></i><span>{{ editor.navDisplayLabel(item) }}</span></div></template></draggable></fieldset>
		<p v-if="editor.draft.editedBottomNav.filter(item => item.visible !== false).length > editor.HATASABA_BOTTOM_NAV_MAX" :class="$style.warning"><i class="ti ti-alert-triangle" aria-hidden="true"></i>{{ editor.copyx.maxVisibleItems({ max: editor.HATASABA_BOTTOM_NAV_MAX }) }}</p>
	</section>

	<section id="hatasaba-ui2-side-menu" :class="$style.card" aria-labelledby="hatasaba-ui2-side-menu-title" tabindex="-1">
		<h3 id="hatasaba-ui2-side-menu-title">{{ editor.copy.sideMenuSection }}</h3><p :class="$style.description"><b>{{ editor.copy.sideStudioName }}</b>{{ editor.copy.sideStudioDescription }}</p>
		<div :class="$style.subActions"><button type="button" @click="emit('sideStudio')"><i class="ti ti-layout-dashboard" aria-hidden="true"></i>{{ editor.copy.openSideStudio }}</button><button type="button" @click="editor.openSidebarEditDialog"><i class="ti ti-list" aria-hidden="true"></i>{{ editor.copy.openLegacyReorder }}</button></div>
	</section>

	<footer v-if="mode === 'popup'" :class="$style.footer" data-mode="popup">
		<button type="button" :class="$style.reset" @click="editor.resetToDefault"><i class="ti ti-restore" aria-hidden="true"></i>{{ editor.copy.resetDefaults }}</button>
		<div :class="$style.footerActions">
			<span v-if="editor.hasChanges" :class="$style.unsaved" role="status" aria-live="polite"><i class="ti ti-alert-circle" aria-hidden="true"></i>{{ unsavedMessage }}</span>
			<button type="button" @click="requestClose">{{ editor.copy.close }}</button>
			<button type="button" :disabled="!editor.hasChanges" :class="$style.save" @click="save"><i class="ti ti-device-floppy" aria-hidden="true"></i>{{ editor.copy.save }}</button>
		</div>
	</footer>
</section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref , onMounted , onBeforeUnmount , useTemplateRef } from 'vue';
import draggable from 'vuedraggable';
import type { HatasabaUi2Draft } from '@/composables/use-hatasaba-ui2-draft.js';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import { ui } from '@@/js/config.js';

const props = withDefaults(defineProps<{
	editor: HatasabaUi2Draft;
	mode?: 'permanent' | 'popup';
	motionEnabled?: boolean;
}>(), {
	mode: 'popup',
	motionEnabled: true,
});
const emit = defineEmits<{ close: []; saved: []; sideStudio: []; preview: [] }>();
const copy = i18n.ts._hata._settingsRedesign;
const copyx = i18n.tsx._hata._settingsRedesign;
const surfaceEl = useTemplateRef<HTMLElement>('surfaceEl');
function sectionById(id: string): HTMLElement | null {
	return surfaceEl.value?.querySelector<HTMLElement>(`#${id}`) ?? null;
}
/**
 * 旗鯖fork: 説明文を最初の句点で切り、2行に分けて出す。
 * ⚠️句点が無い言語では切らずにそのまま出す（改行が消えるだけで壊れない）。
 */
const permanentDescriptionParts = computed(() => {
	const text = copy.ui2.permanentDescriptionBefore;
	const end = text.indexOf('。');
	if (end < 0 || end === text.length - 1) return { lead: text, rest: '' };
	return { lead: text.slice(0, end + 1), rest: text.slice(end + 1) };
});
const permanentDescriptionLead = computed(() => permanentDescriptionParts.value.lead);
const permanentDescriptionRest = computed(() => permanentDescriptionParts.value.rest);

const mode = computed(() => props.mode);
const draggableAnimation = computed(() => props.motionEnabled === false ? 0 : 150);
const unsavedMessage = computed(() => copyx.ui2.unsavedChanges({ count: props.editor.changeCount }));
const activeCategoryTarget = ref('hatasaba-ui2-nav');
const permanentCategoryChips = [
	{ label: copy.ui2.chipNavigation, icon: 'ti ti-layout-navbar', target: 'hatasaba-ui2-nav' },
	{ label: copy.ui2.chipGlassAndBlur, icon: 'ti ti-blur', target: 'hatasaba-ui2-glass-and-blur' },
	{ label: copy.ui2.chipNote, icon: 'ti ti-note', target: 'hatasaba-ui2-note' },
	{ label: copy.ui2.chipDeck, icon: 'ti ti-columns', target: 'hatasaba-ui2-deck' },
	{ label: copy.ui2.chipSideMenu, icon: 'ti ti-menu-2', target: 'hatasaba-ui2-side-menu' },
	{ label: copy.ui2.chipFoldable, icon: 'ti ti-devices', target: 'hatasaba-ui2-foldable' },
] as const;

async function requestClose(): Promise<void> {
	if (await props.editor.discard()) emit('close');
}

/**
 * 旗鯖fork: いま画面を一番多く占めている節に、タブの選択を合わせる。
 *
 * ⚠️節の先頭が入ったかで決めないこと。長い節を読んでいる途中で
 *   次の節へ先に切り替わってしまう。「見えている量」で決める。
 * ⚠️scroll イベントで毎回計算しない。重く、取りこぼす。
 * ⚠️タブを押して飛んでいる最中は追わせない（通過した節に反応してちらつく）。
 */
let sectionObserver: IntersectionObserver | null = null;
const visibleRatioByTarget = new Map<string, number>();
/** タブ操作で飛んでいる間は追従を止める。0 なら追従してよい。 */
let suppressSpyUntil = 0;

function syncActiveCategoryFromScroll(): void {
	if (Date.now() < suppressSpyUntil) return;
	let bestTarget: string | null = null;
	let bestRatio = 0;
	for (const [target, ratio] of visibleRatioByTarget) {
		if (ratio > bestRatio) {
			bestRatio = ratio;
			bestTarget = target;
		}
	}
	// ⚠️どの節もほとんど見えていないときは、いまの選択を保つ。
	//   0件の瞬間に選択が飛ぶと、境目でちらつく。
	if (bestTarget != null && bestRatio > 0) activeCategoryTarget.value = bestTarget;
}

onMounted(() => {
	if (typeof IntersectionObserver === 'undefined') return;
	const targets = permanentCategoryChips
		.map(chip => sectionById(chip.target))
		.filter((element): element is HTMLElement => element != null);
	if (targets.length === 0) return;
	sectionObserver = new IntersectionObserver(entries => {
		for (const entry of entries) {
			// 画面に映っている高さを、その節の高さではなく画面の高さで割る。
			// ⚠️節の高さで割ると、短い節が常に勝ってしまう。
			const viewport = entry.rootBounds?.height ?? window.innerHeight;
			visibleRatioByTarget.set(entry.target.id, viewport > 0 ? entry.intersectionRect.height / viewport : 0);
		}
		syncActiveCategoryFromScroll();
	}, { threshold: [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1] });
	for (const target of targets) sectionObserver.observe(target);
});

onBeforeUnmount(() => {
	sectionObserver?.disconnect();
	sectionObserver = null;
	visibleRatioByTarget.clear();
});

/**
 * 旗鯖fork: タブが画面から出たら上部へ貼り付ける。
 * ⚠️scroll イベントで座標を測り続けない。重いうえに取りこぼす。
 *   本来の位置に置いた目印が見えているかどうかで判定する。
 */
const chipsSentinel = useTemplateRef<HTMLElement>('chipsSentinel');
const chipsStuck = ref(false);
let chipsObserver: IntersectionObserver | null = null;

onMounted(() => {
	const target = chipsSentinel.value;
	if (target == null || typeof IntersectionObserver === 'undefined') return;
	chipsObserver = new IntersectionObserver(entries => {
		for (const entry of entries) chipsStuck.value = !entry.isIntersecting;
	}, { threshold: 0 });
	chipsObserver.observe(target);
});

onBeforeUnmount(() => {
	chipsObserver?.disconnect();
	chipsObserver = null;
});

function save(): void {
	if (props.editor.save()) emit('saved');
}

function onCategoryWheel(event: WheelEvent): void {
	const element = event.currentTarget;
	if (!(element instanceof HTMLElement)) return;

	const maxScrollLeft = element.scrollWidth - element.clientWidth;
	if (maxScrollLeft <= 0) return;

	const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
	if (delta === 0) return;

	const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, element.scrollLeft + delta));
	if (nextScrollLeft === element.scrollLeft) return;

	event.preventDefault();
	element.scrollLeft = nextScrollLeft;
}

function focusCategory(targetId: string): void {
	if (typeof window === 'undefined') return;
	const target = sectionById(targetId);
	if (target == null) return;
	activeCategoryTarget.value = targetId;
	// ⚠️滑らかスクロールの途中で通過した節に反応させない。
	suppressSpyUntil = Date.now() + 900;
	target.scrollIntoView({ behavior: props.motionEnabled === false ? 'auto' : 'smooth', block: 'start' });
	target.focus({ preventScroll: true });
}

function navVisibilityLabel(item: Parameters<HatasabaUi2Draft['navDisplayLabel']>[0]): string {
	return copyx.ui2.showNavItem({ label: props.editor.navDisplayLabel(item) });
}

function reorderHandleLabel(item: Parameters<HatasabaUi2Draft['navDisplayLabel']>[0]): string {
	return copyx.ui2.reorderNavItem({ label: props.editor.navDisplayLabel(item) });
}

async function onReorderKeydown(event: KeyboardEvent, list: 'top' | 'bottom', index: number): Promise<void> {
	const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : null;
	if (direction == null) return;
	event.preventDefault();
	const handle = event.currentTarget;
	const moved = list === 'top'
		? props.editor.moveTopNav(index, direction)
		: props.editor.moveBottomNav(index, direction);
	if (!moved) return;
	await nextTick();
	if (handle instanceof HTMLButtonElement && handle.isConnected) {
		handle.focus({ preventScroll: true });
	}
}
</script>

<style lang="scss" module>
.surface { color: var(--MI_THEME-fg); }
.intro, .card { border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 72%, transparent); border-radius: 22px; background: var(--MI_THEME-panel); box-shadow: 0 2px 10px color-mix(in srgb, var(--MI_THEME-shadow) 5%, transparent); }
.intro { padding: 20px; margin-bottom: 12px; line-height: 1.6; }
.intro p, .description { margin: 8px 0 0; font-size: .86rem; color: var(--MI_THEME-fgTransparentWeak); }
.titleRow, .cardTitle, .footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.permanentIntro .titleRow { align-items: flex-start; }
.eyebrow { margin: 0 0 3px; color: var(--MI_THEME-accent); font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
/* 旗鯖fork: ⚠️必ず .surface の下に入れること。素の要素セレクタは
   CSS Modules でもハッシュ化されず、アプリ全体に漏れる。 */
.surface h2, .surface h3 { margin: 0; line-height: 1.25; } .surface h2 { font-size: 1.2rem; } .permanentIntro h2 { margin: 9px 0 8px; color: var(--MI_THEME-accent); font-size: clamp(1.7rem, 4vw, 2.125rem); } h3 { font-size: .96rem; }
.preview, .chips > span, .chips > button, .value, .unsaved { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; }
.preview, .value { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); padding: 5px 10px; font-size: .76rem; font-weight: 800; }
.recommended { display: inline-flex; align-items: center; min-block-size: 24px; padding: 3px 12px; border-radius: 999px; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); font-size: .72rem; font-weight: 800; }
.headerActions { display: flex; flex-direction: column; gap: 8px; flex: none; } .previewAction { background: var(--MI_THEME-accent); border-color: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); }
/* 旗鯖fork: Hataskey UI の上部タブと同じ「錠剤型ケース」。
   ⚠️手本は ui/simple.vue の .topPill / .topTabBtn / .topTabActive。
   ⚠️選択中を塗りつぶさないこと。アイコンと文字の色で示す。 */
.chips {
	/* ⚠️幅は中身なりに縮めること。親幅いっぱいに伸ばすと、中身が短いときに
	   ケースの右側だけが余って中身が左上に寄って見える。
	   ⚠️inline-flex では margin:auto が効かないので、flex + fit-content にして
	   margin-inline: auto で中央へ寄せる。 */
	display: flex;
	width: fit-content;
	gap: 2px;
	flex-wrap: nowrap;
	min-width: 0;
	max-width: 100%;
	overflow-x: auto;
	/* ⚠️下に余白を持たせないこと。ヘッダー自身の下padding(20px)と
	   下margin(12px)が既にあり、足すと下だけ44px空いて間延びする。
	   上は直前の文章に接するので12px入れる。 */
	margin: 12px auto 0;
	/* ⚠️スクロールで隠れる位置まで来たら上部に貼り付いて出し続ける。 */
	position: sticky;
	inset-block-start: 8px;
	z-index: 4;
	/* ⚠️貼り付いた瞬間に見た目が飛ばないよう、変化させる値を宣言しておく。 */
	transition: box-shadow 220ms cubic-bezier(.2, .9, .2, 1), background-color 220ms ease;
	padding: 4px;
	box-sizing: border-box;
	border-radius: 9999px;
	background: color-mix(in srgb, var(--MI_THEME-bg) 74%, var(--MI_THEME-panel));
	backdrop-filter: blur(24px) saturate(1.4);
	-webkit-backdrop-filter: blur(24px) saturate(1.4);
	box-shadow: 0 0 0 1px color-mix(in srgb, var(--MI_THEME-divider) 60%, transparent) inset;
	scrollbar-width: none;
}
.chips::-webkit-scrollbar { display: none; } .chips > span, .chips > button { box-sizing: border-box; display: inline-flex; flex: 0 0 auto; min-width: 0; min-height: 40px; max-width: min(100%, 16rem); align-items: center; gap: 6px; padding: 6px 10px; border: 0; border-radius: 9999px; background: transparent; justify-content: center; color: color-mix(in srgb, var(--MI_THEME-fg) 55%, transparent); transition: color 200ms ease, background-color 200ms ease, padding 200ms ease; font-size: .75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .chipLabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* ⚠️選択中は塗りつぶさない。アイコンと文字をアクセント色にし、下地はごく淡く。 */
.chips > button[data-active='true'], .chips > button[data-active='true']:hover {
	background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
	color: var(--MI_THEME-accent);
	font-weight: 750;
	/* ⚠️選択中だけラベルが出るので、その分だけ横に広げる。 */
	padding-inline: 12px 14px;
}
.chips > button[data-active='true'] > i { color: var(--MI_THEME-accent); opacity: 1; }
.chips > button:hover:not([data-active='true']) { color: var(--MI_THEME-fg); background: color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent); }
.card { padding: 18px 20px; margin-top: 12px; }
/* 旗鯖fork: ⚠️outline-offset を正にしないこと。
   カードは器の幅いっぱいなので、外側に描くと左右がはみ出して切られる。
   ⚠️内側へ食い込ませれば、どこにも当たらず途切れない。 */
.card:focus, .basicRows :deep([data-settings-flat-row]):focus {
	outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 54%, transparent);
	outline-offset: -3px;
	border-radius: 16px;
}
.basicTitle { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.basicTitle > span { flex: none; padding: 4px 9px; border-radius: 999px; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); font-size: .72rem; font-weight: 800; }
.basicRows { margin-top: 8px; }
.basicRows > :deep([data-settings-flat-row] + [data-settings-flat-row]) { border-block-start: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 74%, transparent); }
.srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
.rangeRow, .subActions, .footerActions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.rangeRow { margin-top: 12px; } .rangeRow input { flex: 1; min-width: 10rem; accent-color: var(--MI_THEME-accent); }
.surface button { min-block-size: 44px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; background: var(--MI_THEME-panel); color: inherit; padding: 7px 14px; font: inherit; font-size: .84rem; font-weight: 700; cursor: pointer; transition: transform 220ms cubic-bezier(.2,.8,.2,1), background-color 150ms ease, border-color 150ms ease; }
.surface button:hover:not(:disabled) { background: var(--MI_THEME-accentedBg); border-color: var(--MI_THEME-accent); } .surface button:active:not(:disabled) { transform: scale(.98); } .surface button:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 58%, transparent); outline-offset: 3px; } .surface button:disabled { cursor: not-allowed; opacity: .48; }
.save { background: var(--MI_THEME-accent); border-color: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); } .reset { border-style: dashed; }
/* 旗鯖fork: ⚠️flex なので、文章は必ず1つの <span> にまとめること。
   地の文と <b> を直に置くと、かたまりごとに別々の列へ割れて潰れる。 */
.hint > span, .warning > span { min-width: 0; flex: 1; }
.hint > i, .warning > i { flex: none; margin-top: .15em; }
.hint, .warning { display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0; padding: 8px 10px; border-radius: 12px; font-size: .82rem; line-height: 1.55; background: color-mix(in srgb, var(--MI_THEME-accentedBg) 70%, var(--MI_THEME-panel)); }
.warning { color: var(--MI_THEME-warn); } .fieldset { border: 0; padding: 0; margin: 0; min-width: 0; } .fieldset:disabled { opacity: .52; }
.reorderList { display: grid; gap: 7px; margin-top: 12px; } .reorderItem { display: flex; align-items: center; gap: 9px; min-block-size: 44px; padding: 6px 10px; border: 1px solid var(--MI_THEME-divider); border-radius: 14px; background: color-mix(in srgb, var(--MI_THEME-bg) 28%, var(--MI_THEME-panel)); } .reorderItem > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .hidden { opacity: .48; }
.handle { min-inline-size: 44px; padding-inline: 8px; cursor: grab; } .handle:active { cursor: grabbing; }
/* 旗鯖fork: タブで飛んだときに、飛び先が追従タブの下へ潜らないようにする。
   ⚠️scrollIntoView({ block: 'start' }) は容器の最上部に合わせるが、
     そこには貼り付いたタブが居るので必ず覆われる。
   ⚠️内訳: タブの貼り付き位置 8px + タブの高さ 52px + 余白 12px。
     ⚠️タブの高さや貼り付き位置を変えたら、ここも必ず合わせること。 */
.surface[data-mode='permanent'] {
	/* ⚠️避ける量はここ1箇所で決める。タブの高さや貼り付き位置を変えたら必ず直すこと。
	   内訳: 貼り付き位置 8px + タブの高さ 52px + 余白 12px。 */
	--hatasaba-ui2-jump-offset: 72px;
}

/* ⚠️保存バーが出ている間は、その高さ(約60px)ぶんさらに避ける。 */
.surface[data-mode='permanent']:has(.changeBar[data-has-changes='true']) {
	--hatasaba-ui2-jump-offset: 132px;
}

.surface[data-mode='permanent'] .card,
.surface[data-mode='permanent'] [id^='hatasaba-ui2-'] {
	scroll-margin-block-start: var(--hatasaba-ui2-jump-offset, 72px);
}

/* 旗鯖fork: タブの追従。
   ⚠️目印は高さ0。ここが画面から外れた＝タブが本来の位置を離れた、と見なす。 */
.chipsSentinel { height: 0; margin: 0; padding: 0; }

/* 貼り付いている間だけ、浮いて見えるようにする。 */
.chips[data-stuck='true'] {
	background: color-mix(in srgb, var(--MI_THEME-panel) 92%, var(--MI_THEME-bg));
	box-shadow: 0 6px 20px color-mix(in srgb, var(--MI_THEME-fg) 14%, transparent), 0 0 0 1px color-mix(in srgb, var(--MI_THEME-divider) 70%, transparent) inset;
}

@media (prefers-reduced-motion: reduce) {
	.chips { transition: none; }
}

/* 旗鯖fork: 変更が無いときは追従させない。
   ⚠️常に貼り付いていると、何も起きていないのに場所を取り続けて邪魔になる。
   ⚠️変更が入ったら、すっと滑り出して上部へ貼り付く。
   ⚠️保存ボタン自体は常に置いておくこと（無いと「保存できない」と受け取られる）。 */
.changeBar {
	position: static;
	z-index: 3; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; margin: 0 0 12px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 42%, var(--MI_THEME-divider)); border-radius: 16px; background: var(--MI_THEME-panel); box-shadow: 0 6px 18px color-mix(in srgb, var(--MI_THEME-shadow) 12%, transparent); } .changeBarActions { display: flex; flex: none; gap: 8px; align-items: center; }

.changeBar[data-has-changes='true'] {
	position: sticky;
	inset-block-start: 68px;
	animation: changeBarIn 260ms cubic-bezier(.2, .9, .2, 1) backwards;
}

/* ⚠️`backwards` にすること。`both` だと終状態の transform が残り、
   この中の position: fixed（ダイアログ等）の基準を奪う。 */
@keyframes changeBarIn {
	from { opacity: 0; transform: translateY(-10px); }
	to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
	.changeBar[data-has-changes='true'] { animation: none; }
}
.changeBar[data-has-changes='false'] { border-color: var(--MI_THEME-divider); box-shadow: none; }
.changeBar[data-has-changes='false'] .unsaved { color: var(--MI_THEME-fg); opacity: .6; font-weight: 600; }
.footer { position: sticky; inset-block-end: 0; z-index: 2; margin: 18px -20px -18px; padding: 12px 20px max(12px, env(safe-area-inset-bottom)); border-radius: 0 0 22px 22px; border-top: 1px solid var(--MI_THEME-divider); background: color-mix(in srgb, var(--MI_THEME-panel) 92%, transparent); backdrop-filter: blur(12px); }
.footerActions { justify-content: flex-end; margin-inline-start: auto; } .unsaved { color: var(--MI_THEME-warn); font-size: .78rem; font-weight: 700; }
@container (max-width: 520px) {
	.intro, .card { padding: 16px; }
	.surface[data-mode='popup'] .intro, .surface[data-mode='popup'] .card { border-radius: 18px; }
	.permanentIntro .titleRow { flex-direction: column; }
	.headerActions { inline-size: 100%; flex-direction: row; }
	.headerActions button { flex: 1; }
	.footer { margin: 16px -16px -16px; padding-inline: 16px; align-items: stretch; }
	.surface[data-mode='popup'] .footer { border-radius: 0 0 18px 18px; }
	.changeBar { align-items: stretch; flex-direction: column; }
	.changeBarActions, .changeBarActions button { width: 100%; }
	.changeBarActions button { flex: 1; }
	.footer, .footerActions { flex-direction: column; }
	.footerActions, .footerActions button, .reset { width: 100%; }

}
@container (min-width: 681px) and (max-width: 900px) {
	.basicCard { border: 0; padding: 0; background: transparent; box-shadow: none; }
	.basicRows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	.basicRows > :deep([data-settings-flat-row]) { min-height: 72px; padding: 14px; border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 74%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--MI_THEME-bg) 28%, var(--MI_THEME-panel)); }
}
@container (max-width: 680px) {
	.surface { font-size: 14px; }
	.basicRows > :deep([data-settings-flat-row]) { min-height: 56px; }
	/* The compact shell owns the title and preview affordance; keep only the
	 * semantic title for assistive tech and put category chips directly below it. */
	.permanentIntro { border: 0; border-radius: 0; padding: 0 0 8px; background: transparent; box-shadow: none; }
	.permanentIntro .titleRow { min-block-size: 0; }
	.permanentIntro .titleRow > div:first-child { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
	.permanentIntro .headerActions { display: none; }
	/* ⚠️ margin: 0 にすると中央揃えと上余白が潰れる。
	   ⚠️上の定義(margin: 12px auto 0)と必ず揃えること。 */
	.surface[data-mode='permanent'] .chips { flex-wrap: nowrap; overflow-x: auto; margin: 12px auto 0; padding: 4px; scrollbar-width: none; }
	.surface[data-mode='permanent'] .chips > button { flex: none; }
}
.surface[data-motion-enabled='false'] :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; } .surface[data-motion-enabled='false'] button:active:not(:disabled) { transform: none; }
@media (prefers-reduced-motion: reduce) { .surface :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; } button:active:not(:disabled) { transform: none; } }
</style>

<style>
.htkNavDragGhost { opacity: .35; background: var(--MI_THEME-accentedBg) !important; }
</style>
