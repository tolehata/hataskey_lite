/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import type { HatasabaUi2Draft } from '@/composables/use-hatasaba-ui2-draft.js';
import draftSource from '../../composables/use-hatasaba-ui2-draft.ts?raw';
import popupSource from '../../components/MkHatasabaUi2EditWindow.vue?raw';
import bodySource from '../../components/HatasabaUi2SettingsBody.vue?raw';
import surfaceSource from './HatasabaUi2SettingsSurface.vue?raw';
import previewSource from '../../components/MkHatasabaUi2PreviewWindow.vue?raw';
import immediateSource from '../../components/HatasabaUi2ImmediateSettings.vue?raw';

const config = vi.hoisted(() => ({ ui: 'simple' }));
vi.mock('@@/js/config.js', async importOriginal => ({
	...await importOriginal<typeof import('@@/js/config.js')>(),
	get ui() { return config.ui; },
}));
vi.mock('vuedraggable', () => ({ default: defineComponent({
	props: { modelValue: { type: Array, required: true } },
	template: '<div><template v-for="(item, index) in modelValue" :key="item.id"><slot name="item" :element="item" :index="index"/></template></div>',
}) }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: defineComponent({
	props: { flat: Boolean },
	template: '<div :data-flat="flat"><slot name="label"/><slot name="caption"/></div>',
}) }));
vi.mock('@/i18n.js', () => ({ i18n: {
	ts: { recommended: '推奨', _hata: { _settingsRedesign: { ui2: {
		recommendedInUse: '推奨・使用中', permanentDescriptionBefore: '通常表示とデッキ表示を1つで兼ねる、旗池2丁目の標準UIです。ここでの変更は', permanentDescriptionSave: '保存を押すまで反映されません', permanentDescriptionAfter: '。',
		openPreview: 'プレビューを開く', livePreview: 'ライブプレビュー', categoryLabel: 'Hataskey UI の設定カテゴリ', chipNavigation: 'ナビ', chipGlass: 'ガラス', chipGlassAndBlur: 'ガラスとぼかし', chipNote: 'ノート', chipDeck: 'デッキ', chipSideMenu: 'サイドメニュー', chipFoldable: '折りたたみ端末', chipDevice: '端末', discard: '破棄', saveAndReload: '保存して再読み込み', reorderKeyboardHint: '上・下矢印キーで並べ替えできます',
	} } } },
	tsx: { _hata: { _settingsRedesign: { ui2: {
		unsavedChanges: ({ count }: { count: number }) => '未保存の変更が' + count + '件あります',
		showNavItem: ({ label }: { label: string }) => label + 'を表示',
		reorderNavItem: ({ label }: { label: string }) => label + 'を上または下へ移動',
		basicItemCount: ({ count }: { count: number }) => count + '項目',
	} } } },
} }));
import HatasabaUi2SettingsBody from '@/components/HatasabaUi2SettingsBody.vue';

