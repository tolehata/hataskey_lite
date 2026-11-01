/* SPDX-License-Identifier: AGPL-3.0-only */

export type NotificationUnreadState = { unreadNotificationsCount: number; revision: string };

const latestRevision = new Map<string, { revision: bigint; count: number }>();

/** Main-stream counts are snapshots. Never let a delayed snapshot replace a newer one. */
export function acceptNotificationUnreadState(ownerId: string | null | undefined, state: NotificationUnreadState): number | null {
	if (!ownerId || !Number.isSafeInteger(state.unreadNotificationsCount) || state.unreadNotificationsCount < 0 || !/^\d+$/.test(state.revision)) return null;
	const revision = BigInt(state.revision);
	const previous = latestRevision.get(ownerId);
	if (previous !== undefined && revision < previous.revision) return null;
	if (previous !== undefined && revision === previous.revision) return previous.count;
	latestRevision.set(ownerId, { revision, count: state.unreadNotificationsCount });
	return state.unreadNotificationsCount;
}

export function forgetNotificationUnreadState(ownerId: string): void {
	latestRevision.delete(ownerId);
}
