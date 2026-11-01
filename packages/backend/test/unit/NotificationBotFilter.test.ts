/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type { MiNotification } from '@/models/Notification.js';
import { filterNotificationsFromBotIds } from '@/core/NotificationService.js';

function notification(value: Partial<MiNotification> & Pick<MiNotification, 'id' | 'type'>): MiNotification {
	return {
		createdAt: '2026-08-11T00:00:00.000Z',
		...value,
	} as MiNotification;
}

describe('notification bot filter', () => {
	test('Botフラグ付き通知元だけを除外し、通常利用者とシステム通知は残す', () => {
		const notifications = [
			notification({ id: 'bot-reaction', type: 'reaction', notifierId: 'bot', noteId: 'note', reaction: ':bot:' }),
			notification({ id: 'person-reaction', type: 'reaction', notifierId: 'person', noteId: 'note', reaction: ':person:' }),
			notification({ id: 'system', type: 'app', customBody: 'body', customHeader: null, customIcon: null, customLink: null, appAccessTokenId: null }),
			notification({ id: 'channel-system', type: 'addedToPrivateChannel', notifierId: null, customBody: 'body', customHeader: null, customIcon: null, customLink: null }),
		];

		expect(filterNotificationsFromBotIds(notifications, new Set(['bot'])).map(item => item.id)).toEqual([
			'person-reaction',
			'system',
			'channel-system',
		]);
	});
});