function bodyEditorFixture() {
	const action = vi.fn();
	return {
		copy: {
			windowTitle: '編集ウィンドウ', hintBeforeCompare: '', hintCompare: '', hintAfterCompare: '', hintSave: '', hintAfterSave: '',
			basic: '基本', showTrendingTab: 'トレンド', showTrendingTabCaption: '', showHatadyTab: 'Hatady', showHatadyTabCaption: '', showMenuAtTop: 'メニュー', showMenuAtTopCaption: '', deckOnlyNote: '',
			ignoreDeckWidth: '幅', ignoreDeckWidthCaption: '', deviceSpecificSetting: '', swipeTabs: 'スワイプ', swipeTabsCaption: '', thisDeviceOnly: '', savedSuffix: '',
			replayDeckTutorial: 'チュートリアル', replayHintBefore: '', replayHintDeck: '', replayHintAfter: '', glassOpacity: '透過率', onlyWhenUi2Enabled: '', opacityDescriptionBefore: '', opacityTerm: '', opacityDescriptionAfter: '', restoreOpacity: '戻す',
			ui2Name: 'UI2', ui2DescriptionBefore: '', alwaysEnabled: '', ui2DescriptionAfter: '', showBubbleDesign: '吹き出し', showBubbleDesignCaption: '', headerImageBlur: 'ぼかし', disableTimelineHeaderBlur: 'タイムライン', disableTimelineHeaderBlurCaption: '', noLivePreviewNote: '', disableProfileHeaderBlur: 'プロフィール', disableProfileHeaderBlurCaption: '',
			noteDisplayDeck: 'ノート', enableSimpleNotesInDeck: '簡易', enableSimpleNotesInDeckCaption: '', topNavSection: '上部ナビ', resetOrder: '順序を戻す', topNavReorderHint: '', dragToReorder: '移動', bottomNavSection: '下部ナビ', bottomNavUnavailableBefore: '', mobileNarrow: '', bottomNavUnavailableAfter: '', openOnPhone: '', sideMenuSection: 'サイド', sideStudioName: '', sideStudioDescription: '', openSideStudio: 'スタジオ', openLegacyReorder: '旧編集',
			resetDefaults: '初期値に戻す', unsavedChanges: '未保存', close: '閉じる', save: '保存',
		},
		copyx: { bottomNavReorderHint: () => '', maxVisibleItems: () => '' },
		draft: { editedShowTrendingTab: false, editedShowHatadyTab: false, editedTopNavMode: false, editedDeckIgnoreWidth: false, editedTabSwipeEnabled: false, editedGlassUi: true, editedOpacity: 55, editedGlassUiBubble: false, editedNormalNoBannerBg: false, editedProfileNoBannerBg: false, editedDisableBubbleInHatasabaDeck: false, editedTopNav: [{ id: 'home', icon: 'ti ti-home', visible: true }, { id: 'search', icon: 'ti ti-search', visible: true }], editedBottomNav: [{ id: 'home', icon: 'ti ti-home', visible: true }, { id: 'search', icon: 'ti ti-search', visible: true }] },
		hasChanges: true, hasNavChanges: false, changeCount: 2, HATASABA_BOTTOM_NAV_MAX: 4, isHatasabaDeckActive: false, isBottomNavVisible: true,
		onOpacityInput: action, setOpacity: action, setGlassUi: action, setGlassUiBubble: action, setProfileNoBannerBg: action, resetToDefault: action, resetTopNav: action, resetBottomNav: action, setTopNavVisible: action, setBottomNavVisible: action, moveTopNav: vi.fn(() => true), moveBottomNav: vi.fn(() => true), navDisplayLabel: () => 'ホーム', openSidebarEditDialog: action, onReplayDeckTutorial: action, save: () => false, discard: vi.fn(async () => true), resetDraftToSnapshot: action, restoreLivePreviewToSnapshot: action,
	} as unknown as HatasabaUi2Draft;
}

