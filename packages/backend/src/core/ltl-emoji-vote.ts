/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const LTL_EMOJI_VOTE_TRIGGER = '絵文字を選ぶぞ';
export const LTL_EMOJI_VOTE_DURATION_MS = 30_000;
export const LTL_EMOJI_VOTE_TALLY_MS = 1_800;
export const LTL_EMOJI_VOTE_RESULT_MS = 20_000;
export const LTL_EMOJI_VOTE_EXIT_MS = 480;
export const LTL_EMOJI_VOTE_FRESH_MS = 10_000;
export const LTL_EMOJI_VOTE_START_DELAY_MS = 1_500;

export type LtlVoteEmoji = { id: string; name: string; url: string; isSensitive: boolean };
export type LtlVoteChoice = { emojiId: string; votedAt: number };
export type LtlVoteMetadata = {
	id: string;
	noteId: string;
	startedAt: number;
	closesAt: number;
	resolvedAt: number;
	expiresAt: number;
	candidates: LtlVoteEmoji[];
};
export type LtlVoteRanking = { emoji: LtlVoteEmoji; count: number; rank: number | null; tied: boolean };
export type LtlVoteResponse = {
	serverNow: number;
	round: (LtlVoteMetadata & {
		phase: 'voting' | 'tallying' | 'result';
		choice: LtlVoteChoice | null;
		rankings: LtlVoteRanking[];
		total: number;
	}) | null;
};

export type LtlVoteRead = { serverNow: number; metadata: LtlVoteMetadata | null; choice: LtlVoteChoice | null; counts: number[] };
export type LtlVoteStart = { noteId: string; createdAt: number; requestedAt: number; candidates: LtlVoteEmoji[] };
export type LtlVoteCastResult = 'OK' | 'NO_SUCH_ROUND' | 'VOTING_CLOSED' | 'ALREADY_VOTED' | 'INVALID_EMOJI';
export type LtlVoteStore = {
	start(input: LtlVoteStart): Promise<boolean>;
	read(userId: string | null): Promise<LtlVoteRead>;
	vote(roundId: string, userId: string, emojiId: string): Promise<LtlVoteCastResult>;
};

/** この2 APIだけは履歴を残さず扱う。部分一致で他のAPIを除外しない。 */
export function isLtlEmojiVoteApiPath(path: string | undefined): boolean {
	return path === 'hata/emoji-vote/show' || path === 'hata/emoji-vote/vote' ||
		path === '/api/hata/emoji-vote/show' || path === '/api/hata/emoji-vote/vote';
}

export function rankLtlEmojiVotes(candidates: LtlVoteEmoji[], counts: number[]): LtlVoteRanking[] {
	const rows = candidates.map((emoji, index) => ({ emoji, count: counts[index], index }));
	rows.sort((a, b) => b.count - a.count || a.index - b.index);
	const hasVotes = rows.some(row => row.count > 0);
	return rows.map((row, index) => ({
		emoji: row.emoji,
		count: row.count,
		rank: hasVotes ? rows.findIndex(other => other.count === row.count) + 1 : null,
		tied: hasVotes && (rows[index - 1]?.count === row.count || rows[index + 1]?.count === row.count),
	}));
}
