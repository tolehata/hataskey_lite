/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { NotificationService } from '@/core/NotificationService.js';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

function makeService(entries: [string, string[]][]) {
	const individualReads: Record<string, string> = {};
	let revision = 0;
	const redisClient = {
		hget: vi.fn().mockResolvedValue(null),
		xrange: vi.fn().mockResolvedValue(entries),
		xrevrange: vi.fn().mockResolvedValue(entries),
		get: vi.fn(async (key: string) => key.startsWith('notificationRevision:') ? String(revision) : null),
		incr: vi.fn(async () => ++revision),
		hgetall: vi.fn(async () => ({ ...individualReads })),
		eval: vi.fn().mockResolvedValue(1),
		hset: vi.fn(async (_key: string, field: string, streamId: string) => { individualReads[field] = streamId; return 1; }),
	};
	const hatadyNotificationsRepository = {
		update: vi.fn().mockResolvedValue({ affected: 1 }),
		findOneBy: vi.fn().mockResolvedValue({ isRead: false, deletedAt: null }),
		findBy: vi.fn().mockResolvedValue([]),
	};
	const feedbackNotificationsRepository = { update: vi.fn().mockResolvedValue({ affected: 1 }), findOneBy: vi.fn().mockResolvedValue({ isRead: true }), findBy: vi.fn().mockResolvedValue([]) };
	const globalEventService = { publishMainStream: vi.fn() };
	const pushNotificationService = { pushNotification: vi.fn() };
	const notificationEntityService = { packMany: vi.fn(async (notifications: Array<{ id: string }>) => notifications) };
	const service = new NotificationService(
		{} as never,
		redisClient as never,
		{} as never,
		hatadyNotificationsRepository as never,
		feedbackNotificationsRepository as never,
		notificationEntityService as never,
		{ parseFull: vi.fn().mockReturnValue({ date: 1000, additional: 1n }) } as never,
		globalEventService as never,
		pushNotificationService as never,
		{} as never,
		{} as never,
	);
	return { service, redisClient, hatadyNotificationsRepository, feedbackNotificationsRepository, globalEventService, notificationEntityService, pushNotificationService };
}

