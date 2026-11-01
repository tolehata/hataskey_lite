/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { isDirectUploadCustomFontFile, isSupportedCustomFontFile } from '../utility/hata-font-file.js';

describe('Hataskeyカスタムフォント', () => {
	test('直接アップロードはTTFとOTFだけを受け付ける', () => {
		expect(isDirectUploadCustomFontFile({ name: 'sample.ttf', type: 'font/ttf' })).toBe(true);
		expect(isDirectUploadCustomFontFile({ name: 'sample.otf', type: 'font/otf' })).toBe(true);
		expect(isDirectUploadCustomFontFile({ name: 'sample.ttf', type: '' })).toBe(true);
		expect(isDirectUploadCustomFontFile({ name: 'sample.woff2', type: 'font/woff2' })).toBe(false);
		expect(isDirectUploadCustomFontFile({ name: 'sample.png', type: 'image/png' })).toBe(false);
	});

	test('ドライブ選択は既存のWOFF2対応を維持し、拡張子とMIMEの不一致を拒否する', () => {
		expect(isSupportedCustomFontFile({ name: 'sample.woff2', type: 'font/woff2' })).toBe(true);
		expect(isSupportedCustomFontFile({ name: 'sample.ttf', type: 'image/png' })).toBe(false);
		expect(isSupportedCustomFontFile({ name: 'sample.svg', type: 'image/svg+xml' })).toBe(false);
	});
});
