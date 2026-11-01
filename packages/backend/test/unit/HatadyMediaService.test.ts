/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { normalizeHatadyGameTitleLimit } from '@/core/RoleService.js';
import { buildHatadyMediaSessionWorkFilterCondition, buildHatadyMediaWorkCursorCondition, buildHatadyMediaWorkSearchCondition, HatadyMediaService, parseHatadyMediaDateTime, validateHatadyMediaOfficialUrl, validateHatadyMediaSessionDetails } from '@/core/HatadyMediaService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import type { MiHatadyMediaWork } from '@/models/HatadyMediaWork.js';
import HatadyMediaSessionsCreateEndpoint from '@/server/api/endpoints/hata/hatady/media/sessions/create.js';
import HatadyMediaWorksListEndpoint from '@/server/api/endpoints/hata/hatady/media/works/list.js';
import HatadyMediaWorksShowEndpoint from '@/server/api/endpoints/hata/hatady/media/works/show.js';

function work(overrides: Partial<MiHatadyMediaWork> = {}): MiHatadyMediaWork {
	return {
		id: 'work-a', userId: 'owner', kind: 'movie', visibility: 'private', title: '作品',
		createdAt: new Date(), updatedAt: new Date(), originalTitle: null, creator: null,
		releaseDate: null, releaseYear: null, status: 'planned', isFavorite: false,
		isRecommended: false, recommendationRating: null, coverColorIndex: null,
		synopsis: null, synopsisSpoiler: false, review: null, reviewSpoiler: false,
		officialUrl: null, runtimeMinutes: null, genres: [], origin: null, viewingMode: null,
		primaryLanguage: null, highlights: [], highlightsSpoiler: false, platforms: [], developer: null, publisher: null,
		user: null, details: {},
		...overrides,
	};
}

function service(overrides: Record<string, unknown> = {}): HatadyMediaService {
	const defaults = {
		db: { transaction: vi.fn() },
		worksRepository: { findOneBy: vi.fn() },
		sessionsRepository: {}, commentsRepository: {}, reactionsRepository: {},
		hatadyFollowingsRepository: { existsBy: vi.fn().mockResolvedValue(false) },
		idService: { gen: vi.fn().mockReturnValue('generated') },
		roleService: { getUserPolicies: vi.fn().mockResolvedValue({ hatadyGameTitleLimit: 100 }) },
		userEntityService: {},
		hatadyEntityService: {},
		// 旗鯖fork(Hatady次期: ゲーム/映画記録): createSession は保存後に連続記録の節目通知判定を行う。
		hatadyService: {
			notifyMilestoneIfReached: vi.fn().mockResolvedValue(undefined),
			isBlockedEitherDirection: vi.fn().mockResolvedValue(false),
			canModerate: vi.fn().mockResolvedValue(false),
			getTimelineExcludedUserIds: vi.fn().mockResolvedValue(new Set()),
			canAppearInTimeline: vi.fn().mockResolvedValue(true),
			pushHatadyNotification: vi.fn().mockResolvedValue(undefined),
			mirrorHatadyNotification: vi.fn().mockResolvedValue(undefined),
			refreshHatadyNotificationRows: vi.fn().mockResolvedValue(undefined),
		},
		...overrides,
	};
	return new HatadyMediaService(
		{ onHatadyCreated: vi.fn() } as never,
		defaults.db as never,
		defaults.worksRepository as never,
		defaults.sessionsRepository as never,
		defaults.commentsRepository as never,
		defaults.reactionsRepository as never,
		defaults.hatadyFollowingsRepository as never,
		defaults.idService as never,
		defaults.roleService as never,
		defaults.userEntityService as never,
		defaults.hatadyService as never,
		defaults.hatadyEntityService as never,
		{ validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) } as never,
		{ changed: vi.fn() } as never,
	);
}

describe('Hatady media role limits', () => {
	test('game title limit is clamped to the documented 0..1000 range', () => {
		expect(normalizeHatadyGameTitleLimit([-10])).toBe(0);
		expect(normalizeHatadyGameTitleLimit([0])).toBe(0);
		expect(normalizeHatadyGameTitleLimit([123.9])).toBe(123);
		expect(normalizeHatadyGameTitleLimit([5000])).toBe(1000);
	});
});

