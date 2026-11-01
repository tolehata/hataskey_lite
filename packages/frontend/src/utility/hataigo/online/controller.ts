/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getGroup, getStone, playMove } from '../rules/board.js';
import { ownColor, participantSlot } from './presentation.js';
import { onlineErrorCode } from './types.js';
import type { Point } from '../rules/board.js';
import type { FixedReaction } from './presentation.js';
import type { MatchOptions, OnlineAction, OnlineApi, OnlineGame, OnlineSettingsPatch } from './types.js';

export type GameEvents = { updated: (revision: number) => void; spectators: (count: number) => void; reacted: (reaction: FixedReaction) => void; revoked: () => void; connection: (connected: boolean) => void };
export type LobbyEvents = { matched: (gameId: string) => void; invited: (gameId: string) => void; connection: (connected: boolean) => void };
export type OnlineClient = {
	api: OnlineApi; viewerId: string; isCurrent: () => boolean; connected: () => boolean;
	watchGame: (gameId: string, events: GameEvents) => () => void;
	watchLobby: (events: LobbyEvents) => () => void;
	react: (gameId: string, reaction: FixedReaction) => Promise<void>;
};

function shouldContinueRefresh(refreshAgain: boolean, generationIsActive: boolean): boolean { return refreshAgain && generationIsActive; }

/** All visible positions and approvals come from a fresh server DTO. The
 * local rules only reject an obviously illegal click before sending it.
 */
export class OnlineGameController {
	game: OnlineGame | null = null;
	active = false;
	connected = false;
	busy = false;
	loading = false;
	fresh = false;
	error: string | null = null;
	spectators: number | null = null;
	reaction: { value: FixedReaction; at: number } | null = null;
	private generation = 0;
	private unsubscribe: (() => void) | undefined;
	private fetching: Promise<void> | undefined;
	private refreshAgain = false;
	private receivedAt = 0;
	private lastReactionAt = -Infinity;

	constructor(readonly gameId: string, private client: OnlineClient, private changed: () => void = () => {}, private now: () => number = Date.now) {}

	private isGenerationActive(generation: number): boolean { return this.active && generation === this.generation; }

	get participant(): boolean {
		return this.game !== null && this.client.isCurrent() && participantSlot(this.game, this.client.viewerId) !== null;
	}

	get canAct(): boolean {
		return this.active && this.fresh && !this.busy && !this.loading && this.participant;
	}

	get canPlay(): boolean {
		const game = this.game;
		if (!this.canAct || game?.phase !== 'playing' || game.state === null) return false;
		const color = ownColor(game, this.client.viewerId);
		return color !== null && color === game.myColor && color === game.state.toPlay;
	}

	serverTime(): number {
		return this.game === null ? 0 : this.game.serverNowMs + Math.max(0, this.now() - this.receivedAt);
	}

	private notify(): void { this.changed(); }

	private unavailable(): void {
		this.generation++;
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.game = null;
		this.fresh = false;
		this.busy = false;
		this.loading = false;
		this.fetching = undefined;
		this.refreshAgain = false;
		this.spectators = null;
		this.reaction = null;
		this.error = 'UNAVAILABLE';
		this.notify();
	}

	private adopt(game: OnlineGame): void {
		if (!this.client.isCurrent()) { this.unavailable(); return; }
		if (game.id !== this.gameId) throw new Error('INVALID_RESPONSE');
		if (this.game !== null && game.revision < this.game.revision) return;
		this.game = game;
		this.receivedAt = this.now();
		this.fresh = true;
	}

	async activate(): Promise<void> {
		if (this.active && this.unsubscribe !== undefined) return;
		if (!this.client.isCurrent()) { this.unavailable(); return; }
		this.active = true;
		this.connected = this.client.connected();
		this.error = null;
		this.unsubscribe = this.client.watchGame(this.gameId, {
			updated: revision => {
				if (!this.client.isCurrent()) { this.unavailable(); return; }
				if (this.game === null || revision > this.game.revision) { this.fresh = false; void this.refresh(); }
			},
			spectators: count => { if (this.active) { this.spectators = count; this.notify(); } },
			reacted: value => { if (this.active) { this.reaction = { value, at: this.now() }; this.notify(); } },
			revoked: () => this.unavailable(),
			connection: connected => {
				this.connected = connected;
				this.fresh = false;
				if (this.active) void this.refresh();
				this.notify();
			},
		});
		await this.refresh();
	}

