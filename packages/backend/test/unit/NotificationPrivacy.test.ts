/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import type { MiNotification } from '@/models/Notification.js';

function fixture(workVisibility: 'public' | 'private') {
	const source = { id: 'source', notifieeId: 'owner', notifierId: null, type: 'mediaReaction', deletedAt: null, isRead: false, mediaSessionId: 'session', mediaWorkId: null };
	const session = { id: 'session', userId: 'author', workId: 'work', visibility: 'public' };
	const work = { id: 'work', userId: 'author', title: 'Current work title', visibility: workVisibility };
	const repositories = {
		MiHatadyMediaSession: { findOneBy: vi.fn().mockResolvedValue(session) },
		MiHatadyMediaWork: { findOneBy: vi.fn().mockResolvedValue(work) },
		MiHatadyMediaComment: { findOneBy: vi.fn().mockResolvedValue(null) },
	};
	const notificationRepository = { findOneBy: vi.fn().mockResolvedValue(source), manager: { getRepository: vi.fn((entity: { name: string }) => repositories[entity.name as keyof typeof repositories]) } };
	const media = { canViewSession: vi.fn().mockResolvedValue(true), canViewWork: vi.fn().mockResolvedValue(workVisibility === 'public') };
	const moduleRef = { get: vi.fn((name: string) => name === 'HatadyMediaService' ? media : { canAppearInTimeline: vi.fn().mockResolvedValue(true) }) };
	const service = new NotificationEntityService(moduleRef as never, {} as never, {} as never, {} as never, {} as never, {} as never, notificationRepository as never, {} as never);
	service.onModuleInit();
	const notification = { id: 'standard', createdAt: new Date().toISOString(), type: 'hatady', sourceNotificationId: 'source', subtype: 'mediaReaction', targetType: 'session', targetId: 'session' } as MiNotification;
	return { service, notification, source, notificationRepository, media };
}

describe('Hatady standard notification privacy', () => {
	test('uses the current visible work title behind a public session', async () => {
		const f = fixture('public');
		const packed = await f.service.pack(f.notification, 'owner', { checkValidNotifier: false });
		expect(packed).toMatchObject({ type: 'hatady', title: 'Current work title', mediaSessionId: 'session', mediaWorkId: 'work' });
	});

	test('keeps a public session but hides its private work title and ID', async () => {
		const f = fixture('private');
		const packed = await f.service.pack(f.notification, 'owner', { checkValidNotifier: false });
		expect(packed).toMatchObject({ type: 'hatady', mediaSessionId: 'session' });
		expect(packed).not.toHaveProperty('title');
		expect(packed).not.toHaveProperty('mediaWorkId');
	});

	test('suppresses an immutable media-comment target after the original comment is deleted', async () => {
		const f = fixture('public');
		const notification = { ...f.notification, targetType: 'mediaComment', targetId: 'deleted-comment' } as MiNotification;
		expect(await f.service.pack(notification, 'owner', { checkValidNotifier: false })).toBeNull();
	});
});
