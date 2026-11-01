/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AvatarDecorationService } from '@/core/AvatarDecorationService.js';
import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';
import type { MiAvatarDecoration } from '@/models/AvatarDecoration.js';
import type { HataskFlowerSeason } from '@/misc/hatask-flower-catalog.js';

const now = Date.parse('2026-10-12T03:00:00Z');
const noticeType = 'hataskDecorationUnlocked';
type Owner = { userId: string; completed: boolean; host: string | null; isDeleted: boolean; isSuspended: boolean; roles: string[] };
type Notice = { userId: string; type: string; sourceId: string; sentAt: Date | null };
type Harvest = { userId: string; speciesId: string; season: HataskFlowerSeason; harvestedAt: Date };
type CurrentDecorationQuery = {
	where: (sql: string, parameters: { id: string }) => CurrentDecorationQuery;
	setLock: (mode: string) => CurrentDecorationQuery;
	getOne: () => Promise<MiAvatarDecoration | null>;
};
const services: AvatarDecorationService[] = [];

function decoration(values: Partial<MiAvatarDecoration> = {}): MiAvatarDecoration {
	return {
		id: 'crown', name: '秋のお花の冠', url: 'https://example.test/crown.webp', description: '',
		roleIdsThatCanBeUsedThisDecoration: [], requiresHataskFlowerCompletion: true, availableFrom: null, availableUntil: null,
		updatedAt: null, host: null, remoteId: null, rawUrl: null, ...values,
	};
}

function owner(userId: string, values: Partial<Owner> = {}): Owner {
	return { userId, completed: true, host: null, isDeleted: false, isSuspended: false, roles: [], ...values };
}

function autumnHarvests(userId: string, harvestedAt = new Date(now)): Harvest[] {
	return Array.from({ length: 12 }, (_, index): Harvest => ({ userId, speciesId: `au${index + 1}`, season: 'autumn', harvestedAt }));
}

