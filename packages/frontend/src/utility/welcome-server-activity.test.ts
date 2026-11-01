/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { parseServerMembers, summarizeServerActivity } from './welcome-server-activity.js';

describe('ログイン画面のサーバー人数', () => {
	test('ローカル人数を採用し、リモート込みの人数と区別する', () => {
		const response = { originalUsersCount: 42, usersCount: 9000 };
		expect(parseServerMembers(response)).toBe(42);
		// usersCount を誤採用する実装では一致しない陽性対照。
		expect(parseServerMembers(response)).not.toBe(response.usersCount);
	});

	test('正常な0人と取得できない状態を区別する', () => {
		expect(parseServerMembers({ originalUsersCount: 0 })).toBe(0);
		expect(parseServerMembers(null)).toBeNull();
		expect(parseServerMembers({ usersCount: 0 })).toBeNull();
	});

	test('安全な整数の上限まで受け入れる', () => {
		expect(parseServerMembers({ originalUsersCount: Number.MAX_SAFE_INTEGER })).toBe(Number.MAX_SAFE_INTEGER);
	});

	test.each([undefined, null, -1, 0.5, '42', true, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])('不正な人数 %s を0に補完しない', (value) => {
		expect(parseServerMembers({ originalUsersCount: value })).toBeNull();
	});

	test.each([undefined, null, 0, '42', true, [], {}])('統計オブジェクトでない応答 %s を拒否する', (response) => {
		expect(parseServerMembers(response)).toBeNull();
	});
});

describe('ログイン画面のアクティブ人数', () => {
	test('今日の途中集計を除外し、昨日を含む完了7日を平均する', () => {
		const read = [700, 7, 6, 5, 4, 3, 2, 1];
		const summary = summarizeServerActivity({ read });
		expect(summary).toEqual({ yesterday: 7, average: 4 });
		// 今日を混ぜる／昨日を先頭と誤解する旧式計算を区別できる陽性対照。
		expect(summary).not.toEqual({ yesterday: read[0], average: read.slice(0, 7).reduce((sum, count) => sum + count, 0) / 7 });
	});

	test('平均値は丸めず、表示上の丸めを呼び出し側へ任せる', () => {
		expect(summarizeServerActivity({ read: [900, 1, 0, 0, 0, 0, 0, 0] })).toEqual({ yesterday: 1, average: 1 / 7 });
	});

	test('使わない今日や8日より古い値の不正データに影響されない', () => {
		expect(summarizeServerActivity({ read: [null, 7, 6, 5, 4, 3, 2, 1, Infinity] })).toEqual({ yesterday: 7, average: 4 });
	});

	test('writeとreadWriteを人数に加算しない', () => {
		expect(summarizeServerActivity({
			read: [0, 7, 6, 5, 4, 3, 2, 1],
			write: Array(8).fill(100),
			readWrite: Array(8).fill(90),
		})).toEqual({ yesterday: 7, average: 4 });
	});

	test('正常な活動0人と取得できない状態を区別する', () => {
		expect(summarizeServerActivity({ read: Array(8).fill(0) })).toEqual({ yesterday: 0, average: 0 });
		expect(summarizeServerActivity(null)).toBeNull();
		expect(summarizeServerActivity({ read: [] })).toBeNull();
	});

	test('7日分が揃わなければ昨日の値だけ有効でも返さない', () => {
		expect(summarizeServerActivity({ read: [500, 7] })).toBeNull();
		expect(summarizeServerActivity({ read: [500, 7, 6, 5, 4, 3, 2] })).toBeNull();
	});

	test('疎な配列を7日分のデータとして扱わない', () => {
		const read = Array(8);
		read[1] = 7;
		expect(summarizeServerActivity({ read })).toBeNull();
	});

	test('完了7日のすべてを検証し、不正値を平均へ混ぜない', () => {
		for (const invalid of [undefined, null, -1, 0.5, '7', true, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
			for (let index = 1; index <= 7; index++) {
				const read: unknown[] = [500, 7, 6, 5, 4, 3, 2, 1];
				read[index] = invalid;
				expect(summarizeServerActivity({ read }), `index ${index}, value ${String(invalid)}`).toBeNull();
			}
		}
	});

	test('大きな有効値でも平均を有限数として返す', () => {
		const summary = summarizeServerActivity({ read: Array(8).fill(Number.MAX_SAFE_INTEGER) });
		expect(summary?.yesterday).toBe(Number.MAX_SAFE_INTEGER);
		expect(Number.isFinite(summary?.average)).toBe(true);
		expect(summary?.average).toBeGreaterThan(0);
	});

	test('入力配列を並べ替えたり書き換えたりしない', () => {
		const read = Object.freeze([500, 7, 6, 5, 4, 3, 2, 1]);
		expect(summarizeServerActivity(Object.freeze({ read }))).toEqual({ yesterday: 7, average: 4 });
		expect(read).toEqual([500, 7, 6, 5, 4, 3, 2, 1]);
	});

	test.each([undefined, null, 0, '8', true, [], {}, { read: null }, { read: '01234567' }, { read: {} }])('集計オブジェクトでない応答 %s を拒否する', (response) => {
		expect(summarizeServerActivity(response)).toBeNull();
	});
});
