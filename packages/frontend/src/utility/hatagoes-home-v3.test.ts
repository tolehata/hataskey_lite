/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
import { buildHatagoesJournalV3 } from './hatagoes-home-v3.js';

describe('home journal projection', () => {
	test('uses the latest valid entry per day and preserves skipped meals as actual records', () => {
		const moods = [{ id: 'old', date: '2026-10-03', time: '08:00', level: 2 }, { id: 'latest', date: '2026-10-03', time: '12:00', level: 4 }, { id: 'invalid', date: '2026-10-03', time: '13:00', level: 7 }];
		const meals = [{ id: 'skip', date: '2026-10-03', time: '08:00', slot: 'breakfast', level: 'none' }];
		const before = JSON.stringify({ moods, meals });
		const result = buildHatagoesJournalV3(moods, meals, new Date(2026, 9, 3, 14));
		expect(result.mood?.id).toBe('latest');
		expect(result.week).toHaveLength(7);
		expect(result.week.at(-1)?.mood?.id).toBe('latest');
		expect(result.meals[0].entry?.level).toBe('none');
		expect(result.meals[1].entry).toBeUndefined();
		expect(JSON.stringify({ moods, meals })).toBe(before);
	});
	test('the week crosses month boundaries without projecting the retired history card', () => {
		const result = buildHatagoesJournalV3([{ id: 'past', date: '2026-09-26', time: '12:00', level: 4, note: 'ゆっくりできた' }], [], new Date(2026, 9, 3, 1));
		expect(result).not.toHaveProperty('history');
		expect(result.week[0].date).toBe('2026-09-27');
	});
});
