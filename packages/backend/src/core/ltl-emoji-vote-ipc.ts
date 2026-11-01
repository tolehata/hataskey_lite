/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import cluster from 'node:cluster';
import { randomUUID } from 'node:crypto';
import { LtlEmojiVoteMemoryState, isLtlVoteId, isLtlVoteStart } from '@/core/ltl-emoji-vote-state.js';
import type { LtlVoteCastResult, LtlVoteRead, LtlVoteStart, LtlVoteStore } from '@/core/ltl-emoji-vote.js';
import type { Worker } from 'node:cluster';

export const LTL_VOTE_IPC_REQUEST = 'hata:ltl-emoji-vote:request';
export const LTL_VOTE_IPC_RESPONSE = 'hata:ltl-emoji-vote:response';
export const LTL_VOTE_IPC_TIMEOUT_MS = 1000;
export const LTL_VOTE_IPC_MAX_PENDING = 256;

export type LtlVoteCommand =
	{ operation: 'start'; input: LtlVoteStart } |
	{ operation: 'read'; userId: string | null } |
	{ operation: 'vote'; roundId: string; userId: string; emojiId: string };
type Result = boolean | LtlVoteRead | LtlVoteCastResult;
type Request = { type: typeof LTL_VOTE_IPC_REQUEST; id: string; deadline: number; command: LtlVoteCommand };
type Response = { type: typeof LTL_VOTE_IPC_RESPONSE; id: string; result: Result | null };

export type LtlVoteIpcChannel = {
	isConnected(): boolean;
	send(message: Request, callback: (error: Error | null) => void): void;
	onMessage(callback: (message: unknown) => void): () => void;
	onDisconnect(callback: () => void): () => void;
};

function isCommand(value: unknown): value is LtlVoteCommand {
	if (value == null || typeof value !== 'object') return false;
	const command = value as Record<string, unknown>;
	if (command.operation === 'start') return isLtlVoteStart(command.input);
	if (command.operation === 'read') return command.userId === null || isLtlVoteId(command.userId);
	return command.operation === 'vote' && isLtlVoteId(command.roundId) && isLtlVoteId(command.userId) && isLtlVoteId(command.emojiId);
}

function execute(state: LtlEmojiVoteMemoryState, command: LtlVoteCommand): Result {
	switch (command.operation) {
		case 'start': return state.start(command.input);
		case 'read': return state.read(command.userId);
		case 'vote': return state.vote(command.roundId, command.userId, command.emojiId);
	}
}

/** 有効期間を過ぎたIPCは実行しない。別機能のIPCや不正入力は状態に触れない。 */
export function handleLtlVoteIpcRequest(state: LtlEmojiVoteMemoryState, message: unknown, reply: (response: Response) => void, now = Date.now()): void {
	if (message == null || typeof message !== 'object') return;
	const request = message as Record<string, unknown>;
	if (request.type !== LTL_VOTE_IPC_REQUEST || typeof request.id !== 'string' || request.id.length > 64) return;
	let result: Result | null = null;
	if (typeof request.deadline === 'number' && Number.isFinite(request.deadline) && now < request.deadline && request.deadline <= now + LTL_VOTE_IPC_TIMEOUT_MS && isCommand(request.command)) {
		result = execute(state, request.command);
	}
	reply({ type: LTL_VOTE_IPC_RESPONSE, id: request.id, result });
}

/** HTTP workerは状態を持たずprimaryへ問い合わせる。切断・上限・無応答時は復元や再送をしない。 */
export class LtlEmojiVoteIpcClient {
	private readonly pending = new Map<string, { resolve: (result: Result | null) => void; timer: ReturnType<typeof setTimeout> }>();
	private readonly unsubscribe: (() => void)[];
	private disposed = false;

	constructor(private readonly channel: LtlVoteIpcChannel) {
		this.unsubscribe = [channel.onMessage(message => this.receive(message)), channel.onDisconnect(() => this.dispose())];
	}