// A deterministic SQL/transaction fixture. These tests assert query predicates and
// model pending/sent rows and SKIP LOCKED; they do not execute PostgreSQL.
function fixture(initialOwners = [owner('alice')], initialDecorations = [decoration()]) {
	const owners = new Map(initialOwners.map(value => [value.userId, value]));
	const completionDates = new Map(initialOwners.filter(value => value.completed).map(value => [value.userId, new Date(now - 86400000)]));
	const harvests: Harvest[] = [];
	const rewards = [...initialDecorations];
	const notices = new Map<string, Notice>();
	const locks = new Set<string>();
	const scanCalls: { sql: string; cursor: string; rewardIds: string[]; type: string }[] = [];
	const completionCalls: { at: Date; season: HataskFlowerSeason; speciesIds: string[] }[] = [];
	const noticeKey = (userId: string, type: string, sourceId: string) => `${userId}:${type}:${sourceId}`;
	const notification = { createNotificationAsync: vi.fn().mockResolvedValue({ id: 'notice' }) };
	const beforeDelivery = vi.fn<() => void>();
	const roleService = {
		getRoles: vi.fn().mockResolvedValue([{ id: 'members' }]),
		getUserRoles: vi.fn(async (userId: string) => (owners.get(userId)?.roles ?? []).map(id => ({ id }))),
	};
	const manager = {
		query: vi.fn(async (sql: string, args: unknown[] = []) => {
			if (sql.startsWith('WITH completed AS (')) {
				const [at, season, speciesIds] = args as [Date, HataskFlowerSeason, string[]];
				completionCalls.push({ at, season, speciesIds });
				expect(sql).toContain('wallet."flowerCollectionCompletedAt" IS NULL');
				expect(sql).toContain('owner.host IS NULL AND owner."isDeleted" = false');
				expect(sql).toContain('AND NOT EXISTS (');
				expect(sql).toContain('SELECT 1 FROM unnest($3::varchar[]) AS species(id) WHERE NOT EXISTS');
				expect(sql).toContain('SELECT 1 FROM hatask_flower_harvest harvest');
				expect(sql).toContain('WHERE harvest."userId" = wallet."userId" AND harvest.season = $2');
				expect(sql).toContain('AND harvest."speciesId" = species.id');
				expect(sql).toContain('ORDER BY wallet."userId" ASC FOR UPDATE OF wallet SKIP LOCKED');
				expect(sql).toContain('UPDATE hatask_drop_wallet wallet SET "flowerCollectionCompletedAt" = $1');
				expect(sql).toContain('FROM completed WHERE wallet."userId" = completed."userId"');
				for (const value of owners.values()) {
					if (completionDates.has(value.userId) || value.host != null || value.isDeleted) continue;
					const collected = new Set(harvests.filter(harvest => harvest.userId === value.userId && harvest.season === season).map(harvest => harvest.speciesId));
					if (speciesIds.length > 0 && speciesIds.every(id => collected.has(id))) completionDates.set(value.userId, new Date(at));
				}
				return [];
			}
			if (sql.includes('SELECT wallet."userId"')) {
				const [cursor, rewardIds, type] = args as [string, string[], string];
				scanCalls.push({ sql, cursor, rewardIds, type });
				return [...owners.values()].filter(value => completionDates.has(value.userId) && value.host == null && !value.isDeleted && !value.isSuspended
					&& value.userId > cursor && rewardIds.some(id => notices.get(noticeKey(value.userId, type, id))?.sentAt == null))
					.sort((a, b) => a.userId.localeCompare(b.userId)).slice(0, 100).map(value => ({ userId: value.userId }));
			}
			if (sql.startsWith('SELECT "flowerCollectionCompletedAt"')) return [{ flowerCollectionCompletedAt: completionDates.get(String(args[0])) ?? null }];
			if (sql.startsWith('SELECT DISTINCT "speciesId"')) return [];
			if (sql.startsWith('INSERT INTO hatask_flower_notice')) {
				const [userId, type, sourceId] = args as [string, string, string];
				const key = noticeKey(userId, type, sourceId);
				if (!notices.has(key)) notices.set(key, { userId, type, sourceId, sentAt: null });
				return [];
			}
			throw new Error(`Unexpected fixture query: ${sql}`);
		}),
		transaction: vi.fn(async (callback: (transaction: {
			query: (sql: string, args: string[]) => Promise<unknown[]>;
			getRepository: () => { createQueryBuilder: () => CurrentDecorationQuery };
		}) => Promise<void>) => {
			const acquired = new Set<string>();
			const updated = new Set<string>();
			const query = async (sql: string, args: string[]): Promise<unknown[]> => {
				const [userId, type, sourceId] = args;
				const key = noticeKey(userId, type, sourceId);
				const notice = notices.get(key);
				if (sql.startsWith('SELECT "sourceId"')) {
					expect(sql).toContain('AND "sentAt" IS NULL FOR UPDATE SKIP LOCKED');
					if (notice == null || notice.sentAt != null || locks.has(key)) return [];
					locks.add(key); acquired.add(key);
					return [{ sourceId }];
				}
				if (sql.startsWith('UPDATE hatask_flower_notice')) {
					if (!acquired.has(key)) throw new Error('Notice must be locked before marking it sent');
					updated.add(key);
					return [];
				}
				throw new Error(`Unexpected transaction query: ${sql}`);
			};
			let currentId = '';
			const builder: CurrentDecorationQuery = {
				where: (sql, parameters) => {
					expect(sql).toBe('decoration.id = :id AND decoration.host IS NULL');
					currentId = parameters.id;
					return builder;
				},
				setLock: mode => { expect(mode).toBe('pessimistic_read'); return builder; },
				getOne: async () => {
					beforeDelivery();
					return rewards.find(value => value.id === currentId && value.host == null) ?? null;
				},
			};
			try {
				await callback({ query, getRepository: () => ({ createQueryBuilder: () => builder }) });
				for (const key of updated) {
					const notice = notices.get(key);
					if (notice == null) throw new Error('Missing locked notice');
					notice.sentAt = new Date(Date.now());
				}
			} finally { for (const key of acquired) locks.delete(key); }
		}),
	};
	const repository = { findBy: vi.fn(async () => rewards.filter(value => value.host == null && value.requiresHataskFlowerCompletion)
		.map(value => ({ ...value, roleIdsThatCanBeUsedThisDecoration: [...value.roleIdsThatCanBeUsedThisDecoration] }))) };
	const moduleRef = { get: (name: string) => {
		if (name === 'RoleService') return roleService;
		if (name === 'NotificationService') return notification;
		throw new Error(`Unexpected service: ${name}`);
	} };
	const createService = () => {
		const service = new AvatarDecorationService({} as never, { on: vi.fn(), off: vi.fn() } as never, repository as never, {} as never,
			{ manager } as never, {} as never, {} as never, {} as never, {} as never, moduleRef as never);
		services.push(service);
		return service;
	};
	return {
		service: createService(), createService, owners, completionDates, harvests, rewards, notices, locks,
		scanCalls, completionCalls, manager, repository, notification, roleService, beforeDelivery,
	};
}

beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(now); });
afterEach(() => {
	for (const service of services.splice(0)) service.onApplicationShutdown();
	vi.restoreAllMocks();
});

describe('Hatask decoration unlock outbox delivery', () => {
	test('秋の最後の花を12月に収穫しても、翌秋のワーカーだけで達成を記録し一度だけ通知する', async () => {
		const lastAutumnDay = Date.parse('2026-11-30T14:59:59Z');
		const winterStart = Date.parse('2026-11-30T15:00:00Z');
		const nextAutumn = Date.parse('2027-08-31T15:00:00Z');
		const f = fixture([owner('alice', { completed: false })]);
		f.harvests.push(...autumnHarvests('alice', new Date(lastAutumnDay)).slice(0, 11));
		vi.mocked(Date.now).mockReturnValue(lastAutumnDay);
		await f.service.notifyUnlockedDecorations();
		expect(f.completionDates.has('alice')).toBe(false);

		f.harvests.push({ userId: 'alice', speciesId: 'au12', season: 'autumn', harvestedAt: new Date(winterStart) });
		vi.mocked(Date.now).mockReturnValue(winterStart);
		await f.service.notifyUnlockedDecorations();
		expect(f.completionDates.has('alice')).toBe(false);
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();

		vi.mocked(Date.now).mockReturnValue(nextAutumn);
		await f.createService().notifyUnlockedDecorations();
		expect(f.completionDates.get('alice')).toEqual(new Date(nextAutumn));
		expect(f.completionCalls.map(call => call.season)).toEqual(['autumn', 'winter', 'autumn']);
		expect(f.completionCalls[2]).toEqual({
			at: new Date(nextAutumn), season: 'autumn', speciesIds: Array.from({ length: 12 }, (_, index) => `au${index + 1}`),
		});
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[0])).toEqual(['alice']);
		expect([...f.notices.values()]).toEqual([{ userId: 'alice', type: noticeType, sourceId: 'crown', sentAt: new Date(nextAutumn) }]);

		vi.mocked(Date.now).mockReturnValue(nextAutumn + 1000);
		await f.service.notifyUnlockedDecorations();
		await f.createService().notifyUnlockedDecorations();
		expect(f.completionDates.get('alice')).toEqual(new Date(nextAutumn));
		expect(f.notification.createNotificationAsync).toHaveBeenCalledOnce();
	});

	test('現在季節の12種だけを記録し、別季節・11種・重複を含む12本を達成扱いしない', async () => {
		const f = fixture(['complete', 'other-season', 'eleven', 'duplicate'].map(userId => owner(userId, { completed: false })));
		f.harvests.push(...autumnHarvests('complete'), ...autumnHarvests('eleven').slice(0, 11), ...autumnHarvests('duplicate').slice(0, 11));
		f.harvests.push({ userId: 'duplicate', speciesId: 'au1', season: 'autumn', harvestedAt: new Date(now) });
		f.harvests.push(...Array.from({ length: 12 }, (_, index): Harvest => ({
			userId: 'other-season', speciesId: `sp${index + 1}`, season: 'spring', harvestedAt: new Date('2026-05-01T00:00:00Z'),
		})));
		await f.service.notifyUnlockedDecorations();
		expect([...f.completionDates.entries()]).toEqual([['complete', new Date(now)]]);
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[0])).toEqual(['complete']);
		expect([...f.notices.values()].map(value => value.userId)).toEqual(['complete']);
	});

	test('特典未設定でも達成日時を記録し、季節が変わってから追加された特典を通知する', async () => {
		const f = fixture([owner('alice', { completed: false })], []);
		f.harvests.push(...autumnHarvests('alice'));
		await f.service.notifyUnlockedDecorations();
		expect(f.completionDates.get('alice')).toEqual(new Date(now));
		expect(f.scanCalls).toEqual([]);
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();

		const winterStart = Date.parse('2026-11-30T15:00:00Z');
		vi.mocked(Date.now).mockReturnValue(winterStart);
		f.rewards.push(decoration());
		await f.createService().notifyUnlockedDecorations();
		await f.service.notifyUnlockedDecorations();
		expect(f.completionDates.get('alice')).toEqual(new Date(now));
		expect(f.notification.createNotificationAsync).toHaveBeenCalledOnce();
		expect(f.notification.createNotificationAsync.mock.calls[0][0]).toBe('alice');
		expect([...f.notices.values()]).toEqual([{ userId: 'alice', type: noticeType, sourceId: 'crown', sentAt: new Date(winterStart) }]);
	});

	test('設定前から達成済みの所有者に後付けの報酬を通知し、再実行とサービス再作成で再送しない', async () => {
		const f = fixture([owner('alice')], []);
		await f.service.notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();
		f.rewards.push(decoration());
		await f.service.notifyUnlockedDecorations();
		await f.service.notifyUnlockedDecorations();
		await f.createService().notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledExactlyOnceWith('alice', noticeType, {
			customHeader: 'Hataskのアイコンデコ', customBody: '「秋のお花の冠」を獲得しました。アイコンデコの設定から着用できます。',
			customIcon: 'https://example.test/crown.webp', customLink: '/settings/avatar-decoration',
		}, null, 'hatask-decoration:crown');
		expect([...f.notices.values()]).toEqual([{ userId: 'alice', type: noticeType, sourceId: 'crown', sentAt: new Date(now) }]);
		f.rewards.push(decoration({ id: 'new-crown', name: '新しい冠' }));
		await f.service.notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[4])).toEqual(['hatask-decoration:crown', 'hatask-decoration:new-crown']);
	});

	test('達成済みのローカル有効アカウントだけをDBから選び、装飾データの宛先を信用しない', async () => {
		const poisonedReward = { ...decoration(), userId: 'victim', customLink: 'https://example.invalid' };
		const f = fixture([
			owner('alice'), owner('incomplete', { completed: false }), owner('remote', { host: 'remote.test' }),
			owner('deleted', { isDeleted: true }), owner('suspended', { isSuspended: true }),
		], [poisonedReward]);
		await f.service.notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[0])).toEqual(['alice']);
		const scan = f.scanCalls[0];
		expect(scan.sql).toContain('wallet."flowerCollectionCompletedAt" IS NOT NULL');
		expect(scan.sql).toContain('owner.host IS NULL AND owner."isDeleted" = false AND owner."isSuspended" = false');
		expect(scan.sql).toContain('notice."sentAt" IS NOT NULL');
		expect(scan.sql).toContain('ORDER BY wallet."userId" ASC LIMIT 100');
		expect(scan.rewardIds).toEqual(['crown']);
		expect(scan.type).toBe(noticeType);
		expect(f.repository.findBy).toHaveBeenCalledWith(expect.objectContaining({ requiresHataskFlowerCompletion: true, host: expect.objectContaining({ _type: 'isNull' }) }));
	});

	test('通常・リモート・開始前・終了済みの装飾は通知せず、ロール取得後の初回だけ通知する', async () => {
		const f = fixture([owner('alice')], [
			decoration({ id: 'plain', requiresHataskFlowerCompletion: false }), decoration({ id: 'remote', host: 'remote.test' }),
			decoration({ id: 'future', availableFrom: new Date(now + 1000) }), decoration({ id: 'expired', availableUntil: new Date(now) }),
			decoration({ id: 'members', roleIdsThatCanBeUsedThisDecoration: ['members'] }),
		]);
		await f.service.notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();
		expect(f.notices.size).toBe(0);
		f.owners.set('alice', owner('alice', { roles: ['members'] }));
		await f.service.notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[4])).toEqual(['hatask-decoration:members']);
		vi.mocked(Date.now).mockReturnValue(now + 1000);
		await f.service.notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[4])).toEqual(['hatask-decoration:members', 'hatask-decoration:future']);
	});

	test('並行ワーカーは同じ未送信行をSKIP LOCKEDし、一度だけ配信する', async () => {
		const f = fixture();
		let signalStarted = () => {}, release = () => {};
		const started = new Promise<void>(resolve => { signalStarted = resolve; });
		const holding = new Promise<void>(resolve => { release = resolve; });
		f.notification.createNotificationAsync.mockImplementation(async () => { signalStarted(); await holding; return { id: 'notice' }; });
		const first = f.service.notifyUnlockedDecorations();
		await started;
		await f.createService().notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(1);
		release();
		await first;
		expect([...f.notices.values()][0].sentAt).toEqual(new Date(now));
		expect(f.locks.size).toBe(0);
	});

	test.each(['replacement', 'release', 'period', 'role'] as const)('候補取得後の %s 変更を共有ロックで再確認し、古い獲得通知を送らない', async change => {
		const f = fixture([owner('alice', { roles: ['members'] })], [decoration({ roleIdsThatCanBeUsedThisDecoration: ['members'] })]);
		f.beforeDelivery.mockImplementationOnce(() => {
			if (change === 'replacement') f.rewards.splice(0, 1, decoration({ id: 'replacement-crown' }));
			if (change === 'release') f.rewards[0].requiresHataskFlowerCompletion = false;
			if (change === 'period') f.rewards[0].availableUntil = new Date(now);
			if (change === 'role') f.owners.set('alice', owner('alice'));
		});
		await f.service.notifyUnlockedDecorations();
		expect(f.beforeDelivery).toHaveBeenCalledOnce();
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();
		expect([...f.notices.values()]).toEqual([{ userId: 'alice', type: noticeType, sourceId: 'crown', sentAt: null }]);
	});

	test('送信失敗は未送信のまま保持し、別ユーザーを処理して次回に再試行する', async () => {
		const f = fixture([owner('alice'), owner('bob')]);
		f.notification.createNotificationAsync.mockRejectedValueOnce(new Error('delivery failed'));
		await expect(f.service.notifyUnlockedDecorations()).rejects.toThrow('Hatask decoration notifications failed');
		expect([...f.notices.values()].map(value => [value.userId, value.sentAt != null])).toEqual([['alice', false], ['bob', true]]);
		await f.createService().notifyUnlockedDecorations();
		expect(f.notification.createNotificationAsync.mock.calls.map(call => call[0])).toEqual(['alice', 'bob', 'alice']);
		expect([...f.notices.values()].every(value => value.sentAt != null)).toBe(true);
	});

	test('100人境界の後もDBカーソルを進め、すでに送信した人を再送しない', async () => {
		const people = Array.from({ length: 101 }, (_, index) => owner(`user-${String(index).padStart(3, '0')}`));
		const f = fixture(people);
		await f.service.notifyUnlockedDecorations();
		expect(f.scanCalls.map(call => call.cursor)).toEqual(['', 'user-099']);
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(101);
		expect(new Set(f.notification.createNotificationAsync.mock.calls.map(call => call[0])).size).toBe(101);
		expect(f.notices.size).toBe(101);
	});
});

