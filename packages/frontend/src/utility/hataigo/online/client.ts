/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { FIXED_REACTIONS } from './presentation.js';
import { parseOnlineGame, parseOnlineGames } from './types.js';
import type { GameEvents, LobbyEvents, OnlineClient } from './controller.js';
import type { FixedReaction } from './presentation.js';
import type { OnlineAction, OnlineApi } from './types.js';
import { $i } from '@/i.js';
import { useStream } from '@/stream.js';
import { misskeyApi } from '@/utility/misskey-api.js';

type WireListener = (payload: unknown) => void;
type WireChannel = { on: (event: string, callback: WireListener) => void; off: (event: string, callback: WireListener) => void; send: (event: string, payload: unknown) => void; dispose: () => void };
type WireStream = { state: string; useChannel: (name: string, params?: Record<string, unknown>) => WireChannel; on: (event: string, callback: () => void) => void; off: (event: string, callback: () => void) => void };
type Pending = { resolve: () => void; reject: (error: Error) => void; timer: number };
type GameConnection = { channel: WireChannel; pending: Map<string, Pending> };

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function actionPayload(action: OnlineAction): OnlineAction {
	if (action.type === 'play') return { type: 'play', point: { x: action.point.x, y: action.point.y } };
	if (action.type === 'setScoring') return { type: 'setScoring', marks: { deadStones: action.marks.deadStones.map(point => ({ x: point.x, y: point.y })), neutralPoints: action.marks.neutralPoints.map(point => ({ x: point.x, y: point.y })) } };
	return { type: action.type };
}

/** Transport adapter for the existing authenticated API and shared stream.
 * An uncertain sent action is never retried automatically over HTTP.
 */
