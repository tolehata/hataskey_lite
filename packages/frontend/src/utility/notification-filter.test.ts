/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { notificationTypes, hatadyNotificationSubtypes } from 'cherrypick-js';
import { HATASK_NOTIFICATION_TYPES, STANDARD_NOTIFICATION_TYPES, hasConfiguredNotificationFilter, isNotificationFromBot, migrateNotificationFilterSnapshot, resolveNotificationFilter, resolveNotificationFilterDetails, serializeNotificationFilter, serializeNotificationFilterDetails } from './notification-filter.js';
import { effectiveNotificationType, matchesNotificationView, notificationBrand } from './notification-brand.js';
import type * as Misskey from 'cherrypick-js';

vi.mock('@/i18n.js', () => ({ i18n: {} }));

describe('notification brands and live filters', () => {
	test.each(['all', 'hatask'] as const)('アイコンデコ獲得は%sで種類を除外しても表示する', brand => {
		const reward = { id: 'reward', type: 'hataskDecorationUnlocked', header: 'Hatask', body: '獲得しました', link: '/settings/avatar-decoration' } as Misskey.entities.Notification;
		const allHidden = { brand, includeBrands: ['hatask'] as const, excludeTypes: [...notificationTypes], includeHataskApp: false, includeHatadySubtypes: [], excludeBots: true };
		expect(notificationBrand(reward)).toBe('hatask');
		expect(matchesNotificationView(reward, allHidden)).toBe(true);
		for (const type of ['app', 'hataskFlowerReady', 'achievementEarned'] as const) {
			expect(matchesNotificationView({ ...reward, type } as Misskey.entities.Notification, allHidden)).toBe(false);
		}
		expect(HATASK_NOTIFICATION_TYPES).not.toContain(reward.type);
		expect(STANDARD_NOTIFICATION_TYPES).not.toContain(reward.type);
	});

	test.each(['standard', 'hatady', 'hataFeed'] as const)('アイコンデコ獲得を%sへ混ぜない', brand => {
		const reward = { type: 'hataskDecorationUnlocked' } as Misskey.entities.Notification;
		expect(matchesNotificationView(reward, { brand })).toBe(false);
		expect(matchesNotificationView(reward, { brand, includeBrands: ['hatask'] })).toBe(false);
		expect(matchesNotificationView(reward, { brand: 'all', includeBrands: [brand] })).toBe(false);
		expect(matchesNotificationView(reward, { brand: 'hatask', includeBrands: [brand] })).toBe(false);
	});

	test('獲得通知もブランド選択に従い、指定がなければ表示する', () => {
		const reward = { type: 'hataskDecorationUnlocked' } as Misskey.entities.Notification;
		expect(matchesNotificationView(reward, {})).toBe(true);
		expect(matchesNotificationView(reward, { brand: 'all', includeBrands: null })).toBe(true);
		expect(matchesNotificationView(reward, { includeBrands: [] })).toBe(false);
		expect(matchesNotificationView(reward, { brand: 'hatask', includeBrands: [] })).toBe(false);
		expect(matchesNotificationView(reward, { brand: 'all', includeBrands: ['standard', 'hatask'] })).toBe(true);
	});

	test('app classifications match backend path boundary and known HataFeed header', () => {
		expect(notificationBrand({ type: 'app', link: '/hatask/tasks' })).toBe('hatask');
		expect(notificationBrand({ type: 'app', link: '/hatasker' })).toBe('standard');
		expect(notificationBrand({ type: 'app', header: 'HataFeed' })).toBe('hataFeed');
		expect(notificationBrand({ type: 'app', header: 'HataFeed counterfeit' })).toBe('standard');
		expect(notificationBrand({ type: 'app', customHeader: 'HataFeed' })).toBe('hataFeed');
		expect(notificationBrand({ type: 'app', customLink: '/hatask?notice=calendar' })).toBe('hatask');
	});

	test('legacy HataFeed app uses the backend effective type in both packed and live filters', () => {
		for (const item of [{ type: 'app', header: 'HataFeed' }, { type: 'app', customHeader: 'HataFeed' }]) {
			const notification = item as Misskey.entities.Notification;
			expect(effectiveNotificationType(notification)).toBe('hataFeed');
			expect(matchesNotificationView(notification, { excludeTypes: ['hataFeed'] })).toBe(false);
			expect(matchesNotificationView(notification, { excludeTypes: ['app'] })).toBe(true);
		}
	});

	test('brand and Hatady subtype are applied to live events together', () => {
		const reaction = { id: '1', type: 'hatady', subtype: 'reaction', createdAt: '2026-09-30T00:00:00Z' } as Misskey.entities.Notification;
		const comment = { ...reaction, id: '2', subtype: 'comment' } as Misskey.entities.Notification;
		expect(matchesNotificationView(reaction, { brand: 'hatady', includeHatadySubtypes: ['comment'] })).toBe(false);
		expect(matchesNotificationView(comment, { brand: 'hatady', includeHatadySubtypes: ['comment'] })).toBe(true);
		expect(matchesNotificationView(comment, { brand: 'standard' })).toBe(false);
	});

	test('category parent gate is independent of its remembered Hatady child selection', () => {
		const comment = { id: 'comment', type: 'hatady', subtype: 'comment' } as Misskey.entities.Notification;
		const selected = { includeBrands: ['standard'] as const, includeHatadySubtypes: ['comment'] };
		expect(matchesNotificationView(comment, selected)).toBe(false);
		expect(matchesNotificationView(comment, { ...selected, includeBrands: ['standard', 'hatady'] as const })).toBe(true);
		expect(matchesNotificationView(comment, { ...selected, includeBrands: ['standard', 'hatady'] as const, includeHatadySubtypes: [] })).toBe(false);
	});

	test('explicit other-Hatask switch owns only legacy Hatask app rows', () => {
		const hataskApp = { id: 'old', type: 'app', header: 'Hatask', link: '/hatask/tasks' } as Misskey.entities.Notification;
		const ordinaryApp = { id: 'standard', type: 'app', header: 'Other', link: '/other' } as Misskey.entities.Notification;
		const flower = { id: 'flower', type: 'hataskFlowerReady' } as Misskey.entities.Notification;
		const filter = { includeBrands: ['standard', 'hatask'] as const, excludeTypes: ['app'] };
		expect(matchesNotificationView(hataskApp, { ...filter, includeHataskApp: true })).toBe(true);
		expect(matchesNotificationView(hataskApp, { ...filter, includeHataskApp: false })).toBe(false);
		expect(matchesNotificationView(ordinaryApp, { ...filter, includeHataskApp: true })).toBe(false);
		expect(matchesNotificationView(flower, { ...filter, includeHataskApp: false })).toBe(true);
		expect(matchesNotificationView(hataskApp, filter)).toBe(false);
	});
});

