/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { matchesNotificationListFilter, notificationBrand, NotificationService } from '@/core/NotificationService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import type { MiNotification } from '@/models/Notification.js';
import NotificationsEndpoint from '@/server/api/endpoints/i/notifications.js';
import GroupedNotificationsEndpoint from '@/server/api/endpoints/i/notifications-grouped.js';
import { notificationFilterTypes } from '@/types.js';

const delayed = vi.hoisted(() => ({ run: null as null | (() => Promise<void>) }));
vi.mock('node:timers/promises', () => ({
	setTimeout: vi.fn(() => ({ then: (run: () => Promise<void>) => { delayed.run = run; } })),
}));

const data = {
	customHeader: 'アイコンデコを獲得しました', customBody: '秋のお花のアイコンデコが使えるようになりました。',
	customIcon: null, customLink: '/settings/avatar-decoration',
};
const reward: Extract<MiNotification, { type: 'hataskDecorationUnlocked' }> = {
	id: 'notice1', createdAt: '2026-10-12T00:00:00.000Z', type: 'hataskDecorationUnlocked', ...data,
};
const flower: Extract<MiNotification, { type: 'hataskFlowerReady' }> = {
	...reward, id: 'notice2', type: 'hataskFlowerReady',
};
const ordinary: Extract<MiNotification, { type: 'app' }> = {
	...reward, id: 'notice3', type: 'app', appAccessTokenId: null, customHeader: 'Other app', customLink: '/other',
};

function fixture(initial: MiNotification[] = []) {
	const profile = {
		notificationRecieveConfig: {} as Record<string, { type: string; userListId?: string }>,
		mutedInstances: ['example.invalid'],
	};
	const cache = {
		userProfileCache: { fetch: vi.fn().mockResolvedValue(profile) },
		userMutingsCache: { fetch: vi.fn().mockResolvedValue(new Set(['muted-user'])) },
	};
	const entity = new NotificationEntityService(
		{ get: () => ({ packMany: vi.fn().mockResolvedValue([]) }) } as never,
		{} as never, {} as never, {} as never, {} as never, {} as never, {} as never, cache as never,
	);
	entity.onModuleInit();
	const entries = new Map(initial.map(notification => [`${1000 + Number(notification.id.slice(6))}-0`, notification]));
	let revision = 0;
	let latestRead: string | null = null;
	const redis = {
		get: vi.fn(async (key: string) => key.startsWith('notificationRevision:') ? String(revision) : latestRead),
		incr: vi.fn(async () => ++revision),
		hexists: vi.fn().mockResolvedValue(0),
		xadd: vi.fn(async (_key: string, _maxlen: string, _approx: string, _limit: string, streamId: string, _field: string, value: string) => {
			entries.set(streamId, JSON.parse(value) as MiNotification);
			return streamId;
		}),
		xrange: vi.fn(async (_key: string, start: string, end: string) => [...entries]
			.filter(([id]) => id === start && id === end).map(([id, notification]) => [id, ['data', JSON.stringify(notification)]])),
		xrevrange: vi.fn(async (_key: string, end: string, _start: string, _count: string, limit: number) => [...entries]
			.filter(([id]) => end === '+' || id < end.slice(1))
			.sort(([a], [b]) => b.localeCompare(a)).slice(0, limit)
			.map(([id, notification]) => [id, ['data', JSON.stringify(notification)]])),
	};
	const id = { gen: () => 'notice1', parseFull: (value: string) => ({ date: 1000 + Number(value.slice(6)), additional: 0n }) };
	const stream = { publishMainStream: vi.fn() };
	const push = { pushNotification: vi.fn() };
	const service = new NotificationService(
		{ perUserNotificationsMaxCount: 50 } as never, redis as never,
		{} as never, {} as never, {} as never, entity, id as never, stream as never, push as never, cache as never, {} as never,
	);
	vi.spyOn(service, 'getUnreadNotificationsCount').mockResolvedValue(1);
	return { service, entity, id, profile, redis, entries, stream, push, read: () => { latestRead = '1001-0'; } };
}

afterEach(() => {
	delayed.run = null;
	vi.restoreAllMocks();
});

