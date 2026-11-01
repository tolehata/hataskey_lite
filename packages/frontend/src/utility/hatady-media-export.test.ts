/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { misskeyApi } from '@/utility/misskey-api.js';

vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/hatady-prefs.js', () => ({ hatadyTzOffset: () => -540 }));

import {
	buildHatadyMediaExportArchive,
	prepareHatadyExport,
	fetchMediaPages,
	HATADY_MEDIA_EXPORT_CURSOR_STALLED,
	HATADY_MEDIA_EXPORT_FORMAT,
	HATADY_MEDIA_EXPORT_INVALID_RESPONSE,
	HATADY_MEDIA_EXPORT_LIMIT_ERROR,
	HATADY_MEDIA_EXPORT_VERSION,
	filterHatadyMediaForExport,
} from './hatady-export.js';

describe('Hatady映画・ゲーム記録の書き出し', () => {
	beforeEach(() => {
		vi.mocked(misskeyApi).mockReset();
	});

	test('言語非依存の版付き形式で作品と記録を保持する', () => {
		const works = [
			{
				id: 'work-1',
				kind: 'movie',
				title: '星明かりの航路',
				visibility: 'private',
				viewingMode: 'subtitled',
				reviewSpoiler: true,
			},
		];
		const sessions = [
			{
				id: 'session-1',
				workId: 'work-1',
				kind: 'movie_viewing',
				occurredAt: '2026-08-12T12:30:00.000Z',
				durationMinutes: 128,
			},
		];
		const archive = buildHatadyMediaExportArchive(works, sessions, {
			now: new Date('2026-08-13T01:02:03.000Z'),
			serverVersion: '2026.7.0-hata.12.1.3',
			timezone: 'Asia/Tokyo',
		});

		expect(archive).toEqual({
			format: HATADY_MEDIA_EXPORT_FORMAT,
			formatVersion: HATADY_MEDIA_EXPORT_VERSION,
			serverVersion: '2026.7.0-hata.12.1.3',
			exportedAt: '2026-08-13T01:02:03.000Z',
			timezone: 'Asia/Tokyo',
			works,
			sessions,
		});
	});

	test('映画作品へゲーム固有情報を自動生成しない', () => {
		const archive = buildHatadyMediaExportArchive([{ id: 'movie', kind: 'movie', title: '映画' }], [], {
			now: new Date(0),
			serverVersion: 'test',
			timezone: 'UTC',
		});
		const movie = archive.works[0] as Record<string, unknown>;
		expect(movie).not.toHaveProperty('weapon');
		expect(movie).not.toHaveProperty('mood');
		expect(movie).not.toHaveProperty('matchResult');
	});

	test('正確に5000件の場合は確認プローブ後に全件を返す', async () => {
		let page = 0;
		vi.mocked(misskeyApi).mockImplementation(async () => {
			const currentPage = page++;
			if (currentPage === 50) return [];
			return Array.from({ length: 100 }, (_, index) => ({
				id: `work-${currentPage}-${index}`,
				kind: 'movie',
			}));
		});

		await expect(fetchMediaPages('hata/hatady/media/works/list')).resolves.toHaveLength(5000);
		expect(misskeyApi).toHaveBeenCalledTimes(51);
		expect(misskeyApi).toHaveBeenLastCalledWith(
			'hata/hatady/media/works/list',
			expect.objectContaining({ limit: 1, untilId: 'work-49-99' }),
		);
	});

	test('5001件以上の場合は部分データを返さず失敗する', async () => {
		let page = 0;
		vi.mocked(misskeyApi).mockImplementation(async () => {
			const currentPage = page++;
			if (currentPage === 50) return [{ id: 'work-extra', kind: 'movie' }];
			return Array.from({ length: 100 }, (_, index) => ({
				id: `work-${currentPage}-${index}`,
				kind: 'movie',
			}));
		});

		await expect(fetchMediaPages('hata/hatady/media/works/list')).rejects.toThrow(HATADY_MEDIA_EXPORT_LIMIT_ERROR);
		expect(misskeyApi).toHaveBeenCalledTimes(51);
		expect(misskeyApi).toHaveBeenLastCalledWith(
			'hata/hatady/media/works/list',
			expect.objectContaining({ limit: 1, untilId: 'work-49-99' }),
		);
	});

	test('不正なAPI応答を空一覧として成功扱いしない', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce(null as never);

		await expect(fetchMediaPages('hata/hatady/media/works/list')).rejects.toThrow(HATADY_MEDIA_EXPORT_INVALID_RESPONSE);
	});

	test('同じ項目を返す停滞カーソルを部分成功扱いしない', async () => {
		const page = Array.from({ length: 100 }, (_, index) => ({ id: `work-${index}`, kind: 'movie' }));
		vi.mocked(misskeyApi)
			.mockResolvedValueOnce(page as never)
			.mockResolvedValueOnce(page as never);

		await expect(fetchMediaPages('hata/hatady/media/works/list')).rejects.toThrow(HATADY_MEDIA_EXPORT_CURSOR_STALLED);
		expect(misskeyApi).toHaveBeenCalledTimes(2);
	});
	describe('種別と期間で絞る', () => {
		const works = [
			{ id: 'm1', kind: 'movie', title: '映画A' },
			{ id: 'g1', kind: 'game', title: 'ゲームB' },
			{ id: 'm2', kind: 'movie', title: '記録のない映画' },
		];
		const sessions = [
			{ id: 's1', workId: 'm1', kind: 'movie_viewing', occurredAt: '2026-08-10T10:00:00.000Z' },
			{ id: 's2', workId: 'g1', kind: 'game_play', occurredAt: '2026-08-20T10:00:00.000Z' },
			{ id: 's3', workId: 'm1', kind: 'movie_viewing', occurredAt: '2026-09-01T10:00:00.000Z' },
		];
		const day = (iso: string) => new Date(iso).getTime();

		test('種別だけの指定では記録のない作品も残す', () => {
			const out = filterHatadyMediaForExport(works, sessions, { since: null, until: null, kinds: ['movie'] });
			expect(out.works.map((w) => (w as { id: string }).id)).toEqual(['m1', 'm2']);
			expect(out.sessions.map((x) => (x as { id: string }).id)).toEqual(['s1', 's3']);
		});

		test('期間を指定したら、その期間に記録がある作品だけを残す', () => {
			const out = filterHatadyMediaForExport(works, sessions, {
				since: day('2026-08-01T00:00:00.000Z'),
				until: day('2026-08-31T00:00:00.000Z'),
				kinds: [],
			});
			// ⚠️記録だけ残って作品が無い状態を作らない
			expect(out.works.map((w) => (w as { id: string }).id)).toEqual(['m1', 'g1']);
			expect(out.sessions.map((x) => (x as { id: string }).id)).toEqual(['s1', 's2']);
		});

		test('終端の日は日末まで含める', () => {
			const out = filterHatadyMediaForExport(works, sessions, {
				since: day('2026-08-20T00:00:00.000Z'),
				until: day('2026-08-20T00:00:00.000Z'),
				kinds: [],
			});
			expect(out.sessions.map((x) => (x as { id: string }).id)).toEqual(['s2']);
		});

		test('種別と期間は同時に効く', () => {
			const out = filterHatadyMediaForExport(works, sessions, {
				since: day('2026-08-01T00:00:00.000Z'),
				until: day('2026-08-31T00:00:00.000Z'),
				kinds: ['game'],
			});
			expect(out.works.map((w) => (w as { id: string }).id)).toEqual(['g1']);
			expect(out.sessions.map((x) => (x as { id: string }).id)).toEqual(['s2']);
		});

		test('期間なしなら日時が壊れた記録も落とさない', () => {
			const broken = [...sessions, { id: 'bad', workId: 'm1', kind: 'movie_viewing', occurredAt: 'not-a-date' }];
			const all = filterHatadyMediaForExport(works, broken, { since: null, until: null, kinds: [] });
			expect(all.sessions.map((x) => (x as { id: string }).id)).toContain('bad');
			// ⚠️期間を指定したときだけ落とす(範囲判定ができないため)
			const ranged = filterHatadyMediaForExport(works, broken, {
				since: day('2026-08-01T00:00:00.000Z'),
				until: null,
				kinds: [],
			});
			expect(ranged.sessions.map((x) => (x as { id: string }).id)).not.toContain('bad');
		});
	});
});

