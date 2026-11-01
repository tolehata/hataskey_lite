/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskTodoMobileTab } from '@/components/hatask/hatask-planner-types.js';

export const HATASK_TODO_DEFAULT_MOBILE_TABS: readonly HataskTodoMobileTab[] = ['today', 'upcoming', 'all', 'completed', 'more'];
export const HATASK_TODO_MAX_MOBILE_TABS = 5;
const mobileTabs = new Set<HataskTodoMobileTab>(['today', 'upcoming', 'overdue', 'priority', 'all', 'completed', 'templates', 'more']);

/** An explicit array is the visible order; omitted views must not be re-added. */
export function normalizeHataskTodoMobileTabs(value: unknown): HataskTodoMobileTab[] {
	if (!Array.isArray(value)) return [...HATASK_TODO_DEFAULT_MOBILE_TABS];
	const unique = value.filter((tab, index): tab is HataskTodoMobileTab => typeof tab === 'string' && mobileTabs.has(tab as HataskTodoMobileTab) && value.indexOf(tab) === index);
	if (value.length > 0 && unique.length === 0) return [...HATASK_TODO_DEFAULT_MOBILE_TABS];
	// More also owns the folder organizer and the hidden views. Keep that route
	// reachable even when someone hides every direct view. Existing saved orders
	// over the new limit keep their first shortcuts instead of restoring omitted views.
	const directTabs: HataskTodoMobileTab[] = unique.filter(tab => tab !== 'more').slice(0, HATASK_TODO_MAX_MOBILE_TABS - 1);
	const moreIndex = unique.indexOf('more');
	directTabs.splice(moreIndex < 0 ? directTabs.length : Math.min(moreIndex, directTabs.length), 0, 'more');
	return directTabs;
}
