/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { migrateRetiredPortalMenu } from './retired-portal-migration.js';

type Preferences = Parameters<typeof migrateRetiredPortalMenu>[0];
const marker = 'hata_portal_cleanup_migrated:user:profile';

function deferred() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

function fixture() {
	const commit = vi.fn((_key: string, _value: unknown): Promise<void> | void => undefined);
	const preferences = {
		cloudReady: Promise.resolve(),
		profile: { id: 'profile' },
		s: {
			menu: ['timeline', 'portal', 'hatask'],
			'simpleUi.sidebar': [
				{ id: 'timeline', icon: 'ti ti-home', label: 'Home', group: 'basic' },
				{ id: 'portal', icon: 'ti ti-door', label: 'Portal', group: 'hata' },
				{ id: 'hatask', icon: 'ti ti-eye', label: 'Hatask', group: 'hata' },
			],
		},
		commit,
	} as unknown as Preferences;
	return { preferences, commit };
}

describe('廃止ポータルの保存済みメニュー移行', () => {
	beforeEach(() => window.localStorage.clear());

	test('初期同期の完了まで書かず、同期後の最新配置だけを掃除する', async () => {
		const { preferences, commit } = fixture();
		const ready = deferred();
		preferences.cloudReady = ready.promise;
		const result = migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		await Promise.resolve();
		expect(commit).not.toHaveBeenCalled();
		preferences.s.menu = ['hatady', 'portal', 'timeline'];
		const sidebar = structuredClone(preferences.s['simpleUi.sidebar']);
		ready.resolve();
		await result;
		expect(commit.mock.calls).toEqual([
			['menu', ['hatady', 'timeline']],
			['simpleUi.sidebar', [sidebar[0], sidebar[2]]],
		]);
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('同期取得失敗時に保存・完了記録を行わない', async () => {
		const { preferences, commit } = fixture();
		preferences.cloudReady = Promise.reject(new Error('offline'));
		await expect(migrateRetiredPortalMenu(preferences, window.localStorage, 'user')).rejects.toThrow('offline');
		expect(commit).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(marker)).toBeNull();
	});

	test('クラウドへの保存成功まで完了記録を待つ', async () => {
		const { preferences, commit } = fixture();
		const saved = deferred();
		commit.mockReturnValueOnce(saved.promise);
		const result = migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		await Promise.resolve();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(window.localStorage.getItem(marker)).toBeNull();
		saved.resolve();
		await result;
		expect(commit).toHaveBeenCalledTimes(2);
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('保存失敗時には次回起動で再試行できる', async () => {
		const { preferences, commit } = fixture();
		commit.mockRejectedValueOnce(new Error('save failed'));
		await expect(migrateRetiredPortalMenu(preferences, window.localStorage, 'user')).rejects.toThrow('save failed');
		expect(window.localStorage.getItem(marker)).toBeNull();
		// 次の起動では初期同期でリモートの未清掃値を読み直す。
		const nextBoot = fixture();
		await migrateRetiredPortalMenu(nextBoot.preferences, window.localStorage, 'user');
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('対象がなければメニューを再保存しない', async () => {
		const { preferences, commit } = fixture();
		preferences.s.menu = ['timeline'];
		preferences.s['simpleUi.sidebar'] = preferences.s['simpleUi.sidebar'].slice(0, 1);
		await migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		expect(commit).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(marker)).toBe('1');
	});

	test('端末共通の旧完了印を引き継がず、アカウント別に実行する', async () => {
		const { preferences, commit } = fixture();
		window.localStorage.setItem('hata_portal_cleanup_migrated', '1');
		await migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		commit.mockClear();
		await migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		expect(commit).not.toHaveBeenCalled();
		await migrateRetiredPortalMenu(preferences, window.localStorage, 'another-user');
		expect(commit).toHaveBeenCalledTimes(2);
	});

	test('プロファイル別に実行する', async () => {
		const { preferences, commit } = fixture();
		window.localStorage.setItem(marker, '1');
		preferences.profile.id = 'another-profile';
		await migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		expect(commit).toHaveBeenCalledTimes(2);
		expect(window.localStorage.getItem('hata_portal_cleanup_migrated:user:another-profile')).toBe('1');
	});

	test('同期中にプロファイルが変わったら書き込まない', async () => {
		const { preferences, commit } = fixture();
		const ready = deferred();
		preferences.cloudReady = ready.promise;
		const result = migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		preferences.profile.id = 'another-profile';
		ready.resolve();
		await result;
		expect(commit).not.toHaveBeenCalled();
		expect(window.localStorage.getItem(marker)).toBeNull();
	});

	test('保存中にプロファイルが変わったら残りの書き込みを中止する', async () => {
		const { preferences, commit } = fixture();
		const saved = deferred();
		commit.mockReturnValueOnce(saved.promise);
		const result = migrateRetiredPortalMenu(preferences, window.localStorage, 'user');
		await Promise.resolve();
		preferences.profile.id = 'another-profile';
		saved.resolve();
		await result;
		expect(commit).toHaveBeenCalledTimes(1);
		expect(window.localStorage.getItem(marker)).toBeNull();
	});
});