describe('notification filter persistence', () => {
	test('獲得通知は旧スナップショットや保存済み除外から外し、通常通知の設定を維持する', () => {
		const oldTypes = notificationTypes.filter(type => type !== 'hataskDecorationUnlocked' && type !== 'hataskFlowerReady');
		const result = resolveNotificationFilter(['hataskDecorationUnlocked', 'reaction'], oldTypes);
		expect(result.excludeTypes).toEqual(['reaction', 'hataskFlowerReady']);
		const saved = serializeNotificationFilter([...notificationTypes], ['futureNotification', 'hataskDecorationUnlocked'], oldTypes);
		expect(saved.excludeTypes).toContain('futureNotification');
		expect(saved.excludeTypes).toContain('reaction');
		expect(saved.excludeTypes).not.toContain('hataskDecorationUnlocked');
		expect(resolveNotificationFilter(saved.excludeTypes, saved.knownTypes).excludeTypes).not.toContain('hataskDecorationUnlocked');
		expect(migrateNotificationFilterSnapshot(['hataskDecorationUnlocked', 'reaction'], [])?.excludeTypes).toEqual(['reaction']);
	});

	test('旧appとHatady親の除外をカテゴリで勝手に有効化せず、新しいHatady細分類はOFFにする', () => {
		const excluded = resolveNotificationFilter(['app', 'hatady'], []);
		const details = resolveNotificationFilterDetails(undefined, excluded.excludeTypes);
		expect(details).toMatchObject({ includeBrands: null, includeHataskApp: false, excludeHatadySubtypes: [] });
		const saved = serializeNotificationFilterDetails(details);
		expect(resolveNotificationFilterDetails(saved, excluded.excludeTypes).includeHataskApp).toBe(false);
		const oldSubtypes = hatadyNotificationSubtypes.filter(subtype => subtype !== hatadyNotificationSubtypes.at(-1));
		const migrated = resolveNotificationFilterDetails({ knownHatadySubtypes: oldSubtypes });
		expect(migrated.excludeHatadySubtypes).toEqual([hatadyNotificationSubtypes.at(-1)]);
	});

	test('カテゴリとHatady細分類を保存して再読込し、未知の将来値を保持する', () => {
		const previous = {
			includeBrands: ['standard', 'futureBrand'],
			excludeHatadySubtypes: ['futureSubtype'],
			knownHatadySubtypes: ['futureSubtype'],
		};
		const selected = resolveNotificationFilterDetails(previous);
		const saved = serializeNotificationFilterDetails({
			...selected,
			includeBrands: ['hatady', 'hatask'],
			includeHataskApp: false,
			excludeHatadySubtypes: [hatadyNotificationSubtypes[0]],
		}, previous);
		expect(saved.includeBrands).toEqual(['hatady', 'hatask', 'futureBrand']);
		expect(saved.excludeHatadySubtypes).toEqual(['futureSubtype', hatadyNotificationSubtypes[0]]);
		expect(saved.knownHatadySubtypes).toEqual(['futureSubtype', ...hatadyNotificationSubtypes]);
		expect(resolveNotificationFilterDetails(saved)).toEqual({
			includeBrands: ['hatady', 'hatask'],
			includeHataskApp: false,
			excludeHatadySubtypes: [hatadyNotificationSubtypes[0]],
		});
		expect(serializeNotificationFilterDetails({ ...selected, includeBrands: null }, previous).includeBrands).toEqual(['standard', 'hatady', 'hatask', 'hataFeed', 'futureBrand']);
		expect(serializeNotificationFilterDetails({ ...selected, includeBrands: null }).includeBrands).toBeNull();
	});
	test('Hataskのお花を個別に選択でき、保存済みフィルタには勝手に追加しない', () => {
		const oldTypes = notificationTypes.filter(type => type !== 'hataskFlowerReady');
		expect(resolveNotificationFilter([], oldTypes).excludeTypes).toContain('hataskFlowerReady');
		expect(resolveNotificationFilter([], []).excludeTypes).not.toContain('hataskFlowerReady');
		const disabled = serializeNotificationFilter(['hataskFlowerReady'], [], oldTypes);
		expect(resolveNotificationFilter(disabled.excludeTypes, disabled.knownTypes).excludeTypes).toEqual(['hataskFlowerReady']);
		const enabled = serializeNotificationFilter([], disabled.excludeTypes, disabled.knownTypes);
		expect(resolveNotificationFilter(enabled.excludeTypes, enabled.knownTypes).excludeTypes).not.toContain('hataskFlowerReady');
	});

	test.each(['hataskFlowerBloomed', 'hataskZukanUpdated', 'hataskFestivalBloomed'] as const)('保存済みフィルタでは新しい%s通知を初期状態でOFFにする', type => {
		const oldTypes = notificationTypes.filter(knownType => knownType !== type);
		expect(resolveNotificationFilter([], oldTypes).excludeTypes).toContain(type);
		expect(resolveNotificationFilter([], []).excludeTypes).not.toContain(type);
	});

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
		const knownTypes = notificationTypes.filter(type => type !== 'addedToPrivateChannel' && type !== 'removedFromPrivateChannel');
		const result = resolveNotificationFilter([], knownTypes);

		expect(result.excludeTypes).toContain('addedToPrivateChannel');
		expect(result.excludeTypes).toContain('removedFromPrivateChannel');
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
