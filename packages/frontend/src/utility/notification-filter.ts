/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { notificationTypes, hatadyNotificationSubtypes } from 'cherrypick-js';
import type * as Misskey from 'cherrypick-js';
import type { HataNotificationCategory } from '@/utility/hatasaba-device-prefs.js';
import { i18n } from '@/i18n.js';

export type NotificationType = typeof notificationTypes[number];

/** Hatask rewards bypass optional type filters within their selected brand. */
export function isMandatoryNotificationType(type: string): boolean {
	return type === 'hataskDecorationUnlocked';
}

export const NOTIFICATION_FILTER_CATEGORIES = ['standard', 'hatady', 'hatask', 'hataFeed'] as const satisfies readonly HataNotificationCategory[];
export const HATASK_NOTIFICATION_TYPES = ['hataskFlowerReady', 'hataskFlowerBloomed', 'hataskZukanUpdated', 'hataskFestivalBloomed'] as const satisfies readonly NotificationType[];
export const STANDARD_NOTIFICATION_TYPES = notificationTypes.filter(type => !isMandatoryNotificationType(type) && type !== 'hatady' && type !== 'hataFeed' && !(HATASK_NOTIFICATION_TYPES as readonly string[]).includes(type));

export type NotificationFilterDetails = {
	includeBrands?: string[] | null;
	includeHataskApp?: boolean;
	excludeHatadySubtypes?: string[];
	knownHatadySubtypes?: string[];
};

export type ResolvedNotificationFilterDetails = {
	includeBrands: HataNotificationCategory[] | null;
	includeHataskApp: boolean;
	excludeHatadySubtypes: (typeof hatadyNotificationSubtypes[number])[];
};

export type NotificationFilterState = {
	excludeTypes: NotificationType[];
	knownTypes: string[];
};

export type StoredNotificationFilterState = {
	excludeTypes: string[];
	knownTypes: string[];
};

export const NOTIFICATION_FILTER_POLICY_NOTICE_ID = 'hata-notification-filter-policy-notice-12-1' as const;

export const NOTIFICATION_FILTER_POLICY_NOTICE = {
	id: NOTIFICATION_FILTER_POLICY_NOTICE_ID,
	get header() { return i18n.ts._hata._notificationFilterNotice.title; },
	get body() { return i18n.ts._hata._notificationFilterNotice.body; },
} as const;

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

export function resolveNotificationFilterDetails(
	details: NotificationFilterDetails | null | undefined,
	resolvedExcludeTypes: readonly string[] = [],
): ResolvedNotificationFilterDetails {
	const knownSubtypes = new Set(details?.knownHatadySubtypes);
	const excludedSubtypes = new Set(details?.excludeHatadySubtypes);
	const hasSnapshot = details?.knownHatadySubtypes != null;
	return {
		includeBrands: details?.includeBrands == null ? null : NOTIFICATION_FILTER_CATEGORIES.filter(category => details.includeBrands?.includes(category)),
		includeHataskApp: details?.includeHataskApp ?? !resolvedExcludeTypes.includes('app'),
		excludeHatadySubtypes: hatadyNotificationSubtypes.filter(subtype => excludedSubtypes.has(subtype) || (hasSnapshot && !knownSubtypes.has(subtype))),
	};
}

export function serializeNotificationFilterDetails(
	selection: ResolvedNotificationFilterDetails,
	previous?: NotificationFilterDetails | null,
): NotificationFilterDetails {
	const knownBrands = new Set<string>(NOTIFICATION_FILTER_CATEGORIES);
	const unknownBrands = (previous?.includeBrands ?? []).filter(brand => !knownBrands.has(brand));
	const requestedBrands = selection.includeBrands;
	const selectedBrands = requestedBrands == null ? [...NOTIFICATION_FILTER_CATEGORIES] : NOTIFICATION_FILTER_CATEGORIES.filter(category => requestedBrands.includes(category));
	const includeBrands = selectedBrands.length === NOTIFICATION_FILTER_CATEGORIES.length && unknownBrands.length === 0
		? null
		: unique([...selectedBrands, ...unknownBrands]);
	const knownSubtypes = new Set<string>(hatadyNotificationSubtypes);
	return {
		includeBrands,
		includeHataskApp: selection.includeHataskApp,
		excludeHatadySubtypes: unique([
			...(previous?.excludeHatadySubtypes ?? []).filter(subtype => !knownSubtypes.has(subtype)),
			...selection.excludeHatadySubtypes.filter(subtype => knownSubtypes.has(subtype)),
		]),
		knownHatadySubtypes: unique([
			...(previous?.knownHatadySubtypes ?? []).filter(subtype => !knownSubtypes.has(subtype)),
			...hatadyNotificationSubtypes,
		]),
	};
}

