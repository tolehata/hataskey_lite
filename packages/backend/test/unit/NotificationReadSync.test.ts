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
	const globalEventService = { publishMainStream: vi.fn() };
	const pushNotificationService = { pushNotification: vi.fn() };
	const notificationEntityService = { packMany: vi.fn(async (notifications: Array<{ id: string }>) => notifications) };
	const service = new NotificationService(
		{} as never,
		redisClient as never,
		{} as never,
		notificationEntityService as never,
		{ parseFull: vi.fn().mockReturnValue({ date: 1000, additional: 1n }) } as never,
		globalEventService as never,
		pushNotificationService as never,
		{} as never,
		{} as never,
	);
	return { service, redisClient, globalEventService, notificationEntityService, pushNotificationService };
}

describe('notification individual read ownership', () => {
	test('another user’s standard ID cannot be marked read', async () => {
		const { service, redisClient, globalEventService } = makeService([]);
		expect(await service.markNotificationRead('owner', 'n1')).toBe(false);
		expect(redisClient.hset).not.toHaveBeenCalled();
		expect(globalEventService.publishMainStream).not.toHaveBeenCalled();
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

	test('a retained but hidden notification cannot be read by an explicit standard ID', async () => {
		const entry: [string, string[]] = ['1000-1', ['data', JSON.stringify({ id: 'n1', type: 'test', createdAt: '2026-09-30T00:00:00.000Z' })]];
		const { service, notificationEntityService, redisClient, globalEventService } = makeService([entry]);
		notificationEntityService.packMany.mockResolvedValueOnce([]);
		expect(await service.markNotificationsRead('owner', ['n1'])).toEqual([]);
		expect(redisClient.hset).not.toHaveBeenCalled();
		expect(globalEventService.publishMainStream).not.toHaveBeenCalled();
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

});