function mountBody(mode: 'permanent' | 'popup' = 'permanent', onPreview = vi.fn(), onClose = vi.fn()) {
	const editor = bodyEditorFixture();
	const app = createApp(defineComponent({
		setup() {
			return () => h(HatasabaUi2SettingsBody, { editor, mode, motionEnabled: false, onPreview, onClose });
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	return { editor, container, onPreview, onClose, unmount: () => { app.unmount(); container.remove(); } };
}

const mountPermanentBody = (onPreview = vi.fn(), onClose = vi.fn()) => mountBody('permanent', onPreview, onClose);

describe('Hataskey UI editor shared draft contract', () => {
	test('shared body compiles as a component instead of only being source-inspected', () => {
		expect(HatasabaUi2SettingsBody).toBeTruthy();
	});

	test('permanent mode renders the exact 2a header and forwards its real preview request without changing draft state', async () => {
		const mounted = mountPermanentBody();
		const text = mounted.container.textContent ?? '';
		expect(text).toContain('推奨・使用中');
		expect(text).toContain('Hataskey UI');
		expect(text).toContain('通常表示とデッキ表示を1つで兼ねる、旗池2丁目の標準UIです。ここでの変更は保存を押すまで反映されません。');
		expect(text).toContain('プレビューを開く');
		expect(text).toContain('初期値に戻す');
		expect(mounted.container.querySelector('.settingsBrand')).not.toBeNull();
		expect(bodySource).toContain('role="status"');
		expect(bodySource).not.toContain('@wheel.prevent');
		expect(bodySource).toContain('data-settings-horizontal-scroll');
		expect(bodySource).toContain('@wheel="onCategoryWheel"');
		expect(bodySource).toContain('event.deltaX !== 0 ? event.deltaX : event.deltaY');
		expect(bodySource).toContain('element.scrollWidth - element.clientWidth');
		expect(bodySource).toContain('if (nextScrollLeft === element.scrollLeft) return;');
		expect(bodySource).toContain('event.preventDefault();');
		expect(bodySource).toContain('element.scrollLeft = nextScrollLeft;');
		expect(bodySource).toContain('.chipLabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }');
		const preview = [...mounted.container.querySelectorAll('button')].find(button => button.textContent?.includes('プレビューを開く'));
		preview?.click();
		await nextTick();
		expect(mounted.onPreview).toHaveBeenCalledTimes(1);
		expect(mounted.editor.resetToDefault).not.toHaveBeenCalled();
		mounted.unmount();
	});

	test.each([
		['simple', '推奨・使用中'],
		['hataskey3', '推奨'],
		['deck', '推奨'],
	])('shared PC/mobile permanent header shows the active UI accurately when ui is %s', (ui, expectedBadge) => {
		config.ui = ui;
		const mounted = mountPermanentBody();
		try {
			const badge = mounted.container.querySelector('header span[class*=recommended]');
			expect(badge?.textContent).toBe(expectedBadge);
			expect(mounted.container.textContent?.includes('使用中')).toBe(ui === 'simple');
		} finally {
			mounted.unmount();
			config.ui = 'simple';
		}
	});

	test('permanent mode keeps its category chips outside the intro card and renders the basic five as one flat group', () => {
		const mounted = mountPermanentBody();
		const intro = mounted.container.querySelector('header')!;
		// 旗鯖fork: ⚠️タブはヘッダーの**外**に置くこと。
		//   position: sticky は直近の親の中でしか効かないため、ヘッダー内に置くと
		//   そこを抜けた時点で流れて画面外へ消える（実機で -423px を確認）。
		expect(intro.querySelector('nav[aria-label="Hataskey UI の設定カテゴリ"]')).toBeNull();
		const outsideChips = mounted.container.querySelector('nav[aria-label="Hataskey UI の設定カテゴリ"]');
		expect(outsideChips).not.toBeNull();
		expect(outsideChips!.closest('header')).toBeNull();
		const basic = mounted.container.querySelector('#hatasaba-ui2-basic')!.closest('section')!;
		expect(basic.textContent).toContain('基本');
		expect(basic.textContent).toContain('5項目');
		expect(basic.querySelectorAll('[data-flat="true"]')).toHaveLength(5);
		expect(bodySource.match(/:flat="mode === 'permanent'"/gu)).toHaveLength(5);
		expect(bodySource).toContain(':deep([data-settings-flat-row] + [data-settings-flat-row])');
		mounted.unmount();
	});

	test('permanent mode renders a top sticky change bar and keeps popup footer labels out', async () => {
		const mounted = mountPermanentBody();
		const changeBar = mounted.container.querySelector('[class*=changeBar]');
		const status = changeBar?.querySelector('[role="status"]');
		expect(changeBar).not.toBeNull();
		expect(status).not.toBeNull();
		expect(status?.textContent).toContain('未保存の変更が2件あります');
		expect(changeBar?.textContent).toContain('破棄');
		expect(changeBar?.textContent).toContain('保存して再読み込み');
		expect(changeBar?.textContent).not.toContain('閉じる');
		expect(changeBar?.getAttribute('role')).toBeNull();
		expect(mounted.container.querySelector('footer')).toBeNull();
		const discard = [...(changeBar?.querySelectorAll('button') ?? [])].find(button => button.textContent?.includes('破棄'));
		discard?.click();
		await nextTick();
		expect(mounted.editor.discard).toHaveBeenCalledTimes(1);
		expect(mounted.onClose).toHaveBeenCalledTimes(1);
		mounted.unmount();
	});

	test('compact permanent mode leaves title and preview to the shell, keeps scrollable category pills, and moves save controls to the change bar', () => {
		expect(bodySource).toContain('@container (max-width: 680px)');
		expect(bodySource).toContain('.permanentIntro { border: 0; border-radius: 0; padding: 0 0 8px; background: transparent; box-shadow: none; }');
		expect(bodySource).toContain('.permanentIntro .titleRow > div:first-child { position: absolute; width: 1px; height: 1px; overflow: hidden;');
		expect(bodySource).toContain('.permanentIntro .headerActions { display: none; }');
		// 旗鯖fork: ⚠️margin: 0 にすると中央揃えと上余白が潰れる。
		//   基本の定義(margin: 12px auto 0)と必ず揃えること。
		// 旗鯖fork: ⚠️タブはヘッダーの外に出した。position: sticky は直近の親の中でしか
		//   効かず、ヘッダー内だとそこを抜けた時点で流れて画面外へ消えるため。
		expect(bodySource).toContain("[data-mode='permanent'] .chips { flex-wrap: nowrap; overflow-x: auto; margin: 12px auto 0;");
		// 旗鯖fork: ⚠️変更が無いときは追従させない。常に貼り付いていると
		//   何も起きていないのに場所を取り続けて邪魔になる。
		//   ⚠️変更が入ったときだけ sticky にし、すっと滑り出す。
		expect(bodySource).toContain('.changeBar {\n\tposition: static;');
		expect(bodySource).toContain(".changeBar[data-has-changes='true'] {\n\tposition: sticky;");
		expect(bodySource).toContain('.changeBarActions, .changeBarActions button { width: 100%; }');
		expect(bodySource).not.toContain('.permanentFooter');
		expect(bodySource).toContain(':data-mode="mode"');
		expect(bodySource).not.toContain('data-mode=\'permanent\'] .footer');
		expect(bodySource).toContain('<footer v-if="mode === \'popup\'"');
		expect(bodySource).toContain('.surface[data-mode=\'popup\'] .intro, .surface[data-mode=\'popup\'] .card { border-radius: 18px; }');
	});

	test('permanent category chips preserve native keyboard focus and move only to their exact section', async () => {
		const mounted = mountPermanentBody();
		const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
		const scrollIntoView = vi.fn();
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
		try {
			const chips = [...mounted.container.querySelectorAll<HTMLButtonElement>('nav[aria-label="Hataskey UI の設定カテゴリ"] button')];
			// 旗鯖fork: ⚠️非選択はアイコンのみ（Hataskey UI の上部ナビバーと同じ）。
			//   文字が出るのは選択中の1つだけ。
			expect(chips.map(chip => chip.textContent?.trim())).toEqual(['ナビ', '', '', '', '', '']);
			// ⚠️アイコンだけでも何のタブか分かること。読み上げでも失わせない。
			expect(chips.map(chip => chip.getAttribute('aria-label'))).toEqual(['ナビ', 'ガラスとぼかし', 'ノート', 'デッキ', 'サイドメニュー', '折りたたみ端末']);
			const glassChip = chips.find(chip => chip.getAttribute('aria-label') === 'ガラスとぼかし')!;
			expect(glassChip.tagName).toBe('BUTTON');
			expect(glassChip.getAttribute('aria-controls')).toBe('hatasaba-ui2-glass-and-blur');
			expect(chips[0]?.getAttribute('aria-current')).toBe('true');
			expect(chips[0]?.getAttribute('data-active')).toBe('true');
			glassChip.focus();
			expect(window.document.activeElement).toBe(glassChip);
			glassChip.click();
			await nextTick();
			const destination = mounted.container.querySelector<HTMLElement>('#hatasaba-ui2-glass-and-blur')!;
			expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
			expect(window.document.activeElement).toBe(destination);
			expect(glassChip.getAttribute('aria-current')).toBe('true');
			expect(glassChip.getAttribute('data-active')).toBe('true');
			expect(chips[0]?.getAttribute('data-active')).toBe('false');
			expect(mounted.editor.resetToDefault).not.toHaveBeenCalled();
		} finally {
			Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView });
			mounted.unmount();
		}
	});

	test('drag handles expose the arrow-key alternative and delegate only valid moves to the draft editor', async () => {
		const mounted = mountPermanentBody();
		const topHandles = mounted.container.querySelector('#hatasaba-ui2-top-nav')!.closest('section')!.querySelectorAll<HTMLElement>('.htkNavDragHandle');
		const bottomHandles = mounted.container.querySelector('#hatasaba-ui2-bottom-nav')!.closest('section')!.querySelectorAll<HTMLElement>('.htkNavDragHandle');
		expect(topHandles).toHaveLength(2);
		expect(bottomHandles).toHaveLength(2);
		expect(topHandles[0]?.getAttribute('aria-keyshortcuts')).toBe('ArrowUp ArrowDown');
		expect(topHandles[0]?.getAttribute('aria-describedby')).toBe('hatasaba-ui2-top-nav-reorder-help');
		topHandles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		bottomHandles[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await nextTick();
		expect(mounted.editor.moveTopNav).toHaveBeenCalledWith(0, 1);
		expect(mounted.editor.moveBottomNav).toHaveBeenCalledWith(1, -1);
		topHandles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(mounted.editor.moveTopNav).toHaveBeenCalledTimes(1);
		expect(bodySource).toContain('async function onReorderKeydown');
		expect(bodySource).toContain('copy.ui2.reorderKeyboardHint');
		mounted.unmount();
	});

	test('permanent surface owns the new shared body while the legacy popup retains its original FormSection DOM', () => {
		expect(popupSource).not.toContain('HatasabaUi2SettingsBody');
		expect(popupSource).toContain('<FormSection first>');
		// ⚠️同上。窓の道が消えていないことを差し替え式のまま見張る。
		expect(popupSource).toContain('<component :is="embedded ? SettingsEmbeddedWindow : MkWindow"');
		expect(popupSource.match(/<FormSection/g)).toHaveLength(8);
		expect(surfaceSource).toContain('<HatasabaUi2SettingsBody :editor="editor"');
		expect(bodySource).toContain('mode === \'permanent\'');
		expect(surfaceSource).toContain('inline-size: 100%;');
		expect(surfaceSource).toContain('max-inline-size: none;');
		expect(surfaceSource).not.toContain('max-inline-size: 820px;');
	});

	test('draft state is created before the explicit save path', () => {
		const saveStart = draftSource.indexOf('function save(): boolean');
		const commitStart = draftSource.indexOf('prefer.commit(\'simpleUi.normalNoBannerBg\'', saveStart);
		const draftStart = draftSource.indexOf('const draft = reactive');
		expect(saveStart).toBeGreaterThan(draftStart);
		expect(commitStart).toBeGreaterThan(saveStart);
		expect(draftSource).toContain('function normalizeNavItems(items: NavItem[], defaults: NavItem[]): PersistedNavItem[]');
		expect(draftSource).toContain('const topNavDefaults = clone(getInitialPrefValue(\'simpleUi.topNav\')) as NavItem[]');
		expect(draftSource).toContain('const bottomNavDefaults = clone(getInitialPrefValue(\'simpleUi.bottomNav\')) as NavItem[]');
	});

	test('discard, popup X, and permanent unmount restore preview instead of committing', () => {
		expect(draftSource).toContain('async function discard(): Promise<boolean>');
		expect(draftSource).toContain('restoreLivePreviewToSnapshot();');
		expect(popupSource).toContain('function onWindowClosed()');
		expect(popupSource).toContain('restoreLivePreviewToSnapshot();');
		expect(surfaceSource).toContain('reducedMotionQuery?.addEventListener(\'change\', syncReducedMotion)');
		expect(surfaceSource).toContain('reducedMotionQuery?.removeEventListener(\'change\', syncReducedMotion)');
		expect(surfaceSource).toContain('async function requestDiscard(): Promise<boolean>');
		expect(surfaceSource).toContain('defineExpose({ requestDiscard, rollback, hasChanges, openPreview });');
	});

	test('the legacy side-studio launcher still closes the popup, while the permanent surface only requests navigation', () => {
		expect(bodySource).toContain('emit(\'sideStudio\')');
		expect(popupSource).toContain('function openHataSideStudio()');
		expect(popupSource).toContain('@click="openHataSideStudio"');
		expect(popupSource).toContain('dialog.value?.close();');
		expect(popupSource).toContain('mainRouter.push(\'/hata-side-studio\');');
		expect(surfaceSource).toContain('@sideStudio="emit(\'sideStudio\')"');
		expect(surfaceSource).not.toContain('mainRouter.push(\'/hata-side-studio\')');
	});

	test('permanent mode suppresses all child motion and keeps popup compatibility explicit', () => {
		expect(surfaceSource).toContain('mode="permanent"');
		expect(surfaceSource).toContain('@preview="openPreview"');
		expect(surfaceSource).toContain('const previewOpen = ref(false);');
		expect(surfaceSource).toContain('<MkHatasabaUi2PreviewWindow v-if="previewOpen" :editor="editor"');
		expect(surfaceSource).toContain('<HatasabaUi2ImmediateSettings :motionEnabled="motionEnabled"/>');
		expect(popupSource).toContain('<FormSection first>');
		expect(bodySource).toContain('min-block-size: 44px');
		expect(bodySource).toContain('.surface[data-motion-enabled=\'false\'] :deep(*)');
		expect(bodySource).toContain('@media (prefers-reduced-motion: reduce)');
		expect(bodySource).toContain(':animation="draggableAnimation"');
		expect(bodySource).toContain('function navVisibilityLabel(item: Parameters<HatasabaUi2Draft[\'navDisplayLabel\']>[0]): string');
		expect(bodySource).toContain('{{ navVisibilityLabel(item) }}');
		expect(bodySource).toContain('copyx.ui2.showNavItem');
		expect(bodySource).toContain('copyx.ui2.unsavedChanges');
		expect(bodySource).toContain('{{ copy.ui2.discard }}');
		expect(bodySource).toContain('{{ copy.ui2.saveAndReload }}');
		expect(bodySource).toContain('mode === \'permanent\' && $style.basicCard');
		expect(bodySource).toContain('.basicCard { border: 0; padding: 0; background: transparent; box-shadow: none; }');
		expect(draftSource).toContain('function resetDraftToSnapshot(): void');
		expect(draftSource).toContain('resetDraftToSnapshot();');
		expect(draftSource).toContain('setGlassUi(draft.editedGlassUi);');
	});

	test('preview consumes the surface editor object without opening a second draft or writing persistence', () => {
		expect(previewSource).toContain('editor: HatasabaUi2Draft;');
		expect(previewSource).toContain('props.editor.draft');
		expect(previewSource).not.toContain('useHatasabaUi2Draft');
		expect(previewSource).not.toContain('prefer.commit');
		expect(previewSource).not.toContain('miLocalStorage');
		expect(previewSource).toContain('@closed="emit(\'closed\')"');
	});

	test('permanent immediate companion preserves the existing device and profile persistence contracts outside the buffered footer', () => {
		expect(immediateSource).toContain('prefer.model(\'hataBranding.useHatakyu\')');
		expect(immediateSource).toContain('set: (value: HataFoldableMode) => setFoldableLayoutMode(value)');
		expect(immediateSource).toContain('redesignCopy.immediate.deviceImmediate');
		expect(immediateSource).toContain('redesignCopy.immediate.profileImmediate');
		expect(immediateSource).toContain('id="hatasaba-ui2-foldable"');
		expect(immediateSource).toContain('data-settings-search-group-id="settings.group.hatasaba-ui2-immediate-foldable"');
		expect(immediateSource).toContain('min-block-size: 44px');
		expect(immediateSource).toContain('@container (max-width: 520px) { .intro, .group { border-radius: 22px; padding: 16px; }');
		expect(immediateSource).not.toContain('@container (max-width: 520px) { .intro, .group { border-radius: 18px;');
	});
});
