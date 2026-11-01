/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { ReplyError } from 'ioredis';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { NotificationService } from '@/core/NotificationService.js';

const timers = vi.hoisted(() => ({ resolve: [] as (() => void)[] }));
vi.mock('node:timers/promises', () => ({
	setTimeout: vi.fn(() => new Promise<void>(resolve => { timers.resolve.push(resolve); })),
}));

const data = {
	appAccessTokenId: null,
	customHeader: 'Hatask', customBody: 'きょうの気持ちを記録しませんか？',
	customIcon: null, customLink: '/hatask?tab=mood',
};
const key = 'hatask-mood:2026-09-17T21:00';

function fixture() {
	const profile = { notificationRecieveConfig: {} as Record<string, { type: string }> };
	const records: { timeline: string; streamId: string; value: string }[] = [];
	const markers = new Map<string, { id: string; expiresAt: number }>();
	let clock = 0;
	let sequence = 0;
	let revision = 0;
	const redis = {
		get: vi.fn(async (key: string) => key.startsWith('notificationRevision:') ? String(revision) : null),
		incr: vi.fn(async () => ++revision),
		hexists: vi.fn().mockResolvedValue(0),
		xrange: vi.fn(async (timeline: string, start: string, end: string) => records
			.filter(record => record.timeline === timeline && record.streamId === start && record.streamId === end)
			.map(record => [record.streamId, ['data', record.value]])),
		xadd: vi.fn(async (_timeline: string, _maxlen: string, _approximate: string, _limit: string, streamId: string) => streamId),
		// Model Redis's atomic script contract; assertions below also check the Lua
		// operations and arguments. This unit fixture does not execute a Redis server.
		eval: vi.fn(async (_script: string, _keys: number, timeline: string, marker: string, _limit: string, streamId: string, value: string, ttl: string) => {
			if ((markers.get(marker)?.expiresAt ?? 0) > clock) return null;
			records.push({ timeline, streamId, value });
			markers.set(marker, { id: streamId, expiresAt: clock + Number(ttl) * 1000 });
			return streamId;
		}),
	};
	const packed = { id: 'packed', type: 'app', body: data.customBody };
	const entity = { pack: vi.fn().mockResolvedValue(packed) };
	const id = { gen: vi.fn(() => `notice-${++sequence}`), parseFull: vi.fn(() => ({ date: 1000 + sequence, additional: 0n })) };
	const stream = { publishMainStream: vi.fn() };
	const push = { pushNotification: vi.fn() };
	const createService = () => {
		const service = new NotificationService(
			{ perUserNotificationsMaxCount: 50 } as never, redis as never, {} as never, {} as never, {} as never, entity as never,
			id as never, stream as never, push as never,
			{ userProfileCache: { fetch: vi.fn().mockResolvedValue(profile) } } as never, {} as never,
		);
		vi.spyOn(service, 'getUnreadNotificationsCount').mockResolvedValue(1);
		return service;
	};
	return { service: createService(), createService, profile, redis, records, markers, entity, id, stream, push, advance: (ms: number) => { clock += ms; } };
}

async function deliverUnread(push: { pushNotification: ReturnType<typeof vi.fn> }) {
	for (const resolve of timers.resolve.splice(0)) resolve();
	await vi.waitFor(() => expect(push.pushNotification).toHaveBeenCalledTimes(1));
}

afterEach(() => {
	timers.resolve.length = 0;
	vi.restoreAllMocks();
});

