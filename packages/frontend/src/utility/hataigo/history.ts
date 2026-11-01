/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { toSgfPoint } from './rules/board.js';
import { getHandicapPoints } from './rules/handicap.js';
import { writeSgf } from './rules/sgf.js';
import { onlineErrorCode } from './online/types.js';
import { participantSlot } from './online/presentation.js';
import type { OnlineClient } from './online/controller.js';
import type { OnlineGame } from './online/types.js';
import type { SgfNode } from './rules/sgf.js';

export const historyText = {
	withdrawalEnded: '相手の退会で終了（勝敗なし）', title: '終わった対局', mine: '自分の対局', public: '公開されている対局', empty: 'まだ棋譜はありません',
	loading: '読み込み中…', refresh: '更新', more: 'もっと見る', replay: '並べてみる', download: 'SGFで保存', share: 'リンクを共有',
	shareConfirm: 'リンクを開いた人は、対局者の名前と棋譜を見られます。コピーしますか？',
	copy: 'コピー', copied: 'コピーしました', cancel: 'やめる', privacy: '',
	unavailable: 'この棋譜は見られません', error: '棋譜を読み込めませんでした', copyError: 'コピーできませんでした',
	loadExternal: 'この棋譜に切り替えますか？ いま並べている手は消えます。', confirmLoad: '切り替える', cancelLoad: 'そのままにする',
} as const;

/** Only current server snapshots are exported. User names, comments and other
 * personal properties are excluded from this generated SGF.
 */
export function gameSgf(game: OnlineGame): string {
	if (game.phase !== 'ended' || game.state === null) throw new Error('UNAVAILABLE');
	const size = game.settings.size;
	const root: SgfNode['properties'] = { SZ: [String(size)], KM: [String(game.settings.komi)], RU: ['Japanese'] };
	if (game.settings.handicap >= 2) { root.HA = [String(game.settings.handicap)]; root.AB = getHandicapPoints(size, game.settings.handicap).map(point => toSgfPoint(point, size)); root.PL = ['W']; }
	const result = game.state.result;
	if (result !== null) {
		if (result.reason === 'noResult') root.RE = ['Void'];
		else if (result.winner === 'draw') root.RE = ['0'];
		else if (result.winner === 'black' || result.winner === 'white') root.RE = [`${result.winner === 'black' ? 'B' : 'W'}+${result.reason === 'score' ? result.score?.margin ?? 0 : result.reason === 'resign' ? 'R' : 'T'}`];
	}
	const sequence: SgfNode[] = [{ properties: root }, ...game.state.moves.map(move => ({ properties: { [move.color === 'black' ? 'B' : 'W']: [move.point === null ? '' : toSgfPoint(move.point, size)] } }))];
	const written = writeSgf({ sequence, variations: [] });
	if (!written.ok) throw new Error('INVALID_RESPONSE');
	return written.value;
}

export class HistoryController {
	mine: OnlineGame[] = [];
	publicGames: OnlineGame[] = [];
	loading = false;
	busy = false;
	active = false;
	error: string | null = null;
	moreMine = false;
	morePublic = false;
	private generation = 0;
	private requestId = 0;
	private cursors: { mine?: string; public?: string } = {};

	constructor(private client: OnlineClient, private changed: () => void = () => {}) {}

	private isGenerationActive(generation: number): boolean { return this.active && generation === this.generation; }
	private isRequestCurrent(generation: number): boolean { return this.isGenerationActive(generation) && this.client.isCurrent(); }

	async activate(): Promise<void> { if (this.active) return; this.active = true; await this.refresh(); }
	deactivate(): void { this.active = false; this.generation++; this.mine = []; this.publicGames = []; this.cursors = {}; this.moreMine = false; this.morePublic = false; this.loading = false; this.busy = false; this.changed(); }

	private allowed(game: OnlineGame, my: boolean): boolean { return game.phase === 'ended' && game.state !== null && (my ? participantSlot(game, this.client.viewerId) !== null : game.publicAfterEnd); }

	async refresh(): Promise<void> {
		if (!this.active || !this.client.isCurrent()) { this.deactivate(); return; }
		const generation = this.generation;
		const requestId = ++this.requestId;
		this.loading = true; this.error = null; this.changed();
		const results = await Promise.allSettled([this.client.api.games({ my: true, ended: true, limit: 20 }), this.client.api.games({ my: false, ended: true, limit: 20 })]);
		if (!this.isRequestCurrent(generation) || requestId !== this.requestId) return;
		for (const [index, result] of results.entries()) {
			if (result.status === 'rejected') { this.error = onlineErrorCode(result.reason); continue; }
			const values = result.value;
			if (index === 0) { this.mine = values.filter(game => this.allowed(game, true)); this.moreMine = values.length === 20; this.cursors.mine = values.at(-1)?.id; } else { this.publicGames = values.filter(game => this.allowed(game, false)); this.morePublic = values.length === 20; this.cursors.public = values.at(-1)?.id; }
		}
		this.loading = false; this.changed();
	}

	async more(my: boolean): Promise<void> {
		if (!this.active || this.loading || !this.client.isCurrent()) return;
		const untilId = my ? this.cursors.mine : this.cursors.public;
		if (untilId === undefined) return;
		const generation = this.generation;
		this.loading = true; this.changed();
		try {
			const values = await this.client.api.games({ my, ended: true, limit: 20, untilId });
			if (!this.isGenerationActive(generation)) return;
			const merged = new Map((my ? this.mine : this.publicGames).map(game => [game.id, game]));
			for (const game of values) if (this.allowed(game, my)) merged.set(game.id, game);
			if (my) { this.mine = [...merged.values()]; this.moreMine = values.length === 20; this.cursors.mine = values.at(-1)?.id; } else { this.publicGames = [...merged.values()]; this.morePublic = values.length === 20; this.cursors.public = values.at(-1)?.id; }
		} catch (cause) { if (generation === this.generation) this.error = onlineErrorCode(cause); } finally { if (generation === this.generation) { this.loading = false; this.changed(); } }
	}

	async fresh(gameId: string, share = false): Promise<OnlineGame | null> {
		if (!this.active || this.busy || !this.client.isCurrent()) return null;
		const generation = this.generation;
		this.busy = true; this.error = null; this.changed();
		try {
			const game = await this.client.api.show(gameId);
			if (!this.isRequestCurrent(generation)) return null;
			const own = participantSlot(game, this.client.viewerId) !== null;
			if (game.id !== gameId || !this.allowed(game, own) || (share && (!own || !game.publicAfterEnd))) throw new Error('UNAVAILABLE');
			return game;
		} catch (cause) {
			if (generation === this.generation) { this.error = onlineErrorCode(cause); this.mine = this.mine.filter(game => game.id !== gameId); this.publicGames = this.publicGames.filter(game => game.id !== gameId); }
			return null;
		} finally { if (generation === this.generation) { this.busy = false; this.changed(); } }
	}
}
