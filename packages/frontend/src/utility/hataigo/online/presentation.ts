/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Color } from '../rules/board.js';
import type { OnlineClockConfig, OnlineGame, OnlineUser } from './types.js';

export const FIXED_REACTIONS = ['👏', '😮', '🤔', '😂', '🔥', '🙏'] as const;
export type FixedReaction = typeof FIXED_REACTIONS[number];

export function clockPreset(name: string): OnlineClockConfig {
	if (name === 'correspondence') return { kind: 'correspondence', perMoveSec: 86400 };
	return name === 'fast' ? { kind: 'byoyomi', mainSec: 300, periodSec: 30, periods: 3 } : { kind: 'byoyomi', mainSec: 1200, periodSec: 30, periods: 5 };
}

export function presetName(config: OnlineClockConfig): 'fast' | 'standard' | 'correspondence' {
	return config.kind === 'correspondence' ? 'correspondence' : config.mainSec === 300 ? 'fast' : 'standard';
}

export function participantSlot(game: OnlineGame, viewerId: string): 'user1' | 'user2' | null {
	if (!game.isParticipant) return null;
	return game.user1Id === viewerId ? 'user1' : game.user2Id === viewerId ? 'user2' : null;
}

export function ownColor(game: OnlineGame, viewerId: string): Color | null {
	const slot = participantSlot(game, viewerId);
	if (slot === null || game.black === null) return null;
	return (slot === 'user1' && game.black === 1) || (slot === 'user2' && game.black === 2) ? 'black' : 'white';
}

export function player(game: OnlineGame, color: Color): OnlineUser | null {
	if (game.black === null) return null;
	return color === 'black' ? game.black === 1 ? game.user1 : game.user2 : game.black === 1 ? game.user2 : game.user1;
}

export function formatClock(milliseconds: number): string {
	const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
	const sec = String(seconds % 60).padStart(2, '0');
	const min = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
	return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${min}:${sec}` : `${Math.floor(seconds / 60)}:${sec}`;
}

/** Display projection only: never dispatches a timeout or changes game state.
 * DTO clock counters have ALREADY been projected at serverNowMs. Advancing
 * from turnStartedAtMs would debit the same elapsed time twice.
 */
export function clockView(game: OnlineGame, color: Color, estimatedServerNowMs: number): { label: string; periods: number; overtime: boolean; expired: boolean } | null {
	const projection = game.clock;
	if (projection === null) return null;
	const source = projection.state[color];
	const running = projection.state.runningColor === color;
	const elapsed = running ? Math.max(0, estimatedServerNowMs - game.serverNowMs) : 0;
	const expired = projection.expiredColor === color || (running && projection.deadlineAtMs !== null && estimatedServerNowMs > projection.deadlineAtMs);
	const config = game.settings.clock;
	if (config.kind === 'correspondence') {
		const remaining = running && projection.deadlineAtMs !== null ? projection.deadlineAtMs - estimatedServerNowMs : source.mainRemainingMs;
		return { label: formatClock(expired ? 0 : remaining), periods: 0, overtime: false, expired };
	}
	const main = Math.max(0, source.mainRemainingMs - elapsed);
	if (main > 0) return { label: formatClock(main), periods: source.periodsRemaining, overtime: false, expired };
	const period = config.periodSec * 1000;
	const first = source.mainRemainingMs > 0 || !running ? period : projection.remainingTurnMs ?? period;
	const overtime = Math.max(0, elapsed - source.mainRemainingMs);
	const beyondFirst = Math.max(0, overtime - first);
	const lost = overtime > first ? Math.ceil(beyondFirst / period) : 0;
	const remaining = overtime <= first ? first - overtime : beyondFirst % period === 0 ? 0 : period - beyondFirst % period;
	return { label: formatClock(expired ? 0 : remaining), periods: Math.max(0, source.periodsRemaining - lost), overtime: true, expired };
}
