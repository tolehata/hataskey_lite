/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { akatsukiUsageScore, normalizeAkatsukiUsage, readAkatsukiUsage, recordAkatsukiUsage } from './hatask-akatsuki-usage.js';
import { miLocalStorage } from '@/local-storage.js';

const now = new Date(2026, 8, 7, 12).getTime();
const day = 86_400_000;
const allowed = ['cal', 'todo', 'drawing'];
let saved: Map<string, unknown>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(now);
	saved = new Map();
	vi.spyOn(miLocalStorage, 'getItemAsJson').mockImplementation(key => saved.get(key));
	vi.spyOn(miLocalStorage, 'setItemAsJson').mockImplementation((key, value) => { saved.set(key, structuredClone(value)); });
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('暁の端末内の利用頻度', () => {
	test('別アカウントと予定・日記の保存値を変更しない', () => {
		saved.set('planner', [{ title: '大切な予定' }]);
		recordAkatsukiUsage('alice', 'drawing', allowed);
		expect(readAkatsukiUsage('alice')).toEqual({ drawing: { score: 1, lastUsedAt: now } });
		expect(readAkatsukiUsage('bob')).toEqual({});
		recordAkatsukiUsage('bob', 'todo', allowed);
		expect(readAkatsukiUsage('alice')).toEqual({ drawing: { score: 1, lastUsedAt: now } });
		expect([...saved.keys()]).toEqual(['planner', 'hataskAkatsukiUsage:alice', 'hataskAkatsukiUsage:bob']);
		expect(saved.get('planner')).toEqual([{ title: '大切な予定' }]);
	});

	test('連続操作を数え直さず、別ツールの利用は保持する', () => {
		recordAkatsukiUsage('alice', 'drawing', allowed);
		vi.setSystemTime(now + 30_000);
		recordAkatsukiUsage('alice', 'drawing', allowed);
		expect(miLocalStorage.setItemAsJson).toHaveBeenCalledTimes(1);
		recordAkatsukiUsage('alice', 'todo', allowed);
		vi.setSystemTime(now + 60_000);
		const result = recordAkatsukiUsage('alice', 'drawing', allowed);
		expect(result.drawing.score).toBeGreaterThan(1.99);
		expect(result.todo).toEqual({ score: 1, lastUsedAt: now + 30_000 });
	});

	test('古い利用頻度は弱まり、最近使うツールが優先される', () => {
		const usage = { drawing: { score: 8, lastUsedAt: now - 28 * day }, todo: { score: 3, lastUsedAt: now } };
		expect(akatsukiUsageScore(usage, 'drawing', now)).toBe(2);
		expect(akatsukiUsageScore(usage, 'todo', now)).toBe(3);
		expect(akatsukiUsageScore(usage, 'cal', now)).toBe(0);
	});

	test('壊れた値・未来・古すぎる記録を除外し、大きな値を制限する', () => {
		expect(normalizeAkatsukiUsage(null, now)).toEqual({});
		expect(normalizeAkatsukiUsage([], now)).toEqual({});
		expect(normalizeAkatsukiUsage({
			drawing: { score: 1, lastUsedAt: now },
			todo: { score: 1000, lastUsedAt: now },
			future: { score: 1, lastUsedAt: now + 1 },
			old: { score: 1, lastUsedAt: now - 91 * day },
			invalid: { score: NaN, lastUsedAt: now },
			'/external': { score: 1, lastUsedAt: now },
		}, now)).toEqual({ drawing: { score: 1, lastUsedAt: now }, todo: { score: 100, lastUsedAt: now } });
	});

	test('利用できないツールや未ログインの読込では記録を作らない', () => {
		expect(readAkatsukiUsage(undefined)).toEqual({});
		expect(miLocalStorage.getItemAsJson).not.toHaveBeenCalled();
		expect(recordAkatsukiUsage('alice', 'feed', allowed)).toEqual({});
		expect(miLocalStorage.setItemAsJson).not.toHaveBeenCalled();
	});

	test('端末保存の読込・書込が拒否されてもツールを開く処理を妨げない', () => {
		vi.mocked(miLocalStorage.getItemAsJson).mockImplementation(() => { throw new Error('read denied'); });
		vi.mocked(miLocalStorage.setItemAsJson).mockImplementation(() => { throw new Error('write denied'); });
		expect(readAkatsukiUsage('alice')).toEqual({});
		expect(recordAkatsukiUsage('alice', 'drawing', allowed)).toEqual({ drawing: { score: 1, lastUsedAt: now } });
		expect(miLocalStorage.setItemAsJson).toHaveBeenCalledTimes(1);
	});
});
