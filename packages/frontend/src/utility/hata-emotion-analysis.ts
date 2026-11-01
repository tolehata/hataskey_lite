/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 利用者提供の AGPL-3.0 の感情分析用語集を基にした、端末内で使える集計器。
 * 本文、人格判定、心理的な推論、文章生成、画像生成は出力に含めない。
 *
 * ⚠️保存してよいのは「こちらの固定語彙のラベル」と「数値」だけ。
 *   本文から取り出した語(頻出語など)は端末内の表示に留め、保存用の型へ移さないこと。
 */

import {
	DIMINISHERS,
	EXCLUDED_CONTEXTS,
	HATA_EMOTION_AXES,
	HATA_EMOTION_AXIS_POLARITY,
	HATA_EMOTION_LEXICON,
	INTENSIFIERS,
	NEGATION_RULES,
	NEGATIVE_SHORTCODES,
	POSITIVE_SHORTCODES,
	TOPICS,
} from '@/utility/hata-emotion-lexicon.js';
import type { HataEmotionAxis } from '@/utility/hata-emotion-lexicon.js';

export type { HataEmotionAxis } from '@/utility/hata-emotion-lexicon.js';
export { HATA_EMOTION_AXES } from '@/utility/hata-emotion-lexicon.js';

export const HATA_EMOTION_ANALYSIS_FORMAT = 'hata-emotion-analysis' as const;
export const HATA_EMOTION_ANALYSIS_VERSION = 3 as const;
// API に保存する際の、計算方法と用語集を識別する文字列。formatVersion とは別に保つ。
// ⚠️2.0.0 で採点方法を「比率」から「強度を残す飽和関数」へ変えた。1.x の履歴とは数値が揃わない。
export const HATA_EMOTION_ANALYSIS_ANALYSIS_VERSION = '2.0.0' as const;
// ⚠️用語集を増やしたら必ずここを上げる。上げないと違う辞書の数値どうしを比較してしまう。
export const HATA_EMOTION_ANALYSIS_LEXICON_VERSION = '2.1.0' as const;
export const HATA_EMOTION_ANALYSIS_MIN_NOTES = 10 as const;

/** 保存する証跡の上限。⚠️backend の maxItems(256) を超えると保存そのものが弾かれる。 */
export const HATA_EMOTION_EVIDENCE_SAVE_LIMIT = 128 as const;
/** 端末内で見せる頻出語の件数。⚠️保存はしない。 */
export const HATA_EMOTION_FREQUENT_WORD_LIMIT = 24 as const;
/**
 * 保存できる履歴の件数。
 * ⚠️backend の HATALYZE_HISTORY_LIMIT と必ず同じ値にすること。
 *   ここは画面の案内文にしか使わないので、ずれると「案内と実際の挙動が違う」状態になる。
 * ⚠️上限を超えると一番古い履歴が自動で削除される(利用者のデータが消える)。
 */
export const HATA_EMOTION_HISTORY_LIMIT = 5 as const;

export type HatalyzeRequestStage = 'history' | 'notes' | 'create';
export type HatalyzeFailureKind = 'permission' | 'insufficient' | 'hatalyzeCooldown' | 'upstreamRateLimit' | 'unavailable';

type ApiErrorLike = {
	code?: unknown;
	info?: { resetMs?: unknown };
};

export function classifyHatalyzeFailure(error: unknown, stage: HatalyzeRequestStage): HatalyzeFailureKind {
	const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as ApiErrorLike).code ?? '') : '';
	if (code === 'ROLE_PERMISSION_DENIED') return 'permission';
	if (code === 'INSUFFICIENT_HATALYZE_NOTES') return 'insufficient';
	if (stage === 'create' && (code === 'HATALYZE_RATE_LIMIT_EXCEEDED' || code === 'HATALYZE_BRIEF_REQUEST_INTERVAL')) return 'hatalyzeCooldown';
	if (code === 'RATE_LIMIT_EXCEEDED' || code === 'BRIEF_REQUEST_INTERVAL') return 'upstreamRateLimit';
	return 'unavailable';
}

export function getHatalyzeCooldownUntil(error: unknown, now = Date.now()): number {
	if (typeof error === 'object' && error !== null && 'info' in error) {
		const resetMs = Number((error as ApiErrorLike).info?.resetMs);
		if (Number.isFinite(resetMs) && resetMs > now) return resetMs;
	}
	return now + 10 * 60 * 1000;
}

export function hatalyzeNoticeStorageKey(accountId: string): `hatalyzeNoticeAcceptedV1:${string}` {
	return `hatalyzeNoticeAcceptedV1:${accountId}`;
}

