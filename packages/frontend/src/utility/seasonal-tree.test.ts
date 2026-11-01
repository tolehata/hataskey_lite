/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, it } from 'vitest';
import { getSeasonalTreeClock, getSeasonalTreePalette } from './seasonal-tree.js';

describe('seasonal tree Japan time', () => {
	it('changes season at Japan midnight, independent of the host timezone', () => {
		expect(getSeasonalTreeClock(new Date('2026-02-28T14:59:00Z')).season).toBe('winter');
		expect(getSeasonalTreeClock(new Date('2026-02-28T15:00:00Z')).season).toBe('spring');
		expect(getSeasonalTreeClock(new Date('2026-08-31T15:00:00Z')).season).toBe('autumn');
		expect(getSeasonalTreeClock(new Date('2026-11-30T15:00:00Z')).season).toBe('winter');
	});
	it('uses stable time boundaries and a deterministic invalid-date fallback', () => {
		expect(getSeasonalTreeClock(new Date('2026-05-31T19:59:00Z')).timeOfDay).toBe('night');
		expect(getSeasonalTreeClock(new Date('2026-05-31T20:00:00Z')).timeOfDay).toBe('dawn');
		expect(getSeasonalTreeClock(new Date('2026-05-31T23:00:00Z')).timeOfDay).toBe('day');
		expect(getSeasonalTreeClock(new Date('2026-06-01T08:00:00Z')).timeOfDay).toBe('dusk');
		expect(getSeasonalTreeClock(new Date('2026-06-01T10:00:00Z')).timeOfDay).toBe('night');
		expect(getSeasonalTreeClock(new Date(Number.NaN))).toEqual({ season: 'summer', timeOfDay: 'day', minuteOfDay: 720 });
	});
	it('interpolates light continuously and makes both season and night visible in the palette', () => {
		const day = getSeasonalTreePalette('summer', 'day');
		const night = getSeasonalTreePalette('summer', 'night');
		const spring = getSeasonalTreePalette('spring', 'day');
		const before = getSeasonalTreePalette('summer', 'dawn', 539);
		const after = getSeasonalTreePalette('summer', 'day', 540);
		expect(day.skyTop).not.toBe(night.skyTop);
		expect(day.groundTop).not.toBe(night.groundTop);
		expect(day.canopyLight).not.toBe(night.canopyLight);
		expect(day.skyTop).not.toBe(spring.skyTop);
		expect(day.starOpacity).toBe(0);
		expect(night.starOpacity).toBeGreaterThan(.5);
		const channel = (hex: string) => parseInt(hex.slice(1, 3), 16);
		expect(Math.abs(channel(before.skyTop) - channel(after.skyTop))).toBeLessThan(2);
	});
	it('matches the approved spring and autumn crowns at dusk without changing night', () => {
		const spring = getSeasonalTreePalette('spring', 'dusk');
		const autumn = getSeasonalTreePalette('autumn', 'dusk');
		expect([spring.canopyMid, spring.canopyLight, spring.accent]).toEqual(['#dca4ae', '#f7cbd0', '#ffe9db']);
		expect([autumn.canopyLight, autumn.accent]).toEqual(['#edba72', '#f9d795']);
		expect(getSeasonalTreePalette('spring', 'night').canopyLight).toBe('#7f888d');
	});
	it('blends sunset colors into and out of the surrounding minutes', () => {
		const distance = (a: string, b: string) => Math.max(...[1, 3, 5].map(offset => Math.abs(parseInt(a.slice(offset, offset + 2), 16) - parseInt(b.slice(offset, offset + 2), 16))));
		for (const minute of [990, 1080, 1200]) {
			const before = getSeasonalTreePalette('spring', 'dusk', minute - 1);
			const after = getSeasonalTreePalette('spring', 'dusk', minute);
			expect(distance(before.canopyMid, after.canopyMid)).toBeLessThanOrEqual(2);
			expect(distance(before.canopyLight, after.canopyLight)).toBeLessThanOrEqual(2);
		}
	});
});
