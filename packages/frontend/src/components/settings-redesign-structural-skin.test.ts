/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const componentPaths = [
	'src/components/form/section.vue',
	'src/components/form/link.vue',
	'src/components/MkFolder.vue',
	'src/components/MkFeatureBanner.vue',
	'src/components/MkButton.vue',
];

const readComponent = (componentPath: string) => readFile(resolve(process.cwd(), componentPath), 'utf8');

describe('settings redesign structural skin', () => {
	test('新設定シェルのcontextがある時だけ構造コンポーネントにスキンを付与する', async () => {
		for (const componentPath of componentPaths) {
			const source = await readComponent(componentPath);
			expect(source).toContain('settingsSearchV2ContextKey');
			expect(source).toContain('isSettingsRedesign');
			expect(source).toContain('[$style.redesigned]: isSettingsRedesign');
		}
	});

	test('新設定用の構造はテーマ変数と44px操作領域を使い、FormSectionを親cardにして二重化しない', async () => {
		const [section, link, folder, banner, button] = await Promise.all(componentPaths.map(readComponent));

		expect(section).toContain('data-settings-form-section');
		expect(section).toContain('background: transparent;');
		expect(section).toContain('box-shadow: none;');
		expect(section).toContain('border: 0;');
		expect(link).toContain('min-height: 44px');
		expect(folder).toContain('min-height: 44px');
		expect(banner).toContain('border-radius: 22px');
		expect(button).toContain('min-height: 44px');
		for (const source of [section, link, folder, banner, button]) {
			expect(source).toContain('--MI_THEME-');
		}
	});
});
