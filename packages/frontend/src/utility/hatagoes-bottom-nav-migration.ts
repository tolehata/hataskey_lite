/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { normalizeBottomNavItems } from './hatasaba-navigation.js';
import type { HatasabaNavItem } from './hatasaba-navigation.js';
import type { PreferencesManager } from '@/preferences/manager.js';

type Preferences = Pick<PreferencesManager, 'cloudReady' | 'profile' | 's' | 'commit'>;

function sameItems(before: readonly HatasabaNavItem[], after: readonly HatasabaNavItem[]): boolean {
	return before.length === after.length && before.every((item, index) => {
		const normalized = after[index]!;
		return Object.keys(item).length === Object.keys(normalized).length
			&& Object.entries(item).every(([key, value]) => Reflect.get(normalized, key) === value);
	});
}

/** 同期済みの両設定だけを修復する。失敗時は次回起動で再試行する。 */
export async function migrateHatagoesBottomNav(preferences: Preferences): Promise<void> {
	const profileId = preferences.profile.id;
	const cloudReady = preferences.cloudReady;
	await cloudReady;
	if (preferences.profile.id !== profileId || preferences.cloudReady !== cloudReady) return;

	for (const key of ['simpleUi.bottomNav', 'hataskeyUi3BottomNav'] as const) {
		if (preferences.profile.id !== profileId) return;
		const current = preferences.s[key];
		if (current == null) continue;
		const normalized = normalizeBottomNavItems(current);
		if (!sameItems(current, normalized)) await preferences.commit(key, normalized);
	}
}
