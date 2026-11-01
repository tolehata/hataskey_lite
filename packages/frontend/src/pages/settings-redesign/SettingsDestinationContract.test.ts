/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});
import shellSource from './index.vue?raw';
import bentoSource from './SettingsBentoNavigation.vue?raw';
import searchSource from './SettingsSearchPanel.vue?raw';
import { settingsDestinationSections, settingsDestinations } from './settings-destinations.js';
import { preferenceGroups } from './settings-preferences-catalog.js';
import routerSource from '@/router.definition.ts?raw';
import { i18n } from '@/i18n.js';

function navigationPathKey(item: (typeof settingsDestinations)[number]): string {
	const activation = item.activation;
	const activationKey = activation == null
		? ''
		: `#${activation.kind}:${activation.category}:${'popup' in activation ? activation.popup : ''}`;
	const query = item.route === '/settings/preferences' ? `?destination=${encodeURIComponent(item.id)}` : '';
	return `${item.route}${query}${activationKey}`;
}

describe('settings redesign destination contract', () => {
	test('categories are complete, non-empty, and uniquely identified', () => {
		// ⚠️Misskey UI から画面と関係ない設定を「その他」節へ切り出したので9->10。
		// 旗鯖fork: ⚠️用途ごとに節を割り直した（10 → 15）。
		//   「データと連携」に17項目が積まれていて、どこに何があるか読めなかった。
		// 旗鯖fork: ⚠️プロフィールだけの節は畳んだ（左上に常設の入口があるため）。
		expect(settingsDestinationSections).toHaveLength(13);
		expect(settingsDestinationSections.every(section => section.items.length > 0)).toBe(true);
		expect(new Set(settingsDestinations.map(item => item.id)).size).toBe(settingsDestinations.length);
		expect(settingsDestinations.length).toBeGreaterThan(0);
		expect(settingsDestinations.every(item => item.route.trim() !== '')).toBe(true);
	});
	test('manifest navigation paths do not collide', () => {
		const paths = settingsDestinations.map(navigationPathKey);
		expect(new Set(paths).size).toBe(paths.length);
	});
	test('places Hataskey UI S directly under Hataskey UI', () => {
		const section = settingsDestinationSections.find(item => item.id === 'hataskey-ui');
		expect(section?.label).toBe('hataskeyUI / S');
		expect(section?.items.map(item => item.id)).toEqual(['hataskey-ui', 'hataskey-ui-s']);
		expect(section?.items[1]).toMatchObject({ label: 'Hataskey UI S', route: '/settings/preferences', categoryId: 'hataskey-ui' });
		expect(preferenceGroups['hataskey-ui-s']).toEqual({ title: 'Hataskey UI S', description: i18n.ts._hata._uiSetup.ui3SettingsDescription });
	});
	test('active, brand, search, and route contracts are wired', () => {
		expect(bentoSource).toContain('aria-current');
		expect(searchSource).toContain('aria-selected');
		expect(searchSource).toContain('settingsBrand');
		for (const id of ['hataskey-ui', 'hataskey-tools']) {
			expect(settingsDestinationSections.find(section => section.id === id)?.brand).toBeTruthy();
		}
		expect(shellSource).toContain(':activeCategoryId="activeBentoCategoryId"');
		expect(searchSource).toContain('[aria-selected=\'true\']:hover');
		expect(searchSource).toContain('hasSettingsBrand(item.label)');
		expect(routerSource).toContain('name: \'hatafeed-settings\'');
		expect(routerSource).not.toContain('hatasnscord-ui');
		expect(routerSource).toContain('import(\'@/pages/settings/preferences.vue\')');
	});
});
