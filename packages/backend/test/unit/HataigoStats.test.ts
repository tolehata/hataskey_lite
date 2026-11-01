/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { calculatePersonalStats } from '@/misc/hataigo/stats.js';
import type { HataigoStatsGame } from '@/misc/hataigo/stats.js';
import { defaultSettings } from '@/misc/hataigo/types.js';

function ended(id: string, patch: Partial<HataigoStatsGame> = {}): HataigoStatsGame {
	return { id, phase: 'ended', startedAt: new Date(0), endedAt: new Date(Number(id)), user1Id: 'me', user2Id: 'opponent', black: 1, settings: defaultSettings(9), result: { reason: 'resign', winner: 'black' }, ...patch };
}

describe('private human-game statistics', () => {
	test('counts score, resignation and timeout wins across colors and deduplicates only defeated opponents', () => {
		const games = [
			ended('1'), ended('2', { black: 2, result: { reason: 'timeout', winner: 'white' } }),
			ended('3', { user1Id: 'second', user2Id: 'me', black: 2, settings: defaultSettings(19), result: { reason: 'score', winner: 'black' } }),
			ended('4', { user2Id: 'unbeaten', result: { reason: 'score', winner: 'white' } }),
		];
		expect(calculatePersonalStats('me', games)).toEqual({ wins: 3, losses: 1, draws: 0, streak: 0, wins9: 2, wins19: 1, distinctOpponents: 2 });
	});

	test('draws interrupt current wins; no-result and cancellations do not count or interrupt', () => {
		const games = [ended('1'), ended('2', { result: { reason: 'score', winner: 'draw' } }), ended('3'), ended('4', { result: { reason: 'noResult', winner: null } }), ended('5', { startedAt: null, black: null, result: null }), ended('6')];
		expect(calculatePersonalStats('me', games)).toEqual({ wins: 3, losses: 0, draws: 1, streak: 2, wins9: 3, wins19: 0, distinctOpponents: 1 });
	});

	test('sorts a copy by end time and ID; finished history is never truncated at 100 rows', () => {
		const games = Array.from({ length: 125 }, (_, index) => ended(String(index + 1), { endedAt: new Date(index), settings: defaultSettings(13) })).reverse();
		const before = games.map(game => game.id);
		expect(calculatePersonalStats('me', games)).toMatchObject({ wins: 125, streak: 125, wins9: 0, wins19: 0 });
		expect(games.map(game => game.id)).toEqual(before);
		const tied = [ended('1', { endedAt: new Date(1) }), ended('2', { endedAt: new Date(1), result: { reason: 'timeout', winner: 'white' } })];
		expect(calculatePersonalStats('me', tied).streak).toBe(0);
	});

	test('ignores unrelated, unfinished and unstarted records and exposes only numeric counters', () => {
		const games = [ended('1', { user1Id: 'other' }), ended('2', { phase: 'playing' }), ended('3', { startedAt: null }), ended('4', { endedAt: null }), ended('5', { result: null })];
		const stats = calculatePersonalStats('me', games);
		expect(stats).toEqual({ wins: 0, losses: 0, draws: 0, streak: 0, wins9: 0, wins19: 0, distinctOpponents: 0 });
		expect(Object.values(stats).every(value => typeof value === 'number')).toBe(true);
	});
});
