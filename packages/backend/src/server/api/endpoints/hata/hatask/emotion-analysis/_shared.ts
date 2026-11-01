/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiHataskEmotionAnalysis } from '@/models/HataskEmotionAnalysis.js';

export const HATALYZE_MIN_ANALYZED_NOTES = 10;

/**
 * 旗鯖fork: 1アカウントが保存できる分析結果の上限。
 * ⚠️6件目を保存した時点で、一番古い履歴が自動で削除される(利用者のデータが消える)。
 *   画面側にもその旨を出しているので、片方だけ変えないこと。
 * ⚠️フロントだけで数を制限しても API を直接叩けば増やせるため、判定は必ず backend に置く。
 */
export const HATALYZE_HISTORY_LIMIT = 5;

/**
 * 新しい順に並んだ ID から、上限を超えて捨てる分だけを返す。
 * ⚠️呼び出し側で必ず「新しい順」に並べてから渡すこと。順序を誤ると新しい方を消す。
 */
export function selectHatalyzeOverflowIds(idsNewestFirst: readonly string[], limit = HATALYZE_HISTORY_LIMIT): string[] {
	if (limit < 0) return [];
	return idsNewestFirst.slice(limit);
}

export function validateHatalyzeAggregateCounts(source: { fetchedNoteCount: number; analyzedNoteCount: number }, input: { received: number; accepted: number; skippedInvalidTimestamp?: number; skippedNoAnalyzableText?: number }): 'ok' | 'insufficient' | 'inconsistent' {
	if (source.analyzedNoteCount < HATALYZE_MIN_ANALYZED_NOTES || input.accepted < HATALYZE_MIN_ANALYZED_NOTES) return 'insufficient';
	if (source.fetchedNoteCount !== input.received || source.analyzedNoteCount !== input.accepted || source.analyzedNoteCount > source.fetchedNoteCount) return 'inconsistent';
	if (input.skippedInvalidTimestamp !== undefined && input.skippedNoAnalyzableText !== undefined && input.accepted + input.skippedInvalidTimestamp + input.skippedNoAnalyzableText !== input.received) return 'inconsistent';
	return 'ok';
}

// 保存する JSON は「集計値」の形を固定する。additionalProperties を開けると
// 投稿IDや本文を別名で紛れ込ませられるため、各階層で未知の項目を拒否する。
const levelsSchema = {
	type: 'object',
	properties: {
		strong_positive: { type: 'integer', minimum: 0 },
		positive: { type: 'integer', minimum: 0 },
		neutral: { type: 'integer', minimum: 0 },
		negative: { type: 'integer', minimum: 0 },
		strong_negative: { type: 'integer', minimum: 0 },
	},
	required: ['strong_positive', 'positive', 'neutral', 'negative', 'strong_negative'],
	additionalProperties: false,
} as const;

const evidenceItemSchema = {
	type: 'object',
	properties: {
		label: { type: 'string', minLength: 1, maxLength: 128 },
		polarity: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
		count: { type: 'integer', minimum: 0 },
		weight: { type: 'number', minimum: 0 },
	},
	required: ['label', 'polarity', 'count', 'weight'],
	additionalProperties: false,
} as const;

const rateSchema = { type: 'number', minimum: 0, maximum: 1 } as const;

// 旗鯖fork(HATAlyze 2.0.0): 感情の軸ごとの集計。
// ⚠️axis は固定語彙の enum に限る。自由文字列を許すと本文の断片を紛れ込ませられる。
const emotionAxisSchema = {
	type: 'object',
	properties: {
		axis: { type: 'string', enum: ['joy', 'fun', 'affection', 'gratitude', 'anger', 'sadness', 'anxiety', 'fatigue'] },
		polarity: { type: 'string', enum: ['positive', 'negative'] },
		count: { type: 'integer', minimum: 0 },
		weight: { type: 'number', minimum: 0 },
		averageScore: { type: 'number', minimum: -1, maximum: 1 },
	},
	required: ['axis', 'polarity', 'count', 'weight', 'averageScore'],
	additionalProperties: false,
} as const;