describe('Hatady media URL validation', () => {
	test('accepts http/https and rejects executable or embedded schemes', () => {
		expect(() => validateHatadyMediaOfficialUrl('https://example.com/work')).not.toThrow();
		expect(() => validateHatadyMediaOfficialUrl('http://example.com/work')).not.toThrow();
		expect(() => validateHatadyMediaOfficialUrl('javascript:alert(1)')).toThrow();
		expect(() => validateHatadyMediaOfficialUrl('data:text/html,hello')).toThrow();
	});

	test('rejects impossible calendar dates before PostgreSQL receives them', async () => {
		const worksRepository = { insertOne: vi.fn(async (entity: unknown) => entity) };
		const sut = service({ worksRepository });
		await expect(sut.createWork({ id: 'owner' } as never, 'movie', { title: 'Movie', releaseDate: '2026-02-30' })).rejects.toThrow('invalid releaseDate');
		await expect(sut.createWork({ id: 'owner' } as never, 'movie', { title: 'Movie', releaseDate: '0000-01-01' })).rejects.toThrow('invalid releaseDate');
		expect(worksRepository.insertOne).not.toHaveBeenCalled();
	});

	test('strictly validates session and filter timestamps without calendar normalization', () => {
		expect(() => parseHatadyMediaDateTime('2026-02-30T00:00:00Z', 'occurredAt')).toThrow('invalid occurredAt');
		expect(() => parseHatadyMediaDateTime('0000-01-01T00:00:00Z', 'since')).toThrow('invalid since');
		expect(parseHatadyMediaDateTime('2026-02-28T23:59:59+09:00').toISOString()).toBe('2026-02-28T14:59:59.000Z');
	});
});

describe('Hatady media endpoint schemas', () => {
	test('date-time inputs compile with the formats registered by the endpoint validator', () => {
		expect(() => new HatadyMediaSessionsCreateEndpoint({} as never)).not.toThrow();
		expect(() => new HatadyMediaWorksListEndpoint({} as never)).not.toThrow();
	});
});

describe('Hatady media work status boundaries', () => {
	test('mastered is game-only while completed is common', async () => {
		const worksRepository = { insertOne: vi.fn(async (entity: unknown) => entity) };
		const sut = service({ worksRepository });
		await expect(sut.createWork({ id: 'owner' } as never, 'movie', { title: 'Movie', status: 'mastered' })).rejects.toThrow('invalid status for movie');
		await expect(sut.createWork({ id: 'owner' } as never, 'movie', { title: 'Movie', status: 'completed' })).resolves.toMatchObject({ status: 'completed' });
	});
});

describe('Hatady media Misskey block boundary', () => {
	test('hides a public work when either side blocks the other', async () => {
		const sut = service({ hatadyService: { isBlockedEitherDirection: vi.fn().mockResolvedValue(true) } });
		await expect(sut.canViewWork(work({ visibility: 'public' }), 'viewer')).resolves.toBe(false);
	});
});

describe('Hatady media nullable cursor boundaries', () => {
	test('DESC non-null cursor includes the trailing NULLS LAST partition', () => {
		const condition = buildHatadyMediaWorkCursorCondition('releaseYear', 'DESC', 2020, 'cursor');
		expect(condition.sql).toContain('work.releaseYear IS NULL');
		expect(condition.params).toEqual({ cursorValue: 2020, untilId: 'cursor' });
	});

	test('ASC null cursor advances from NULLS FIRST into non-null values', () => {
		const condition = buildHatadyMediaWorkCursorCondition('releaseDate', 'ASC', null, 'cursor');
		expect(condition.sql).toContain('work.releaseDate IS NOT NULL');
		expect(condition.params).toEqual({ untilId: 'cursor' });
	});

	test('recommendation rating uses the same nullable cursor boundary rules', () => {
		const condition = buildHatadyMediaWorkCursorCondition('recommendationRating', 'DESC', 8, 'cursor');
		expect(condition.sql).toContain('work.recommendationRating IS NULL');
	});

	test('a cursor outside the active filters is rejected instead of skipping rows', async () => {
		const cursorQuery = { andWhere: vi.fn(), getOne: vi.fn().mockResolvedValue(null) };
		cursorQuery.andWhere.mockReturnValue(cursorQuery);
		const qb: Record<string, ReturnType<typeof vi.fn>> = {};
		qb.where = vi.fn().mockReturnValue(qb);
		qb.andWhere = vi.fn().mockReturnValue(qb);
		qb.clone = vi.fn().mockReturnValue(cursorQuery);
		const worksRepository = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
		const sut = service({ worksRepository });
		await expect(sut.listWorks('owner', 'owner', { kind: 'movie', status: 'planned', untilId: 'game-cursor', limit: 30 })).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		expect(cursorQuery.andWhere).toHaveBeenCalledWith('work.id = :cursorId', { cursorId: 'game-cursor' });
	});

	test('session detail filters are owner-only and cannot become a private-data oracle', async () => {
		const qb: Record<string, ReturnType<typeof vi.fn>> = {};
		qb.where = vi.fn().mockReturnValue(qb);
		qb.andWhere = vi.fn().mockReturnValue(qb);
		const worksRepository = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
		const following = { existsBy: vi.fn().mockResolvedValue(true) };
		const sut = service({ worksRepository, hatadyFollowingsRepository: following });
		await expect(sut.listWorks('viewer', 'owner', { result: 'win', limit: 30 })).rejects.toThrow('invalid session filters for another user');
	});
});

