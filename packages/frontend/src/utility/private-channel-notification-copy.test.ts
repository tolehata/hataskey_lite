/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';

vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'en-US' }));
vi.mock('@/i18n.js', () => ({
	i18n: {
		tsx: {
			_hata: {
				_privateChannels: {
					invitationNotificationBodyWithName: ({ name }: { name: string }) => `Invitation to ${name}`,
					addedManagerNotificationBodyWithName: ({ name }: { name: string }) => `Added as manager of ${name}`,
					removedManagerNotificationBodyWithName: ({ name }: { name: string }) => `Removed as manager of ${name}`,
					removedMemberNotificationBodyWithName: ({ name }: { name: string }) => `Removed as member of ${name}`,
				},
			},
		},
	},
}));

import { privateChannelNotificationDisplayBody } from './private-channel-notification-copy.js';

describe('privateChannelNotificationDisplayBody', () => {
	test.each([
		['プライベートチャンネル「読書会」への参加招待が届きました。参加するか選んでください。', 'Invitation to 読書会'],
		['プライベートチャンネル「読書会」の副管理者に追加されました。タップしてチャンネルを開く。', 'Added as manager of 読書会'],
		['プライベートチャンネル「読書会」の副管理者から外れました。', 'Removed as manager of 読書会'],
		['プライベートチャンネル「読書会」のメンバーから外れました。', 'Removed as member of 読書会'],
	])('既知の本文をチャンネル名を保って翻訳する: %s', (source, expected) => {
		expect(privateChannelNotificationDisplayBody(source)).toBe(expected);
	});

	test('日本語表示と未知本文は原文を維持する', () => {
		const source = '将来追加されたプライベートチャンネル通知';
		expect(privateChannelNotificationDisplayBody(source)).toBe(source);
		expect(privateChannelNotificationDisplayBody('プライベートチャンネル「読書会」のメンバーから外れました。', 'ja-JP')).toBe('プライベートチャンネル「読書会」のメンバーから外れました。');
	});
});
