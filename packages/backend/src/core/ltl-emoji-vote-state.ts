/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
	LTL_EMOJI_VOTE_DURATION_MS, LTL_EMOJI_VOTE_FRESH_MS, LTL_EMOJI_VOTE_RESULT_MS,
	LTL_EMOJI_VOTE_START_DELAY_MS, LTL_EMOJI_VOTE_TALLY_MS,
} from '@/core/ltl-emoji-vote.js';
import type { LtlVoteCastResult, LtlVoteChoice, LtlVoteEmoji, LtlVoteMetadata, LtlVoteRead, LtlVoteStart } from '@/core/ltl-emoji-vote.js';

export function isLtlVoteId(value: unknown): value is string {
	return typeof value === 'string' && /^[a-zA-Z0-9]{1,32}$/.test(value);
}

function isEmoji(value: unknown): value is LtlVoteEmoji {
	if (value == null || typeof value !== 'object') return false;
	const emoji = value as Record<string, unknown>;
	return isLtlVoteId(emoji.id) && typeof emoji.name === 'string' && emoji.name.length > 0 && emoji.name.length <= 128 &&
		typeof emoji.url === 'string' && emoji.url.length > 0 && emoji.url.length <= 512 && emoji.isSensitive === false;
}

export function isLtlVoteStart(value: unknown): value is LtlVoteStart {
	if (value == null || typeof value !== 'object') return false;
	const input = value as Record<string, unknown>;
	return isLtlVoteId(input.noteId) && Number.isFinite(input.createdAt) && Number.isFinite(input.requestedAt) &&
		Array.isArray(input.candidates) && input.candidates.length > 0 && input.candidates.length <= 5 &&
		input.candidates.every(isEmoji) &&
		new Set(input.candidates.map(emoji => emoji.id)).size === input.candidates.length;
}

type ActiveRound = { metadata: LtlVoteMetadata; counts: number[]; choices: Map<string, LtlVoteChoice> };

/** 1つのprimary内だけの短命な状態。Redis/DB/履歴へ書かず、別primaryへの複製も行わない。 */
export class LtlEmojiVoteMemoryState {
	private active: ActiveRound | null = null;
	private cleanupTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly now: () => number = Date.now) {}

	private expire(now: number): void {
		if (this.active && now >= this.active.metadata.expiresAt) this.clear();
	}

	public clear(): void {
		clearTimeout(this.cleanupTimer);
		this.cleanupTimer = undefined;
		this.active?.choices.clear();
		this.active = null;
	}

	public start(input: LtlVoteStart): boolean {
		const now = this.now();
		this.expire(now);
		if (this.active || !isLtlVoteStart(input) || now < input.createdAt - 1000 || now - input.createdAt > LTL_EMOJI_VOTE_FRESH_MS ||
			now < input.requestedAt - 1000 || now - input.requestedAt > LTL_EMOJI_VOTE_START_DELAY_MS) return false;
		const closesAt = now + LTL_EMOJI_VOTE_DURATION_MS;
		const resolvedAt = closesAt + LTL_EMOJI_VOTE_TALLY_MS;
		const expiresAt = resolvedAt + LTL_EMOJI_VOTE_RESULT_MS;
		this.active = {
			metadata: { id: input.noteId, noteId: input.noteId, startedAt: now, closesAt, resolvedAt, expiresAt, candidates: structuredClone(input.candidates) },
			counts: input.candidates.map(() => 0), choices: new Map(),
		};
		// freshnessより長い間activeを保つので、終了済みnoteの再開始防止にseen履歴は要らない。
		this.cleanupTimer = setTimeout(() => this.clear(), expiresAt - now);
		this.cleanupTimer.unref();
		return true;
	}

	public read(userId: string | null): LtlVoteRead {
		const serverNow = this.now();
		this.expire(serverNow);
		if (!this.active) return { serverNow, metadata: null, counts: [], choice: null };
		// Map全体を返さず、匿名なら票なし・認証済みなら自分の1票だけを複製する。
		return structuredClone({
			serverNow, metadata: this.active.metadata, counts: this.active.counts,
			choice: userId === null ? null : this.active.choices.get(userId) ?? null,
		});
	}

	public vote(roundId: string, userId: string, emojiId: string): LtlVoteCastResult {
		const now = this.now();
		this.expire(now);
		if (!this.active || this.active.metadata.id !== roundId || !isLtlVoteId(userId)) return 'NO_SUCH_ROUND';
		if (now >= this.active.metadata.closesAt) return 'VOTING_CLOSED';
		if (this.active.choices.has(userId)) return 'ALREADY_VOTED';
		const index = this.active.metadata.candidates.findIndex(emoji => emoji.id === emojiId);
		if (index < 0) return 'INVALID_EMOJI';
		// awaitを挟まず判定と加算を終える。複数workerからの票もprimaryのこの1箇所を通る。
		this.active.choices.set(userId, { emojiId, votedAt: now });
		this.active.counts[index]++;
		return 'OK';
	}
}