describe('Hatady media search SQL', () => {
	test('jsonb arrays use a named scalar column and spoiler text stays owner-only', () => {
		const publicCondition = buildHatadyMediaWorkSearchCondition(false);
		expect(publicCondition).toContain('AS genre(value) WHERE genre.value ILIKE :query');
		expect(publicCondition).toContain('AS platform(value) WHERE platform.value ILIKE :query');
		expect(publicCondition).not.toContain('work.synopsis ILIKE');
		expect(buildHatadyMediaWorkSearchCondition(true)).toContain('work.synopsis ILIKE :query');
	});

	test('session detail filtering is owner-complete but blocks spoiler oracle for other viewers', () => {
		const owner = buildHatadyMediaSessionWorkFilterCondition({ sessionKind: 'game_match', result: 'win', weapon: 'bow' })!;
		expect(owner.sql).not.toContain('noteSpoiler');
		expect(owner.sql).not.toContain('session.visibility');
		expect(owner.params).toMatchObject({ sessionKind: 'game_match', sessionResult: '%win%', sessionWeapon: '%bow%' });
	});
});

describe('Hatady media session detail boundaries', () => {
	test('movie sessions reject every game-only field', () => {
		expect(() => validateHatadyMediaSessionDetails('movie_viewing', { weapon: 'bow' })).toThrow();
		expect(() => validateHatadyMediaSessionDetails('movie_viewing', { mood: 'focused' })).toThrow();
	});

	test('allows bounded game fields and rejects unknown fields', () => {
		expect(validateHatadyMediaSessionDetails('game_play', { playMode: 'single', matchmaking: 'random', weaponOrder: ['bow'], rating: 1200 })).toMatchObject({ playMode: 'single', matchmaking: 'random' });
		expect(validateHatadyMediaSessionDetails('game_match', { roundResults: [' win ', 'win'], weaponOrder: [' bow ', 'bow'] })).toMatchObject({ roundResults: ['win', 'win'], weaponOrder: ['bow', 'bow'] });
		expect(() => validateHatadyMediaSessionDetails('game_match', { roundResults: ['win\nloss'] })).toThrow('invalid roundResults');
		expect(() => validateHatadyMediaSessionDetails('game_play', { achievements: ['first\r\nsecond'] })).toThrow('invalid achievements');
		expect(validateHatadyMediaSessionDetails('game_match', { result: 'win', matchmaking: 'specific', opponentType: 'human', score: '3-1', roundResults: ['win', 'loss'] })).toMatchObject({ score: '3-1', matchmaking: 'specific' });
		expect(validateHatadyMediaSessionDetails('game_roguelike', { result: 'cleared', floor: 12, branches: ['left'] })).toMatchObject({ floor: 12 });
		expect(() => validateHatadyMediaSessionDetails('game_match', { roundResults: [{ result: 'win' }] })).toThrow('invalid roundResults');
		expect(() => validateHatadyMediaSessionDetails('game_play', { unexpected: true })).toThrow();
	});

	// 旗鯖fork(Hatady): 4対4の対人戦・4人以上のPvE・武器ごとの成績への対応。
	test('team sizes are bounded and only exist where the format has two sides', () => {
		expect(validateHatadyMediaSessionDetails('game_match', { teamSize: 4, opponentSize: 4 })).toMatchObject({ teamSize: 4, opponentSize: 4 });
		expect(validateHatadyMediaSessionDetails('game_pve', { teamSize: 8 })).toMatchObject({ teamSize: 8 });
		// PvE に「相手チーム」は無い。人数の概念を取り違えた記録を作らせない。
		expect(() => validateHatadyMediaSessionDetails('game_pve', { opponentSize: 4 })).toThrow();
		expect(() => validateHatadyMediaSessionDetails('game_match', { teamSize: 0 })).toThrow('invalid teamSize');
		expect(() => validateHatadyMediaSessionDetails('game_match', { teamSize: 101 })).toThrow('invalid teamSize');
		expect(() => validateHatadyMediaSessionDetails('game_match', { teamSize: 2.5 })).toThrow('invalid teamSize');
	});

	test('pve keeps its own vocabulary and stays out of the other game kinds', () => {
		expect(validateHatadyMediaSessionDetails('game_pve', {
			result: 'cleared', waves: 3, enemyCount: 40, enemyTypes: [' シャケ ', 'シャケ'], boss: 'ヨコヅナ',
		})).toMatchObject({ result: 'cleared', waves: 3, enemyCount: 40, enemyTypes: ['シャケ', 'シャケ'], boss: 'ヨコヅナ' });
		// PvE は勝敗ではなく踏破結果で終わる。
		expect(() => validateHatadyMediaSessionDetails('game_pve', { result: 'win' })).toThrow();
		// 敵の構成は PvE 専用。対戦やローグライクへは漏らさない。
		for (const key of ['waves', 'enemyCount']) {
			expect(() => validateHatadyMediaSessionDetails('game_match', { [key]: 1 })).toThrow();
			expect(() => validateHatadyMediaSessionDetails('game_roguelike', { [key]: 1 })).toThrow();
		}
		expect(() => validateHatadyMediaSessionDetails('game_match', { boss: 'x' })).toThrow();
	});

	test('weapon stat rows require a weapon and accept only known metrics', () => {
		const rows = [{ weapon: ' シューター ', kills: 8, deaths: 2, specials: 3 }, { weapon: 'ローラー', rescues: 1, assists: 4 }];
		expect(validateHatadyMediaSessionDetails('game_match', { weaponStats: rows })).toMatchObject({
			weaponStats: [{ weapon: 'シューター', kills: 8, deaths: 2, specials: 3 }, { weapon: 'ローラー', rescues: 1, assists: 4 }],
		});
		// ⚠️未記録の指標は 0 で埋めない(0キルと「記録していない」を区別するため)。
		expect((validateHatadyMediaSessionDetails('game_pve', { weaponStats: [{ weapon: 'w', kills: 1 }] }).weaponStats as Record<string, unknown>[])[0]).toEqual({ weapon: 'w', kills: 1 });
		expect(() => validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: '  ' }] })).toThrow('invalid weaponStats weapon');
		expect(() => validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: 'w', headshots: 1 }] })).toThrow('invalid weaponStats field headshots');
		expect(() => validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: 'w', kills: -1 }] })).toThrow('invalid weaponStats kills');
		expect(() => validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: 'w', kills: 1.5 }] })).toThrow('invalid weaponStats kills');
		expect(() => validateHatadyMediaSessionDetails('game_match', { weaponStats: 'shooter' })).toThrow('invalid weaponStats');
		expect(() => validateHatadyMediaSessionDetails('game_match', { weaponStats: Array.from({ length: 21 }, () => ({ weapon: 'w' })) })).toThrow('invalid weaponStats');
		// 成績表は対戦と PvE のもの。通常プレイ・ローグライクは1回1構成なので持たせない。
		expect(() => validateHatadyMediaSessionDetails('game_play', { weaponStats: rows })).toThrow();
		expect(() => validateHatadyMediaSessionDetails('game_roguelike', { weaponStats: rows })).toThrow();
	});

	test('stat field selection is a unique subset in a stable order', () => {
		expect(validateHatadyMediaSessionDetails('game_match', { statFields: ['deaths', 'kills'] })).toMatchObject({ statFields: ['kills', 'deaths'] });
		expect(() => validateHatadyMediaSessionDetails('game_match', { statFields: ['kills', 'kills'] })).toThrow('invalid statFields');
		expect(() => validateHatadyMediaSessionDetails('game_match', { statFields: ['headshots'] })).toThrow('invalid statFields');
		expect(() => validateHatadyMediaSessionDetails('game_match', { statFields: 'kills' })).toThrow('invalid statFields');
	});
});

