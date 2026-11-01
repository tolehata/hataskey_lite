/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: タブの追従と、保存バーの出し方を見張る。
 *
 * ・タブはスクロールで隠れる位置まで来たら上部に貼り付いて出し続ける。
 *   ⚠️貼り付き判定は scroll イベントで座標を測るのではなく、
 *   本来の位置に置いた目印(sentinel)が画面から外れたかで行う。
 *   ⚠️scroll で測り続けると重く、取りこぼす。
 *
 * ・保存バーは**変更が無いときは追従させない**。
 *   ⚠️常に貼り付いていると、何も起きていないのに場所を取り続けて邪魔になる。
 *   ⚠️ただし保存ボタン自体は常に置くこと（無いと「保存できない」と受け取られる。
 *   実際にそう報告された）。
 */

import { describe, expect, test } from 'vitest';
import source from '@/components/HatasabaUi2SettingsBody.vue?raw';

/** そのセレクタ単独の宣言ブロックを、括弧を数えて取り出す。 */
function declarationFor(css: string, selector: string): string {
	const pattern = new RegExp('(?:^|\\n)([^\\n{}]*)\\{', 'gu');
	for (const match of css.matchAll(pattern)) {
		if (!match[1].split(',').some(part => part.trim() === selector)) continue;
		let depth = 1;
		let cursor = match.index + match[0].length;
		while (cursor < css.length && depth > 0) {
			if (css[cursor] === '{') depth++;
			else if (css[cursor] === '}') depth--;
			cursor++;
		}
		return css.slice(match.index + match[0].length, cursor - 1);
	}
	return '';
}

describe('settings sticky tabs', () => {
	test('検出器が生きている', () => {
		// ⚠️陽性対照。宣言を実際に読めていること。
		expect(declarationFor(source, '.chips').length).toBeGreaterThan(80);
		expect(declarationFor(source, '.changeBar').length).toBeGreaterThan(80);
		expect(declarationFor(source, '.zzNoSuchClass')).toBe('');
	});

	test('タブは上部へ貼り付く', () => {
		const chips = declarationFor(source, '.chips');
		expect(chips).toContain('position: sticky;');
		expect(chips).toContain('inset-block-start: 8px;');
		// ⚠️貼り付いた瞬間に見た目が飛ばないよう、変化させる値を宣言しておく。
		expect(chips).toContain('transition:');
	});

	test('⚠️貼り付き判定は目印の見え方で行う（scrollで測り続けない）', () => {
		expect(source).toContain('IntersectionObserver');
		expect(source).toContain("chipsStuck.value = !entry.isIntersecting");
		expect(source).toContain('chipsObserver?.disconnect();');
		// ⚠️scroll を張って座標を測る実装へ戻っていないこと。
		expect(source).not.toContain("addEventListener('scroll'");
	});

	test('⚠️保存バーは変更が無いときは追従しない', () => {
		const bar = declarationFor(source, '.changeBar');
		expect(bar).toContain('position: static;');
		const active = declarationFor(source, ".changeBar[data-has-changes='true']");
		expect(active).toContain('position: sticky;');
		// ⚠️変更が入ったら滑り出す。
		expect(active).toContain('animation: changeBarIn');
		// ⚠️`both` にしないこと。終状態の transform が残り、
		//   position: fixed の基準を奪う（実際にプレビューが画面外へ飛んだ）。
		expect(active).toContain('backwards;');
		expect(active).not.toContain('both;');
	});

	test('⚠️タブの選択はスクロール位置に追従する', () => {
		// ⚠️「見えている量」で決めること。節の先頭が入ったかで決めると、
		//   長い節を読んでいる途中で次の節へ先に切り替わる。
		expect(source).toContain('function syncActiveCategoryFromScroll');
		expect(source).toContain('entry.intersectionRect.height / viewport');
		// ⚠️節の高さではなく画面の高さで割る。節の高さで割ると短い節が常に勝つ。
		expect(source).toContain('entry.rootBounds?.height ?? window.innerHeight');
		// ⚠️タブで飛んでいる間は追わせない（通過した節に反応してちらつく）。
		expect(source).toContain('suppressSpyUntil');
		// ⚠️scroll イベントで毎回計算する実装へ戻っていないこと。
		expect(source).not.toContain("addEventListener('scroll'");
		expect(source).toContain('sectionObserver?.disconnect();');
	});

	test('⚠️飛び先のハイライトは内側に描く（左右が途切れないように）', () => {
		// ⚠️outline-offset を正にすると、器の幅いっぱいのカードでは
		//   左右にはみ出したぶんが切られる。
		const focus = source.slice(source.indexOf('.card:focus'));
		expect(focus.slice(0, 320)).toContain('outline-offset: -3px;');
		expect(focus.slice(0, 320)).not.toContain('outline-offset: 3px;');
	});

	test('保存ボタンは変更が無くても存在する', () => {
		// ⚠️「変更があるときだけ枠ごと出す」に戻さないこと。
		expect(source).toContain('<div v-if="mode === \'permanent\'" :class="$style.changeBar"');
		expect(source).toContain(':disabled="!editor.hasChanges"');
	});
});
