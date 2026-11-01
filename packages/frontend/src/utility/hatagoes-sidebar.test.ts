/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { normalizeHatagoesMenu, normalizeHatagoesSidebar } from './hatagoes-sidebar.js';

describe('HataGoes サイドメニュー正規化', () => {
	test('旧3項目を最初の位置で統合し、区切りと他の順序を維持する', () => {
		const menu = ['timeline', '-', 'hatask', 'search', 'hatafeed', '-', 'hatady'];
		expect(normalizeHatagoesMenu(menu)).toEqual(['timeline', '-', 'hatagoes', 'search', '-']);
		expect(menu[2]).toBe('hatask');
	});

	test('既存HataGoesの位置を優先し、重複を除く', () => {
		const menu = ['hatask', '-', 'hatagoes', 'hatady', 'hatagoes', 'search'];
		const once = normalizeHatagoesMenu(menu);
		expect(once).toEqual(['-', 'hatagoes', 'search']);
		expect(normalizeHatagoesMenu(once)).toEqual(once);
	});

	test('対象がなければ追加せず、他項目を同参照で維持する', () => {
		const other = { id: 'search', icon: 'ti ti-search', label: '検索', group: 'basic' };
		const result = normalizeHatagoesSidebar([other]);
		expect(result).toEqual([other]);
		expect(result[0]).toBe(other);
		expect(normalizeHatagoesMenu(['timeline', '-'])).toEqual(['timeline', '-']);
	});

	test('旧項目の表示状態とグループを維持し、外部リンク属性だけを捨てる', () => {
		const old = { id: 'hatady', icon: 'ti ti-book', label: '旧', group: 'personal', visible: false, external: true, url: 'https://example.test', extra: 7 };
		const other = { id: 'search', icon: 'ti ti-search', label: '検索', group: 'basic' };
		const result = normalizeHatagoesSidebar([other, old]);
		expect(result).toEqual([other, { id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', group: 'personal', visible: false, extra: 7 }]);
		expect(result[0]).toBe(other);
		expect(normalizeHatagoesSidebar(result)).toEqual(result);
	});

	test('既存HataGoesレコードはそのまま使い、旧3項目と重複を除く', () => {
		const existing = { id: 'hatagoes', icon: 'custom', label: '自分用', group: 'custom', visible: false, external: true, url: 'https://example.test' };
		const old = { id: 'hatask', icon: 'old', label: '旧', group: 'hata' };
		const result = normalizeHatagoesSidebar([old, existing, old, existing]);
		expect(result).toEqual([existing]);
		expect(result[0]).toBe(existing);
	});
});
