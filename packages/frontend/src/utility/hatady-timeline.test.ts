/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test } from 'vitest';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import { HatadyTimelineGeneration, hatadyTimelineAutoRefreshAllowed, hatadyTimelineShouldLoadOnActivate, hatadyTimelineTrackedKeys, removeHatadyTimelineActivity, sortHatadyTimelineActivities, upsertHatadyTimelineActivity } from './hatady-timeline.js';

function activity(id: string, source: 'log' | 'session', occurredAt: string, title = id): HatadyActivity {
	return {
		id, type: source === 'log' ? 'study' : 'movie_viewing', occurredAt,
		visibility: 'public', isMine: false,
		...(source === 'log' ? { study: { id, title } } : { media: { session: { id, note: title }, work: null } }),
	} as HatadyActivity;
}

describe('Hatady timeline reconciliation', () => {
	test('orders backdated records by occurredAt, then logs before sessions and source IDs descending', () => {
		const time = '2026-09-30T12:00:00.000Z';
		const older = activity('z', 'log', '2026-09-29T12:00:00.000Z');
		const rows = sortHatadyTimelineActivities([older, activity('a', 'session', time), activity('a', 'log', time), activity('b', 'log', time)]);
		expect(rows.map(row => `${row.study ? 'log' : 'session'}:${row.id}`)).toEqual(['log:b', 'log:a', 'session:a', 'log:z']);
	});

	test('replaces an updated record without duplicating it and removes only its source key', () => {
		const time = '2026-09-30T12:00:00.000Z';
		const original = activity('same', 'log', time);
		const session = activity('same', 'session', time);
		const changed = activity('same', 'log', '2026-09-30T13:00:00.000Z', 'edited');
		const rows = upsertHatadyTimelineActivity([original, session], changed);
		expect(rows).toHaveLength(2);
		expect(rows[0].study?.title).toBe('edited');
		expect(hatadyTimelineTrackedKeys(rows, [changed])).toEqual(['log:same', 'session:same']);
		expect(removeHatadyTimelineActivity(rows, 'log:same')).toEqual([session]);
	});

	test('discarding a stale REST generation cannot overwrite a newer filter or reconnect result', () => {
		const requests = new HatadyTimelineGeneration();
		const first = requests.next();
		const second = requests.next();
		expect(requests.current(first)).toBe(false);
		expect(requests.current(second)).toBe(true);
		requests.invalidate();
		expect(requests.current(second)).toBe(false);
	});

	test('manual mode never permits visibility or reconnect refresh', () => {
		expect(hatadyTimelineAutoRefreshAllowed(true, false, true)).toBe(false);
		expect(hatadyTimelineAutoRefreshAllowed(true, true, false)).toBe(false);
		expect(hatadyTimelineAutoRefreshAllowed(false, true, true)).toBe(false);
		expect(hatadyTimelineAutoRefreshAllowed(true, true, true)).toBe(true);
		expect(hatadyTimelineShouldLoadOnActivate(false, false)).toBe(true);
		expect(hatadyTimelineShouldLoadOnActivate(false, true)).toBe(false);
	});
});
