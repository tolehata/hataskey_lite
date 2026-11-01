/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiHataigoGame } from '@/models/HataigoGame.js';
import { oppositeColor } from './rules/board.js';
import { applyGameAction, createGame } from './rules/game.js';
import { HataigoError } from './types.js';
import type { Color } from './rules/board.js';
import type { GameAction, GameState } from './rules/game.js';
import type { HataigoClientAction, HataigoSettings, StoredHataigoAction } from './types.js';

export function rebuildHataigo(settings: HataigoSettings, actions: readonly StoredHataigoAction[]): GameState {
	let state = createGame({ size: settings.size, handicap: settings.handicap, komi: settings.komi });
	for (const action of actions) {
		const result = applyGameAction(state, action);
		if (!result.ok) throw new HataigoError('INVALID_STATE', 'Stored game action is inconsistent');
		state = result.state;
	}
	return state;
}

export function participantColor(game: Pick<MiHataigoGame, 'user1Id' | 'user2Id' | 'black'>, actor: string): Color {
	if (game.black === null || (actor !== game.user1Id && actor !== game.user2Id)) throw new HataigoError('FORBIDDEN');
	return (actor === game.user1Id ? 1 : 2) === game.black ? 'black' : 'white';
}

/** Runtime allowlist: a client never supplies a color, timeout, or the resume acknowledgement. */
export function authorizeAction(action: HataigoClientAction, color: Color): GameAction {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
	if (!action || typeof action !== 'object' || Array.isArray(action) || 'color' in action) throw new HataigoError('INVALID_ACTION');
	const allowedKeys = action.type === 'play' ? ['type', 'point'] : action.type === 'setScoring' ? ['type', 'marks'] : ['type'];
	if (Object.keys(action).some(key => !allowedKeys.includes(key))) throw new HataigoError('INVALID_ACTION');
	switch (action.type) {
		case 'play': {
			const point = action.point;
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
			if (!point || typeof point !== 'object' || Array.isArray(point) || Object.keys(point).some(key => key !== 'x' && key !== 'y') || !Number.isInteger(point.x) || !Number.isInteger(point.y)) throw new HataigoError('INVALID_ACTION');
			return { type: 'play', color, point: { x: point.x, y: point.y } };
		}
		case 'setScoring':
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- HTTP/stream payloads are untrusted at runtime despite the nominal input type.
			if (!action.marks || typeof action.marks !== 'object' || Array.isArray(action.marks) || Object.keys(action.marks).some(key => key !== 'deadStones' && key !== 'neutralPoints') || !Array.isArray(action.marks.deadStones) || !Array.isArray(action.marks.neutralPoints) || action.marks.deadStones.length > 361 || action.marks.neutralPoints.length > 361) throw new HataigoError('INVALID_ACTION');
			for (const point of [...action.marks.deadStones, ...action.marks.neutralPoints]) if (!point || typeof point !== 'object' || Array.isArray(point) || Object.keys(point).some(key => key !== 'x' && key !== 'y') || !Number.isInteger(point.x) || !Number.isInteger(point.y)) throw new HataigoError('INVALID_ACTION');
			return { type: 'setScoring', color, marks: { deadStones: action.marks.deadStones.map(point => ({ x: point.x, y: point.y })), neutralPoints: action.marks.neutralPoints.map(point => ({ x: point.x, y: point.y })) } };
		case 'pass': case 'resign': case 'acceptScore': case 'requestResume': case 'acceptNoResult':
			return { type: action.type, color };
		default:
			throw new HataigoError('INVALID_ACTION');
	}
}

export function applyOnlineAction(state: GameState, action: GameAction): { state: GameState; actions: GameAction[] } {
	if (action.type === 'acceptNoResult' && state.repetition === null && state.noResultAcceptedBy.length === 0) throw new HataigoError('INVALID_STATE', 'No repeated position to agree on');
	const applied = applyGameAction(state, action);
	if (!applied.ok) throw new HataigoError('INVALID_ACTION', applied.reason);
	if (action.type !== 'requestResume') return { state: applied.state, actions: [action] };
	// Phase 5 deliberately permits unilateral resumption; the opponent moves next.
	const acknowledgement: GameAction = { type: 'acceptResume', color: oppositeColor(action.color) };
	const resumed = applyGameAction(applied.state, acknowledgement);
	if (!resumed.ok) throw new HataigoError('INVALID_STATE');
	return { state: resumed.state, actions: [action, acknowledgement] };
}
