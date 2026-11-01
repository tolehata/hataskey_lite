/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onlineErrorCode } from './online/types.js';
import type { OnlineGame, OnlineUser } from './online/types.js';

export type ChatPolicy = { enabled: boolean; retentionDays: number | null; disclosureVersion: string | null };
export type ChatMessage = { id: string; gameId: string; userId: string | null; user: OnlineUser | null; text: string | null; createdAt: string; expiresAt: string; deleted: boolean };
export type DeleteReason = 'abuse' | 'spam' | 'other';
export type ChatTransport = {
	current: () => boolean; viewerId: string;
	capability: () => Promise<ChatPolicy>;
	messages: (gameId: string, untilId?: string) => Promise<ChatMessage[]>;
	post: (gameId: string, text: string) => Promise<ChatMessage>;
	remove: (messageId: string, reason: DeleteReason) => Promise<void>;
	report: (userId: string, comment: string) => Promise<void>;
	watch: (gameId: string, events: { message: (message: ChatMessage) => void; revoked: () => void; disconnected: () => void }) => () => void;
};
export const chatText = {
	title: '観戦チャット', disabled: 'このサーバーでは観戦チャットを使えません', unavailable: 'この対局では観戦チャットが閉じています',
	hidden: '対局中は見えないようにしています（助言が目に入らないように）', show: 'チャットを見る', hide: 'チャットを隠す', empty: 'まだ発言はありません', loading: '読み込み中…',
	room: '見ている人みんなが読めます', retention: '発言は', days: '日で消えます', disclosurePolicy: '',
	input: 'ひとこと（500文字まで）', send: '送信', more: '前の発言', deleted: '削除された発言', withdrawn: '退会した人',
	error: 'チャットを読み込めませんでした', postError: '送れませんでした。もう一度どうぞ', retry: 'もう一度読み込む',
	report: '通報', reportConfirm: 'この発言を運営者に通報しますか？ 発言の内容・時刻・対局へのリンクが送られます。', confirmReport: '通報する', reported: '通報しました',
	remove: '削除', confirmRemove: '削除する', removeConfirm: 'この発言を削除しますか？', abuse: '嫌がらせ', spam: 'スパム', other: 'その他', cancel: 'やめる',
} as const;

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

