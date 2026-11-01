/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import GroupedNotificationsEndpoint from '@/server/api/endpoints/i/notifications-grouped.js';
import type { MiGroupedNotification, MiNotification } from '@/models/Notification.js';

type NotificationPage = { id: string; notificationIds: string[] }[];

const id = (value: number) => `n${String(value).padStart(4, '0')}`;
const createdAt = (value: number) => new Date(Date.UTC(2026, 9, 26, 0, 0, value)).toISOString();
const follow = (value: number) => ({ id: id(value), createdAt: createdAt(value), type: 'follow', notifierId: `user${value}` }) as MiNotification;
const reaction = (value: number, noteId: string, notifierId: string) => ({
	id: id(value), createdAt: createdAt(value), type: 'reaction', noteId, notifierId, reaction: ':a:',
}) as MiNotification;

function fixture(notifications: MiNotification[]) {
	const notificationService = {
		getNotifications: vi.fn(async (_owner: string, options: { limit: number; untilId?: string; sinceId?: string }) => {
			const matching = notifications.filter(item => (!options.untilId || item.id < options.untilId) && (!options.sinceId || item.id > options.sinceId));
			matching.sort((a, b) => a.id.localeCompare(b.id));
			if (!options.sinceId || options.untilId) matching.reverse();
			return matching.slice(0, options.limit);
		}),
		findNotificationsByIds: vi.fn(async (_owner: string, ids: string[]) => notifications.filter(item => ids.includes(item.id))),
		markNotificationsRead: vi.fn().mockResolvedValue([]),
	};
	const entityService = {
		packGroupedMany: vi.fn(async (groups: MiGroupedNotification[]) => groups.map(group => {
			if (group.type === 'reaction:grouped') return { ...group, reactions: group.reactions.map(item => ({ user: { id: item.userId }, reaction: item.reaction })) };
			if (group.type === 'reaction:groupedByUser') return { ...group, reactions: group.reactions.map(item => ({ note: { id: item.noteId }, reaction: item.reaction })) };
			return group;
		})),
		packMany: vi.fn(async (items: MiNotification[]) => items),
	};
	return {
		endpoint: new GroupedNotificationsEndpoint({ gen: vi.fn() } as never, entityService as never, notificationService as never),
		notificationService,
	};
}

describe('grouped notification pagination', () => {
	test.each(['note', 'user'] as const)('keeps every notification reachable across a %s reaction group at the 20-row boundary', async (kind) => {
		const notifications = [
			reaction(23, 'noteA', 'userA'),
			...Array.from({ length: 21 }, (_, index) => follow(22 - index)),
			reaction(1, kind === 'note' ? 'noteA' : 'noteB', kind === 'note' ? 'userB' : 'userA'),
		];
		const { endpoint, notificationService } = fixture(notifications);
		const first: NotificationPage = await endpoint.exec({ limit: 20, markAsRead: false }, { id: 'owner' } as never, null, null);
		expect(first).toHaveLength(20);
		const cursor = first.map(item => item.id).sort().at(0);
		const next: NotificationPage = await endpoint.exec({ limit: 20, untilId: cursor, markAsRead: false }, { id: 'owner' } as never, null, null);
		expect(next.flatMap(item => item.notificationIds)).toEqual(['n0003', 'n0002', 'n0001']);
		expect([...first, ...next].flatMap(item => item.notificationIds)).toEqual([
			'n0023', 'n0022', 'n0021', 'n0020', 'n0019', 'n0018', 'n0017', 'n0016', 'n0015', 'n0014', 'n0013', 'n0012',
			'n0011', 'n0010', 'n0009', 'n0008', 'n0007', 'n0006', 'n0005', 'n0004', 'n0003', 'n0002', 'n0001',
		]);
		expect(notificationService.markNotificationsRead).not.toHaveBeenCalled();
	});

	test.each(['older', 'newer'] as const)('does not read group members beyond the %s page boundary', async (direction) => {
		const notifications = [reaction(5, 'noteA', 'userA'), follow(4), reaction(3, 'noteA', 'userB'), follow(2), reaction(1, 'noteA', 'userC')];
		const { endpoint, notificationService } = fixture(notifications);
		const first: NotificationPage = await endpoint.exec({ limit: 1, markAsRead: true, ...(direction === 'newer' ? { sinceId: 'n0000' } : {}) }, { id: 'owner' } as never, null, null);
		const expectedFirst = direction === 'older' ? ['n0005'] : ['n0001'];
		expect(first.flatMap(item => item.notificationIds)).toEqual(expectedFirst);
		expect(notificationService.markNotificationsRead).toHaveBeenCalledExactlyOnceWith('owner', expectedFirst);
		const cursor = direction === 'older' ? first.map(item => item.id).sort().at(0) : first.map(item => item.id).sort().at(-1);
		const next: NotificationPage = await endpoint.exec({ limit: 1, markAsRead: true, ...(direction === 'older' ? { untilId: cursor } : { sinceId: cursor }) }, { id: 'owner' } as never, null, null);
		expect(next.flatMap(item => item.notificationIds)).toEqual(direction === 'older' ? ['n0004'] : ['n0002']);
	});

	test.each(['note', 'user'] as const)('still combines nonadjacent %s reactions inside the returned page', async (kind) => {
		const { endpoint } = fixture([
			reaction(3, 'noteA', 'userA'), follow(2), reaction(1, kind === 'note' ? 'noteA' : 'noteB', kind === 'note' ? 'userB' : 'userA'),
		]);
		const result: NotificationPage = await endpoint.exec({ limit: 2, markAsRead: false }, { id: 'owner' } as never, null, null);
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ type: kind === 'note' ? 'reaction:grouped' : 'reaction:groupedByUser', notificationIds: ['n0003', 'n0001'] });
		expect(result[1]).toMatchObject({ type: 'follow', notificationIds: ['n0002'] });
	});

	test('keeps the next page reachable when truncation changes grouping from note to user', async () => {
		const { endpoint } = fixture([reaction(4, 'noteA', 'userX'), reaction(3, 'noteB', 'userX'), follow(2), reaction(1, 'noteA', 'userY')]);
		const first: NotificationPage = await endpoint.exec({ limit: 2, markAsRead: false }, { id: 'owner' } as never, null, null);
		expect(first).toHaveLength(1);
		expect(first[0]).toMatchObject({ type: 'reaction:groupedByUser', notificationIds: ['n0004', 'n0003'] });
		const next: NotificationPage = await endpoint.exec({ limit: 2, untilId: first[0].id, markAsRead: false }, { id: 'owner' } as never, null, null);
		expect(next.flatMap(item => item.notificationIds)).toEqual(['n0002', 'n0001']);
	});
});
