/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { NotificationService } from '@/core/NotificationService.js';
import type { MiNotification } from '@/models/Notification.js';

type Scenario = {
	entries: [string, string[]][];
	cursor: string | null;
	individualReads: Record<string, string>;
	hidden: Set<string>;
};

// 決定的な乱数(mulberry32)。失敗時に同じシナリオを再現できるようにする。
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeScenario(seed: number): Scenario {
	const r = rng(seed);
	const count = Math.floor(r() * 60);
	const notifications: { entryId: string; notification: Record<string, unknown> }[] = [];
	for (let index = 0; index < count; index++) {
		const id = `n${index}`;
		const entryId = `${1000 + index}-0`;
		const kind = Math.floor(r() * 3);
		let notification: Record<string, unknown>;
		if (kind === 0) notification = { id, type: 'reaction', notifierId: 'u1', noteId: `note${index}` };
		else if (kind === 1) notification = { id, type: 'app', header: 'Hataskey', link: '/announcements' };
		else notification = { id, type: 'follow', notifierId: 'u2' };
		notifications.push({ entryId, notification });
	}
	const cursorIndex = Math.floor(r() * (count + 2)) - 1;
	const cursor = cursorIndex < 0 ? null : `${1000 + cursorIndex}-0`;
	const individualReads: Record<string, string> = {};
	const hidden = new Set<string>();
	for (const { entryId, notification } of notifications) {
		if (r() < 0.2) individualReads[notification.id as string] = entryId;
		if (r() < 0.25) hidden.add(notification.id as string);
	}
	// xrevrange は新しい順に返す。
	const entries = notifications.reverse().map(({ entryId, notification }): [string, string[]] => [entryId, ['data', JSON.stringify(notification)]]);
	return { entries, cursor, individualReads, hidden };
}

function compareStreamIds(a: string, b: string): number {
	const [am, as] = a.split('-').map(BigInt);
	const [bm, bs] = b.split('-').map(BigInt);
	return am === bm ? (as < bs ? -1 : as > bs ? 1 : 0) : am < bm ? -1 : 1;
}

function expectedCount(s: Scenario): number {
	let count = 0;
	for (const [entryId, fields] of s.entries) {
		const notification = JSON.parse(fields[1]) as { id: string };
		if (s.hidden.has(notification.id)) continue;
		const read = (s.cursor != null && compareStreamIds(entryId, s.cursor) <= 0) || Object.hasOwn(s.individualReads, notification.id);
		if (!read) count++;
	}
	return count;
}

function makeService(s: Scenario) {
	const redisClient = {
		xrevrange: vi.fn().mockResolvedValue(s.entries),
		get: vi.fn(async (key: string) => key.startsWith('latestReadNotification:') ? s.cursor : null),
		hgetall: vi.fn(async () => ({ ...s.individualReads })),
		eval: vi.fn().mockResolvedValue(0),
	};
	// 実物と同じく、可視判定は1件ごとに独立(隠す集合に入っていなければ残る)。
	const notificationEntityService = { packMany: vi.fn(async (notifications: MiNotification[]) => notifications.filter(x => !s.hidden.has(x.id))) };
	const service = new NotificationService(
		{} as never,
		redisClient as never,
		{} as never,
		notificationEntityService as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
	);
	return { service, notificationEntityService };
}

describe('unread notification counts only pack unread notifications', () => {
	test('counts match the full-pack specification for 500 random timelines', async () => {
		let nonZero = 0;
		let withHidden = 0;
		for (let seed = 1; seed <= 500; seed++) {
			const scenario = makeScenario(seed);
			const expected = expectedCount(scenario);
			const { service } = makeService(scenario);
			expect(await service.getUnreadNotificationsCount('owner'), `seed ${seed}`).toBe(expected);
			if (expected > 0) nonZero++;
			if (scenario.hidden.size > 0) withHidden++;
		}
		// シナリオが空振りしていないこと(未読あり・非表示ありが十分に含まれる)。
		expect(nonZero).toBeGreaterThan(300);
		expect(withHidden).toBeGreaterThan(300);
	});

	test('packMany receives only unread notifications', async () => {
		const scenario = makeScenario(42);
		scenario.hidden.clear();
		const { service, notificationEntityService } = makeService(scenario);
		const unreadTotal = await service.getUnreadNotificationsCount('owner');
		expect(scenario.entries.length).toBeGreaterThan(unreadTotal);
		expect(notificationEntityService.packMany).toHaveBeenCalledOnce();
		expect(notificationEntityService.packMany.mock.calls[0][0]).toHaveLength(unreadTotal);
	});

	test('packMany is not called when everything is read', async () => {
		const entries: [string, string[]][] = Array.from({ length: 500 }, (_, index): [string, string[]] =>
			[`${2000 - index}-0`, ['data', JSON.stringify({ id: `n${index}`, type: 'follow', notifierId: 'u1' })]]);
		const { service, notificationEntityService } = makeService({ entries, cursor: '2000-0', individualReads: {}, hidden: new Set() });
		expect(await service.getUnreadNotificationsCount('owner')).toBe(0);
		expect(notificationEntityService.packMany).not.toHaveBeenCalled();
	});
});