	deactivate(): void {
		this.active = false;
		this.generation++;
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.game = null;
		this.fresh = false;
		this.busy = false;
		this.loading = false;
		this.fetching = undefined;
		this.refreshAgain = false;
		this.spectators = null;
		this.reaction = null;
		this.notify();
	}

	async refresh(): Promise<void> {
		if (!this.active) return;
		if (!this.client.isCurrent()) { this.unavailable(); return; }
		if (this.fetching !== undefined) { this.refreshAgain = true; return this.fetching; }
		const generation = this.generation;
		this.loading = true;
		this.notify();
		this.fetching = (async () => {
			do {
				this.refreshAgain = false;
				try {
					const game = await this.client.api.show(this.gameId);
					if (this.isGenerationActive(generation)) this.adopt(game);
				} catch (cause) {
					if (!this.isGenerationActive(generation)) return;
					const code = onlineErrorCode(cause);
					if (code === 'UNAVAILABLE' || code === 'NOT_FOUND' || code === 'FORBIDDEN') { this.unavailable(); return; }
					this.fresh = false;
					this.error = code;
				}
			} while (shouldContinueRefresh(this.refreshAgain, this.isGenerationActive(generation)));
		})().finally(() => {
			if (generation === this.generation) { this.fetching = undefined; this.loading = false; this.notify(); }
		});
		return this.fetching;
	}

	async verify(): Promise<void> {
		if (!this.active || this.game === null || this.busy || this.loading) return;
		if (!this.client.isCurrent()) { this.unavailable(); return; }
		const generation = this.generation;
		try {
			const response = await this.client.api.verify(this.gameId, this.game.revision);
			if (this.isGenerationActive(generation)) {
				if (response.game !== undefined) this.adopt(response.game);
				else if (response.desynced) await this.refresh();
				this.notify();
			}
		} catch (cause) {
			if (generation === this.generation) { this.error = onlineErrorCode(cause); if (this.error === 'UNAVAILABLE') this.unavailable(); else this.notify(); }
		}
	}

	private async mutate(operation: (game: OnlineGame) => Promise<OnlineGame | void>, permission: boolean): Promise<boolean> {
		const game = this.game;
		if (!permission || game === null || !this.canAct) return false;
		const generation = this.generation;
		this.busy = true;
		this.error = null;
		this.notify();
		try {
			const result = await operation(game);
			if (!this.isGenerationActive(generation)) return false;
			if (result !== undefined) this.adopt(result);
			await this.refresh();
			return this.fresh;
		} catch (cause) {
			if (!this.isGenerationActive(generation)) return false;
			const code = onlineErrorCode(cause);
			if (code === 'UNAVAILABLE' || code === 'NOT_FOUND' || code === 'FORBIDDEN') { this.unavailable(); return false; }
			this.error = code;
			this.fresh = false;
			await this.refresh();
			return false;
		} finally { if (generation === this.generation) { this.busy = false; this.notify(); } }
	}

	play(point: Point): Promise<boolean> {
		const game = this.game;
		if (!this.canPlay || game?.state == null || game.myColor === null) return Promise.resolve(false);
		const legal = playMove(game.state.board, game.myColor, point, game.state.previousBoard ?? undefined);
		if (!legal.ok) { this.error = legal.reason; this.notify(); return Promise.resolve(false); }
		return this.action({ type: 'play', point });
	}

	action(action: OnlineAction): Promise<boolean> {
		const phase = this.game?.phase;
		const allowed = action.type === 'play' || action.type === 'pass' ? this.canPlay
			: action.type === 'setScoring' || action.type === 'acceptScore' || action.type === 'requestResume' ? phase === 'scoring'
			: phase === 'playing' || phase === 'scoring';
		return this.mutate(game => this.client.api.action(game.id, action, game.revision), allowed);
	}

	settings(patch: OnlineSettingsPatch): Promise<boolean> { return this.mutate(game => this.client.api.settings(game.id, patch, game.revision), this.game?.phase === 'waiting' && this.game.invitationAccepted); }
	withdrawChat(): Promise<boolean> { return this.mutate(game => this.client.api.settings(game.id, { allowSpectatorChat: false }, game.revision), this.game?.phase !== 'waiting'); }
	withdrawName(): Promise<boolean> { return this.mutate(game => this.client.api.settings(game.id, { announcement: { allowName: false } }, game.revision), this.game?.phase !== 'waiting'); }
	stopAnnouncement(): Promise<boolean> { return this.mutate(game => this.client.api.settings(game.id, { announcement: { enabled: false } }, game.revision), this.game?.phase !== 'waiting'); }
	ready(ready: boolean): Promise<boolean> { return this.mutate(game => this.client.api.ready(game.id, ready, game.revision), this.game?.phase === 'waiting' && this.game.invitationAccepted); }
	cancelGame(): Promise<boolean> { return this.mutate(game => this.client.api.cancelGame(game.id, game.revision), this.game?.phase === 'waiting'); }
	respond(accept: boolean): Promise<boolean> { return this.mutate(game => this.client.api.respond(game.id, accept, game.revision), this.game?.phase === 'waiting' && this.game.user2Id === this.client.viewerId && !this.game.invitationAccepted); }
	claimTimeout(): Promise<boolean> { return this.mutate(game => this.client.api.claimTimeout(game.id, game.revision), this.game?.phase === 'playing'); }

