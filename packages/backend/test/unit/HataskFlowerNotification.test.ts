/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { getReadyHataskFlower } from '@/misc/hatask-flower-ready.js';
import { CheckHataskFlowersProcessorService } from '@/queue/processors/CheckHataskFlowersProcessorService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import type { MiRegistryItem } from '@/models/RegistryItem.js';

const minute = 60_000;
const plantedAt = 1_000_000;
const now = plantedAt + 480 * minute;
const flower = { startedAt: plantedAt, targetMinutes: 480, totalMinutes: 0, lastGrowthAt: plantedAt };

afterEach(() => { vi.restoreAllMocks(); });

describe('Hatask harvest readiness', () => {
	test('アプリを閉じている間の実経過時間で、満開の境界を判定する', () => {
		expect(getReadyHataskFlower(flower, now - 1)).toBeNull();
		expect(getReadyHataskFlower(flower, now)).toEqual({ startedAt: plantedAt });
	});

	test('水やりと保存済み成長時間を二重加算せず、進捗率の古い値には依存しない', () => {
		const watered = { ...flower, totalMinutes: 479, lastGrowthAt: now, progress: 100 };
		expect(getReadyHataskFlower(watered, now + minute - 1)).toBeNull();
		expect(getReadyHataskFlower(watered, now + minute)).toEqual({ startedAt: plantedAt });
		expect(getReadyHataskFlower({ ...watered, totalMinutes: 480, progress: 0 }, now)).toEqual({ startedAt: plantedAt });
	});

	test('旧データの既定1200分と開始時刻＋成長分の基準を維持する', () => {
		const legacy = { startedAt: plantedAt, totalMinutes: 1199 };
		expect(getReadyHataskFlower(legacy, plantedAt + 1200 * minute - 1)).toBeNull();
		expect(getReadyHataskFlower(legacy, plantedAt + 1200 * minute)).toEqual({ startedAt: plantedAt });
	});

	test.each([null, [], {}, { startedAt: 0 }, { startedAt: '1000' }, { startedAt: NaN }, { startedAt: Infinity }, { startedAt: now + 1 }])('安定した開始時刻を持たないデータから通知を作らない: %j', value => {
		expect(getReadyHataskFlower(value, now)).toBeNull();
	});
});

function fixture() {
	vi.spyOn(Date, 'now').mockReturnValue(now);
	const flowers = new Map<string, unknown>([['alice', flower]]);
	const markers = new Map<string, MiRegistryItem>();
	const queries: { alias: string; conditions: string[]; parameters: Record<string, unknown>; lock?: string }[] = [];
	let serial = Promise.resolve();
	let nextId = 0;
	const repository = {
		createQueryBuilder: vi.fn((alias: string) => {
			const query = { alias, conditions: [] as string[], parameters: {} as Record<string, unknown>, lock: undefined as string | undefined };
			queries.push(query);
			const builder = {
				select: vi.fn().mockReturnThis(), distinct: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(), addOrderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
				setLock: vi.fn((lock: string) => { query.lock = lock; return builder; }),
				where: vi.fn((condition: string, parameters?: Record<string, unknown>) => {
					query.conditions.push(condition); Object.assign(query.parameters, parameters); return builder;
				}),
				andWhere: vi.fn((condition: string, parameters?: Record<string, unknown>) => builder.where(condition, parameters)),
				// Query execution is mocked. Production SQL predicates are checked separately below.
				getRawMany: vi.fn(async () => [...flowers.keys()].sort().filter(id => id > String(query.parameters.cursor)).slice(0, 100).map(userId => ({ userId }))),
				getOne: vi.fn(async () => alias === 'flower'
					? { value: flowers.get(String(query.parameters.userId)) }
					: markers.get(String(query.parameters.userId)) ?? null),
			};
			return builder;
		}),
		insert: vi.fn(async (row: MiRegistryItem) => { markers.set(row.userId, row); }),
		update: vi.fn(async (id: string, values: Partial<MiRegistryItem>) => {
			const entry = [...markers.values()].find(row => row.id === id)!;
			markers.set(entry.userId, { ...entry, ...values });
		}),
	};
	const manager = { query: vi.fn(), getRepository: vi.fn().mockReturnValue(repository) };
	const transaction = vi.fn(async (callback: (value: typeof manager) => Promise<void>) => {
		const previous = serial;
		let release!: () => void;
		serial = new Promise<void>(resolve => { release = resolve; });
		await previous;
		try { await callback(manager); } finally { release(); }
	});
	const notification = { createNotificationAsync: vi.fn().mockResolvedValue(null) };
	const logger = { error: vi.fn() };
	const flowerV2 = { checkNotifications: vi.fn().mockResolvedValue(undefined) };
	const decorations = { removeUnavailableDecorations: vi.fn().mockResolvedValue(undefined), notifyUnlockedDecorations: vi.fn().mockResolvedValue(undefined) };
	const createService = () => new CheckHataskFlowersProcessorService(
		flowerV2 as never,
		{ ...repository, manager: { transaction } } as never,
		{ gen: () => `marker-${++nextId}` } as never, notification as never, { logger } as never,
		decorations as never,
	);
	return { flowers, markers, queries, repository, manager, notification, flowerV2, decorations, createService, service: createService() };
}

