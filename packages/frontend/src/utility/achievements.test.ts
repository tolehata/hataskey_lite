/*
 * SPDX-FileCopyrightText: Hataskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const frontendRoot = process.cwd();
const repositoryRoot = resolve(frontendRoot, '..', '..');
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8').replaceAll('\r\n', '\n');

const achievementId = 'hataSideStudioPioneer';
const frontendAchievements = read('packages/frontend/src/utility/achievements.ts');
const backendUserProfile = read('packages/backend/src/models/UserProfile.ts');
const localStorageKeys = read('packages/frontend/src/local-storage.ts');
const studioPage = read('packages/frontend/src/pages/hata-side-studio.vue');
const jaLocale = read('locales/ja-JP.yml');
const enLocale = read('locales/en-US.yml');
const zhLocale = read('locales/zh-CN.yml');
const localeTypes = read('locales/index.d.ts');
const sdkTypes = read('packages/cherrypick-js/src/autogen/types.ts');

describe('HataSideStudio tutorial achievement propagation', () => {
	test('registers the achievement in both allowlists and its badge catalog', () => {
		expect(frontendAchievements.match(new RegExp(`'${achievementId}'`, 'g'))).toHaveLength(2);
		expect(backendUserProfile.match(new RegExp(`'${achievementId}'`, 'g'))).toHaveLength(1);
		expect(frontendAchievements).toMatch(/img: '\/fluent-emoji\/1f6e0\.png'/);
		expect(existsSync(resolve(repositoryRoot, 'fluent-emojis/dist/1f6e0.png'))).toBe(true);
	});

	test('persists tutorial completion locally and claims the achievement for finish or skip', () => {
		expect(localStorageKeys).toMatch(/'hataSideStudioTutorialDone'/);
		expect(studioPage).toMatch(/function finishTutorial\(skipped: boolean\)[\s\S]*?setItem\('hataSideStudioTutorialDone', '1'\)[\s\S]*?claimAchievement\('hataSideStudioPioneer'\)/);
	});

	test('provides the requested Japanese copy and an English translation', () => {
		expect(jaLocale).toContain(`    _${achievementId}:\n      title: "サイドメニューの開拓者"\n      description: "チュートリアルを完了またはスキップした"\n      flavor: "そのハタキスト、メニューを作る"`);
		expect(enLocale).toContain(`    _${achievementId}:\n      title: "Side Menu Pioneer"\n      description: "Complete or skip the HataSideStudio tutorial"\n      flavor: "This Hataskist builds menus."`);
	});
});

// HataSNSCordUI は廃止したが、獲得済みの実績を表示できるよう定義と文言は残す。
describe('retired HataSNSCordUI tutorial achievement', () => {
	const hatacordingAchievementId = 'hatacordingUiTutorial';

	test('registers the achievement in both allowlists and its badge catalog', () => {
		expect(frontendAchievements.match(new RegExp(`'${hatacordingAchievementId}'`, 'g'))).toHaveLength(2);
		expect(backendUserProfile.match(new RegExp(`'${hatacordingAchievementId}'`, 'g'))).toHaveLength(1);
		expect(frontendAchievements).toMatch(/'hatacordingUiTutorial':[\s\S]*?img: '\/fluent-emoji\/1f4bb\.png'/);
		expect(existsSync(resolve(repositoryRoot, 'fluent-emojis/dist/1f4bb.png'))).toBe(true);
	});

	test('provides the requested Japanese copy and an English translation', () => {
		expect(jaLocale).toContain(`    _${hatacordingAchievementId}:\n      title: "HataSNSCordUI、名前長いね"\n      description: "玄人仕様のUIです"`);
		expect(enLocale).toContain(`    _${hatacordingAchievementId}:\n      title: "HataSNSCordUI is quite a mouthful"\n      description: "A UI for experienced users"`);
	});
});

describe('Utage and LTL punch achievements are removed in hataskey Lite', () => {
	test('no removed achievement remains in allowlists, badges, locales or SDK types', () => {
		for (const [name, source] of [['frontend', frontendAchievements], ['backend', backendUserProfile], ['ja', jaLocale], ['en', enLocale], ['zh', zhLocale], ['locale types', localeTypes], ['sdk', sdkTypes]] as const) {
			expect(source.includes('utageSuccess') || source.includes('utageInterruption'), name).toBe(false);
			expect(source.includes('ltlPunch'), name).toBe(false);
			// 陽性対照: 残している実績は同じ探し方で各所に見つかる。
			expect(source.includes('hatacordingUiTutorial'), name).toBe(true);
		}
	});

	test('every achievement can be claimed by the client again', () => {
		const claimEndpoint = read('packages/backend/src/server/api/endpoints/i/claim-achievement.ts');
		expect(claimEndpoint).toContain('enum: ACHIEVEMENT_TYPES');
		expect(frontendAchievements).toContain('claimAchievement(type: typeof ACHIEVEMENT_TYPES[number]) {');
		for (const source of [frontendAchievements, backendUserProfile, claimEndpoint]) {
			expect(source).not.toContain('CLIENT_CLAIMABLE_ACHIEVEMENT_TYPES');
		}
	});
});
