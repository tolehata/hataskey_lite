/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { compareHatadyActivities, createHatadyActivityFilterFingerprint, decodeHatadyActivityCursor, encodeHatadyActivityCursor, HatadyActivityService, HATADY_ACTIVITY_INVALID_CURSOR, HATADY_ACTIVITY_INVALID_FILTER } from '@/core/HatadyActivityService.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';
import type { MiHatadyLog } from '@/models/HatadyLog.js';
import type { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';
import type { MiHatadyMediaWork } from '@/models/HatadyMediaWork.js';
import HatadyActivitiesEndpoint from '@/server/api/endpoints/hata/hatady/activities.js';

function queryBuilder(rows: unknown[]) {
	const qb: Record<string, ReturnType<typeof vi.fn>> = {};
	for (const method of ['innerJoin', 'leftJoin', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'take']) qb[method] = vi.fn().mockReturnValue(qb);
	qb.getMany = vi.fn().mockResolvedValue(rows);
	return qb;
}

function mediaWork(overrides: Partial<MiHatadyMediaWork> = {}): MiHatadyMediaWork {
	return {
		id: 'work', createdAt: new Date('2026-08-01T00:00:00Z'), updatedAt: new Date('2026-08-01T00:00:00Z'), userId: 'owner', user: null,
		kind: 'movie', title: '作品', originalTitle: null, creator: null, releaseDate: null, releaseYear: null, status: 'completed', visibility: 'public',
		isFavorite: false, isRecommended: true, recommendationRating: 9, coverColorIndex: 2,
		synopsis: 'あらすじ', synopsisSpoiler: true, review: '感想', reviewSpoiler: true, officialUrl: null,
		runtimeMinutes: 120, genres: [], origin: 'domestic', viewingMode: 'original', primaryLanguage: 'ja', highlights: ['見どころ'], highlightsSpoiler: true,
		platforms: [], developer: null, publisher: null, details: {},
		...overrides,
	};
}

function mediaSession(id: string, occurredAt: string, overrides: Partial<MiHatadyMediaSession> = {}): MiHatadyMediaSession {
	return {
		id, createdAt: new Date(occurredAt), updatedAt: new Date(occurredAt), userId: 'owner', user: null, workId: 'work', work: null,
		fileIds: [], durationSeconds: 7200, startedAt: null, tags: [], workSnapshot: { title: '作品', kind: 'movie' },
		kind: 'movie_viewing', occurredAt: new Date(occurredAt), durationMinutes: 120, note: '結末', noteSpoiler: true, visibility: 'public', details: { ending: 'secret' },
		...overrides,
	};
}

describe('Hatady activities endpoint contract', () => {
	test('its concrete schema compiles with the endpoint validator', () => {
		expect(() => new HatadyActivitiesEndpoint({} as never)).not.toThrow();
	});
});

describe('Hatady activity cursor', () => {
	test('is filter-bound and rejects reuse with a different scope or kind set', () => {
		const recent = createHatadyActivityFilterFingerprint({ scope: 'recent', kinds: ['study', 'movie'], sinceDate: null, untilDate: null });
		const following = createHatadyActivityFilterFingerprint({ scope: 'following', kinds: ['study', 'movie'], sinceDate: null, untilDate: null });
		const cursor = encodeHatadyActivityCursor({ source: 1, id: 'log', occurredAt: new Date('2026-08-01T00:00:00Z'), score: 0 }, recent, 'recent');
		expect(decodeHatadyActivityCursor(cursor, recent, 'recent')).toMatchObject({ s: 1, id: 'log' });
		expect(() => decodeHatadyActivityCursor(cursor, following, 'following')).toThrow(HATADY_ACTIVITY_INVALID_CURSOR);
	});

	test('uses occurrence time, source and id as stable chronological tie breakers', () => {
		const time = new Date('2026-08-01T00:00:00Z');
		const study = { source: 1 as const, id: 'a', occurredAt: time, score: 0, log: {} as MiHatadyLog };
		const media = { source: 0 as const, id: 'z', occurredAt: time, score: 0, session: {} as MiHatadyMediaSession, work: {} as MiHatadyMediaWork };
		expect([media, study].sort((a, b) => compareHatadyActivities(a, b, 'recent'))).toEqual([study, media]);
	});

	test('rejects timestamps outside the database-supported activity range before querying', () => {
		expect(() => createHatadyActivityFilterFingerprint({ scope: 'recent', kinds: ['study'], sinceDate: -1, untilDate: null })).toThrow(HATADY_ACTIVITY_INVALID_FILTER);
		const fingerprint = createHatadyActivityFilterFingerprint({ scope: 'recent', kinds: ['study'], sinceDate: null, untilDate: null });
		const cursor = encodeHatadyActivityCursor({ source: 1, id: 'log', occurredAt: new Date(-1), score: 0 }, fingerprint, 'recent');
		expect(() => decodeHatadyActivityCursor(cursor, fingerprint, 'recent')).toThrow(HATADY_ACTIVITY_INVALID_CURSOR);
	});

	test('makes the popular contract learning-only instead of silently returning an empty media feed', async () => {
		const service = new HatadyActivityService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
		await expect(service.list({ id: 'viewer' } as never, { scope: 'popular', kinds: ['movie'], limit: 20 })).rejects.toThrow(HATADY_ACTIVITY_INVALID_FILTER);
	});
});

describe('Hatady activity visibility and spoiler boundary', () => {
	test('reads independently public sessions, uses limit+1, and redacts spoiler bodies in the feed', async () => {
		const sessions = [mediaSession('s3', '2026-08-03T00:00:00Z'), mediaSession('s2', '2026-08-02T00:00:00Z'), mediaSession('s1', '2026-08-01T00:00:00Z')];
		const qb = queryBuilder(sessions);
		const work = mediaWork();
		const service = new HatadyActivityService(
			{ createQueryBuilder: vi.fn() } as never,
			{ createQueryBuilder: vi.fn().mockReturnValue(qb) } as never,
			{ findBy: vi.fn().mockResolvedValue([work]) } as never,
			{ canAppearInTimeline: vi.fn().mockResolvedValue(true), getTimelineExcludedUserIds: vi.fn().mockResolvedValue(new Set(['blocked-user'])) } as never,
			{
				getSessionEngagement: vi.fn().mockResolvedValue(new Map()), canViewSession: vi.fn().mockResolvedValue(true), canViewWork: vi.fn().mockResolvedValue(true),
				packWork: vi.fn().mockReturnValue({ ...work, createdAt: work.createdAt.toISOString(), updatedAt: work.updatedAt.toISOString() }),
				packSessions: vi.fn(async (sessions: MiHatadyMediaSession[]) => sessions.map(session => ({ ...session, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString(), occurredAt: session.occurredAt.toISOString() }))),
			} as never,
			{ packLogs: vi.fn().mockResolvedValue([]) } as never,
			{ packMany: vi.fn().mockResolvedValue([{ id: 'owner' }]) } as never,
		);
		const result = await service.list({ id: 'viewer' } as never, { scope: 'recent', kinds: ['movie'], limit: 2 });

		expect(qb.where).toHaveBeenCalledWith('session.visibility = \'public\'');
		expect(qb.andWhere).not.toHaveBeenCalledWith('activity_work.visibility = \'public\'');
		expect(qb.andWhere).toHaveBeenCalledWith('session.userId NOT IN (:...activityExcludedUserIds)', { activityExcludedUserIds: ['blocked-user'] });
		expect(qb.take).toHaveBeenCalledWith(3);
		expect(result).toMatchObject({ hasMore: true, nextCursor: expect.any(String) });
		expect(result.items).toHaveLength(2);
		expect(result.items[0]).toMatchObject({
			type: 'movie_viewing',
			media: {
				work: { synopsis: null, review: null, highlights: [] },
				session: { note: null, details: {}, noteSpoiler: true },
			},
		});
	});

	test('keeps spoiler content for the owner so My Log can render its explicit spoiler fold', async () => {
		const session = mediaSession('mine', '2026-08-03T00:00:00Z');
		const qb = queryBuilder([session]);
		const work = mediaWork();
		const service = new HatadyActivityService(
			{ createQueryBuilder: vi.fn() } as never,
			{ createQueryBuilder: vi.fn().mockReturnValue(qb) } as never,
			{ findBy: vi.fn().mockResolvedValue([work]) } as never,
			{ canAppearInTimeline: vi.fn().mockResolvedValue(true), getTimelineExcludedUserIds: vi.fn().mockResolvedValue(new Set()) } as never,
			{ getSessionEngagement: vi.fn().mockResolvedValue(new Map()), canViewSession: vi.fn().mockResolvedValue(true), canViewWork: vi.fn().mockResolvedValue(true), packWork: vi.fn().mockReturnValue(work), packSessions: vi.fn().mockResolvedValue([session]) } as never,
			{ packLogs: vi.fn().mockResolvedValue([]) } as never,
			{ packMany: vi.fn().mockResolvedValue([{ id: 'owner' }]) } as never,
		);
		const result = await service.list({ id: 'owner' } as never, { scope: 'mine', kinds: ['movie'], limit: 10 });
		expect(result.items[0]).toMatchObject({ isMine: true, media: { work: { synopsis: 'あらすじ' }, session: { note: '結末', details: { ending: 'secret' } } } });
	});
});

describe('Hatady learning reaction authorization', () => {
	function learningService(overrides: Record<string, unknown> = {}) {
		const defaults = {
			books: {}, logs: { findOneBy: vi.fn() }, comments: { findOneBy: vi.fn() }, reactions: { findOneBy: vi.fn(), insertOne: vi.fn() }, notifications: { insertOne: vi.fn() },
			followings: { countBy: vi.fn().mockResolvedValue(0), findOne: vi.fn().mockResolvedValue(null) }, profiles: {}, bookmarks: {}, memos: {}, subjects: {}, goals: {},
			// 旗鯖fork(Hatady次期: ゲーム/映画記録): HatadyService は連続記録・プロフィール集計で
			//   メディアセッションも合算するようになったため、既定では空の結果を返すスタブを渡す。
			mediaSessions: { createQueryBuilder: vi.fn().mockReturnValue(queryBuilder([])), findBy: vi.fn().mockResolvedValue([]), countBy: vi.fn().mockResolvedValue(0) },
			id: { gen: vi.fn().mockReturnValue('generated') }, role: {},
			cache: {
				userMutingsCache: { fetch: vi.fn().mockResolvedValue(new Set()) },
				userBlockingCache: { fetch: vi.fn().mockResolvedValue(new Set()) },
				userBlockedCache: { fetch: vi.fn().mockResolvedValue(new Set()) },
			},
			blocking: { checkBlocked: vi.fn().mockResolvedValue(false) },
			push: { pushNotification: vi.fn().mockResolvedValue(undefined) },
			...overrides,
		};
		const logs = defaults.logs as { findOneBy: ReturnType<typeof vi.fn>; findOne?: ReturnType<typeof vi.fn>; update?: ReturnType<typeof vi.fn> };
		const comments = defaults.comments as { findOneBy: ReturnType<typeof vi.fn>; findOne?: ReturnType<typeof vi.fn>; update?: ReturnType<typeof vi.fn> };
		const reactions = defaults.reactions as { manager?: unknown };
		const manager = {
			getRepository: vi.fn((entity: { name: string }) => {
				if (entity.name === 'MiHatadyLog') return { ...logs, findOne: logs.findOne ?? logs.findOneBy };
				if (entity.name === 'MiHatadyComment') return { ...comments, findOne: comments.findOne ?? comments.findOneBy };
				if (entity.name === 'MiHatadyFollowing') return defaults.followings;
				if (entity.name === 'MiHatadyNotification') return defaults.notifications;
				return defaults.reactions;
			}),
		};
		reactions.manager = { transaction: vi.fn(async (callback: (tx: typeof manager) => unknown) => callback(manager)) };
		(comments as any).manager = reactions.manager;
		return { service: new HatadyService({ onHatadyCreated: vi.fn() } as never, defaults.books as never, defaults.logs as never, defaults.comments as never, defaults.reactions as never, defaults.notifications as never, defaults.followings as never, defaults.profiles as never, defaults.bookmarks as never, defaults.memos as never, defaults.subjects as never, defaults.goals as never, defaults.mediaSessions as never, defaults.id as never, defaults.role as never, defaults.cache as never, defaults.blocking as never, defaults.push as never, { validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) } as never, { changed: vi.fn() } as never, { createNotificationAsync: vi.fn().mockResolvedValue({}) } as never), defaults };
	}

	test('rejects a known private log ID before reading or writing a reaction row', async () => {
		const log = { id: 'private-log', userId: 'owner', visibility: 'private', isPublic: false };
		const reactions = { findOneBy: vi.fn(), insert: vi.fn() };
		const { service } = learningService({ logs: { findOneBy: vi.fn().mockResolvedValue(log) }, reactions });
		await expect(service.react({ id: 'attacker' } as never, { logId: 'private-log' }, ':x:')).rejects.toThrow('no such target or access denied');
		expect(reactions.findOneBy).not.toHaveBeenCalled();
		expect(reactions.insert).not.toHaveBeenCalled();
	});

	test('rejects a whitespace-only reaction before opening a transaction', async () => {
		const { service, defaults } = learningService();
		await expect(service.react({ id: 'viewer' } as never, { logId: 'log' }, '   ')).rejects.toThrow('empty reaction');
		expect(((defaults.reactions as { manager: { transaction: ReturnType<typeof vi.fn> } }).manager).transaction).not.toHaveBeenCalled();
	});

	test('applies Misskey blocks in both directions to Hatady reads and follows', async () => {
		const checkBlocked = vi.fn(async (blockerId: string, blockeeId: string) => blockerId === 'owner' && blockeeId === 'viewer');
		const { service, defaults } = learningService({ blocking: { checkBlocked } });
		await expect(service.canViewLog({ userId: 'owner', visibility: 'public' } as never, 'viewer')).resolves.toBe(false);
		await expect(service.follow({ id: 'viewer' } as never, 'owner')).rejects.toThrow('access denied');
		expect((defaults.followings as any).insertOne).toBeUndefined();
		expect(checkBlocked).toHaveBeenCalledWith('owner', 'viewer');
	});

	test('excludes Misskey-muted users from Hatady timelines without treating mute as a write block', async () => {
		const { service } = learningService({ cache: {
			userMutingsCache: { fetch: vi.fn().mockResolvedValue(new Set(['muted'])) },
			userBlockingCache: { fetch: vi.fn().mockResolvedValue(new Set()) },
			userBlockedCache: { fetch: vi.fn().mockResolvedValue(new Set()) },
		} });
		await expect(service.canAppearInTimeline('muted', 'viewer')).resolves.toBe(false);
		await expect(service.canAppearInTimeline('visible', 'viewer')).resolves.toBe(true);
	});

	test('does not let another user delete a Hatady comment', async () => {
		const findOne = vi.fn().mockResolvedValue(null);
		const remove = vi.fn();
		const { service } = learningService({ comments: { findOneBy: vi.fn(), findOne, delete: remove } });
		await expect(service.deleteComment({ id: 'attacker' } as never, 'comment')).rejects.toThrow('no such comment or access denied');
		expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'comment', userId: 'attacker' } }));
		expect(remove).not.toHaveBeenCalled();
	});

	test('uses the same followers visibility boundary for profile totals as for visible logs', async () => {
		const qb = queryBuilder([{ durationMinutes: 45, studiedAt: new Date(), tag: null, subject: '映画史' }]);
		const countBy = vi.fn(async (where: Record<string, string>) => where.followerId === 'viewer' && where.followeeId === 'owner' ? 1 : 0);
		const { service } = learningService({
			books: { countBy: vi.fn().mockResolvedValue(0) },
			logs: { createQueryBuilder: vi.fn().mockReturnValue(qb), findBy: vi.fn().mockResolvedValue([{ id: 'log', durationSeconds: 2700, studiedAt: new Date(), tags: [], subject: '映画史', kind: 'study' }]) },
			followings: { countBy },
			profiles: { findOneBy: vi.fn().mockResolvedValue(null) },
		});
		const result = await service.getProfileAggregates('owner', 'viewer');
		expect(qb.andWhere).toHaveBeenCalledWith('log.visibility IN (:...vis)', { vis: ['public', 'followers'] });
		expect(result).toMatchObject({ totalMinutes: 45, logCount: 1, isFollowing: true });
	});

	test('checks a comment through its parent log visibility', async () => {
		const reactions = { findOneBy: vi.fn(), insert: vi.fn() };
		const { service } = learningService({
			logs: { findOneBy: vi.fn().mockResolvedValue({ id: 'private-log', userId: 'owner', visibility: 'private', isPublic: false }) },
			comments: { findOneBy: vi.fn().mockResolvedValue({ id: 'comment', logId: 'private-log', userId: 'owner' }) },
			reactions,
		});
		await expect(service.react({ id: 'attacker' } as never, { commentId: 'comment' }, ':x:')).rejects.toThrow('no such target or access denied');
		expect(reactions.findOneBy).not.toHaveBeenCalled();
	});

	test('locks authorization, reaction, count and notification into one transaction', async () => {
		const logs = {
			findOneBy: vi.fn().mockResolvedValue({ id: 'public-log', userId: 'owner', visibility: 'public', isPublic: true }),
			update: vi.fn(),
		};
		const reactions = { findOneBy: vi.fn().mockResolvedValue(null), insert: vi.fn(), countBy: vi.fn().mockResolvedValue(1) };
		const notifications = { insert: vi.fn() };
		const { service, defaults } = learningService({ logs, reactions, notifications });
		await service.react({ id: 'viewer' } as never, { logId: 'public-log' }, ':x:');
		expect(reactions.insert).toHaveBeenCalledOnce();
		expect(logs.update).toHaveBeenCalledWith('public-log', { reactionsCount: 1 });
		expect(notifications.insert).toHaveBeenCalledWith(expect.objectContaining({ notifieeId: 'owner', logId: 'public-log', reaction: ':x:' }));
		expect((service as unknown as { notificationService: { createNotificationAsync: ReturnType<typeof vi.fn> } }).notificationService.createNotificationAsync)
			.toHaveBeenCalledWith('owner', 'hatady', expect.objectContaining({ sourceNotificationId: expect.any(String), subtype: 'reaction', targetType: 'log', targetId: 'public-log' }), 'viewer');
		expect(((defaults.reactions as { manager: { transaction: ReturnType<typeof vi.fn> } }).manager).transaction).toHaveBeenCalledOnce();
	});
});

