/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const LTL_EMOJI_VOTE_RAIN_MS = 1550;
export const LTL_EMOJI_VOTE_DECLINED_MS = 1200;
export const LTL_EMOJI_VOTE_EXIT_MS = 480;

export type LtlEmojiVoteEmoji = {
	id: string;
	name: string;
	url: string;
	isSensitive: boolean;
};

export type LtlEmojiVoteRanking = {
	emoji: LtlEmojiVoteEmoji;
	count: number;
	rank: number | null;
	tied: boolean;
};

export type LtlEmojiVoteChoice = { emojiId: string; votedAt: number };

export type LtlEmojiVoteRound = {
	id: string;
	noteId: string;
	startedAt: number;
	closesAt: number;
	resolvedAt: number;
	expiresAt: number;
	candidates: LtlEmojiVoteEmoji[];
	rankings: LtlEmojiVoteRanking[];
	choice: LtlEmojiVoteChoice | null;
	total: number;
	phase: 'voting' | 'tallying' | 'result';
};

export type LtlEmojiVoteResponse = { serverNow: number; round: LtlEmojiVoteRound | null };
export type LtlEmojiVotePhase = 'idle' | 'voting' | 'rain' | 'waiting' | 'tallying' | 'result' | 'declined' | 'leaving';
export type LtlEmojiVoteEffect = 'rain' | 'confetti';

/** The server decides the outcome. The local clock only controls its presentation. */
export function getLtlEmojiVotePhase(round: LtlEmojiVoteRound | null, now: number, allowRain = false, rainStartedAt = round?.choice?.votedAt ?? 0): LtlEmojiVotePhase {
	if (!round || now >= round.expiresAt + LTL_EMOJI_VOTE_EXIT_MS) return 'idle';
	if (now >= round.expiresAt) return 'leaving';
	if (allowRain && round.choice && now - rainStartedAt < LTL_EMOJI_VOTE_RAIN_MS) return 'rain';
	if (round.phase === 'result' && now >= round.resolvedAt) return 'result';
	if (now >= round.closesAt || round.phase === 'tallying') return 'tallying';
	return round.choice ? 'waiting' : 'voting';
}