export function parseChatPolicy(value: unknown): ChatPolicy {
	if (!object(value) || typeof value.enabled !== 'boolean') throw new Error('INVALID_RESPONSE');
	if (!value.enabled) return { enabled: false, retentionDays: null, disclosureVersion: null };
	if (!Number.isSafeInteger(value.retentionDays) || Number(value.retentionDays) <= 0 || typeof value.disclosureVersion !== 'string' || value.disclosureVersion.length === 0 || value.disclosureVersion.length > 100) throw new Error('INVALID_RESPONSE');
	return { enabled: true, retentionDays: Number(value.retentionDays), disclosureVersion: value.disclosureVersion };
}
export function parseChatMessage(value: unknown): ChatMessage {
	if (!object(value)) throw new Error('INVALID_RESPONSE');
	for (const key of ['id', 'gameId']) if (typeof value[key] !== 'string' || String(value[key]).length === 0 || String(value[key]).length > 100) throw new Error('INVALID_RESPONSE');
	if ((value.userId !== null && typeof value.userId !== 'string') || (value.text !== null && (typeof value.text !== 'string' || value.text.length > 500)) || typeof value.deleted !== 'boolean') throw new Error('INVALID_RESPONSE');
	if (typeof value.createdAt !== 'string' || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('INVALID_RESPONSE');
	if (value.user !== null && (!object(value.user) || typeof value.user.id !== 'string' || typeof value.user.username !== 'string' || (value.user.name !== null && typeof value.user.name !== 'string') || (value.user.avatarUrl !== null && typeof value.user.avatarUrl !== 'string'))) throw new Error('INVALID_RESPONSE');
	if (value.user !== null && object(value.user) && value.user.id !== value.userId) throw new Error('INVALID_RESPONSE');
	return { id: String(value.id), gameId: String(value.gameId), userId: value.userId as string | null, user: value.user as OnlineUser | null, text: value.deleted ? null : value.text as string | null, createdAt: value.createdAt, expiresAt: value.expiresAt, deleted: value.deleted };
}
export function chatAllowed(game: OnlineGame): boolean { return game.allowSpectatorChat && (game.phase === 'ended' ? game.publicAfterEnd : game.phase !== 'waiting' && game.allowSpectate); }
export function reportComment(message: ChatMessage, origin: string): string { return `HataIgo 観戦チャット\n対局: ${origin}/hataigo/${encodeURIComponent(message.gameId)}\n投稿時刻: ${message.createdAt}\n発言: ${message.text ?? ''}`; }

export class ChatController {
	policy: ChatPolicy | null = null;
	messages: ChatMessage[] = [];
	draft = '';
	active = false;
	visible = false;
	loading = false;
	busy = false;
	more = false;
	error: string | null = null;
	reported = false;
	private game: OnlineGame | null = null;
	private generation = 0;
	private unsubscribe: (() => void) | undefined;
	private cursor: string | undefined;
	private previousDefault: string | undefined;

	constructor(private transport: ChatTransport, private changed: () => void = () => {}, private now: () => number = Date.now) {}

	private isCurrentGeneration(generation: number): boolean { return generation === this.generation && this.enabled; }

	get allowed(): boolean { return this.game !== null && chatAllowed(this.game); }
	get enabled(): boolean { return this.active && this.visible && this.allowed && this.policy?.enabled === true && this.transport.current(); }

	clear(): void { this.generation++; this.unsubscribe?.(); this.unsubscribe = undefined; this.messages = []; this.draft = ''; this.loading = false; this.busy = false; this.more = false; this.cursor = undefined; this.reported = false; this.changed(); }
	deactivate(): void { this.active = false; this.policy = null; this.game = null; this.clear(); }

	async update(game: OnlineGame, active: boolean): Promise<void> {
		if (!active || !this.transport.current()) { this.deactivate(); return; }
		const defaultKey = `${game.id}:${game.phase === 'ended' ? 'ended' : 'live'}:${game.isParticipant}`;
		if (this.active && this.game !== null && this.previousDefault === defaultKey && chatAllowed(this.game) === chatAllowed(game) && this.policy !== null) {
			this.game = game;
			const generation = this.generation;
			try {
				const policy = await this.transport.capability();
				if (generation !== this.generation || !this.transport.current()) return;
				if (!policy.enabled) this.clear();
				this.policy = policy;
				this.changed();
				if (policy.enabled && this.visible && this.allowed && this.unsubscribe === undefined) await this.load();
			} catch (cause) { if (generation === this.generation) { this.policy = null; this.clear(); this.error = onlineErrorCode(cause); this.changed(); } }
			return;
		}
		if (this.previousDefault !== defaultKey) { this.visible = !game.isParticipant || game.phase === 'ended'; this.previousDefault = defaultKey; }
		this.clear(); this.game = game; this.active = true; this.policy = null; this.error = null;
		const generation = this.generation;
		try { const policy = await this.transport.capability(); if (generation !== this.generation || !this.transport.current()) return; this.policy = policy; this.changed(); if (policy.enabled && this.visible) await this.load(); } catch (cause) { if (generation === this.generation) { this.error = onlineErrorCode(cause); this.changed(); } }
	}

	async toggle(): Promise<void> { if (this.visible) { this.visible = false; this.clear(); } else { this.visible = true; await this.load(); } }

	async load(older = false): Promise<void> {
		if (!this.enabled || this.loading || this.game === null) return;
		const generation = this.generation;
		const gameId = this.game.id;
		this.loading = true; this.error = null; this.changed();
		try {
			if (!older && this.unsubscribe === undefined) {
				const stop = this.transport.watch(gameId, {
					message: message => { if (this.isCurrentGeneration(generation) && message.gameId === gameId) { this.merge([message]); this.changed(); } },
					revoked: () => { this.active = false; this.game = null; this.policy = null; this.clear(); },
					disconnected: () => { this.policy = null; this.clear(); this.error = 'NETWORK'; this.changed(); },
				});
				if (!this.isCurrentGeneration(generation)) { stop(); return; }
				this.unsubscribe = stop;
			}
			const rows = await this.transport.messages(gameId, older ? this.cursor : undefined); if (!this.isCurrentGeneration(generation)) return; this.cursor = rows.at(-1)?.id; this.more = rows.length === 50; this.merge(rows); 
		} catch (cause) { if (generation === this.generation) { this.clear(); this.policy = null; this.error = onlineErrorCode(cause); } } finally { if (generation === this.generation) { this.loading = false; this.changed(); } }
	}

	private merge(rows: readonly ChatMessage[]): void {
		const merged = new Map(this.messages.map(message => [message.id, message]));
		for (const message of rows) { const previous = merged.get(message.id); if (previous?.deleted && !message.deleted) continue; merged.set(message.id, message); }
		this.messages = [...merged.values()].filter(message => Date.parse(message.expiresAt) > this.now()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
	}
	purge(): void { if (!this.transport.current()) { this.deactivate(); return; } this.messages = this.messages.filter(message => Date.parse(message.expiresAt) > this.now()); this.changed(); }

	async post(): Promise<boolean> {
		const text = this.draft.trim();
		if (!this.enabled || this.busy || this.game === null || text.length === 0 || text.length > 500) return false;
		const generation = this.generation;
		this.busy = true; this.error = null; this.changed();
		try { const message = await this.transport.post(this.game.id, text); if (!this.isCurrentGeneration(generation)) return false; this.merge([message]); this.draft = ''; return true; } catch (cause) { if (generation === this.generation) this.error = onlineErrorCode(cause); return false; } finally { if (generation === this.generation) { this.busy = false; this.changed(); } }
	}

	async report(id: string, origin: string): Promise<boolean> {
		const message = this.messages.find(item => item.id === id);
		if (!this.enabled || this.busy || !message || message.deleted || message.text === null || message.userId === null || message.userId === this.transport.viewerId) return false;
		const generation = this.generation;
		this.busy = true; this.changed();
		try { await this.transport.report(message.userId, reportComment(message, origin)); if (!this.isCurrentGeneration(generation)) return false; this.reported = true; return true; } catch (cause) { if (generation === this.generation) this.error = onlineErrorCode(cause); return false; } finally { if (generation === this.generation) { this.busy = false; this.changed(); } }
	}

	async remove(id: string, reason: DeleteReason): Promise<boolean> {
		if (!this.enabled || this.busy || !this.messages.some(item => item.id === id)) return false;
		const generation = this.generation;
		this.busy = true; this.changed();
		try { await this.transport.remove(id, reason); if (!this.isCurrentGeneration(generation)) return false; this.messages = this.messages.map(item => item.id === id ? { ...item, text: null, deleted: true } : item); return true; } catch (cause) { if (generation === this.generation) this.error = onlineErrorCode(cause); return false; } finally { if (generation === this.generation) { this.busy = false; this.changed(); } }
	}
}