describe('Hatady media centralized visibility', () => {
	test('owner and public are visible, private non-owner is not', async () => {
		const following = { existsBy: vi.fn().mockResolvedValue(false) };
		const sut = service({ hatadyFollowingsRepository: following });
		expect(await sut.canViewWork(work(), 'owner')).toBe(true);
		expect(await sut.canViewWork(work({ visibility: 'public' }), 'viewer')).toBe(true);
		expect(await sut.canViewWork(work(), 'viewer')).toBe(false);
		expect(following.existsBy).not.toHaveBeenCalled();
	});

	test('followers visibility uses Hatady following, not the main account following', async () => {
		const following = { existsBy: vi.fn().mockResolvedValue(true) };
		const sut = service({ hatadyFollowingsRepository: following });
		expect(await sut.canViewWork(work({ visibility: 'followers' }), 'viewer')).toBe(true);
		expect(following.existsBy).toHaveBeenCalledWith({ followerId: 'viewer', followeeId: 'owner' });
	});

	test('getVisibleWork hides both missing and unauthorized resources behind one error', async () => {
		const worksRepository = { findOneBy: vi.fn().mockResolvedValue(work()) };
		const sut = service({ worksRepository });
		await expect(sut.getVisibleWork('work-a', 'viewer')).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		worksRepository.findOneBy.mockResolvedValue(null);
		await expect(sut.getVisibleWork('missing', 'viewer')).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
	});

	test('deleting an own comment remains possible after the parent work becomes private', async () => {
		const commentsRepository = {
			findOne: vi.fn().mockResolvedValue({ id: 'comment-a', userId: 'viewer', workId: 'now-private' }),
			delete: vi.fn(),
		};
		const worksRepository = { findOneBy: vi.fn() };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaComment' ? commentsRepository : { findBy: vi.fn().mockResolvedValue([]) }) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const sut = service({ commentsRepository, worksRepository, db });
		await sut.deleteComment('viewer', 'comment-a');
		expect(commentsRepository.delete).toHaveBeenCalledWith({ id: 'comment-a', userId: 'viewer' });
		expect(worksRepository.findOneBy).not.toHaveBeenCalled();
	});

	test('updating an own comment remains possible after the parent work becomes private', async () => {
		const createdAt = new Date();
		const stored = { id: 'comment-a', userId: 'viewer', workId: 'now-private', replyId: null, text: 'old', spoiler: false, reactionsCount: 0, createdAt, updatedAt: createdAt };
		const commentsRepository = { findOneBy: vi.fn().mockResolvedValue(stored), update: vi.fn(), findOneByOrFail: vi.fn().mockResolvedValue({ ...stored, text: 'new' }) };
		const reactionQuery = { where: vi.fn(), getMany: vi.fn().mockResolvedValue([]) };
		reactionQuery.where.mockReturnValue(reactionQuery);
		const reactionsRepository = { createQueryBuilder: vi.fn().mockReturnValue(reactionQuery) };
		const userEntityService = { packMany: vi.fn().mockResolvedValue([{ id: 'viewer' }]) };
		const worksRepository = { findOneBy: vi.fn() };
		const sut = service({ commentsRepository, reactionsRepository, userEntityService, worksRepository });
		await sut.updateComment('viewer', 'comment-a', 'new', false);
		expect(commentsRepository.update).toHaveBeenCalledOnce();
		expect(worksRepository.findOneBy).not.toHaveBeenCalled();
	});

	test('deleting an own reaction is idempotent and does not require current target visibility', async () => {
		const reactionRepo = { findOneBy: vi.fn().mockResolvedValue({ id: 'reaction-a', workId: 'now-private', commentId: null }), delete: vi.fn() };
		const manager = { query: vi.fn(), getRepository: vi.fn().mockReturnValue(reactionRepo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const worksRepository = { findOneBy: vi.fn() };
		const sut = service({ db, worksRepository });
		await sut.deleteReaction('viewer', 'work', 'now-private');
		expect(reactionRepo.delete).toHaveBeenCalledWith('reaction-a');
		expect(worksRepository.findOneBy).not.toHaveBeenCalled();
	});

	test('comment and reaction creation stop before mutation when central visibility fails', async () => {
		const workRepo = { findOne: vi.fn().mockResolvedValue(work({ visibility: 'private' })) };
		const mutationRepo = { insert: vi.fn() };
		const manager = { query: vi.fn(), getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : mutationRepo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const sut = service({ db });
		await expect(sut.createComment('viewer', 'private-work', null, 'comment', false)).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		await expect(sut.createReaction('viewer', 'work', 'private-work', '👍')).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		expect(mutationRepo.insert).not.toHaveBeenCalled();
	});

	test('a public session leaves its private parent unchanged', async () => {
		// 記録と作品は独立した公開範囲を持つ。
		const sessionRepo = { insert: vi.fn(), findOneByOrFail: vi.fn().mockResolvedValue({ id: 'generated', visibility: 'public' }) };
		const workRepo = { findOne: vi.fn().mockResolvedValue(work()), update: vi.fn() };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : sessionRepo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const sut = service({ db });
		await sut.createSession('owner', 'work-a', 'movie_viewing', { occurredAt: new Date().toISOString(), visibility: 'public' });
		expect(sessionRepo.insert).toHaveBeenCalled();
		expect(workRepo.update).not.toHaveBeenCalled();
	});

	test('a session no more public than its parent leaves the parent visibility untouched', async () => {
		const sessionRepo = { insert: vi.fn(), findOneByOrFail: vi.fn().mockResolvedValue({ id: 'generated', visibility: 'private' }) };
		const workRepo = { findOne: vi.fn().mockResolvedValue(work({ visibility: 'public' })), update: vi.fn() };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : sessionRepo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const sut = service({ db });
		await sut.createSession('owner', 'work-a', 'movie_viewing', { occurredAt: new Date().toISOString(), visibility: 'private' });
		expect(sessionRepo.insert).toHaveBeenCalled();
		expect(workRepo.update).not.toHaveBeenCalled();
	});

	test('comment creation and its notification use the same transaction manager', async () => {
		const createdAt = new Date();
		const workRepo = { findOne: vi.fn().mockResolvedValue(work({ visibility: 'public' })) };
		const commentRepo = {
			insert: vi.fn(),
			findOneByOrFail: vi.fn().mockResolvedValue({ id: 'generated', workId: 'work-a', userId: 'viewer', replyId: null, text: 'comment', spoiler: false, reactionsCount: 0, createdAt, updatedAt: createdAt }),
		};
		const notificationRepo = { insert: vi.fn() };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : entity.name === 'MiHatadyMediaComment' ? commentRepo : notificationRepo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const reactionQuery = { where: vi.fn(), getMany: vi.fn().mockResolvedValue([]) };
		reactionQuery.where.mockReturnValue(reactionQuery);
		const reactionsRepository = { createQueryBuilder: vi.fn().mockReturnValue(reactionQuery) };
		const userEntityService = { packMany: vi.fn().mockResolvedValue([{ id: 'viewer' }]) };
		const sut = service({ db, reactionsRepository, userEntityService });
		await sut.createComment('viewer', 'work-a', null, 'comment', false);
		expect(commentRepo.insert).toHaveBeenCalledOnce();
		expect(notificationRepo.insert).toHaveBeenCalledOnce();
		expect((sut as unknown as { hatadyService: { mirrorHatadyNotification: ReturnType<typeof vi.fn> } }).hatadyService.mirrorHatadyNotification)
			.toHaveBeenCalledWith(expect.objectContaining({ sourceNotificationId: expect.any(String), subtype: 'mediaComment', targetType: 'mediaComment', targetId: 'generated' }));
		expect(db.transaction).toHaveBeenCalledOnce();
	});

	test('a rolled-back comment never mirrors its source notification', async () => {
		const createdAt = new Date();
		const workRepo = { findOne: vi.fn().mockResolvedValue(work({ visibility: 'public' })) };
		const commentRepo = {
			insert: vi.fn(),
			findOneByOrFail: vi.fn().mockResolvedValue({ id: 'generated', workId: 'work-a', userId: 'viewer', replyId: null, text: 'comment', spoiler: false, reactionsCount: 0, createdAt, updatedAt: createdAt }),
		};
		const notificationRepo = { insert: vi.fn() };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : entity.name === 'MiHatadyMediaComment' ? commentRepo : notificationRepo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => {
			await callback(manager);
			throw new Error('commit failed');
		}) };
		const sut = service({ db });
		await expect(sut.createComment('viewer', 'work-a', null, 'comment', false)).rejects.toThrow('commit failed');
		expect(notificationRepo.insert).toHaveBeenCalledOnce();
		expect((sut as unknown as { hatadyService: { mirrorHatadyNotification: ReturnType<typeof vi.fn> } }).hatadyService.mirrorHatadyNotification).not.toHaveBeenCalled();
	});

	test('a direct reply to the work owner is classified as mediaReply without a duplicate mediaComment', async () => {
		const createdAt = new Date();
		const workRepo = { findOne: vi.fn().mockResolvedValue(work({ visibility: 'public' })) };
		const commentRepo = {
			findOneBy: vi.fn().mockResolvedValue({ id: 'parent', workId: 'work-a', userId: 'owner' }),
			insert: vi.fn(),
			findOneByOrFail: vi.fn().mockResolvedValue({ id: 'generated', workId: 'work-a', userId: 'viewer', replyId: 'parent', text: 'reply', spoiler: false, reactionsCount: 0, createdAt, updatedAt: createdAt }),
		};
		const notificationRepo = { insert: vi.fn() };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : entity.name === 'MiHatadyMediaComment' ? commentRepo : notificationRepo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const reactionQuery = { where: vi.fn(), getMany: vi.fn().mockResolvedValue([]) };
		reactionQuery.where.mockReturnValue(reactionQuery);
		const sut = service({ db, reactionsRepository: { createQueryBuilder: vi.fn().mockReturnValue(reactionQuery) }, userEntityService: { packMany: vi.fn().mockResolvedValue([{ id: 'viewer' }]) } });
		await sut.createComment('viewer', 'work-a', 'parent', 'reply', false);
		expect(notificationRepo.insert).toHaveBeenCalledOnce();
		expect(notificationRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ notifieeId: 'owner', type: 'mediaReply', mediaCommentId: 'generated' }));
	});
});

