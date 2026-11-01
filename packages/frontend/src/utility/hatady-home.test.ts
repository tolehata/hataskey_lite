/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import type { HatadyActivity } from './hatady-media.js';
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
import {
	activityData,
	collectActivityPages,
	collectWorkPages,
	homePeriod,
	localDateKey,
	summarizeHome,
} from './hatady-home.js';
import { hatadySeconds } from './hatady-ui.js';
import { requireHatadyActivityPage } from './hatady-media.js';

const today = new Date(2026, 8, 13, 12);

function log(id: string, kind = 'study', daysAgo = 0, seconds: number | null = 60): HatadyActivity {
	const date = new Date(today);
	date.setDate(date.getDate() - daysAgo);
	return {
		id,
		type: kind as any,
		occurredAt: date.toISOString(),
		isMine: true,
		visibility: 'private',
		study: { id, kind, title: id, durationSeconds: seconds, durationMinutes: 999 },
	};
}

describe('Hatady home data boundaries', () => {
	test('empty, starting, focused, mixed and quiet reflect the full window', () => {
		expect(summarizeHome([], today).mode).toBe('new');
		expect(summarizeHome([], today, true).mode).toBe('quiet');
		expect(summarizeHome([log('a'), log('b')], today).mode).toBe('starting');
		expect(summarizeHome([log('a'), log('b'), log('c')], today).primary).toBe('study');
		expect(summarizeHome([log('a'), log('b', 'work'), log('c', 'exercise')], today).mode).toBe('mixed');
	});
	test('the 30-day boundary is inclusive and future days cannot bias the ranking', () => {
		const rows = [log('included', 'work', 29), log('old', 'study', 30), log('future', 'exercise', -1)];
		expect(summarizeHome(rows, today).recent.map((row) => row.id)).toEqual(['included']);
		expect(localDateKey(new Date(homePeriod(today).since))).toBe('2026-08-15');
	});
	test('deleted works retain session title, kind and exact seconds', () => {
		const row: HatadyActivity = {
			id: 'session',
			type: 'movie_viewing',
			occurredAt: today.toISOString(),
			isMine: true,
			visibility: 'public',
			media: {
				work: null,
				session: {
					id: 'session',
					workId: null,
					createdAt: today.toISOString(),
					updatedAt: today.toISOString(),
					occurredAt: today.toISOString(),
					kind: 'movie_viewing',
					visibility: 'public',
					durationSeconds: 61,
					durationMinutes: 1,
					workSnapshot: { title: 'saved title', kind: 'movie', genre: 'drama' },
				},
			},
		};
		expect(activityData(row)).toMatchObject({
			title: 'saved title',
			kind: 'movie',
			genre: 'drama',
			seconds: 61,
			workId: null,
		});
		expect(requireHatadyActivityPage({ items: [row], nextCursor: null, hasMore: false }).items).toEqual([row]);
	});
	test('explicit null, explicit zero and legacy minute-only values stay distinct', () => {
		expect(hatadySeconds({ durationSeconds: null, durationMinutes: 30 })).toBeNull();
		expect(hatadySeconds({ durationSeconds: 0, durationMinutes: 30 })).toBe(0);
		expect(hatadySeconds({ durationMinutes: 30 })).toBe(1800);
	});
	test('a later page changes the dominant kind instead of being omitted', async () => {
		const get = vi
			.fn()
			.mockResolvedValueOnce({ items: [log('a')], nextCursor: 'next', hasMore: true })
			.mockResolvedValueOnce({
				items: [log('b', 'work'), log('c', 'work'), log('d', 'work')],
				nextCursor: null,
				hasMore: false,
			});
		const all = await collectActivityPages(get);
		expect(all).toHaveLength(4);
		expect(summarizeHome(all, today).primary).toBe('work');
		expect(get).toHaveBeenLastCalledWith('next');
	});
	test('failed, invalid and repeating pages are rejected rather than counted as complete', async () => {
		const repeat = vi.fn().mockResolvedValue({ items: [log('a')], nextCursor: 'same', hasMore: true });
		await expect(collectActivityPages(repeat)).rejects.toThrow('Incomplete');
		await expect(
			collectActivityPages(async () => {
				throw new Error('offline');
			}),
		).rejects.toThrow('offline');
		expect(() => requireHatadyActivityPage({ items: [null], hasMore: false })).toThrow('Incomplete');
		expect(() => requireHatadyActivityPage(null)).toThrow('Invalid');
		await expect(collectWorkPages(async () => ({ items: [] }) as any)).rejects.toThrow('Invalid');
	});
});
