/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { isDeliverableNotification } from '@/core/entities/NotificationEntityService.js';
import { groupedNotificationTypes, obsoleteNotificationTypes } from '@/types.js';

describe('Hataskeyから移行したときに残る通知', () => {
	test('Liteにある通知の種類はすべて配る', () => {
		for (const type of [...groupedNotificationTypes, ...obsoleteNotificationTypes]) {
			expect(isDeliverableNotification({ type, achievement: 'notes1' }), type).toBe(true);
		}
	});

	test.each(['earthquake', 'hataFeed', 'hatady', 'hataskFestivalBloomed', 'hataskFlowerBloomed', 'hataskFlowerReady', 'hataskZukanUpdated'])('撤去した機能の通知 %s は配らない', type => {
		expect(isDeliverableNotification({ type })).toBe(false);
	});

	test('撤去した実績の獲得通知は配らず、残っている実績は配る', () => {
		for (const achievement of ['utageSuccess10', 'utageInterruptionWithin5Seconds', 'ltlPunchVictory', 'welcomeToHatask']) {
			expect(isDeliverableNotification({ type: 'achievementEarned', achievement }), achievement).toBe(false);
		}
		expect(isDeliverableNotification({ type: 'achievementEarned', achievement: 'hataSideStudioPioneer' })).toBe(true);
	});
});