describe('Hatady game title insertion serialization', () => {
	test('limit 0 takes the advisory lock, counts, and never inserts', async () => {
		const manager = {
			query: vi.fn().mockResolvedValue(undefined),
			getRepository: vi.fn().mockReturnValue({ countBy: vi.fn().mockResolvedValue(0), insert: vi.fn(), findOneByOrFail: vi.fn() }),
		};
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const roleService = { getUserPolicies: vi.fn().mockResolvedValue({ hatadyGameTitleLimit: 0 }) };
		const sut = service({ db, roleService });
		await expect(sut.createWork({ id: 'owner' } as never, 'game', { title: 'Game' })).rejects.toThrow(HatadyMediaService.ERR_GAME_TITLE_LIMIT);
		expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', ['hatady-media-game:owner']);
		expect(manager.getRepository().insert).not.toHaveBeenCalled();
	});

	test('game recommendation fields retain the explicit user selection', async () => {
		let inserted: Record<string, unknown> | null = null;
		const repo = {
			countBy: vi.fn().mockResolvedValue(0),
			insert: vi.fn(async (entity: Record<string, unknown>) => { inserted = entity; }),
			findOneByOrFail: vi.fn(async () => inserted),
		};
		const manager = { query: vi.fn(), getRepository: vi.fn().mockReturnValue(repo) };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const sut = service({ db });
		await sut.createWork({ id: 'owner' } as never, 'game', { title: 'Game', isRecommended: true, recommendationRating: 10 });
		expect(inserted).toMatchObject({ isRecommended: true, recommendationRating: 10 });
	});

	// 旗鯖fork(Hatady): 映画の作品作成。フォームが実際に送る形(未入力は null / 空配列)をそのまま通せること。
	test('a movie work is accepted with the exact payload the form sends', async () => {
		const inserted: Record<string, unknown>[] = [];
		const worksRepository = { insertOne: vi.fn(async (entity: Record<string, unknown>) => { inserted.push(entity); return entity; }), findOneBy: vi.fn() };
		const sut = service({ worksRepository });
		await sut.createWork({ id: 'owner' } as never, 'movie', {
			title: 'テスト映画', originalTitle: null, creator: null, status: 'planned', visibility: 'private',
			coverColorIndex: null, isFavorite: false, isRecommended: false, recommendationRating: null,
			releaseDate: null, releaseYear: null, officialUrl: null,
			synopsis: null, synopsisSpoiler: false, review: null, reviewSpoiler: false,
			genres: [], origin: null, viewingMode: null, primaryLanguage: null, runtimeMinutes: null,
			highlights: [], highlightsSpoiler: false,
		} as never);
		expect(worksRepository.insertOne).toHaveBeenCalledTimes(1);
		expect(inserted[0]).toMatchObject({ kind: 'movie', title: 'テスト映画', platforms: [], developer: null, publisher: null });
	});
});

