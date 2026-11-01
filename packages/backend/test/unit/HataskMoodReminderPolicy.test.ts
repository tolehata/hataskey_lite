/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { getDueHataskMoodReminder } from '@/misc/hatask-mood-reminder.js';

const noon = Date.parse('2026-09-17T03:00:00Z');
const enabled = { moodRemind: true, moodRemindTimes: ['昼 12:00'] };
const expectedNoon = { date: '2026-09-17', time: '12:00', key: '2026-09-17T12:00', timeZone: 'Asia/Tokyo' };
const mood = { id: 'mood-1', date: '2026-09-17', time: '09:30', level: 3 };

describe('Hatask mood reminder policy', () => {
	test('delivers an enabled local slot without requiring an open browser', () => {
		expect(getDueHataskMoodReminder(enabled, [], [], noon)).toEqual(expectedNoon);
	});

	test.each([
		['朝 8:00', '08:00'], ['昼 12:00', '12:00'], ['夜 20:00', '20:00'], ['寝る前 23:00', '23:00'],
	])('recognizes the saved %s slot', (label, time) => {
		const now = Date.parse(`2026-09-17T${time}:00+09:00`);
		expect(getDueHataskMoodReminder({ moodRemind: true, moodRemindTimes: [label] }, [], [], now)).toEqual({
			...expectedNoon, time, key: `2026-09-17T${time}`,
		});
	});

	test.each([-1, -60_000, 120 * 60_000, 180 * 60_000])('does not deliver outside the catch-up window (%i ms)', offset => {
		expect(getDueHataskMoodReminder(enabled, [], [], noon + offset)).toBeNull();
	});

	// The single-concurrency system queue can be held by daily maintenance jobs or a paused host.
	test.each([0, 60_000, 15 * 60_000, 31 * 60_000, 120 * 60_000 - 1])('allows a delayed worker inside the catch-up window (%i ms)', offset => {
		expect(getDueHataskMoodReminder(enabled, [], [], noon + offset)).toEqual(expectedNoon);
	});

	test('does not catch up a slot that had already passed when the settings were saved', () => {
		expect(getDueHataskMoodReminder(enabled, [], [], noon + 30 * 60_000, noon + 20 * 60_000)).toBeNull();
		expect(getDueHataskMoodReminder(enabled, [], [], noon + 30 * 60_000, noon + 60_000)).toBeNull();
		expect(getDueHataskMoodReminder(enabled, [], [], noon + 30 * 60_000, noon + 30_000)).toEqual(expectedNoon);
		expect(getDueHataskMoodReminder(enabled, [], [], noon + 30 * 60_000, noon - 60 * 60_000)).toEqual(expectedNoon);
		expect(getDueHataskMoodReminder(enabled, [], [], noon + 30 * 60_000, undefined)).toEqual(expectedNoon);
	});

	test('picks the most recent due slot', () => {
		const settings = { moodRemind: true, moodRemindTimes: ['昼 12:00', '朝 8:00'] };
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2026-09-17T09:30:00+09:00'))?.time).toBe('08:00');
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2026-09-17T12:30:00+09:00'))?.time).toBe('12:00');
	});

	test('handles each chosen slot once, and starts again the following day', () => {
		const settings = { moodRemind: true, moodRemindTimes: ['昼 12:00', '寝る前 23:00'] };
		const handled = ['2026-09-17T12:00'];
		expect(getDueHataskMoodReminder(settings, [], handled, noon + 60_000)).toBeNull();
		expect(getDueHataskMoodReminder(settings, [], handled, Date.parse('2026-09-17T14:00:00Z'))?.time).toBe('23:00');
		expect(getDueHataskMoodReminder(settings, [], [...handled, '2026-09-17T23:00'], noon + 86_400_000)).toEqual({
			...expectedNoon, date: '2026-09-18', key: '2026-09-18T12:00',
		});
	});

	test('a valid record today suppresses all later reminders, but yesterday does not', () => {
		const settings = { moodRemind: true, moodRemindTimes: ['昼 12:00', '寝る前 23:00'] };
		expect(getDueHataskMoodReminder(settings, [mood], [], noon)).toBeNull();
		expect(getDueHataskMoodReminder(settings, [mood], [], Date.parse('2026-09-17T14:00:00Z'))).toBeNull();
		expect(getDueHataskMoodReminder(settings, [mood], [], noon + 86_400_000)?.date).toBe('2026-09-18');
	});

	test('retains the frontend treatment of legacy records with a string time', () => {
		expect(getDueHataskMoodReminder(enabled, [{ ...mood, time: '', note: null, emoji: null, reasons: null }], [], noon)).toBeNull();
	});

	test('ignores malformed individual mood rows without discarding other valid records', () => {
		const invalid = [null, {}, { ...mood, level: 0 }, { ...mood, level: 6 }, { ...mood, level: 1.5 },
			{ ...mood, level: '3' }, { ...mood, time: null }, { ...mood, id: null }, { ...mood, note: 1 },
			{ ...mood, emoji: {} }, { ...mood, reasons: ['reason', 3] }, { ...mood, date: '2026-02-30' }];
		expect(getDueHataskMoodReminder(enabled, invalid, [], noon)).toEqual(expectedNoon);
		expect(getDueHataskMoodReminder(enabled, [...invalid, mood], [], noon)).toBeNull();
	});

	test('uses the legacy noon and bedtime defaults only when the times field is absent', () => {
		const settings = { moodRemind: true };
		expect(getDueHataskMoodReminder(settings, [], [], noon)).toEqual(expectedNoon);
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2026-09-17T14:00:00Z'))?.time).toBe('23:00');
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2026-09-16T23:00:00Z'))).toBeNull();
		expect(getDueHataskMoodReminder({ ...settings, moodRemindTimes: [] }, [], [], noon)).toBeNull();
	});

	test.each([null, undefined, [], 'settings', {}, { moodRemind: false }, { moodRemind: 'true' }, { moodRemind: 1 }].map(settings => ({ settings })))('requires an explicitly enabled setting (%j)', ({ settings }) => {
		expect(getDueHataskMoodReminder(settings, [], [], noon)).toBeNull();
	});

	test.each([null, '昼 12:00', {}, ['12:00'], ['__proto__'], [null], ['昼 12:00', 'unknown']].map(times => ({ times })))('skips malformed time selections (%j)', ({ times }) => {
		expect(getDueHataskMoodReminder({ ...enabled, moodRemindTimes: times }, [], [], noon)).toBeNull();
	});

	test.each([null, undefined, {}, 'moods'])('skips an unreadable mood collection (%j)', moods => {
		expect(getDueHataskMoodReminder(enabled, moods, [], noon)).toBeNull();
	});

	test.each([NaN, Infinity, -Infinity, 9e15])('skips an invalid clock (%s)', now => {
		expect(getDueHataskMoodReminder(enabled, [], [], now)).toBeNull();
	});

	test.each([null, '', 'Invalid/Zone', '+09:00', 540, []].map(timeZone => ({ timeZone })))('skips an invalid stored timezone (%j)', ({ timeZone }) => {
		expect(getDueHataskMoodReminder({ ...enabled, moodRemindTimeZone: timeZone }, [], [], noon)).toBeNull();
	});

	test.each([
		['Asia/Tokyo', '2026-09-17T03:00:00Z'],
		['UTC', '2026-09-17T12:00:00Z'],
		['America/New_York', '2026-09-17T16:00:00Z'],
	])('uses the persisted %s timezone for slots and the recorded day', (timeZone, timestamp) => {
		const settings = { ...enabled, moodRemindTimeZone: timeZone };
		const now = Date.parse(timestamp);
		expect(getDueHataskMoodReminder(settings, [], [], now)).toEqual({ ...expectedNoon, timeZone });
		expect(getDueHataskMoodReminder(settings, [mood], [], now)).toBeNull();
	});

	test('uses the local date when it differs from the UTC date', () => {
		const settings = { moodRemind: true, moodRemindTimes: ['寝る前 23:00'], moodRemindTimeZone: 'America/New_York' };
		const now = Date.parse('2026-09-18T03:00:00Z');
		expect(getDueHataskMoodReminder(settings, [], [], now)).toEqual({ date: '2026-09-17', time: '23:00', key: '2026-09-17T23:00', timeZone: 'America/New_York' });
		expect(getDueHataskMoodReminder(settings, [mood], [], now)).toBeNull();
	});

	test('follows daylight-saving offset changes without changing the chosen wall-clock time', () => {
		const settings = { ...enabled, moodRemindTimeZone: 'America/New_York' };
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2026-03-07T17:00:00Z'))?.time).toBe('12:00');
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2026-03-08T16:00:00Z'))?.time).toBe('12:00');
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2026-03-08T18:00:00Z'))).toBeNull();
	});

	test('does not repeat a slot when a timezone clock moves back over 23:00', () => {
		const settings = { moodRemind: true, moodRemindTimes: ['寝る前 23:00'], moodRemindTimeZone: 'Antarctica/Casey' };
		// Casey moved from UTC+11 to UTC+08, repeating 23:00 on 2010-03-04.
		const first = getDueHataskMoodReminder(settings, [], [], Date.parse('2010-03-04T12:00:00Z'));
		expect(first?.key).toBe('2010-03-04T23:00');
		expect(getDueHataskMoodReminder(settings, [], [], Date.parse('2010-03-04T15:00:00Z'))).toEqual(first);
		expect(getDueHataskMoodReminder(settings, [], [first!.key], Date.parse('2010-03-04T15:00:00Z'))).toBeNull();
	});

	test('changing the timezone does not resend the same local date and time', () => {
		expect(getDueHataskMoodReminder({ ...enabled, moodRemindTimeZone: 'UTC' }, [], [expectedNoon.key], Date.parse('2026-09-17T12:00:00Z'))).toBeNull();
	});

	test('never mutates saved settings, records, or handled slots', () => {
		const settings = Object.freeze({ moodRemind: true, moodRemindTimes: Object.freeze(['昼 12:00', '昼 12:00']) });
		const moods = Object.freeze([Object.freeze({ ...mood, date: '2026-09-16' })]);
		const handled = Object.freeze(['2026-09-16T12:00']);
		expect(getDueHataskMoodReminder(settings, moods, handled, noon)).toEqual(expectedNoon);
	});
});
