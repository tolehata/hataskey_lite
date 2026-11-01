/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));

import { findHataskFlora, floraData, generateFlowerNickname, getHataskFloraWeight, getHataskFlowerSeason, isRareHataskFlower, localizeFloraName, nameAdjectives, pickRandomFlora } from './hatask-flora.js';
import { floraTranslations } from './hatask-flora-i18n.js';

const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
const seasonalIds = [
	['daffodil', 'spring-starflower', 'calanthe-orchid', 'katakuri'],
	['agapanthus', 'red-hot-poker', 'bee-balm', 'coneflower'],
	['golden-lace', 'thoroughwort', 'toad-lily', 'leopard-plant'],
	['wintersweet', 'setsubunso', 'christmas-rose', 'winter-heath'],
];

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('Hatask seasonal flowers', () => {
	test.each([
		['2026-02-28T14:59:59.999Z', 'winter'],
		['2026-02-28T15:00:00.000Z', 'spring'],
		['2026-05-31T14:59:59.999Z', 'spring'],
		['2026-05-31T15:00:00.000Z', 'summer'],
		['2026-08-31T14:59:59.999Z', 'summer'],
		['2026-08-31T15:00:00.000Z', 'autumn'],
		['2026-11-30T14:59:59.999Z', 'autumn'],
		['2026-11-30T15:00:00.000Z', 'winter'],
		['2026-12-31T15:00:00.000Z', 'winter'],
		['2028-02-29T14:59:59.999Z', 'winter'],
		['2028-02-29T15:00:00.000Z', 'spring'],
	])('日本時間の季節境界: %s → %s', (timestamp, expected) => {
		expect(getHataskFlowerSeason(new Date(timestamp))).toBe(expected);
	});

	test('各季節に固有の4品種を追加し、表示翻訳との位置対応を保つ', () => {
		expect(floraData).toHaveLength(141);
		expect(floraTranslations).toHaveLength(floraData.length);
		expect(new Set(floraData.map((item) => item.name)).size).toBe(floraData.length);
		const additions = floraData.filter((item) => item.speciesId != null);
		expect(additions).toHaveLength(16);
		expect(new Set(additions.map((item) => item.speciesId)).size).toBe(16);
		for (const [seasonIndex, season] of seasons.entries()) {
			expect(additions.filter((item) => item.seasons?.includes(season)).map((item) => item.speciesId)).toEqual(seasonalIds[seasonIndex]);
		}
		for (const item of additions) {
			expect(item.speciesId).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
			expect(item.hanakotoba).toBeUndefined();
			for (const locale of ['en-US', 'zh-CN']) {
				const translated = localizeFloraName(item.name, locale);
				expect(translated.length).toBeGreaterThan(0);
				expect(translated).not.toBe(item.name);
				expect(localizeFloraName(`きらめく${item.name}`, locale)).toContain(translated);
			}
		}
		// 既存エントリの翻訳を末尾追加でずらしていないことも確認する。
		expect(localizeFloraName('パンプキンフラワー', 'en-US')).toBe('Pumpkin flower');
		expect(localizeFloraName('きらめく水晶草', 'zh-CN')).toBe('闪耀的水晶草');
	});

	test.each([
		['2026-04-01T00:00:00Z', 'spring'],
		['2026-07-01T00:00:00Z', 'summer'],
		['2026-10-01T00:00:00Z', 'autumn'],
		['2026-01-01T00:00:00Z', 'winter'],
	] as const)('通常抽選では旬の4品種が3倍、旬以外も出現する: %s', (timestamp, season) => {
		const date = new Date(timestamp);
		const counts = new Map<string, number>();
		// 通常134品種のうち旬の4品種を3枠ずつにするため、抽選枠は142。
		// 各枠の中央を選び、抽選結果そのものから重みを検証する。
		for (let bucket = 0; bucket < 142; bucket++) {
			const item = pickRandomFlora(date, () => (bucket + 0.5) / 142 * 0.99);
			counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
		}
		expect(counts.size).toBe(134);
		for (const item of floraData.filter((entry) => !entry.rare)) {
			const expected = item.seasons?.includes(season) ? 3 : 1;
			expect(counts.get(item.name)).toBe(expected);
			expect(getHataskFloraWeight(item, season)).toBe(expected);
		}
	});

	test('レアの区間は季節によらず最後の1%で、7品種を等確率にする', () => {
		const rare = floraData.filter((item) => item.rare);
		expect(rare).toHaveLength(7);
		for (const month of [1, 4, 7, 10]) {
			const date = new Date(Date.UTC(2026, month - 1, 1));
			expect(pickRandomFlora(date, () => 0.99 - Number.EPSILON).rare).not.toBe(true);
			expect(pickRandomFlora(date, () => 0.99)).toBe(rare[0]);
			expect(pickRandomFlora(date, () => 1)).toBe(rare[rare.length - 1]);
			for (const [index, item] of rare.entries()) {
				expect(pickRandomFlora(date, () => 0.99 + (index + 0.5) / rare.length * 0.01)).toBe(item);
			}
		}
		let rareCount = 0;
		for (let sample = 0; sample < 10_000; sample++) {
			if (pickRandomFlora(new Date('2026-04-01T00:00:00Z'), () => (sample + 0.5) / 10_000).rare) rareCount++;
		}
		expect(rareCount).toBe(100);
	});

	test('無引数呼び出しを保ち、範囲外や壊れた乱数でも品種を返す', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
		vi.spyOn(Math, 'random').mockReturnValue(0);
		expect(getHataskFlowerSeason()).toBe('spring');
		expect(pickRandomFlora()).toBe(floraData[0]);
		for (const sample of [-1, 0, 1, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(floraData).toContain(pickRandomFlora(undefined, () => sample));
		}
		expect(pickRandomFlora(undefined, () => { throw new Error('broken rng'); })).toBe(floraData[0]);
	});
});