export function hatalyzeNoticeSyncedStorageKey(accountId: string): `hatalyzeNoticeSyncedV1:${string}` {
	return `hatalyzeNoticeSyncedV1:${accountId}`;
}

export function hatalyzeCooldownStorageKey(accountId: string): `hatalyzeCooldownV1:${string}` {
	return `hatalyzeCooldownV1:${accountId}`;
}

export function canStartHatalyzeAnalysis(input: { accountId: string | null; serviceReady: boolean; submitting: boolean; waiting: boolean }): boolean {
	return input.accountId != null && input.accountId.length > 0 && input.serviceReady && !input.submitting && !input.waiting;
}

export type HataEmotionAnalysisInputNote = {
	id: string;
	text?: string | null;
	cw?: string | null;
	createdAt: string;
	reactionCount?: number | null;
	repliesCount?: number | null;
	renoteCount?: number | null;
	files?: readonly unknown[] | null;
};

export function isHataEmotionAnalyzableNote(note: HataEmotionAnalysisInputNote): boolean {
	if (!Number.isFinite(Date.parse(note.createdAt))) return false;
	return `${note.text ?? ''} ${note.cw ?? ''}`.trim().length > 0;
}

export function countHataEmotionAnalyzableNotes(notes: readonly HataEmotionAnalysisInputNote[]): number {
	return notes.reduce((count, note) => count + (isHataEmotionAnalyzableNote(note) ? 1 : 0), 0);
}

/** 日付・曜日・時間の集計に使う、UTC からの分単位の差。画面側が端末時刻から明示して渡す。 */
export type HataEmotionAnalysisOptions = {
	timezoneOffsetMinutes: number;
};

export type HataEmotionPolarity = 'positive' | 'negative' | 'neutral';
export type HataEmotionLevel = 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative';

export const HATA_EMOTION_LEVELS: readonly HataEmotionLevel[] = ['strong_positive', 'positive', 'neutral', 'negative', 'strong_negative'];

export type HataEmotionEvidence = {
	label: string;
	polarity: HataEmotionPolarity;
	count: number;
	weight: number;
};

/** 感情の軸ごとの集計。ラベルは固定語彙なので保存してよい。 */
export type HataEmotionAxisSummary = {
	axis: HataEmotionAxis;
	polarity: 'positive' | 'negative';
	/** その軸の語が出た投稿数 */
	count: number;
	/** その軸の語の重みの合計 */
	weight: number;
	/** その軸の語が出た投稿の平均スコア */
	averageScore: number;
};

export type HataEmotionActivity = {
	activeDays: number;
	longestStreakDays: number;
	averagePostsPerActiveDay: number;
	/** 連続する投稿の間隔の中央値(分)。⚠️平均は徹夜や長期離脱1回で壊れるので中央値を使う。 */
	medianIntervalMinutes: number;
	busiestHour: number;
	busiestWeekday: number;
	/** 0〜5時の投稿の割合 */
	nightPostRate: number;
	/** 6〜11時の投稿の割合 */
	morningPostRate: number;
};

export type HataEmotionVocabulary = {
	averageSentenceLength: number;
	/** 異なり語数 / 延べ語数。高いほど語彙が散らばっている。 */
	uniqueTokenRatio: number;
	hashtagPostRate: number;
	mentionPostRate: number;
	urlPostRate: number;
	emojiPostRate: number;
	questionPostRate: number;
	exclamationPostRate: number;
};

export type HataEmotionEngagement = {
	byLevel: Array<{ level: HataEmotionLevel; count: number; averageReactions: number; averageReplies: number; averageRenotes: number }>;
	/** 平均リアクションが最も多かった話題。⚠️固定の話題名なので保存してよい。件数が少ない話題は選ばない。 */
	topTopicByReactions: string | null;
};

/** ⚠️本文由来の語。端末内の表示だけに使い、保存用の型へは絶対に入れない。 */
export type HataEmotionFrequentWord = { word: string; count: number };

