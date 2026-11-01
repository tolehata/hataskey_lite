/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it } from 'vitest';
import { reorderHk3TopNav, restoreHk3MobileOrder } from './hk3-mobile-order.js';

const choices = ['antenna', 'list', 'mixed', 'local', 'following'].map(id => ({ id, label: id, icon: id }));

describe('UI S mobile ordering', () => {
	it('ignores stale order after the user changes the shared navbar settings', () => {
		expect(restoreHk3MobileOrder(choices, JSON.stringify({ base: 'old', ids: ['following', 'local'] }), 'new')).toEqual(choices);
	});
	it('drops removed/duplicate entries and appends newly available timelines', () => {
		const result = restoreHk3MobileOrder(choices, JSON.stringify({ base: 'same', ids: ['local', 'removed', 'local', 7, 'list'] }), 'same');
		expect(result.map(item => item.id)).toEqual(['local', 'list', 'antenna', 'mixed', 'following']);
	});
	it('places a newly available Hatady tab after Trending in the capsule while keeping saved choices in order', () => {
		const available = ['antenna', 'list', 'hatady', 'trending', 'mixed', 'local', 'following'].map(id => ({ id, label: id, icon: id }));
		const result = restoreHk3MobileOrder(available, JSON.stringify({ base: 'same', ids: ['list', 'trending', 'local', 'following'] }), 'same');
		expect(result.map(item => item.id)).toEqual(['list', 'hatady', 'trending', 'local', 'following', 'antenna', 'mixed']);
		expect([...result].reverse().map(item => item.id).indexOf('hatady')).toBe([...result].reverse().map(item => item.id).indexOf('trending') + 1);
	});
	it('falls back safely for corrupt saved data', () => {
		for (const raw of ['{', 'null', 'true', '{"base":"x","ids":{}}']) expect(restoreHk3MobileOrder(choices, raw, 'x')).toEqual(choices);
	});
	it('reverses the visible picker order without changing hidden settings or metadata', () => {
		const original = [
			{ id: 'following', icon: 'custom-home', label: 'Home', visible: true },
			{ id: 'social', icon: 'custom-social', label: 'Social', visible: false },
			{ id: 'local', icon: 'custom-local', label: 'Local', visible: true },
			{ id: 'mixed', icon: 'custom-global', label: 'Global', visible: true },
		];
		const result = reorderHk3TopNav(original, ['following', 'antenna', 'mixed', 'list', 'local']);
		expect(result).toEqual([original[2], original[1], original[3], original[0]]);
		expect(original.map(item => item.id)).toEqual(['following', 'social', 'local', 'mixed']);
	});
});
