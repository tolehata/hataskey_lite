/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { normalizeHatagoesMenu, normalizeHatagoesSidebar } from './hatagoes-sidebar.js';
import type { PreferencesManager } from '@/preferences/manager.js';

type Preferences = Pick<PreferencesManager, 'cloudReady' | 'profile' | 's' | 'commit'>;

/** 現在の同期済み設定を修復する。旧値の再流入にも同じ関数を再実行できる。 */
export async function migrateHatagoesSidebar(preferences: Preferences): Promise<void> {
	const profileId = preferences.profile.id;
	const cloudReady = preferences.cloudReady;
	const isCurrent = () => preferences.profile.id === profileId && preferences.cloudReady === cloudReady;
	await cloudReady;
	if (!isCurrent()) return;

	const menu = preferences.s.menu;
	const normalizedMenu = normalizeHatagoesMenu(menu);
	if (menu.length !== normalizedMenu.length || menu.some((item, index) => item !== normalizedMenu[index])) {
		if (!isCurrent()) return;
		await preferences.commit('menu', normalizedMenu);
	}

	if (!isCurrent()) return;
	const sidebar = preferences.s['simpleUi.sidebar'];
	const normalizedSidebar = normalizeHatagoesSidebar(sidebar);
	if (sidebar.length !== normalizedSidebar.length || sidebar.some((item, index) => item !== normalizedSidebar[index])) {
		if (!isCurrent()) return;
		await preferences.commit('simpleUi.sidebar', normalizedSidebar);
	}
}
