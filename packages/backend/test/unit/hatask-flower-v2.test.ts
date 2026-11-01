/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test } from 'vitest';
import { flowerDay, flowerResetAt, normalizeFlowerTodoTitle } from '@/core/hatask-flower-v2.js';

describe('Hatask flower reward calendar', () => {
	test('normalizes full-width letters, case, and whitespace for duplicate rewards', () => {
		expect(normalizeFlowerTodoTitle('  Ａ B\nＣ　')).toBe('abc');
	});
	test.each([
		['2026-12-31T15:00:00Z', 'Asia/Tokyo', '2027-01-01', '2027-01-01T15:00:00.000Z'],
		['2026-03-08T05:00:00Z', 'America/New_York', '2026-03-08', '2026-03-09T04:00:00.000Z'],
		['2026-11-01T04:00:00Z', 'America/New_York', '2026-11-01', '2026-11-02T05:00:00.000Z'],
	])('resets at the next local midnight from %s in %s', (instant, timezone, day, reset) => {
		expect(flowerDay(new Date(instant), timezone)).toBe(day);
		expect(flowerResetAt(new Date(instant), timezone)).toBe(reset);
	});
});