describe('mandatory Hatask decoration notifications', () => {
	test.each(['never', 'following', 'follower', 'mutualFollow', 'followingOrFollower', 'list'])('受信設定 %s でも送信者なしで保存し、通知本文を配信する', async type => {
		const f = fixture();
		f.profile.notificationRecieveConfig.hataskDecorationUnlocked = { type, userListId: 'empty-list' };
		f.profile.notificationRecieveConfig.app = { type: 'never' };
		expect(await f.service.createNotificationAsync('owner', 'hataskDecorationUnlocked', data, null)).toMatchObject({ type: 'hataskDecorationUnlocked' });
		expect(f.entries.get('1001-0')).not.toHaveProperty('notifierId');
		expect(f.stream.publishMainStream).toHaveBeenCalledWith('owner', 'notification', expect.objectContaining({
			type: 'hataskDecorationUnlocked', header: data.customHeader, body: data.customBody, icon: null, link: data.customLink,
		}));
	});

	test('通常の花通知とapp通知には受信拒否を適用し続ける', async () => {
		const f = fixture();
		f.profile.notificationRecieveConfig.hataskFlowerReady = { type: 'never' };
		f.profile.notificationRecieveConfig.app = { type: 'never' };
		expect(await f.service.createNotificationAsync('owner', 'hataskFlowerReady', data)).toBeNull();
		expect(await f.service.createNotificationAsync('owner', 'app', { ...data, appAccessTokenId: null })).toBeNull();
		expect(f.entries.size).toBe(0);
		expect(f.stream.publishMainStream).not.toHaveBeenCalled();
	});

	test('未読の獲得通知は通常のPush経路へ本文と遷移先を渡す', async () => {
		const f = fixture();
		f.profile.notificationRecieveConfig.hataskDecorationUnlocked = { type: 'never' };
		await f.service.createNotificationAsync('owner', 'hataskDecorationUnlocked', data, null);
		if (delayed.run == null) throw new Error('Unread notification timer was not scheduled');
		await delayed.run();
		expect(f.push.pushNotification).toHaveBeenCalledExactlyOnceWith('owner', 'notification', expect.objectContaining({
			type: 'hataskDecorationUnlocked', body: data.customBody, link: data.customLink,
		}));
	});

	test('遅延中に既読となった獲得通知はPushを重ねない', async () => {
		const f = fixture();
		await f.service.createNotificationAsync('owner', 'hataskDecorationUnlocked', data, null);
		f.read();
		if (delayed.run == null) throw new Error('Unread notification timer was not scheduled');
		await delayed.run();
		expect(f.push.pushNotification).not.toHaveBeenCalled();
	});

	test('Hataskを選んで全種類を除外しても獲得通知だけを取得し、通常通知を漏らさない', async () => {
		const f = fixture([reward, flower, ordinary]);
		const filters = {
			includeTypes: [], excludeTypes: [...notificationFilterTypes], brand: 'hatask' as const,
			includeBrands: ['hatask'] as const, includeHataskApp: false, excludeBots: true,
		};
		expect(notificationBrand(reward)).toBe('hatask');
		expect(matchesNotificationListFilter(reward, filters)).toBe(true);
		expect(matchesNotificationListFilter(flower, filters)).toBe(false);
		expect(matchesNotificationListFilter(ordinary, filters)).toBe(false);
		expect(await f.service.getNotifications('owner', { ...filters, includeBrands: [...filters.includeBrands], limit: 1 })).toEqual([reward]);
		expect(f.redis.xrevrange).toHaveBeenCalledTimes(3);
	});

	test.each(['all', 'standard', 'hatask', 'hatady', 'hataFeed'] as const)('獲得通知は単一ブランド %s と複数ブランド指定の両方に従う', async brand => {
		const choices = [undefined, [], ['hatask'], ['standard'], ['hatady'], ['hataFeed'], ['standard', 'hatask', 'hatady', 'hataFeed']] as const;
		for (const includeBrands of choices) {
			const expected = (brand === 'all' || brand === 'hatask') && (includeBrands === undefined || includeBrands.some(value => value === 'hatask'));
			const filters = { brand, includeBrands, includeTypes: [], excludeTypes: [...notificationFilterTypes] };
			expect(matchesNotificationListFilter(reward, filters), JSON.stringify(filters)).toBe(expected);
			const f = fixture([reward]);
			expect(await f.service.getNotifications('owner', { ...filters, includeBrands: includeBrands ? [...includeBrands] : undefined })).toEqual(expected ? [reward] : []);
		}
	});

	test('通常の花通知だけを選択しても獲得通知を含め、無関係のapp通知は除外する', async () => {
		const f = fixture([reward, flower, ordinary]);
		expect(await f.service.getNotifications('owner', { includeTypes: ['hataskFlowerReady'] })).toEqual([flower, reward]);
	});

	test.each([
		['i/notifications', NotificationsEndpoint],
		['i/notifications-grouped', GroupedNotificationsEndpoint],
	])('%s は種類の除外を越えて獲得通知を返すが、Hatask以外のブランドへ混入・既読化しない', async (_name, EndpointClass) => {
		const f = fixture([reward, flower, ordinary]);
		const endpoint = new EndpointClass(f.id as never, f.entity, f.service);
		const markRead = vi.spyOn(f.service, 'markNotificationsRead').mockResolvedValue();
		for (const filters of [{ includeTypes: [] }, { excludeTypes: [...notificationFilterTypes] }]) {
			const result = await endpoint.exec({ limit: 10, markAsRead: false, ...filters }, { id: 'owner' } as never, null, null) as MiNotification[];
			expect(result.map(notification => notification.id)).toEqual([reward.id]);
			expect(result[0]).toMatchObject({ type: 'hataskDecorationUnlocked', body: data.customBody, link: data.customLink });
		}
		for (const brand of ['all', 'standard', 'hatask', 'hatady', 'hataFeed'] as const) {
			for (const includeBrands of [undefined, [], ['hatask'], ['standard', 'hatady', 'hataFeed']] as const) {
				markRead.mockClear();
				const expected = (brand === 'all' || brand === 'hatask') && (includeBrands === undefined || includeBrands.some(value => value === 'hatask'));
				const result = await endpoint.exec({ limit: 10, markAsRead: true, brand, includeBrands: includeBrands ? [...includeBrands] : undefined, includeTypes: [] }, { id: 'owner' } as never, null, null) as MiNotification[];
				expect(result.map(notification => notification.id)).toEqual(expected ? [reward.id] : []);
				expect(markRead.mock.calls.flatMap(([, ids]) => ids)).toEqual(expected ? [reward.id] : []);
			}
		}
	});
});
