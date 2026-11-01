/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import type { HatasabaUi2Draft } from '@/composables/use-hatasaba-ui2-draft.js';

vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});

// 旗鯖fork: プレビューはウィンドウではなくモーダルになった。
// ⚠️MkWindow は initialWidth=680 の固定幅で、モバイルで必ずはみ出していた。
vi.mock('@/components/MkModal.vue', () => ({
	default: defineComponent({
		emits: ['closed', 'click'],
		setup(_, { emit, slots, expose }) {
			expose({ close: () => emit('closed') });
			return () => h('section', { 'data-preview-window': '' }, [slots.default?.()]);
		},
	}),
}));

import MkHatasabaUi2PreviewWindow from './MkHatasabaUi2PreviewWindow.vue';
import previewSource from './MkHatasabaUi2PreviewWindow.vue?raw';

function editorFixture(): HatasabaUi2Draft {
	const write = vi.fn();
	return reactive({
		copy: undefined,
		copyx: undefined,
		draft: {
			editedGlassUi: true,
			editedGlassUiBubble: false,
			editedNormalNoBannerBg: false,
			editedProfileNoBannerBg: false,
			editedOpacity: 55,
			editedDisableBubbleInHatasabaDeck: false,
			editedShowTrendingTab: true,
			editedTopNavMode: false,
			editedDeckIgnoreWidth: false,
			editedTabSwipeEnabled: true,
			editedTopNav: [{ id: 'home', icon: 'ti ti-home', label: 'ホーム', visible: true }],
			editedBottomNav: [{ id: 'home', icon: 'ti ti-home', label: 'ホーム', visible: true }],
		},
		hasChanges: false,
		hasNavChanges: false,
		changeCount: 0,
		HATASABA_BOTTOM_NAV_MAX: 4,
		isBottomNavVisible: true,
		isHatasabaDeckActive: false,
		navDisplayLabel: (item: { label?: string; id: string }) => item.label ?? item.id,
		onOpacityInput: write,
		setOpacity: write,
		setGlassUi: write,
		setGlassUiBubble: write,
		setProfileNoBannerBg: write,
		resetToDefault: write,
		resetTopNav: write,
		resetBottomNav: write,
		setTopNavVisible: write,
		setBottomNavVisible: write,
		moveTopNav: vi.fn(() => false),
		moveBottomNav: vi.fn(() => false),
		openSidebarEditDialog: write,
		onReplayDeckTutorial: write,
		save: write,
		discard: vi.fn(async () => true),
		resetDraftToSnapshot: write,
		restoreLivePreviewToSnapshot: write,
	} as unknown as HatasabaUi2Draft);
}

describe('MkHatasabaUi2PreviewWindow', () => {
	test('gets all user-facing preview copy from the settings redesign namespace', () => {
		for (const literal of [
			'編集中の設定を表示しています。ここでの操作は保存されません',
			'タイムラインタブのプレビュー',
			'デッキ表示',
			'通常表示',
			'設定値は保存するまで変更されません',
			'閉じる',
		]) {
			expect(previewSource).not.toContain(literal);
		}
		expect(previewSource).toContain('copy.ui2.preview.liveNotice');
		expect(previewSource).toContain('const previewTitle = computed');
		expect(previewSource).toContain('<span v-if="previewTitle.brand" class="settingsBrand">');
		// 旗鯖fork: ⚠️プレビューは実物(ui/simple.vue)の骨格を縮めて写したもの。
		//   ⚠️どれか1つでも欠けると「何の設定を見ているのか」が伝わらなくなる。
		// 旗鯖fork: ⚠️手本は MkUISetup.vue の Hataskey UI モック（.phone / .deckWrap）。
		//   ⚠️部品を落とすと手本と食い違い、「どちらが本当の Hataskey UI か」が分からなくなる。
		for (const part of ['$style.phone', '$style.phonePill', '$style.phonePillActive', '$style.phoneNote', '$style.phoneAvatar', '$style.noteActions', '$style.phoneNav', '$style.phoneFab', '$style.deckWrap', '$style.deckCol']) {
			expect(previewSource).toContain(part);
		}
		// ⚠️寸法は手本の値をそのまま使う。
		expect(previewSource).toContain('width: 152px;');
		expect(previewSource).toContain('height: 238px;');
		expect(previewSource).toContain('.deckWrap { display: flex; width: 220px; height: 196px; gap: 6px; }');
		// ⚠️吹き出しは本文の棒だけを包む。ノート全体を包むと実物と形が違う。
		expect(previewSource).toContain(".appPreview[data-bubble='on'] .noteLines {");
		// 旗鯖fork: ⚠️透過率は百分率(例 55%)で渡る。100 で割らないこと。
		//   割ると 0.55% になり、面がほぼ透明のまま変化が見えなくなる（実測: alpha 0.004）。
		expect(previewSource).toContain('calc(var(--preview-opacity) * .85)');
		expect(previewSource).not.toContain('var(--preview-opacity) / 100');
	});

	test('renders the supplied live editor state and closes without a write', async () => {
		const editor = editorFixture();
		const onClosed = vi.fn();
		const app = createApp(defineComponent({
			setup() {
				return () => h(MkHatasabaUi2PreviewWindow, { editor, motionEnabled: false, onClosed });
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);

		// ⚠️Teleport で body 直下へ出るため、mount 先ではなく body を見る。
		//   ここが container のままだと、正しく動いていても空に見えて落ちる。
		expect(window.document.body.textContent).toContain('Hataskey UI プレビュー');
		// 旗鯖fork: ⚠️手本は MkUISetup の Hataskey UI モック。
		//   スマホの器に「上部の錠剤ナビ」と「下部ナビ」が両方入る形。
		expect(window.document.body.querySelector('[aria-label="タイムラインタブのプレビュー"]')).toBeTruthy();
		expect(window.document.body.querySelector('[aria-label="下部ナビゲーションのプレビュー"]')).toBeTruthy();
		expect(window.document.body.querySelector('[data-glass]')?.getAttribute('data-glass')).toBe('on');
		editor.draft.editedOpacity = 31;
		editor.draft.editedGlassUiBubble = true;
		editor.draft.editedDeckIgnoreWidth = true;
		await nextTick();
		const preview = window.document.body.querySelector<HTMLElement>('[data-glass]')!;
		expect(preview.style.getPropertyValue('--preview-opacity')).toBe('31%');
		expect(preview.getAttribute('data-bubble')).toBe('on');
		expect(preview.getAttribute('data-deck')).toBe('on');

		// ⚠️デッキにすると、スマホの器ではなく列が並ぶ姿に変わる。
		expect(window.document.body.querySelector('[aria-label="ノート表示のプレビュー"]')).toBeTruthy();

		const close = [...window.document.body.querySelectorAll('button')].find(button => button.textContent?.includes('閉じる'))!;
		close.click();
		await nextTick();
		expect(onClosed).toHaveBeenCalledTimes(1);
		expect(editor.save).not.toHaveBeenCalled();
		expect(editor.setOpacity).not.toHaveBeenCalled();
		expect(editor.setGlassUi).not.toHaveBeenCalled();
		expect(editor.setGlassUiBubble).not.toHaveBeenCalled();

		app.unmount();
		container.remove();
	});
});
