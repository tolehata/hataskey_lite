/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Keys } from '@/local-storage.js';
import type { PreferencesManager } from '@/preferences/manager.js';

type Preferences = Pick<PreferencesManager, 'cloudReady' | 'profile' | 's' | 'commit'>;
type Storage = {
	getItem: (key: Keys) => string | null;
	setItem: (key: Keys, value: string) => void;
};

/** 同期済みの最新設定から廃止IDだけを取り除き、他のメニューと配置を保全する。 */
export async function migrateRetiredPortalMenu(preferences: Preferences, storage: Storage, accountId: string): Promise<void> {
	const profileId = preferences.profile.id;
	const marker: Keys = `hata_portal_cleanup_migrated:${accountId}:${profileId}`;
	if (storage.getItem(marker) === '1') return;

	await preferences.cloudReady;
	if (preferences.profile.id !== profileId) return;

	const menu = preferences.s.menu;
	const filteredMenu = menu.filter(item => item !== 'portal');
	if (filteredMenu.length !== menu.length) {
		await preferences.commit('menu', filteredMenu);
	}

	if (preferences.profile.id !== profileId) return;
	const sidebar = preferences.s['simpleUi.sidebar'];
	const filteredSidebar = sidebar.filter(item => item.id !== 'portal');
	if (filteredSidebar.length !== sidebar.length) {
		await preferences.commit('simpleUi.sidebar', filteredSidebar);
	}

	if (preferences.profile.id === profileId) storage.setItem(marker, '1');
}