export type HataEmotionAnalysisResult = {
	format: typeof HATA_EMOTION_ANALYSIS_FORMAT;
	formatVersion: typeof HATA_EMOTION_ANALYSIS_VERSION;
	timezoneOffsetMinutes: number;
	input: { received: number; accepted: number; skippedInvalidTimestamp: number; skippedNoAnalyzableText: number };
	overview: {
		averageScore: number;
		emotionalPostRate: number;
		levels: Record<HataEmotionLevel, number>;
	};
	evidence: {
		phrases: HataEmotionEvidence[];
		shortcodes: HataEmotionEvidence[];
		negations: HataEmotionEvidence[];
		excludedContexts: HataEmotionEvidence[];
		intensifiers: HataEmotionEvidence[];
	};
	emotions: HataEmotionAxisSummary[];
	activity: HataEmotionActivity;
	vocabulary: HataEmotionVocabulary;
	engagement: HataEmotionEngagement;
	posts: Array<{
		id: string;
		createdAt: string;
		date: string;
		weekday: number;
		hour: number;
		score: number;
		level: HataEmotionLevel;
		topics: string[];
		axes: HataEmotionAxis[];
		evidence: { phrases: number; shortcodes: number; negations: number; excludedContexts: number; intensifiers: number };
		engagement: { reactions: number; replies: number; renotes: number; hasMedia: boolean };
	}>;
	/** ⚠️保存しない。端末内の表示専用。 */
	frequentWords: HataEmotionFrequentWord[];
	daily: Array<{ date: string; count: number; averageScore: number }>;
	weekly: Array<{ weekday: number; count: number; averageScore: number }>;
	hourly: Array<{ hour: number; count: number; averageScore: number }>;
	topics: Array<{ topic: string; count: number; averageScore: number }>;
	posting: { averageTextLength: number; averageReactions: number; averageReplies: number; averageRenotes: number; mediaPostRate: number; cwPostRate: number };
};

/** 画面からそのまま渡せる、保存対象となる分析範囲。投稿単位の情報は受け取らない。 */
export type HataEmotionAnalysisSaveScope = {
	mode: 'latest' | 'period';
	periodDays?: number;
	noteLimit: number;
	visibility: 'publicHome' | 'followers' | 'all';
	includeReplies: boolean;
	includeCw: boolean;
	timezoneOffsetMinutes: number;
};

export type HataEmotionAnalysisStoredResult = Pick<HataEmotionAnalysisResult,
	| 'format'
	| 'formatVersion'
	| 'timezoneOffsetMinutes'
	| 'input'
	| 'overview'
	| 'evidence'
	| 'emotions'
	| 'activity'
	| 'vocabulary'
	| 'engagement'
	| 'daily'
	| 'weekly'
	| 'hourly'
	| 'topics'
	| 'posting'
>;

/**
 * 保存用の型は、分析中だけ必要な posts・frequentWords を意図的に持たない。
 * API の hata/hatask/emotion-analysis/create へそのまま渡せる。
 */
export type HataEmotionAnalysisSavePayload = {
	analysisVersion: typeof HATA_EMOTION_ANALYSIS_ANALYSIS_VERSION;
	lexiconVersion: typeof HATA_EMOTION_ANALYSIS_LEXICON_VERSION;
	scope: HataEmotionAnalysisSaveScope;
	source: { kind: 'localAccountNotes'; fetchedNoteCount: number; analyzedNoteCount: number };
	summary: { averageScore: number; emotionalPostRate: number; levels: Record<HataEmotionLevel, number> };
	result: HataEmotionAnalysisStoredResult;
};

type EvidenceBucket = Record<string, HataEmotionEvidence>;
type InternalPost = HataEmotionAnalysisResult['posts'][number] & { textLength: number; hasCw: boolean; timestamp: number };

/**
 * スコアの飽和定数。
 * ⚠️1.x は (positive - negative) / (positive + negative) の「比率」だったため、
 *   「嬉しい」1回と5回が同じ点数になり、強い投稿と弱い投稿を区別できなかった。
 *   2.0.0 では net/(|net|+K) にして強度を残す。K を小さくすると飽和が早い。
 */
const SCORE_SATURATION = 3;