test('花の通常outbox処理は専用のデコ獲得通知を消費しない', async () => {
	const pending = [
		{ userId: 'alice', type: noticeType, sourceId: 'crown', sentAt: null as Date | null },
		{ userId: 'alice', type: 'hataskFlowerBloomed', sourceId: 'flower', sentAt: null as Date | null },
	];
	const query = vi.fn(async (sql: string, args: unknown[] = []) => {
		if (sql.startsWith('SELECT "userId" FROM hatask_drop_wallet')) return [];
		if (sql.startsWith('SELECT * FROM hatask_flower_notice WHERE "sentAt"')) {
			expect(sql).toContain('type = ANY($1::varchar[])');
			const types = args[0] as string[];
			expect(types).toEqual(['hataskFlowerBloomed', 'hataskZukanUpdated', 'hataskFestivalBloomed']);
			return pending.filter(notice => types.includes(notice.type) && notice.sentAt == null);
		}
		if (sql.startsWith('SELECT * FROM hatask_flower_notice WHERE "userId"')) return pending.filter(notice => notice.userId === args[0] && notice.type === args[1] && notice.sourceId === args[2]);
		if (sql.startsWith('UPDATE hatask_flower_notice')) {
			for (const notice of pending) if (notice.userId === args[0] && notice.type === args[1] && notice.sourceId === args[2]) notice.sentAt = new Date(now);
			return [];
		}
		throw new Error(`Unexpected flower query: ${sql}`);
	});
	const db = { query, transaction: async (callback: (manager: { query: typeof query }) => Promise<void>) => callback({ query }) };
	const notification = { createNotificationAsync: vi.fn().mockResolvedValue({ id: 'flower-notice' }) };
	const flowerService = new HataskFlowerV2Service(db as never, {} as never, notification as never);
	await flowerService.checkNotifications();
	expect(notification.createNotificationAsync.mock.calls.map(call => call[1])).toEqual(['hataskFlowerBloomed']);
	expect(pending[0].sentAt).toBeNull();
	expect(pending[1].sentAt).toEqual(new Date(now));
});