	private settle(id: string, result: Result | null): void {
		const request = this.pending.get(id);
		if (!request) return;
		clearTimeout(request.timer);
		this.pending.delete(id);
		request.resolve(result);
	}

	private receive(message: unknown): void {
		if (message == null || typeof message !== 'object') return;
		const response = message as Partial<Response>;
		if (response.type === LTL_VOTE_IPC_RESPONSE && typeof response.id === 'string') this.settle(response.id, response.result ?? null);
	}

	public request(command: LtlVoteCommand): Promise<Result | null> {
		if (this.disposed || !this.channel.isConnected() || this.pending.size >= LTL_VOTE_IPC_MAX_PENDING) return Promise.resolve(null);
		return new Promise(resolve => {
			const id = randomUUID();
			const timer = setTimeout(() => this.settle(id, null), LTL_VOTE_IPC_TIMEOUT_MS);
			timer.unref();
			this.pending.set(id, { resolve, timer });
			try {
				this.channel.send({ type: LTL_VOTE_IPC_REQUEST, id, deadline: Date.now() + LTL_VOTE_IPC_TIMEOUT_MS, command }, error => {
					if (error) this.settle(id, null);
				});
			} catch {
				this.settle(id, null);
			}
		});
	}

	public dispose(): void {
		this.disposed = true;
		for (const unsubscribe of this.unsubscribe) unsubscribe();
		for (const id of this.pending.keys()) this.settle(id, null);
	}
}

// 非cluster時のserver/queue別Nest contextも共有する。複数primary/replica間では共有しない。
const primaryState = cluster.isPrimary ? new LtlEmojiVoteMemoryState() : null;
let client: LtlEmojiVoteIpcClient | undefined;
let coordinatorCleanup: (() => void) | undefined;

export function startLtlEmojiVoteCoordinator(): void {
	if (!primaryState || coordinatorCleanup) return;
	const onMessage = (worker: Worker, message: unknown) => {
		if (!worker.isConnected()) return;
		handleLtlVoteIpcRequest(primaryState, message, response => {
			if (!worker.isConnected()) return;
			try {
				worker.send(response, () => { /* 切断された相手の応答を保存・再送しない */ });
			} catch { /* 終了済みworkerへ応答できなくても状態や本文をログへ残さない */ }
		});
	};
	cluster.on('message', onMessage);
	coordinatorCleanup = () => cluster.off('message', onMessage);
}

export function stopLtlEmojiVoteCoordinator(): void {
	coordinatorCleanup?.();
	coordinatorCleanup = undefined;
	primaryState?.clear();
	client?.dispose();
	client = undefined;
}

async function dispatch(command: LtlVoteCommand): Promise<Result | null> {
	if (primaryState) return execute(primaryState, command);
	client ??= new LtlEmojiVoteIpcClient({
		isConnected: () => process.connected === true,
		send: (message, callback) => { process.send?.(message, callback); },
		onMessage: callback => { process.on('message', callback); return () => process.off('message', callback); },
		onDisconnect: callback => { process.on('disconnect', callback); return () => process.off('disconnect', callback); },
	});
	return client.request(command);
}

export const ltlEmojiVoteStore: LtlVoteStore = {
	async start(input) { return await dispatch({ operation: 'start', input }) === true; },
	async read(userId) {
		const result = await dispatch({ operation: 'read', userId });
		if (result == null || typeof result !== 'object' || !Number.isFinite(result.serverNow)) throw new Error('Emoji vote coordinator unavailable');
		return result;
	},
	async vote(roundId, userId, emojiId) {
		const result = await dispatch({ operation: 'vote', roundId, userId, emojiId });
		switch (result) {
			case 'OK': case 'NO_SUCH_ROUND': case 'VOTING_CLOSED': case 'ALREADY_VOTED': case 'INVALID_EMOJI': return result;
			default: throw new Error('Emoji vote coordinator unavailable');
		}
	},
};