describe('notification individual read ownership and source sync', () => {
	test('another user’s standard ID cannot be marked read', async () => {
		const { service, redisClient, hatadyNotificationsRepository, feedbackNotificationsRepository, globalEventService } = makeService([]);
		expect(await service.markNotificationRead('owner', 'n1')).toBe(false);
		expect(redisClient.hset).not.toHaveBeenCalled();
		expect(hatadyNotificationsRepository.update).not.toHaveBeenCalled();
		expect(feedbackNotificationsRepository.update).not.toHaveBeenCalled();
		expect(globalEventService.publishMainStream).not.toHaveBeenCalled();
	});

	test('legacy HataFeed without source ID keeps its dedicated read state', async () => {
		const entry: [string, string[]] = ['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'hataFeed', createdAt: '2026-09-30T00:00:00.000Z' })]];
		const { service, redisClient, feedbackNotificationsRepository, globalEventService } = makeService([entry]);
		expect(await service.markNotificationRead('owner', 'n1')).toBe(true);
		expect(redisClient.hset).toHaveBeenCalledWith('individualReadNotification:owner', 'n1', '1000-1');
		expect(feedbackNotificationsRepository.update).not.toHaveBeenCalled();
		expect(globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'readNotification', { id: 'n1', unreadNotificationsCount: 0, revision: '1' });
	});

	test('new HataFeed source read is bounded to the same recipient', async () => {
		const entry: [string, string[]] = ['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'hataFeed', sourceNotificationId: 'f1', createdAt: '2026-09-30T00:00:00.000Z' })]];
		const { service, feedbackNotificationsRepository } = makeService([entry]);
		expect(await service.markNotificationRead('owner', 'n1')).toBe(true);
		expect(feedbackNotificationsRepository.update).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', isRead: false }), { isRead: true });
	});

	test('bulk individual read validates ownership and sends one count for each accepted ID', async () => {
		const entries: [string, string[]][] = [
			['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'test', createdAt: '2026-09-30T00:00:00.000Z' })]],
			['1000-2', ['data', JSON.stringify({ id: 'n2', type: 'test', createdAt: '2026-09-30T00:00:00.000Z' })]],
		];
		const { service, redisClient, globalEventService, pushNotificationService } = makeService(entries);
		(redisClient.xrange as ReturnType<typeof vi.fn>).mockImplementation(async (_key: string, start: string) => entries.filter(([id]) => id === start));
		const idService = (service as unknown as { idService: { parseFull: ReturnType<typeof vi.fn> } }).idService;
		idService.parseFull.mockImplementation((id: string) => ({ date: 1000, additional: id === 'n2' ? 2n : 1n }));
		const unread = vi.spyOn(service, 'getUnreadNotificationsCount').mockResolvedValue(3);
		expect(await service.markNotificationsRead('owner', ['n1', 'foreign', 'n2'])).toEqual(['n1', 'n2']);
		expect(unread).toHaveBeenCalledOnce();
		expect(globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'readNotification', { id: 'n1', unreadNotificationsCount: 3, revision: '1' });
		expect(globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'readNotification', { id: 'n2', unreadNotificationsCount: 3, revision: '1' });
		expect(pushNotificationService.pushNotification).toHaveBeenCalledWith('owner', 'readNotification', { id: 'n1' });
	});

	test('a slower read cannot publish its older badge count after a newer read', async () => {
		const entries: [string, string[]][] = [
			['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'test' })]],
			['1000-2', ['data', JSON.stringify({ id: 'n2', type: 'test' })]],
		];
		const { service, redisClient, globalEventService } = makeService(entries);
		redisClient.xrange.mockImplementation(async (_key: string, start: string) => entries.filter(([id]) => id === start));
		const idService = (service as unknown as { idService: { parseFull: ReturnType<typeof vi.fn> } }).idService;
		idService.parseFull.mockImplementation((id: string) => ({ date: 1000, additional: id === 'n2' ? 2n : 1n }));
		const oldCount = deferred<number>();
		const oldCountStarted = deferred<void>();
		vi.spyOn(service, 'getUnreadNotificationsCount')
			.mockImplementationOnce(() => { oldCountStarted.resolve(); return oldCount.promise; })
			.mockResolvedValue(0);
		const first = service.markNotificationsRead('owner', ['n1']);
		await oldCountStarted.promise;
		await service.markNotificationsRead('owner', ['n2']);
		oldCount.resolve(1);
		await first;
		const readEvents = globalEventService.publishMainStream.mock.calls.filter(([, type]) => type === 'readNotification');
		expect(readEvents).toHaveLength(2);
		expect(readEvents.map(([, , body]) => body)).toEqual([
			{ id: 'n2', unreadNotificationsCount: 0, revision: '2' },
			{ id: 'n1', unreadNotificationsCount: 0, revision: '2' },
		]);
	});

	test('a retained but hidden source cannot be read by an explicit standard ID', async () => {
		const entry: [string, string[]] = ['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'hatady', sourceNotificationId: 'h1', subtype: 'comment', targetType: 'comment', targetId: 'deleted', createdAt: '2026-09-30T00:00:00.000Z' })]];
		const { service, hatadyNotificationsRepository, notificationEntityService, redisClient, globalEventService } = makeService([entry]);
		notificationEntityService.packMany.mockResolvedValueOnce([]);
		expect(await service.markNotificationsRead('owner', ['n1'])).toEqual([]);
		expect(hatadyNotificationsRepository.update).not.toHaveBeenCalled();
		expect(redisClient.hset).not.toHaveBeenCalled();
		expect(globalEventService.publishMainStream).not.toHaveBeenCalled();
	});

	test('a hidden Hatady source keeps its unread state across standard read-all and restore', async () => {
		const notification = {
			id: 'n1', type: 'hatady', sourceNotificationId: 'h1', subtype: 'comment',
			targetType: 'comment', targetId: 'c1', createdAt: '2026-09-30T00:00:00.000Z',
		} as const;
		const entry: [string, string[]] = ['1000-1', ['data', JSON.stringify(notification)]];
		const { service, redisClient, hatadyNotificationsRepository, globalEventService, notificationEntityService } = makeService([entry]);
		notificationEntityService.packMany.mockResolvedValueOnce([]);
		await service.readAllNotification('owner');
		expect(hatadyNotificationsRepository.update).not.toHaveBeenCalled();
		const readState = service as unknown as { isRead: (userId: string, item: typeof notification, entryId: string, cursor: string) => Promise<boolean> };
		expect(await readState.isRead('owner', notification, '1000-1', '1000-1')).toBe(false);
		// After restore the same cursor is already at n1. A second explicit read-all
		// must still notify clients because the source row has changed to read.
		notificationEntityService.packMany.mockResolvedValueOnce([{ id: 'n1' }]);
		redisClient.eval.mockResolvedValueOnce(0);
		hatadyNotificationsRepository.findOneBy.mockResolvedValue({ isRead: true, deletedAt: null });
		hatadyNotificationsRepository.findBy.mockResolvedValue([{ id: 'h1', isRead: true, deletedAt: null }]);
		globalEventService.publishMainStream.mockClear();
		await service.readAllNotification('owner');
		expect(hatadyNotificationsRepository.update).toHaveBeenCalledOnce();
		expect(globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'readAllNotifications', { ids: ['n1'], unreadNotificationsCount: 0, revision: '2' });
		expect(await readState.isRead('owner', notification, '1000-1', '1000-1')).toBe(true);
	});

	test('read-all closes only snapshot IDs and reports a new arrival as unread', async () => {
		const entries: [string, string[]][] = [['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'test' })]]];
		const { service, redisClient, notificationEntityService, globalEventService, pushNotificationService } = makeService(entries);
		const packStarted = deferred<void>();
		const releasePack = deferred<void>();
		notificationEntityService.packMany.mockImplementationOnce(async notifications => {
			packStarted.resolve();
			await releasePack.promise;
			return notifications;
		});
		vi.spyOn(service, 'getUnreadNotificationsCount').mockResolvedValue(1);
		const readAll = service.readAllNotification('owner');
		await packStarted.promise;
		entries.push(['1000-2', ['data', JSON.stringify({ id: 'n2', type: 'test' })]]);
		await redisClient.incr('notificationRevision:owner');
		releasePack.resolve();
		await readAll;
		expect(globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'readAllNotifications', {
			ids: ['n1'], unreadNotificationsCount: 1, revision: '2',
		});
		expect(pushNotificationService.pushNotification).toHaveBeenCalledWith('owner', 'readAllNotifications', { ids: ['n1'] });
	});

	test('relationship refresh re-evaluates retained Hatady IDs and splits OS signals into bounded batches', async () => {
		const entries: [string, string[]][] = Array.from({ length: 120 }, (_, index) => [
			`1000-${index + 1}`,
			['data', JSON.stringify({ id: `hatady${index + 1}`, type: 'hatady', sourceNotificationId: `source${index + 1}` })],
		]);
		entries.push(['1000-121', ['data', JSON.stringify({ id: 'other', type: 'test' })]]);
		const { service, globalEventService, pushNotificationService } = makeService(entries);
		vi.spyOn(service, 'getUnreadNotificationsCount').mockResolvedValue(7);
		await service.refreshHatadyNotificationsForViewer('owner');
		const payload = (globalEventService.publishMainStream.mock.calls as unknown[][])[0]?.[2] as { ids: string[]; unreadNotificationsCount: number; revision: string };
		expect(payload.ids).toHaveLength(120);
		expect(payload.ids).not.toContain('other');
		expect(payload).toMatchObject({ unreadNotificationsCount: 7, revision: '1' });
		expect(pushNotificationService.pushNotification).toHaveBeenCalledTimes(3);
		expect((pushNotificationService.pushNotification.mock.calls as unknown[][]).map(call => (call[2] as { ids: string[] }).ids.length)).toEqual([50, 50, 20]);
	});

	test('flush reports a new arrival during count calculation instead of resetting the badge to zero', async () => {
		const { service, redisClient, globalEventService } = makeService([]);
		redisClient.eval.mockImplementation(async () => { await redisClient.incr('notificationRevision:owner'); return 1; });
		const staleCount = deferred<number>();
		const countStarted = deferred<void>();
		vi.spyOn(service, 'getUnreadNotificationsCount')
			.mockImplementationOnce(() => { countStarted.resolve(); return staleCount.promise; })
			.mockResolvedValue(1);
		const flush = service.flushAllNotifications('owner');
		await countStarted.promise;
		await redisClient.incr('notificationRevision:owner'); // A new notification arrives after the atomic clear.
		staleCount.resolve(0);
		await flush;
		expect(globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'notificationFlushed', { unreadNotificationsCount: 1, revision: '2' });
	});

	test('a read marker newer than the stream snapshot survives trim cleanup', async () => {
		const entry: [string, string[]] = ['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'test', createdAt: '2026-09-30T00:00:00.000Z' })]];
		const { service, redisClient } = makeService([entry]);
		redisClient.hgetall.mockResolvedValue({ n2: '2000-1' });
		expect(await service.getUnreadNotificationsCount('owner')).toBe(1);
		expect(redisClient.eval).not.toHaveBeenCalled();
	});

	test('counts visible linked notifications with one owner-bound query per source', async () => {
		const entries: [string, string[]][] = [
			['1000-3', ['data', JSON.stringify({ id: 'n3', type: 'hataFeed', sourceNotificationId: 'f1' })]],
			['1000-2', ['data', JSON.stringify({ id: 'n2', type: 'hatady', sourceNotificationId: 'h2' })]],
			['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'hatady', sourceNotificationId: 'h1' })]],
		];
		const { service, hatadyNotificationsRepository, feedbackNotificationsRepository } = makeService(entries);
		hatadyNotificationsRepository.findBy.mockResolvedValue([{ id: 'h1', isRead: false }, { id: 'h2', isRead: true }]);
		feedbackNotificationsRepository.findBy.mockResolvedValue([{ id: 'f1', isRead: false }]);
		expect(await service.getUnreadNotificationsCount('owner')).toBe(2);
		expect(hatadyNotificationsRepository.findBy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ notifieeId: 'owner' }));
		expect(feedbackNotificationsRepository.findBy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ userId: 'owner' }));
		expect(hatadyNotificationsRepository.findOneBy).not.toHaveBeenCalled();
		expect(feedbackNotificationsRepository.findOneBy).not.toHaveBeenCalled();
	});

	test('fallback source scan cannot overwrite a newer indexed mirror', async () => {
		const oldNotification = { id: 'old', type: 'hatady', sourceNotificationId: 'source' };
		const newNotification = { id: 'new', type: 'hatady', sourceNotificationId: 'source' };
		const scanStarted = deferred<void>();
		const releaseScan = deferred<void>();
		let indexed: string | null = null;
		const { service, redisClient } = makeService([]);
		redisClient.hget = vi.fn(async () => indexed);
		redisClient.xrange.mockImplementation(async (_key: string, start: string) => {
			if (start === '-') { scanStarted.resolve(); await releaseScan.promise; return [['1000-1', ['data', JSON.stringify(oldNotification)]]]; }
			if (start === '2000-1') return [['2000-1', ['data', JSON.stringify(newNotification)]]];
			return [];
		});
		redisClient.eval.mockImplementation(async (_script: string, _keys: number, _stream: string, _index: string, _field: string, candidate: string) => {
			indexed ??= candidate;
			return indexed;
		});
		const lookup = service.findNotificationBySource('owner', 'hatady', 'source');
		await scanStarted.promise;
		indexed = '2000-1';
		releaseScan.resolve();
		expect(await lookup).toMatchObject({ id: 'new' });
		expect(indexed).toBe('2000-1');
		expect(redisClient.hset).not.toHaveBeenCalled();
	});
});