export function isNotificationType(value: string): value is NotificationType {
	return (notificationTypes as readonly string[]).includes(value);
}

/**
 * ストリームで届く通知が Bot フラグ付きアカウント由来かを判定する。
 * 履歴は API 側でグルーピング前に除外するが、設定変更直後に残っている
 * グループ通知も一瞬表示しないよう、全員が Bot のグループも判定する。
 */
export function isNotificationFromBot(notification: Misskey.entities.Notification): boolean {
	if ('user' in notification && notification.user?.isBot === true) return true;
	if (notification.type === 'reaction:grouped') {
		return notification.reactions.length > 0 && notification.reactions.every(reaction => reaction.user.isBot === true);
	}
	if (notification.type === 'renote:grouped' || notification.type === 'note:grouped') {
		return notification.users.length > 0 && notification.users.every(user => user.isBot === true);
	}
	return false;
}

export function hasConfiguredNotificationFilter(
	excludeTypes: readonly string[] | null | undefined,
	knownTypes: readonly string[] | null | undefined,
): boolean {
	return (excludeTypes?.length ?? 0) > 0 || (knownTypes?.length ?? 0) > 0;
}

/**
 * knownTypes を持たない旧フィルタへ、更新時点の通知種別を一度だけ記録する。
 * これにより次回以降に増えた通知種別だけを未選択として扱える。
 */
export function migrateNotificationFilterSnapshot(
	excludeTypes: readonly string[] | null | undefined,
	knownTypes: readonly string[] | null | undefined,
): StoredNotificationFilterState | null {
	if ((excludeTypes?.length ?? 0) === 0 || (knownTypes?.length ?? 0) > 0) return null;
	return {
		excludeTypes: (excludeTypes ?? []).filter(type => !isMandatoryNotificationType(type)),
		knownTypes: [...notificationTypes],
	};
}

/**
 * 保存時点では存在しなかった通知種別を、利用者の確認なしに自動でONにしないための初期状態を作る。
 * knownTypes が無い旧設定は従来どおり現在の全種別を既知として扱い、既存表示を勝手に変えない。
 * アイコンデコの獲得通知だけは、スナップショットや過去の種類除外にかかわらず有効とする。
 * ブランド選択による表示の絞り込みは別途適用する。
 */
export function resolveNotificationFilter(
	excludeTypes: readonly string[] | null | undefined,
	knownTypes: readonly string[] | null | undefined,
): NotificationFilterState {
	const currentTypes = new Set<string>(notificationTypes);
	const excluded = new Set<string>(excludeTypes ?? []);
	const hasSnapshot = (knownTypes?.length ?? 0) > 0;
	const known = new Set<string>(hasSnapshot ? knownTypes : notificationTypes);

	if (hasSnapshot) {
		for (const type of notificationTypes) {
			if (!known.has(type) && !isMandatoryNotificationType(type)) excluded.add(type);
		}
	}

	return {
		excludeTypes: unique([...excluded].filter(type => currentTypes.has(type) && !isMandatoryNotificationType(type))).filter(isNotificationType),
		knownTypes: unique(hasSnapshot ? (knownTypes ?? []) : notificationTypes),
	};
}

/**
 * ダイアログで確定した現在版の選択を保存形式へ戻す。
 * 新しい版で追加された未知の値は捨てず、古いクライアントから保存しても設定を壊さない。
 */
export function serializeNotificationFilter(
	disabledCurrentTypes: readonly string[],
	previousExcludeTypes: readonly string[] | null | undefined,
	previousKnownTypes: readonly string[] | null | undefined,
): StoredNotificationFilterState {
	const currentTypes = new Set<string>(notificationTypes);
	const unknownExcluded = (previousExcludeTypes ?? []).filter(type => !currentTypes.has(type));
	const unknownKnown = (previousKnownTypes ?? []).filter(type => !currentTypes.has(type));

	return {
		excludeTypes: unique([
			...unknownExcluded,
			...disabledCurrentTypes.filter(type => currentTypes.has(type) && !isMandatoryNotificationType(type)),
		]),
		knownTypes: unique([...unknownKnown, ...notificationTypes]),
	};
}
