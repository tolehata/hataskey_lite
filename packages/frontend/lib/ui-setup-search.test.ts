/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { collectSettingsSearchDescriptorsV2, collectSettingsDescriptorReachabilityAuditV2, collectSettingsInteractiveInventoryV2, readSettingsRoutesV2 } from './vite-plugin-create-settings-search-index-v2.js';

describe('UI切り替えの設定検索', () => {
	const sourceFile = 'src/components/MkUISetup.vue';
	const source = fs.readFileSync(sourceFile, 'utf8');
	const routes = readSettingsRoutesV2(fs.readFileSync('src/router.definition.ts', 'utf8'));

	test('通常・非推奨の4つのUIを検索対象として保持する', () => {
		const inventory = collectSettingsInteractiveInventoryV2(sourceFile, source);
		expect(inventory.filter(item => item.classification === 'user-facing-setting').map(item => item.actionExpression)).toEqual([
			"choose('simple')", "choose('hataskey3')", "askDeprecated('default')", "askDeprecated('deck')",
		]);
		const controls = collectSettingsSearchDescriptorsV2(sourceFile, source, routes, {
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'general', popup: 'ui-setup' },
		});
		expect(controls).toHaveLength(4);
		expect(controls.every(control => control.persistence === 'device' && control.saveMode === 'reload')).toBe(true);
		expect(collectSettingsDescriptorReachabilityAuditV2(controls)).toHaveLength(4);
	});

	test('確認・戻る・閉じるを独立した設定として索引に追加しない', () => {
		const inventory = collectSettingsInteractiveInventoryV2(sourceFile, source);
		for (const handler of ['submitDeprecated', 'backFromConfirm', 'close']) {
			expect(inventory.find(item => item.actionExpression === handler)?.searchableControl).toBe(false);
		}
	});
});
