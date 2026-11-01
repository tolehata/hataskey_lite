/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: ホームとカテゴリナビ、共通ヘッダーでネイティブボタンの枠・背景・字面を明示する。
 * 共通宣言と各カードの宣言を合わせて検査し、陽性対照で欠落検出を確認する。
 */

import { describe, expect, test } from 'vitest';
import shellSource from './index.vue?raw';
import bentoSource from './SettingsBentoNavigation.vue?raw';

/**
 * そのクラス**単独**の宣言ブロックを、括弧を数えて取り出す。
 * ⚠️`.foo .navLink { ... }` のような子孫指定は、その要素の基本形ではないので選ばない。
 *   ここを間違えると、修飾用の短い宣言を基本形と誤読して偽陰性になる。
 */
function declarationFor(source: string, name: string): string {
	const pattern = new RegExp('(?:^|\\n)([^\\n{}]*)\\{', 'gu');
	for (const match of source.matchAll(pattern)) {
		const selector = match[1];
		if (!selector.split(',').some(part => part.trim() === '.' + name)) continue;
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

const hasBorder = (declaration: string) => /(?:^|[;{\s])border\s*:/u.test(declaration);
const hasBackground = (declaration: string) => /(?:^|[;{\s])background\s*:/u.test(declaration);
const hasFontInherit = (declaration: string) => /(?:^|[;{\s])font\s*:\s*inherit/u.test(declaration);
const hasAppearanceNone = (declaration: string) => /appearance\s*:\s*none/u.test(declaration);

const SHELL_BUTTON_CLASSES = ['iconButton', 'profileButton', 'categoryBack', 'legacyMenu'] as const;
const CARD_BUTTON_CLASSES = ['categoryRow', 'categoryTile'] as const;

describe('settings redesign button reset', () => {
	test('検出器は宣言欠落を識別し、共通宣言と個別宣言を実際に読む', () => {
		expect(declarationFor(shellSource, 'iconButton').length).toBeGreaterThan(80);
		expect(declarationFor(bentoSource, 'root button').length).toBeGreaterThan(80);
		expect(declarationFor(bentoSource, 'categoryTile').length).toBeGreaterThan(80);
		expect(declarationFor(shellSource, 'zzThisClassDoesNotExist')).toBe('');
		expect(hasBorder('color: red;')).toBe(false);
		expect(hasBackground('color: red;')).toBe(false);
		expect(hasFontInherit('font-size: 1rem;')).toBe(false);
		expect(hasAppearanceNone('color: red;')).toBe(false);
	});

	test('共通ヘッダーの操作は既定の枠・背景・字面を打ち消す', () => {
		for (const name of SHELL_BUTTON_CLASSES) {
			const declaration = declarationFor(shellSource, name);
			expect(hasAppearanceNone(declaration), name).toBe(true);
			expect(hasBorder(declaration), name).toBe(true);
			expect(hasBackground(declaration), name).toBe(true);
			expect(hasFontInherit(declaration), name).toBe(true);
			expect(/cursor\s*:\s*pointer/u.test(declaration), name).toBe(true);
		}
	});

	test('ホームの行とカテゴリカードは同じ基本ボタン宣言を継承する', () => {
		const shared = declarationFor(bentoSource, 'root button');
		expect(hasAppearanceNone(shared)).toBe(true);
		expect(hasFontInherit(shared)).toBe(true);
		expect(shared).toContain('text-align: left;');
		expect(shared).toContain('min-height: 44px;');
		for (const name of CARD_BUTTON_CLASSES) {
			const declaration = declarationFor(bentoSource, name);
			expect(hasBorder(declaration), name).toBe(true);
			expect(hasBackground(declaration), name).toBe(true);
		}
	});
});
