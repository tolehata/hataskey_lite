/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: Hataskey UI のプレビューが画面からはみ出さないことを見張る。
 *
 * ⚠️元は MkWindow を initialWidth=680 / initialHeight=620 の固定寸法で使っていた。
 *   モバイルの画面幅はこれより狭いので、必ず右へはみ出していた。
 *   ⚠️プレビューは読むだけの画面で、動かす・大きさを変える必要が無い。
 *   ウィンドウではなくモーダルにし、寸法は画面を上限にする。
 */

import { describe, expect, test } from 'vitest';
import source from './MkHatasabaUi2PreviewWindow.vue?raw';

describe('Hataskey UI preview overflow', () => {
	test('検出器が生きている（ソースを実際に読めている）', () => {
		// ⚠️陽性対照。空なら以降の判定は何も見ていない。
		expect(source.length).toBeGreaterThan(1000);
		// ⚠️MkModal を素の <div> で包まないこと。包むと器が画面いっぱいに広がらず、
		//   中身が画面外の下へ落ちる（実機で top:3526px になっていた）。
		expect(source).toContain('sheet');
		expect(source).not.toContain('previewHost');
	});

	test('固定寸法のウィンドウを使わない', () => {
		expect(source).not.toContain('MkWindow');
		expect(source).not.toContain('initialWidth');
		expect(source).not.toContain('initialHeight');
		expect(source).toContain('MkModal');
	});

	test('幅と高さが画面を上限にしている', () => {
		// ⚠️dvw / dvh を使う。モバイルのアドレスバーぶんを含めた実際の表示領域に合わせるため。
		expect(source).toMatch(/inline-size:\s*min\(680px,\s*calc\(100dvw\s*-\s*\d+px\)\)/u);
		expect(source).toMatch(/max-block-size:\s*calc\(100dvh\s*-\s*\d+px\)/u);
		expect(source).toContain('box-sizing: border-box;');
	});

	test('閉じるボタンにブラウザ既定の装飾が残っていない', () => {
		const block = source.match(/\.sheetClose\s*\{([\s\S]*?)\n\}/u)?.[1] ?? '';
		expect(block.length).toBeGreaterThan(40);
		expect(block).toContain('appearance: none;');
		expect(block).toContain('border: 0;');
		expect(block).toContain('font: inherit;');
	});
});
