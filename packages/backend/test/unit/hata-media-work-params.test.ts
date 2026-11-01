/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import _Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import { paramDef as createWorkParamDef } from '@/server/api/endpoints/hata/hatady/media/works/create.js';
import { paramDef as createSessionParamDef } from '@/server/api/endpoints/hata/hatady/media/sessions/create.js';

const Ajv = _Ajv.default;

// エンドポイント本体と同じ設定で組む(endpoint-base.ts と揃える)。
function compile(schema: unknown) {
	const ajv = new Ajv({ useDefaults: true });
	ajv.addFormat('misskey:id', /^[a-zA-Z0-9]+$/);
	return ajv.compile(schema as never);
}

/*
 * 旗鯖fork(Hatady): 「映画を保存できない」の再発防止。
 * フォームは未選択の項目を null で送る。映画だけが enum 付きの項目(origin / viewingMode)を持つため、
 * enum に null が無いとゲームは通って映画だけが弾かれる、という気付きにくい壊れ方をしていた。
 */
describe('hata media endpoints accept the payloads the forms actually send', () => {
	const validateWork = compile(createWorkParamDef);

	test('a movie work with nothing filled in but the title', () => {
		const payload = {
			kind: 'movie', title: 'テスト映画', originalTitle: null, creator: null,
			status: 'planned', visibility: 'private', coverColorIndex: null,
			isFavorite: false, isRecommended: false, recommendationRating: null,
			releaseDate: null, releaseYear: null, officialUrl: null,
			synopsis: null, synopsisSpoiler: false, review: null, reviewSpoiler: false,
			genres: [], origin: null, viewingMode: null, primaryLanguage: null, runtimeMinutes: null,
			highlights: [], highlightsSpoiler: false,
		};
		expect(validateWork(payload), JSON.stringify(validateWork.errors)).toBe(true);
	});

	test('a movie work with every movie-only field chosen', () => {
		const payload = {
			kind: 'movie', title: '映画', status: 'completed', visibility: 'public',
			genres: ['ドラマ'], origin: 'foreign', viewingMode: 'subtitled', primaryLanguage: 'en',
			runtimeMinutes: 120, highlights: ['冒頭'], highlightsSpoiler: true,
			isRecommended: true, recommendationRating: 9,
		};
		expect(validateWork(payload), JSON.stringify(validateWork.errors)).toBe(true);
	});

	test('a game work still rejects nothing it used to accept', () => {
		const payload = {
			kind: 'game', title: 'ゲーム', originalTitle: null, creator: null,
			status: 'planned', visibility: 'private', coverColorIndex: null,
			isFavorite: false, isRecommended: false,
			releaseDate: null, releaseYear: null, officialUrl: null,
			synopsis: null, synopsisSpoiler: false, review: null, reviewSpoiler: false,
			platforms: [], developer: null, publisher: null,
		};
		expect(validateWork(payload), JSON.stringify(validateWork.errors)).toBe(true);
	});

	test('bad enum values are still rejected', () => {
		expect(validateWork({ kind: 'movie', title: 'x', origin: 'nope' })).toBe(false);
		expect(validateWork({ kind: 'anime', title: 'x' })).toBe(false);
	});

	test('a movie viewing session from the form', () => {
		const validateSession = compile(createSessionParamDef);
		const payload = {
			workId: 'apxjwv40phv70002', kind: 'movie_viewing',
			occurredAt: '2026-08-15T12:00:00.000Z', durationMinutes: 120,
			note: null, noteSpoiler: false, visibility: 'private',
			details: { companions: [], rewatch: false },
		};
		expect(validateSession(payload), JSON.stringify(validateSession.errors)).toBe(true);
	});
});
