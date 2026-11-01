/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import type { FindOperator } from 'typeorm';
import { NotificationService } from '@/core/NotificationService.js';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import type { MiNotification } from '@/models/Notification.js';
import GroupedNotificationsEndpoint from '@/server/api/endpoints/i/notifications-grouped.js';
import NotificationsEndpoint from '@/server/api/endpoints/i/notifications.js';

function compareStreamIds(a: string, b: string): number {
	const [aTime, aSequence] = a.split('-').map(BigInt);
	const [bTime, bSequence] = b.split('-').map(BigInt);
	return aTime < bTime ? -1 : aTime > bTime ? 1 : aSequence < bSequence ? -1 : aSequence > bSequence ? 1 : 0;
}

function withinBound(id: string, bound: string, lower: boolean): boolean {
	if (bound === '-' || bound === '+') return true;
	const exclusive = bound.startsWith('(');
	const order = compareStreamIds(id, exclusive ? bound.slice(1) : bound);
	return lower ? (exclusive ? order > 0 : order >= 0) : (exclusive ? order < 0 : order <= 0);
}

// Keep grouping, notification packing, ownership checks and unread counting real.
// Only Redis persistence, repositories and the user/note packers are fixtures.
function fixture(initial: MiNotification[]) {
	const individualReads: Record<string, string> = {};
	let revision = 0;
	const entries = initial.map(notification => [
		`${1000 + Number(notification.id.slice(1))}-0`, ['data', JSON.stringify(notification)],
	] as [string, string[]]);
	const range = (key: string, lower: string, upper: string, limit = Infinity, descending = false) => {
		expect(key).toBe('notificationTimeline:owner');
		return entries.filter(([id]) => withinBound(id, lower, true) && withinBound(id, upper, false))
			.sort(([a], [b]) => compareStreamIds(a, b) * (descending ? -1 : 1)).slice(0, limit);
	};
	const redis = {
		get: vi.fn(async (key: string) => key === 'notificationRevision:owner' ? String(revision) : null),
		incr: vi.fn(async () => ++revision),
		hgetall: vi.fn(async () => ({ ...individualReads })),
		hset: vi.fn(async (_key: string, id: string, streamId: string) => { individualReads[id] = streamId; return 1; }),
		xrange: vi.fn(async (key: string, lower: string, upper: string, _count?: string, limit?: number) => range(key, lower, upper, limit)),
		xrevrange: vi.fn(async (key: string, upper: string, lower: string, _count?: string, limit?: number) => range(key, lower, upper, limit, true)),
	};
	const users = [...new Set(initial.flatMap(notification => 'notifierId' in notification && notification.notifierId != null ? [notification.notifierId] : []))]
		.map(id => ({ id, host: null, isSuspended: false, isBot: false }));
	const notes = initial.flatMap(notification => notification.type === 'note' ? [{ id: notification.noteId, userId: notification.notifierId }] : []);
	const repository = <T extends { id: string }>(rows: T[]) => ({
		find: vi.fn(async (query: { where: { id: FindOperator<string[]> } }) => rows.filter(row => query.where.id.value.includes(row.id))),
	});
	const usersRepository = repository(users);
	const notesRepository = repository(notes);
	const packer = <T extends { id: string }>(rows: T[]) => ({
		packMany: vi.fn(async (items: T[]) => items),
		pack: vi.fn(async (id: string) => rows.find(row => row.id === id)),
	});
	const userPacker = packer(users);
	const notePacker = packer(notes);
	const cache = {
		userMutingsCache: { fetch: async () => new Set<string>() },
		userProfileCache: { fetch: async () => ({ mutedInstances: [] }) },
	};
	const entity = new NotificationEntityService(
		{ get: (name: string) => name === 'UserEntityService' ? userPacker : name === 'NoteEntityService' ? notePacker : {} } as never,
		notesRepository as never, usersRepository as never, {} as never, {} as never, {} as never, {} as never, cache as never,
	);
	entity.onModuleInit();
	const idService = { parseFull: (id: string) => ({ date: 1000 + Number(id.slice(1)), additional: 0n }) };
	const events = { publishMainStream: vi.fn() };
	const service = new NotificationService(
		{ perUserNotificationsMaxCount: 100 } as never, redis as never, usersRepository as never,
		{} as never, {} as never, entity, idService as never, events as never,
		{ pushNotification: vi.fn() } as never, cache as never, {} as never,
	);
	return {
		service,
		grouped: new GroupedNotificationsEndpoint(idService as never, entity, service),
		normal: new NotificationsEndpoint(idService as never, entity, service),
	};
}

const owner = { id: 'owner' } as never;
const date = '2026-10-28T00:00:00.000Z';
const note = (number: number, author = `author${number}`): MiNotification => ({
	id: `n${number}`, type: 'note', noteId: `note${number}`, notifierId: author, createdAt: date,
});

describe('grouped note notification read state with real notification packing', () => {
	test.each([2, 3])('all %i authors and notes survive grouping and become read', async count => {
		const f = fixture(Array.from({ length: count }, (_, index) => note(index + 1)));
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(count);
		const result = await f.grouped.exec({ limit: 20, markAsRead: true }, owner, null, null);
		const descending = Array.from({ length: count }, (_, index) => count - index);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			type: 'note:grouped',
			noteIds: descending.map(number => `note${number}`),
			users: descending.map(number => ({ id: `author${number}` })),
			notificationIds: descending.map(number => `n${number}`),
		});
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(0);
	});

	test('multiple notes by one author retain every note and notification ID', async () => {
		const f = fixture([note(1, 'author'), note(2, 'author'), note(3, 'author')]);
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(3);
		const result = await f.grouped.exec({ limit: 20, markAsRead: true }, owner, null, null);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			type: 'note:grouped', noteIds: ['note3', 'note2', 'note1'], users: [{ id: 'author' }], notificationIds: ['n3', 'n2', 'n1'],
		});
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(0);
	});

	test('paged visible reads cover each source notification once without unread leftovers', async () => {
		const f = fixture([note(1), note(2), { id: 'n3', type: 'test', createdAt: date }, note(4), note(5)]);
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(5);
		const seen: string[] = [];
		let untilId: string | undefined;
		for (let page = 0; page < 3; page++) {
			const result: { id: string; notificationIds: string[] }[] = await f.grouped.exec({ limit: 1, markAsRead: false, untilId }, owner, null, null);
			expect(result).toHaveLength(1);
			// Fetching alone must not mark anything read; the visible row supplies its member IDs.
			expect(await f.service.getUnreadNotificationsCount('owner')).toBe(5 - seen.length);
			const ids = result.flatMap(item => item.notificationIds);
			await f.service.markNotificationsRead('owner', ids);
			seen.push(...ids);
			untilId = result[0].id;
		}
		expect(await f.grouped.exec({ limit: 1, markAsRead: false, untilId }, owner, null, null)).toEqual([]);
		expect(seen).toEqual(['n5', 'n4', 'n3', 'n2', 'n1']);
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(0);
	});

	test('ungrouped control reads both authors through the same service and storage', async () => {
		const f = fixture([note(1), note(2)]);
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(2);
		const result: { id: string }[] = await f.normal.exec({ limit: 20, markAsRead: true }, owner, null, null);
		expect(result.map(item => item.id)).toEqual(['n2', 'n1']);
		expect(await f.service.getUnreadNotificationsCount('owner')).toBe(0);
	});
});
