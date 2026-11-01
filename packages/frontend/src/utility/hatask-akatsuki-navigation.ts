/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskAkatsukiTab } from '@/components/hatask/hatask-akatsuki-types.js';

export const HATASK_AKATSUKI_SHORTCUTS = ['cal', 'todo', 'mood', 'meal', 'recipe', 'garden', 'support', 'ranking'] as const;
export type HataskAkatsukiShortcut = typeof HATASK_AKATSUKI_SHORTCUTS[number];
const tabs: readonly HataskAkatsukiTab[] = ['home', ...HATASK_AKATSUKI_SHORTCUTS, 'hataskapps', 'apps'];

export function normalizeHataskAkatsukiShortcut(value: unknown): HataskAkatsukiShortcut {
	return HATASK_AKATSUKI_SHORTCUTS.includes(value as HataskAkatsukiShortcut) ? value as HataskAkatsukiShortcut : 'todo';
}

export function isHataskAkatsukiRequiredTab(id: HataskAkatsukiTab): boolean {
	return id === 'home' || id === 'hataskapps';
}

/** Display-only fallback: never mutate or persist the supplied settings. */
export function normalizeHataskAkatsukiMobileTabs(value: unknown, shortcut: unknown = 'todo'): HataskAkatsukiTab[] {
	if (Array.isArray(value) && value.length === 4 && new Set(value).size === 4 && value.includes('home') && value.every(tab => tab === 'eye' || tabs.includes(tab))) {
		const next: HataskAkatsukiTab[] = [...value];
		// Replace the retired EYE slot only, keeping the user's other destinations and order.
		const eyeIndex = value.indexOf('eye');
		if (eyeIndex !== -1) {
			next[eyeIndex] = !next.includes('hataskapps') ? 'hataskapps'
				: [normalizeHataskAkatsukiShortcut(shortcut), 'todo' as const, ...HATASK_AKATSUKI_SHORTCUTS].find(tab => !next.includes(tab)) ?? 'todo';
		}
		// Preserve a valid legacy order, replacing only its final non-Home slot
		// when the now-required Hatask App destination is missing.
		if (!next.includes('hataskapps')) next[next[3] === 'home' ? 2 : 3] = 'hataskapps';
		return next;
	}
	return ['home', normalizeHataskAkatsukiShortcut(shortcut), 'hataskapps', 'apps'];
}

/** Required destinations cannot be replaced, and existing destinations never duplicate or swap. */
export function replaceHataskAkatsukiMobileTab(value: readonly HataskAkatsukiTab[], index: number, replacement: HataskAkatsukiTab): HataskAkatsukiTab[] {
	const next = normalizeHataskAkatsukiMobileTabs(value);
	if (!Number.isInteger(index) || index < 0 || index >= next.length || !tabs.includes(replacement)) return next;
	if (isHataskAkatsukiRequiredTab(next[index]) || next.includes(replacement)) return next;
	next[index] = replacement;
	return next;
}

/** Move one destination to an absolute slot, preserving the order of every other destination. */
export function moveHataskAkatsukiMobileTab(value: readonly HataskAkatsukiTab[], index: number, target: number): HataskAkatsukiTab[] {
	const next = normalizeHataskAkatsukiMobileTabs(value);
	if (!Number.isInteger(index) || !Number.isInteger(target) || index < 0 || index >= next.length || target < 0 || target >= next.length || index === target) return next;
	const [tab] = next.splice(index, 1);
	next.splice(target, 0, tab);
	return next;
}
