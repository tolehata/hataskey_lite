/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { notificationTypes } from 'cherrypick-js';
import { hasConfiguredNotificationFilter, isNotificationFromBot, migrateNotificationFilterSnapshot, resolveNotificationFilter, serializeNotificationFilter } from './notification-filter.js';
import type * as Misskey from 'cherrypick-js';

vi.mock('@/i18n.js', () => ({ i18n: {} }));

describe('notification filter persistence', () => {
	test('旧設定は現在の表示状態を勝手に変えない', () => {
		const result = resolveNotificationFilter(['reaction'], []);

		expect(result.excludeTypes).toEqual(['reaction']);
		expect(result.knownTypes).toEqual([...notificationTypes]);
	});

	test('除外項目がある旧設定だけを現在の通知種別スナップショットへ移行する', () => {
		const migrated = migrateNotificationFilterSnapshot(['reaction'], []);

		expect(migrated).toEqual({
			excludeTypes: ['reaction'],
			knownTypes: [...notificationTypes],
		});
		expect(migrateNotificationFilterSnapshot([], [])).toBeNull();
		expect(migrateNotificationFilterSnapshot(['reaction'], ['mention'])).toBeNull();
	});

	test('除外または既知種別が保存済みなら設定済みと判定する', () => {
		expect(hasConfiguredNotificationFilter(['reaction'], [])).toBe(true);
		expect(hasConfiguredNotificationFilter([], ['mention'])).toBe(true);
		expect(hasConfiguredNotificationFilter([], [])).toBe(false);
	});

	test('保存後に追加された通知種別は利用者が選ぶまでOFFにする', () => {
		const knownTypes = notificationTypes.filter(type => type !== 'scheduledNotePosted' && type !== 'scheduledNotePostFailed');
		const result = resolveNotificationFilter([], knownTypes);

		expect(result.excludeTypes).toContain('scheduledNotePosted');
		expect(result.excludeTypes).toContain('scheduledNotePostFailed');
	});

	test('古いクライアントで保存しても未知の通知設定を捨てない', () => {
		const result = serializeNotificationFilter(
			['reaction'],
			['futureNotification', 'mention'],
			['futureNotification'],
		);

		expect(result.excludeTypes).toEqual(['futureNotification', 'reaction']);
		expect(result.knownTypes).toContain('futureNotification');
		expect(result.knownTypes).toEqual(expect.arrayContaining([...notificationTypes]));
	});

	test('Botフラグ付き通知だけをBot由来として判定する', () => {
		const bot = { id: 'bot', isBot: true };
		const person = { id: 'person', isBot: false };
		expect(isNotificationFromBot({ type: 'follow', user: bot } as Misskey.entities.Notification)).toBe(true);
		expect(isNotificationFromBot({ type: 'follow', user: person } as Misskey.entities.Notification)).toBe(false);
		expect(isNotificationFromBot({ type: 'app' } as Misskey.entities.Notification)).toBe(false);
	});

	test('グループ通知は全員がBotの場合だけ全体をBot由来として判定する', () => {
		const bot = { id: 'bot', isBot: true };
		const person = { id: 'person', isBot: false };
		expect(isNotificationFromBot({ type: 'reaction:grouped', reactions: [{ user: bot }] } as Misskey.entities.Notification)).toBe(true);
		expect(isNotificationFromBot({ type: 'reaction:grouped', reactions: [{ user: bot }, { user: person }] } as Misskey.entities.Notification)).toBe(false);
		expect(isNotificationFromBot({ type: 'renote:grouped', users: [bot] } as Misskey.entities.Notification)).toBe(true);
	});
});
