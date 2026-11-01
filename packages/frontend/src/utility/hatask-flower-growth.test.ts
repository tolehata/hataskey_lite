/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { addHataskFlowerGrowth, advanceHataskFlowerGrowth, createHataskGrowingFlower, HATASK_FLOWER_MINUTES_MAX, HATASK_FLOWER_MINUTES_MIN, HATASK_FLOWER_TOTAL_MINUTES, normalizeHataskGrowingFlower, randomHataskFlowerTargetMinutes, sameFlower } from './hatask-flower-growth.js';
import { getReadyHataskFlower } from '../../../backend/src/misc/hatask-flower-ready.js';

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));

const read = (path: string) => readFileSync(`${process.cwd()}/src/${path}`, 'utf8');

describe('Hatask flower growth', () => {
	test('サーバーの通知判定と画面の収穫可能判定が境界・旧データ・水やりで一致する', () => {
		for (const target of [480, 1200, 1920]) {
			const planted = createHataskGrowingFlower({ emoji: '🌷', name: 'チューリップ', now: 1000, targetMinutes: target });
			const variants = [planted, { ...planted, lastGrowthAt: undefined }, addHataskFlowerGrowth(planted, 120, 1000 + 60_000), { startedAt: 1000, totalMinutes: 1199 }];
			for (const value of variants) {
				for (const elapsed of [0, target * 60_000 - 1, target * 60_000, target * 60_000 + 1]) {
					const now = 1000 + elapsed;
					expect(getReadyHataskFlower(value, now) != null).toBe(advanceHataskFlowerGrowth(value, now)?.progress === 100);
				}
			}
		}
	});

	test('実経過分を加算して進捗を再計算し、満開を超えない', () => {
		const startedAt = 1_000;
		const lastGrowthAt = startedAt + 599 * 60_000;
		const flower = { emoji: '🌻', name: 'ひまわり', progress: 1, startedAt, totalMinutes: 599, targetMinutes: HATASK_FLOWER_TOTAL_MINUTES, lastGrowthAt };
		expect(addHataskFlowerGrowth(flower, 1, lastGrowthAt + 60_000)).toEqual({ ...flower, progress: 50, totalMinutes: 600, lastGrowthAt: lastGrowthAt + 60_000 });
		expect(addHataskFlowerGrowth(flower, HATASK_FLOWER_TOTAL_MINUTES, 1000)).toMatchObject({ progress: 100, totalMinutes: HATASK_FLOWER_TOTAL_MINUTES });
	});

	test('画面を閉じていた時間も保存時刻からまとめて成長へ反映する', () => {
		const startedAt = 1_000;
		const legacyFlower = { emoji: '🌷', name: 'チューリップ', progress: 0, startedAt, totalMinutes: 10 };
		const now = startedAt + 25 * 60_000;
		expect(advanceHataskFlowerGrowth(legacyFlower, now)).toEqual({
			...legacyFlower,
			progress: 2,
			totalMinutes: 25,
			targetMinutes: HATASK_FLOWER_TOTAL_MINUTES,
			lastGrowthAt: now,
		});
	});

	test('1分未満の端数を次回へ残し、再計算で二重加算しない', () => {
		const flower = { emoji: '🌱', name: 'わかば', progress: 0, startedAt: 1_000, totalMinutes: 2, targetMinutes: 600, lastGrowthAt: 121_000 };
		const first = advanceHataskFlowerGrowth(flower, 300_999);
		expect(first).toMatchObject({ totalMinutes: 4, lastGrowthAt: 241_000 });
		expect(advanceHataskFlowerGrowth(first, 300_999)).toEqual(first);
	});

	test('壊れた値を補正し、利用者データではない値を成長対象にしない', () => {
		expect(normalizeHataskGrowingFlower(null)).toBeNull();
		expect(normalizeHataskGrowingFlower({ emoji: '', name: '', progress: 999, startedAt: 0, totalMinutes: -3 }, 123)).toEqual({
			emoji: '🌱',
			name: 'わかば',
			progress: 0,
			startedAt: 1,
			totalMinutes: 0,
			targetMinutes: HATASK_FLOWER_TOTAL_MINUTES,
			lastGrowthAt: 1,
		});
	});

	test('新しい花の成長時間は8〜32時間から一度だけ選ぶ', () => {
		expect(randomHataskFlowerTargetMinutes(() => 0)).toBe(HATASK_FLOWER_MINUTES_MIN);
		expect(randomHataskFlowerTargetMinutes(() => 1)).toBe(HATASK_FLOWER_MINUTES_MAX);
		expect(randomHataskFlowerTargetMinutes(() => Number.NaN)).toBe(HATASK_FLOWER_MINUTES_MIN);
		expect(randomHataskFlowerTargetMinutes(() => 2)).toBe(HATASK_FLOWER_MINUTES_MAX);
		const flower = createHataskGrowingFlower({ emoji: '🌼', name: '花', now: 100, rng: () => .5 });
		expect(flower.targetMinutes).toBeGreaterThanOrEqual(HATASK_FLOWER_MINUTES_MIN);
		expect(flower.targetMinutes).toBeLessThanOrEqual(HATASK_FLOWER_MINUTES_MAX);
		expect(normalizeHataskGrowingFlower(flower)).toMatchObject({ targetMinutes: flower.targetMinutes });
	});

	test('花ごとの目標時間で進捗を計算し、永続化された値を維持する', () => {
		const flower = { emoji: '🌷', name: '花', startedAt: 1_000, totalMinutes: 240, targetMinutes: 480, lastGrowthAt: 1_000 };
		expect(normalizeHataskGrowingFlower(flower)).toMatchObject({ progress: 50, targetMinutes: 480 });
		expect(advanceHataskFlowerGrowth(flower, 1_000 + 120 * 60_000)).toMatchObject({ totalMinutes: 360, targetMinutes: 480, progress: 75 });
		expect(sameFlower(normalizeHataskGrowingFlower(flower)!, normalizeHataskGrowingFlower({ ...flower, targetMinutes: 1920 })!)).toBe(false);
	});

	test('成長処理はHataskページではなくメインUI起動時に開始する', () => {
		const boot = read('boot/main-boot.ts');
		const page = read('pages/hatask.vue');
		const growth = read('utility/hatask-flower-growth.ts');
		const widget = read('widgets/WidgetHataskFlowers.vue');
		const studioWidget = read('components/HataSideStudioFlowers.vue');
		expect(boot).toContain('if ($i) startHataskFlowerGrowthTracker();');
		expect(page).toContain('seedHataskFlowerGrowth(flower.value);');
		expect(page).toContain("if (loadResults[3].status === 'fulfilled')");
		expect(page).toContain('HATASK_FLOWER_GROWTH_EVENT');
		expect(page).not.toContain('growthInterval = setInterval');
		expect(page).not.toContain('onGrowthVisibility');
		expect(growth).toContain('now - flower.lastGrowthAt');
		expect(growth).not.toContain('activeCarryMs');
		expect(growth).not.toContain('wasVisible');
		expect(widget).toContain('window.addEventListener(HATASK_FLOWER_STATE_EVENT, onState)');
		expect(studioWidget).toContain('window.addEventListener(HATASK_FLOWER_GROWTH_EVENT, onFlowerGrowth)');
	});

	test('共同一覧と常設花壇の活動列は同じ花を使い、自分のお花を別に表示する', () => {
		const page = read('pages/hatask.vue');
		const streams = [...page.matchAll(/<HataskFlowerStream\b[\s\S]*?\/>/gu)].map(match => match[0]);
		expect(streams).toHaveLength(3);
		for (const kind of ['community', 'personal', 'activity']) {
			const stream = streams.find(source => source.includes(`ref="${kind}FlowerStream"`));
			expect(stream).toBeDefined();
			expect(stream).toContain(`:items="${kind === 'personal' ? 'personal' : 'community'}FlowerViews"`);
			expect(stream).toContain(`openFlowerDetail('${kind}',selection)`);
			expect(stream).toContain(`:paused="flowerStreamPaused.${kind} || flowerDialogOpen || flowerCollectionOpen"`);
		}
		expect(page).toMatch(/<HataskCommunityGarden\b[^>]*:flowers="communityFlowerViews"[\s\S]*ref="activityFlowerStream"[\s\S]*<\/HataskCommunityGarden>/u);
		expect(page).toContain(':label="copy.communityFlowerGallery"');
		expect(page).toContain(':label="copy.communityFlowerActivity"');
	});

	test('お花の詳細で改名と報告を使い、装飾アバター・名前・日時を引き継ぐ', () => {
		const stream = read('components/hatask/HataskFlowerStream.vue');
		const detail = read('components/hatask/HataskFlowerDetail.vue');
		const page = read('pages/hatask.vue');
		const avatars = [...stream.matchAll(/<MkAvatar\b[^>]*\/>/gu)].map(match => match[0]);
		expect(avatars).toHaveLength(2);
		for (const avatar of avatars) expect(avatar).toContain(':forceShowDecoration="true"');
		expect(stream).toContain('<MkUserName');
		expect(stream).toContain(':emoji="tile.flower.emoji"');
		expect(stream).toContain(':datetime="tile.flower.harvestedAt"');
		expect(detail).toContain('flower.isOwner ? labels.rename : labels.report');
		expect(page).toContain('reportCommunityFlower(');
		expect(page).toContain('renameFlower(');
		expect(page).toContain(':value="flowerVisibility"');
		expect(page).toContain('@change="changeFlowerVisibility"');
	});

	test('ハタキュ専用の写真列を共通の花ストリームへ置き換える', () => {
		const page = read('pages/hatask.vue');
		expect(page).not.toContain('hk-hangrow');
		expect(page).not.toContain('hk-hang');
		expect(page.match(/<HataskFlowerStream\b/gu)).toHaveLength(3);
	});
});
