/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { sanitizeServerDescription } from './sanitize-server-description.js';

describe('サーバー紹介のHTML無害化', () => {
	test('文字装飾・段落・改行・リストは残す（陽性対照）', () => {
		expect(sanitizeServerDescription('<p><b>ようこそ</b>、<em>旗</em>の<br>サーバー</p><ul><li>一</li></ul>')).toBe('<p><b>ようこそ</b>、<em>旗</em>の<br />サーバー</p><ul><li>一</li></ul>');
	});

	test('httpsリンクは新しいタブで開き、opener・referrerを渡さない', () => {
		expect(sanitizeServerDescription('<a href="https://example.com/rules" target="_self" rel="opener">規約</a>')).toBe('<a href="https://example.com/rules" target="_blank" rel="noopener noreferrer nofollow">規約</a>');
	});

	test.each([
		['script', '<script>alert(1)</script>本文', '本文'],
		['イベント属性', '<b onclick="alert(1)" onmouseover="alert(1)">本文</b>', '<b>本文</b>'],
		['img onerror', '<img src=x onerror="alert(1)">本文', '本文'],
		['svg onload', '<svg onload="alert(1)"><circle/></svg>本文', '本文'],
		['iframe', '<iframe src="https://evil.test"></iframe>本文', '本文'],
		['style', '<style>body{display:none}</style><span style="position:fixed;inset:0">本文</span>', '<span>本文</span>'],
		['class', '<span class="_button">本文</span>', '<span>本文</span>'],
		['form', '<form action="https://evil.test"><input name="password"></form>本文', '本文'],
		['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.test">本文', '本文'],
		['javascript URL', '<a href="javascript:alert(1)">本文</a>', '<a target="_blank" rel="noopener noreferrer nofollow">本文</a>'],
		['大文字・空白入りjavascript URL', '<a href=" JaVaScRiPt:alert(1)">本文</a>', '<a target="_blank" rel="noopener noreferrer nofollow">本文</a>'],
		['実体参照で隠したjavascript URL', '<a href="&#106;avascript:alert(1)">本文</a>', '<a target="_blank" rel="noopener noreferrer nofollow">本文</a>'],
		['data URL', '<a href="data:text/html,<script>alert(1)</script>">本文</a>', '<a target="_blank" rel="noopener noreferrer nofollow">本文</a>'],
		['プロトコル相対URL', '<a href="//evil.test">本文</a>', '<a target="_blank" rel="noopener noreferrer nofollow">本文</a>'],
	])('%sを取り除く', (_name, input, expected) => {
		const output = sanitizeServerDescription(input);
		expect(output).toBe(expected);
		expect(output).not.toMatch(/<(?:script|img|svg|iframe|style|form|input|meta)\b|\son\w+=|javascript:|data:|style=|class=/i);
	});

	test('タグとして解釈されない文字はエスケープする', () => {
		expect(sanitizeServerDescription('1 < 2 & "引用"')).toBe('1 &lt; 2 &amp; "引用"');
	});

	test.each([null, undefined, 42, '', '   ', '<script>alert(1)</script>', '<br><p> </p>'])('表示できる文字が残らない値 %j は空文字にする', value => {
		expect(sanitizeServerDescription(value)).toBe('');
	});
});