describe('Hatady media reaction notifications', () => {
	test('repeating the same reaction neither writes nor notifies again', async () => {
		const reactionRepo = { findOneBy: vi.fn().mockResolvedValue({ id: 'reaction-a', reaction: '👍' }), update: vi.fn(), insert: vi.fn() };
		const workRepo = { findOne: vi.fn().mockResolvedValue(work({ visibility: 'public' })) };
		const manager = { query: vi.fn(), getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : reactionRepo), increment: vi.fn() };
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const sut = service({ db });
		await sut.createReaction('viewer', 'work', 'work-a', '👍');
		expect(reactionRepo.update).not.toHaveBeenCalled();
		expect(manager.getRepository).toHaveBeenCalledTimes(2);
	});

	test('a changed reaction and its notification use the same transaction manager', async () => {
		const reactionRepo = { findOneBy: vi.fn().mockResolvedValue(null), insert: vi.fn() };
		const notificationRepo = { insert: vi.fn() };
		const workRepo = { findOne: vi.fn().mockResolvedValue(work({ visibility: 'public' })) };
		const manager = {
			query: vi.fn(),
			getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaWork' ? workRepo : entity.name === 'MiHatadyMediaReaction' ? reactionRepo : notificationRepo),
			increment: vi.fn(),
		};
		const db = { transaction: vi.fn(async (callback: (manager: typeof manager) => unknown) => callback(manager)) };
		const sut = service({ db });
		await sut.createReaction('viewer', 'work', 'work-a', '👍');
		expect(reactionRepo.insert).toHaveBeenCalledOnce();
		expect(notificationRepo.insert).toHaveBeenCalledOnce();
		expect(db.transaction).toHaveBeenCalledOnce();
	});
});

