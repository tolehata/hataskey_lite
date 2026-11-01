/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it } from 'vitest';
import { markTimelineAdPage, shouldInsertStreamingAd } from './timeline-ad.js';

describe('timeline ad cadence', () => {
	it.each([['initial', 3], ['older', 10]] as const)('marks the correct %s page note without mutating API results', (phase, index) => {
		const items = Object.freeze(Array.from({ length: 20 }, (_, i) => Object.freeze({ id: String(i) })));
		const marked = markTimelineAdPage([...items], phase);
		expect(marked.map(item => item._shouldInsertAd_ === true ? item.id : null).filter(Boolean)).toEqual([String(index)]);
		expect(marked[index]).not.toBe(items[index]);
		expect(marked.filter((item, i) => i !== index)).toEqual(items.filter((_, i) => i !== index));
		expect(items[index]).not.toHaveProperty('_shouldInsertAd_');
		expect(marked).toHaveLength(items.length);
	});

	it.each([['initial', 3], ['older', 10]] as const)('leaves short %s pages unchanged', (phase, index) => {
		const items = Array.from({ length: index }, (_, i) => ({ id: String(i) }));
		expect(markTimelineAdPage(items, phase)).toBe(items);
	});

	it('disables streaming ads at zero interval and marks only exact multiples', () => {
		expect(shouldInsertStreamingAd(1, 0)).toBe(false);
		expect(shouldInsertStreamingAd(2, 0)).toBe(false);
		expect([1, 2, 3, 4, 5].filter(counter => shouldInsertStreamingAd(counter, 2))).toEqual([2, 4]);
	});
});
