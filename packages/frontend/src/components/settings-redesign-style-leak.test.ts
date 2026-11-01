/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 設定画面のCSSがアプリ全体へ漏れないことを見張る。
 *
 * ⚠️CSS Modules がハッシュ化するのは**クラス名だけ**。`<style module>` の中でも
 *   `button { ... }` のような素の要素セレクタはそのまま出力され、
 *   ⚠️そのチャンクが読み込まれた瞬間からアプリ中の同じ要素すべてに効く。
 *
 * ⚠️実際にこれが起きた: HatasabaUi2SettingsBody の `button { font-weight: 700;
 *   border: 1px solid ... }` が、設定を一度開いただけで
 *     ・サイドメニューの文字が太字になる
 *     ・ミュートなどのボタンに黒枠が出る
 *   を同時に引き起こしていた。実機で font-weight が 400 → 700 に変わることを
 *   確かめて特定した。
 */

import { describe, expect, test } from 'vitest';
import settingsBody from './HatasabaUi2SettingsBody.vue?raw';
import immediateSettings from './HatasabaUi2ImmediateSettings.vue?raw';
import previewWindow from './MkHatasabaUi2PreviewWindow.vue?raw';
import shell from '@/pages/settings-redesign/index.vue?raw';
import bentoNavigation from '@/pages/settings-redesign/SettingsBentoNavigation.vue?raw';
import searchPanel from '@/pages/settings-redesign/SettingsSearchPanel.vue?raw';

/** `<style ... module>` ブロックの中身だけを取り出す。 */
function moduleStyleBlocks(source: string): string[] {
	const blocks: string[] = [];
	const pattern = /<style[^>]*\bmodule\b[^>]*>([\s\S]*?)<\/style>/gu;
	for (const match of source.matchAll(pattern)) blocks.push(match[1]);
	return blocks;
}

/** 行頭に置かれた素の要素セレクタを拾う。 */
const BARE_ELEMENT = /^(button|input|select|textarea|a|p|h[1-6]|section|article|div|span|ul|ol|li|table|img|label|fieldset|footer|header|nav)\b[^{}]*\{/u;

function bareElementSelectors(source: string): string[] {
	const offenders: string[] = [];
	for (const block of moduleStyleBlocks(source)) {
		for (const raw of block.split('\n')) {
			const line = raw.trim();
			if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('@')) continue;
			if (BARE_ELEMENT.test(line)) offenders.push(line.slice(0, 60));
		}
	}
	return offenders;
}

const SOURCES: Array<[string, string]> = [
	['HatasabaUi2SettingsBody.vue', settingsBody],
	['HatasabaUi2ImmediateSettings.vue', immediateSettings],
	['MkHatasabaUi2PreviewWindow.vue', previewWindow],
	['settings-redesign/index.vue', shell],
	['SettingsBentoNavigation.vue', bentoNavigation],
	['SettingsSearchPanel.vue', searchPanel],
];

describe('settings redesign style leak', () => {
	test('検出器が生きている', () => {
		// ⚠️陽性対照その1: module ブロックを実際に読めていること。
		const total = SOURCES.reduce((sum, [, source]) => sum + moduleStyleBlocks(source).length, 0);
		expect(total).toBeGreaterThanOrEqual(SOURCES.length);
		// ⚠️陽性対照その2: 漏れる書き方を渡せば、ちゃんと違反と判定すること。
		expect(bareElementSelectors('<style module>\nbutton { font-weight: 700; }\n</style>')).toHaveLength(1);
		expect(bareElementSelectors('<style module>\nh2, h3 { margin: 0; }\n</style>')).toHaveLength(1);
		// ⚠️クラス配下なら違反ではない。
		expect(bareElementSelectors('<style module>\n.surface button { font-weight: 700; }\n</style>')).toHaveLength(0);
	});

	test('module ブロックに素の要素セレクタを置かない', () => {
		const offenders: string[] = [];
		for (const [file, source] of SOURCES) {
			for (const line of bareElementSelectors(source)) offenders.push(`${file}: ${line}`);
		}
		expect(offenders).toEqual([]);
	});
});
