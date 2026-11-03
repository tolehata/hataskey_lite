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
