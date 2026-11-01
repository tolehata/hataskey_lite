/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { migrateHatagoesBottomNav } from '@/utility/hatagoes-bottom-nav-migration.js';
import { PreferencesManager } from './manager.js';
import type { PreferencesProfile, StorageProvider } from './manager.js';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));

type Preferences = Parameters<typeof migrateHatagoesBottomNav>[0];

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(yes => { resolve = yes; });
	return { promise, resolve };
}

function fixture() {
	const simple = [
		{ id: 'home', visible: true },
		{ id: 'hatask', visible: false, extra: 'old' },
		{ id: 'hatady', visible: true, extra: 'chosen' },
		{ id: 'hatafeed', visible: true, extra: 'later-feed' },
		{ id: 'widgets', visible: false },
	];
	const dedicated = [
		{ id: 'hatagoes', visible: false },
		{ id: 'search', visible: true },
		{ id: 'hatask', visible: true, extra: 'chosen' },
		{ id: 'hatafeed', visible: true, extra: 'later-feed' },
	];
	const commit = vi.fn(async (key: string, value: unknown) => {
		Reflect.set(preferences.s, key, value);
	});
	const preferences = {
		cloudReady: Promise.resolve(),
		profile: { id: 'profile' },
		s: { 'simpleUi.bottomNav': simple, hataskeyUi3BottomNav: dedicated },
		commit,
	} as unknown as Preferences;
	return { preferences, commit };
}

