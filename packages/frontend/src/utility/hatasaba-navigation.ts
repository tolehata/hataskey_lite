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
export const UI_S_BOTTOM_NAV_MAX = 5;

const HATAGOES_NAV_IDS = new Set(['hatask', 'hatady', 'hatafeed', 'hatagoes']);

/** 旧項目と HataGoes を一つに統合し、表示中の最初の項目の位置と設定を優先する。 */
export function normalizeBottomNavItems<T extends HatasabaNavItem>(items: readonly T[]): T[] {
	const selectedIndex = items.findIndex(item => HATAGOES_NAV_IDS.has(item.id) && item.visible !== false);
	const fallbackIndex = selectedIndex < 0 ? items.findIndex(item => HATAGOES_NAV_IDS.has(item.id)) : selectedIndex;
	return items.flatMap((item, index) => {
		if (!HATAGOES_NAV_IDS.has(item.id)) return [item];
		if (index !== fallbackIndex) return [];
		return [{ ...item, id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes' } as T];
	});
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

const UI_S_BOTTOM_NAV_IDS = new Set(['search', 'home', 'notifications', 'hatagoes', 'widgets']);

/** 共有の既定を引き継ぎ、UI S では HataGoes の右隣にウィジェットも表示する。 */
export function getUiSBottomNavDefaults(sharedDefaults: readonly HatasabaNavItem[]): HatasabaNavItem[] {
	const defaults = normalizeBottomNavItems(sharedDefaults).map(item => ({ ...item, ...(item.id === 'hatagoes' || item.id === 'widgets' ? { visible: true } : {}) }));
	const widgetsIndex = defaults.findIndex(item => item.id === 'widgets');
	if (widgetsIndex >= 0 && defaults.some(item => item.id === 'hatagoes')) {
		const [widgets] = defaults.splice(widgetsIndex, 1);
		defaults.splice(defaults.findIndex(item => item.id === 'hatagoes') + 1, 0, widgets!);
	}
	return defaults;
}

/** 未保存の UI S は旧設定を引き継ぐ。カスタム設定の可視性と順序はそのままにする。 */
export function resolveUiSBottomNav(saved: readonly HatasabaNavItem[] | null | undefined, legacy: readonly HatasabaNavItem[], sharedDefaults: readonly HatasabaNavItem[]): HatasabaNavItem[] {
	const defaults = getUiSBottomNavDefaults(sharedDefaults);
	const normalizedLegacy = normalizeBottomNavItems(legacy);
	const normalizedSharedDefaults = normalizeBottomNavItems(sharedDefaults);
	const legacyIsDefault = normalizedLegacy.length === normalizedSharedDefaults.length && normalizedLegacy.every((item, index) => {
		const standard = normalizedSharedDefaults[index]!;
		return Object.keys(item).length === Object.keys(standard).length
			&& Object.entries(standard).every(([key, value]) => Reflect.get(item, key) === value);
	});
	const source = saved == null ? (legacyIsDefault ? defaults : normalizedLegacy) : normalizeBottomNavItems(saved);
	// 追加候補を勝手に ON にしない。ホームだけは UI S で常時表示する。
	return mergeMissingNavItems([...source], defaults.map(item => ({ ...item, visible: item.id === 'home' })));
}

/** UI S の表示だけを正規化する。共有設定の順序・可視性は書き換えない。 */
export function normalizeUiSBottomNav(items: readonly HatasabaNavItem[]): HatasabaNavItem[] {
	const seen = new Set<string>();
	const visible = normalizeBottomNavItems(items).filter(item => {
		if (!UI_S_BOTTOM_NAV_IDS.has(item.id) || seen.has(item.id)) return false;
		seen.add(item.id);
		return item.id === 'home' || item.visible !== false;
	}).map(item => ({ ...item, ...(item.id === 'home' ? { visible: true } : {}) }));
	if (!seen.has('home')) visible.push({ id: 'home', visible: true });
	const homeIndex = visible.findIndex(item => item.id === 'home');
	// 固定の menu と合わせて6枠。ホームより前の項目同士の順序も保つ。
	return homeIndex >= UI_S_BOTTOM_NAV_MAX
		? [...visible.slice(0, UI_S_BOTTOM_NAV_MAX - 1), visible[homeIndex]!]
		: visible.slice(0, UI_S_BOTTOM_NAV_MAX);
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
