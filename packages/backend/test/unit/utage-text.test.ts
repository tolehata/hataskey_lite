/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfc-js';
import { describe, expect, test } from 'vitest';
import { isUtageEligible } from '@/misc/utage.js';

type UtageNote = Parameters<typeof isUtageEligible>[0];

function note(overrides: Partial<UtageNote> = {}): UtageNote {
	return { text: '宴', cw: null, userHost: null, visibility: 'public', channelId: null, ...overrides };
}

const concealedTexts = [
	['透明な文字色', ':kyattukya:$[fg.color=0000 宴]', 'fn'],
	['同色の文字色と背景色', '$[bg.color=ffffff $[fg.color=ffffff 宴]]', 'fn'],
	['透明なカスタム絵文字', '$[fg.color=0000 :utage:]', 'fn'],
	['ゼロ倍率', '$[scale.x=0,y=0 宴]', 'fn'],
	['画面外への移動', '$[position.x=9999,y=9999 宴]', 'fn'],
	['ぼかし', '$[blur 宴]', 'fn'],
	['フェード', '$[fade.speed=9999s 宴]', 'fn'],
	['ルビの余分な文字', '$[ruby 日常 にちじょう 宴]', 'fn'],
	['時刻変換で消える文字', '$[unixtime 0宴]', 'fn'],
	['縮小', '<small>宴</small>', 'small'],
	['多重の縮小', '<small><small>宴</small></small>', 'small'],
	['太字の中の透明文字', '**$[fg.color=0000 宴]**', 'fn'],
	['拡大の中の縮小', '$[x2 <small>宴</small>]', 'small'],
	['フォント指定の中の透明文字', '$[font.serif $[fg.color=0000 宴]]', 'fn'],
	['リンク名の中の透明文字', '[$[fg.color=0000 宴]](https://example.com/)', 'fn'],
	['別の文字で覆う移動', '宴$[position.x=-1 ■]', 'fn'],
	['別の文字で覆う背景', '宴$[bg.color=ffffff ■]', 'fn'],
	['本文内の数式', '\\(\\phantom{宴}\\)', 'mathInline'],
	['数式ブロック', '\\[\n\\phantom{宴}\n\\]', 'mathBlock'],
	['可視の宴と数式の併用', '宴\\(x\\)', 'mathInline'],
] as const;

describe('宴の可視文字判定', () => {
	test.each([
		['漢字', '今日は宴だ'],
		['ひらがな', 'うたげ'],
		['小書きのひらがな', 'ぅたげ'],
		['大文字混在', 'UtAgE'],
		['カスタム絵文字', ':utage:'],
		['名前の一部が宴のカスタム絵文字', ':super_utage_2:'],
		['太字', '**宴**'],
		['斜体', '<i>宴</i>'],
		['打ち消し', '~~宴~~'],
		['中央寄せ', '<center>宴</center>'],
		['単一の引用', '> 宴'],
		['プレーン表示', '<plain>$[fg.color=0000 宴]</plain>'],
		['インラインコード', '`宴`'],
		['コードに表示したMFM構文', '`$[fg.color=0000 宴]`'],
		['ハッシュタグ', '#宴'],
		['リンクの表示名', '[宴](https://example.com/)'],
		['2倍表示', '$[x2 宴]'],
		['3倍表示', '$[x3 宴]'],
		['4倍表示', '$[x4 宴]'],
		['フォント指定', '$[font.serif 宴]'],
		['安全な装飾の入れ子', '$[x2 **$[font.monospace 宴]**]'],
		['関係のないURLを併記', '宴 https://example.com/'],
		['関係のないコードブロックを併記', '宴\n```\n$[fg.color=0000 日常]\n```'],
	])('%sは対象になる', (_label, text) => {
		expect(isUtageEligible(note({ text }))).toBe(true);
	});

	test.each(concealedTexts)('%sは対象にならない', (_label, text, nodeType) => {
		// 対照の構文が単なる文字列に戻っていないことを、実際のMFMパーサーで確認する。
		expect(mfm.extract(mfm.parse(text), node => node.type === nodeType).length).toBeGreaterThan(0);
		expect(isUtageEligible(note({ text }))).toBe(false);
	});

	test.each([
		['リンク先だけが宴', '[日常](https://example.com/utage)'],
		['URLだけが宴', 'https://example.com/utage'],
		['ローカルメンションだけが宴', '@utage'],
		['リモートメンションだけが宴', '@person@utage.example'],
		['関数の引数だけが宴', '$[font.utage 日常]'],
		['関数名だけが宴', '$[utage 日常]'],
		['コードブロックの言語指定だけが宴', '```utage\n日常\n```'],
		['コードブロックの中だけが宴', '```\n宴\n```'],
		['検索欄の中だけが宴', '宴 [検索]'],
		['宴ワードなし', ':kyattukya:'],
		['空文字', ''],
	])('%sは対象にならない', (_label, text) => {
		expect(isUtageEligible(note({ text }))).toBe(false);
	});

	test('コードブロックと検索の対照が各MFMノードとして解析される', () => {
		expect(mfm.parse('```utage\n日常\n```')).toEqual([
			expect.objectContaining({ type: 'blockCode', props: expect.objectContaining({ lang: 'utage', code: '日常' }) }),
		]);
		expect(mfm.parse('宴 [検索]')).toEqual([
			expect.objectContaining({ type: 'search', props: expect.objectContaining({ query: '宴' }) }),
		]);
	});

	test.each(['> > 宴', '宴\n> > 日常'])('引用の入れ子があれば可視欄全体を対象外にする: %s', (text) => {
		expect(mfm.extract(mfm.parse(text), node => node.type === 'quote')).toHaveLength(2);
		expect(isUtageEligible(note({ text }))).toBe(false);
	});

	test.each([null, undefined])('本文が%jなら対象外', (text) => {
		expect(isUtageEligible(note({ text }))).toBe(false);
	});
});

describe('宴のCW判定', () => {
	test.each([
		['本文の宴がCWに隠れている', { cw: '日常', text: '宴' }, false],
		['空CWでも本文が隠れている', { cw: '', text: '宴' }, false],
		['CW自体が宴', { cw: '宴', text: '日常' }, true],
		['CWだけがあり本文がない', { cw: '宴', text: null }, true],
		['CW内の透明文字', { cw: '$[fg.color=0000 宴]', text: '宴' }, false],
		['CW内の透明文字を通常の本文で補えない', { cw: '$[fg.color=0000 日常]', text: '宴' }, false],
		['隠れた本文の装飾は可視CWを妨げない', { cw: '宴', text: '$[fg.color=0000 日常]' }, true],
	] as const)('%s', (_label, overrides, eligible) => {
		expect(isUtageEligible(note(overrides))).toBe(eligible);
	});
});

describe('宴のLTL参加条件', () => {
	test.each([
		['home', { visibility: 'home' }],
		['followers', { visibility: 'followers' }],
		['specified', { visibility: 'specified' }],
		['リモートユーザー', { userHost: 'remote.example' }],
		['チャンネル', { channelId: 'channel-a' }],
	] as const)('%sは可視文字が宴でも対象外', (_label, overrides) => {
		expect(isUtageEligible(note(overrides))).toBe(false);
	});
});
