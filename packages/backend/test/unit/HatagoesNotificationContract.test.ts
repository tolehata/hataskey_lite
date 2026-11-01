/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import HatagoesUnreadCountEndpoint, { meta as hatagoesMeta } from '@/server/api/endpoints/hata/hatagoes/notifications/unread-count.js';
import NotificationsEndpoint from '@/server/api/endpoints/i/notifications.js';

describe('HataGoes notification API contract', () => {
	test('counts only the three Hata app brands for the signed-in user', async () => {
		const getUnreadNotificationCountsByBrand = vi.fn().mockResolvedValue({ standard: 9, hatask: 2, hatady: 3, hataFeed: 4 });
		const endpoint = new HatagoesUnreadCountEndpoint({ getUnreadNotificationCountsByBrand } as never);
		expect(hatagoesMeta.requireCredential).toBe(true);
		expect(await endpoint.exec({}, { id: 'owner' } as never, null, null)).toEqual({ count: 9, hatask: 2, hatady: 3, hataFeed: 4 });
		expect(getUnreadNotificationCountsByBrand).toHaveBeenCalledExactlyOnceWith('owner');
		await expect(endpoint.exec({ userId: 'someone-else' }, { id: 'owner' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
	});

	test('keeps the legacy notification markAsRead opt-out and default behavior', async () => {
		const getNotifications = vi.fn().mockResolvedValue([{ id: 'a' }]);
		const markNotificationsRead = vi.fn().mockResolvedValue(undefined);
		const packMany = vi.fn().mockResolvedValue([{ id: 'a' }]);
		const endpoint = new NotificationsEndpoint({ gen: vi.fn() } as never, { packMany } as never, { getNotifications, markNotificationsRead } as never);
		const brands = ['hatask', 'hatady', 'hataFeed'];
		expect(await endpoint.exec({ includeBrands: brands, includeHataskApp: true, markAsRead: false }, { id: 'owner' } as never, null, null)).toEqual([{ id: 'a' }]);
		expect(getNotifications).toHaveBeenCalledWith('owner', expect.objectContaining({ includeBrands: brands, includeHataskApp: true }));
		expect(markNotificationsRead).not.toHaveBeenCalled();
		await endpoint.exec({ includeBrands: brands }, { id: 'owner' } as never, null, null);
		expect(markNotificationsRead).toHaveBeenCalledExactlyOnceWith('owner', ['a']);
	});
});
