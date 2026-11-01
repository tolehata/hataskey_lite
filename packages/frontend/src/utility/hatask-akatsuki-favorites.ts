/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskAkatsukiFavoriteId } from '@/components/hatask/hatask-akatsuki-types.js';

export const HATASK_AKATSUKI_FAVORITES = [
	{ id: 'calendar', label: 'カレンダー', icon: 'ti ti-calendar-event' },
	{ id: 'todo', label: 'ToDo', icon: 'ti ti-checkbox' },
	{ id: 'meal', label: 'ごはん', icon: 'ti ti-soup' },
	{ id: 'flower', label: 'おはな', icon: 'ti ti-flower' },
] as const;

export function normalizeHataskAkatsukiFavorites(value: unknown): HataskAkatsukiFavoriteId[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.filter((id): id is HataskAkatsukiFavoriteId => HATASK_AKATSUKI_FAVORITES.some(choice => choice.id === id)))].slice(0, 2);
}
