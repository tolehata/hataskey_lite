/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../rules/game.js';
import { OnlineGameController, OnlineLobbyController } from './controller.js';
import { clockView } from './presentation.js';
import { parseOnlineGame } from './types.js';
import type { GameEvents, LobbyEvents, OnlineClient } from './controller.js';
import type { OnlineApi, OnlineGame } from './types.js';

function game(patch: Partial<OnlineGame> = {}): OnlineGame {
	const vote = { allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false };
	const announcement = { enabled: false, visibility: 'home' as const, allowName: false };
	return { id: 'g', createdAt: '2026-10-20', startedAt: '2026-10-20', endedAt: null, user1Id: 'me', user2Id: 'other', user1: null, user2: null, black: 1, phase: 'playing', settings: { size: 9, handicap: 0, komi: 6.5, rules: 'japanese', clock: { kind: 'byoyomi', mainSec: 300, periodSec: 30, periods: 3 } }, user1Ready: true, user2Ready: true, isInvitation: false, invitationAccepted: true, revision: 1, ...vote, visibility: { user1: { ...vote }, user2: { ...vote } }, announcements: { user1: { ...announcement }, user2: { ...announcement } }, state: createGame({ size: 9 }), clock: null, serverNowMs: 100000, myColor: 'black', isParticipant: true, ...patch };
}

function fixture(initial = game()) {
	let current = initial;
	let events: GameEvents | undefined;
	let lobbyEvents: LobbyEvents | undefined;
	let valid = true;
	const dispose = vi.fn();
	const api = {
		show: vi.fn(async () => current), games: vi.fn(async (_params: Parameters<OnlineApi['games']>[0]) => [] as OnlineGame[]), invitations: vi.fn(async () => [] as OnlineGame[]),
		match: vi.fn(async () => null as OnlineGame | null), invite: vi.fn(async () => current), cancelMatch: vi.fn(async () => {}),
		respond: vi.fn(async () => current), settings: vi.fn(async () => current), ready: vi.fn(async () => current), action: vi.fn(async () => {}),
		cancelGame: vi.fn(async () => current), verify: vi.fn(async () => ({ desynced: false })), claimTimeout: vi.fn(async () => current),
	};
	const client: OnlineClient = { api, viewerId: 'me', connected: () => true, isCurrent: () => valid, watchGame: (_id, value) => { events = value; return dispose; }, watchLobby: value => { lobbyEvents = value; return dispose; }, react: vi.fn(async () => {}) };
	return { api, client, dispose, set: (value: OnlineGame) => { current = value; }, invalidate: () => { valid = false; }, get events() { if (events === undefined) throw new Error('No subscription'); return events; }, get lobbyEvents() { if (lobbyEvents === undefined) throw new Error('No subscription'); return lobbyEvents; } };
}

async function flush(): Promise<void> { for (let i = 0; i < 8; i++) await Promise.resolve(); }

describe('authoritative online game controller', () => {
	it('sends a revision and no color, and never inserts an optimistic stone', async () => {
		const f = fixture();
		const controller = new OnlineGameController('g', f.client);
		await controller.activate();
		await controller.play({ x: 1, y: 1 });
		expect(f.api.action).toHaveBeenCalledExactlyOnceWith('g', { type: 'play', point: { x: 1, y: 1 } }, 1);
		expect(controller.game?.state?.board.cells.every(cell => cell === null)).toBe(true);
		expect(f.api.show).toHaveBeenCalledTimes(2);
	});

	it('blocks spectator mutations even when the DTO participant flag is inconsistent', async () => {
		const f = fixture(game({ user1Id: 'someone', myColor: 'black' }));
		const controller = new OnlineGameController('g', f.client);
		await controller.activate();
		expect(await controller.play({ x: 0, y: 0 })).toBe(false);
		expect(await controller.action({ type: 'resign' })).toBe(false);
		expect(await controller.settings({ size: 13 })).toBe(false);
		expect(f.api.action).not.toHaveBeenCalled();
	});

	it('refreshes after a stale revision and requires a new explicit action', async () => {
		const f = fixture();
		const controller = new OnlineGameController('g', f.client);
		await controller.activate();
		f.set(game({ revision: 2 }));
		f.api.action.mockRejectedValueOnce({ code: 'HATAIGO_STALE_REVISION' });
		expect(await controller.action({ type: 'pass' })).toBe(false);
		expect(controller.game?.revision).toBe(2);
		expect(controller.error).toBe('STALE_REVISION');
		expect(f.api.action).toHaveBeenCalledTimes(1);
	});

	it('ignores lower revisions and refreshes after reconnect', async () => {
		const f = fixture(game({ revision: 3 }));
		const controller = new OnlineGameController('g', f.client);
		await controller.activate();
		f.set(game({ revision: 2 }));
		await controller.refresh();
		expect(controller.game?.revision).toBe(3);
		f.set(game({ revision: 4 }));
		f.events.connection(true);
		await flush();
		expect(controller.game?.revision).toBe(4);
	});

	it('clears private state on revocation or account change', async () => {
		const f = fixture();
		const controller = new OnlineGameController('g', f.client);
		await controller.activate();
		f.events.revoked();
		expect(controller.game).toBeNull();
		expect(controller.spectators).toBeNull();
		expect(f.dispose).toHaveBeenCalledTimes(1);
		await controller.activate();
		f.invalidate();
		await controller.verify();
		expect(controller.game).toBeNull();
	});

	it('ignores a late fetch after hiding and can fetch anew when shown', async () => {
		const f = fixture();
		let resolve: (value: OnlineGame) => void = () => {};
		f.api.show.mockImplementationOnce(() => new Promise<OnlineGame>(done => { resolve = done; }));
		const controller = new OnlineGameController('g', f.client);
		const pending = controller.activate();
		controller.deactivate();
		await controller.activate();
		f.set(game({ revision: 5 }));
		resolve(game({ revision: 99 }));
		await pending;
		expect(controller.game?.revision).toBe(1);
		await controller.refresh();
		expect(controller.game?.revision).toBe(5);
	});

	it('sends manual neutral marks without changing local approvals or accepting automatically', async () => {
		const base = createGame({ size: 9 });
		const state = { ...base, phase: 'scoring' as const, scoring: { ...base.scoring, acceptedBy: ['white' as const] } };
		const f = fixture(game({ phase: 'scoring', state }));
		const controller = new OnlineGameController('g', f.client);
		await controller.activate();
		await controller.mark({ x: 2, y: 2 });
		expect(f.api.action).toHaveBeenCalledExactlyOnceWith('g', { type: 'setScoring', marks: { deadStones: [], neutralPoints: [{ x: 2, y: 2 }] } }, 1);
		expect(controller.game?.state?.scoring.acceptedBy).toEqual(['white']);
	});
});

