/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const hataskSource = readFileSync(resolve(process.cwd(), 'src/pages/hatask.vue'), 'utf8');

describe('Hatask setup の初期化順序', () => {
	test('テーマ監視は settings の初期化後に登録する', () => {
		const settingsDeclaration = hataskSource.indexOf('const settings=ref<any>');
		const themeWatcher = hataskSource.indexOf('watch(() => settings.value.theme');

		expect(settingsDeclaration).toBeGreaterThanOrEqual(0);
		expect(themeWatcher).toBeGreaterThan(settingsDeclaration);
	});
});
