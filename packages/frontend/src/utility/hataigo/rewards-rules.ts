/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { AiRecord } from './ai-records.js';
import type { HataigoPrefs } from './prefs.js';

export type Theme = HataigoPrefs['theme'];
export type HumanStats = { wins: number; losses: number; draws: number; streak: number; wins9: number; wins19: number; distinctOpponents: number };
export type AiStats = { wins: number; losses: number; draws: number; streak: number; wins9: number; wins19: number };
/** Human and AI wins both count; distinct opponents remain human-only. */
export const COUNT_AI_WINS = true;
export const THEMES: readonly Theme[] = ['fuji', 'kaya', 'seiji', 'sakura', 'sumi', 'yoru'];
export const rewardText = {
	newBoard: '新しい盤が届きました', use: 'この盤にする', later: 'あとで', retry: 'もう一度読み込む',
	loadError: '記録を読み込めませんでした。',
	saveError: '盤の記録を保存できませんでした。もう一度読み込むと保存し直します。',
	seenError: 'お知らせを閉じられませんでした。もう一度押してください。',
	accountChanged: 'アカウントが切り替わりました。HataIgo を開き直してください。',
	human: '人との対局', ai: 'AIとの対局', wins: '勝ち', losses: '負け', draws: '引き分け', streak: '連勝中', played: '打ち終えた対局',
	conditions: {
		fuji: 'はじめから', kaya: 'はじめて勝つ', seiji: '9路で10勝', sakura: 'ちがう5人に勝つ', sumi: '19路ではじめて勝つ', yoru: '30局打ち終える',
	},
	/** Shown once under the board list; AI games count for wins but not for "different people". */
	conditionNote: '勝ちの数には AI との対局も入ります。「ちがう5人」は人との対局だけで数えます。',
} as const;

export function aiStats(records: readonly AiRecord[]): AiStats {
	const unique = [...new Map(records.map(record => [record.id, record])).values()].sort((a, b) => a.endedAt.localeCompare(b.endedAt) || a.id.localeCompare(b.id));
	const stats: AiStats = { wins: 0, losses: 0, draws: 0, streak: 0, wins9: 0, wins19: 0 };
	for (const record of unique) {
		if (record.winner === record.ownColor) { stats.wins++; stats.streak++; if (record.size === 9) stats.wins9++; if (record.size === 19) stats.wins19++; } else { stats.streak = 0; if (record.winner === 'draw') stats.draws++; else stats.losses++; }
	}
	return stats;
}

/** 打ち終えた対局の数。人とも AI とも、勝ち負け・引き分けを問わない */
export function playedGames(human: HumanStats | null, ai: AiStats | null): number {
	return (human ? human.wins + human.losses + human.draws : 0) + (ai ? ai.wins + ai.losses + ai.draws : 0);
}

export function eligibleThemes(human: HumanStats | null, ai: AiStats | null, countAiWins: boolean = COUNT_AI_WINS): Theme[] {
	const wins = (human?.wins ?? 0) + (countAiWins === true ? ai?.wins ?? 0 : 0);
	const wins9 = (human?.wins9 ?? 0) + (countAiWins === true ? ai?.wins9 ?? 0 : 0);
	const wins19 = (human?.wins19 ?? 0) + (countAiWins === true ? ai?.wins19 ?? 0 : 0);
	return THEMES.filter(theme => theme === 'fuji' || theme === 'kaya' && wins >= 1 || theme === 'seiji' && wins9 >= 10 || theme === 'sakura' && (human?.distinctOpponents ?? 0) >= 5 || theme === 'sumi' && wins19 >= 1 || theme === 'yoru' && playedGames(human, ai) >= 30);
}

export function parseHumanStats(value: unknown): HumanStats {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid statistics');
	const record = value as Record<string, unknown>;
	const keys = ['wins', 'losses', 'draws', 'streak', 'wins9', 'wins19', 'distinctOpponents'] as const;
	const stats = {} as HumanStats;
	for (const key of keys) { if (!Number.isSafeInteger(record[key]) || Number(record[key]) < 0) throw new Error('Invalid statistics'); stats[key] = Number(record[key]); }
	if (stats.streak > stats.wins || stats.wins9 + stats.wins19 > stats.wins || stats.distinctOpponents > stats.wins) throw new Error('Inconsistent statistics');
	return stats;
}
