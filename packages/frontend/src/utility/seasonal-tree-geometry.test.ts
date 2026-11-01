/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, it } from 'vitest';
import { getSeasonalTreeGeometry } from './seasonal-tree-geometry.js';
import type { SeasonalTreeSeason } from './seasonal-tree.js';

const seasons: SeasonalTreeSeason[] = ['spring', 'summer', 'autumn', 'winter'];

describe('seasonal tree geometry', () => {
	it('reuses the same geometry and particles across instances and revisited seasons', () => {
		const spring = getSeasonalTreeGeometry('spring');
		const summer = getSeasonalTreeGeometry('summer');
		expect(summer).not.toBe(spring);
		expect(getSeasonalTreeGeometry('spring')).toBe(spring);
		expect(getSeasonalTreeGeometry('spring').crown).toBe(spring.crown);
		expect(getSeasonalTreeGeometry('spring').particles).toBe(spring.particles);
		expect(getSeasonalTreeGeometry('summer')).toBe(summer);
	});
	it.each(seasons)('keeps %s paths finite and the animated particle pool bounded', season => {
		const geometry = getSeasonalTreeGeometry(season);
		const visit = (value: unknown): void => {
			if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
			else if (typeof value === 'string') expect(value).not.toMatch(/NaN|Infinity|undefined/);
			else if (Array.isArray(value)) value.forEach(visit);
			else if (value && typeof value === 'object') Object.values(value).forEach(visit);
		};
		visit(geometry);
		expect(geometry.limbs.length).toBeGreaterThan(0);
		expect(geometry.particles.length).toBeGreaterThan(0);
		expect(geometry.particles.length).toBeLessThanOrEqual(20);
		// Geometry is stored as compound paths, not one DOM element per leaf.
		expect(JSON.stringify(geometry).length).toBeLessThan(1_000_000);
	});
});
