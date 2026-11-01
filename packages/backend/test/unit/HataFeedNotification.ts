/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { mergeHataFeedRecipients } from '@/misc/hatafeed-notification.js';

describe('HataFeed notification helpers', () => {
	test('起票者・参加者・スタッフを兼ねる利用者へ同じ通知を重ねない', () => {
		expect(mergeHataFeedRecipients(
			['actor'],
			['creator'],
			['commenter', 'creator'],
			['staff', 'creator', 'actor'],
		)).toEqual(['creator', 'commenter', 'staff']);
	});
});
