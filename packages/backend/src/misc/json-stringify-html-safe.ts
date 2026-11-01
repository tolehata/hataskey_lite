/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 本家 2026.6.0 から取り込み (OAuth2 認可画面 HtmlTemplateService 依存)。
// ClientServerService.ts は引き続き htmlescape パッケージを使用するが、本家の
// HtmlTemplateService / views/*.tsx 系は本ユーティリティを使う。
//
// 旗鯖fork: U+2028/U+2029 を ECMAScript の文字列・正規表現リテラル内に直接埋め込むと
// swc がそれを改行扱いしてしまうため、String.fromCharCode でランタイム生成する形に
// 書き換えた。バックスラッシュも同様にエスケープ二重化問題を回避するため
// String.fromCharCode(0x5c) で動的構築。

const BS = String.fromCharCode(0x5c);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

const ESCAPE_LOOKUP: Record<string, string> = {
	'&': BS + 'u0026',
	'>': BS + 'u003e',
	'<': BS + 'u003c',
	[LS]: BS + 'u2028',
	[PS]: BS + 'u2029',
};

const ESCAPE_REGEX = new RegExp('[&><' + LS + PS + ']', 'g');

export function htmlSafeJsonStringify(obj: any): string {
	return JSON.stringify(obj).replace(ESCAPE_REGEX, x => ESCAPE_LOOKUP[x]);
}
