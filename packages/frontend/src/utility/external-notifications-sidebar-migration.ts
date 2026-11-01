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

export const EXTERNAL_NOTIFICATIONS_SIDEBAR_ITEM = {
	id: 'externalNotifications',
	icon: 'ti ti-bell',
	label: '外部通知',
	group: 'basic',
} as const;

/**
 * 外部通知を並び替え可能な通常項目へ移行する。
 * 同期済みの最新値に未登録の場合だけ追加し、既存の順序・表示状態・グループを変更しない。
 */
export async function migrateExternalNotificationsSidebar(preferences: Preferences, storage: Storage, accountId: string): Promise<void> {
	const profileId = preferences.profile.id;
	const marker: Keys = `hata_external_notifications_sidebar_migrated:${accountId}:${profileId}`;

	await preferences.cloudReady;
	if (preferences.profile.id !== profileId) return;

	const current = preferences.s['simpleUi.sidebar'];
	const externalNotificationsCount = current.filter(item => item.id === EXTERNAL_NOTIFICATIONS_SIDEBAR_ITEM.id).length;
	if (externalNotificationsCount === 0) {
		const next = [...current];
		const notificationsIndex = next.findIndex(item => item.id === 'notifications');
		if (notificationsIndex >= 0) {
			next.splice(notificationsIndex + 1, 0, { ...EXTERNAL_NOTIFICATIONS_SIDEBAR_ITEM });
		} else {
			let lastBasicIndex = -1;
			for (let i = 0; i < next.length; i++) {
				if ((next[i].group ?? 'basic') === 'basic') lastBasicIndex = i;
			}
			next.splice(lastBasicIndex + 1, 0, { ...EXTERNAL_NOTIFICATIONS_SIDEBAR_ITEM });
		}
		await preferences.commit('simpleUi.sidebar', next);
	} else if (externalNotificationsCount > 1) {
		let found = false;
		const next = current.filter(item => {
			if (item.id !== EXTERNAL_NOTIFICATIONS_SIDEBAR_ITEM.id) return true;
			if (found) return false;
			found = true;
			return true;
		});
		await preferences.commit('simpleUi.sidebar', next);
	}

	if (preferences.profile.id === profileId && storage.getItem(marker) !== '1') storage.setItem(marker, '1');
}