const activitySchema = {
	type: 'object',
	properties: {
		activeDays: { type: 'integer', minimum: 0 },
		longestStreakDays: { type: 'integer', minimum: 0 },
		averagePostsPerActiveDay: { type: 'number', minimum: 0 },
		medianIntervalMinutes: { type: 'number', minimum: 0 },
		busiestHour: { type: 'integer', minimum: 0, maximum: 23 },
		busiestWeekday: { type: 'integer', minimum: 0, maximum: 6 },
		nightPostRate: rateSchema,
		morningPostRate: rateSchema,
	},
	required: ['activeDays', 'longestStreakDays', 'averagePostsPerActiveDay', 'medianIntervalMinutes', 'busiestHour', 'busiestWeekday', 'nightPostRate', 'morningPostRate'],
	additionalProperties: false,
} as const;

// ⚠️語彙は「割合と長さ」だけ。実際に使われた語そのものは保存しない。
const vocabularySchema = {
	type: 'object',
	properties: {
		averageSentenceLength: { type: 'number', minimum: 0 },
		uniqueTokenRatio: rateSchema,
		hashtagPostRate: rateSchema,
		mentionPostRate: rateSchema,
		urlPostRate: rateSchema,
		emojiPostRate: rateSchema,
		questionPostRate: rateSchema,
		exclamationPostRate: rateSchema,
	},
	required: ['averageSentenceLength', 'uniqueTokenRatio', 'hashtagPostRate', 'mentionPostRate', 'urlPostRate', 'emojiPostRate', 'questionPostRate', 'exclamationPostRate'],
	additionalProperties: false,
} as const;

const engagementSchema = {
	type: 'object',
	properties: {
		byLevel: {
			type: 'array', maxItems: 5,
			items: {
				type: 'object',
				properties: {
					level: { type: 'string', enum: ['strong_positive', 'positive', 'neutral', 'negative', 'strong_negative'] },
					count: { type: 'integer', minimum: 0 },
					averageReactions: { type: 'number', minimum: 0 },
					averageReplies: { type: 'number', minimum: 0 },
					averageRenotes: { type: 'number', minimum: 0 },
				},
				required: ['level', 'count', 'averageReactions', 'averageReplies', 'averageRenotes'],
				additionalProperties: false,
			},
		},
		// 話題名は TOPICS の固定キーなので保存してよい。該当なしは null。
		topTopicByReactions: { type: 'string', maxLength: 128, nullable: true },
	},
	required: ['byLevel', 'topTopicByReactions'],
	additionalProperties: false,
} as const;

const groupedScoreSchema = {
	type: 'object',
	properties: {
		count: { type: 'integer', minimum: 0 },
		averageScore: { type: 'number', minimum: -1, maximum: 1 },
	},
	required: ['count', 'averageScore'],
	additionalProperties: false,
} as const;

export const scopeJsonSchema = {
	type: 'object',
	properties: {
		mode: { type: 'string', enum: ['latest', 'period'] },
		periodDays: { type: 'integer', minimum: 1, maximum: 3650 },
		noteLimit: { type: 'integer', minimum: 1, maximum: 100000 },
		visibility: { type: 'string', enum: ['publicHome', 'followers', 'all'] },
		includeReplies: { type: 'boolean' },
		includeCw: { type: 'boolean' },
		timezoneOffsetMinutes: { type: 'integer', minimum: -840, maximum: 840 },
	},
	required: ['mode', 'noteLimit', 'visibility', 'includeReplies', 'includeCw', 'timezoneOffsetMinutes'],
	additionalProperties: false,
} as const;

export const sourceJsonSchema = {
	type: 'object',
	properties: {
		kind: { type: 'string', enum: ['localAccountNotes'] },
		fetchedNoteCount: { type: 'integer', minimum: 0, maximum: 100000 },
		analyzedNoteCount: { type: 'integer', minimum: 0, maximum: 100000 },
	},
	required: ['kind', 'fetchedNoteCount', 'analyzedNoteCount'],
	additionalProperties: false,
} as const;

export const summaryJsonSchema = {
	type: 'object',
	properties: {
		averageScore: { type: 'number', minimum: -1, maximum: 1 },
		emotionalPostRate: { type: 'number', minimum: 0, maximum: 1 },
		levels: levelsSchema,
	},
	required: ['averageScore', 'emotionalPostRate', 'levels'],
	additionalProperties: false,
} as const;

