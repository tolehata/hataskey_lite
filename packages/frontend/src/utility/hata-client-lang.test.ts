/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 起動時に読み込まれた言語と、Intl / <html lang> が食い違わないことを守る。
 * ⚠️判定は packages/backend/src/server/web/boot.js と同じでなければならない。
 *   食い違うと「UIは日本語なのに日付・曜日・お花の名前だけ英語」が再発する。
 */

import { describe, expect, test } from 'vitest';
import { resolveClientLang } from '@@/js/config.js';

const SUPPORTED = ['ja-JP', 'ja-KS', 'en-US', 'zh-CN', 'zh-TW', 'ko-KR'];

describe('起動時の言語判定', () => {
	test('設定画面で保存した言語を最優先する', () => {
		expect(resolveClientLang('ja-JP', SUPPORTED, 'en-US')).toBe('ja-JP');
		expect(resolveClientLang('zh-CN', SUPPORTED, 'ja-JP')).toBe('zh-CN');
	});

	test('未保存なら navigator.language に従う(ここが英語に落ちていた)', () => {
		// ⚠️以前は localStorage が空だと無条件で en-US になり、UI(日本語)とずれていた。
		expect(resolveClientLang(null, SUPPORTED, 'ja-JP')).toBe('ja-JP');
		expect(resolveClientLang(null, SUPPORTED, 'zh-CN')).toBe('zh-CN');
	});

	test('地域つきで一致しないときは接頭辞で拾う', () => {
		expect(resolveClientLang(null, SUPPORTED, 'ja')).toBe('ja-JP');
		expect(resolveClientLang(null, SUPPORTED, 'ko')).toBe('ko-KR');
	});

	test('対応していない言語と壊れた保存値は en-US へ落とす', () => {
		expect(resolveClientLang(null, SUPPORTED, 'pt-BR')).toBe('en-US');
		expect(resolveClientLang('xx-YY', SUPPORTED, 'pt-BR')).toBe('en-US');
		// 保存値が対応外でも、端末の言語が使えるならそちらを採る
		expect(resolveClientLang('xx-YY', SUPPORTED, 'ja-JP')).toBe('ja-JP');
	});
});
