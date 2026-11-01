/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'en-US' }));

import { localizeFloraName, localizeHanakotoba } from '@/utility/hatask-flora.js';

describe('Hataskのお花表示言語', () => {
	let originalDocumentLang: string;

	beforeEach(() => {
		originalDocumentLang = window.document.documentElement.lang;
		window.document.documentElement.lang = 'ja-JP';
	});

	afterEach(() => {
		window.document.documentElement.lang = originalDocumentLang;
	});

	test('保存言語が未設定でも画面が日本語なら花名と花言葉を日本語で保つ', () => {
		expect(localizeFloraName('きらめくヒマワリ')).toBe('きらめくヒマワリ');
		expect(localizeHanakotoba('憧れ')).toBe('憧れ');
	});

	test('画面が英語なら保存値を変更せず表示だけ翻訳する', () => {
		window.document.documentElement.lang = 'en-US';
		expect(localizeFloraName('きらめくヒマワリ')).toBe('Sparkling Sunflower');
		expect(localizeHanakotoba('憧れ')).toBe('Admiration');
	});

	test('明示された言語は画面の言語より優先する', () => {
		expect(localizeFloraName('きらめくヒマワリ', 'zh-CN')).toBe('闪耀的向日葵');
	});
});
