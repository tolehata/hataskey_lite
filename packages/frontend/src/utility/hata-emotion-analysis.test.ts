/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	analyzeHataEmotion,
	buildHataEmotionAnalysisSavePayload,
	canStartHatalyzeAnalysis,
	classifyHatalyzeFailure,
	countHataEmotionAnalyzableNotes,
	getHatalyzeCooldownUntil,
	hatalyzeCooldownStorageKey,
	hatalyzeNoticeStorageKey,
	hatalyzeNoticeSyncedStorageKey,
	HATA_EMOTION_ANALYSIS_ANALYSIS_VERSION,
	HATA_EMOTION_ANALYSIS_FORMAT,
	HATA_EMOTION_ANALYSIS_LEXICON_VERSION,
	HATA_EMOTION_ANALYSIS_MIN_NOTES,
	HATA_EMOTION_ANALYSIS_VERSION,
	HATA_EMOTION_AXES,
	HATA_EMOTION_EVIDENCE_SAVE_LIMIT,
} from './hata-emotion-analysis.js';
import { HATA_EMOTION_LEXICON } from './hata-emotion-lexicon.js';

const frontendRoot = resolve(process.cwd());
const readFrontendFile = (path: string) => readFileSync(resolve(frontendRoot, path), 'utf8');

describe('Hataskey の説明可能な感情分析', () => {
	test('モックの対話型UIと削除メニューを本体機能へ結線する', () => {
		const page = readFrontendFile('src/pages/hata-emotion-analysis.vue');
		expect(page).toContain('<strong :class="$style.wordmark">HATAlyze</strong>');
		expect(page).not.toContain('$style.hataskeyLabel');
		expect(page).not.toContain('>Hataskey</span>');
		expect(page).toContain('font-family: \'HataRighteous\'');
		expect(page).toContain('url(\'/client-assets/Righteous-Regular.woff2\')');
		expect(page).toContain('const analysisStep = ref<1 | 2 | 3>(1)');
		expect(page).toContain('v-if="analysisStep === 1"');
		expect(page).toContain('v-else-if="analysisStep === 2"');
		expect(page).toContain('key="review"');
		expect(page).toContain('function openResultMenu(item: AnalysisRecord, event: MouseEvent)');
		expect(page).toContain('danger: true');
		expect(page).toContain('misskeyApi(\'hata/hatask/emotion-analysis/delete\'');
		expect(page).toContain('selected.value = { ...selected.value, id: null }');
		expect(page).toContain('deletedResultCreatedAt.value = selected.value.createdAt');
		expect(page).toContain('copy.deletedFromHistory');
		expect(page).toContain('copy.historyNotSaved');
		expect(page).toContain('@media (prefers-reduced-motion: reduce)');
	});

	test('HATAlyzeの必要件数は有効な日時と分析対象テキストを持つ10件で判定する', () => {
		const notes = Array.from({ length: HATA_EMOTION_ANALYSIS_MIN_NOTES }, (_, index) => ({ id: String(index), createdAt: `2026-08-24T00:00:${String(index).padStart(2, '0')}.000Z`, text: '記録' }));
		expect(countHataEmotionAnalyzableNotes(notes.slice(0, 9))).toBe(9);
		expect(countHataEmotionAnalyzableNotes(notes)).toBe(10);
		expect(countHataEmotionAnalyzableNotes([...notes, { id: 'invalid', createdAt: 'not-a-date', text: '最高' }])).toBe(10);
		expect(countHataEmotionAnalyzableNotes([...notes.slice(0, 9), { id: 'media-only', createdAt: '2026-08-24T01:00:00.000Z', text: '', files: [{}] }])).toBe(9);
		expect(countHataEmotionAnalyzableNotes([...notes.slice(0, 9), { id: 'cw', createdAt: '2026-08-24T01:00:00.000Z', text: '', cw: '内容警告' }])).toBe(10);
	});

	test('上流APIの制限とHATAlyze自身の10分制限を混同しない', () => {
		const sharedLimit = { code: 'RATE_LIMIT_EXCEEDED', info: { resetMs: 2_000_000 } };
		expect(classifyHatalyzeFailure(sharedLimit, 'history')).toBe('upstreamRateLimit');
		expect(classifyHatalyzeFailure(sharedLimit, 'notes')).toBe('upstreamRateLimit');
		expect(classifyHatalyzeFailure(sharedLimit, 'create')).toBe('upstreamRateLimit');

		const ownLimit = { code: 'HATALYZE_RATE_LIMIT_EXCEEDED', info: { resetMs: 2_000_000 } };
		expect(classifyHatalyzeFailure(ownLimit, 'create')).toBe('hatalyzeCooldown');
		expect(getHatalyzeCooldownUntil(ownLimit, 1_000_000)).toBe(2_000_000);
	});

	test('注意書き確認と待機時刻をアカウントごとに分離する', () => {
		expect(hatalyzeNoticeStorageKey('account-a')).toBe('hatalyzeNoticeAcceptedV1:account-a');
		expect(hatalyzeNoticeStorageKey('account-b')).not.toBe(hatalyzeNoticeStorageKey('account-a'));
		expect(hatalyzeNoticeSyncedStorageKey('account-a')).toBe('hatalyzeNoticeSyncedV1:account-a');
		expect(hatalyzeCooldownStorageKey('account-a')).toBe('hatalyzeCooldownV1:account-a');
		expect(hatalyzeCooldownStorageKey('account-b')).not.toBe(hatalyzeCooldownStorageKey('account-a'));
	});

	test('履歴APIの確認前・通信失敗後・待機中は分析を開始できない', () => {
		expect(canStartHatalyzeAnalysis({ accountId: 'account-a', serviceReady: false, submitting: false, waiting: false })).toBe(false);
		expect(canStartHatalyzeAnalysis({ accountId: 'account-a', serviceReady: true, submitting: false, waiting: true })).toBe(false);
		expect(canStartHatalyzeAnalysis({ accountId: 'account-a', serviceReady: true, submitting: true, waiting: false })).toBe(false);
		expect(canStartHatalyzeAnalysis({ accountId: null, serviceReady: true, submitting: false, waiting: false })).toBe(false);
		expect(canStartHatalyzeAnalysis({ accountId: 'account-a', serviceReady: true, submitting: false, waiting: false })).toBe(true);
	});

	test('投稿を時系列昇順にし、本文を残さずに根拠を集計する', () => {
		const result = analyzeHataEmotion([
			{ id: 'later', createdAt: '2026-08-24T13:00:00.000Z', text: '秘匿された本文。とても最高！ :happy:', reactionCount: 3, files: [{}] },
			{ id: 'earlier', createdAt: '2026-08-24T01:00:00.000Z', text: 'ご機嫌です。最高ではない。', cw: '補足', repliesCount: 2, renoteCount: 1 },
		], { timezoneOffsetMinutes: 0 });

		expect(result.format).toBe(HATA_EMOTION_ANALYSIS_FORMAT);
		expect(result.formatVersion).toBe(HATA_EMOTION_ANALYSIS_VERSION);
		expect(result.posts.map(post => post.id)).toEqual(['earlier', 'later']);
		expect(result.evidence.phrases).toContainEqual(expect.objectContaining({ label: '最高', polarity: 'positive', count: 2 }));
		expect(result.evidence.shortcodes).toContainEqual(expect.objectContaining({ label: ':happy:', polarity: 'positive', count: 1 }));
		expect(result.evidence.negations).toContainEqual(expect.objectContaining({ label: '肯定語の否定', polarity: 'negative', count: 1 }));
		expect(result.evidence.excludedContexts).toContainEqual(expect.objectContaining({ label: '嫌', count: 1 }));
		expect(result.evidence.intensifiers).toContainEqual(expect.objectContaining({ label: 'とても', count: 1 }));
		expect(JSON.stringify(result)).not.toContain('秘匿された本文');
		expect(JSON.stringify(result)).not.toContain('補足');
	});

	test('保存用データから本文・投稿ID・投稿日時・投稿単位配列を完全に除外する', () => {
		const result = analyzeHataEmotion([
			{ id: 'private-note-id', createdAt: '2026-08-24T09:08:07.000Z', text: '保存してはいけない本文。最高！' },
		], { timezoneOffsetMinutes: 540 });
		const payload = buildHataEmotionAnalysisSavePayload(result, { mode: 'period', periodDays: 30, noteLimit: 100, visibility: 'all', includeReplies: false, includeCw: true, timezoneOffsetMinutes: 540 });
		const serialized = JSON.stringify(payload);

		expect(payload.analysisVersion).toBe(HATA_EMOTION_ANALYSIS_ANALYSIS_VERSION);
		expect(payload.lexiconVersion).toBe(HATA_EMOTION_ANALYSIS_LEXICON_VERSION);
		expect(payload.scope).toEqual({ mode: 'period', periodDays: 30, noteLimit: 100, visibility: 'all', includeReplies: false, includeCw: true, timezoneOffsetMinutes: 540 });
		expect(payload.source).toEqual({ kind: 'localAccountNotes', fetchedNoteCount: 1, analyzedNoteCount: 1 });
		expect(serialized).not.toContain('保存してはいけない本文');
		expect(serialized).not.toContain('private-note-id');
		expect(serialized).not.toContain('2026-08-24T09:08:07.000Z');
		expect(serialized).not.toMatch(/"(?:posts|id|createdAt|text)"\s*:/u);
	});

	test('感情語としての死は検出し、複合語は除外し、:gg: を一意に肯定側へ数える', () => {
		const result = analyzeHataEmotion([
			{ id: 'emotion', createdAt: '2026-08-24T00:00:00.000Z', text: '死にたい :gg:' },
			{ id: 'compound', createdAt: '2026-08-24T01:00:00.000Z', text: '必死に死角を確認する' },
		], { timezoneOffsetMinutes: 0 });

		// 「死にたい」は「死」より強い信号なので、長い語を優先して1件だけ数える。
		expect(result.evidence.phrases).toContainEqual(expect.objectContaining({ label: '死にたい', polarity: 'negative', count: 1 }));
		expect(result.evidence.phrases).not.toContainEqual(expect.objectContaining({ label: '死' }));
		expect(result.evidence.excludedContexts).toContainEqual(expect.objectContaining({ label: '死', count: 2 }));
		expect(result.evidence.shortcodes).toContainEqual({ label: ':gg:', polarity: 'positive', count: 1, weight: 1.5 });
		expect(result.evidence.shortcodes).not.toContainEqual(expect.objectContaining({ label: ':gg:', polarity: 'negative' }));
	});

	test('日・曜日・時間・話題・投稿傾向を固定の形で返す', () => {
		const result = analyzeHataEmotion([
			{ id: 'tech', createdAt: '2026-08-23T23:00:00.000Z', text: 'TypeScript の開発が楽しい', reactionCount: 4 },
			{ id: 'life', createdAt: '2026-08-24T02:00:00.000Z', text: 'ごはんを食べた。疲れた', files: [{}] },
		], { timezoneOffsetMinutes: 0 });

		// 2.0.0 は比率ではなく強度を残す採点。楽しい(2.5) -> 2.5/(2.5+3) / 疲れた(2) -> -2/(2+3)
		expect(result.daily).toEqual([
			{ date: '2026-08-23', count: 1, averageScore: 0.454545 },
			{ date: '2026-08-24', count: 1, averageScore: -0.4 },
		]);
		expect(result.weekly).toHaveLength(7);
		expect(result.hourly).toHaveLength(24);
		expect(result.hourly[23]).toEqual({ hour: 23, count: 1, averageScore: 0.454545 });
		expect(result.topics).toContainEqual({ topic: '技術・開発', count: 1, averageScore: 0.454545 });
		expect(result.topics).toContainEqual({ topic: '日常・生活', count: 1, averageScore: -0.4 });
		expect(result.posting).toEqual({ averageTextLength: 14.5, averageReactions: 2, averageReplies: 0, averageRenotes: 0, mediaPostRate: 0.5, cwPostRate: 0 });
	});

	test('空入力と不正な日時でも比較可能な数値だけを返す', () => {
		const result = analyzeHataEmotion([{ id: 'bad-date', createdAt: 'not-a-date', text: '最高' }], { timezoneOffsetMinutes: 0 });

		expect(result.input).toEqual({ received: 1, accepted: 0, skippedInvalidTimestamp: 1, skippedNoAnalyzableText: 0 });
		expect(result.overview).toEqual({
			averageScore: 0,
			emotionalPostRate: 0,
			levels: { strong_positive: 0, positive: 0, neutral: 0, negative: 0, strong_negative: 0 },
		});
		expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
		expect(result).not.toHaveProperty('markov');
		expect(result).not.toHaveProperty('personalityType');
		expect(result).not.toHaveProperty('thinkingPatterns');
	});

	test('本文も内容警告も空の投稿を分析件数に含めない', () => {
		const result = analyzeHataEmotion([
			{ id: 'media-only', createdAt: '2026-08-24T01:00:00.000Z', text: '', cw: '', files: [{}] },
			{ id: 'text', createdAt: '2026-08-24T02:00:00.000Z', text: '記録' },
		], { timezoneOffsetMinutes: 0 });

		expect(result.input).toEqual({ received: 2, accepted: 1, skippedInvalidTimestamp: 0, skippedNoAnalyzableText: 1 });
		expect(result.posts.map(post => post.id)).toEqual(['text']);
	});

	test('明示された時差で日付・曜日・時間を集計し、保存範囲にも残す', () => {
		const result = analyzeHataEmotion([
			{ id: 'timezone', createdAt: '2026-08-23T23:30:00.000Z', text: '最高' },
		], { timezoneOffsetMinutes: 540 });
		const payload = buildHataEmotionAnalysisSavePayload(result, { mode: 'latest', noteLimit: 10, visibility: 'publicHome', includeReplies: true, includeCw: false, timezoneOffsetMinutes: -300 });

		expect(result.timezoneOffsetMinutes).toBe(540);
		expect(result.posts[0]).toMatchObject({ createdAt: '2026-08-23T23:30:00.000Z', date: '2026-08-24', weekday: 1, hour: 8 });
		expect(payload.scope.timezoneOffsetMinutes).toBe(540);
		expect(payload.result.timezoneOffsetMinutes).toBe(540);
	});
	test('強度を残して採点する: 同じ語が増えるほどスコアが伸びる', () => {
		const score = (text: string): number => analyzeHataEmotion(
			[{ id: 'n', createdAt: '2026-08-24T00:00:00.000Z', text }],
			{ timezoneOffsetMinutes: 0 },
		).posts[0].score;

		// 1.x の比率方式では 1回でも3回でも同じ点数になっていた。ここが劣化の中心だった。
		expect(score('最高')).toBeLessThan(score('最高 最高'));
		expect(score('最高 最高')).toBeLessThan(score('最高 最高 最高'));
		expect(score('最高')).toBeGreaterThan(0);
		expect(score('つらい')).toBeLessThan(0);
		// 飽和するので -1..1 を越えない
		expect(score('最高 最高 最高 最高 最高 最高 最高 最高')).toBeLessThanOrEqual(1);
	});

	test('弱める語は強調より後に効く', () => {
		const post = (text: string) => analyzeHataEmotion([{ id: 'n', createdAt: '2026-08-24T00:00:00.000Z', text }], { timezoneOffsetMinutes: 0 }).posts[0];

		expect(post('ちょっと嬉しい').score).toBeLessThan(post('嬉しい').score);
		expect(post('嬉しい').score).toBeLessThan(post('めっちゃ嬉しい').score);
	});

	test('感情を8つの軸へ振り分け、軸ごとの件数と重みを返す', () => {
		const result = analyzeHataEmotion([
			{ id: 'joy', createdAt: '2026-08-24T00:00:00.000Z', text: '合格した！最高！' },
			{ id: 'anger', createdAt: '2026-08-24T01:00:00.000Z', text: '理不尽でイライラする' },
			{ id: 'thanks', createdAt: '2026-08-24T02:00:00.000Z', text: 'ありがとう、助かった' },
		], { timezoneOffsetMinutes: 0 });

		expect(result.emotions.map(item => item.axis)).toEqual([...HATA_EMOTION_AXES]);
		const axis = (name: string) => result.emotions.find(item => item.axis === name);
		expect(axis('joy')?.count).toBe(1);
		expect(axis('joy')?.polarity).toBe('positive');
		expect(axis('anger')?.count).toBe(1);
		expect(axis('anger')?.polarity).toBe('negative');
		expect(axis('gratitude')?.count).toBe(1);
		expect(axis('sadness')?.count).toBe(0);
		expect(axis('joy')?.weight).toBeGreaterThan(0);
	});

	test('活動と語彙の傾向を数値だけで返す', () => {
		const result = analyzeHataEmotion([
			{ id: 'a', createdAt: '2026-08-22T01:00:00.000Z', text: '#タグ つきの投稿 https://example.com' },
			{ id: 'b', createdAt: '2026-08-23T02:00:00.000Z', text: 'これは質問ですか？' },
			{ id: 'c', createdAt: '2026-08-24T03:00:00.000Z', text: '@someone へ返信！' },
		], { timezoneOffsetMinutes: 0 });

		expect(result.activity.activeDays).toBe(3);
		expect(result.activity.longestStreakDays).toBe(3);
		expect(result.activity.averagePostsPerActiveDay).toBe(1);
		expect(result.activity.medianIntervalMinutes).toBeGreaterThan(0);
		expect(result.vocabulary.hashtagPostRate).toBeCloseTo(1 / 3, 5);
		expect(result.vocabulary.urlPostRate).toBeCloseTo(1 / 3, 5);
		expect(result.vocabulary.mentionPostRate).toBeCloseTo(1 / 3, 5);
		expect(result.vocabulary.questionPostRate).toBeCloseTo(1 / 3, 5);
		expect(result.vocabulary.exclamationPostRate).toBeCloseTo(1 / 3, 5);
		expect(result.vocabulary.uniqueTokenRatio).toBeGreaterThan(0);
		expect(result.vocabulary.uniqueTokenRatio).toBeLessThanOrEqual(1);
	});

	test('頻出語は端末内にだけ持ち、保存用データへ出さない', () => {
		const notes = Array.from({ length: 3 }, (_, index) => ({
			id: `n${index}`,
			createdAt: `2026-08-2${index + 2}T00:00:00.000Z`,
			text: 'ラーメンを食べた。ラーメンは最高',
		}));
		const result = analyzeHataEmotion(notes, { timezoneOffsetMinutes: 0 });
		const payload = buildHataEmotionAnalysisSavePayload(result, { mode: 'latest', noteLimit: 10, visibility: 'all', includeReplies: false, includeCw: true, timezoneOffsetMinutes: 0 });

		// 端末内では見せる
		expect(result.frequentWords.map(item => item.word)).toContain('ラーメン');
		// ⚠️保存側には本文由来の語を1つも出さない
		expect(JSON.stringify(payload)).not.toContain('ラーメン');
		expect(payload.result).not.toHaveProperty('frequentWords');
	});

	test('証跡は保存上限まで切り詰める', () => {
		const result = analyzeHataEmotion([
			{ id: 'n', createdAt: '2026-08-24T00:00:00.000Z', text: '最高' },
		], { timezoneOffsetMinutes: 0 });
		result.evidence.phrases = Array.from({ length: HATA_EMOTION_EVIDENCE_SAVE_LIMIT + 40 }, (_, index) => ({ label: `語${index}`, polarity: 'positive' as const, count: 1, weight: 1 }));
		const payload = buildHataEmotionAnalysisSavePayload(result, { mode: 'latest', noteLimit: 10, visibility: 'all', includeReplies: false, includeCw: true, timezoneOffsetMinutes: 0 });

		// ⚠️backend の maxItems(256) を超えると保存ごと弾かれる
		expect(payload.result.evidence.phrases).toHaveLength(HATA_EMOTION_EVIDENCE_SAVE_LIMIT);
	});
	test('用語集の規模と軸ごとの偏りを保つ', () => {
		// ⚠️語を減らすと「何も拾わない」投稿が増えて分析が薄くなる。下限を明示しておく。
		const counts = new Map<string, number>();
		for (const [, entry] of Object.entries(HATA_EMOTION_LEXICON)) counts.set(entry[0], (counts.get(entry[0]) ?? 0) + 1);

		expect(Object.keys(HATA_EMOTION_LEXICON).length).toBeGreaterThanOrEqual(450);
		for (const axis of HATA_EMOTION_AXES) expect(counts.get(axis) ?? 0).toBeGreaterThanOrEqual(40);
		// 重み付けの上限・下限を外れた語を混ぜない
		for (const [word, entry] of Object.entries(HATA_EMOTION_LEXICON)) {
			expect(entry[1], word).toBeGreaterThan(0);
			expect(entry[1], word).toBeLessThanOrEqual(4);
		}
	});

	test('よくある投稿の向きを取り違えない', () => {
		const sign = (text: string): number => Math.sign(analyzeHataEmotion(
			[{ id: 'n', createdAt: '2026-08-24T00:00:00.000Z', text }],
			{ timezoneOffsetMinutes: 0 },
		).posts[0].score);

		// 肯定
		expect(sign('今日のライブ、控えめに言って最高だった')).toBe(1);
		expect(sign('レポート出し終わった！一安心')).toBe(1);
		expect(sign('ありがとうございます、本当に助かった')).toBe(1);
		expect(sign('新しいキーボード届いた、打鍵感が気持ちいい')).toBe(1);
		expect(sign('推しの新曲、尊すぎて語彙が消えた')).toBe(1);
		// 否定
		expect(sign('寝不足で頭が回らない、今日はもう無理')).toBe(-1);
		expect(sign('理不尽な指摘にムカムカする')).toBe(-1);
		expect(sign('発表前で緊張する、心細い')).toBe(-1);
		expect(sign('腰痛がつらい、通院しようかな')).toBe(-1);
		expect(sign('楽しくなかった')).toBe(-1);
		// どちらでもない
		expect(sign('明日の天気を確認する')).toBe(0);
		expect(sign('コードをリファクタリングした')).toBe(0);
		// 複合語は感情語として数えない
		expect(sign('ご機嫌ななめだけど必死に作業する')).toBe(0);
	});
});