describe('all-category export preserves the saved data', () => {
	test('exact seconds, explicit zero and unknown fields survive JSON and readable exports', () => {
		const archive = {
			...buildHatadyMediaExportArchive(
				[],
				[
					{
						id: 'deleted-work-session',
						workId: null,
						workSnapshot: { kind: 'movie', title: '残る作品名' },
						kind: 'movie_viewing',
						occurredAt: '2026-09-10T01:00:00.000Z',
						durationMinutes: 1,
						durationSeconds: 95,
						note: '感想',
						noteSpoiler: true,
						details: { unknownOldField: ['one', 'two'] },
					},
				],
				{ now: new Date('2026-09-13T01:00:00.000Z') },
			),
			logs: [
				{
					id: 'exercise',
					kind: 'exercise',
					studiedAt: '2026-09-10T02:00:00.000Z',
					title: '散歩',
					durationMinutes: 42,
					durationSeconds: 0,
				},
				{
					id: 'work',
					kind: 'work',
					studiedAt: '2026-09-10T03:00:00.000Z',
					title: '制作',
					durationMinutes: 42,
					durationSeconds: null,
					body: '伏せたい内容',
					details: { spoiler: true, futureValue: { kept: 1 } },
				},
			],
			books: [{ id: 'book', memo: '自分用メモ' }],
			bookmarks: [{ id: 'bookmark', bookId: 'book', page: 9 }],
			bookMemos: [{ id: 'memo', bookId: 'book', content: '内容メモ' }],
		};
		const before = JSON.stringify(archive);
		const json = prepareHatadyExport(archive, 'json');
		expect(JSON.parse(json.contents)).toEqual(archive);
		expect(json.records).toBe(3);
		expect(json.works).toBe(1);
		const txt = prepareHatadyExport(archive, 'txt');
		expect(txt.contents).toContain('残る作品名\r\n1分35秒');
		expect(txt.contents).toContain('散歩\r\n0分');
		expect(txt.contents).toContain('制作\r\n—');
		expect(txt.contents).toContain('[ネタバレ] 感想');
		expect(txt.contents).toContain('[ネタバレ] 伏せたい内容');
		expect(txt.contents).toContain('unknownOldField');
		expect(txt.contents).toContain('futureValue');
		expect(txt.contents).toContain('内容メモ');
		expect(txt.contents).toContain('bookmark');
		expect(JSON.stringify(archive)).toBe(before);
	});

	test('a removed work remains exportable under a category and period filter', () => {
		const saved = {
			id: 'session',
			workId: null,
			workSnapshot: { kind: 'game', title: '残るゲーム名' },
			kind: 'game_solo',
			occurredAt: '2026-09-10T10:00:00.000Z',
		};
		expect(
			filterHatadyMediaForExport([], [saved], {
				kinds: ['game'],
				since: Date.parse('2026-09-01T00:00:00.000Z'),
				until: null,
			}).sessions,
		).toEqual([saved]);
		expect(filterHatadyMediaForExport([], [saved], { kinds: ['movie'], since: null, until: null }).sessions).toEqual(
			[],
		);
	});
});
