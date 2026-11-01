/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: Hataskey UI 2 編集面の選択表現を「錠剤型ケース」に保つ。
 *
 * ⚠️手本は Hataskey UI の上部タブ（ui/simple.vue の .topPill / .topTabActive）。
 *   ・タブ全体を1つの角丸ケースで包む
 *   ・⚠️選択中は**塗りつぶさない**。アイコンと文字をアクセント色にし、
 *     下地はごく淡く敷くだけ
 *   ⚠️塗りつぶし（背景をアクセント色、文字を fgOnAccent）へ戻すと
 *   面積が大きく主張が強すぎて、手本と揃わなくなる。
 */

import { describe, expect, test } from 'vitest';
import settingsBody from '@/components/HatasabaUi2SettingsBody.vue?raw';
import referenceUi from '@/ui/simple.vue?raw';

/** そのクラス単独の宣言ブロックを、括弧を数えて取り出す。 */
function declarationFor(source: string, selector: string): string {
	const pattern = new RegExp('(?:^|\\n)([^\\n{}]*)\\{', 'gu');
	for (const match of source.matchAll(pattern)) {
		if (!match[1].split(',').some(part => part.trim() === selector)) continue;
		let depth = 1;
		let cursor = match.index + match[0].length;
		while (cursor < source.length && depth > 0) {
			if (source[cursor] === '{') depth++;
			else if (source[cursor] === '}') depth--;
			cursor++;
		}
		return source.slice(match.index + match[0].length, cursor - 1);
	}
	return '';
}

describe('settings pill tabs', () => {
	test('検出器が生きている', () => {
		// ⚠️陽性対照。宣言を実際に読めていること。
		expect(declarationFor(settingsBody, '.chips').length).toBeGreaterThan(60);
		// ⚠️存在しないクラスなら空になること。
		expect(declarationFor(settingsBody, '.zzNoSuchClass')).toBe('');
		// ⚠️手本がまだ在ること。無くなったらこの検査の拠り所が消える。
		expect(referenceUi).toContain('.topTabActive');
	});

	test('タブは1つの錠剤型ケースに包む', () => {
		const chips = declarationFor(settingsBody, '.chips');
		expect(chips).toContain('border-radius: 9999px;');
		expect(chips).toContain('backdrop-filter: blur(24px) saturate(1.4);');
	});

	test('⚠️選択中を塗りつぶさない（アクセント色の文字で示す）', () => {
		// タブ
		const activeChip = settingsBody.slice(settingsBody.indexOf(".chips > button[data-active='true']"));
		expect(activeChip).toContain('color: var(--MI_THEME-accent);');
		expect(activeChip.slice(0, 400)).not.toContain('color: var(--MI_THEME-fgOnAccent)');
	});
});
