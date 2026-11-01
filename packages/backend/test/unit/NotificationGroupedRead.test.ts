/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import GroupedNotificationsEndpoint from '@/server/api/endpoints/i/notifications-grouped.js';
import type { MiNotification } from '@/models/Notification.js';

describe('grouped notification read boundary', () => {
	test('returns and marks only members of groups that fit the response limit', async () => {
		const notifications = [
			{ id: 'r3', type: 'reaction', noteId: 'noteA', notifierId: 'userA', reaction: ':a:', createdAt: '2026-09-30T00:00:03.000Z' },
			{ id: 'r2', type: 'reaction', noteId: 'noteA', notifierId: 'userB', reaction: ':b:', createdAt: '2026-09-30T00:00:02.000Z' },
			{ id: 'r1', type: 'reaction', noteId: 'noteB', notifierId: 'userC', reaction: ':c:', createdAt: '2026-09-30T00:00:01.000Z' },
		] as MiNotification[];
		const notificationService = {
			getNotifications: vi.fn().mockResolvedValue(notifications),
			findNotificationsByIds: vi.fn(async (_userId: string, ids: string[]) => notifications.filter(notification => ids.includes(notification.id))),
			markNotificationsRead: vi.fn().mockResolvedValue([]),
		};
		const entityService = {
			packGroupedMany: vi.fn(async (items: Array<{ type: string; reactions?: Array<{ userId: string; reaction: string }> }>) => items.map(item => item.type === 'reaction:grouped'
				? { ...item, reactions: item.reactions?.map(reaction => ({ user: { id: reaction.userId }, reaction: reaction.reaction })) }
				: item)),
			packMany: vi.fn(async (items: unknown[]) => items),
		};
		const endpoint = new GroupedNotificationsEndpoint({ gen: vi.fn() } as never, entityService as never, notificationService as never);
		const result = await endpoint.exec({ limit: 1, markAsRead: true }, { id: 'owner' } as never, null, null);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ type: 'reaction:grouped', notificationIds: ['r3', 'r2'] });
		expect(notificationService.markNotificationsRead).toHaveBeenCalledWith('owner', ['r3', 'r2']);
		expect(notificationService.findNotificationsByIds).toHaveBeenCalledWith('owner', ['r3', 'r2']);
	});

	test('a member dropped by the first group pack stays unread even if the second pack sees it again', async () => {
		const notifications = [
			{ id: 'r3', type: 'reaction', noteId: 'noteA', notifierId: 'userA', reaction: ':a:', createdAt: '2026-09-30T00:00:03.000Z' },
			{ id: 'r2', type: 'reaction', noteId: 'noteA', notifierId: 'userB', reaction: ':b:', createdAt: '2026-09-30T00:00:02.000Z' },
		] as MiNotification[];
		const notificationService = {
			getNotifications: vi.fn().mockResolvedValue(notifications),
			findNotificationsByIds: vi.fn().mockResolvedValue(notifications),
			markNotificationsRead: vi.fn().mockResolvedValue([]),
		};
		const entityService = {
			packGroupedMany: vi.fn(async (groups: Array<{ id: string }>) => groups.map(group => ({ id: group.id, type: 'reaction:grouped', reactions: [{ user: { id: 'userA' }, reaction: ':a:' }] }))),
			packMany: vi.fn().mockResolvedValue([{ id: 'r3' }, { id: 'r2' }]),
		};
		const endpoint = new GroupedNotificationsEndpoint({ gen: vi.fn() } as never, entityService as never, notificationService as never);
		const result = await endpoint.exec({ limit: 1, markAsRead: true }, { id: 'owner' } as never, null, null);
		expect(result[0].notificationIds).toEqual(['r3']);
		expect(notificationService.markNotificationsRead).toHaveBeenCalledWith('owner', ['r3']);
	});
});
