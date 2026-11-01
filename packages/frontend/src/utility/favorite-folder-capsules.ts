/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive, watch } from 'vue';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { normalizeFavoriteCapsuleOrder } from '@/utility/favorite-folder-layout.js';

// Registry scope segments accept only letters, digits, and underscores.
const scope = ['client', 'favorite_folders'];
export const favoriteCapsules = reactive({ accountId: '', order: [] as string[], loaded: false, saving: false });
let pending: Promise<void> | null = null;
let generation = 0;

watch(() => [$i?.id, $i?.token], () => {
	generation++;
	Object.assign(favoriteCapsules, { accountId: $i?.id ?? '', order: [], loaded: false, saving: false });
	pending = null;
}, { flush: 'sync' });

function currentAccount() {
	const accountId = $i?.id ?? '';
	if (favoriteCapsules.accountId !== accountId) {
		Object.assign(favoriteCapsules, { accountId, order: [], loaded: false, saving: false });
		pending = null;
	}
	return accountId;
}

export async function loadFavoriteCapsules(): Promise<void> {
	const accountId = currentAccount();
	const token = $i?.token;
	const requestGeneration = generation;
	if (!accountId || favoriteCapsules.loaded) return;
	if (pending) return pending;
	const request = (async () => {
		let value: unknown;
		try {
			value = await misskeyApi('i/registry/get', { scope, key: 'capsuleOrder' }, token);
		} catch (error) {
			if ((error as { code?: string } | null)?.code !== 'NO_SUCH_KEY') throw error;
			value = [];
		}
		if ($i?.id !== accountId || $i.token !== token || requestGeneration !== generation) return;
		favoriteCapsules.order = Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];
		favoriteCapsules.loaded = true;
	})();
	pending = request;
	try {
		await request;
	} finally {
		if (pending === request) pending = null;
	}
}

export async function saveFavoriteCapsules(order: readonly string[], folderIds: readonly string[]): Promise<boolean> {
	const accountId = currentAccount();
	const token = $i?.token;
	const requestGeneration = generation;
	if (!accountId || !favoriteCapsules.loaded || favoriteCapsules.saving) return false;
	favoriteCapsules.saving = true;
	const next = normalizeFavoriteCapsuleOrder(order, folderIds);
	try {
		await misskeyApi('i/registry/set', { scope, key: 'capsuleOrder', value: next }, token);
		if ($i?.id !== accountId || $i.token !== token || requestGeneration !== generation) return false;
		favoriteCapsules.order = next;
		return true;
	} finally {
		if (requestGeneration === generation) favoriteCapsules.saving = false;
	}
}
