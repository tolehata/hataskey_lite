/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { notificationTypes as clientNotificationTypes } from 'cherrypick-js';
import { describe, expect, test } from 'vitest';
import { notificationFilterTypes, obsoleteNotificationTypes } from '@/types.js';
import { paramDef as notificationsParamDef } from '@/server/api/endpoints/i/notifications.js';
import { paramDef as groupedNotificationsParamDef } from '@/server/api/endpoints/i/notifications-grouped.js';

describe('notification filter types', () => {
	test('フロントとバックエンドのフィルタ対象が一致する', () => {
		expect(new Set(notificationFilterTypes)).toEqual(new Set(clientNotificationTypes));
	});

	test.each([
		['i/notifications', notificationsParamDef],
		['i/notifications-grouped', groupedNotificationsParamDef],
	])('%s は通知を種類ごとに絞り込める', (_name, paramDef) => {
		const accepted = [...notificationFilterTypes, ...obsoleteNotificationTypes];
		expect(paramDef.properties.includeTypes.items.enum).toEqual(accepted);
		expect(paramDef.properties.excludeTypes.items.enum).toEqual(accepted);
	});
});
