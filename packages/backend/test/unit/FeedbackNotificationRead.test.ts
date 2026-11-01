/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { FeedbackService } from '@/core/FeedbackService.js';
import FeedbackNotificationReadEndpoint from '@/server/api/endpoints/hata/feedback/notifications/read.js';

describe('FeedbackService notification reads', () => {
	test('marks only the requested notification owned by the current user as read', async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const service = Object.create(FeedbackService.prototype) as FeedbackService;
		Object.defineProperty(service, 'feedbackNotificationsRepository', {
			value: { update, existsBy: vi.fn().mockResolvedValue(true) },
		});
		Object.defineProperty(service, 'notificationService', { value: { markSourceNotificationsRead: vi.fn().mockResolvedValue(undefined) } });

		await service.markNotificationRead('user-a', 'notification-a');

		expect(update).toHaveBeenCalledOnce();
		expect(update).toHaveBeenCalledWith({
			id: 'notification-a',
			userId: 'user-a',
			isRead: false,
		}, { isRead: true });
	});

	test('keeps the existing mark-all behavior scoped to the current user', async () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const service = Object.create(FeedbackService.prototype) as FeedbackService;
		Object.defineProperty(service, 'feedbackNotificationsRepository', {
			value: { update, findBy: vi.fn().mockResolvedValue([{ id: 'notification-a' }]) },
		});
		Object.defineProperty(service, 'notificationService', { value: { markSourceNotificationsRead: vi.fn().mockResolvedValue(undefined) } });

		await service.markAllNotificationsRead('user-a');

		expect(update).toHaveBeenCalledOnce();
		expect(update).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-a', isRead: false }), { isRead: true });
	});
});

describe('HataFeed notification read endpoint', () => {
	function createEndpoint(canAccess: boolean) {
		const feedbackService = {
			canAccess: vi.fn().mockResolvedValue(canAccess),
			markNotificationRead: vi.fn().mockResolvedValue(undefined),
			markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
		} as unknown as FeedbackService;

		return {
			endpoint: new FeedbackNotificationReadEndpoint(feedbackService),
			feedbackService,
		};
	}

	function exec(endpoint: FeedbackNotificationReadEndpoint, params: { notificationId?: string }) {
		return endpoint.exec(params, { id: 'user-a' } as never, null, null);
	}

	test('rejects both individual and mark-all reads when HataFeed access is unavailable', async () => {
		const { endpoint, feedbackService } = createEndpoint(false);

		await expect(exec(endpoint, { notificationId: 'notificationA' })).rejects.toMatchObject({ code: 'HATAFEED_ACCESS_DENIED' });
		await expect(exec(endpoint, {})).rejects.toMatchObject({ code: 'HATAFEED_ACCESS_DENIED' });
		expect(feedbackService.markNotificationRead).not.toHaveBeenCalled();
		expect(feedbackService.markAllNotificationsRead).not.toHaveBeenCalled();
	});

	test('marks only the requested notification when access is available', async () => {
		const { endpoint, feedbackService } = createEndpoint(true);

		await exec(endpoint, { notificationId: 'notificationA' });

		expect(feedbackService.markNotificationRead).toHaveBeenCalledOnce();
		expect(feedbackService.markNotificationRead).toHaveBeenCalledWith('user-a', 'notificationA');
		expect(feedbackService.markAllNotificationsRead).not.toHaveBeenCalled();
	});

	test('keeps mark-all behavior when access is available and no notification is specified', async () => {
		const { endpoint, feedbackService } = createEndpoint(true);

		await exec(endpoint, {});

		expect(feedbackService.markAllNotificationsRead).toHaveBeenCalledOnce();
		expect(feedbackService.markAllNotificationsRead).toHaveBeenCalledWith('user-a');
		expect(feedbackService.markNotificationRead).not.toHaveBeenCalled();
	});
});
