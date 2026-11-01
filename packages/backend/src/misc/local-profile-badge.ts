/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖独自のプロフィール実績を REST API に含めてよいかを判定する。
 * リモートユーザーには、DB 上の値の有無にかかわらず常に返さない。
 */
export function canExposeLocalProfileBadge(userHost: string | null, isSelf: boolean, isEnabled: boolean): boolean {
	return userHost == null && (isSelf || isEnabled);
}

const LOCAL_PROFILE_BADGE_UPDATE_KEYS = new Set([
	'noteCharm',
	'showUtageSuccessCount',
	'showUtageInterruptionCount',
	'showHataskFlowerCount',
	'hataskFlowerCount',
]);

/** 独自バッジだけの更新なら ActivityPub Update を送らないための境界判定。 */
export function isLocalProfileBadgeOnlyUpdate(keys: string[]): boolean {
	return keys.length > 0 && keys.every(key => LOCAL_PROFILE_BADGE_UPDATE_KEYS.has(key));
}
