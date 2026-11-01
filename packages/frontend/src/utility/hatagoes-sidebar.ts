/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const RETIRED_HATA_SIDEBAR_IDS: ReadonlySet<string> = new Set(['hatask', 'hatafeed', 'hatady']);

function preferredIndex(ids: readonly string[]): number {
	const existing = ids.indexOf('hatagoes');
	return existing >= 0 ? existing : ids.findIndex(id => RETIRED_HATA_SIDEBAR_IDS.has(id));
}

/** 既存の HataGoes を優先し、旧3項目を最初の該当位置で1件に統合する。 */
export function normalizeHatagoesMenu(menu: readonly string[]): string[] {
	const keep = preferredIndex(menu);
	return menu.flatMap((id, index) => {
		if (id === 'hatagoes' || RETIRED_HATA_SIDEBAR_IDS.has(id)) {
			return index === keep ? ['hatagoes'] : [];
		}
		return [id];
	});
}

type SidebarItem = { id: string; icon: string; label: string; external?: boolean; url?: string };

export function normalizeHatagoesSidebar<T extends SidebarItem>(sidebar: readonly T[]): T[] {
	const keep = preferredIndex(sidebar.map(item => item.id));
	return sidebar.flatMap((item, index) => {
		if (item.id === 'hatagoes') return index === keep ? [item] : [];
		if (!RETIRED_HATA_SIDEBAR_IDS.has(item.id)) return [item];
		if (index !== keep) return [];
		const { external: _external, url: _url, ...metadata } = item;
		return [{ ...metadata, id: 'hatagoes', icon: 'ti ti-sparkles', label: 'HataGoes' } as T];
	});
}
