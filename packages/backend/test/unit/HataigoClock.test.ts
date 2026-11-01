/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { consumeTurn, createClock, projectClock, resumeClock, validateClock } from '@/misc/hataigo/clock.js';
import type { ClockConfig } from '@/misc/hataigo/clock.js';

const config: ClockConfig = { kind: 'byoyomi', mainSec: 1, periodSec: 30, periods: 3 };

describe('authoritative HataIgo clock', () => {
	test.each([
		[500, 500, 3, null], [1000, 0, 3, null], [31000, 0, 3, null], [31001, 0, 2, null],
		[61000, 0, 2, null], [61001, 0, 1, null], [91000, 0, 1, null], [91001, 0, 0, 'black'],
	] as const)('projects elapsed %i ms with inclusive period boundaries', (at, mainRemaining, periods, expired) => {
		const clock = createClock(config, 'black', 0);
		const before = JSON.stringify(clock);
		const projection = projectClock(config, clock, at);
		expect(projection.state.black.mainRemainingMs).toBe(mainRemaining);
		expect(projection.state.black.periodsRemaining).toBe(periods);
		expect(projection.expiredColor).toBe(expired);
		expect(projection.deadlineAtMs).toBe(91000);
		expect(JSON.stringify(clock)).toBe(before);
	});

	test('a legal turn preserves consumed periods and resets only the current period next turn', () => {
		const first = consumeTurn(config, createClock(config, 'black', 0), 'white', 31001);
		expect(first.black).toEqual({ mainRemainingMs: 0, periodsRemaining: 2 });
		const second = consumeTurn(config, first, 'black', 31501);
		expect(second.white.mainRemainingMs).toBe(500);
		expect(projectClock(config, second, 31501).remainingTurnMs).toBe(30000);
		expect(projectClock(config, second, 61501).state.black.periodsRemaining).toBe(2);
		expect(projectClock(config, second, 61502).state.black.periodsRemaining).toBe(1);
	});

	test('scoring pauses the clock and unilateral resumption starts a fresh opponent turn', () => {
		const paused = consumeTurn(config, createClock(config, 'black', 0), null, 1500);
		expect(projectClock(config, paused, 1000000).expiredColor).toBeNull();
		expect(projectClock(config, paused, 1000000).deadlineAtMs).toBeNull();
		const resumed = resumeClock(paused, 'white', 1000000);
		expect(resumed.runningColor).toBe('white');
		expect(resumed.turnStartedAtMs).toBe(1000000);
	});

	test('correspondence has exactly 24 hours each move and survives reconnect without a reset', () => {
		const correspondence: ClockConfig = { kind: 'correspondence', perMoveSec: 86400 };
		const initial = createClock(correspondence, 'black', 0);
		expect(projectClock(correspondence, initial, 86400000).expiredColor).toBeNull();
		expect(projectClock(correspondence, initial, 86400001).expiredColor).toBe('black');
		const moved = consumeTurn(correspondence, initial, 'white', 1234);
		expect(projectClock(correspondence, moved, 1234).remainingTurnMs).toBe(86400000);
		expect(projectClock(correspondence, moved, 1235).deadlineAtMs).toBe(86401234);
		expect(() => consumeTurn(correspondence, initial, 'white', 86400001)).toThrow('Clock expired');
	});

	test('invalid configurations and server timestamps are rejected', () => {
		expect(() => validateClock({ kind: 'byoyomi', mainSec: -1, periodSec: 30, periods: 3 })).toThrow(RangeError);
		expect(() => validateClock({ kind: 'byoyomi', mainSec: 0, periodSec: 0, periods: 3 })).toThrow(RangeError);
		expect(() => projectClock(config, createClock(config, 'black', 0), NaN)).toThrow(RangeError);
	});
});