function finiteNonNegative(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function round(value: number): number {
	return Number(value.toFixed(6));
}

function wholeNonNegative(value: number): number {
	return Math.floor(finiteNonNegative(value));
}

function noteLimit(value: number): number {
	return Math.max(1, Math.min(100_000, wholeNonNegative(value)));
}

function periodDays(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;
	return Math.max(1, Math.min(3650, wholeNonNegative(value)));
}

function normalizeTimezoneOffset(value: number): number {
	return Math.max(-840, Math.min(840, Math.trunc(Number.isFinite(value) ? value : 0)));
}

function addEvidence(bucket: EvidenceBucket, label: string, polarity: HataEmotionPolarity, weight: number): void {
	if (Object.prototype.hasOwnProperty.call(bucket, label)) {
		const old = bucket[label];
		bucket[label] = { ...old, count: old.count + 1, weight: round(old.weight + weight) };
		return;
	}
	bucket[label] = { label, polarity, count: 1, weight: round(weight) };
}

function orderedEvidence(bucket: EvidenceBucket): HataEmotionEvidence[] {
	return Object.values(bucket).sort((a, b) => b.count - a.count || b.weight - a.weight || a.label.localeCompare(b.label, 'ja'));
}

function isExcluded(phrase: string, text: string, start: number): boolean {
	const nearby = text.slice(Math.max(0, start - 4), start + phrase.length + 4);
	if ((EXCLUDED_CONTEXTS[phrase] ?? []).some(context => nearby.includes(context))) return true;
	if (phrase === '死') return !(/^死に|^死ぬ|^死ん|^死の|^死ね|^死んだ/u.test(text.slice(start, start + 4)) || start === 0 || /[\s。、！!？?\n]/u.test(text[start - 1] ?? ''));
	if (phrase === '草') return !/[一-龠]/u.test(text[start + 1] ?? '');
	if (phrase === '笑') return text[start - 1] === '(' || text[start - 1] === '（' || start === text.length - 1 || /[）\)。！!]/u.test(text[start + 1] ?? '');
	return false;
}

/**
 * ⚠️閾値は SCORE_SATURATION=3 を前提に決めてある。片方を変えたら両方見直すこと。
 *   重み2.5の語が1つ → 0.45(positive) / 重み4の語が1つ → 0.57(strong)
 *   → 「強い」は、重い語が1つ、あるいは中くらいの語が2つ以上そろった投稿を指す。
 */
function classify(score: number): HataEmotionLevel {
	if (score > 0.55) return 'strong_positive';
	if (score > 0.05) return 'positive';
	if (score < -0.55) return 'strong_negative';
	if (score < -0.05) return 'negative';
	return 'neutral';
}

function matchingTopics(text: string): string[] {
	const lower = text.toLocaleLowerCase('en-US');
	return Object.entries(TOPICS).filter(([, phrases]) => phrases.some(phrase => lower.includes(phrase.toLocaleLowerCase('en-US')))).map(([topic]) => topic);
}

/** 語彙の集計に使う、助詞や定型語。⚠️頻出語の一覧が「の・こと・する」で埋まるのを防ぐ。 */
const TOKEN_STOPWORDS = new Set([
	'こと', 'もの', 'ため', 'とき', 'これ', 'それ', 'あれ', 'ここ', 'そこ', 'どこ', 'ひと', 'かんじ',
	'today', 'https', 'http', 'www', 'com', 'the', 'and', 'for', 'you', 'that', 'this', 'with',
	'です', 'ます', 'した', 'して', 'ない', 'ある', 'いる', 'なる', 'れる', 'られ', 'から', 'まで',
]);

/**
 * 形態素解析を使わずに「よく使う語」を拾う。
 * ⚠️厳密な分かち書きではない。カタカナ語・漢字語・英単語のまとまりだけを見る近似。
 * ⚠️戻り値は本文由来なので、保存用の型へ入れないこと。
 */
