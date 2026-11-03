/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h } from 'vue';

const fixture = vi.hoisted(() => {
	const commits: Array<[string, unknown]> = [];
	const copy = {
		resetDefaults: '初期値に戻す', resetAllConfirm: 'reset', resetTopNavConfirm: 'top', resetBottomNavConfirm: 'bottom',
		navHome: 'ホーム', navLocal: 'ローカル', navSocial: 'ソーシャル', navGlobal: 'グローバル', navSearch: '検索', navNotifications: '通知', navCustomFeatures: '独自', navWidgets: 'ウィジェット',
		savedReloading: '保存しました', saveFailedTitle: '失敗', tryAgain: '再試行', discardChangesTitle: '破棄', discardChangesText: '破棄しますか',
	};
	return {
		commits,
		confirm: vi.fn(async () => ({ canceled: false })),
		toast: vi.fn(), alert: vi.fn(), popup: vi.fn(() => ({ dispose: vi.fn() })),
		setGlassUiLocal: vi.fn(), setGlassUiBubbleLocal: vi.fn(), setDeckIgnoreWidth: vi.fn(), setTabSwipeEnabled: vi.fn(),
		prefer: {
			r: {
				'simpleUi.normalNoBannerBg': { value: false }, 'simpleUi.profileNoBannerBg': { value: false }, 'simpleUi.glassUiCardOpacity': { value: 55 },
				'simpleUi.disableBubbleInHatasabaDeck': { value: false }, 'simpleUi.showTrendingTab': { value: true }, 'simpleUi.topNavMode': { value: false }, 'simpleUi.deckMode': { value: false },
			},
			s: {
				'simpleUi.topNav': [{ id: 'home', visible: true }, { id: 'search', visible: true }],
				'simpleUi.bottomNav': [{ id: 'home', visible: true }, { id: 'search', visible: true }],
			},
			commit: (key: string, value: unknown) => commits.push([key, value]),
		},
		copy,
	};
});

vi.mock('@/preferences.js', () => ({ prefer: fixture.prefer }));
vi.mock('@/preferences/def.js', () => ({ PREF_DEF: {
	'simpleUi.normalNoBannerBg': { default: false }, 'simpleUi.profileNoBannerBg': { default: false }, 'simpleUi.glassUiCardOpacity': { default: 55 },
	'simpleUi.disableBubbleInHatasabaDeck': { default: false }, 'simpleUi.showTrendingTab': { default: true }, 'simpleUi.topNavMode': { default: false },
} }));
vi.mock('@/preferences/manager.js', () => ({ getInitialPrefValue: (key: string) => fixture.prefer.s[key as keyof typeof fixture.prefer.s] ?? [] }));
vi.mock('@/utility/hatasaba-device-prefs.js', () => ({
	glassUiLocal: { value: true }, glassUiBubbleLocal: { value: false }, deckIgnoreWidth: { value: false }, tabSwipeEnabled: { value: true },
	setGlassUiLocal: fixture.setGlassUiLocal, setGlassUiBubbleLocal: fixture.setGlassUiBubbleLocal, setDeckIgnoreWidth: fixture.setDeckIgnoreWidth, setTabSwipeEnabled: fixture.setTabSwipeEnabled,
}));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: { getItem: () => 'simple' } }));
vi.mock('@/os.js', () => ({ confirm: fixture.confirm, toast: fixture.toast, alert: fixture.alert, popup: fixture.popup }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _hatasabaUi: { _editWindow: fixture.copy } } }, tsx: { _hata: { _hatasabaUi: { _editWindow: {
	bottomNavReorderHint: ({ max }: { max: number }) => `${max}`, maxVisibleItems: ({ max }: { max: number }) => `${max}`, tryAgainWithDetails: ({ details }: { details: string }) => details,
} } } } } }));

import { useHatasabaUi2Draft } from './use-hatasaba-ui2-draft.js';

