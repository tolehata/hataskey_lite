/* SPDX-FileCopyrightText: hataskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it } from 'vitest';
import { acceptPunchState, LTL_PUNCH, punchDamage, punchHP, punchPhase, punchPosition } from './hata-ltl-punch.js';
import type { LtlPunchState } from './hata-ltl-punch.js';

const state: LtlPunchState = { id: 'one', revision: 1, startedAt: 10000, fallAt: 13200, endsAt: 49200, finishedAt: null, status: 'active', hp: 240, maxHp: 240, people: 8, serverNow: 10000 };
describe('LTL punch authoritative presentation', () => {
	it('charges, waits two seconds, and never invents a timeout result', () => {
		expect(punchPhase(state, 10000)).toBe('charging');
		expect(punchHP(state, 'charging', 10000)).toBe(0);
		expect(punchHP(state, 'charging', 10600)).toBe(120);
		expect(punchPhase(state, 11200)).toBe('warning');
		expect(punchHP(state, 'warning', 11200)).toBe(240);
		expect(punchPhase(state, 13199)).toBe('warning');
		expect(punchPhase(state, 13200)).toBe('falling');
		expect(punchPhase(state, 999999)).toBe('falling');
	});
	it('shows server result only until its original deadline, including late joins', () => {
		const escaped = { ...state, status: 'escaped' as const, finishedAt: 49200 };
		expect(punchPhase(escaped, 49200 + LTL_PUNCH.failure - 1)).toBe('escaped');
		expect(punchPhase(escaped, 49200 + LTL_PUNCH.failure)).toBe('idle');
		const won = { ...state, status: 'won' as const, finishedAt: 20000, hp: 0 };
		expect(punchPhase(won, 24000)).toBe('idle');
	});
	it('rejects delayed snapshots and older event ids while permitting fresher sync timestamps', () => {
		expect(acceptPunchState(state, { ...state, revision: 0, serverNow: 12000 })).toBe(false);
		expect(acceptPunchState(state, { ...state, id: 'older', startedAt: 9000, revision: 10 })).toBe(false);
		expect(acceptPunchState(state, { ...state, serverNow: 11000 })).toBe(true);
		expect(acceptPunchState(state, { ...state, id: 'new', startedAt: 20000 })).toBe(true);
	});
	it('keeps preparation outside the clip and enters promptly without a jump', () => {
		const warning = punchPosition(560, 720, 0, true, false);
		const first = punchPosition(560, 720, 0, false, false);
		expect(warning.top + 720).toBeLessThan(0);
		expect(first).toEqual(warning);
		expect(punchPosition(560, 720, .025, false, false).tip).toBe(48);
		expect(punchPosition(560, 720, 1, false, false).tip).toBe(560);
		expect(punchPosition(560, 720, .2, false, true)).toEqual(punchPosition(560, 720, .8, false, true));
	});
	it('damages a card by its original geometry', () => {
		expect([99, 100, 140, 200].map(tip => punchDamage(100, 100, tip))).toEqual([0, 1, 2, 3]);
	});
});