describe('opt-in notification idempotency', () => {
	test('同じ宛先・キーの同時送信とサービス再作成後の再送を抑止し、pack・配信・pushを重ねない', async () => {
		const f = fixture();
		const results = await Promise.all([
			f.service.createNotificationAsync('alice', 'app', data, undefined, key),
			f.createService().createNotificationAsync('alice', 'app', data, undefined, key),
		]);
		expect(results.filter(Boolean)).toHaveLength(1);
		expect(results).toContain(null);
		await deliverUnread(f.push);
		expect(f.records).toHaveLength(1);
		expect(f.entity.pack).toHaveBeenCalledTimes(2);
		expect(f.stream.publishMainStream.mock.calls.map(call => call[1])).toEqual(['notification', 'unreadNotification']);
		expect(f.push.pushNotification).toHaveBeenCalledTimes(1);
		expect(await f.createService().createNotificationAsync('alice', 'app', data, undefined, key)).toBeNull();
		expect(timers.resolve).toHaveLength(0);
		expect(f.entity.pack).toHaveBeenCalledTimes(2);
		expect(f.stream.publishMainStream).toHaveBeenCalledTimes(2);
		expect(f.push.pushNotification).toHaveBeenCalledTimes(1);
		expect(f.redis.xadd).not.toHaveBeenCalled();
	});

	test('一つのLuaで重複確認→既存形式のXADD→7日期限の記録を実行する', async () => {
		const f = fixture();
		await f.service.createNotificationAsync('alice', 'app', data, undefined, key);
		const [script, keys, timeline, marker, limit, streamId, value, ttl] = f.redis.eval.mock.calls[0];
		expect(keys).toBe(2);
		expect(timeline).toBe('notificationTimeline:alice');
		expect(marker).toBe(`notificationDedup:alice:${createHash('sha256').update(key).digest('hex')}`);
		expect([limit, streamId, ttl]).toEqual(['50', '1001-0', '604800']);
		expect(JSON.parse(value)).toMatchObject({ id: 'notice-1', type: 'app', ...data });
		expect(script).toMatch(/if redis\.call\('EXISTS', KEYS\[2\]\) == 1 then\s+return false\s+end/);
		expect(script).toContain("redis.call('XADD', KEYS[1], 'MAXLEN', '~', ARGV[1], ARGV[2], 'data', ARGV[3])");
		expect(script).toContain("redis.call('SET', KEYS[2], id, 'EX', ARGV[4])");
		expect(script.indexOf("'EXISTS'")).toBeLessThan(script.indexOf("'XADD'"));
		expect(script.indexOf("'XADD'")).toBeLessThan(script.indexOf("'SET'"));
		expect(f.redis.eval).toHaveBeenCalledTimes(1);
	});

	test('宛先と送信日・時刻を分離し、任意の長いキーを固定長にする', async () => {
		const f = fixture();
		for (const [recipient, notificationKey] of [['alice', key], ['bob', key], ['alice', `${key}:next`], ['alice', '長'.repeat(10000)]]) {
			expect(await f.service.createNotificationAsync(recipient, 'app', data, undefined, notificationKey)).not.toBeNull();
		}
		expect(f.records).toHaveLength(4);
		for (const marker of f.markers.keys()) expect(marker).toMatch(/^notificationDedup:(alice|bob):[a-f0-9]{64}$/);
	});

	test('重複記録は7日間保持し、期限後は新規に作成できる', async () => {
		const f = fixture();
		await f.service.createNotificationAsync('alice', 'app', data, undefined, key);
		f.advance(604800000 - 1);
		expect(await f.service.createNotificationAsync('alice', 'app', data, undefined, key)).toBeNull();
		f.advance(1);
		expect(await f.service.createNotificationAsync('alice', 'app', data, undefined, key)).not.toBeNull();
		expect(f.records).toHaveLength(2);
	});

	test('キーを渡さない既存の非同期通知はXADDで毎回作成する', async () => {
		const f = fixture();
		await f.service.createNotificationAsync('alice', 'app', data);
		await f.service.createNotificationAsync('alice', 'app', data);
		expect(f.redis.eval).not.toHaveBeenCalled();
		expect(f.redis.xadd).toHaveBeenCalledTimes(2);
		expect(f.redis.xadd).toHaveBeenNthCalledWith(1, 'notificationTimeline:alice', 'MAXLEN', '~', '50', '1001-0', 'data', expect.any(String));
		expect(f.entity.pack).toHaveBeenCalledTimes(2);
	});

	test('Redis書込失敗を呼出元へ伝え、次回の再試行を妨げない', async () => {
		const f = fixture();
		f.redis.eval.mockRejectedValueOnce(new Error('connection lost'));
		await expect(f.service.createNotificationAsync('alice', 'app', data, undefined, key)).rejects.toThrow('connection lost');
		expect(f.markers.size).toBe(0);
		expect(f.entity.pack).not.toHaveBeenCalled();
		expect(f.stream.publishMainStream).not.toHaveBeenCalled();
		expect(f.push.pushNotification).not.toHaveBeenCalled();
		expect(await f.service.createNotificationAsync('alice', 'app', data, undefined, key)).not.toBeNull();
		expect(f.records).toHaveLength(1);
	});

	test('XADDのID衝突は新しいIDで再試行し、保存前に重複記録を残さない', async () => {
		const f = fixture();
		f.redis.eval.mockRejectedValueOnce(new ReplyError('ERR The ID specified in XADD is equal or smaller than the target stream top item'));
		expect(await f.service.createNotificationAsync('alice', 'app', data, undefined, key)).toMatchObject({ id: 'notice-2' });
		expect(f.redis.eval.mock.calls.map(call => call[5])).toEqual(['1001-0', '1002-0']);
		expect(f.records).toHaveLength(1);
	});

	test('Luaの権限エラーでは再試行ループへ入らず呼出元へ伝える', async () => {
		const f = fixture();
		// A second invocation deliberately succeeds, so a blanket retry fails this
		// assertion immediately instead of hanging the test on an endless rejection.
		const error = new ReplyError('NOPERM this user has no permissions to run the eval command');
		f.redis.eval.mockRejectedValueOnce(error);
		await expect(f.service.createNotificationAsync('alice', 'app', data, undefined, key)).rejects.toBe(error);
		expect(f.redis.eval).toHaveBeenCalledTimes(1);
		expect(f.records).toHaveLength(0);
		expect(f.entity.pack).not.toHaveBeenCalled();
	});

	test('stream保存後にpackが失敗しても一覧へ二重追加せず、pushの再送は保証しない', async () => {
		const f = fixture();
		f.entity.pack.mockRejectedValueOnce(new Error('packing failed'));
		await expect(f.service.createNotificationAsync('alice', 'app', data, undefined, key)).rejects.toThrow('packing failed');
		expect(await f.createService().createNotificationAsync('alice', 'app', data, undefined, key)).toBeNull();
		expect(f.records).toHaveLength(1);
		expect(f.entity.pack).toHaveBeenCalledTimes(1);
		expect(f.stream.publishMainStream).not.toHaveBeenCalled();
		expect(f.push.pushNotification).not.toHaveBeenCalled();
	});

	test('app通知の受信拒否は重複記録も通知もRedisへ書き込まない', async () => {
		const f = fixture();
		f.profile.notificationRecieveConfig.app = { type: 'never' };
		expect(await f.service.createNotificationAsync('alice', 'app', data, undefined, key)).toBeNull();
		expect(f.redis.eval).not.toHaveBeenCalled();
		expect(f.redis.xadd).not.toHaveBeenCalled();
		expect(f.entity.pack).not.toHaveBeenCalled();
		expect(f.stream.publishMainStream).not.toHaveBeenCalled();
		expect(f.push.pushNotification).not.toHaveBeenCalled();
	});
});
