/* SPDX-License-Identifier: AGPL-3.0-only */
import type { Hk3MobileChoice } from './hk3-mobile-navigation.js';

type NavPreference = { id: string; icon: string; label: string; visible: boolean };

export function restoreHk3MobileOrder(choices: Hk3MobileChoice[], raw: string | null, base: string): Hk3MobileChoice[] {
	try {
		const saved: unknown = raw ? JSON.parse(raw) : null;
		if (!saved || typeof saved !== 'object' || !('base' in saved) || saved.base !== base || !('ids' in saved) || !Array.isArray(saved.ids)) return choices;
		const ids = [...new Set(saved.ids.filter((id): id is string => typeof id === 'string'))];
		const ordered = [...ids.flatMap(id => choices.find(item => item.id === id) ?? []), ...choices.filter(item => !ids.includes(item.id))];
		// The picker order is reversed for the capsule. Insert before Trending here
		// so a newly available Hatady tab appears immediately after it there.
		if (!ids.includes('hatady')) {
			const hatady = ordered.find(item => item.id === 'hatady');
			const trending = ordered.findIndex(item => item.id === 'trending');
			if (hatady && trending >= 0) {
				ordered.splice(ordered.indexOf(hatady), 1);
				ordered.splice(ordered.findIndex(item => item.id === 'trending'), 0, hatady);
			}
		}
		return ordered;
	} catch {
		return choices;
	}
}

/** The picker is reversed; retain hidden settings and all metadata while updating the shared TL order. */
export function reorderHk3TopNav(preference: NavPreference[], pickerIds: string[]): NavPreference[] {
	const ids = [...new Set(pickerIds)].reverse();
	const movable = preference.filter(item => item.visible !== false && ids.includes(item.id));
	const ordered = ids.flatMap(id => movable.find(item => item.id === id) ?? []);
	let cursor = 0;
	return preference.map(item => movable.includes(item) ? { ...ordered[cursor++] } : { ...item });
}
