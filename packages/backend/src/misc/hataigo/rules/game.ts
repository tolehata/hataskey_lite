/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { boardKey, createBoard, oppositeColor, playMove } from './board.js';
import { getHandicapPoints } from './handicap.js';
import { scoreJapanese } from './score.js';
import type { Board, Color, Point } from './board.js';
import type { Prisoners, ScoreResult, ScoringMarks } from './score.js';

export type GamePhase = 'playing' | 'scoring' | 'finished';
export type FinishReason = 'score' | 'resign' | 'timeout' | 'noResult';
export interface GameResult {
	readonly reason: FinishReason;
	readonly winner: Color | 'draw' | null;
	readonly score?: ScoreResult;
}
export interface RepetitionNotice {
	readonly type: 'repetition';
	readonly key: string;
	readonly count: number;
}
export interface GameState {
	readonly board: Board;
	readonly toPlay: Color;
	readonly phase: GamePhase;
	readonly komi: number;
	readonly handicap: number;
	readonly prisoners: Prisoners;
	readonly previousBoard: Board | null;
	readonly consecutivePasses: number;
	readonly moves: readonly { readonly color: Color; readonly point: Point | null; readonly captured: readonly Point[] }[];
	readonly repetitionThreshold: number;
	readonly occurrences: Readonly<Record<string, number>>;
	readonly repetition: RepetitionNotice | null;
	readonly scoring: ScoringMarks & { readonly acceptedBy: readonly Color[]; readonly resumeRequestedBy: Color | null };
	readonly noResultAcceptedBy: readonly Color[];
	readonly result: GameResult | null;
}
export interface GameOptions {
	readonly size?: number;
	readonly komi?: number;
	readonly handicap?: number;
	readonly setup?: { black?: readonly Point[]; white?: readonly Point[] };
	readonly toPlay?: Color;
	readonly repetitionThreshold?: number;
}
export type GameAction =
	| { type: 'play'; color: Color; point: Point }
	| { type: 'pass'; color: Color }
	| { type: 'setScoring'; color: Color; marks: ScoringMarks }
	| { type: 'acceptScore'; color: Color }
	| { type: 'requestResume'; color: Color }
	| { type: 'acceptResume'; color: Color }
	| { type: 'resign'; color: Color }
	| { type: 'timeout'; color: Color }
	| { type: 'acceptNoResult'; color: Color };
export type GameActionResult =
	| { ok: true; state: GameState; captured: Point[]; repetition: RepetitionNotice | null }
	| { ok: false; reason: 'occupied' | 'suicide' | 'ko' | 'outOfBoard' | 'notYourTurn' | 'invalidState' | 'invalidScoring' };

function isColor(value: unknown): value is Color {
	return value === 'black' || value === 'white';
}

function positionKey(board: Board, toPlay: Color): string {
	return `${boardKey(board)}:${toPlay}`;
}

function emptyScoring(): GameState['scoring'] {
	return { deadStones: [], neutralPoints: [], acceptedBy: [], resumeRequestedBy: null };
}

export function createGame(options: GameOptions = {}): GameState {
	const handicap = options.handicap ?? 0;
	const size = options.size ?? 19;
	const repetitionThreshold = options.repetitionThreshold ?? 3;
	if (!Number.isSafeInteger(repetitionThreshold) || repetitionThreshold < 2) throw new RangeError('Invalid repetition threshold');
	if (handicap !== 0 && (!Number.isInteger(handicap) || handicap < 2 || handicap > 9)) throw new RangeError('Invalid handicap');
	if (handicap !== 0 && options.setup !== undefined) throw new RangeError('Handicap and custom setup cannot be combined');
	const toPlay = handicap !== 0 ? 'white' : options.toPlay ?? 'black';
	if (!isColor(toPlay)) throw new RangeError('Invalid turn');
	const komi = handicap !== 0 ? 0 : options.komi ?? 6.5;
	if (!Number.isFinite(komi)) throw new RangeError('Invalid komi');
	const board = createBoard(size, handicap === 0 ? options.setup : { black: getHandicapPoints(size, handicap) });
	return {
		board, toPlay, phase: 'playing', komi, handicap,
		prisoners: { black: 0, white: 0 }, previousBoard: null, consecutivePasses: 0, moves: [],
		repetitionThreshold, occurrences: { [positionKey(board, toPlay)]: 1 }, repetition: null,
		scoring: emptyScoring(), noResultAcceptedBy: [], result: null,
	};
}

function success(state: GameState, captured: Point[] = []): GameActionResult {
	return { ok: true, state, captured, repetition: state.repetition };
}

