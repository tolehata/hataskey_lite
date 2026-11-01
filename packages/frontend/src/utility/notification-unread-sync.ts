/* SPDX-License-Identifier: AGPL-3.0-only */

import { $i } from '@/i.js';
import { updateCurrentAccount } from '@/accounts.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { acceptNotificationUnreadState } from '@/utility/notification-unread-state.js';

/** Reconcile a completed read with the server's revisioned unread count. */
export async function refreshNotificationUnreadState(ownerId: string | null | undefined): Promise<void> {
	if (!ownerId || $i?.id !== ownerId) return;
	try {
		const state = await misskeyApi('notifications/unread-count', {});
		if ($i?.id !== ownerId) return;
		const count = acceptNotificationUnreadState(ownerId, state);
		if (count !== null) updateCurrentAccount({ hasUnreadNotification: count > 0, unreadNotificationsCount: count });
	} catch {
		// The read succeeded; a failed count request must not undo it.
	}
}
