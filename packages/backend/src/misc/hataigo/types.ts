/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { BoardSize, Point } from './rules/board.js';
import type { GameAction } from './rules/game.js';
import type { ScoringMarks } from './rules/score.js';
import type { ClockConfig } from './clock.js';

export interface HataigoSettings { size: BoardSize; handicap: 0 | 2 | 3 | 4 | 9; komi: number; rules: 'japanese'; clock: ClockConfig }
export interface HataigoVisibilityVote { allowSpectate: boolean; allowSpectatorChat: boolean; publicAfterEnd: boolean }
export interface HataigoVisibility { user1: HataigoVisibilityVote; user2: HataigoVisibilityVote }
export interface HataigoPersonalStats { wins: number; losses: number; draws: number; streak: number; wins9: number; wins19: number; distinctOpponents: number }
export type HataigoPhase = 'waiting' | 'playing' | 'scoring' | 'ended';
export type HataigoClientAction = { type: 'play'; point: Point } | { type: 'setScoring'; marks: ScoringMarks } | { type: 'pass' | 'resign' | 'acceptScore' | 'requestResume' | 'acceptNoResult' };
export type StoredHataigoAction = GameAction;
/** anySize: 路数を問わずに組む（size は第一希望。組んだあとも二人で変えられる） */
export interface HataigoMatchOptions extends Partial<HataigoVisibilityVote> { size: BoardSize; clockKind: ClockConfig['kind']; anySize?: boolean }
export interface HataigoAnnouncement { enabled: boolean; visibility: 'home' | 'followers' | 'public'; allowName: boolean }
export interface HataigoAnnouncementState { status: 'none' | 'pending' | 'sent' | 'cancelled'; text: string | null; noteId: string | null; attempts: number; nextAttemptAtMs: number; lastError: string | null }
export interface HataigoAnnouncements { user1: HataigoAnnouncement; user2: HataigoAnnouncement }
export interface HataigoAnnouncementStates { user1: HataigoAnnouncementState; user2: HataigoAnnouncementState }
export interface HataigoSettingsPatch extends Partial<HataigoSettings>, Partial<HataigoVisibilityVote> { announcement?: Partial<HataigoAnnouncement> }

export function announcementVote(value: Partial<HataigoAnnouncement> = {}): HataigoAnnouncement {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
	if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['enabled', 'visibility', 'allowName'].includes(key))) throw new HataigoError('INVALID_SETTINGS');
	if ((value.enabled !== undefined && typeof value.enabled !== 'boolean') || (value.allowName !== undefined && typeof value.allowName !== 'boolean') || (value.visibility !== undefined && !['home', 'followers', 'public'].includes(value.visibility))) throw new HataigoError('INVALID_SETTINGS');
	return { enabled: value.enabled ?? false, visibility: value.visibility ?? 'home', allowName: value.allowName ?? false };
}

export function emptyAnnouncementState(): HataigoAnnouncementState {
	return { status: 'none', text: null, noteId: null, attempts: 0, nextAttemptAtMs: 0, lastError: null };
}

export class HataigoError extends Error {
	constructor(readonly code: 'CHAT_DISABLED' | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_STATE' | 'INVALID_SETTINGS' | 'INVALID_ACTION' | 'STALE_REVISION' | 'RATE_LIMIT' | 'MATCH_BUSY' | 'BLOCKED' | 'NOT_FOLLOWING' | 'NOT_LOCAL' | 'LIMIT', message: string = code, readonly limitUserId?: string) { super(message); this.name = 'HataigoError'; }
}

export function defaultSettings(size: BoardSize = 19, kind: ClockConfig['kind'] = 'byoyomi'): HataigoSettings {
	return { size, handicap: 0, komi: 6.5, rules: 'japanese', clock: kind === 'correspondence' ? { kind, perMoveSec: 86400 } : { kind, mainSec: 1200, periodSec: 30, periods: 5 } };
}

export function normalizeSettings(value: HataigoSettings): HataigoSettings {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
	if (![9, 13, 19].includes(value.size) || ![0, 2, 3, 4, 9].includes(value.handicap) || ![0, 0.5, 6.5, 7.5].includes(value.komi) || value.rules !== 'japanese') throw new HataigoError('INVALID_SETTINGS');
	const clock = value.clock;
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
	if (!clock || (clock.kind === 'correspondence' ? clock.perMoveSec !== 86400 : clock.kind !== 'byoyomi' || !((clock.mainSec === 300 && clock.periodSec === 30 && clock.periods === 3) || (clock.mainSec === 1200 && clock.periodSec === 30 && clock.periods === 5)))) throw new HataigoError('INVALID_SETTINGS');
	return { size: value.size, handicap: value.handicap, komi: value.handicap === 0 ? value.komi : 0, rules: 'japanese', clock: clock.kind === 'correspondence' ? { kind: 'correspondence', perMoveSec: 86400 } : { kind: 'byoyomi', mainSec: clock.mainSec, periodSec: clock.periodSec, periods: clock.periods } };
}

export function visibilityVote(value: Partial<HataigoVisibilityVote> = {}): HataigoVisibilityVote {
	for (const key of ['allowSpectate', 'allowSpectatorChat', 'publicAfterEnd'] as const) if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new HataigoError('INVALID_SETTINGS');
	return { allowSpectate: value.allowSpectate ?? false, allowSpectatorChat: value.allowSpectatorChat ?? false, publicAfterEnd: value.publicAfterEnd ?? false };
}
