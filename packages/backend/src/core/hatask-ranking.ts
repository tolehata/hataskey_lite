/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const HATASK_RANKING_METRICS = ['flower', 'utage', 'block', 'login'] as const;
export const HATASK_RANKING_PERIODS = ['month', 'week', 'day'] as const;
export type HataskRankingMetric = typeof HATASK_RANKING_METRICS[number];
export type HataskRankingPeriod = typeof HATASK_RANKING_PERIODS[number];
export const HATASK_RANKING_HOUR = 60 * 60 * 1000;

export interface HataskRankingScore {
	userId: string;
	metric: HataskRankingMetric;
	value: number;
}

export interface HataskRankingSnapshot {
	generatedAt: string;
	scores: HataskRankingScore[];
}

/** Match the server calendar used by i.ts when recording loggedInDates. */
export function hataskRankingWindow(period: HataskRankingPeriod, now: Date) {
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (period === 'month') start.setDate(1);
	if (period === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
	const dateLabel = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	const loginDates: string[] = [];
	for (const date = new Date(start); date <= now; date.setDate(date.getDate() + 1)) {
		loginDates.push(`${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`);
	}
	return { start, from: dateLabel(start), to: dateLabel(now), loginDates };
}

/** Competition ranks: equal values receive equal ranks (1, 1, 3). */
export function rankHataskScores(scores: readonly HataskRankingScore[]) {
	const sorted = scores.filter(score => score.value > 0).toSorted((a, b) => b.value - a.value || a.userId.localeCompare(b.userId, 'en'));
	let rank = 0;
	return sorted.map((score, index) => {
		if (index === 0 || score.value !== sorted[index - 1].value) rank = index + 1;
		return { ...score, rank };
	});
}

export function parseHataskRankingSnapshot(raw: string | null): HataskRankingSnapshot | null {
	if (raw == null) return null;
	try {
		const data: unknown = JSON.parse(raw);
		if (typeof data !== 'object' || data === null || !('generatedAt' in data) || !('scores' in data)) return null;
		if (typeof data.generatedAt !== 'string' || !Number.isFinite(Date.parse(data.generatedAt)) || !Array.isArray(data.scores)) return null;
		const isScore = (score: unknown): score is HataskRankingScore => typeof score === 'object' && score !== null &&
			'userId' in score && typeof score.userId === 'string' &&
			'metric' in score && HATASK_RANKING_METRICS.some(metric => metric === score.metric) &&
			'value' in score && typeof score.value === 'number' && Number.isSafeInteger(score.value) && score.value >= 0;
		if (!data.scores.every(isScore)) return null;
		return { generatedAt: data.generatedAt, scores: data.scores };
	} catch {
		return null;
	}
}