describe('Hatady collection owner packing', () => {
	test.each([
		{ viewerId: 'viewer', moderator: false, thirdParty: false, privateAccess: false },
		{ viewerId: 'owner', moderator: false, thirdParty: false, privateAccess: true },
		{ viewerId: 'moderator', moderator: true, thirdParty: false, privateAccess: true },
		{ viewerId: 'moderator', moderator: true, thirdParty: true, privateAccess: false },
	])('work detail masks a private linked book for $viewerId (thirdParty=$thirdParty)', async ({ viewerId, moderator, thirdParty, privateAccess }) => {
		const now = new Date();
		const book = { id: 'privatebook', userId: 'owner', title: 'Private book', visibility: 'private', createdAt: now, updatedAt: now, details: { memo: 'private memo' } };
		const log = { id: 'publiclog', userId: 'owner', kind: 'work', title: 'Public activity', bookId: book.id, mediaWorkId: 'worka', visibility: 'public', createdAt: now, studiedAt: now, durationMinutes: 1 };
		const userEntityService = { packMany: vi.fn().mockResolvedValue([{ id: 'owner' }]) };
		const logReactions = { where: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([]) };
		const hatadyEntityService = new HatadyEntityService(
			{ findBy: vi.fn().mockResolvedValue([book]) } as never, {} as never,
			{ createQueryBuilder: vi.fn().mockReturnValue(logReactions) } as never, {} as never,
			{ findBy: vi.fn().mockResolvedValue([]) } as never, {} as never, {} as never, {} as never,
			userEntityService as never,
			{ validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) } as never,
		);
		const reactionSummary = { select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), groupBy: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), getRawMany: vi.fn().mockResolvedValue([]) };
		const hatadyService = {
			canModerate: vi.fn().mockResolvedValue(moderator),
			isBlockedEitherDirection: vi.fn().mockResolvedValue(false),
			getWorkActivities: vi.fn().mockResolvedValue({}),
			getWorkLogs: vi.fn().mockResolvedValue([log]),
		};
		const sut = service({
			worksRepository: { findOneBy: vi.fn().mockResolvedValue(work({ id: 'worka', kind: 'work', visibility: 'public' })) },
			commentsRepository: { countBy: vi.fn().mockResolvedValue(0) },
			reactionsRepository: { createQueryBuilder: vi.fn().mockReturnValue(reactionSummary), findOneBy: vi.fn().mockResolvedValue(null) },
			userEntityService, hatadyService, hatadyEntityService,
		});
		const endpoint = new HatadyMediaWorksShowEndpoint(sut);
		const result = await endpoint.exec({ workId: 'worka' }, { id: viewerId } as never, thirdParty ? { permission: ['read:account'] } as never : null, null);
		expect(result.logs).toHaveLength(1);
		expect(result.logs[0]).toMatchObject({ id: log.id, title: log.title, bookId: privateAccess ? book.id : null });
		if (privateAccess) expect(result.logs[0].book).toMatchObject({ id: book.id, details: { memo: 'private memo' } });
		else expect(result.logs[0].book).toBeNull();
		expect(hatadyService.getWorkLogs).toHaveBeenCalledWith('worka', viewerId, moderator && !thirdParty);
	});

	test('media owners are packed once as UserLite without exposing private work details', async () => {
		const userEntityService = { packMany: vi.fn().mockResolvedValue([{ id: 'owner', name: 'Owner' }]) };
		const sut = service({ userEntityService, hatadyService: { getWorkActivities: vi.fn().mockResolvedValue({}) } });
		const items = [work({ visibility: 'public', details: { genre: 'genre', memo: 'private' } }), work({ id: 'work-b', visibility: 'public' })];
		const packed = await sut.packWorks(items, 'viewer');
		expect(userEntityService.packMany).toHaveBeenCalledExactlyOnceWith(['owner'], { id: 'viewer' }, { schema: 'UserLite' });
		expect(packed.map(item => item.user)).toEqual([{ id: 'owner', name: 'Owner' }, { id: 'owner', name: 'Owner' }]);
		expect(packed[0].details).toEqual({ genre: 'genre' });
		expect((await sut.packWorks(items, 'owner'))[0].details).toEqual({ genre: 'genre', memo: 'private' });
	});

	test('a denied work detail never requests owner information', async () => {
		const userEntityService = { packMany: vi.fn() };
		const sut = service({ userEntityService, worksRepository: { findOneBy: vi.fn().mockResolvedValue(work()) } });
		await expect(sut.showWork('work-a', 'viewer')).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		expect(userEntityService.packMany).not.toHaveBeenCalled();
	});

	test('book owners are included in list and detail without making private notes public', async () => {
		const userEntityService = { packMany: vi.fn().mockResolvedValue([{ id: 'owner', name: 'Owner' }]) };
		const bookmarksRepository = { createQueryBuilder: vi.fn() };
		const sut = new HatadyEntityService({} as never, {} as never, {} as never, {} as never, {} as never, bookmarksRepository as never, {} as never, {} as never, userEntityService as never, { validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) } as never);
		const book = { id: 'book-a', userId: 'owner', title: 'Book', createdAt: new Date(), updatedAt: new Date(), visibility: 'public', details: { genre: 'genre', memo: 'private' } };
		const packed = await sut.packBooks([book as never, { ...book, id: 'book-b' } as never], 'viewer');
		expect(userEntityService.packMany).toHaveBeenCalledExactlyOnceWith(['owner'], { id: 'viewer' }, { schema: 'UserLite' });
		expect(packed).toHaveLength(2);
		expect(packed[0]).toMatchObject({ user: { id: 'owner', name: 'Owner' }, details: { genre: 'genre' }, bookmarks: [] });
		expect(packed[0].details).not.toHaveProperty('memo');
		expect(bookmarksRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(await sut.packBookWithUser(book as never, 'viewer')).toMatchObject({ user: { id: 'owner', name: 'Owner' }, details: { genre: 'genre' } });
		expect((await sut.packBookWithUser(book as never, 'owner', true)).details).toEqual({ genre: 'genre', memo: 'private' });
	});
});

