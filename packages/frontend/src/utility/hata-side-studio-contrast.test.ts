/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { chooseHataSideReadableText, hataSideContrastRatio, inspectHataSideContrast, parseHataSideRgb } from './hata-side-studio-contrast.js';

describe('HataSideStudio contrast inspection', () => {
	test('computed rgb colorsを解析する', () => {
		expect(parseHataSideRgb('rgb(255, 128, 0)')).toEqual({ r: 255, g: 128, b: 0 });
		expect(parseHataSideRgb('rgba(12 34 56 / 0.8)')).toEqual({ r: 12, g: 34, b: 56 });
	});

	test('小さい文字の基準4.5:1未満を読みにくいと判定する', () => {
		const gray = { r: 150, g: 150, b: 150 };
		const white = { r: 255, g: 255, b: 255 };
		expect(hataSideContrastRatio(gray, white)).toBeLessThan(4.5);
		expect(inspectHataSideContrast([gray], [white])).toMatchObject({ low: true, recommended: '#111111' });
	});

	test('グラデーション両端で悪い方を採用して一括色を選ぶ', () => {
		const result = inspectHataSideContrast(
			[{ r: 120, g: 120, b: 120 }],
			[{ r: 248, g: 248, b: 248 }, { r: 220, g: 220, b: 220 }],
		);
		expect(result.low).toBe(true);
		expect(result.recommended).toBe('#111111');
		expect(chooseHataSideReadableText([{ r: 20, g: 20, b: 20 }]).color).toBe('#ffffff');
	});
});
