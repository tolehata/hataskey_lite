/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { HatadyService } from '@/core/HatadyService.js';
import HatadyNotificationsMarkAsReadEndpoint from '@/server/api/endpoints/hata/hatady/notifications/mark-as-read.js';

describe('Hatady notification individual read', () => {
	test('only owned, undeleted source IDs are updated and mirrored', async () => {
		const findBy = vi.fn().mockResolvedValue([{ id: 'visible-a' }, { id: 'visible-b' }]);
		const update = vi.fn().mockResolvedValue({ affected: 2 });
		const markSourceNotificationsRead = vi.fn().mockResolvedValue(undefined);
		const service = Object.create(HatadyService.prototype) as HatadyService;
		Object.defineProperty(service, 'hatadyNotificationsRepository', { value: { findBy, update } });
		Object.defineProperty(service, 'notificationService', { value: { markSourceNotificationsRead } });

		await service.markNotificationsRead('owner', ['visible-a', 'foreign', 'deleted', 'visible-b']);

		expect(findBy).toHaveBeenCalledWith(expect.objectContaining({ notifieeId: 'owner' }));
		expect(update).toHaveBeenCalledWith(expect.objectContaining({ notifieeId: 'owner', isRead: false }), { isRead: true });
		expect(markSourceNotificationsRead).toHaveBeenCalledExactlyOnceWith('owner', 'hatady', ['visible-a', 'visible-b']);
	});

	test('endpoint passes only the authenticated owner and exact requested IDs', async () => {
		const markNotificationsRead = vi.fn().mockResolvedValue(undefined);
		const endpoint = new HatadyNotificationsMarkAsReadEndpoint({ markNotificationsRead } as never);
		await endpoint.exec({ notificationIds: ['sourceA'] }, { id: 'owner' } as never, null, null);
		expect(markNotificationsRead).toHaveBeenCalledExactlyOnceWith('owner', ['sourceA']);
	});
});