export function createOnlineClient(): OnlineClient {
	if (!$i) throw new Error('HATAIGO_UNAVAILABLE');
	const account = { id: $i.id, token: $i.token };
	let stream: WireStream | undefined;
	const games = new Map<string, GameConnection>();
	const isCurrent = () => !!$i && $i.id === account.id && $i.token === account.token;
	const getStream = (): WireStream => { stream ??= useStream() as unknown as WireStream; return stream; };
	// Validate wire data independently of generated SDK declarations.
	const invoke = misskeyApi as unknown as (endpoint: string, params: Record<string, unknown>, token: string) => Promise<unknown>;
	const request = async (endpoint: string, params: Record<string, unknown> = {}): Promise<unknown> => {
		if (!isCurrent()) throw new Error('HATAIGO_UNAVAILABLE');
		const result = await invoke(endpoint, params, account.token);
		if (!isCurrent()) throw new Error('HATAIGO_UNAVAILABLE');
		return result;
	};
	const api: OnlineApi = {
		show: async gameId => parseOnlineGame(await request('hataigo/show-game', { gameId })),
		games: async params => parseOnlineGames(await request('hataigo/games', params)),
		invitations: async () => parseOnlineGames(await request('hataigo/invitations')),
		// 相手待ちのときサーバーは 204 を返し、misskeyApi は undefined で解決する
		match: async options => { const result = await request('hataigo/match', { userId: null, ...options }); return result === null || result === undefined ? null : parseOnlineGame(result); },
		invite: async (userId, options) => parseOnlineGame(await request('hataigo/match', { userId, ...options })),
		cancelMatch: async () => { await request('hataigo/cancel-match'); },
		respond: async (gameId, accept, expectedRevision) => parseOnlineGame(await request('hataigo/respond-invite', { gameId, accept, expectedRevision })),
		settings: async (gameId, settings, expectedRevision) => parseOnlineGame(await request('hataigo/settings', { gameId, settings, expectedRevision })),
		ready: async (gameId, ready, expectedRevision) => parseOnlineGame(await request('hataigo/ready', { gameId, ready, expectedRevision })),
		action: async (gameId, action, expectedRevision) => {
			if (!isCurrent()) throw new Error('HATAIGO_UNAVAILABLE');
			const payload = actionPayload(action);
			const connection = games.get(gameId);
			if (connection === undefined || getStream().state !== 'connected') { await request('hataigo/action', { gameId, action: payload, expectedRevision }); return; }
			const requestId = crypto.randomUUID();
			await new Promise<void>((resolve, reject) => {
				const timer = window.setTimeout(() => { connection.pending.delete(requestId); reject(new Error('NETWORK')); }, 8000);
				connection.pending.set(requestId, { resolve, reject, timer });
				try { connection.channel.send('action', { action: payload, expectedRevision, requestId }); } catch { window.clearTimeout(timer); connection.pending.delete(requestId); reject(new Error('NETWORK')); }
			});
		},
		cancelGame: async (gameId, expectedRevision) => parseOnlineGame(await request('hataigo/cancel-game', { gameId, expectedRevision })),
		verify: async (gameId, revision) => {
			const result = await request('hataigo/verify', { gameId, revision });
			if (!object(result) || typeof result.desynced !== 'boolean') throw new Error('INVALID_RESPONSE');
			return { desynced: result.desynced, ...(result.game === undefined ? {} : { game: parseOnlineGame(result.game) }) };
		},
		claimTimeout: async (gameId, expectedRevision) => parseOnlineGame(await request('hataigo/claim-timeout', { gameId, expectedRevision })),
	};

	const watchConnection = (changed: (connected: boolean) => void): (() => void) => {
		const selected = getStream();
		const connected = () => changed(true);
		const disconnected = () => changed(false);
		selected.on('_connected_', connected);
		selected.on('_disconnected_', disconnected);
		return () => { selected.off('_connected_', connected); selected.off('_disconnected_', disconnected); };
	};

	return {
		api, viewerId: account.id, isCurrent, connected: () => getStream().state === 'connected',
		watchGame(gameId: string, events: GameEvents) {
			const channel = getStream().useChannel('hataigoGame', { gameId });
			const connection: GameConnection = { channel, pending: new Map() };
			games.set(gameId, connection);
			const listeners: Record<string, WireListener> = {
				updated: value => { if (isCurrent() && object(value) && Number.isSafeInteger(value.revision)) events.updated(Number(value.revision)); },
				spectators: value => { if (isCurrent() && object(value) && Number.isSafeInteger(value.count) && Number(value.count) >= 0) events.spectators(Number(value.count)); },
				reacted: value => { if (isCurrent() && object(value) && FIXED_REACTIONS.includes(value.reaction as FixedReaction)) events.reacted(value.reaction as FixedReaction); },
				revoked: () => events.revoked(),
				ack: value => {
					if (!object(value) || typeof value.requestId !== 'string') return;
					const pending = connection.pending.get(value.requestId);
					if (pending === undefined) return;
					window.clearTimeout(pending.timer);
					connection.pending.delete(value.requestId);
					if (value.ok === true) pending.resolve();
					else pending.reject(new Error(typeof value.error === 'string' ? value.error : 'NETWORK'));
				},
			};
			for (const [event, listener] of Object.entries(listeners)) channel.on(event, listener);
			const stopConnection = watchConnection(events.connection);
			let stopped = false;
			return () => {
				if (stopped) return;
				stopped = true;
				stopConnection();
				for (const [event, listener] of Object.entries(listeners)) channel.off(event, listener);
				channel.dispose();
				if (games.get(gameId) === connection) games.delete(gameId);
				for (const pending of connection.pending.values()) { window.clearTimeout(pending.timer); pending.reject(new Error('CANCELLED')); }
				connection.pending.clear();
			};
		},
		watchLobby(events: LobbyEvents) {
			const channel = getStream().useChannel('hataigo');
			const matched: WireListener = value => { if (isCurrent() && object(value) && typeof value.gameId === 'string') events.matched(value.gameId); };
			const invited: WireListener = value => { if (isCurrent() && object(value) && typeof value.gameId === 'string') events.invited(value.gameId); };
			channel.on('matched', matched);
			channel.on('invited', invited);
			const stopConnection = watchConnection(events.connection);
			return () => { stopConnection(); channel.off('matched', matched); channel.off('invited', invited); channel.dispose(); };
		},
		async react(gameId, reaction) {
			if (!isCurrent()) throw new Error('HATAIGO_UNAVAILABLE');
			const connection = games.get(gameId);
			if (connection === undefined || getStream().state !== 'connected' || !FIXED_REACTIONS.includes(reaction)) throw new Error('NETWORK');
			connection.channel.send('reaction', { reaction });
		},
	};
}