describe('HataGoes 下部ナビの保存移行', () => {
	test('同期後の両キーだけを保存し、配置・追加情報を維持して再実行時は書かない', async () => {
		const { preferences, commit } = fixture();
		const ready = deferred();
		preferences.cloudReady = ready.promise;
		const migration = migrateHatagoesBottomNav(preferences);
		await Promise.resolve();
		expect(commit).not.toHaveBeenCalled();
		ready.resolve();
		await migration;
		expect(commit.mock.calls).toEqual([
			['simpleUi.bottomNav', [
				{ id: 'home', visible: true },
				{ id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', visible: true, extra: 'chosen' },
				{ id: 'widgets', visible: false },
			]],
			['hataskeyUi3BottomNav', [
				{ id: 'search', visible: true },
				{ id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', visible: true, extra: 'chosen' },
			]],
		]);
		await migrateHatagoesBottomNav(preferences);
		expect(commit).toHaveBeenCalledTimes(2);
	});

	test('UI S の null は維持し、変更のない共有設定を再保存しない', async () => {
		const { preferences, commit } = fixture();
		preferences.s['simpleUi.bottomNav'] = [{ id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', visible: true }];
		preferences.s.hataskeyUi3BottomNav = null;
		await migrateHatagoesBottomNav(preferences);
		expect(commit).not.toHaveBeenCalled();
	});

	test('同期失敗時は保存せず、次回成功時に再試行できる', async () => {
		const { preferences, commit } = fixture();
		preferences.cloudReady = Promise.reject(new Error('offline'));
		await expect(migrateHatagoesBottomNav(preferences)).rejects.toThrow('offline');
		expect(commit).not.toHaveBeenCalled();
		preferences.cloudReady = Promise.resolve();
		await migrateHatagoesBottomNav(preferences);
		expect(commit).toHaveBeenCalledTimes(2);
	});

	test('同期中にプロファイルが変わった場合は保存しない', async () => {
		const { preferences, commit } = fixture();
		const ready = deferred();
		preferences.cloudReady = ready.promise;
		const migration = migrateHatagoesBottomNav(preferences);
		preferences.profile.id = 'another';
		ready.resolve();
		await migration;
		expect(commit).not.toHaveBeenCalled();
	});

	test('同期が更新された場合は古い cloudReady の完了で保存しない', async () => {
		const { preferences, commit } = fixture();
		const oldReady = deferred();
		preferences.cloudReady = oldReady.promise;
		const migration = migrateHatagoesBottomNav(preferences);
		preferences.cloudReady = Promise.resolve();
		oldReady.resolve();
		await migration;
		expect(commit).not.toHaveBeenCalled();
		await migrateHatagoesBottomNav(preferences);
		expect(commit).toHaveBeenCalledTimes(2);
	});

	test('保存失敗時は残りを保存せず、再試行できる', async () => {
		const { preferences, commit } = fixture();
		commit.mockRejectedValueOnce(new Error('save failed'));
		await expect(migrateHatagoesBottomNav(preferences)).rejects.toThrow('save failed');
		expect(commit).toHaveBeenCalledTimes(1);
		await migrateHatagoesBottomNav(preferences);
		expect(commit).toHaveBeenCalledTimes(3);
	});

	test('一つ目の保存中にプロファイルが変わった場合は二つ目を保存しない', async () => {
		const { preferences, commit } = fixture();
		const saved = deferred();
		commit.mockImplementationOnce(async (key: string, value: unknown) => {
			await saved.promise;
			Reflect.set(preferences.s, key, value);
		});
		const migration = migrateHatagoesBottomNav(preferences);
		await Promise.resolve();
		preferences.profile.id = 'another';
		saved.resolve();
		await migration;
		expect(commit).toHaveBeenCalledTimes(1);
	});

	test('同期された旧設定を修復し、再起動と再同期の後も新IDを維持する', async () => {
		const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
		let saved: PreferencesProfile | null = null;
		const remote = new Map<string, unknown>();
		const io: StorageProvider = {
			load: () => saved && copy(saved),
			save: ({ profile }) => { saved = copy(profile); },
			cloudGetBulk: async ({ needs }) => Object.fromEntries(needs
				.filter(need => remote.has(need.key))
				.map(need => [need.key, copy(remote.get(need.key))])) as never,
			cloudGet: async () => null,
			cloudSet: vi.fn(async ({ key, value }) => { remote.set(key, copy(value)); }),
		};
		const seed = new PreferencesManager(io, { id: 'user' });
		await seed.cloudReady;
		const oldSimple = [
			{ id: 'home', icon: 'ti ti-home', label: 'ホーム', visible: true },
			{ id: 'hatask', icon: 'ti ti-eye', label: '独自機能', visible: true },
			{ id: 'hatady', icon: 'ti ti-book-2', label: 'Hatady', visible: false },
			{ id: 'hatafeed', icon: 'ti ti-message-report', label: 'HataFeed', visible: true },
		];
		const oldDedicated = [{ id: 'hatafeed', visible: true, extra: 'feed' }];
		await seed.commit('simpleUi.bottomNav', oldSimple);
		await seed.commit('hataskeyUi3BottomNav', oldDedicated);
		for (const key of ['simpleUi.bottomNav', 'hataskeyUi3BottomNav'] as const) {
			seed.getMatchedRecordOf(key)[2].sync = true;
			remote.set(key, copy(seed.s[key]));
		}
		seed.save();

		const boot = new PreferencesManager(io, { id: 'user' });
		await migrateHatagoesBottomNav(boot);
		expect(io.cloudSet).toHaveBeenCalledTimes(2);
		for (const key of ['simpleUi.bottomNav', 'hataskeyUi3BottomNav'] as const) {
			expect((remote.get(key) as { id: string }[]).filter(item => item.id === 'hatagoes')).toHaveLength(1);
			expect((remote.get(key) as { id: string }[]).some(item => ['hatask', 'hatady', 'hatafeed'].includes(item.id))).toBe(false);
		}
		expect((remote.get('hataskeyUi3BottomNav') as { id: string; extra?: string }[])[0]).toMatchObject({ id: 'hatagoes', extra: 'feed' });
		const reloaded = new PreferencesManager(io, { id: 'user' });
		await migrateHatagoesBottomNav(reloaded);
		expect(io.cloudSet).toHaveBeenCalledTimes(2);
		expect(reloaded.s['simpleUi.bottomNav']).toEqual(remote.get('simpleUi.bottomNav'));
		expect(reloaded.s.hataskeyUi3BottomNav).toEqual(remote.get('hataskeyUi3BottomNav'));
	});
});