describe('Hatask flower identity', () => {
	test('品種IDは改名や絵文字表示より優先する', () => {
		const flower = floraData.find((item) => item.speciesId === 'daffodil');
		expect(flower).toBeDefined();
		expect(findHataskFlora({ speciesId: 'daffodil', name: '旗茶くんのお花', emoji: '🔮' })).toBe(flower);
		expect(isRareHataskFlower({ speciesId: 'daffodil', name: '水晶草', emoji: '🔮' })).toBe(false);
	});

	test('旧データは既知の名前と絵文字で品種を識別する', () => {
		for (const item of floraData) {
			expect(findHataskFlora({ name: item.name, emoji: item.emoji })).toBe(item);
			for (const prefix of nameAdjectives) {
				expect(findHataskFlora({ name: `${prefix}${item.name}`, emoji: item.emoji })).toBe(item);
			}
		}
		expect(findHataskFlora({ name: 'ふわふわのきらめくスイセン', emoji: '🌼' })?.speciesId).toBe('daffodil');
	});

	test('絵文字が共通の旧改名花を先頭品種へ割り当てない', () => {
		expect(findHataskFlora({ name: '私だけのスイセン', emoji: '🌼' })).toBeUndefined();
		expect(findHataskFlora({ name: '旗茶くんのお花', emoji: '🌷' })).toBeUndefined();
		expect(findHataskFlora({ name: 'きらめくスイセン', emoji: '🌷' })).toBeUndefined();
		expect(findHataskFlora({ speciesId: 'unknown', name: '旗茶くんのお花', emoji: '🌼' })).toBeUndefined();
		expect(findHataskFlora({ emoji: '🌼' })).toBeUndefined();
		expect(findHataskFlora({ name: 'スイセン' })).toBeUndefined();
	});

	test('既存レア7品種は改名済みでも一意の絵文字で識別する', () => {
		const rare = floraData.filter((item) => item.rare);
		for (const item of rare) {
			expect(floraData.filter((candidate) => candidate.emoji === item.emoji)).toHaveLength(1);
			expect(isRareHataskFlower({ name: '旗茶くんのお花', emoji: item.emoji })).toBe(true);
		}
		expect(isRareHataskFlower({ name: 'きらめく宝石フラワー', emoji: '🌷' })).toBe(false);
		expect(isRareHataskFlower({ name: '宝石フラワー' })).toBe(false);
		expect(isRareHataskFlower({ emoji: '🌈', name: 'にじ花' })).toBe(false);
		expect(findHataskFlora({ name: 42, emoji: null })).toBeUndefined();
	});

	test('咲いたお花の自動の名前は上フレーズと品種名をつなぎ、引き直しで同じ名前を続けない', () => {
		expect(generateFlowerNickname('コスモス', () => 0)).toBe(`${nameAdjectives[0]}コスモス`);
		expect(generateFlowerNickname('コスモス', () => 0.9999999)).toBe(`${nameAdjectives.at(-1)}コスモス`);
		expect(generateFlowerNickname('コスモス', () => Number.NaN)).toBe(`${nameAdjectives[0]}コスモス`);
		expect(generateFlowerNickname('コスモス', () => 0, `${nameAdjectives[0]}コスモス`)).toBe(`${nameAdjectives[1]}コスモス`);
		const flower = floraData.find(item => item.name === 'コスモス');
		if (flower) expect(findHataskFlora({ name: generateFlowerNickname(flower.name), emoji: flower.emoji })).toBe(flower);
	});
});
