/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { countFlowerGallery, normalizeFlowerGallery, normalizeGrowingFlower } from './hatask-flower-widget.js';

describe('Hataskお花ウィジェットの保存データ正規化', () => {
	test('成長度を0〜100の範囲に収める', () => {
		expect(normalizeGrowingFlower({ emoji: '🌷', name: 'チューリップ', progress: 140, totalMinutes: 1200, targetMinutes: 1200 })).toMatchObject({
			emoji: '🌷',
			name: 'チューリップ',
			progress: 100,
		totalMinutes: 1200,
		});
	});

	test('満開の手前は100%に丸めずHatask本体と同じ未開花扱いにする', () => {
		const flower = normalizeGrowingFlower({
			emoji: '🌼',
			name: 'ヒナギク',
			progress: 99,
			totalMinutes: 1199,
			targetMinutes: 1200,
		});

		expect(flower.progress).toBe(99);
		expect(flower.totalMinutes).toBeLessThan(flower.targetMinutes);
	});

	test('壊れたデータを表示に混ぜず、指定数以上は表示しない', () => {
		const gallery = normalizeFlowerGallery([
			{ id: 'a', emoji: '🌸', name: 'さくら' },
			null,
			'broken',
			{ id: 'b', emoji: '🌻', name: 'ひまわり' },
		], 1);
		expect(gallery).toHaveLength(1);
		expect(gallery[0].name).toBe('さくら');
		expect(countFlowerGallery([
			{ id: 'a' },
			null,
			'broken',
			{ id: 'b' },
		])).toBe(2);
		expect(normalizeFlowerGallery([{ id: 'a' }], Number.NaN)).toHaveLength(1);
		expect(normalizeFlowerGallery([{ id: 'a' }], 1, 'Unnamed flower')[0].name).toBe('Unnamed flower');
	});
});
