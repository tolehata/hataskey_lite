/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { splitHataFeedNotificationBody } from './hatafeed-notification-emoji.js';

describe('splitHataFeedNotificationBody', () => {
	test.each([
		['The request for emoji “:seal:” was approved.', 'seal'],
		['表情“:seal:”的申请已通过。', 'seal'],
		['絵文字「:seal:」の申請が承認されました。', 'seal'],
	])('言語にかかわらずローカル絵文字へ配信URLを与える: %s', (text, name) => {
		expect(splitHataFeedNotificationBody(text)).toContainEqual({
			type: 'emoji',
			name,
			host: null,
			url: `/emoji/${name}.webp`,
		});
	});

	test('リモート絵文字はホストを保持し、任意のURLを組み立てない', () => {
		expect(splitHataFeedNotificationBody('reaction :wave@example.com:')).toContainEqual({
			type: 'emoji',
			name: 'wave',
			host: 'example.com',
			url: undefined,
		});
	});

	test('HTMLらしい文字列はテキストのまま保持する', () => {
		expect(splitHataFeedNotificationBody('<b>:seal:</b>')).toEqual([
			{ type: 'text', text: '<b>' },
			{ type: 'emoji', name: 'seal', host: null, url: '/emoji/seal.webp' },
			{ type: 'text', text: '</b>' },
		]);
	});
});