describe('Hatask flower notification worker', () => {
	test('期限切れ装飾の解除、獲得通知、通常の花通知を順番に処理する', async () => {
		const f = fixture();
		await f.service.process();
		expect(f.decorations.removeUnavailableDecorations).toHaveBeenCalledOnce();
		expect(f.decorations.notifyUnlockedDecorations).toHaveBeenCalledOnce();
		expect(f.flowerV2.checkNotifications).toHaveBeenCalledOnce();
		expect(f.decorations.removeUnavailableDecorations.mock.invocationCallOrder[0]).toBeLessThan(f.decorations.notifyUnlockedDecorations.mock.invocationCallOrder[0]);
		expect(f.decorations.notifyUnlockedDecorations.mock.invocationCallOrder[0]).toBeLessThan(f.flowerV2.checkNotifications.mock.invocationCallOrder[0]);
		expect(f.flowerV2.checkNotifications.mock.invocationCallOrder[0]).toBeLessThan(f.notification.createNotificationAsync.mock.invocationCallOrder[0]);
	});

	test.each([false, true])('獲得通知が失敗しても通常の花通知を処理し、既存の失敗を優先する: flowerFailure=%s', async flowerFailure => {
		const f = fixture();
		f.decorations.notifyUnlockedDecorations.mockRejectedValueOnce(new Error('decoration delivery failed'));
		if (flowerFailure) f.notification.createNotificationAsync.mockRejectedValueOnce(new Error('flower delivery failed'));
		await expect(f.service.process()).rejects.toThrow(flowerFailure ? 'Hatask flower notifications failed for 1 users' : 'Hatask decoration notifications failed');
		expect(f.flowerV2.checkNotifications).toHaveBeenCalledOnce();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledWith('alice', 'hataskFlowerReady', expect.objectContaining({ customLink: '/hatask?tab=garden' }));
		expect(f.markers.has('alice')).toBe(!flowerFailure);
	});

	test('保存値を書き換えずに所有者へ通知し、再実行・ワーカー再作成後も同じ花を再通知しない', async () => {
		const f = fixture();
		const saved = structuredClone(flower);
		await f.service.process();
		await f.service.process();
		await f.createService().process();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledExactlyOnceWith('alice', 'hataskFlowerReady', {
			customHeader: 'Hataskのお花', customBody: 'お花が満開になりました。Hataskの「おはな」で収穫できます。',
			customIcon: null, customLink: '/hatask?tab=garden',
		});
		expect(f.flowers.get('alice')).toEqual(saved);
		expect(f.markers.get('alice')?.value).toEqual({ startedAt: plantedAt });
	});

	test('同時実行でも同じ所有者をロックし、通知済み記録を再確認する', async () => {
		const f = fixture();
		await Promise.all([f.service.process(), f.createService().process()]);
		expect(f.manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['hatask-flower-ready', 'alice']);
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(1);
		expect(f.queries.find(query => query.lock)?.lock).toBe('pessimistic_write');
	});

	test('収穫後の新しい花が満開になるまで待ち、次は通知済み記録を更新する', async () => {
		const f = fixture();
		await f.service.process();
		f.flowers.set('alice', { ...flower, startedAt: now, lastGrowthAt: now });
		await f.service.process();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(1);
		vi.mocked(Date.now).mockReturnValue(now + 480 * minute);
		await f.service.process();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(2);
		expect(f.markers.get('alice')?.value).toEqual({ startedAt: now });
		expect(f.repository.insert).toHaveBeenCalledTimes(1);
		expect(f.repository.update).toHaveBeenCalledTimes(1);
	});

	test('送信失敗で通知済みにせず、他の所有者を処理して次回再試行する', async () => {
		const f = fixture();
		f.flowers.set('bob', flower);
		f.notification.createNotificationAsync.mockRejectedValueOnce(new Error('delivery failed'));
		await expect(f.service.process()).rejects.toThrow('failed for 1 users');
		expect(f.markers.has('alice')).toBe(false);
		expect(f.markers.has('bob')).toBe(true);
		await f.service.process();
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[0])).toEqual(['alice', 'bob', 'alice']);
	});

	test('候補から収穫済み・削除済みになった花を再読込して取り除く', async () => {
		const f = fixture();
		f.flowers.set('alice', null);
		await f.service.process();
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();
	});

	test('通知先を保存値から受け取らず、ローカル所有者とnativeスコープだけを検索する', async () => {
		const f = fixture();
		f.flowers.set('alice', { ...flower, userId: 'victim', customLink: 'https://example.invalid' });
		await f.service.process();
		expect(f.notification.createNotificationAsync.mock.calls[0][0]).toBe('alice');
		const scan = f.queries[0];
		expect(scan.conditions).toContain('owner.host IS NULL AND owner.isDeleted = false AND owner.isSuspended = false');
		for (const query of f.queries) {
			expect(query.conditions).toContain(`${query.alias}.domain IS NULL`);
			expect(query.parameters.scope).toEqual(['client', 'hatask']);
			if (query.parameters.userId) expect(query.parameters.userId).toBe('alice');
		}
		expect(scan.parameters.key).toBe('flower');
		expect(f.queries.find(query => query.alias === 'notified')?.parameters.key).toBe('flowerReadyNotification');
	});

	test('100人のページ境界を越えて処理する', async () => {
		const f = fixture();
		for (let i = 0; i < 101; i++) f.flowers.set(`user-${String(i).padStart(3, '0')}`, flower);
		await f.service.process();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(102);
		expect(f.markers.size).toBe(102);
	});
});