function extractTokens(text: string): string[] {
	const cleaned = text
		.replace(/https?:\/\/\S+/gu, ' ')
		.replace(/:[a-zA-Z0-9_]+(@[^:\s]*)?:/gu, ' ')
		.replace(/[@#][^\s]+/gu, ' ');
	const tokens = cleaned.match(/[ァ-ヶー]{3,}|[一-龠]{2,}|[a-zA-Z]{3,}/gu) ?? [];
	return tokens
		.map(token => token.toLocaleLowerCase('en-US'))
		.filter(token => !TOKEN_STOPWORDS.has(token));
}

function median(values: readonly number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? round((sorted[middle - 1] + sorted[middle]) / 2) : round(sorted[middle]);
}

function longestStreak(dates: readonly string[]): number {
	if (dates.length === 0) return 0;
	const sorted = [...new Set(dates)].sort();
	let longest = 1;
	let current = 1;
	for (let index = 1; index < sorted.length; index++) {
		const previous = Date.parse(`${sorted[index - 1]}T00:00:00.000Z`);
		const today = Date.parse(`${sorted[index]}T00:00:00.000Z`);
		if (today - previous === 86_400_000) {
			current++;
			longest = Math.max(longest, current);
		} else {
			current = 1;
		}
	}
	return longest;
}

function addShortcodes(text: string, positive: EvidenceBucket, negative: EvidenceBucket): { positive: number; negative: number } {
	let positiveScore = 0;
	let negativeScore = 0;
	for (const raw of text.match(/:([a-zA-Z0-9_]+)(@[^:]*)?:/gu) ?? []) {
		const name = raw.replace(/^:|:$/gu, '').replace(/@.*$/u, '').toLocaleLowerCase('en-US');
		if (POSITIVE_SHORTCODES.some(token => name.includes(token))) {
			positiveScore += 1.5;
			addEvidence(positive, `:${name}:`, 'positive', 1.5);
		}
		if (NEGATIVE_SHORTCODES.some(token => name.includes(token))) {
			negativeScore += 1.5;
			addEvidence(negative, `:${name}:`, 'negative', 1.5);
		}
	}
	return { positive: positiveScore, negative: negativeScore };
}

/**
 * 辞書の語を本文から拾い、軸ごとの重みへ振り分ける。
 * ⚠️長い語から先に見て、使った位置を塞ぐ。「大好き」を「好き」と二重に数えないため。
 */
function addLexiconMatches(
	text: string,
	evidence: EvidenceBucket,
	excluded: EvidenceBucket,
	axisWeights: Record<HataEmotionAxis, number>,
): { positive: number; negative: number; matches: number } {
	let positive = 0;
	let negative = 0;
	let matches = 0;
	const lower = text.toLocaleLowerCase('en-US');
	const used = new Set<number>();
	const entries = Object.entries(HATA_EMOTION_LEXICON).sort(([a], [b]) => b.length - a.length || a.localeCompare(b, 'ja'));
	for (const [phrase, [axis, weight]] of entries) {
		const needle = phrase.toLocaleLowerCase('en-US');
		for (let start = lower.indexOf(needle); start !== -1; start = lower.indexOf(needle, start + 1)) {
			const positions = Array.from({ length: needle.length }, (_, offset) => start + offset);
			if (positions.some(position => used.has(position))) continue;
			if (isExcluded(phrase, text, start)) {
				addEvidence(excluded, phrase, 'neutral', 0);
				continue;
			}
			positions.forEach(position => used.add(position));
			const polarity = HATA_EMOTION_AXIS_POLARITY[axis];
			if (polarity === 'positive') positive += weight; else negative += weight;
			axisWeights[axis] = round(axisWeights[axis] + weight);
			matches++;
			addEvidence(evidence, phrase, polarity, weight);
		}
	}
	return { positive, negative, matches };
}

/**
 * 受け取った本文はこの関数の実行中だけで使う。
 * 返り値のうち保存してよいのは HataEmotionAnalysisStoredResult に含まれる項目だけ。
 */
export function analyzeHataEmotion(notes: readonly HataEmotionAnalysisInputNote[], options: HataEmotionAnalysisOptions): HataEmotionAnalysisResult {
	const phraseEvidence: EvidenceBucket = {};
	const shortcodeEvidence: EvidenceBucket = {};
	const negationEvidence: EvidenceBucket = {};
	const excludedEvidence: EvidenceBucket = {};
	const intensifierEvidence: EvidenceBucket = {};
	const axisTotals: Record<HataEmotionAxis, number> = Object.fromEntries(HATA_EMOTION_AXES.map(axis => [axis, 0])) as Record<HataEmotionAxis, number>;
	const tokenCounts = new Map<string, number>();
	let totalTokens = 0;
	let sentenceCount = 0;
	let sentenceCharacters = 0;
	let hashtagPosts = 0;
	let mentionPosts = 0;
	let urlPosts = 0;
	let emojiPosts = 0;
	let questionPosts = 0;
	let exclamationPosts = 0;
	let skippedInvalidTimestamp = 0;
	let skippedNoAnalyzableText = 0;
	const timezoneOffsetMinutes = normalizeTimezoneOffset(options.timezoneOffsetMinutes);

	const valid = notes.map((note, index) => ({ note, index, timestamp: Date.parse(note.createdAt) })).filter(({ note, timestamp }) => {
		if (!Number.isFinite(timestamp)) {
			skippedInvalidTimestamp++;
			return false;
		}
		if (`${note.text ?? ''} ${note.cw ?? ''}`.trim().length === 0) {
			skippedNoAnalyzableText++;
			return false;
		}
		return true;
	}).sort((a, b) => a.timestamp - b.timestamp || a.note.id.localeCompare(b.note.id, 'en') || a.index - b.index);

	const posts: InternalPost[] = valid.map(({ note, timestamp }) => {
		const body = `${note.text ?? ''} ${note.cw ?? ''}`;
		const localPhrases: EvidenceBucket = {};
		const localExcluded: EvidenceBucket = {};
		const localAxes: Record<HataEmotionAxis, number> = Object.fromEntries(HATA_EMOTION_AXES.map(axis => [axis, 0])) as Record<HataEmotionAxis, number>;
		const lexicon = addLexiconMatches(body, localPhrases, localExcluded, localAxes);
		let positive = lexicon.positive;
		let negative = lexicon.negative;
		for (const item of orderedEvidence(localPhrases)) for (let i = 0; i < item.count; i++) addEvidence(phraseEvidence, item.label, item.polarity, item.weight / item.count);
		for (const item of orderedEvidence(localExcluded)) for (let i = 0; i < item.count; i++) addEvidence(excludedEvidence, item.label, 'neutral', 0);

		const localShortcodePositive: EvidenceBucket = {};
		const localShortcodeNegative: EvidenceBucket = {};
		const shortcode = addShortcodes(body, localShortcodePositive, localShortcodeNegative);
		positive += shortcode.positive;
		negative += shortcode.negative;
		for (const item of [...orderedEvidence(localShortcodePositive), ...orderedEvidence(localShortcodeNegative)]) for (let i = 0; i < item.count; i++) addEvidence(shortcodeEvidence, item.label, item.polarity, item.weight / item.count);

		let localNegations = 0;
		for (const rule of NEGATION_RULES) {
			if (!rule.regex.test(body)) continue;
			positive = Math.max(0, positive + rule.positiveDelta);
			negative = Math.max(0, negative + rule.negativeDelta);
			localNegations++;
			addEvidence(negationEvidence, rule.label, rule.positiveDelta > 0 ? 'positive' : 'negative', Math.abs(rule.positiveDelta) + Math.abs(rule.negativeDelta));
		}

		const localIntensifiers = INTENSIFIERS.filter(word => body.includes(word));
		const hasDiminisher = DIMINISHERS.some(word => body.includes(word));
		// ⚠️強調は3語まで。弱める語があれば最後に掛ける(「ちょっと嬉しい」を強く出さない)。
		const multiplier = (1 + Math.min(localIntensifiers.length, 3) * 0.15) * (hasDiminisher ? 0.7 : 1);
		for (const word of localIntensifiers) addEvidence(intensifierEvidence, word, 'neutral', round(Math.abs(multiplier - 1)));

		const net = (positive - negative) * multiplier;
		const score = round(net / (Math.abs(net) + SCORE_SATURATION));

		for (const axis of HATA_EMOTION_AXES) axisTotals[axis] = round(axisTotals[axis] + localAxes[axis]);

		for (const token of extractTokens(body)) {
			tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
			totalTokens++;
		}
		const sentences = body.split(/[。．.!！?？\n]+/u).map(part => part.trim()).filter(part => part.length > 0);
		sentenceCount += sentences.length;
		sentenceCharacters += sentences.reduce((sum, sentence) => sum + sentence.length, 0);
		if (/#[^\s#]+/u.test(body)) hashtagPosts++;
		if (/@[a-zA-Z0-9_]/u.test(body)) mentionPosts++;
		if (/https?:\/\//u.test(body)) urlPosts++;
		if (/:[a-zA-Z0-9_]+(@[^:\s]*)?:/u.test(body) || /\p{Extended_Pictographic}/u.test(body)) emojiPosts++;
		if (/[?？]/u.test(body)) questionPosts++;
		if (/[!！]/u.test(body)) exclamationPosts++;

		const createdAt = new Date(timestamp);
		const localDate = new Date(timestamp + timezoneOffsetMinutes * 60_000);
		const phraseCount = Object.values(localPhrases).reduce((sum, item) => sum + item.count, 0);
		const shortcodeCount = Object.values(localShortcodePositive).reduce((sum, item) => sum + item.count, 0) + Object.values(localShortcodeNegative).reduce((sum, item) => sum + item.count, 0);
		return {
			id: note.id,
			createdAt: createdAt.toISOString(),
			date: localDate.toISOString().slice(0, 10),
			weekday: localDate.getUTCDay(),
			hour: localDate.getUTCHours(),
			score,
			level: classify(score),
			topics: matchingTopics(body),
			axes: HATA_EMOTION_AXES.filter(axis => localAxes[axis] > 0),
			evidence: { phrases: phraseCount, shortcodes: shortcodeCount, negations: localNegations, excludedContexts: Object.values(localExcluded).reduce((sum, item) => sum + item.count, 0), intensifiers: localIntensifiers.length },
			engagement: { reactions: finiteNonNegative(note.reactionCount), replies: finiteNonNegative(note.repliesCount), renotes: finiteNonNegative(note.renoteCount), hasMedia: (note.files?.length ?? 0) > 0 },
			textLength: (note.text ?? '').length,
			hasCw: Boolean(note.cw),
			timestamp,
		};
	});

	const count = posts.length;
	const average = (values: readonly number[]): number => values.length === 0 ? 0 : round(values.reduce((sum, value) => sum + value, 0) / values.length);
	const rate = (matched: number): number => count === 0 ? 0 : round(matched / count);
	const by = <T extends string | number>(keys: readonly T[], keyOf: (post: InternalPost) => T, valueOf: (post: InternalPost) => number) => keys.map(key => {
		const selected = posts.filter(post => keyOf(post) === key);
		return { key, count: selected.length, averageScore: average(selected.map(valueOf)) };
	});
	const levels: Record<HataEmotionLevel, number> = { strong_positive: 0, positive: 0, neutral: 0, negative: 0, strong_negative: 0 };
	posts.forEach(post => levels[post.level]++);
	const dates = [...new Set(posts.map(post => post.date))];

	const hourly = by(Array.from({ length: 24 }, (_, hour) => hour), post => post.hour, post => post.score);
	const weekly = by([0, 1, 2, 3, 4, 5, 6], post => post.weekday, post => post.score);
	const topicSummaries = Object.keys(TOPICS).map(topic => {
		const selected = posts.filter(post => post.topics.includes(topic));
		return { topic, count: selected.length, averageScore: average(selected.map(post => post.score)) };
	});

	const intervals: number[] = [];
	for (let index = 1; index < posts.length; index++) intervals.push((posts[index].timestamp - posts[index - 1].timestamp) / 60_000);

	// ⚠️件数が少ない話題は平均が跳ねるので、3件以上のものからだけ選ぶ。
	const topTopic = topicSummaries
		.filter(item => item.count >= 3)
		.map(item => ({ topic: item.topic, averageReactions: average(posts.filter(post => post.topics.includes(item.topic)).map(post => post.engagement.reactions)) }))
		.sort((a, b) => b.averageReactions - a.averageReactions || a.topic.localeCompare(b.topic, 'ja'))[0] ?? null;

	const busiest = <T extends number>(groups: ReadonlyArray<{ key: T; count: number }>): T => groups.reduce((best, item) => item.count > best.count ? item : best, groups[0] ?? { key: 0 as T, count: 0 }).key;

	return {
		format: HATA_EMOTION_ANALYSIS_FORMAT,
		formatVersion: HATA_EMOTION_ANALYSIS_VERSION,
		timezoneOffsetMinutes,
		input: { received: notes.length, accepted: count, skippedInvalidTimestamp, skippedNoAnalyzableText },
		overview: { averageScore: average(posts.map(post => post.score)), emotionalPostRate: rate(posts.filter(post => post.evidence.phrases + post.evidence.shortcodes > 0).length), levels },
		evidence: { phrases: orderedEvidence(phraseEvidence), shortcodes: orderedEvidence(shortcodeEvidence), negations: orderedEvidence(negationEvidence), excludedContexts: orderedEvidence(excludedEvidence), intensifiers: orderedEvidence(intensifierEvidence) },
		emotions: HATA_EMOTION_AXES.map(axis => {
			const selected = posts.filter(post => post.axes.includes(axis));
			return {
				axis,
				polarity: HATA_EMOTION_AXIS_POLARITY[axis],
				count: selected.length,
				weight: axisTotals[axis],
				averageScore: average(selected.map(post => post.score)),
			};
		}),
		activity: {
			activeDays: dates.length,
			longestStreakDays: longestStreak(dates),
			averagePostsPerActiveDay: dates.length === 0 ? 0 : round(count / dates.length),
			medianIntervalMinutes: median(intervals),
			busiestHour: busiest(hourly),
			busiestWeekday: busiest(weekly),
			nightPostRate: rate(posts.filter(post => post.hour <= 5).length),
			morningPostRate: rate(posts.filter(post => post.hour >= 6 && post.hour <= 11).length),
		},
		vocabulary: {
			averageSentenceLength: sentenceCount === 0 ? 0 : round(sentenceCharacters / sentenceCount),
			uniqueTokenRatio: totalTokens === 0 ? 0 : round(tokenCounts.size / totalTokens),
			hashtagPostRate: rate(hashtagPosts),
			mentionPostRate: rate(mentionPosts),
			urlPostRate: rate(urlPosts),
			emojiPostRate: rate(emojiPosts),
			questionPostRate: rate(questionPosts),
			exclamationPostRate: rate(exclamationPosts),
		},
		engagement: {
			byLevel: HATA_EMOTION_LEVELS.map(level => {
				const selected = posts.filter(post => post.level === level);
				return {
					level,
					count: selected.length,
					averageReactions: average(selected.map(post => post.engagement.reactions)),
					averageReplies: average(selected.map(post => post.engagement.replies)),
					averageRenotes: average(selected.map(post => post.engagement.renotes)),
				};
			}),
			topTopicByReactions: topTopic?.topic ?? null,
		},
		posts: posts.map(({ textLength: _textLength, hasCw: _hasCw, timestamp: _timestamp, ...post }) => post),
		frequentWords: [...tokenCounts.entries()]
			.map(([word, wordCount]) => ({ word, count: wordCount }))
			.filter(item => item.count > 1)
			.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'ja'))
			.slice(0, HATA_EMOTION_FREQUENT_WORD_LIMIT),
		daily: by(dates, post => post.date, post => post.score).map(({ key, count: dayCount, averageScore }) => ({ date: key, count: dayCount, averageScore })),
		weekly: weekly.map(({ key, count: weekdayCount, averageScore }) => ({ weekday: key, count: weekdayCount, averageScore })),
		hourly: hourly.map(({ key, count: hourCount, averageScore }) => ({ hour: key, count: hourCount, averageScore })),
		topics: topicSummaries,
		posting: {
			averageTextLength: average(posts.map(post => post.textLength)),
			averageReactions: average(posts.map(post => post.engagement.reactions)),
			averageReplies: average(posts.map(post => post.engagement.replies)),
			averageRenotes: average(posts.map(post => post.engagement.renotes)),
			mediaPostRate: rate(posts.filter(post => post.engagement.hasMedia).length),
			cwPostRate: rate(posts.filter(post => post.hasCw).length),
		},
	};
}

/**
 * 端末内の分析結果を、保存してよい集計値だけへ変換する。
 * posts と frequentWords はこの時点で捨て、投稿ID・投稿日時・本文を
 * result/summary/source/scope のいずれにも写さない。
 * ⚠️証跡は backend の maxItems(256) を超えると保存ごと弾かれるので必ず切り詰める。
 */
export function buildHataEmotionAnalysisSavePayload(
	analysis: HataEmotionAnalysisResult,
	scope: HataEmotionAnalysisSaveScope,
): HataEmotionAnalysisSavePayload {
	const { input, overview, evidence, emotions, activity, vocabulary, engagement, daily, weekly, hourly, topics, posting } = analysis;
	const limit = (items: readonly HataEmotionEvidence[]): HataEmotionEvidence[] => items.slice(0, HATA_EMOTION_EVIDENCE_SAVE_LIMIT).map(item => ({ ...item }));
	return {
		analysisVersion: HATA_EMOTION_ANALYSIS_ANALYSIS_VERSION,
		lexiconVersion: HATA_EMOTION_ANALYSIS_LEXICON_VERSION,
		scope: {
			mode: scope.mode,
			...(scope.mode === 'period' ? { periodDays: periodDays(scope.periodDays) ?? 1 } : {}),
			noteLimit: noteLimit(scope.noteLimit),
			visibility: scope.visibility,
			includeReplies: scope.includeReplies === true,
			includeCw: scope.includeCw === true,
			timezoneOffsetMinutes: analysis.timezoneOffsetMinutes,
		},
		source: {
			kind: 'localAccountNotes',
			fetchedNoteCount: input.received,
			analyzedNoteCount: input.accepted,
		},
		summary: {
			averageScore: overview.averageScore,
			emotionalPostRate: overview.emotionalPostRate,
			levels: { ...overview.levels },
		},
		result: {
			format: analysis.format,
			formatVersion: analysis.formatVersion,
			timezoneOffsetMinutes: analysis.timezoneOffsetMinutes,
			input: { ...input },
			overview: { ...overview, levels: { ...overview.levels } },
			evidence: {
				phrases: limit(evidence.phrases),
				shortcodes: limit(evidence.shortcodes),
				negations: limit(evidence.negations),
				excludedContexts: limit(evidence.excludedContexts),
				intensifiers: limit(evidence.intensifiers),
			},
			emotions: emotions.map(item => ({ ...item })),
			activity: { ...activity },
			vocabulary: { ...vocabulary },
			engagement: {
				byLevel: engagement.byLevel.map(item => ({ ...item })),
				topTopicByReactions: engagement.topTopicByReactions,
			},
			daily: daily.map(item => ({ ...item })),
			weekly: weekly.map(item => ({ ...item })),
			hourly: hourly.map(item => ({ ...item })),
			topics: topics.map(item => ({ ...item })),
			posting: { ...posting },
		},
	};
}
