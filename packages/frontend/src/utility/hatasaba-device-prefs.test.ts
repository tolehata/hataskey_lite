/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => ({
	getItem: vi.fn<(key: string) => string | null>(() => null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
}));

vi.mock('@/local-storage.js', () => ({
	miLocalStorage: storage,
}));

import { setTabSwipeEnabled, tabSwipeEnabled } from './hatasaba-device-prefs.js';

describe('Hataskey UIの左右スワイプ設定', () => {
	test('未設定では有効で、無効化は端末ローカルに保存する', () => {
		expect(tabSwipeEnabled.value).toBe(true);

		setTabSwipeEnabled(false);

		expect(tabSwipeEnabled.value).toBe(false);
		expect(storage.setItem).toHaveBeenCalledWith('hatasabaTabSwipeEnabled', 'false');
	});
});

describe('右ウィジェットバーの端末ローカルな開閉', () => {
	beforeEach(() => { vi.resetModules(); storage.setItem.mockClear(); });

	test.each([['true', true], ['false', false], [null, false], ['unknown', false]] as const)('保存値 %s から開閉を復元する', async (saved, expected) => {
		storage.getItem.mockImplementation(key => key === 'hataRightWidgetsCollapsed' ? saved : null);
		const { rightWidgetsCollapsed } = await import('./hatasaba-device-prefs.js');
		expect(rightWidgetsCollapsed.value).toBe(expected);
	});

	test('開閉は共有refと専用キーだけに書き込み、再読込でも復元する', async () => {
		const values = new Map<string, string>();
		storage.getItem.mockImplementation(key => values.get(key) ?? null);
		storage.setItem.mockImplementation((key, value) => { values.set(key, value); });
		const first = await import('./hatasaba-device-prefs.js');
		const second = await import('./hatasaba-device-prefs.js');
		storage.setItem.mockClear();
		first.setRightWidgetsCollapsed(true);
		expect(second.rightWidgetsCollapsed.value).toBe(true);
		expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('hataRightWidgetsCollapsed', 'true');
		vi.resetModules();
		const restored = await import('./hatasaba-device-prefs.js');
		expect(restored.rightWidgetsCollapsed.value).toBe(true);
		restored.setRightWidgetsCollapsed(false);
		expect(values.get('hataRightWidgetsCollapsed')).toBe('false');
	});
});

describe('UI S の端末ローカルな表示サイズ', () => {
	beforeEach(() => { vi.resetModules(); storage.setItem.mockReset(); storage.getItem.mockReset(); });

	test.each([['small', 'small'], ['standard', 'standard'], [null, 'standard'], ['invalid', 'standard']] as const)('保存値 %s を復元する', async (saved, expected) => {
		storage.getItem.mockImplementation(key => key === 'hataskeyUiSDisplaySize' ? saved : null);
		const { hataskeyUiSDisplaySize } = await import('./hatasaba-device-prefs.js');
		expect(hataskeyUiSDisplaySize.value).toBe(expected);
	});

	test('変更と既定への戻しを専用キーへ即時保存する', async () => {
		storage.getItem.mockReturnValue(null);
		const { hataskeyUiSDisplaySize, setHataskeyUiSDisplaySize } = await import('./hatasaba-device-prefs.js');
		setHataskeyUiSDisplaySize('small');
		expect(hataskeyUiSDisplaySize.value).toBe('small');
		expect(storage.setItem).toHaveBeenCalledWith('hataskeyUiSDisplaySize', 'small');
		setHataskeyUiSDisplaySize('standard');
		expect(hataskeyUiSDisplaySize.value).toBe('standard');
		expect(storage.setItem).toHaveBeenLastCalledWith('hataskeyUiSDisplaySize', 'standard');
	});
});

describe('ノートチャームの端末表示設定', () => {
	beforeEach(() => { vi.resetModules(); storage.setItem.mockReset(); storage.getItem.mockReset(); });

	test.each([null, '{"show":false,"motion":false,"showOthers":false}', '{broken'])('旧保存値 %s でも風は既定で有効になり、既存の表示設定は保持する', async saved => {
		storage.getItem.mockImplementation(key => key === 'noteCharmDisplay' ? saved : null);
		const { noteCharmDisplay } = await import('./hatasaba-device-prefs.js');
		expect(noteCharmDisplay.value.wind).toBe(true);
		if (saved?.includes('"show":false')) expect(noteCharmDisplay.value).toEqual({ show: false, motion: false, showOthers: false, wind: true });
	});

	test('風だけを止める設定は既存キーに保存し、表示・動きと独立して復元する', async () => {
		const values = new Map<string, string>();
		storage.getItem.mockImplementation(key => values.get(key) ?? null);
		storage.setItem.mockImplementation((key, value) => values.set(key, value));
		const first = await import('./hatasaba-device-prefs.js');
		first.setNoteCharmDisplay({ wind: false });
		expect(first.noteCharmDisplay.value).toEqual({ show: true, motion: true, showOthers: true, wind: false });
		expect(JSON.parse(values.get('noteCharmDisplay')!)).toEqual(first.noteCharmDisplay.value);
		vi.resetModules();
		const restored = await import('./hatasaba-device-prefs.js');
		expect(restored.noteCharmDisplay.value.wind).toBe(false);
		restored.setNoteCharmDisplay({ showOthers: false, motion: false });
		expect(restored.noteCharmDisplay.value).toEqual({ show: true, motion: false, showOthers: false, wind: false });
	});

	test.each([null, '{"show":false,"motion":false}', '{broken'])('旧保存値 %s では他人のチャームを既定表示する', async saved => {
		storage.getItem.mockImplementation(key => key === 'noteCharmDisplay' ? saved : null);
		const { noteCharmDisplay } = await import('./hatasaba-device-prefs.js');
		expect(noteCharmDisplay.value.showOthers).toBe(true);
		if (saved?.includes('"show":false')) expect(noteCharmDisplay.value).toEqual({ show: false, motion: false, showOthers: true, wind: true });
	});

	test('他人だけを隠す設定は既存キーに保存し、全表示・動きと独立して復元する', async () => {
		const values = new Map<string, string>();
		storage.getItem.mockImplementation(key => values.get(key) ?? null);
		storage.setItem.mockImplementation((key, value) => values.set(key, value));
		const first = await import('./hatasaba-device-prefs.js');
		storage.setItem.mockClear();
		first.setNoteCharmDisplay({ showOthers: false });
		expect(first.noteCharmDisplay.value).toEqual({ show: true, motion: true, showOthers: false, wind: true });
		expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('noteCharmDisplay', JSON.stringify({ show: true, motion: true, showOthers: false, wind: true }));
		vi.resetModules();
		const restored = await import('./hatasaba-device-prefs.js');
		expect(restored.noteCharmDisplay.value.showOthers).toBe(false);
		restored.setNoteCharmDisplay({ motion: false });
		expect(restored.noteCharmDisplay.value).toEqual({ show: true, motion: false, showOthers: false, wind: true });
	});
});
