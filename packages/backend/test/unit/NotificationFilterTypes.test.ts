/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { notificationTypes as clientNotificationTypes } from 'cherrypick-js';
import { describe, expect, test } from 'vitest';
import { hatadyNotificationSubtypes, notificationFilterTypes } from '@/types.js';
import { paramDef as notificationsParamDef } from '@/server/api/endpoints/i/notifications.js';
import { paramDef as groupedNotificationsParamDef } from '@/server/api/endpoints/i/notifications-grouped.js';
import { paramDef as updateParamDef } from '@/server/api/endpoints/i/update.js';
import { notificationRecieveConfig, packedMeDetailedOnlySchema } from '@/models/json-schema/user.js';

describe('notification filter types', () => {
	test('花の受信設定を保存APIとユーザー取得スキーマの両方に公開する', () => {
		expect(updateParamDef.properties.notificationRecieveConfig.properties.hataskFlowerReady).toEqual(notificationRecieveConfig);
		expect(packedMeDetailedOnlySchema.properties.notificationRecieveConfig.properties.hataskFlowerReady).toEqual({ optional: true, ...notificationRecieveConfig });
		for (const type of ['hatady', 'hataFeed'] as const) {
			expect(updateParamDef.properties.notificationRecieveConfig.properties[type]).toEqual(notificationRecieveConfig);
			expect(packedMeDetailedOnlySchema.properties.notificationRecieveConfig.properties[type]).toEqual({ optional: true, ...notificationRecieveConfig });
		}
	});

	test('フロントとバックエンドのフィルタ対象が一致する', () => {
		expect(new Set(notificationFilterTypes)).toEqual(new Set(clientNotificationTypes));
	});

	test('アイコンデコ獲得通知は受信拒否の設定項目を公開しない', () => {
		expect(notificationFilterTypes).toContain('hataskDecorationUnlocked');
		expect(updateParamDef.properties.notificationRecieveConfig.properties).not.toHaveProperty('hataskDecorationUnlocked');
		expect(packedMeDetailedOnlySchema.properties.notificationRecieveConfig.properties).not.toHaveProperty('hataskDecorationUnlocked');
	});

	test.each([
		['i/notifications', notificationsParamDef],
		['i/notifications-grouped', groupedNotificationsParamDef],
	])('%s は独自通知を種類ごとに絞り込める', (_name, paramDef) => {
		const includeEnum = paramDef.properties.includeTypes.items.enum;
		const excludeEnum = paramDef.properties.excludeTypes.items.enum;

		for (const type of ['addedToPrivateChannel', 'removedFromPrivateChannel', 'hataskFlowerReady', 'hataskDecorationUnlocked']) {
			expect(includeEnum).toContain(type);
			expect(excludeEnum).toContain(type);
		}
		expect(paramDef.properties.brand.enum).toEqual(['all', 'standard', 'hatady', 'hatask', 'hataFeed']);
		expect(paramDef.properties.includeBrands.items.enum).toEqual(['standard', 'hatady', 'hatask', 'hataFeed']);
		expect(paramDef.properties.includeHataskApp).toEqual({ type: 'boolean' });
		expect(paramDef.properties.includeHatadySubtypes.items.enum).toEqual(hatadyNotificationSubtypes);
		expect(paramDef.properties.excludeHatadySubtypes.items.enum).toEqual(hatadyNotificationSubtypes);
	});
});
