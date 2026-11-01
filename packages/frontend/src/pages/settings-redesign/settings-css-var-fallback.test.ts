/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 設定画面専用のCSS変数を、既定値なしで参照しないことを見張る。
 *
 * ⚠️`--settings-*` は設定シェルの根（.scope）にしか定義されていない。
 *   .scope の外に出た要素——別ファイルの部品、ポップアップ、body直下へ
 *   飛ばした要素など——が既定値なしで参照すると、
 *   ⚠️**その宣言ごと無効になり、border-color は初期値の currentColor
 *   ＝文字色になる**。ライトテーマでは黒枠として見える。
 *
 * ⚠️Firefox で黒枠になるという報告があり、この形が最有力だった。
 *   ⚠️ただし Firefox での再現確認は取れていない（この環境から操作できない）。
 */

import { describe, expect, test } from 'vitest';
import shell from './index.vue?raw';
import bentoNavigation from './SettingsBentoNavigation.vue?raw';
import searchPanel from './SettingsSearchPanel.vue?raw';
import preferencesSurface from './SettingsPreferencesSurface.vue?raw';
import relatedLinks from './SettingsRelatedLinks.vue?raw';
import settingsBody from '@/components/HatasabaUi2SettingsBody.vue?raw';
import previewWindow from '@/components/MkHatasabaUi2PreviewWindow.vue?raw';

const SOURCES: Array<[string, string]> = [
	['index.vue', shell],
	['SettingsBentoNavigation.vue', bentoNavigation],
	['SettingsSearchPanel.vue', searchPanel],
	['SettingsPreferencesSurface.vue', preferencesSurface],
	['SettingsRelatedLinks.vue', relatedLinks],
	['HatasabaUi2SettingsBody.vue', settingsBody],
	['MkHatasabaUi2PreviewWindow.vue', previewWindow],
];

/** 既定値を持たない `var(--settings-*)` を拾う。 */
function bareRefs(source: string): string[] {
	return source.match(/var\(--settings-[a-z-]+\)/gu) ?? [];
}

function offendersIn(sources: Array<[string, string]>): string[] {
	return sources.flatMap(([file, source]) => bareRefs(source).map(ref => `${file}: ${ref}`));
}

describe('settings css variable fallback', () => {
	test('検出器が生きている', () => {
		// ⚠️陽性対照。既定値なしの形を渡せば拾い、既定値ありは拾わないこと。
		expect(bareRefs('border: 1px solid var(--settings-border);')).toHaveLength(1);
		expect(bareRefs('border: 1px solid var(--settings-border, red);')).toHaveLength(0);
		// Raw imports must contain real component bodies even when a component
		// stops using the shell's optional custom properties.
		for (const [file, source] of SOURCES) {
			expect(source, file).toContain('<template>');
			expect(source, file).toContain('<style');
		}
		const fixture: Array<[string, string]> = SOURCES.map(([file, source]) => [file, file === 'SettingsBentoNavigation.vue' ? `${source}\n.positiveControl { border-color: var(--settings-border); }` : source]);
		expect(offendersIn(fixture)).toContain('SettingsBentoNavigation.vue: var(--settings-border)');
	});

	test('--settings-* は必ず既定値つきで参照する', () => {
		expect(offendersIn(SOURCES)).toEqual([]);
	});
});
