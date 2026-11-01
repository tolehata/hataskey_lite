/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import notificationsPageSource from '@/pages/notifications.vue?raw';
import hatasabaDeckSource from '@/ui/_common_/hatasaba-deck.vue?raw';
import notificationsColumnSource from '@/ui/deck/notifications-column.vue?raw';
import widgetNotificationsSource from '@/widgets/WidgetNotifications.vue?raw';

describe('notification bot filter integration', () => {
	test('通常の通知画面がBot除外を共通タイムラインへ渡す', () => {
		expect(notificationsPageSource).toContain(':excludeBots="excludeBots"');
		expect(notificationsPageSource).toContain('_notificationFilter.botNotifications');
	});

	test('通知ウィジェットがBot除外を保存して共通タイムラインへ渡す', () => {
		expect(widgetNotificationsSource).toContain(':excludeBots="widgetProps.excludeBots"');
		expect(widgetNotificationsSource).toContain('widgetProps.excludeBots = excludeBots');
	});

	test('通常デッキとHataskey UIデッキがBot除外を保存する', () => {
		expect(notificationsColumnSource).toContain(':excludeBots="props.column.excludeBots"');
		expect(notificationsColumnSource).toContain('changes.excludeBots = excludeBots');
		expect(notificationsColumnSource).toContain('updateColumn(props.column.id, changes)');
		expect(hatasabaDeckSource).toContain('excludeBots: tab.excludeBots === true');
		expect(hatasabaDeckSource).toContain('excludeBots: res.excludeBots');
	});
});
