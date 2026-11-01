/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { parseHataskCapture } from './hatask-capture-parser.js';

describe('parseHataskCapture', () => {
	test('日時、フォルダ、優先度をタイトルから安全に分離する', () => {
		expect(parseHataskCapture('明日14時 歯医者 #生活 !高', {
			now: new Date(2026, 7, 30, 12),
			folders: [{ id: 'life', name: '生活' }],
		})).toEqual({
			title: '歯医者',
			date: '2026-08-31',
			time: '14:00',
			folderId: 'life',
			priority: 'high',
			recognized: ['明日', '14時', '#生活', '!高'],
		});
	});

	test('不明なハッシュタグや壊れた時刻はタイトルへ残す', () => {
		expect(parseHataskCapture('25:99 #知らない 調べる', {
			now: new Date(2026, 7, 30, 12),
			folders: [{ id: 'life', name: '生活' }],
		}).title).toBe('25:99 #知らない 調べる');
	});

	test('予定入力ではフォルダと優先度を解釈しない', () => {
		const result = parseHataskCapture('今日 午後3時 打ち合わせ #仕事 !高', {
			now: new Date(2026, 7, 30, 12),
			folders: [{ id: 'work', name: '仕事' }],
			allowFolder: false,
			allowPriority: false,
		});
		expect(result).toMatchObject({ date: '2026-08-30', time: '15:00', title: '打ち合わせ #仕事 !高' });
	});
});