describe('lobby privacy and queue lifecycle', () => {
	it('asks for all ongoing own games and filters public data by separate live/end permissions', async () => {
		const f = fixture();
		f.api.games.mockImplementation(async params => params.my ? [game()] : [game({ id: 'hidden', isParticipant: false }), game({ id: 'shown', isParticipant: false, allowSpectate: true }), game({ id: 'ended', phase: 'ended', publicAfterEnd: false, allowSpectate: true })]);
		const controller = new OnlineLobbyController(f.client, vi.fn());
		await controller.activate();
		expect(f.api.games).toHaveBeenCalledWith({ my: true, ongoing: true, limit: 20 });
		expect(controller.publicGames.map(item => item.id)).toEqual(['shown']);
	});

	it('cancels an in-flight queue request when hidden and does not open its late match', async () => {
		const f = fixture();
		let resolve: (value: OnlineGame | null) => void = () => {};
		f.api.match.mockImplementationOnce(() => new Promise<OnlineGame | null>(done => { resolve = done; }));
		const openGame = vi.fn();
		const controller = new OnlineLobbyController(f.client, openGame);
		await controller.activate();
		const pending = controller.match({ size: 9, clockKind: 'byoyomi', allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false });
		await controller.deactivate();
		resolve(game());
		await pending;
		expect(openGame).not.toHaveBeenCalled();
		expect(f.api.cancelMatch).toHaveBeenCalledTimes(2);
	});
});

describe('clock display and DTO boundary', () => {
	it('advances a projected main time only from receipt serverNowMs', () => {
		const value = game({ clock: { state: { black: { mainRemainingMs: 200000, periodsRemaining: 3 }, white: { mainRemainingMs: 300000, periodsRemaining: 3 }, runningColor: 'black', turnStartedAtMs: 0 }, expiredColor: null, remainingTurnMs: 200000, deadlineAtMs: 390000 } });
		expect(clockView(value, 'black', 101000)?.label).toBe('3:19');
		expect(clockView(value, 'white', 101000)?.label).toBe('5:00');
	});

	it('keeps an exact deadline distinct from server-declared expiration', () => {
		const value = game({ settings: { ...game().settings, clock: { kind: 'correspondence', perMoveSec: 86400 } }, clock: { state: { black: { mainRemainingMs: 1000, periodsRemaining: 0 }, white: { mainRemainingMs: 86400000, periodsRemaining: 0 }, runningColor: 'black', turnStartedAtMs: 0 }, expiredColor: null, remainingTurnMs: 1000, deadlineAtMs: 101000 } });
		expect(clockView(value, 'black', 101000)).toMatchObject({ label: '0:00', expired: false });
		expect(clockView(value, 'black', 101001)?.expired).toBe(true);
	});

	it('rejects malformed positions and unsupported settings instead of rendering them', () => {
		expect(parseOnlineGame(game()).id).toBe('g');
		expect(() => parseOnlineGame({ ...game(), settings: { ...game().settings, size: 17 } })).toThrow('INVALID_RESPONSE');
		expect(() => parseOnlineGame({ ...game(), state: { ...createGame({ size: 9 }), board: { size: 9, hash: 'invalid', cells: [] } } })).toThrow('INVALID_RESPONSE');
	});
});
