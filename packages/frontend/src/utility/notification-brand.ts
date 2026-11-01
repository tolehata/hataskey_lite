/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';
import { isMandatoryNotificationType, isNotificationFromBot } from '@/utility/notification-filter.js';
import type { HataNotificationBrand, HataNotificationCategory } from '@/utility/hatasaba-device-prefs.js';

type NotificationLike = { type: string; header?: string | null; link?: string | null; customHeader?: string | null; customLink?: string | null; subtype?: string | null };

export function effectiveNotificationType(notification: NotificationLike): string {
	return notification.type === 'app' && (notification.customHeader ?? notification.header) === 'HataFeed' ? 'hataFeed' : notification.type;
}

export function notificationBrand(notification: NotificationLike): Exclude<HataNotificationBrand, 'all'> {
	const header = notification.customHeader ?? notification.header;
	const link = notification.customLink ?? notification.link;
	if (notification.type === 'hatady') return 'hatady';
	if (effectiveNotificationType(notification) === 'hataFeed') return 'hataFeed';
	if (['hataskFlowerReady', 'hataskFlowerBloomed', 'hataskZukanUpdated', 'hataskFestivalBloomed', 'hataskDecorationUnlocked'].includes(notification.type)) return 'hatask';
	if (notification.type === 'app' && ((link != null && /^\/hatask(?:\/|[?#]|$)/.test(link))
		|| (link == null && ['Hatask', 'Hataskのお花'].includes(header ?? '')))) return 'hatask';
	return 'standard';
}

export type NotificationViewPredicate = {
	brand?: HataNotificationBrand;
	includeBrands?: readonly HataNotificationCategory[] | null;
	excludeTypes?: readonly string[] | null;
	includeHataskApp?: boolean;
	includeHatadySubtypes?: readonly string[] | null;
	excludeHatadySubtypes?: readonly string[] | null;
	excludeBots?: boolean;
};

export function matchesNotificationView(notification: Misskey.entities.Notification, filter: NotificationViewPredicate): boolean {
	const category = notificationBrand(notification);
	if (filter.brand != null && filter.brand !== 'all' && category !== filter.brand) return false;
	if (filter.includeBrands != null && !filter.includeBrands.includes(category)) return false;
	// Reward delivery is mandatory, but its rows still belong to the selected brand.
	if (isMandatoryNotificationType(notification.type)) return true;
	if (category === 'hatask' && effectiveNotificationType(notification) === 'app' && filter.includeHataskApp != null) {
		if (!filter.includeHataskApp) return false;
	} else if (filter.excludeTypes?.includes(effectiveNotificationType(notification))) return false;
	if (notification.type === 'hatady') {
		if (filter.includeHatadySubtypes != null && !filter.includeHatadySubtypes.includes(notification.subtype)) return false;
		if (filter.excludeHatadySubtypes?.includes(notification.subtype)) return false;
	}
	if (filter.excludeBots && isNotificationFromBot(notification)) return false;
	return true;
}