describe('standard flower notifications', () => {
	test('通知履歴で花だけの表示・花の除外・Bot除外を適用する', async () => {
		const flowerNotice = { id: 'flower', type: 'hataskFlowerReady', customBody: '満開です' };
		const appNotice = { id: 'app', type: 'app', customBody: '予定です' };
		const redis = { xrevrange: vi.fn().mockResolvedValue([
			['2000-0', ['data', JSON.stringify(flowerNotice)]], ['1000-0', ['data', JSON.stringify(appNotice)]],
		]) };
		const entity = { packMany: vi.fn(async (notifications: unknown[]) => notifications) };
		const service = new NotificationService({} as never, redis as never, {} as never, {} as never, {} as never, entity as never, {} as never, {} as never, {} as never, {} as never, {} as never);
		expect(await service.getNotifications('alice', { includeTypes: ['hataskFlowerReady'], excludeBots: true })).toEqual([flowerNotice]);
		expect(await service.getNotifications('alice', { excludeTypes: ['hataskFlowerReady'] })).toEqual([appNotice]);
		expect(redis.xrevrange).toHaveBeenCalledWith('notificationTimeline:alice', '+', '-', 'COUNT', 20);
	});

	test('専用typeを標準通知としてpackし、受信拒否はRedisへの保存前に反映する', async () => {
		const profile = { notificationRecieveConfig: {} as Record<string, { type: string }> };
		const redis = { xadd: vi.fn().mockResolvedValue('1000-0'), get: vi.fn().mockResolvedValue(null), incr: vi.fn().mockResolvedValue(1) };
		const cache = { userProfileCache: { fetch: async () => ({ ...profile, mutedInstances: [] }) }, userMutingsCache: { fetch: async () => new Set() } };
		const entity = new NotificationEntityService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, cache as never);
		const stream = { publishMainStream: vi.fn() };
		const service = new NotificationService(
			{ perUserNotificationsMaxCount: 50 } as never, redis as never, {} as never, {} as never, {} as never, entity,
			{ gen: () => 'notice', parseFull: () => ({ date: 1000, additional: 0n }) } as never,
			stream as never, { pushNotification: vi.fn() } as never,
			cache as never, {} as never,
		);
		const data = { customHeader: 'Hataskのお花', customBody: '満開です', customIcon: null, customLink: '/hatask?tab=garden' };
		try {
			await service.createNotificationAsync('alice', 'hataskFlowerReady', data);
			expect(redis.xadd).toHaveBeenCalledTimes(1);
			expect(stream.publishMainStream).toHaveBeenCalledWith('alice', 'notification', expect.objectContaining({
				type: 'hataskFlowerReady', header: data.customHeader, body: data.customBody, link: data.customLink,
			}));
			profile.notificationRecieveConfig.hataskFlowerReady = { type: 'never' };
			expect(await service.createNotificationAsync('alice', 'hataskFlowerReady', data)).toBeNull();
			expect(redis.xadd).toHaveBeenCalledTimes(1);
		} finally {
			service.onApplicationShutdown();
		}
	});
});
