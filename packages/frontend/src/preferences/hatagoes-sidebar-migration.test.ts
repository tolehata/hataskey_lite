/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { migrateHatagoesSidebar } from '@/utility/hatagoes-sidebar-migration.js';
import { PreferencesManager } from './manager.js';
import type { PreferencesProfile, StorageProvider } from './manager.js';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {} } }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));

type Preferences = Parameters<typeof migrateHatagoesSidebar>[0];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(yes => { resolve = yes; });
	return { promise, resolve };
}

function fixture() {
	const commit = vi.fn(async (key: string, value: unknown) => { Reflect.set(preferences.s, key, value); });
	const preferences = {
		cloudReady: Promise.resolve(),
		profile: { id: 'profile' },
		s: {
			menu: ['timeline', 'hatask', '-', 'hatady'],
			'simpleUi.sidebar': [
				{ id: 'search', icon: 'ti ti-search', label: '検索', group: 'basic' },
				{ id: 'hatafeed', icon: 'old', label: '旧', group: 'hata', visible: false, external: true, url: 'https://example.test' },
			],
		},
		commit,
	} as unknown as Preferences;
	return { preferences, commit };
}

describe('HataGoes サイドメニュー保存移行', () => {
	test('クラウド同期待ち後に両設定を修復し、再実行では保存しない', async () => {
		const { preferences, commit } = fixture();
		const ready = deferred();
		preferences.cloudReady = ready.promise;
		const migration = migrateHatagoesSidebar(preferences);
		await Promise.resolve();
		expect(commit).not.toHaveBeenCalled();
		ready.resolve();
		await migration;
		expect(commit.mock.calls).toEqual([
			['menu', ['timeline', 'hatagoes', '-']],
			['simpleUi.sidebar', [
				{ id: 'search', icon: 'ti ti-search', label: '検索', group: 'basic' },
				{ id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', group: 'hata', visible: false },
			]],
		]);
		await migrateHatagoesSidebar(preferences);
		expect(commit).toHaveBeenCalledTimes(2);
		preferences.s.menu = ['hatady', 'hatask'];
		await migrateHatagoesSidebar(preferences);
		expect(preferences.s.menu).toEqual(['hatagoes']);
	});

	test('クラウド取得失敗後に再試行できる', async () => {
		const { preferences, commit } = fixture();
		preferences.cloudReady = Promise.reject(new Error('offline'));
		await expect(migrateHatagoesSidebar(preferences)).rejects.toThrow('offline');
		expect(commit).not.toHaveBeenCalled();
		preferences.cloudReady = Promise.resolve();
		await migrateHatagoesSidebar(preferences);
		expect(commit).toHaveBeenCalledTimes(2);
	});

	test('プロファイル切替とcloudReady再作成後は古い作業を保存しない', async () => {
		const { preferences, commit } = fixture();
		const ready = deferred();
		preferences.cloudReady = ready.promise;
		const old = migrateHatagoesSidebar(preferences);
		preferences.cloudReady = Promise.resolve();
		ready.resolve();
		await old;
		expect(commit).not.toHaveBeenCalled();
		const ready2 = deferred();
		preferences.cloudReady = ready2.promise;
		const switched = migrateHatagoesSidebar(preferences);
		preferences.profile.id = 'new-profile';
		ready2.resolve();
		await switched;
		expect(commit).not.toHaveBeenCalled();
	});

	test('最初の保存中にプロファイルが切り替われば次の設定を保存しない', async () => {
		const { preferences, commit } = fixture();
		const saved = deferred();
		commit.mockImplementationOnce(async (key: string, value: unknown) => {
			await saved.promise;
			Reflect.set(preferences.s, key, value);
		});
		const migration = migrateHatagoesSidebar(preferences);
		await Promise.resolve();
		preferences.profile.id = 'new-profile';
		saved.resolve();
		await migration;
		expect(commit).toHaveBeenCalledTimes(1);
	});

	test('保存失敗後に旧設定を再試行できる', async () => {
		const { preferences, commit } = fixture();
		commit.mockRejectedValueOnce(new Error('save failed'));
		await expect(migrateHatagoesSidebar(preferences)).rejects.toThrow('save failed');
		expect(commit).toHaveBeenCalledTimes(1);
		await migrateHatagoesSidebar(preferences);
		expect(commit).toHaveBeenCalledTimes(3);
	});

	test('実PreferencesManagerで同期済み保存値を更新し、再起動後も維持する', async () => {
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
		await seed.commit('menu', ['timeline', 'hatask', '-', 'hatafeed']);
		await seed.commit('simpleUi.sidebar', [{ id: 'hatady', icon: 'old', label: '旧', group: 'personal', visible: false }]);
		for (const key of ['menu', 'simpleUi.sidebar'] as const) {
			seed.getMatchedRecordOf(key)[2].sync = true;
			remote.set(key, copy(seed.s[key]));
		}
		seed.save();
		const boot = new PreferencesManager(io, { id: 'user' });
		await migrateHatagoesSidebar(boot);
		expect(remote.get('menu')).toEqual(['timeline', 'hatagoes', '-']);
		expect(remote.get('simpleUi.sidebar')).toEqual([{ id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes', group: 'personal', visible: false }]);
		const reloaded = new PreferencesManager(io, { id: 'user' });
		await migrateHatagoesSidebar(reloaded);
		expect(reloaded.s.menu).toEqual(remote.get('menu'));
		expect(reloaded.s['simpleUi.sidebar']).toEqual(remote.get('simpleUi.sidebar'));
		expect(io.cloudSet).toHaveBeenCalledTimes(2);
	});
});
