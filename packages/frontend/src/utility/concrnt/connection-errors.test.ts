/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, test } from 'vitest';
import { formatConcrntConnectionError, inConcrntConnectionPhase } from './connection-errors.js';

describe('接続失敗の段階と原因の表示', () => {
	test.each([
		['export-format', '文字列全体を貼り付け'],
		['owner-id', 'アカウントIDを確認'],
		['private-key', 'サブキーが有効な形式ではありません'],
		['domain', '接続先ドメインの形式'],
		['domain-mismatch', 'ドメインが一致しません'],
		['master-key', '主鍵は連携に使用できません'],
		['key-derivation', '識別情報を計算できません'],
	])('入力理由 %s を段階ラップの後も固定案内で表示する', async (inputIssue, expected) => {
		const secret = 'fixture-private-key-and-token';
		const original = Object.assign(new Error(secret), { code: 'invalid-input', inputIssue, url: secret, secret });
		const wrapped = await inConcrntConnectionPhase('subkey', () => Promise.reject(original)).catch(value => value);
		expect(wrapped).toMatchObject({ code: 'invalid-input', phase: 'subkey', inputIssue });
		expect(formatConcrntConnectionError(wrapped)).toContain(expected);
		expect(`${String(wrapped)}${JSON.stringify(wrapped)}`).not.toContain(secret);
	});

	test('任意の入力理由は例外や表示へ引き継がない', async () => {
		const secret = 'fixture-private-key-and-token';
		const wrapped = await inConcrntConnectionPhase('subkey', () => Promise.reject({ code: 'invalid-input', inputIssue: secret })).catch(value => value);
		expect(wrapped.inputIssue).toBeUndefined();
		expect(formatConcrntConnectionError(wrapped)).toContain('コピーしたサブキーの文字列全体が入力されているか確認');
		expect(`${String(wrapped)}${JSON.stringify(wrapped)}`).not.toContain(secret);
	});

	test('公開情報の拒否をサブキー失効や通常の通信失敗と混同しない', () => {
		const message = formatConcrntConnectionError({ code: 'auth', status: 403, phase: 'server' });
		expect(message).toContain('公開サーバー情報へのアクセスが拒否');
		expect(message).toContain('HTTP 403');
		expect(message).toContain('サブキーを送信していません');
		expect(message).not.toContain('再連携');
	});

	test('ブラウザの通信失敗ではCORSやアクセス制限を原因と断定しない', () => {
		const message = formatConcrntConnectionError(new TypeError('Failed to fetch'), 'server');
		expect(message).toContain('公開サーバー情報を取得できませんでした');
		expect(message).toContain('通信許可（CORS）を確認');
		expect(message).not.toContain('拒否されました');
	});

	test('v2の形式不一致、プロフィール取得、端末保存を区別する', () => {
		expect(formatConcrntConnectionError({ code: 'capability' }, 'server')).toContain('Concrnt v2対応と必要な機能');
		expect(formatConcrntConnectionError({ code: 'capability' }, 'profiles')).toContain('プロフィールの応答');
		expect(formatConcrntConnectionError({ code: 'network', status: 502 }, 'profiles')).toContain('プロフィールを確認できませんでした（HTTP 502）');
		expect(formatConcrntConnectionError(new DOMException('quota', 'QuotaExceededError'), 'storage')).toContain('保存領域を利用できませんでした');
	});

	test('認証失敗を保持し、例外本文やURLや任意の段階名を表示しない', () => {
		const secret = 'fixture-private-key-and-token';
		const error = Object.assign(new Error(secret), { code: 'network', phase: secret, status: secret, url: `https://example.invalid/${secret}`, body: secret });
		expect(formatConcrntConnectionError(error)).not.toContain(secret);
		expect(formatConcrntConnectionError({ code: 'auth', phase: 'subkey' })).toContain('サブキーを確認して、再連携');
		expect(formatConcrntConnectionError({ code: 'auth', phase: 'registration', status: 403 })).toContain('鍵の失効とは限らない');
	});

	test('並行処理の失敗段階を保持し、ラップした例外にも秘密を引き継がない', async () => {
		const secret = 'fixture-private-key-and-token';
		const error = Object.assign(new Error(secret), { code: secret, phase: secret, url: secret });
		const result = await inConcrntConnectionPhase('storage', () => Promise.reject(error)).catch(value => value);
		expect(result).toMatchObject({ phase: 'storage', code: undefined, status: undefined });
		expect(`${String(result)}${JSON.stringify(result)}`).not.toContain(secret);
	});
});
