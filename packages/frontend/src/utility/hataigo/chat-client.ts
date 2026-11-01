/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { parseChatMessage, parseChatPolicy } from './chat.js';
import type { ChatTransport } from './chat.js';
import { $i } from '@/i.js';
import { useStream } from '@/stream.js';
import { misskeyApi } from '@/utility/misskey-api.js';

type Listener = (payload: unknown) => void;
type Channel = { on: (event: string, listener: Listener) => void; off: (event: string, listener: Listener) => void; dispose: () => void };
type Stream = { useChannel: (name: string, params: Record<string, unknown>) => Channel; on: (event: string, listener: () => void) => void; off: (event: string, listener: () => void) => void };
export function createChatTransport(): ChatTransport {
	if (!$i) throw new Error('HATAIGO_UNAVAILABLE');
	const account = { id: $i.id, token: $i.token };
	const current = () => !!$i && $i.id === account.id && $i.token === account.token;
	const invoke = misskeyApi as unknown as (endpoint: string, params: Record<string, unknown>, token: string) => Promise<unknown>;
	const request = async (endpoint: string, params: Record<string, unknown> = {}): Promise<unknown> => {
		if (!current()) throw new Error('HATAIGO_UNAVAILABLE');
		const value = await invoke(endpoint, params, account.token);
		if (!current()) throw new Error('HATAIGO_UNAVAILABLE');
		return value;
	};
	return {
		viewerId: account.id, current,
		capability: async () => parseChatPolicy(await request('hataigo/chat-capability')),
		messages: async (gameId, untilId) => { const result = await request('hataigo/chat-messages', { gameId, limit: 50, ...(untilId === undefined ? {} : { untilId }) }); if (!Array.isArray(result) || result.length > 50) throw new Error('INVALID_RESPONSE'); const rows = result.map(parseChatMessage); if (rows.some(row => row.gameId !== gameId)) throw new Error('INVALID_RESPONSE'); return rows; },
		post: async (gameId, text) => { const message = parseChatMessage(await request('hataigo/chat-post', { gameId, text })); if (message.gameId !== gameId) throw new Error('INVALID_RESPONSE'); return message; },
		remove: async (messageId, reason) => { await request('hataigo/chat-delete', { messageId, reason }); },
		report: async (userId, comment) => { await request('users/report-abuse', { userId, comment }); },
		watch(gameId, events) {
			if (!current()) throw new Error('HATAIGO_UNAVAILABLE');
			const stream = useStream() as unknown as Stream;
			const channel = stream.useChannel('hataigoGame', { gameId });
			const message: Listener = value => { if (!current()) return; try { const parsed = parseChatMessage(value); if (parsed.gameId === gameId) events.message(parsed); } catch { /* Ignore malformed stream frames. */ } };
			const revoked: Listener = () => events.revoked();
			const disconnected = () => events.disconnected();
			channel.on('chatMessage', message); channel.on('chatDeleted', message); channel.on('revoked', revoked);
			stream.on('_disconnected_', disconnected);
			let stopped = false;
			return () => { if (stopped) return; stopped = true; channel.off('chatMessage', message); channel.off('chatDeleted', message); channel.off('revoked', revoked); stream.off('_disconnected_', disconnected); channel.dispose(); };
		},
	};
}
