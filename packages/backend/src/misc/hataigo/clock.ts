/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Color } from './rules/board.js';

export type ClockConfig = { kind: 'byoyomi'; mainSec: number; periodSec: number; periods: number } | { kind: 'correspondence'; perMoveSec: 86400 };
export interface PlayerClock { mainRemainingMs: number; periodsRemaining: number }
export interface ClockState { black: PlayerClock; white: PlayerClock; runningColor: Color | null; turnStartedAtMs: number | null }
export interface ClockProjection { state: ClockState; expiredColor: Color | null; remainingTurnMs: number | null; deadlineAtMs: number | null }

export function validateClock(config: ClockConfig): void {
	if (config.kind === 'correspondence') {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Stored/runtime clock values must be checked even when TypeScript declares the allowed literal.
		if (config.perMoveSec !== 86400) throw new RangeError('Correspondence requires 24 hours per move');
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Reject unknown clock kinds arriving from runtime data rather than trust the nominal union.
	} else if (config.kind !== 'byoyomi' || !Number.isSafeInteger(config.mainSec) || config.mainSec < 0 || config.mainSec > 86400 || !Number.isSafeInteger(config.periodSec) || config.periodSec < 1 || config.periodSec > 600 || !Number.isSafeInteger(config.periods) || config.periods < 1 || config.periods > 10) {
		throw new RangeError('Invalid clock configuration');
	}
}

export function createClock(config: ClockConfig, color: Color, now: number): ClockState {
	validateClock(config);
	const initial = { mainRemainingMs: config.kind === 'byoyomi' ? config.mainSec * 1000 : 86400000, periodsRemaining: config.kind === 'byoyomi' ? config.periods : 0 };
	return { black: { ...initial }, white: { ...initial }, runningColor: color, turnStartedAtMs: now };
}

/** A move received exactly at the deadline is legal; expiration starts one millisecond later. */
export function projectClock(config: ClockConfig, clock: ClockState, now: number): ClockProjection {
	validateClock(config);
	if (!Number.isFinite(now)) throw new RangeError('Invalid server time');
	const state: ClockState = { black: { ...clock.black }, white: { ...clock.white }, runningColor: clock.runningColor, turnStartedAtMs: clock.turnStartedAtMs };
	const color = state.runningColor;
	if (color === null || state.turnStartedAtMs === null) return { state, expiredColor: null, remainingTurnMs: null, deadlineAtMs: null };
	const elapsed = Math.max(0, now - state.turnStartedAtMs);
	const source = clock[color];
	if (config.kind === 'correspondence') {
		const deadlineAtMs = state.turnStartedAtMs + config.perMoveSec * 1000;
		state[color].mainRemainingMs = Math.max(0, deadlineAtMs - now);
		return { state, expiredColor: now > deadlineAtMs ? color : null, remainingTurnMs: state[color].mainRemainingMs, deadlineAtMs };
	}
	const periodMs = config.periodSec * 1000;
	const overtime = Math.max(0, elapsed - source.mainRemainingMs);
	const lostPeriods = Math.max(0, Math.ceil(overtime / periodMs) - 1);
	state[color].mainRemainingMs = Math.max(0, source.mainRemainingMs - elapsed);
	state[color].periodsRemaining = Math.max(0, source.periodsRemaining - lostPeriods);
	const deadlineAtMs = state.turnStartedAtMs + source.mainRemainingMs + source.periodsRemaining * periodMs;
	const remainingTurnMs = state[color].mainRemainingMs > 0 ? state[color].mainRemainingMs : overtime === 0 ? periodMs : overtime % periodMs === 0 ? 0 : periodMs - overtime % periodMs;
	return { state, expiredColor: now > deadlineAtMs ? color : null, remainingTurnMs, deadlineAtMs };
}

export function consumeTurn(config: ClockConfig, clock: ClockState, next: Color | null, now: number): ClockState {
	const projected = projectClock(config, clock, now);
	if (projected.expiredColor !== null) throw new RangeError('Clock expired');
	if (config.kind === 'correspondence' && clock.runningColor !== null) projected.state[clock.runningColor].mainRemainingMs = 86400000;
	return { ...projected.state, runningColor: next, turnStartedAtMs: next === null ? null : now };
}

export function resumeClock(clock: ClockState, next: Color, now: number): ClockState {
	return { black: { ...clock.black }, white: { ...clock.white }, runningColor: next, turnStartedAtMs: now };
}
