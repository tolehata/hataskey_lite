/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HATADY_MAX_DURATION_SECONDS, mergeHatadyDetails, normalizeHatadyDuration, normalizeHatadyStartedAt, normalizeHatadyTags, packHatadyDetails } from '@/core/HatadyRecordData.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyMediaService, validateHatadyMediaSessionDetails } from '@/core/HatadyMediaService.js';
import type { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';

describe('Hatady additive record compatibility', () => {
	test('keeps precise seconds when unrelated fields change and distinguishes an empty duration from zero', () => {
		expect(normalizeHatadyDuration({}, { durationSeconds: 61, durationMinutes: 1 })).toBe(61);
		expect(normalizeHatadyDuration({ durationMinutes: 2 }, { durationSeconds: 61 })).toBe(120);
		expect(normalizeHatadyDuration({ durationSeconds: null, durationMinutes: 2 })).toBeNull();
		expect(normalizeHatadyDuration({ durationSeconds: 0 })).toBe(0);
		expect(normalizeHatadyDuration({}, { durationMinutes: 2_147_483_647 })).toBe(HATADY_MAX_DURATION_SECONDS);
		for (const value of [-1, 0.5, Infinity, HATADY_MAX_DURATION_SECONDS + 1]) expect(() => normalizeHatadyDuration({ durationSeconds: value })).toThrow('invalid durationSeconds');
	});

	test('round-trips clock precision without inventing a start time', () => {
		for (const value of ['00:00', '23:59:59', '09:08:07.001', '09:08:07.10']) expect(normalizeHatadyStartedAt(value)).toBe(value);
		expect(normalizeHatadyStartedAt(null)).toBeNull();
		for (const value of ['24:00', '09:60', '09:08:60', '09:08:07.1234', '9:08', '09:08Z']) expect(() => normalizeHatadyStartedAt(value)).toThrow('invalid startedAt');
	});

	test('preserves stored unknown tags and details while rejecting newly introduced unknown input', () => {
		expect(normalizeHatadyTags(['effort'], ['interest', 'future-tag'])).toEqual(['effort', 'future-tag']);
		expect(() => normalizeHatadyTags(['new-unknown'])).toThrow('invalid tags');
		const stored = { genre: '読書', memo: '自分用', future: { nested: [1, 2] } };
		expect(mergeHatadyDetails(stored, { description: '紹介' }, 'work')).toEqual({ ...stored, description: '紹介' });
		expect(() => mergeHatadyDetails(stored, { future: 'changed' }, 'work')).toThrow('invalid future');
		expect(packHatadyDetails(stored, false)).toEqual({ genre: '読書' });
		expect(packHatadyDetails(stored, true)).toEqual(stored);
	});

	test('keeps old profile image bytes and unknown options when the new designer edits a known option', () => {
		const stored = { image: 'saved-old-image', future: { value: 1 }, layout: 'bento' };
		expect(mergeHatadyDetails(stored, { layout: 'gallery' }, 'profile')).toEqual({ ...stored, layout: 'gallery' });
		expect(() => mergeHatadyDetails(stored, { image: 'different' }, 'profile')).toThrow('invalid image');
	});

	test('does not erase unknown media details or weapon row properties on an ordinary edit', () => {
		const prior = { future: { key: 1 }, weaponStats: [{ weapon: '', futureRow: 'saved', kills: 2 }] };
		expect(validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: '', futureRow: 'saved', kills: 3 }] }, prior)).toEqual({ future: { key: 1 }, weaponStats: [{ weapon: '', futureRow: 'saved', kills: 3 }] });
		expect(() => validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: 'new', futureRow: 'forged' }] })).toThrow('invalid weaponStats field');
	});

	test('public sessions remain readable independently of private or deleted works, with block and staff boundaries', async () => {
		const service = Object.create(HatadyMediaService.prototype) as HatadyMediaService;
		const blocked = vi.fn().mockResolvedValue(false), canModerate = vi.fn().mockResolvedValue(false);
		Object.assign(service, { hatadyService: { isBlockedEitherDirection: blocked, canModerate }, hatadyFollowingsRepository: { existsBy: vi.fn().mockResolvedValue(false) } });
		const session = { userId: 'owner', visibility: 'public' } as MiHatadyMediaSession;
		expect(await service.canViewSession(session, null, 'viewer')).toBe(true);
		blocked.mockResolvedValue(true);
		expect(await service.canViewSession(session, null, 'viewer')).toBe(false);
		canModerate.mockResolvedValue(true);
		expect(await service.canViewSession({ ...session, visibility: 'private' }, null, 'viewer')).toBe(false);
		expect(await service.canViewSession({ ...session, visibility: 'private' }, null, 'viewer', true)).toBe(true);
	});

	test('edits a surviving media session after its work is deleted without resetting precision or opaque details', async () => {
		const stored = { id: 'session', userId: 'owner', workId: null, kind: 'movie_viewing', occurredAt: new Date('2026-09-10T00:00:00Z'), durationSeconds: 61, durationMinutes: 1, startedAt: '09:00:01.125', tags: ['interest'], note: 'old', noteSpoiler: false, visibility: 'private', details: { future: { value: 2 } } };
		const repo = { findOne: vi.fn().mockResolvedValue(stored), findOneByOrFail: vi.fn(async () => stored), update: vi.fn(async (_where: unknown, patch: Record<string, unknown>) => Object.assign(stored, patch)) };
		const manager = { getRepository: vi.fn(() => repo) };
		const service = Object.create(HatadyMediaService.prototype) as HatadyMediaService;
		Object.assign(service, { db: { transaction: async (callback: (manager: unknown) => unknown) => callback(manager), getRepository: () => ({ findBy: vi.fn().mockResolvedValue([]) }) }, sessionsRepository: repo, hatadyService: { refreshHatadyNotificationRows: vi.fn().mockResolvedValue(undefined) } });
		await service.updateSession('owner', 'session', { note: 'new' });
		expect(stored).toMatchObject({ id: 'session', workId: null, durationSeconds: 61, startedAt: '09:00:01.125', tags: ['interest'], details: { future: { value: 2 } }, note: 'new' });
	});

	test('deletes and restores only the fixed notification IDs belonging to the recipient', async () => {
		const update = vi.fn(), refreshSourceNotifications = vi.fn().mockResolvedValue(undefined);
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadyNotificationsRepository: { update, findBy: vi.fn(async ({ id }: { id: { _value: string[] } }) => id._value.map(value => ({ id: value, notifieeId: 'recipient' }))) }, notificationService: { refreshSourceNotifications } });
		await service.setNotificationsDeleted('recipient', ['n1', 'n2'], true);
		expect(update.mock.calls[0][0]).toMatchObject({ notifieeId: 'recipient', id: expect.objectContaining({ _value: ['n1', 'n2'] }) });
		expect(update.mock.calls[0][1].deletedAt).toBeInstanceOf(Date);
		await service.setNotificationsDeleted('recipient', ['n1'], false);
		expect(update.mock.calls[1][0]).toMatchObject({ notifieeId: 'recipient', id: expect.objectContaining({ _value: ['n1'] }) });
		expect(update.mock.calls[1][1]).toEqual({ deletedAt: null });
		expect(refreshSourceNotifications).toHaveBeenNthCalledWith(1, 'recipient', 'hatady', ['n1', 'n2']);
		expect(refreshSourceNotifications).toHaveBeenNthCalledWith(2, 'recipient', 'hatady', ['n1']);
		await expect(service.setNotificationsDeleted('recipient', [], true)).rejects.toThrow('invalid notification IDs');
	});

	test('clears only explicitly emptied media fields and keeps saved unknown choices and reordered row metadata', () => {
		const previous = { viewingMode: 'old-mode', theaterName: 'old venue', future: 'saved' };
		expect(validateHatadyMediaSessionDetails('movie_viewing', { viewingMode: 'old-mode', theaterName: null }, previous)).toEqual({ viewingMode: 'old-mode', future: 'saved' });
		expect(() => validateHatadyMediaSessionDetails('movie_viewing', { viewingMode: 'new-mode' }, previous)).toThrow('invalid viewingMode');
		expect(normalizeHatadyTags(['future-tag', 'effort'], ['future-tag'])).toEqual(['future-tag', 'effort']);
		const rows = { weaponStats: [{ weapon: 'A', futureRow: 'first', kills: 1 }, { weapon: 'B', futureRow: 'second', kills: 2 }] };
		expect(validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: 'B', futureRow: 'second', kills: null }] }, rows)).toEqual({ weaponStats: [{ weapon: 'B', futureRow: 'second', kills: null }] });
		expect(validateHatadyMediaSessionDetails('game_match', { weaponStats: [{ weapon: 'renamed B', futureRow: 'second', kills: 4 }] }, rows)).toEqual({ weaponStats: [{ weapon: 'renamed B', futureRow: 'second', kills: 4 }] });
		expect(mergeHatadyDetails({}, { spoiler: true }, 'log')).toEqual({ spoiler: true });
	});

	test('validates an invalid record before changing linked book progress', async () => {
		const update = vi.fn(), insertOne = vi.fn();
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadyBooksRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 'book', userId: 'owner', currentPage: 1 }), update }, hatadyLogsRepository: { insertOne } });
		await expect(service.createLog({ id: 'owner' } as never, { title: 'record', subject: 'subject', bookId: 'book', pageTo: 20, startedAt: '25:00' })).rejects.toThrow('invalid startedAt');
		expect(update).not.toHaveBeenCalled();
		expect(insertOne).not.toHaveBeenCalled();
	});

	test('keeps session interactions on the session and denies private writes even to a read-authorized moderator', async () => {
		const session = { id: 'session', userId: 'owner', workId: null, visibility: 'private' };
		const insert = vi.fn(), findOneBy = vi.fn().mockResolvedValue(null);
		const reactionRepo = { insert, findOneBy };
		const sessionRepo = { findOne: vi.fn().mockResolvedValue(session) };
		const manager = { query: vi.fn(), getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadyMediaSession' ? sessionRepo : reactionRepo) };
		const service = Object.create(HatadyMediaService.prototype) as HatadyMediaService;
		Object.assign(service, { db: { transaction: async (callback: (manager: unknown) => unknown) => callback(manager) }, idService: { gen: () => 'new' }, hatadyService: { canModerate: vi.fn().mockResolvedValue(true), isBlockedEitherDirection: vi.fn().mockResolvedValue(false), pushHatadyNotification: vi.fn() }, hatadyFollowingsRepository: { existsBy: vi.fn().mockResolvedValue(false) } });
		await expect(service.createReaction('moderator', 'session', 'session', '👍')).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		await expect(service.createComment('moderator', null, null, 'reply', false, 'session')).rejects.toThrow(HatadyMediaService.ERR_NOT_FOUND);
		expect(insert).not.toHaveBeenCalled();
		await service.createReaction('owner', 'session', 'session', '👍');
		expect(findOneBy).toHaveBeenCalledWith({ userId: 'owner', sessionId: 'session' });
		expect(insert).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session', workId: null, commentId: null, userId: 'owner' }));
	});

	test('renames only owned subject rows and logs in the same transaction while preserving the registry ID', async () => {
		const updateSubject = vi.fn(), updateLog = vi.fn();
		const subjects = { findOne: vi.fn().mockResolvedValue({ id: 'saved-id', userId: 'owner', name: 'old' }), existsBy: vi.fn().mockResolvedValue(false), update: updateSubject };
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadySubject' ? subjects : { update: updateLog }) };
		const transaction = vi.fn(async (callback: (manager: unknown) => unknown) => callback(manager));
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadySubjectsRepository: { manager: { transaction }, findOneBy: vi.fn().mockResolvedValue({ name: 'new', color: '#abc' }) } });
		await service.saveSubject('owner', 'new', '#abc', 'old');
		expect(transaction).toHaveBeenCalledOnce();
		expect(updateSubject).toHaveBeenCalledWith({ id: 'saved-id', userId: 'owner' }, expect.objectContaining({ name: 'new', color: '#abc' }));
		expect(updateLog).toHaveBeenCalledWith({ userId: 'owner', subject: 'old' }, { subject: 'new' });
		subjects.existsBy.mockResolvedValue(true); updateSubject.mockClear(); updateLog.mockClear();
		await expect(service.saveSubject('owner', 'existing', '#abc', 'old')).rejects.toThrow('subject name already exists');
		expect(updateSubject).not.toHaveBeenCalled(); expect(updateLog).not.toHaveBeenCalled();
	});

	test('ensures an existing subject without changing its color, including concurrent first use', async () => {
		let saved: { name: string; color: string | null } | null = { name: '数学', color: '#abc' };
		const execute = vi.fn(async () => { saved ??= { name: '数学', color: null }; });
		const builder = { insert: vi.fn().mockReturnThis(), into: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), orIgnore: vi.fn().mockReturnThis(), execute };
		const findOneBy = vi.fn(async () => saved);
		const update = vi.fn();
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadySubjectsRepository: { createQueryBuilder: () => builder, findOneBy, update }, idService: { gen: () => 'new-id' } });
		expect(await service.saveSubject('owner', '数学')).toEqual({ name: '数学', color: '#abc' });
		expect(update).not.toHaveBeenCalled();
		expect(builder.orIgnore).toHaveBeenCalledOnce();
		saved = null;
		const firstUses = await Promise.all([service.saveSubject('owner', '数学'), service.saveSubject('owner', '数学')]);
		expect(firstUses).toEqual([{ name: '数学', color: null }, { name: '数学', color: null }]);
		expect(execute).toHaveBeenCalledTimes(3);
	});

	test('keeps the saved color on a rename without a color parameter and clears it on explicit null', async () => {
		const row = { id: 'subject-id', userId: 'owner', name: 'old', color: '#abc' as string | null };
		const subjects = {
			findOne: vi.fn().mockResolvedValue(row), existsBy: vi.fn().mockResolvedValue(false),
			update: vi.fn(async (_where: unknown, patch: Partial<typeof row>) => Object.assign(row, patch)),
		};
		const manager = { getRepository: vi.fn((entity: { name: string }) => entity.name === 'MiHatadySubject' ? subjects : { update: vi.fn() }) };
		const service = Object.create(HatadyService.prototype) as HatadyService;
		const findOneBy = vi.fn(async () => row);
		Object.assign(service, { hatadySubjectsRepository: { manager: { transaction: async (callback: (manager: unknown) => unknown) => callback(manager) }, findOneBy, update: subjects.update }, idService: { gen: () => 'new-id' } });
		expect(await service.saveSubject('owner', 'new', undefined, 'old')).toEqual({ name: 'new', color: '#abc' });
		expect(subjects.update.mock.calls[0][1]).not.toHaveProperty('color');
		expect(await service.saveSubject('owner', 'new', null)).toEqual({ name: 'new', color: null });
		expect(subjects.update).toHaveBeenLastCalledWith({ id: 'subject-id', userId: 'owner' }, expect.objectContaining({ color: null }));
	});

	test('computes minute goals from measured seconds without rounding or a legacy minute fallback', async () => {
		const builder = { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getRawOne: vi.fn().mockResolvedValue({ sum: '61' }) };
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadyLogsRepository: { createQueryBuilder: vi.fn().mockReturnValue(builder) } });
		const goal = { metricType: 'minutes', metricTarget: 2, userId: 'owner', createdAt: new Date('2026-09-01'), targetDate: new Date('2026-09-30') };
		expect(await service.getGoalProgress(goal as never)).toEqual({ current: 61 / 60, target: 2, percent: 51 });
		expect(builder.select).toHaveBeenCalledWith('COALESCE(SUM(log.durationSeconds), 0)', 'sum');
		for (const [seconds, minutes] of [[60, 1], [180, 3]] as const) {
			builder.getRawOne.mockResolvedValue({ sum: String(seconds) });
			expect((await service.getGoalProgress(goal as never)).current).toBe(minutes);
		}
		builder.getRawOne.mockResolvedValue({ sum: '0' });
		expect(await service.getGoalProgress(goal as never)).toMatchObject({ current: 0, percent: 0 });
	});

	test('aggregates all six categories with exact seconds, untimed counts, and kind-filtered detail', async () => {
		const now = new Date();
		const logs = [
			{ id: 'study', kind: 'study', studiedAt: now, durationSeconds: 61, startedAt: '12:34:56.789', subject: '本', tags: ['interest'] },
			{ id: 'exercise', kind: 'exercise', studiedAt: now, durationSeconds: 37, startedAt: null, subject: '散歩', tags: ['effort'] },
			{ id: 'work', kind: 'work', studiedAt: now, durationSeconds: null, startedAt: null, subject: '制作', tags: ['progress'] },
			{ id: 'cooking', kind: 'cooking', studiedAt: now, durationSeconds: null, startedAt: null, subject: '料理', tags: [] },
		];
		const sessions = [
			{ id: 'movie', kind: 'movie_viewing', occurredAt: now, durationSeconds: 0, startedAt: null, tags: [], workSnapshot: { genre: '映画' } },
			{ id: 'game', kind: 'game_play', occurredAt: now, durationSeconds: 3601, startedAt: '13:00', tags: ['recommend'], workSnapshot: { genre: 'ゲーム' } },
		];
		const bookQuery = { select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), getRawMany: vi.fn().mockResolvedValue([]) };
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadyLogsRepository: { findBy: vi.fn().mockResolvedValue(logs) }, hatadyMediaSessionsRepository: { findBy: vi.fn().mockResolvedValue(sessions) }, hatadyBooksRepository: { createQueryBuilder: () => bookQuery } });
		const all = await service.getStatsDetail('owner', 1, 0, 'all');
		expect(all.totalSeconds).toBe(3699);
		expect(all.activityKinds.map(row => row.kind)).toEqual(['study', 'movie', 'game', 'exercise', 'work', 'cooking']);
		expect(all.monthlyTotals[0]).toMatchObject({ seconds: 3699, count: 6, timedCount: 4 });
		expect(all.hourlyCounts[12]).toBe(1); expect(all.hourlyCounts[13]).toBe(1);
		const exercise = await service.getStatsDetail('owner', 1, 0, 'exercise');
		expect(exercise.monthlyTotals[0]).toMatchObject({ seconds: 37, count: 1, timedCount: 1 });
		expect(exercise.bests.longestSessionSeconds).toBe(37);
	});

	test('saves precise record data and linked book progress atomically when insertion fails', async () => {
		let page = 1, saved: Record<string, unknown> | null = null, fail = false;
		const transaction = async (callback: (manager: unknown) => unknown) => {
			let pendingPage = page, pendingRecord = saved;
			const books = { findOne: async () => ({ id: 'book', userId: 'owner', currentPage: pendingPage }), update: async (_id: unknown, patch: { currentPage?: number }) => { if (patch.currentPage != null) pendingPage = patch.currentPage; } };
			const logs = { insert: async (record: Record<string, unknown>) => { if (fail) throw new Error('insert failed'); pendingRecord = record; }, findOneByOrFail: async () => pendingRecord };
			const value = await callback({ getRepository: (entity: { name: string }) => entity.name === 'MiHatadyBook' ? books : logs });
			page = pendingPage; saved = pendingRecord; return value;
		};
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.assign(service, { hatadyAttachmentService: { validate: vi.fn(async (_user: string, ids: string[]) => ids), packRecords: vi.fn().mockResolvedValue(new Map()) }, hatadyLogsRepository: { manager: { transaction } }, idService: { gen: () => 'record' }, flowerService: { onHatadyCreated: vi.fn().mockResolvedValue({}) } });
		Object.defineProperty(service, 'notifyMilestoneIfReached', { value: vi.fn().mockResolvedValue(undefined) });
		const input = { title: 'record', subject: 'subject', bookId: 'book', pageTo: 10, durationSeconds: 61, durationMinutes: 0 };
		await service.createLog({ id: 'owner' } as never, input);
		expect(page).toBe(10); expect(saved).toMatchObject({ id: 'record', durationSeconds: 61, durationMinutes: 1 });
		fail = true;
		await expect(service.createLog({ id: 'owner' } as never, { ...input, pageTo: 20 })).rejects.toThrow('insert failed');
		expect(page).toBe(10); expect(saved).toMatchObject({ pageTo: 10 });
	});
});