describe('Hatady media notification packing', () => {
	function notificationPacker(mediaWork: MiHatadyMediaWork) {
		return new HatadyEntityService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{ findBy: vi.fn().mockResolvedValue([mediaWork]) } as never,
			{ findBy: vi.fn().mockResolvedValue([{ id: 'media-comment', workId: mediaWork.id, text: 'spoiler text', spoiler: true }]) } as never,
			{ packMany: vi.fn().mockResolvedValue([{ id: 'actor' }]) } as never,
			{ validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) } as never,
		);
	}

	const notification = {
		id: 'notification', createdAt: new Date(), type: 'mediaReply', isRead: false,
		notifieeId: 'viewer', notifierId: 'actor', logId: null, commentId: null,
		mediaWorkId: 'work-a', mediaCommentId: 'media-comment', reaction: null, value: null,
	};

	test('spoiler comments expose the stable visible IDs but never inline their text', async () => {
		const [packed] = await notificationPacker(work({ visibility: 'public' })).packNotifications([notification as never], 'viewer');
		expect(packed).toMatchObject({ mediaWorkId: 'work-a', mediaCommentId: 'media-comment', mediaCommentText: null, mediaCommentSpoiler: true });
	});

	test('IDs and content are both hidden when the work is no longer visible', async () => {
		const [packed] = await notificationPacker(work({ visibility: 'private' })).packNotifications([notification as never], 'viewer');
		expect(packed).toMatchObject({ mediaWorkId: null, mediaTitle: null, mediaCommentId: null, mediaCommentText: null });
	});
});
