/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { migrateExternalNotificationsSidebar } from './external-notifications-sidebar-migration.js';

type Preferences = Parameters<typeof migrateExternalNotificationsSidebar>[0];
const marker = 'hata_external_notifications_sidebar_migrated:user:profile';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(yes => { resolve = yes; });
	return { promise, resolve };
}

function fixture() {
	const commit = vi.fn((_key: string, _value: unknown): Promise<void> | void => undefined);
	const preferences = {
		cloudReady: Promise.resolve(),
		profile: { id: 'profile' },
		s: {
			'simpleUi.sidebar': [
				{ id: 'timeline', icon: 'ti ti-home', label: 'Home', group: 'basic', visible: false },
				{ id: 'notifications', icon: 'ti ti-bell', label: 'Notifications', group: 'basic' },
				{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', group: 'hata', visible: false },
			],
		},
		commit,
	} as unknown as Preferences;
	return { preferences, commit };
}

describe('外部通知のHataskey UIサイドバー移行', () => {
	beforeEach(() => window.localStorage.clear());

	test('初期同期後の最新配列で通知の直後に追加し、既存の順序・visible・groupを変えない', async () => {
		const { preferences, commit } = fixture();
		const ready = deferred();
		preferences.cloudReady = ready.promise;
		const result = migrateExternalNotificationsSidebar(preferences, window.localStorage, 'user');
		await Promise.resolve();
		expect(commit).not.toHaveBeenCalled();

		preferences.s['simpleUi.sidebar'] = [
			{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', group: 'custom', visible: false },
			{ id: 'notifications', icon: 'ti ti-bell-ringing', label: '自分の通知', group: 'discover', visible: false },
			{ id: 'timeline', icon: 'ti ti-home', label: 'Home', group: 'basic', visible: true },
		];
		const latest = structuredClone(preferences.s['simpleUi.sidebar']);
		ready.resolve();
		await result;

		expect(commit).toHaveBeenCalledOnce();
		const [key, migrated] = commit.mock.calls[0] as [string, typeof latest];
		expect(key).toBe('simpleUi.sidebar');
		expect(migrated.map(item => item.id)).toEqual(['hatask', 'notifications', 'externalNotifications', 'timeline']);
		expect(migrated.filter(item => item.id !== 'externalNotifications')).toEqual(latest);
		expect(migrated[2]).toEqual({ id: 'externalNotifications', icon: 'ti ti-bell', label: '外部通知', group: 'basic' });
		expect(preferences.s['simpleUi.sidebar']).toEqual(latest);
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('既存値の位置・非表示・独自グループを上書きせず、2回目は何も書かない', async () => {
		const { preferences, commit } = fixture();
		preferences.s['simpleUi.sidebar'] = [
			{ id: 'externalNotifications', icon: 'ti ti-bell-ringing', label: 'カスタム外部通知', group: 'discover', visible: false },
			...preferences.s['simpleUi.sidebar'],
		];
		const before = structuredClone(preferences.s['simpleUi.sidebar']);
		await migrateExternalNotificationsSidebar(preferences, window.localStorage, 'user');
		await migrateExternalNotificationsSidebar(preferences, window.localStorage, 'user');
		expect(commit).not.toHaveBeenCalled();
		expect(preferences.s['simpleUi.sidebar']).toEqual(before);
		expect(preferences.s['simpleUi.sidebar'].filter(item => item.id === 'externalNotifications')).toHaveLength(1);
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('完了印の後に同期値が古い配列へ戻っても欠落を修復する', async () => {
		const { preferences, commit } = fixture();
		window.localStorage.setItem(marker, '1');

		await migrateExternalNotificationsSidebar(preferences, window.localStorage, 'user');

		expect(commit).toHaveBeenCalledOnce();
		const migrated = commit.mock.calls[0][1] as Array<{ id: string }>;
		expect(migrated.map(item => item.id)).toEqual(['timeline', 'notifications', 'externalNotifications', 'hatask']);
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('重複した外部通知は先頭の位置と設定だけを残す', async () => {
		const { preferences, commit } = fixture();
		const first = { id: 'externalNotifications', icon: 'ti ti-bell-ringing', label: '先頭', group: 'discover', visible: false };
		preferences.s['simpleUi.sidebar'] = [
			first,
			...preferences.s['simpleUi.sidebar'],
			{ id: 'externalNotifications', icon: 'ti ti-bell', label: '重複', group: 'basic' },
		];

		await migrateExternalNotificationsSidebar(preferences, window.localStorage, 'user');

		expect(commit).toHaveBeenCalledOnce();
		const migrated = commit.mock.calls[0][1] as Array<{ id: string }>;
		expect(migrated.filter(item => item.id === 'externalNotifications')).toEqual([first]);
		expect(migrated.filter(item => item.id !== 'externalNotifications')).toEqual(preferences.s['simpleUi.sidebar'].filter(item => item.id !== 'externalNotifications'));
	});

	test('通知がない場合は最後のbasic項目の直後に追加する', async () => {
		const { preferences, commit } = fixture();
		preferences.s['simpleUi.sidebar'] = [
			{ id: 'timeline', icon: 'ti ti-home', label: 'Home', group: 'basic', visible: false },
			{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', group: 'hata' },
			{ id: 'search', icon: 'ti ti-search', label: 'Search', group: 'basic', visible: false },
			{ id: 'channels', icon: 'ti ti-device-tv', label: 'Channels', group: 'discover' },
		];
		await migrateExternalNotificationsSidebar(preferences, window.localStorage, 'user');
		const migrated = commit.mock.calls[0][1] as Array<{ id: string }>;
		expect(migrated.map(item => item.id)).toEqual(['timeline', 'hatask', 'search', 'externalNotifications', 'channels']);
	});

	test('保存失敗時は完了印を付けず、次回起動で再試行できる', async () => {
		const { preferences, commit } = fixture();
		commit.mockRejectedValueOnce(new Error('save failed'));
		await expect(migrateExternalNotificationsSidebar(preferences, window.localStorage, 'user')).rejects.toThrow('save failed');
		expect(window.localStorage.getItem(marker)).toBeNull();

		const retry = fixture();
		await migrateExternalNotificationsSidebar(retry.preferences, window.localStorage, 'user');
		expect(retry.commit).toHaveBeenCalledOnce();
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('アカウントとプロファイルごとに完了を管理し、同期中にプロファイルが変わったら書かない', async () => {
		const changed = fixture();
		const ready = deferred();
		changed.preferences.cloudReady = ready.promise;
		const pending = migrateExternalNotificationsSidebar(changed.preferences, window.localStorage, 'user');
		changed.preferences.profile.id = 'another-profile';
		ready.resolve();
		await pending;
		expect(changed.commit).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(marker)).toBeNull();

		const profile = fixture();
		profile.preferences.profile.id = 'another-profile';
		await migrateExternalNotificationsSidebar(profile.preferences, window.localStorage, 'user');
		expect(window.localStorage.getItem('hata_external_notifications_sidebar_migrated:user:another-profile')).toBe('1');

		const account = fixture();
		await migrateExternalNotificationsSidebar(account.preferences, window.localStorage, 'another-user');
		expect(window.localStorage.getItem('hata_external_notifications_sidebar_migrated:another-user:profile')).toBe('1');
	});
});
