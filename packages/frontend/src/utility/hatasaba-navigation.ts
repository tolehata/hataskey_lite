/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HatasabaNavItem = {
	id: string;
	icon?: string;
	label?: string;
	visible?: boolean;
};

export const HATASABA_BOTTOM_NAV_MAX = 4;

/** hataskey Lite で撤去したアプリの項目。保存済みの並びに残っていても表示しない。 */
const RETIRED_NAV_IDS = new Set(['hatask', 'hatady', 'hatafeed', 'hatagoes', 'earthquake']);

export function normalizeBottomNavItems<T extends HatasabaNavItem>(items: readonly T[]): T[] {
	return items.filter(item => !RETIRED_NAV_IDS.has(item.id));
}

/**
 * 保存済みの並び順・表示状態を保ったまま、新しく追加された候補だけを末尾へ補う。
 */
export function mergeMissingNavItems<T extends HatasabaNavItem>(saved: T[], defaults: T[]): T[] {
	const merged = saved.map(item => ({ ...item }));
	const ids = new Set(merged.map(item => item.id));
	for (const item of defaults) {
		if (ids.has(item.id)) continue;
		merged.push({ ...item });
		ids.add(item.id);
	}
	return merged;
}

export function getVisibleBottomNav<T extends HatasabaNavItem>(items: readonly T[]): T[] {
	return normalizeBottomNavItems(items).filter(item => item.visible !== false).slice(0, HATASABA_BOTTOM_NAV_MAX);
}

export function isListTimelinePath(path: string): boolean {
	return /^\/timeline\/list\/[^/]+\/?$/.test(path);
}

export function isAntennaTimelinePath(path: string): boolean {
	return /^\/timeline\/antenna\/[^/]+\/?$/.test(path);
}

export type TimelineCollectionKind = 'list' | 'antenna';

export function getTimelineCollectionId(path: string, kind: TimelineCollectionKind): string | null {
	const match = path.match(new RegExp(`^/timeline/${kind}/([^/]+)/?$`));
	return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * 端末に記憶した選択がまだ存在すればそれを、無ければ先頭を返す。
 * 削除済みIDをいつまでも開こうとしないため、必ず現在の一覧と突き合わせる。
 */
export function getPreferredTimelinePath(items: { id: string }[], rememberedId: string | null, kind: TimelineCollectionKind): string | null {
	const selected = rememberedId != null ? items.find(item => item.id === rememberedId) : undefined;
	const id = selected?.id ?? items[0]?.id;
	return id ? `/timeline/${kind}/${id}` : null;
}

export function getFirstListTimelinePath(lists: { id: string }[]): string | null {
	return getPreferredTimelinePath(lists, null, 'list');
}
