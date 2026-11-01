/* SPDX-License-Identifier: AGPL-3.0-only */

import { computed, ref, shallowRef } from 'vue';
import type * as Misskey from 'cherrypick-js';

/** Keep recipient IDs intact while their display information is loading. */
export function createPostFormRecipients(fetchUsers: (ids: string[]) => Promise<Misskey.entities.UserDetailed[]>) {
	const userIds = ref<string[]>([]);
	const users = shallowRef<Misskey.entities.UserDetailed[]>([]);
	const loading = ref(false);
	const missingIds = computed(() => userIds.value.filter(id => !users.value.some(user => user.id === id)));
	const ready = computed(() => !loading.value && missingIds.value.length === 0);
	const failed = computed(() => !loading.value && !ready.value);
	let generation = 0;
	let selectionEpoch = 0;

	async function load(ids: readonly string[]): Promise<void> {
		const currentGeneration = ++generation;
		selectionEpoch++;
		userIds.value = [...new Set(ids)];
		users.value = users.value.filter(user => userIds.value.includes(user.id));
		const idsToLoad = missingIds.value;
		loading.value = idsToLoad.length > 0;
		if (!loading.value) return;

		try {
			const loadedUsers = await fetchUsers(idsToLoad);
			if (currentGeneration !== generation) return;
			// A newer draft or an explicit removal must not inherit stale recipients.
			const byId = new Map([...loadedUsers, ...users.value].map(user => [user.id, user]));
			users.value = userIds.value.flatMap(id => {
				const user = byId.get(id);
				return user ? [user] : [];
			});
		} catch {
			// Keep the intended IDs for retry/autosave and fail closed on submission.
		} finally {
			if (currentGeneration === generation) loading.value = false;
		}
	}

	function add(user: Misskey.entities.UserDetailed): void {
		if (!userIds.value.includes(user.id)) userIds.value = [...userIds.value, user.id];
		if (!users.value.some(existing => existing.id === user.id)) users.value = [...users.value, user];
	}

	function remove(userId: string): void {
		selectionEpoch++;
		userIds.value = userIds.value.filter(id => id !== userId);
		users.value = users.value.filter(existing => existing.id !== userId);
	}

	function dispose(): void {
		generation++;
		selectionEpoch++;
	}

	function invalidateSelection(): void {
		selectionEpoch++;
	}

	return { userIds, users, missingIds, loading, ready, failed, load, add, remove, retry: () => load(userIds.value), dispose, invalidateSelection, selectionToken: () => selectionEpoch, isCurrentSelection: (token: number) => token === selectionEpoch };
}
