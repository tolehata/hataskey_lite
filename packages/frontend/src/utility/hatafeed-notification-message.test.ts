/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';

vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'en-US' }));
vi.mock('@/i18n.js', () => {
	const shared = new Proxy<Record<string, string>>({}, { get: (_target, key) => String(key) });
	const sharedx = new Proxy<Record<string, (params: Record<string, unknown>) => string>>({}, {
		get: (_target, key) => (params: Record<string, unknown>) => `${String(key)}:${JSON.stringify(params)}`,
	});
	return {
		i18n: {
			ts: { _hata: { _hatafeed: { _shared: shared, _emojiChangeCommon: shared, _notificationGroup: { newIssue: 'New issue.' } } } },
			tsx: { _hata: { _hatafeed: { _shared: sharedx, _notificationGroup: {
				issuePosted: ({ title }: { title: string }) => `Issue “${title}” was posted.`,
			} } } },
		},
	};
});

import { notificationDisplayMessage } from './hatafeed.js';

describe('notificationDisplayMessage', () => {
	test('HataFeed一覧でも固定文と動的文を表示時翻訳し、固有情報を保つ', () => {
		expect(notificationDisplayMessage({ message: '新しいイシューが投稿されました。' } as never)).toBe('New issue.');
		expect(notificationDisplayMessage({ message: '「画面が白い」のイシューが投稿されました。' } as never)).toBe('Issue “画面が白い” was posted.');
	});

	test('未知本文は汎用文へ潰さず原文を維持する', () => {
		const message = '将来追加された本文「重要な詳細」';
		expect(notificationDisplayMessage({ message } as never)).toBe(message);
	});
});
