/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { RolePolicies } from './RoleService.js';
import type { MiRole } from '@/models/Role.js';

export const HATASK_SUPPORT_POLICY_KEYS = [
	'driveCapacityMb', 'canMakePrivateChannel', 'hataSideStudioProfileLimit', 'avatarDecorationLimit', 'emojiRequestLimit',
	'favoriteFolderLimit', 'canCreateFavoriteSubfolders', 'canUseNoteCharm',
	'hatadyBookLimit', 'canUseHatadySync', 'canUseMascot', 'mascotMaxExpressions', 'mascotMaxPhrases',
	'mascotMaxCharacters', 'rateLimitFactor',
] as const satisfies readonly (keyof RolePolicies)[];

export type HataskSupportPolicyKey = typeof HATASK_SUPPORT_POLICY_KEYS[number];
export interface HataskSupportBenefit {
	key: HataskSupportPolicyKey;
	title: string;
	description: string;
	roleId: string | null;
	visible: boolean;
	showBaseline: boolean;
}
export interface HataskSupportSettings {
	enabled: boolean;
	navButtonVisible: boolean;
	platform: string;
	url: string;
	manageUrl: string;
	intro: string;
	bannerTitle: string;
	bannerMessage: string;
	bannerVisible: boolean;
	benefits: HataskSupportBenefit[];
}
export interface HataskSupportSnapshot {
	value: number | boolean | null;
	available: boolean;
	unlimited: boolean;
	condition: 'mascotUnavailable' | null;
	rateMultiplier: number | null;
}

export function defaultHataskSupportSettings(): HataskSupportSettings {
	return {
		enabled: false, navButtonVisible: true, platform: '', url: '', manageUrl: '', intro: '',
		bannerTitle: 'ご支援ありがとうございます！',
		bannerMessage: 'みなさんのご支援が、\nサーバーの運営を支えています。\nいつもこの場所を大切にしてくださり、\nありがとうございます',
		bannerVisible: true, benefits: [],
	};
}

export function supportConfigured(settings: HataskSupportSettings): boolean {
	return settings.enabled && settings.url !== '';
}

export function safeSupportUrl(value: string): boolean {
	if (value === '') return true;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.username === '' && url.password === '';
	} catch { return false; }
}

/** Only explicitly selected policies and their availability prerequisites are ever packed. */
export function supportSnapshot(key: HataskSupportPolicyKey, policies: RolePolicies, base: RolePolicies = policies): HataskSupportSnapshot {
	const raw = policies[key];
	const value = typeof raw === 'boolean' || (typeof raw === 'number' && Number.isFinite(raw)) ? raw : null;
	const mascotChild = key === 'mascotMaxExpressions' || key === 'mascotMaxPhrases' || key === 'mascotMaxCharacters';
	const condition = mascotChild && !policies.canUseMascot ? 'mascotUnavailable' : null;
	const unlimited = key === 'rateLimitFactor' && typeof value === 'number' && value <= 0;
	const available = condition === null && (typeof value === 'boolean' ? value : typeof value === 'number' && (key === 'rateLimitFactor' || value > 0));
	const ratio = key === 'rateLimitFactor' && typeof value === 'number' && value > 0 && base.rateLimitFactor > 0 ? base.rateLimitFactor / value : null;
	const rateMultiplier = ratio !== null && Number.isFinite(ratio) ? ratio : null;
	return { value, available, unlimited, condition, rateMultiplier };
}

export function supportReflected(key: HataskSupportPolicyKey, current: HataskSupportSnapshot, offered: HataskSupportSnapshot | null): boolean {
	if (!offered || current.value === null || offered.value === null || current.condition !== null || offered.condition !== null) return false;
	if (typeof offered.value === 'boolean') return typeof current.value === 'boolean' && (current.value || !offered.value);
	if (typeof current.value !== 'number') return false;
	if (key === 'rateLimitFactor') return offered.unlimited ? current.unlimited : current.value <= offered.value;
	return current.value >= offered.value;
}

/** Single-role preview follows useDefault, then the same quota normalizer as RoleService. */
export function supportRolePolicies(base: RolePolicies, role: Pick<MiRole, 'policies'>, normalizeFavoriteFolders: (values: readonly unknown[]) => number): RolePolicies {
	const result = { ...base };
	for (const key of HATASK_SUPPORT_POLICY_KEYS) {
		const setting = role.policies[key];
		if (setting && !setting.useDefault) Object.assign(result, { [key]: setting.value });
	}
	result.favoriteFolderLimit = normalizeFavoriteFolders([result.favoriteFolderLimit]);
	result.canCreateFavoriteSubfolders = result.canCreateFavoriteSubfolders === true;
	result.canUseNoteCharm = result.canUseNoteCharm === true;
	return result;
}
