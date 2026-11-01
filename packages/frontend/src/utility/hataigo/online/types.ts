/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { BoardSize, Color, Point } from '../rules/board.js';
import type { GameState } from '../rules/game.js';
import type { ScoringMarks } from '../rules/score.js';

export type OnlineClockConfig = { kind: 'byoyomi'; mainSec: number; periodSec: number; periods: number } | { kind: 'correspondence'; perMoveSec: 86400 };
export type VisibilityVote = { allowSpectate: boolean; allowSpectatorChat: boolean; publicAfterEnd: boolean };
export type OnlineSettings = { size: BoardSize; handicap: 0 | 2 | 3 | 4 | 9; komi: number; rules: 'japanese'; clock: OnlineClockConfig };
export type Announcement = { enabled: boolean; visibility: 'home' | 'followers' | 'public'; allowName: boolean };
export type OnlineSettingsPatch = Partial<OnlineSettings> & Partial<VisibilityVote> & { announcement?: Partial<Announcement> };
export type OnlineAction = { type: 'play'; point: Point } | { type: 'setScoring'; marks: ScoringMarks } | { type: 'pass' | 'resign' | 'acceptScore' | 'requestResume' | 'acceptNoResult' };
export type OnlineUser = { id: string; username: string; name: string | null; avatarUrl: string | null };
export type OnlinePhase = 'waiting' | 'playing' | 'scoring' | 'ended';
export type OnlineClock = {
	state: { black: { mainRemainingMs: number; periodsRemaining: number }; white: { mainRemainingMs: number; periodsRemaining: number }; runningColor: Color | null; turnStartedAtMs: number | null };
	expiredColor: Color | null; remainingTurnMs: number | null; deadlineAtMs: number | null;
};
export type OnlineGame = {
	id: string; createdAt: string; startedAt: string | null; endedAt: string | null;
	user1Id: string | null; user2Id: string | null; user1: OnlineUser | null; user2: OnlineUser | null;
	black: 1 | 2 | null; phase: OnlinePhase; settings: OnlineSettings;
	user1Ready: boolean; user2Ready: boolean; isInvitation: boolean; invitationAccepted: boolean;
	revision: number; allowSpectate: boolean; allowSpectatorChat: boolean; publicAfterEnd: boolean;
	visibility: { user1: VisibilityVote; user2: VisibilityVote } | null;
	announcements: { user1: Announcement; user2: Announcement } | null;
	announcementState?: { user1: { status: 'none' | 'pending' | 'sent' | 'cancelled' }; user2: { status: 'none' | 'pending' | 'sent' | 'cancelled' } } | null;
	state: GameState | null; clock: OnlineClock | null; serverNowMs: number;
	myColor: Color | null; isParticipant: boolean;
};
/** anySize: ほかの路数で待っている人とも組む（size は第一希望） */
export type MatchOptions = VisibilityVote & { size: BoardSize; clockKind: OnlineClockConfig['kind']; anySize?: boolean };
export type OnlineApi = {
	show(gameId: string): Promise<OnlineGame>;
	games(params: { my: boolean; ongoing?: boolean; ended?: boolean; limit: number; untilId?: string }): Promise<OnlineGame[]>;
	invitations(): Promise<OnlineGame[]>;
	match(options: MatchOptions): Promise<OnlineGame | null>;
	invite(userId: string, options: MatchOptions): Promise<OnlineGame>;
	cancelMatch(): Promise<void>;
	respond(gameId: string, accept: boolean, revision: number): Promise<OnlineGame>;
	settings(gameId: string, patch: OnlineSettingsPatch, revision: number): Promise<OnlineGame>;
	ready(gameId: string, ready: boolean, revision: number): Promise<OnlineGame>;
	action(gameId: string, action: OnlineAction, revision: number): Promise<void>;
	cancelGame(gameId: string, revision: number): Promise<OnlineGame>;
	verify(gameId: string, revision: number): Promise<{ desynced: boolean; game?: OnlineGame }>;
	claimTimeout(gameId: string, revision: number): Promise<OnlineGame>;
};

function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function color(value: unknown): value is Color { return value === 'black' || value === 'white'; }

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

function nullableString(value: unknown): boolean { return value === null || typeof value === 'string'; }

function point(value: unknown, size: number): boolean { return object(value) && Number.isInteger(value.x) && Number.isInteger(value.y) && Number(value.x) >= 0 && Number(value.y) >= 0 && Number(value.x) < size && Number(value.y) < size; }

function pointList(value: unknown, size: number): boolean { return Array.isArray(value) && value.length <= size * size && value.every(item => point(item, size)); }

function board(value: unknown, size: number): boolean { return object(value) && value.size === size && typeof value.hash === 'string' && Array.isArray(value.cells) && value.cells.length === size * size && value.cells.every(stone => stone === null || color(stone)); }

function vote(value: unknown): boolean { return object(value) && ['allowSpectate', 'allowSpectatorChat', 'publicAfterEnd'].every(key => typeof value[key] === 'boolean'); }

/** Validate the fields consumed by the client before exposing a server DTO.
 * Extra server fields are retained for compatible schema evolution.
 */