	mark(point: Point): Promise<boolean> {
		const state = this.game?.state;
		if (!this.canAct || this.game?.phase !== 'scoring' || state == null) return Promise.resolve(false);
		let deadStones = [...state.scoring.deadStones];
		let neutralPoints = [...state.scoring.neutralPoints];
		const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
		if (getStone(state.board, point) !== null) {
			const group = getGroup(state.board, point);
			if (group === null) return Promise.resolve(false);
			const remove = group.stones.every(stone => deadStones.some(mark => same(mark, stone)));
			deadStones = deadStones.filter(mark => !group.stones.some(stone => same(mark, stone)));
			if (!remove) deadStones.push(...group.stones);
		} else neutralPoints = neutralPoints.some(mark => same(mark, point)) ? neutralPoints.filter(mark => !same(mark, point)) : [...neutralPoints, point];
		return this.action({ type: 'setScoring', marks: { deadStones, neutralPoints } });
	}

	async react(reaction: FixedReaction): Promise<boolean> {
		if (!this.active || this.game === null || !this.client.isCurrent() || this.now() - this.lastReactionAt < 3000) return false;
		this.lastReactionAt = this.now();
		try { await this.client.react(this.gameId, reaction); return true; } catch (cause) { this.error = onlineErrorCode(cause); this.notify(); return false; }
	}
}

export class OnlineLobbyController {
	mine: OnlineGame[] = [];
	publicGames: OnlineGame[] = [];
	invitations: OnlineGame[] = [];
	matching = false;
	busy = false;
	loading = false;
	active = false;
	error: string | null = null;
	moreMine = false;
	morePublic = false;
	private generation = 0;
	private unsubscribe: (() => void) | undefined;
	private matchOptions: MatchOptions | undefined;
	private heartbeatBusy = false;
	private refreshId = 0;

	constructor(private client: OnlineClient, private openGame: (gameId: string) => void, private changed: () => void = () => {}) {}

	private isGenerationActive(generation: number): boolean { return this.active && generation === this.generation; }
	private isCurrentRequest(generation: number): boolean { return this.isGenerationActive(generation) && this.client.isCurrent(); }
	private isCurrentMatch(generation: number, game: OnlineGame | null): game is OnlineGame { return this.isGenerationActive(generation) && this.matching && game !== null; }
	private shouldRefreshAfterResponse(generation: number, accept: boolean): boolean { return this.active && !(generation === this.generation && accept); }

	async activate(): Promise<void> {
		if (this.active) return;
		if (!this.client.isCurrent()) { this.error = 'UNAVAILABLE'; this.changed(); return; }
		this.active = true;
		this.unsubscribe = this.client.watchLobby({
			matched: gameId => { if (this.active && this.matching) { this.matching = false; this.openGame(gameId); this.changed(); } else if (this.active) void this.refresh(); },
			invited: () => { if (this.active) void this.refresh(); },
			connection: connected => { if (connected && this.active) { void this.refresh(); if (this.matching) void this.heartbeat(); } },
		});
		await this.refresh();
	}

	async deactivate(): Promise<void> {
		this.active = false;
		this.generation++;
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.mine = [];
		this.publicGames = [];
		this.invitations = [];
		this.loading = false;
		this.busy = false;
		const matching = this.matching;
		this.matching = false;
		this.matchOptions = undefined;
		this.changed();
		if (matching) { try { await this.client.api.cancelMatch(); } catch { /* The queue entry also expires server-side. */ } }
	}