function mountEditor() {
	let editor: ReturnType<typeof useHatasabaUi2Draft> | undefined;
	const app = createApp(defineComponent({
		setup() {
			editor = useHatasabaUi2Draft();
			return () => h('div');
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	return {
		editor: editor!,
		unmount: () => { app.unmount(); container.remove(); },
	};
}

afterEach(() => {
	fixture.commits.splice(0);
	fixture.confirm.mockClear();
	fixture.setGlassUiLocal.mockClear();
	fixture.setGlassUiBubbleLocal.mockClear();
	window.document.documentElement.removeAttribute('style');
	window.document.documentElement.className = '';
});

describe('useHatasabaUi2Draft', () => {
	test('drops the retired app items from the bottom navigation before saving', () => {
		vi.useFakeTimers();
		const original = fixture.prefer.s['simpleUi.bottomNav'];
		fixture.prefer.s['simpleUi.bottomNav'] = [
			{ id: 'hatask', visible: false }, { id: 'hatady', visible: true }, { id: 'hatafeed', visible: true }, { id: 'hatagoes', visible: true }, { id: 'search', visible: true },
		];
		try {
			const { editor, unmount } = mountEditor();
			expect(editor.draft.editedBottomNav.map(item => item.id)).toEqual(['search']);
			editor.draft.editedBottomNav[0]!.visible = false;
			expect(editor.save()).toBe(true);
			const saved = fixture.commits.find(([key]) => key === 'simpleUi.bottomNav')?.[1] as { id: string; visible: boolean }[];
			expect(saved.map(item => item.id)).toEqual(['search']);
			expect(saved[0]?.visible).toBe(false);
			unmount();
		} finally {
			fixture.prefer.s['simpleUi.bottomNav'] = original;
			vi.clearAllTimers();
			vi.useRealTimers();
		}
	});
	test('editing and reset remain draft/preview-only until save', async () => {
		const { editor, unmount } = mountEditor();
		editor.setGlassUi(false);
		editor.draft.editedOpacity = 31;
		editor.setOpacity(31);
		expect(editor.hasChanges).toBe(true);
		expect(window.document.documentElement.style.getPropertyValue('--htk-glass-card-opacity')).toBe('31%');
		expect(fixture.commits).toEqual([]);

		await editor.resetToDefault();
		expect(fixture.commits).toEqual([]);
		expect(editor.draft.editedOpacity).toBe(55);
		expect(editor.draft.editedGlassUi).toBe(true);
		expect(window.document.documentElement.classList.contains('hataGlassUi')).toBe(true);
		unmount();
	});

	test('discard rolls preview back without persistence and save commits cloned nav once', async () => {
		vi.useFakeTimers();
		const { editor, unmount } = mountEditor();
		editor.setGlassUiBubble(true);
		editor.draft.editedTopNav[0]!.visible = false;
		expect(await editor.discard()).toBe(true);
		expect(window.document.documentElement.classList.contains('hataGlassUiBubble')).toBe(false);
		expect(editor.draft.editedTopNav[0]!.visible).toBe(true);
		expect(editor.changeCount).toBe(0);
		expect(fixture.commits).toEqual([]);

		editor.draft.editedTopNav[0]!.visible = false;
		expect(editor.save()).toBe(true);
		expect(fixture.commits.filter(([key]) => key === 'simpleUi.topNav')).toHaveLength(1);
		expect(fixture.commits.find(([key]) => key === 'simpleUi.topNav')?.[1]).not.toBe(editor.draft.editedTopNav);
		unmount();
		vi.useRealTimers();
	});

	test('keyboard-equivalent navigation moves are bounded, draft-only, and reset by discard before save', async () => {
		vi.useFakeTimers();
		const { editor, unmount } = mountEditor();
		const originalTop = editor.draft.editedTopNav.map(item => item.id);
		const originalBottom = editor.draft.editedBottomNav.map(item => item.id);

		expect(editor.moveTopNav(0, -1)).toBe(false);
		expect(editor.moveBottomNav(1, 1)).toBe(false);
		expect(editor.draft.editedTopNav.map(item => item.id)).toEqual(originalTop);
		expect(editor.draft.editedBottomNav.map(item => item.id)).toEqual(originalBottom);
		expect(editor.hasChanges).toBe(false);
		expect(fixture.commits).toEqual([]);

		expect(editor.moveTopNav(0, 1)).toBe(true);
		expect(editor.draft.editedTopNav.map(item => item.id)).toEqual(['search', 'home']);
		expect(editor.changeCount).toBe(1);
		expect(fixture.commits).toEqual([]);

		expect(await editor.discard()).toBe(true);
		expect(editor.draft.editedTopNav.map(item => item.id)).toEqual(originalTop);
		expect(editor.changeCount).toBe(0);
		expect(fixture.commits).toEqual([]);

		expect(editor.moveBottomNav(1, -1)).toBe(true);
		expect(editor.save()).toBe(true);
		expect(fixture.commits.filter(([key]) => key === 'simpleUi.bottomNav')).toHaveLength(1);
		expect(fixture.commits.find(([key]) => key === 'simpleUi.bottomNav')?.[1]).not.toBe(editor.draft.editedBottomNav);
		vi.clearAllTimers();
		unmount();
		vi.useRealTimers();
	});
});
