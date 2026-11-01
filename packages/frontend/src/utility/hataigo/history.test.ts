/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it, vi } from 'vitest';
import { gameSgf, HistoryController } from './history.js';
import { createGame, applyGameAction } from './rules/game.js';
import { importRecord } from './record.js';
import type { OnlineClient } from './online/controller.js';
import type { OnlineGame } from './online/types.js';

function game(patch: Partial<OnlineGame> = {}): OnlineGame {
	const visibility = { allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false };
	const announcement = { enabled: false, visibility: 'home' as const, allowName: false };
	return { id: 'g', createdAt: '2026-10-20', startedAt: '2026-10-20', endedAt: '2026-10-20', user1Id: 'me', user2Id: 'other', user1: { id: 'me', username: 'secret-user', name: 'Secret Name', avatarUrl: null }, user2: null, black: 1, phase: 'ended', settings: { size: 9, handicap: 0, komi: 6.5, rules: 'japanese', clock: { kind: 'byoyomi', mainSec: 300, periodSec: 30, periods: 3 } }, user1Ready: true, user2Ready: true, isInvitation: false, invitationAccepted: true, revision: 2, ...visibility, visibility: { user1: visibility, user2: visibility }, announcements: { user1: announcement, user2: announcement }, state: createGame({ size: 9 }), clock: null, serverNowMs: 100000, myColor: 'black', isParticipant: true, ...patch };
}

function fixture() {
	const api = { games: vi.fn(async (_params: { my: boolean; ended?: boolean; limit: number; untilId?: string }) => [] as OnlineGame[]), show: vi.fn(async () => game()) };
	const client = { api, viewerId: 'me', isCurrent: () => true } as unknown as OnlineClient;
	return { api, client };
}

describe('authorized ended record history', () => {
	it('uses ended-only paginated lists and keeps private own records out of public browsing', async () => {
		const f = fixture();
		f.api.games.mockImplementation(async params => params.my ? [game()] : [game({ id: 'private', isParticipant: false }), game({ id: 'public', isParticipant: false, publicAfterEnd: true })]);
		const recordStore = new HistoryController(f.client);
		await recordStore.activate();
		expect(f.api.games).toHaveBeenCalledWith({ my: true, ended: true, limit: 20 });
		expect(recordStore.mine.map(value => value.id)).toEqual(['g']);
		expect(recordStore.publicGames.map(value => value.id)).toEqual(['public']);
	});
	it('freshly authorizes every export and requires own explicit public consent for link sharing', async () => {
		const f = fixture();
		const recordStore = new HistoryController(f.client);
		await recordStore.activate();
		expect(await recordStore.fresh('g')).not.toBeNull();
		expect(await recordStore.fresh('g', true)).toBeNull();
		f.api.show.mockResolvedValue(game({ publicAfterEnd: true }));
		expect(await recordStore.fresh('g', true)).not.toBeNull();
		f.api.show.mockResolvedValue(game({ publicAfterEnd: true, isParticipant: false }));
		expect(await recordStore.fresh('g', true)).toBeNull();
		expect(f.api.show).toHaveBeenCalledTimes(4);
	});
	it('refuses cached records after permission is revoked and removes their list card', async () => {
		const f = fixture();
		f.api.games.mockResolvedValue([game()]);
		const recordStore = new HistoryController(f.client);
		await recordStore.activate();
		f.api.show.mockRejectedValue({ code: 'HATAIGO_UNAVAILABLE' });
		expect(await recordStore.fresh('g')).toBeNull();
		expect(recordStore.mine).toEqual([]);
		expect(recordStore.error).toBe('UNAVAILABLE');
	});
	it('clears cached private lists when hidden and ignores a late authorization result', async () => {
		const f = fixture();
		let resolve: (value: OnlineGame) => void = () => {};
		f.api.show.mockImplementationOnce(() => new Promise<OnlineGame>(done => { resolve = done; }));
		const recordStore = new HistoryController(f.client);
		await recordStore.activate();
		const pending = recordStore.fresh('g');
		recordStore.deactivate();
		resolve(game());
		expect(await pending).toBeNull();
		expect(recordStore.mine).toEqual([]);
	});
});

describe('minimal server-authorized SGF', () => {
	it('omits names and comments and preserves explicit pass moves', () => {
		let state = createGame({ size: 9 });
		for (const action of [{ type: 'play', color: 'black', point: { x: 0, y: 0 } }, { type: 'pass', color: 'white' }] as const) {
			const next = applyGameAction(state, action);
			if (!next.ok) throw new Error('Invalid fixture');
			state = next.state;
		}
		const sgf = gameSgf(game({ state }));
		expect(sgf).toContain(';B[aa];W[]');
		expect(sgf).not.toMatch(/PB\[|PW\[|C\[|Secret|secret-user/);
		const parsed = importRecord(sgf);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.records[0].total).toBe(2);
	});
	it('keeps an anonymized withdrawal record replayable without manufacturing a result', () => {
		const value = game({ user2Id: null });
		const sgf = gameSgf(value);
		expect(sgf).not.toContain('RE[');
		expect(sgf).not.toMatch(/PB\[|PW\[|Secret/);
		expect(importRecord(sgf).ok).toBe(true);
	});

	it('preserves handicap setup and rejects unfinished exports', () => {
		const base = game();
		const sgf = gameSgf({ ...base, settings: { ...base.settings, handicap: 4, komi: 0 }, state: createGame({ size: 9, handicap: 4, komi: 0 }) });
		expect(sgf).toContain('HA[4]');
		expect(sgf).toContain('AB[');
		expect(sgf).toContain('PL[W]');
		expect(importRecord(sgf).ok).toBe(true);
		expect(() => gameSgf({ ...base, phase: 'playing' })).toThrow('UNAVAILABLE');
	});
});
