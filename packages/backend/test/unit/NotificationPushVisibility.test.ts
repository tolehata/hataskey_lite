/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { NotificationService } from '@/core/NotificationService.js';

const delayed = vi.hoisted(() => ({ run: null as null | (() => Promise<void>) }));
vi.mock('node:timers/promises', () => ({
	setTimeout: vi.fn(() => ({ then: (run: () => Promise<void>) => { delayed.run = run; } })),
}));

function fixture(type: 'follow' | 'receiveFollowRequest' = 'follow') {
	let retained = true;
	let revision = 0;
	const packed = { id: 'standard', createdAt: new Date().toISOString(), type };
	const notificationEntityService = { pack: vi.fn().mockResolvedValue(packed) };
	const globalEventService = { publishMainStream: vi.fn() };
	const pushNotificationService = { pushNotification: vi.fn().mockResolvedValue(undefined) };
	const usersRepository = { findOneByOrFail: vi.fn().mockRejectedValue(new Error('Notifier is gone')) };
	const redisClient = {
		hget: vi.fn().mockResolvedValue(null),
		hlen: vi.fn().mockResolvedValue(0),
		hexists: vi.fn().mockResolvedValue(0),
		get: vi.fn(async (key: string) => key.startsWith('notificationRevision:') ? String(revision) : null),
		incr: vi.fn(async () => ++revision),
		xrange: vi.fn(async (_key: string, start: string) => start === '1000-1' && retained
			? [['1000-1', ['data', JSON.stringify({ id: 'standard', type, notifierId: 'sender' })]]]
			: []),
		xadd: vi.fn().mockResolvedValue('1000-1'),
		eval: vi.fn().mockResolvedValue('1000-1'),
	};
	const service = new NotificationService(
		{ perUserNotificationsMaxCount: 50 } as never,
		redisClient as never,
		usersRepository as never,
		notificationEntityService as never,
		{ gen: vi.fn().mockReturnValue('standard'), parseFull: vi.fn().mockReturnValue({ date: 1000, additional: 1n }) } as never,
		globalEventService as never,
		pushNotificationService as never,
		{
			userProfileCache: { fetch: vi.fn().mockResolvedValue({ notificationRecieveConfig: {} }) },
			userMutingsCache: { fetch: vi.fn().mockResolvedValue(new Set()) },
		} as never,
		{} as never,
	);
	vi.spyOn(service, 'getUnreadNotificationsCount').mockResolvedValue(1);
	return { service, notificationEntityService, globalEventService, pushNotificationService, usersRepository, trim: () => { retained = false; } };
}

afterEach(() => { delayed.run = null; });

describe('standard notification delayed push', () => {
	test('a notification trimmed during the delay is not pushed or announced unread', async () => {
		const f = fixture();
		await f.service.createNotificationAsync('owner', 'follow', {}, 'sender');
		f.trim();
		await delayed.run?.();
		expect(f.notificationEntityService.pack).toHaveBeenCalledOnce();
		expect(f.globalEventService.publishMainStream).not.toHaveBeenCalledWith('owner', 'unreadNotification', expect.anything());
		expect(f.pushNotificationService.pushNotification).not.toHaveBeenCalled();
	});
});

describe('Follow notification delayed push', () => {
	test.each(['follow', 'receiveFollowRequest'] as const)('%s keeps stream and push delivery without a separate notifier lookup', async type => {
		const f = fixture(type);
		await f.service.createNotificationAsync('owner', type, {}, 'sender');
		expect(delayed.run).toBeTypeOf('function');
		const run = delayed.run;
		if (!run) throw new Error('Missing delayed notification callback');
		await expect(run()).resolves.toBeUndefined();
		expect(f.globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'notification', expect.objectContaining({ type }));
		expect(f.globalEventService.publishMainStream).toHaveBeenCalledWith('owner', 'unreadNotification', expect.objectContaining({ type, unreadNotificationsCount: 1 }));
		expect(f.pushNotificationService.pushNotification).toHaveBeenCalledWith('owner', 'notification', expect.objectContaining({ type }));
		expect(f.usersRepository.findOneByOrFail).not.toHaveBeenCalled();
	});
});
