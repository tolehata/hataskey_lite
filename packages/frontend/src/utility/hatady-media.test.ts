/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test, vi } from 'vitest';
import {
	collectMediaSessionSuggestions,
	hatadyViewingEventPayload,
	normalizeHatadyLogKinds,
	mediaAdvancedFilterPayload,
	mediaCommentCreatePayload,
	mediaDashboardSessions,
	mediaReactionPayload,
	mediaSessionDetailsPayload,
	mediaSessionDisplayFacts,
	mediaStatusOptions,
	mediaWorkSpecificPayload,
	normalizeMediaList,
	normalizeMediaSortForKind,
} from './hatady-media.js';

vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
describe('Hatady media API payload helpers', () => {
	test('movie payload excludes every game-only field', () => {
		const payload = mediaWorkSpecificPayload('movie', {
			genres: ['Drama'],
			origin: 'foreign',
			viewingMode: 'subtitled',
			primaryLanguage: 'en',
			runtimeMinutes: 120,
			highlights: ['Opening'],
			highlightsSpoiler: true,
			platforms: ['PC'],
			developer: 'dev',
			publisher: 'pub',
		});
		expect(payload).toMatchObject({ genres: ['Drama'], origin: 'foreign', highlights: ['Opening'] });
		expect(payload).not.toHaveProperty('platforms');
		expect(payload).not.toHaveProperty('developer');
		expect(payload).not.toHaveProperty('publisher');
	});

	test('game payload excludes every movie-only field and alone exposes mastered', () => {
		const payload = mediaWorkSpecificPayload('game', {
			platforms: ['PC'],
			developer: 'dev',
			publisher: 'pub',
			genres: ['Drama'],
			origin: 'domestic',
			viewingMode: 'original',
			primaryLanguage: 'ja',
			runtimeMinutes: 90,
			highlights: ['Spoiler'],
			highlightsSpoiler: true,
		});
		expect(payload).toEqual({ platforms: ['PC'], developer: 'dev', publisher: 'pub' });
		expect(mediaStatusOptions('game')).toContain('mastered');
		expect(mediaStatusOptions('movie')).not.toContain('mastered');
		expect(normalizeMediaSortForKind('game', 'recommendationRating')).toBe('updatedAt');
		expect(normalizeMediaSortForKind('movie', 'recommendationRating')).toBe('recommendationRating');
	});

	test('advanced filters never cross movie and game contracts', () => {
		expect(
			mediaAdvancedFilterPayload('movie', {
				origin: 'foreign',
				viewingMode: 'subtitled',
				isRecommended: true,
				minRecommendation: 7,
				sessionKind: 'game_match',
				weapon: 'sword',
				rank: 'A',
				route: 'north',
			}),
		).toEqual({ origin: 'foreign', viewingMode: 'subtitled', isRecommended: true, minRecommendation: 7 });
		expect(
			mediaAdvancedFilterPayload('game', {
				origin: 'domestic',
				viewingMode: 'original',
				isRecommended: false,
				minRecommendation: 10,
				sessionKind: 'game_match',
				result: 'win',
				weapon: 'sword',
				rank: 'A',
				route: 'north',
				since: '2026-08-01T00:00:00.000Z',
				until: '2026-08-31T23:59:59.999Z',
			}),
		).toEqual({
			sessionKind: 'game_match',
			result: 'win',
			weapon: 'sword',
			rank: 'A',
			route: 'north',
			since: '2026-08-01T00:00:00.000Z',
			until: '2026-08-31T23:59:59.999Z',
		});
	});

	test('line-separated lists preserve commas inside each stored item', () => {
		expect(normalizeMediaList('Action, Adventure\nDrama')).toEqual(['Action, Adventure', 'Drama']);
		expect(normalizeMediaList(['Action, Adventure', 'Drama'])).toEqual(['Action, Adventure', 'Drama']);
	});

	test('session details preserve only fields allowed by kind', () => {
		const values = {
			theaterName: 'Cinema',
			viewingMode: 'subtitled',
			rewatch: false,
			weapon: 'Sword',
			mood: 'great',
			matchmaking: 'random',
			score: '3-1',
			roundResults: ['win', 'loss'],
		};
		expect(mediaSessionDetailsPayload('movie', 'game_match', values)).toEqual({
			theaterName: 'Cinema',
			rewatch: false,
			viewingMode: 'subtitled',
		});
		expect(mediaSessionDetailsPayload('game', 'game_match', values)).toEqual({
			matchmaking: 'random',
			score: '3-1',
			weapon: 'Sword',
			roundResults: ['win', 'loss'],
			mood: 'great',
		});
	});

	test('saved session details are restored per kind without crossing movie and game fields', () => {
		const mixed = {
			theaterName: 'Cinema',
			screeningFormat: 'IMAX',
			companions: ['A'],
			rewatch: true,
			viewingMode: 'subtitled',
			device: 'PC',
			character: 'Rin',
			weapon: 'Sword',
			weaponOrder: ['Sword', 'Bow'],
			result: 'win',
			reason: 'KO',
			score: '3-1',
			mode: 'ranked',
			map: 'Harbor',
			roundResults: ['win', 'loss'],
			bestOf: 5,
			kills: 8,
			deaths: 2,
			assists: 4,
			rank: 'A',
			ratingBefore: 1200,
			ratingAfter: 1225,
			overtime: true,
		};
		const movieFacts = mediaSessionDisplayFacts({ kind: 'movie_viewing', details: mixed });
		expect(movieFacts).toEqual([
			{ key: 'theaterName', value: 'Cinema' },
			{ key: 'screeningFormat', value: 'IMAX' },
			{ key: 'companions', value: ['A'] },
			{ key: 'rewatch', value: true },
			{ key: 'viewingMode', value: 'subtitled' },
		]);
		expect(movieFacts.map((fact) => fact.key)).not.toContain('weapon');
		expect(mediaSessionDisplayFacts({ kind: 'movie_viewing', details: { rewatch: false } })).toEqual([
			{ key: 'rewatch', value: false },
		]);

		const matchFacts = mediaSessionDisplayFacts({ kind: 'game_match', details: mixed });
		expect(matchFacts).toEqual(
			expect.arrayContaining([
				{ key: 'device', value: 'PC' },
				{ key: 'character', value: 'Rin' },
				{ key: 'weapon', value: 'Sword' },
				{ key: 'score', value: '3-1' },
				{ key: 'roundResults', value: ['win', 'loss'] },
				// 旗鯖fork(Hatady): 指標は記録ごとに増減するので、固定3枠ではなく指標ごとの事実として出す。
				{ key: 'kills', value: 8 },
				{ key: 'deaths', value: 2 },
				{ key: 'assists', value: 4 },
				{ key: 'ratingBeforeAfter', value: '1200 → 1225' },
			]),
		);
		expect(matchFacts.map((fact) => fact.key)).not.toContain('theaterName');

		const playDetails = {
			playMode: 'multi',
			matchmaking: 'random',
			progress: 'chapter-3',
			difficulty: 'hard',
			device: 'PC',
			rank: 'A',
			rating: 1200,
			mood: 'good',
			achievements: ['first-win'],
			character: 'Rin',
			weapon: 'Sword',
			weaponOrder: ['Sword', 'Bow'],
		};
		expect(mediaSessionDisplayFacts({ kind: 'game_play', details: playDetails }).map((fact) => fact.key)).toEqual(
			Object.keys(playDetails),
		);

		const rogueDetails = {
			result: 'cleared',
			seed: 'seed-1',
			floor: 99,
			route: 'north',
			branches: ['shop'],
			build: 'speed',
			runNumber: 4,
			difficulty: 'hard',
			character: 'Rin',
			weapon: 'Bow',
			weaponOrder: ['Bow'],
			mood: 'great',
			device: 'PC',
			cause: 'boss',
		};
		expect(mediaSessionDisplayFacts({ kind: 'game_roguelike', details: rogueDetails }).map((fact) => fact.key)).toEqual(
			[
				'result',
				'seed',
				'floor',
				'route',
				'branches',
				'build',
				'runNumber',
				'difficulty',
				'character',
				'weapon',
				'weaponOrder',
				'mood',
				'device',
				'cause',
			],
		);
	});

	// 旗鯖fork(Hatady): マイログの表示種別。端末ローカルの保存値から復元するため壊れた値も来る。
	test('log kind selection survives broken storage but keeps an explicit empty choice', () => {
		// 保存が無い(初回)ときだけ全部表示に倒す。
		expect(normalizeHatadyLogKinds(null)).toEqual(['study', 'movie', 'game', 'exercise', 'work', 'cooking']);
		expect(normalizeHatadyLogKinds('not json')).toEqual(['study', 'movie', 'game', 'exercise', 'work', 'cooking']);
		expect(normalizeHatadyLogKinds('{"a":1}')).toEqual(['study', 'movie', 'game', 'exercise', 'work', 'cooking']);
		// ⚠️空配列は「何も表示しない」という利用者の選択。全部表示に読み替えてはいけない。
		expect(normalizeHatadyLogKinds('[]')).toEqual([]);
		// 未知の値は落とし、保存順の揺れは定義順へ揃える。
		expect(normalizeHatadyLogKinds('["game","unknown","study"]')).toEqual(['study', 'game']);
		expect(normalizeHatadyLogKinds(['movie'])).toEqual(['movie']);
	});

	// 旗鯖fork(Hatady): 一度使った武器名・ウェーブ数・実績名を打ち直さずに済ませるための入力候補。
	test('past values become suggestions, newest first and without duplicates', () => {
		const session = (occurredAt: string, details: Record<string, unknown>) => ({ occurredAt, details });
		const suggestions = collectMediaSessionSuggestions([
			// ⚠️渡す順序に依存せず、新しい記録の値が先に来ること。
			session('2026-08-01T00:00:00.000Z', { weapon: 'ローラー', waves: 3, achievements: ['初勝利', '無傷'] }),
			session('2026-08-10T00:00:00.000Z', { weapon: ' シューター ', waves: 5, achievements: ['無傷'] }),
			session('2026-07-01T00:00:00.000Z', { weaponStats: [{ weapon: 'チャージャー', kills: 3 }] }),
		]);
		expect(suggestions.weapon).toEqual(['シューター', 'ローラー', 'チャージャー']);
		expect(suggestions.waves).toEqual(['5', '3']);
		expect(suggestions.achievements).toEqual(['無傷', '初勝利']);
		// 候補にしても邪魔になるだけの欄(毎回違う値)は集めない。
		expect(
			collectMediaSessionSuggestions([session('2026-08-01T00:00:00.000Z', { seed: 'abc' })].map((s) => s)).seed,
		).toBeUndefined();
		// 空文字・空白だけの値はキーごと作らない。
		expect(
			collectMediaSessionSuggestions([session('2026-08-01T00:00:00.000Z', { weapon: '   ' })]).weapon,
		).toBeUndefined();
	});

	test('spoiler sessions join dashboard only for their owner', () => {
		const sessions = [
			{
				id: 'plain',
				workId: 'work',
				kind: 'game_play' as const,
				createdAt: '',
				updatedAt: '',
				occurredAt: '',
				visibility: 'public' as const,
				noteSpoiler: false,
			},
			{
				id: 'spoiler',
				workId: 'work',
				kind: 'game_match' as const,
				createdAt: '',
				updatedAt: '',
				occurredAt: '',
				visibility: 'public' as const,
				noteSpoiler: true,
			},
		];
		expect(mediaDashboardSessions(sessions, false).map((session) => session.id)).toEqual(['plain']);
		expect(mediaDashboardSessions(sessions, true).map((session) => session.id)).toEqual(['plain', 'spoiler']);
	});

	test('reaction payload follows the polymorphic work/comment contract', () => {
		expect(mediaReactionPayload('comment', 'comment-id', ':ok:')).toEqual({
			targetType: 'comment',
			targetId: 'comment-id',
			reaction: ':ok:',
		});
		expect(mediaReactionPayload('work', 'work-id')).toEqual({ targetType: 'work', targetId: 'work-id' });
	});

	test('comment payload preserves spoiler and optional reply contract', () => {
		expect(mediaCommentCreatePayload('work-id', ' reply text ', true, 'parent-id')).toEqual({
			workId: 'work-id',
			text: 'reply text',
			spoiler: true,
			replyId: 'parent-id',
		});
		expect(mediaCommentCreatePayload('work-id', 'comment', false)).not.toHaveProperty('replyId');
	});

	test('Hatask viewing event payload follows the event API contract', () => {
		expect(hatadyViewingEventPayload('{title} watch party', 'Starlit Passage', '2026-08-14', '20:30')).toEqual({
			title: 'Starlit Passage watch party',
			emoji: '🎬',
			date: '2026-08-14',
			dateEnd: '',
			timeStart: '20:30',
			timeEnd: '',
			allDay: false,
			color: '#d9824a',
			rsvp: true,
		});
	});
});
