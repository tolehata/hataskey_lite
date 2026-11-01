/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refreshNotificationUnreadState } from './notification-unread-sync.js';
import { acceptNotificationUnreadState, forgetNotificationUnreadState } from './notification-unread-state.js';

const fixture = vi.hoisted(() => ({
	account: { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 3 },
	api: vi.fn(),
	updates: vi.fn(),
}));
vi.mock('@/i.js', () => ({ $i: fixture.account }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccount: (partial: object) => {
	Object.assign(fixture.account, partial);
	fixture.updates(partial);
} }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixture.api(...args) }));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

beforeEach(() => {
	fixture.account.id = 'owner-a';
	fixture.account.hasUnreadNotification = true;
	fixture.account.unreadNotificationsCount = 3;
	fixture.api.mockReset();
	fixture.updates.mockClear();
});
afterEach(() => { forgetNotificationUnreadState('owner-a'); forgetNotificationUnreadState('owner-b'); });

test('a zero server count clears both unread account fields', async () => {
	fixture.api.mockResolvedValue({ unreadNotificationsCount: 0, revision: '1' });
	await refreshNotificationUnreadState('owner-a');
	expect(fixture.api).toHaveBeenCalledExactlyOnceWith('notifications/unread-count', {});
	expect(fixture.account).toMatchObject({ hasUnreadNotification: false, unreadNotificationsCount: 0 });
});

test('remaining hidden unread notifications keep the exact server count', async () => {
	fixture.api.mockResolvedValue({ unreadNotificationsCount: 2, revision: '1' });
	await refreshNotificationUnreadState('owner-a');
	expect(fixture.account).toMatchObject({ hasUnreadNotification: true, unreadNotificationsCount: 2 });
});

test('a delayed snapshot cannot overwrite a newer stream revision', async () => {
	const request = deferred<{ unreadNotificationsCount: number; revision: string }>();
	fixture.api.mockReturnValue(request.promise);
	const refresh = refreshNotificationUnreadState('owner-a');
	expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 4, revision: '3' })).toBe(4);
	fixture.account.unreadNotificationsCount = 4;
	request.resolve({ unreadNotificationsCount: 0, revision: '2' });
	await refresh;
	expect(fixture.updates).not.toHaveBeenCalled();
	expect(fixture.account.unreadNotificationsCount).toBe(4);
});

test('a snapshot does not update an account switched while awaiting the request', async () => {
	const request = deferred<{ unreadNotificationsCount: number; revision: string }>();
	fixture.api.mockReturnValue(request.promise);
	const refresh = refreshNotificationUnreadState('owner-a');
	fixture.account.id = 'owner-b';
	request.resolve({ unreadNotificationsCount: 0, revision: '1' });
	await refresh;
	expect(fixture.updates).not.toHaveBeenCalled();
});

test('a failed count request preserves the last account state', async () => {
	fixture.api.mockRejectedValue(new Error('offline'));
	await expect(refreshNotificationUnreadState('owner-a')).resolves.toBeUndefined();
	expect(fixture.account).toMatchObject({ hasUnreadNotification: true, unreadNotificationsCount: 3 });
	expect(fixture.updates).not.toHaveBeenCalled();
});
