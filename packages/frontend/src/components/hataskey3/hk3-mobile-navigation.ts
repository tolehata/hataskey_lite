/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import type { Component } from 'vue';

export type Hk3MobileCollectionKind = 'list' | 'antenna';
export type Hk3MobileChoice = { id: string; label: string; icon: string; branch?: Hk3MobileCollectionKind };
export type Hk3MobileNavItem = { path: string; label: string; icon: Component; badge: string | null; active: boolean; brand?: boolean };

/** UI-only bridge. Timeline loading, permissions and streaming remain owned by Hk3Timeline. */
export type Hk3MobileNavigation = {
	choices: Hk3MobileChoice[];
	active: string;
	selected: Record<Hk3MobileCollectionKind, string | null>;
	select: (id: string) => void;
	load: (kind: Hk3MobileCollectionKind) => Promise<{ id: string; name: string }[] | null>;
	selectCollection: (kind: Hk3MobileCollectionKind, id: string) => void;
	settings: (kind: Hk3MobileCollectionKind) => void;
	reorder: (ids: string[]) => void;
	options: { id: string; label: string; icon: string; checked?: boolean; disabled?: boolean; action: () => void }[];
};
