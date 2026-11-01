/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import UnreadCountEndpoint, { meta, paramDef } from '@/server/api/endpoints/notifications/unread-count.js';

describe('standard notification unread count endpoint', () => {
	test('reads only the authenticated owner and returns the matching revision snapshot', async () => {
		const getUnreadNotificationState = vi.fn().mockResolvedValue({ unreadNotificationsCount: 4, revision: '9007199254740993' });
		const endpoint = new UnreadCountEndpoint({ getUnreadNotificationState } as never);
		expect(meta.requireCredential).toBe(true);
		expect(meta.kind).toBe('read:account');
		expect(await endpoint.exec({}, { id: 'owner' } as never, null, null)).toEqual({ unreadNotificationsCount: 4, revision: '9007199254740993' });
		expect(getUnreadNotificationState).toHaveBeenCalledExactlyOnceWith('owner');
		expect(paramDef.additionalProperties).toBe(false);
		await expect(endpoint.exec({ userId: 'another-user' }, { id: 'owner' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(getUnreadNotificationState).toHaveBeenCalledTimes(1);
	});
});
