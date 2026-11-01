/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, test } from 'vitest';
import { normalizeConcrntServerInfo } from './server-info.js';

const domain = 'social.example';

describe('接続先サーバーの表示情報', () => {
	test('公式のnicknameとlogoだけを表示用に取り出す', () => {
		expect(normalizeConcrntServerInfo(domain, {
			nickname: '  交流の場所  ', logo: 'https://cdn.example/server.png',
			description: 'description', name: '別名を推測しない', icon: 'https://other.example/icon.png', secret: 'fixture-only',
		})).toEqual({ domain, name: '交流の場所', iconUrl: 'https://cdn.example/server.png' });
	});

	test.each([undefined, null, [], 'invalid', { name: 'unsupported', icon: 'https://cdn.example/icon.png' }, { nickname: 42, logo: {} }])('未設定や不正なmetaはドメイン名へ戻す: %j', meta => {
		expect(normalizeConcrntServerInfo(domain, meta)).toEqual({ domain, name: domain });
	});

	test.each(['', ' \u3000 ', 'a'.repeat(201), 'name\u0000tail', 'name\nline'])('空・長すぎる・制御文字付きの名前を表示しない: %j', nickname => {
		expect(normalizeConcrntServerInfo(domain, { nickname })).toEqual({ domain, name: domain });
	});

	test.each([
		'http://cdn.example/icon.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA',
		'/icon.png', '//cdn.example/icon.png', 'https://user:pass@cdn.example/icon.png',
		'https://localhost/icon.png', 'https://host.local/icon.png', 'https://host.localhost/icon.png',
		'https://host.internal/icon.png', 'https://127.0.0.1/icon.png', 'https://[::1]/icon.png',
		'https://localhost./icon.png', 'https://host.local./icon.png', 'https://host.internal./icon.png',
		`https://cdn.example/${'a'.repeat(4096)}`,
	])('公開HTTPS画像として使えないlogoを捨てても名前は保つ: %s', logo => {
		expect(normalizeConcrntServerInfo(domain, { nickname: 'サーバー名', logo })).toEqual({ domain, name: 'サーバー名' });
	});
});
