/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';

export type HataProfileBadgeUser = {
	id: string;
	host: string | null;
	utageSuccessCount?: number;
	utageInterruptionCount?: number;
	hataskFlowerCount?: number;
	showUtageSuccessCount?: boolean;
	showUtageInterruptionCount?: boolean;
	showHataskFlowerCount?: boolean;
};

export type HataProfileBadge = {
	key: 'utageSuccess' | 'utageInterruption' | 'hataskFlower';
	label: string;
	count: number;
	unit: string;
	icon: string;
	description: string;
};

function isShown(user: HataProfileBadgeUser, currentUserId: string | null, count: number | undefined, setting: boolean | undefined): boolean {
	if (user.host != null) return false;
	if (user.id === currentUserId) return setting !== false;
	return typeof count === 'number';
}

function safeCount(value: number | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function getHataProfileBadges(user: HataProfileBadgeUser, currentUserId: string | null): HataProfileBadge[] {
	const badges: HataProfileBadge[] = [];
	const copy = i18n.ts._hata._profileBadges;

	if (isShown(user, currentUserId, user.utageSuccessCount, user.showUtageSuccessCount)) {
		badges.push({
			key: 'utageSuccess',
			label: copy.utageSuccess,
			count: safeCount(user.utageSuccessCount),
			unit: copy.times,
			icon: 'ti ti-confetti',
			description: copy.utageSuccessDescription,
		});
	}

	if (isShown(user, currentUserId, user.utageInterruptionCount, user.showUtageInterruptionCount)) {
		badges.push({
			key: 'utageInterruption',
			label: copy.utageInterruption,
			count: safeCount(user.utageInterruptionCount),
			unit: copy.times,
			icon: 'ti ti-shield-x',
			description: copy.utageInterruptionDescription,
		});
	}

	if (isShown(user, currentUserId, user.hataskFlowerCount, user.showHataskFlowerCount)) {
		badges.push({
			key: 'hataskFlower',
			label: copy.flowersGrown,
			count: safeCount(user.hataskFlowerCount),
			unit: copy.flowersUnit,
			icon: 'ti ti-flower',
			description: copy.flowersGrownDescription,
		});
	}

	return badges;
}
