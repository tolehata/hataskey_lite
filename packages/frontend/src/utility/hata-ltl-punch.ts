/*
 * SPDX-FileCopyrightText: hataskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export interface LtlPunchState {
	id: string;
	revision: number;
	startedAt: number;
	fallAt: number;
	endsAt: number;
	finishedAt: number | null;
	status: 'active' | 'won' | 'escaped';
	hp: number;
	maxHp: number;
	people: number;
	serverNow: number;
}

export const LTL_PUNCH = Object.freeze({ charge: 1200, failure: 5000, result: 4000, guard: 380, freshVictory: 1200 });
export type LtlPunchPhase = 'idle' | 'charging' | 'warning' | 'falling' | 'won' | 'escaped';

export function acceptPunchState(previous: LtlPunchState | null, incoming: LtlPunchState): boolean {
	if (!Number.isFinite(incoming.startedAt) || !Number.isFinite(incoming.serverNow) || incoming.maxHp <= 0) return false;
	if (!previous) return true;
	if (previous.id !== incoming.id) return incoming.startedAt > previous.startedAt;
	return incoming.revision > previous.revision || (incoming.revision === previous.revision && incoming.serverNow > previous.serverNow);
}

export function punchPhase(state: LtlPunchState | null, now: number): LtlPunchPhase {
	if (!state) return 'idle';
	if (state.status !== 'active') {
		const end = (state.finishedAt ?? state.endsAt) + (state.status === 'won' ? LTL_PUNCH.result : LTL_PUNCH.failure);
		return now < end ? state.status : 'idle';
	}
	if (now < state.startedAt + LTL_PUNCH.charge) return 'charging';
	if (now < state.fallAt) return 'warning';
	// A client reaching endsAt must wait for the authoritative server result.
	return 'falling';
}

export function punchHP(state: LtlPunchState, phase: LtlPunchPhase, now: number): number {
	if (phase !== 'charging') return Math.max(0, Math.min(state.maxHp, Math.ceil(state.hp)));
	const t = Math.max(0, Math.min(1, (now - state.startedAt) / LTL_PUNCH.charge));
	return Math.ceil(state.maxHp * t * t * (3 - 2 * t));
}

export function punchPosition(height: number, size: number, progress: number, preparation: boolean, reduced: boolean): { top: number; tip: number } {
	const p = Math.max(0, Math.min(1, progress));
	const tip = preparation ? -40 : reduced ? height * .42 : p <= .025 ? -40 + 88 * p / .025 : 48 + (height - 48) * (p - .025) / .975;
	return { tip, top: tip - size };
}

export function punchDamage(top: number, height: number, tip: number): number {
	return tip < top ? 0 : tip < top + height * .4 ? 1 : tip < top + height ? 2 : 3;
}
