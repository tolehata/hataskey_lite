/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { CheckHataskMoodRemindersProcessorService } from '@/queue/processors/CheckHataskMoodRemindersProcessorService.js';
import type { MiRegistryItem } from '@/models/RegistryItem.js';
import CreateNotificationEndpoint, { meta } from '@/server/api/endpoints/notifications/create.js';

const now = Date.parse('2026-09-17T08:00:30+09:00');
const settings = { moodRemind: true, moodRemindTimes: ['朝 8:00', '昼 12:00'], moodRemindTimeZone: 'Asia/Tokyo' };
type Owner = { settings: unknown; moods?: unknown; active: boolean; updatedAt?: Date };

afterEach(() => { vi.restoreAllMocks(); });

function fixture() {
	vi.spyOn(Date, 'now').mockReturnValue(now);
	const owners = new Map<string, Owner>([['alice', { settings: structuredClone(settings), active: true }]]);
	const markers = new Map<string, MiRegistryItem>();
	const delivered = new Set<string>();
	const queries: { alias: string; conditions: string[]; params: Record<string, unknown>; lock?: string }[] = [];
	let serial = Promise.resolve();
	let nextId = 0;
	let beforeRead: (() => void) | undefined;
	const repository = {
		createQueryBuilder: vi.fn((alias: string) => {
			const query = { alias, conditions: [] as string[], params: {} as Record<string, unknown>, lock: undefined as string | undefined };
			queries.push(query);
			const builder = {
				select: vi.fn().mockReturnThis(), distinct: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(),
				orderBy: vi.fn().mockReturnThis(), addOrderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
				setLock: vi.fn((lock: string) => { query.lock = lock; return builder; }),
				where: vi.fn((condition: string, params?: Record<string, unknown>) => {
					query.conditions.push(condition); Object.assign(query.params, params); return builder;
				}),
				andWhere: vi.fn((condition: string, params?: Record<string, unknown>) => builder.where(condition, params)),
				getRawMany: vi.fn(async () => [...owners.keys()].sort().filter(id => id > String(query.params.cursor)).slice(0, 100).map(userId => ({ userId }))),
				getOne: vi.fn(async () => {
					const id = String(query.params.userId);
					const key = String(query.params.key);
					if (key === 'settings') {
						beforeRead?.();
						const owner = owners.get(id);
						return owner?.active ? { value: owner.settings, updatedAt: owner.updatedAt } : null;
					}
					if (key === 'moods') return owners.get(id)?.moods === undefined ? null : { value: owners.get(id)?.moods };
					return markers.get(id) ?? null;
				}),
			};
			return builder;
		}),
		insert: vi.fn(async (row: MiRegistryItem) => { markers.set(row.userId, row); }),
		update: vi.fn(async (id: string, values: Partial<MiRegistryItem>) => {
			const row = [...markers.values()].find(value => value.id === id)!;
			markers.set(row.userId, { ...row, ...values });
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
	const notification = { createNotificationAsync: vi.fn(async (userId: string, _type: string, _data: unknown, _notifier: unknown, key: string) => {
		// Standard Redis idempotency itself is exercised in NotificationIdempotency.test.ts.
		const unique = `${userId}:${key}`;
		if (delivered.has(unique)) return null;
		delivered.add(unique);
		return { id: unique };
	}) };
	const profiles = { findOne: vi.fn().mockResolvedValue({ lang: 'ja-JP' }) };
	const logger = { error: vi.fn() };
	const createService = () => new CheckHataskMoodRemindersProcessorService(
		{ ...repository, manager: { transaction } } as never, profiles as never,
		{ gen: () => `marker-${++nextId}` } as never, notification as never, { logger } as never,
	);
	return { owners, markers, delivered, queries, repository, manager, notification, profiles, logger, createService,
		service: createService(), beforeRead: (action: () => void) => { beforeRead = action; } };
}

describe('server-side Hatask mood reminders', () => {
	test('ブラウザなしで所有者へ送り、再実行・再起動しても同じ枠を重複配信しない', async () => {
		const f = fixture();
		await f.service.process(); await f.service.process(); await f.createService().process();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledExactlyOnceWith('alice', 'app', {
			appAccessTokenId: null, customHeader: '◉ きもち記録', customBody: '今の気分はどうですか？ Hataskで記録してみましょう',
			customIcon: null, customLink: '/hatask?tab=mood&notice=mood',
		}, undefined, 'hatask-mood:2026-09-17T08:00');
		expect(f.owners.get('alice')?.settings).toEqual(settings);
		expect(f.markers.get('alice')?.value).toEqual({ handledSlots: ['2026-09-17T08:00'] });
	});

	test('翌日にも自動で通知し、当日に記録した後の枠は送らない', async () => {
		const f = fixture(); await f.service.process();
		f.owners.get('alice')!.moods = [{ id: 'entry', date: '2026-09-17', time: '09:00', level: 3 }];
		vi.mocked(Date.now).mockReturnValue(Date.parse('2026-09-17T12:00:00+09:00'));
		await f.service.process(); expect(f.delivered.size).toBe(1);
		vi.mocked(Date.now).mockReturnValue(Date.parse('2026-09-18T08:00:00+09:00'));
		await f.service.process(); expect(f.delivered.size).toBe(2);
	});

	test('保存済みのオン・オフ変更と新しい時刻を次の実行で反映する', async () => {
		const f = fixture();
		f.owners.get('alice')!.settings = { ...settings, moodRemind: false };
		await f.service.process(); expect(f.delivered.size).toBe(0);
		f.owners.get('alice')!.settings = { ...settings, moodRemindTimes: ['昼 12:00'] };
		await f.service.process(); expect(f.delivered.size).toBe(0);
		vi.mocked(Date.now).mockReturnValue(Date.parse('2026-09-17T12:00:00+09:00'));
		await f.service.process(); expect(f.delivered.size).toBe(1);
	});

	test('ジョブが遅れても時間枠内なら送り、枠の後に保存した設定では遡って送らない', async () => {
		const f = fixture();
		vi.mocked(Date.now).mockReturnValue(Date.parse('2026-09-17T08:40:00+09:00'));
		f.owners.get('alice')!.updatedAt = new Date('2026-09-17T08:20:00+09:00');
		await f.service.process(); expect(f.delivered.size).toBe(0);
		f.owners.get('alice')!.updatedAt = new Date('2026-09-16T21:00:00+09:00');
		await f.service.process(); expect(f.delivered.size).toBe(1);
		expect(f.markers.get('alice')?.value).toEqual({ handledSlots: ['2026-09-17T08:00'] });
	});

	test('同時ワーカーは所有者ロック内で最新設定・送信済み枠を読む', async () => {
		const f = fixture(); await Promise.all([f.service.process(), f.createService().process()]);
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(1);
		expect(f.manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['hatask-mood-reminder', 'alice']);
		expect(f.queries.some(query => query.lock === 'pessimistic_write')).toBe(true);
	});

	test('候補抽出後に無効化・アカウント停止された場合も再判定する', async () => {
		const f = fixture(); f.beforeRead(() => { f.owners.get('alice')!.active = false; });
		await f.service.process(); expect(f.delivered.size).toBe(0);
		f.beforeRead(() => { f.owners.get('alice')!.active = true; f.owners.get('alice')!.settings = { ...settings, moodRemind: false }; });
		await f.service.process(); expect(f.delivered.size).toBe(0);
	});

	test('送信失敗は記録せず、他の利用者を継続して次の実行で再試行する', async () => {
		const f = fixture(); f.owners.set('bob', { settings, active: true });
		f.notification.createNotificationAsync.mockRejectedValueOnce(new Error('PRIVATE JOURNAL CONTENT'));
		await expect(f.service.process()).rejects.toThrow('failed for 1 users');
		expect(f.markers.has('alice')).toBe(false); expect(f.markers.has('bob')).toBe(true);
		expect(JSON.stringify(f.logger.error.mock.calls)).not.toContain('PRIVATE JOURNAL CONTENT');
		await f.service.process(); expect(f.delivered.size).toBe(2);
	});

	test('配信後のDB記録失敗も同じ冪等キーで再試行して履歴の二重追加を防ぐ', async () => {
		const f = fixture(); f.repository.insert.mockRejectedValueOnce(new Error('database unavailable'));
		await expect(f.service.process()).rejects.toThrow('failed for 1 users');
		expect(f.markers.has('alice')).toBe(false); expect(f.delivered.size).toBe(1);
		await f.service.process(); expect(f.delivered.size).toBe(1); expect(f.markers.has('alice')).toBe(true);
	});

	test('保存済み記録が壊れている場合は未記録と決めつけない', async () => {
		const f = fixture(); f.owners.get('alice')!.moods = { invalid: true };
		await f.service.process(); expect(f.delivered.size).toBe(0);
	});

	test('利用者の言語を使い、未知の言語は日本語に戻す', async () => {
		const f = fixture(); f.profiles.findOne.mockResolvedValue({ lang: 'en-US' });
		await f.service.process(); expect(f.notification.createNotificationAsync.mock.calls[0][2]).toMatchObject({ customHeader: 'Mood check-in' });
		f.profiles.findOne.mockResolvedValue({ lang: 'constructor' });
		vi.mocked(Date.now).mockReturnValue(Date.parse('2026-09-18T08:00:00+09:00'));
		await f.service.process(); expect(f.notification.createNotificationAsync.mock.calls[1][2]).toMatchObject({ customHeader: '◉ きもち記録' });
	});

	test('通知先や本文を設定から注入できず、全読取を本人のnative領域に限定する', async () => {
		const f = fixture(); f.owners.get('alice')!.settings = { ...settings, userId: 'victim', customBody: 'PRIVATE', customLink: 'https://example.invalid' };
		await f.service.process();
		expect(f.notification.createNotificationAsync.mock.calls[0][0]).toBe('alice');
		expect(JSON.stringify(f.notification.createNotificationAsync.mock.calls)).not.toContain('PRIVATE');
		for (const query of f.queries) {
			expect(query.conditions).toContain(`${query.alias}.domain IS NULL`);
			expect(query.params.scope).toEqual(['client', 'hatask']);
			if (query.params.userId) expect(query.params.userId).toBe('alice');
			if (query.alias === 'settings') expect(query.conditions).toContain('owner.host IS NULL AND owner.isDeleted = false AND owner.isSuspended = false');
		}
	});

	test('100人のページ境界を越えて全対象を処理する', async () => {
		const f = fixture();
		for (let i = 0; i < 101; i++) f.owners.set(`user-${String(i).padStart(3, '0')}`, { settings, active: true });
		await f.service.process(); expect(f.delivered.size).toBe(102);
	});
});

describe('old Hatask client reminder compatibility', () => {
	function fixtureEndpoint() {
		const notifications = { createNotification: vi.fn() };
		const endpoint = new CreateNotificationEndpoint(notifications as never);
		return { notifications, exec: (link: string, token: unknown = null) => endpoint.exec({ body: 'old client', link }, { id: 'alice' } as never, token as never, null) };
	}

	test('旧タブの気持ちタイマーだけを無効化し、サーバー処理との二重配信を防ぐ', async () => {
		const f = fixtureEndpoint(); await f.exec('/hatask?notice=mood');
		expect(f.notifications.createNotification).not.toHaveBeenCalled();
		expect(meta.requireCredential).toBe(true); expect(meta.kind).toBe('write:notifications');
	});
	test('カレンダー通知・通常通知・サードパーティアプリの通知は維持する', async () => {
		const f = fixtureEndpoint(); await f.exec('/hatask?notice=calendar'); await f.exec('/hatask');
		await f.exec('/hatask?notice=mood', { id: 'app-token' });
		expect(f.notifications.createNotification).toHaveBeenCalledTimes(3);
	});
	test('相対リンクの検証を維持する', async () => {
		const f = fixtureEndpoint();
		await expect(f.exec('https://example.invalid/hatask?notice=mood')).rejects.toMatchObject({ code: 'INVALID_LINK' });
		await expect(f.exec('//example.invalid/hatask?notice=mood')).rejects.toMatchObject({ code: 'INVALID_LINK' });
		expect(f.notifications.createNotification).not.toHaveBeenCalled();
	});
});