describe('Hatady learning notification visibility re-evaluation', () => {
	test('removes IDs and content after the referenced log becomes private', async () => {
		const packer = new HatadyEntityService(
			{} as never,
			{ findBy: vi.fn().mockResolvedValue([{ id: 'private-log', userId: 'owner', visibility: 'private', isPublic: false, title: 'secret' }]) } as never,
			{} as never,
			{ findBy: vi.fn().mockResolvedValue([{ id: 'comment', logId: 'private-log', text: 'secret reply' }]) } as never,
			{ createQueryBuilder: vi.fn() } as never,
			{} as never,
			{ findBy: vi.fn().mockResolvedValue([]) } as never,
			{ findBy: vi.fn().mockResolvedValue([]) } as never,
			{ packMany: vi.fn().mockResolvedValue([{ id: 'actor' }]) } as never,
			{ validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) } as never,
		);
		const [packed] = await packer.packNotifications([{
			id: 'notification', createdAt: new Date(), notifieeId: 'viewer', notifierId: 'actor', type: 'reaction', isRead: false,
			logId: 'private-log', commentId: 'comment', mediaWorkId: null, mediaCommentId: null, reaction: ':x:', value: null,
		} as never], 'viewer');
		expect(packed).toMatchObject({ logId: null, logTitle: null, commentId: null, commentText: null });
	});
});