function recordTurn(state: GameState, board: Board, color: Color, point: Point | null, captured: Point[]): GameActionResult {
	const toPlay = oppositeColor(color);
	const key = positionKey(board, toPlay);
	const count = (state.occurrences[key] ?? 0) + 1;
	const consecutivePasses = point === null ? state.consecutivePasses + 1 : 0;
	return success({
		...state, board, toPlay,
		phase: consecutivePasses === 2 ? 'scoring' : 'playing',
		previousBoard: point === null ? null : state.board,
		consecutivePasses,
		prisoners: { ...state.prisoners, [color]: state.prisoners[color] + captured.length },
		moves: [...state.moves, { color, point: point === null ? null : { ...point }, captured: captured.map(stone => ({ ...stone })) }],
		occurrences: { ...state.occurrences, [key]: count },
		repetition: count >= state.repetitionThreshold ? { type: 'repetition', key, count } : null,
		scoring: emptyScoring(), noResultAcceptedBy: [],
	}, captured);
}

/** Immutable local rules. Callers must authenticate the player before passing their color. */
export function applyGameAction(state: GameState, action: GameAction): GameActionResult {
	if (state.phase === 'finished') return { ok: false, reason: 'invalidState' };
	if (!isColor(action.color)) return { ok: false, reason: 'notYourTurn' };
	switch (action.type) {
		case 'play': {
			if (state.phase !== 'playing') return { ok: false, reason: 'invalidState' };
			if (action.color !== state.toPlay) return { ok: false, reason: 'notYourTurn' };
			const move = playMove(state.board, action.color, action.point, state.previousBoard ?? undefined);
			if (!move.ok) return move;
			return recordTurn(state, move.board, action.color, action.point, move.captured);
		}
		case 'pass':
			if (state.phase !== 'playing') return { ok: false, reason: 'invalidState' };
			if (action.color !== state.toPlay) return { ok: false, reason: 'notYourTurn' };
			return recordTurn(state, state.board, action.color, null, []);
		case 'setScoring': {
			if (state.phase !== 'scoring') return { ok: false, reason: 'invalidState' };
			try {
				scoreJapanese(state.board, action.marks, state.prisoners, state.komi);
			} catch {
				return { ok: false, reason: 'invalidScoring' };
			}
			return success({ ...state, scoring: {
				deadStones: action.marks.deadStones.map(point => ({ ...point })),
				neutralPoints: action.marks.neutralPoints.map(point => ({ ...point })),
				acceptedBy: [], resumeRequestedBy: null,
			}, noResultAcceptedBy: [] });
		}
		case 'acceptScore': {
			if (state.phase !== 'scoring' || state.scoring.resumeRequestedBy !== null) return { ok: false, reason: 'invalidState' };
			const acceptedBy = [...new Set([...state.scoring.acceptedBy, action.color])];
			if (acceptedBy.length < 2) return success({ ...state, scoring: { ...state.scoring, acceptedBy } });
			const score = scoreJapanese(state.board, state.scoring, state.prisoners, state.komi);
			return success({ ...state, phase: 'finished', scoring: { ...state.scoring, acceptedBy }, result: { reason: 'score', winner: score.winner, score } });
		}
		case 'requestResume':
			if (state.phase !== 'scoring' || state.scoring.resumeRequestedBy !== null) return { ok: false, reason: 'invalidState' };
			return success({ ...state, scoring: { ...state.scoring, acceptedBy: [], resumeRequestedBy: action.color }, noResultAcceptedBy: [] });
		case 'acceptResume': {
			if (state.phase !== 'scoring' || state.scoring.resumeRequestedBy === null) return { ok: false, reason: 'invalidState' };
			if (state.scoring.resumeRequestedBy === action.color) return { ok: false, reason: 'notYourTurn' };
			// The opponent of the requesting player makes the first move after resumption.
			return success({
				...state, phase: 'playing', toPlay: action.color, consecutivePasses: 0, previousBoard: null,
				scoring: emptyScoring(), noResultAcceptedBy: [], repetition: null,
			});
		}
		case 'resign':
		case 'timeout':
			return success({ ...state, phase: 'finished', result: { reason: action.type, winner: oppositeColor(action.color) } });
		case 'acceptNoResult': {
			const acceptedBy = [...new Set([...state.noResultAcceptedBy, action.color])];
			return success({
				...state, noResultAcceptedBy: acceptedBy,
				phase: acceptedBy.length === 2 ? 'finished' : state.phase,
				result: acceptedBy.length === 2 ? { reason: 'noResult', winner: null } : null,
			});
		}
		default:
			return { ok: false, reason: 'invalidState' };
	}
}