export function parseOnlineGame(value: unknown): OnlineGame {
	const invalid = (): never => { throw new Error('INVALID_RESPONSE'); };
	if (!object(value) || typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 100 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) return invalid();
	if (!['waiting', 'playing', 'scoring', 'ended'].includes(String(value.phase)) || !object(value.settings) || !finite(value.settings.size) || ![9, 13, 19].includes(value.settings.size)) return invalid();
	const size = Number(value.settings.size);
	const settings = value.settings;
	if (!finite(settings.handicap) || ![0, 2, 3, 4, 9].includes(settings.handicap) || !finite(settings.komi) || ![0, 0.5, 6.5, 7.5].includes(settings.komi) || settings.rules !== 'japanese' || !object(settings.clock)) return invalid();
	if (settings.clock.kind === 'correspondence' ? settings.clock.perMoveSec !== 86400 : settings.clock.kind !== 'byoyomi' || !((settings.clock.mainSec === 300 && settings.clock.periodSec === 30 && settings.clock.periods === 3) || (settings.clock.mainSec === 1200 && settings.clock.periodSec === 30 && settings.clock.periods === 5))) return invalid();
	if (!nullableString(value.user1Id) || !nullableString(value.user2Id) || !nullableString(value.startedAt) || !nullableString(value.endedAt) || typeof value.createdAt !== 'string') return invalid();
	if (value.black !== null && value.black !== 1 && value.black !== 2) return invalid();
	if (!['user1Ready', 'user2Ready', 'isInvitation', 'invitationAccepted', 'allowSpectate', 'allowSpectatorChat', 'publicAfterEnd', 'isParticipant'].every(key => typeof value[key] === 'boolean')) return invalid();
	if (value.myColor !== null && !color(value.myColor)) return invalid();
	if (!finite(value.serverNowMs)) return invalid();
	for (const key of ['user1', 'user2']) {
		const user = value[key];
		if (user !== null && (!object(user) || typeof user.id !== 'string' || typeof user.username !== 'string' || !nullableString(user.name) || !nullableString(user.avatarUrl))) return invalid();
	}
	if (value.visibility !== null && (!object(value.visibility) || !vote(value.visibility.user1) || !vote(value.visibility.user2))) return invalid();
	if (value.announcements !== null) {
		if (!object(value.announcements)) return invalid();
		for (const key of ['user1', 'user2']) {
			const announcement = value.announcements[key];
			if (!object(announcement) || typeof announcement.enabled !== 'boolean' || typeof announcement.allowName !== 'boolean' || !['home', 'followers', 'public'].includes(String(announcement.visibility))) return invalid();
		}
	}
	if (value.announcementState !== undefined && value.announcementState !== null) {
		if (!object(value.announcementState)) return invalid();
		for (const key of ['user1', 'user2']) {
			const status = value.announcementState[key];
			if (!object(status) || !['none', 'pending', 'sent', 'cancelled'].includes(String(status.status))) return invalid();
		}
	}
	if (value.state !== null) {
		const state = value.state;
		if (!object(state) || !board(state.board, size) || !color(state.toPlay) || !['playing', 'scoring', 'finished'].includes(String(state.phase)) || !object(state.prisoners) || !finite(state.komi)) return invalid();
		const prisoners = state.prisoners;
		if (!['black', 'white'].every(key => Number.isSafeInteger(prisoners[key]) && Number(prisoners[key]) >= 0)) return invalid();
		if (state.previousBoard !== null && !board(state.previousBoard, size)) return invalid();
		if (!Array.isArray(state.moves) || !state.moves.every(move => object(move) && color(move.color) && (move.point === null || point(move.point, size)))) return invalid();
		if (!object(state.scoring) || !pointList(state.scoring.deadStones, size) || !pointList(state.scoring.neutralPoints, size) || !Array.isArray(state.scoring.acceptedBy) || !state.scoring.acceptedBy.every(color)) return invalid();
		if (!Array.isArray(state.noResultAcceptedBy) || !state.noResultAcceptedBy.every(color)) return invalid();
		if (state.result !== null && (!object(state.result) || !['score', 'resign', 'timeout', 'noResult'].includes(String(state.result.reason)) || !(state.result.winner === null || state.result.winner === 'draw' || color(state.result.winner)))) return invalid();
	} else if (value.phase === 'playing' || value.phase === 'scoring') return invalid();
	if (value.clock !== null) {
		if (!object(value.clock) || !object(value.clock.state)) return invalid();
		for (const key of ['black', 'white']) {
			const clock = value.clock.state[key];
			if (!object(clock) || !finite(clock.mainRemainingMs) || clock.mainRemainingMs < 0 || !Number.isSafeInteger(clock.periodsRemaining) || Number(clock.periodsRemaining) < 0) return invalid();
		}
		if (value.clock.state.runningColor !== null && !color(value.clock.state.runningColor)) return invalid();
		if (value.clock.remainingTurnMs !== null && !finite(value.clock.remainingTurnMs)) return invalid();
		if (value.clock.deadlineAtMs !== null && !finite(value.clock.deadlineAtMs)) return invalid();
	}
	return value as unknown as OnlineGame;
}

export function parseOnlineGames(value: unknown): OnlineGame[] {
	if (!Array.isArray(value)) throw new Error('INVALID_RESPONSE');
	return value.map(parseOnlineGame);
}

export function onlineErrorCode(error: unknown): string {
	if (typeof error === 'string') return error.replace(/^HATAIGO_/, '');
	if (object(error)) {
		if (object(error.info) && typeof error.info.reason === 'string') return error.info.reason;
		if (typeof error.code === 'string') return error.code.replace(/^HATAIGO_/, '');
	}
	return error instanceof Error ? error.message.replace(/^HATAIGO_/, '') : 'NETWORK';
}