export const aggregateResultJsonSchema = {
	type: 'object',
	properties: {
		format: { type: 'string', enum: ['hata-emotion-analysis'] },
		formatVersion: { type: 'integer', minimum: 1 },
		timezoneOffsetMinutes: { type: 'integer', minimum: -840, maximum: 840 },
		input: {
			type: 'object',
			properties: {
				received: { type: 'integer', minimum: 0 },
				accepted: { type: 'integer', minimum: 0 },
				skippedInvalidTimestamp: { type: 'integer', minimum: 0 },
				skippedNoAnalyzableText: { type: 'integer', minimum: 0 },
			},
			required: ['received', 'accepted', 'skippedInvalidTimestamp', 'skippedNoAnalyzableText'],
			additionalProperties: false,
		},
		overview: {
			type: 'object',
			properties: {
				averageScore: { type: 'number', minimum: -1, maximum: 1 },
				emotionalPostRate: { type: 'number', minimum: 0, maximum: 1 },
				levels: levelsSchema,
			},
			required: ['averageScore', 'emotionalPostRate', 'levels'],
			additionalProperties: false,
		},
		evidence: {
			type: 'object',
			properties: {
				phrases: { type: 'array', items: evidenceItemSchema, maxItems: 256 },
				shortcodes: { type: 'array', items: evidenceItemSchema, maxItems: 256 },
				negations: { type: 'array', items: evidenceItemSchema, maxItems: 256 },
				excludedContexts: { type: 'array', items: evidenceItemSchema, maxItems: 256 },
				intensifiers: { type: 'array', items: evidenceItemSchema, maxItems: 256 },
			},
			required: ['phrases', 'shortcodes', 'negations', 'excludedContexts', 'intensifiers'],
			additionalProperties: false,
		},
		daily: {
			type: 'array', maxItems: 3650,
			items: {
				type: 'object',
				properties: { date: { type: 'string', maxLength: 32 }, ...groupedScoreSchema.properties },
				required: ['date', 'count', 'averageScore'], additionalProperties: false,
			},
		},
		weekly: {
			type: 'array', maxItems: 7,
			items: {
				type: 'object',
				properties: { weekday: { type: 'integer', minimum: 0, maximum: 6 }, ...groupedScoreSchema.properties },
				required: ['weekday', 'count', 'averageScore'], additionalProperties: false,
			},
		},
		hourly: {
			type: 'array', maxItems: 24,
			items: {
				type: 'object',
				properties: { hour: { type: 'integer', minimum: 0, maximum: 23 }, ...groupedScoreSchema.properties },
				required: ['hour', 'count', 'averageScore'], additionalProperties: false,
			},
		},
		topics: {
			type: 'array', maxItems: 128,
			items: {
				type: 'object',
				properties: { topic: { type: 'string', minLength: 1, maxLength: 128 }, ...groupedScoreSchema.properties },
				required: ['topic', 'count', 'averageScore'], additionalProperties: false,
			},
		},
		emotions: { type: 'array', maxItems: 32, items: emotionAxisSchema },
		activity: activitySchema,
		vocabulary: vocabularySchema,
		engagement: engagementSchema,
		posting: {
			type: 'object',
			properties: {
				averageTextLength: { type: 'number', minimum: 0 },
				averageReactions: { type: 'number', minimum: 0 },
				averageReplies: { type: 'number', minimum: 0 },
				averageRenotes: { type: 'number', minimum: 0 },
				mediaPostRate: { type: 'number', minimum: 0, maximum: 1 },
				cwPostRate: { type: 'number', minimum: 0, maximum: 1 },
			},
			required: ['averageTextLength', 'averageReactions', 'averageReplies', 'averageRenotes', 'mediaPostRate', 'cwPostRate'],
			additionalProperties: false,
		},
	},
	required: ['format', 'formatVersion', 'timezoneOffsetMinutes', 'input', 'overview', 'evidence', 'emotions', 'activity', 'vocabulary', 'engagement', 'daily', 'weekly', 'hourly', 'topics', 'posting'],
	additionalProperties: false,
} as const;

export function packHataskEmotionAnalysis(analysis: MiHataskEmotionAnalysis) {
	return {
		id: analysis.id,
		createdAt: analysis.createdAt.toISOString(),
		analysisVersion: analysis.analysisVersion,
		lexiconVersion: analysis.lexiconVersion,
		scope: analysis.scope,
		source: analysis.source,
		summary: analysis.summary,
		result: analysis.result,
	};
}
