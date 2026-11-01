/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it } from 'vitest';
import { acceptNotificationUnreadState, forgetNotificationUnreadState } from './notification-unread-state.js';

afterEach(() => { forgetNotificationUnreadState('owner-a'); forgetNotificationUnreadState('owner-b'); });

describe('notification unread snapshot revisions', () => {
	it('rejects delayed counts using integer ordering beyond Number precision', () => {
		expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 3, revision: '9007199254740993' })).toBe(3);
		expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 0, revision: '9007199254740992' })).toBeNull();
		expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 2, revision: '9007199254740993' })).toBe(3);
	});
	it('keeps each account separate and rejects malformed snapshots', () => {
		expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 1, revision: '9' })).toBe(1);
		expect(acceptNotificationUnreadState('owner-b', { unreadNotificationsCount: 0, revision: '1' })).toBe(0);
		expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 0, revision: 'bad' })).toBeNull();
		expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 0, revision: '8' })).toBeNull();
		forgetNotificationUnreadState('owner-a');
		expect(acceptNotificationUnreadState('owner-a', { unreadNotificationsCount: 0, revision: '1' })).toBe(0);
	});
});
