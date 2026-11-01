/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { addHataskFlowerGrowth, advanceHataskFlowerGrowth, createHataskGrowingFlower, normalizeHataskGrowingFlower, sameFlower } from './hatask-flower-growth.js';
import { normalizeFlowerGallery, normalizeGrowingFlower } from './hatask-flower-widget.js';
import { getReadyHataskFlower } from '../../../backend/src/misc/hatask-flower-ready.js';

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));

const MINUTE_MS = 60_000;
const STARTED_AT = 1000;

describe('Hatask rare flower growth', () => {
	test('新規レア花だけ48〜96時間で抽選し、通常花の8〜32時間は維持する', () => {
		for (const [sample, rareTarget, normalTarget] of [
			[0, 2880, 480],
			[0.5, 4320, 1200],
			[1, 5760, 1920],
		]) {
			const rng = vi.fn(() => sample);
			const rare = createHataskGrowingFlower({ emoji: '🔮', name: '水晶草', speciesId: 'crystal-grass', rare: true, now: STARTED_AT, rng });
			expect(rare.targetMinutes).toBe(rareTarget);
			expect(rng).toHaveBeenCalledTimes(1);
			expect(normalizeHataskGrowingFlower(rare, STARTED_AT)).toEqual(rare);
			expect(createHataskGrowingFlower({ emoji: '🌷', name: '花', now: STARTED_AT, rng: () => sample }).targetMinutes).toBe(normalTarget);
		}
	});

	test('範囲外・非数・例外を返す乱数でもレア花の抽選時間を安全に保つ', () => {
		for (const [sample, expected] of [[-1, 2880], [2, 5760], [Number.NaN, 2880], [Number.POSITIVE_INFINITY, 2880]]) {
			expect(createHataskGrowingFlower({ emoji: '🔮', name: '水晶草', rare: true, rng: () => sample }).targetMinutes).toBe(expected);
		}
		expect(createHataskGrowingFlower({ emoji: '🔮', name: '水晶草', rare: true, rng: () => { throw new Error('rng failed'); } }).targetMinutes).toBe(2880);
	});

	test('過去のレア品種を示す絵文字があっても保存済みの目標と残り時間を延長しない', () => {
		const stored = { emoji: '🔮', name: '名付けた花', progress: 33, startedAt: STARTED_AT, totalMinutes: 600, targetMinutes: 1800, lastGrowthAt: STARTED_AT + 600 * MINUTE_MS };
		expect(normalizeHataskGrowingFlower(stored, stored.lastGrowthAt)).toEqual(stored);
		const advanced = advanceHataskFlowerGrowth(stored, stored.lastGrowthAt + 100 * MINUTE_MS)!;
		expect(advanced.targetMinutes - advanced.totalMinutes).toBe(1100);
		expect(advanced).not.toHaveProperty('rare');
		expect(advanced).not.toHaveProperty('speciesId');
		expect(normalizeGrowingFlower(stored)).not.toHaveProperty('rare');
		expect(normalizeHataskGrowingFlower({ emoji: '🔮', startedAt: STARTED_AT }, STARTED_AT)?.targetMinutes).toBe(1200);
	});

	test('レア花でも保存済みの短い目標を尊重し、目標がない旧データは互換値を使う', () => {
		const rng = vi.fn(() => 1);
		for (const targetMinutes of [480, 1200, 1920, 2880, 5760]) {
			const flower = createHataskGrowingFlower({ emoji: '🔮', name: '花', rare: true, now: STARTED_AT, targetMinutes, rng });
			expect(normalizeHataskGrowingFlower(flower, STARTED_AT)?.targetMinutes).toBe(targetMinutes);
			expect(normalizeGrowingFlower(flower).targetMinutes).toBe(targetMinutes);
		}
		expect(rng).not.toHaveBeenCalled();
		expect(normalizeHataskGrowingFlower({ rare: true, startedAt: STARTED_AT }, STARTED_AT)?.targetMinutes).toBe(1200);
		expect(normalizeHataskGrowingFlower({ rare: true, targetMinutes: -10, startedAt: STARTED_AT }, STARTED_AT)?.targetMinutes).toBe(480);
		expect(normalizeHataskGrowingFlower({ rare: true, targetMinutes: 99999, startedAt: STARTED_AT }, STARTED_AT)?.targetMinutes).toBe(5760);
	});

	test('文字列などの不正なrare値を長時間花として扱わない', () => {
		for (const rare of ['true', 1, null, undefined, false]) {
			const raw = { emoji: '🔮', name: '花', rare, startedAt: STARTED_AT, targetMinutes: 5760 };
			const normalized = normalizeHataskGrowingFlower(raw, STARTED_AT)!;
			expect(normalized.targetMinutes).toBe(1920);
			expect(normalizeGrowingFlower(raw).targetMinutes).toBe(1920);
			expect(getReadyHataskFlower(raw, STARTED_AT + 1920 * MINUTE_MS)).toEqual({ startedAt: STARTED_AT });
			if (rare === false) expect(normalized.rare).toBe(false);
			else expect(normalized).not.toHaveProperty('rare');
		}
	});

	test('品種とレア属性を成長・ウィジェット・ギャラリー正規化で保ち、同じ花判定にも含める', () => {
		const flower = createHataskGrowingFlower({ emoji: '🔮', name: '好きな名前', speciesId: 'crystal-grass', rare: true, now: STARTED_AT, rng: () => 0.5 });
		const advanced = advanceHataskFlowerGrowth(flower, STARTED_AT + 60 * MINUTE_MS)!;
		for (const value of [advanced, normalizeGrowingFlower(advanced), normalizeFlowerGallery([{ ...advanced, id: 'collected' }], 1)[0]]) {
			expect(value).toMatchObject({ speciesId: 'crystal-grass', rare: true });
		}
		expect(sameFlower(flower, { ...flower })).toBe(true);
		expect(sameFlower(flower, { ...flower, speciesId: 'another-species' })).toBe(false);
		expect(sameFlower(flower, { ...flower, rare: false })).toBe(false);
		expect(sameFlower(flower, { ...flower, rare: undefined })).toBe(false);
	});

	test('レア花・短い保存目標・旧形式の満開境界が画面、ウィジェット、サーバー通知で一致する', () => {
		for (const targetMinutes of [480, 1200, 1920, 2880, 4320, 5760]) {
			const planted = createHataskGrowingFlower({ emoji: '🔮', name: '花', speciesId: 'crystal-grass', rare: true, now: STARTED_AT, targetMinutes });
			for (const value of [planted, { ...planted, lastGrowthAt: undefined }, { ...planted, targetMinutes: undefined }]) {
				const effectiveTarget = value.targetMinutes ?? 1200;
				for (const elapsed of [1920 * MINUTE_MS, effectiveTarget * MINUTE_MS - 1, effectiveTarget * MINUTE_MS, effectiveTarget * MINUTE_MS + 1]) {
					const now = STARTED_AT + elapsed;
					const advanced = advanceHataskFlowerGrowth(value, now)!;
					const ready = getReadyHataskFlower(value, now) != null;
					expect(ready).toBe(elapsed >= effectiveTarget * MINUTE_MS);
					expect(advanced.progress === 100).toBe(ready);
					expect(normalizeGrowingFlower(advanced).progress).toBe(advanced.progress);
					expect(normalizeGrowingFlower(advanced).targetMinutes).toBe(effectiveTarget);
				}
			}
		}
	});

	test('長時間レア花への水やりを残り時間に反映し、経過の二重加算や早すぎる通知を防ぐ', () => {
		const flower = createHataskGrowingFlower({ emoji: '🔮', name: '花', speciesId: 'crystal-grass', rare: true, now: STARTED_AT, targetMinutes: 5760 });
		const wateredAt = STARTED_AT + 60 * MINUTE_MS;
		const watered = addHataskFlowerGrowth(flower, 300, wateredAt)!;
		expect(watered).toMatchObject({ totalMinutes: 300, targetMinutes: 5760, lastGrowthAt: wateredAt, rare: true, speciesId: 'crystal-grass' });
		const later = wateredAt + 60 * MINUTE_MS;
		const advanced = advanceHataskFlowerGrowth(watered, later)!;
		expect(advanced.totalMinutes).toBe(360);
		expect(advanceHataskFlowerGrowth(advanced, later)).toEqual(advanced);
		const readyAt = wateredAt + (5760 - 300) * MINUTE_MS;
		expect(getReadyHataskFlower(watered, readyAt - 1)).toBeNull();
		expect(advanceHataskFlowerGrowth(watered, readyAt - 1)?.progress).toBe(99);
		expect(getReadyHataskFlower(watered, readyAt)).toEqual({ startedAt: STARTED_AT });
		expect(advanceHataskFlowerGrowth(watered, readyAt)?.progress).toBe(100);
		expect(addHataskFlowerGrowth(watered, 10000, wateredAt)).toMatchObject({ totalMinutes: 5760, targetMinutes: 5760, progress: 100 });
	});
});
