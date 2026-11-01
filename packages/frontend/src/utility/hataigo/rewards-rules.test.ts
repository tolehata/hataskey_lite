/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from 'vitest';
import { aiStats, COUNT_AI_WINS, eligibleThemes, parseHumanStats, playedGames } from './rewards-rules.js';
import type { AiRecord } from './ai-records.js';
import type { HumanStats } from './rewards-rules.js';

const zero: HumanStats = { wins: 0, losses: 0, draws: 0, streak: 0, wins9: 0, wins19: 0, distinctOpponents: 0 };

function record(id: string, patch: Partial<AiRecord> = {}): AiRecord { return { id, size: 9, ownColor: 'black', winner: 'black', reason: 'score', endedAt: '2026-10-20T00:00:00.000Z', ...patch }; }

describe('fixed cosmetic reward conditions', () => {
	it('unlocks each human win threshold exactly', () => {
		expect(eligibleThemes(zero, null)).toEqual(['fuji']);
		expect(eligibleThemes({ ...zero, wins: 9, losses: 20, wins9: 9, distinctOpponents: 4 }, null)).toEqual(['fuji', 'kaya']);
		expect(eligibleThemes({ ...zero, wins: 11, losses: 19, wins9: 10, wins19: 1, distinctOpponents: 5 }, null)).toEqual(['fuji', 'kaya', 'seiji', 'sakura', 'sumi', 'yoru']);
	});

	it('counts AI wins by the approved default while keeping distinct opponents human-only', () => {
		const ai = aiStats(Array.from({ length: 10 }, (_, i) => record(String(i))));
		expect(eligibleThemes(zero, ai, true)).toEqual(['fuji', 'kaya', 'seiji']);
		expect(eligibleThemes(zero, ai, false)).toEqual(['fuji']);
		expect(COUNT_AI_WINS).toBe(true);
		expect(eligibleThemes(zero, ai)).toEqual(['fuji', 'kaya', 'seiji']);
		expect(eligibleThemes(zero, aiStats([record('nineteen', { size: 19 })]))).toEqual(['fuji', 'kaya', 'sumi']);
		expect(eligibleThemes({ ...zero, wins: 1, wins19: 1 }, ai, false)).toEqual(['fuji', 'kaya', 'sumi']);
	});

	it('AI results are unique per game and draws/losses reset the current streak', () => {
		const win = record('a');
		expect(aiStats([win, win, record('b', { winner: 'draw' }), record('c', { winner: 'white' }), record('d', { size: 19 })])).toEqual({ wins: 2, losses: 1, draws: 1, streak: 1, wins9: 1, wins19: 1 });
	});

	it('night unlocks after 30 finished games with people or AI, whatever the result', () => {
		const ai = aiStats([record('w'), record('l', { winner: 'white' }), record('d', { winner: 'draw' })]);
		expect(playedGames({ ...zero, wins: 10, losses: 15, draws: 1, distinctOpponents: 3 }, ai)).toBe(29);
		expect(eligibleThemes({ ...zero, wins: 10, losses: 15, draws: 1, distinctOpponents: 3 }, ai)).not.toContain('yoru');
		expect(eligibleThemes({ ...zero, wins: 10, losses: 16, draws: 1, distinctOpponents: 3 }, ai)).toContain('yoru');
		expect(eligibleThemes(null, aiStats(Array.from({ length: 30 }, (_, i) => record(String(i), { winner: 'white' }))))).toContain('yoru');
	});

	it('rejects malformed or inconsistent human statistics instead of showing fake zeros', () => {
		expect(parseHumanStats(zero)).toEqual(zero);
		expect(() => parseHumanStats({ ...zero, wins: -1 })).toThrow();
		expect(() => parseHumanStats({ ...zero, distinctOpponents: 5 })).toThrow();
		expect(() => parseHumanStats(null)).toThrow();
	});
});