	async refresh(): Promise<void> {
		if (!this.active) return;
		if (!this.client.isCurrent()) { await this.deactivate(); this.error = 'UNAVAILABLE'; this.changed(); return; }
		const generation = this.generation;
		const refreshId = ++this.refreshId;
		this.loading = true;
		this.error = null;
		this.changed();
		const results = await Promise.allSettled([this.client.api.games({ my: true, ongoing: true, limit: 20 }), this.client.api.games({ my: false, limit: 20 }), this.client.api.invitations()]);
		if (!this.isCurrentRequest(generation) || refreshId !== this.refreshId) return;
		const mine = results[0];
		const publicGames = results[1];
		const invitations = results[2];
		if (mine.status === 'fulfilled') { this.mine = mine.value.filter(game => participantSlot(game, this.client.viewerId) !== null && game.phase !== 'ended'); this.moreMine = mine.value.length === 20; }
		if (publicGames.status === 'fulfilled') { this.publicGames = publicGames.value.filter(game => game.phase === 'ended' ? game.publicAfterEnd : game.allowSpectate); this.morePublic = publicGames.value.length === 20; }
		if (invitations.status === 'fulfilled') this.invitations = invitations.value.filter(game => game.user2Id === this.client.viewerId && game.phase === 'waiting' && !game.invitationAccepted);
		for (const result of results) if (result.status === 'rejected') this.error = onlineErrorCode(result.reason);
		this.loading = false;
		this.changed();
	}

	async loadMore(my: boolean): Promise<void> {
		if (!this.active || this.loading) return;
		const existing = my ? this.mine : this.publicGames;
		const untilId = existing.at(-1)?.id;
		if (untilId === undefined) return;
		const generation = this.generation;
		this.loading = true;
		this.changed();
		try {
			const values = await this.client.api.games({ my, ...(my ? { ongoing: true } : {}), limit: 20, untilId });
			if (!this.isGenerationActive(generation)) return;
			const unique = new Map(existing.map(game => [game.id, game]));
			for (const game of values) if (my ? participantSlot(game, this.client.viewerId) !== null && game.phase !== 'ended' : game.phase === 'ended' ? game.publicAfterEnd : game.allowSpectate) unique.set(game.id, game);
			if (my) { this.mine = [...unique.values()]; this.moreMine = values.length === 20; } else { this.publicGames = [...unique.values()]; this.morePublic = values.length === 20; }
		} catch (cause) { this.error = onlineErrorCode(cause); } finally { if (generation === this.generation) { this.loading = false; this.changed(); } }
	}

	async match(options: MatchOptions): Promise<void> {
		if (!this.active || this.busy || this.matching) return;
		this.matchOptions = { ...options };
		this.matching = true;
		this.error = null;
		this.changed();
		await this.heartbeat();
	}

	async heartbeat(): Promise<void> {
		if (!this.active || !this.matching || this.matchOptions === undefined || this.heartbeatBusy) return;
		const generation = this.generation;
		this.heartbeatBusy = true;
		try {
			const game = await this.client.api.match(this.matchOptions);
			if (this.isCurrentMatch(generation, game)) { this.matching = false; this.openGame(game.id); }
		} catch (cause) { if (generation === this.generation) { this.matching = false; this.error = onlineErrorCode(cause); } } finally {
			this.heartbeatBusy = false;
			if (!this.matching && this.client.isCurrent()) { try { await this.client.api.cancelMatch(); } catch { /* Best effort for an in-flight queue request after cancellation. */ } }
			this.changed();
		}
	}

	async cancelMatch(): Promise<void> {
		if (!this.matching) return;
		this.matching = false;
		this.matchOptions = undefined;
		this.changed();
		try { await this.client.api.cancelMatch(); } catch (cause) { this.error = onlineErrorCode(cause); this.changed(); }
	}

	async invite(userId: string, options: MatchOptions): Promise<void> {
		if (!this.active || this.busy || this.matching) return;
		const generation = this.generation;
		this.busy = true;
		this.error = null;
		this.changed();
		try { const game = await this.client.api.invite(userId, options); if (this.isGenerationActive(generation)) this.openGame(game.id); } catch (cause) { if (generation === this.generation) this.error = onlineErrorCode(cause); } finally { if (generation === this.generation) { this.busy = false; this.changed(); } }
	}

	async respond(game: OnlineGame, accept: boolean): Promise<void> {
		if (!this.active || this.busy || game.user2Id !== this.client.viewerId) return;
		const generation = this.generation;
		this.busy = true;
		this.error = null;
		this.changed();
		try { const updated = await this.client.api.respond(game.id, accept, game.revision); if (this.isGenerationActive(generation) && accept) this.openGame(updated.id); else if (this.shouldRefreshAfterResponse(generation, accept)) await this.refresh(); } catch (cause) { if (generation === this.generation) { const code = onlineErrorCode(cause); await this.refresh(); this.error = code; } } finally { if (generation === this.generation) { this.busy = false; this.changed(); } }
	}
}
