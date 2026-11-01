/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onActivated, onDeactivated, onScopeDispose, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { LtlEmojiVoteResponse } from '@/utility/ltl-emoji-vote-types.js';
import { $i } from '@/i.js';
import { useStream } from '@/stream.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { createLtlEmojiVoteStore } from '@/utility/ltl-emoji-vote-store.js';

let shared: { accountId: string | null; store: ReturnType<typeof createLtlEmojiVoteStore> } | null = null;

function getSharedStore() {
	const accountId = $i?.id ?? null;
	if (!shared || shared.accountId !== accountId) {
		shared?.store.destroy();
		shared = {
			accountId,
			store: createLtlEmojiVoteStore({
				accountId,
				getAccountId: () => $i?.id ?? null,
				show: (noteId, signal) => misskeyApi<LtlEmojiVoteResponse>('hata/emoji-vote/show', noteId ? { noteId } : {}, undefined, signal),
				vote: (roundId, emojiId, signal) => misskeyApi<LtlEmojiVoteResponse>('hata/emoji-vote/vote', { roundId, emojiId }, undefined, signal),
				monotonicNow: () => performance.now(),
				ownerDocument: window.document,
				subscribeReconnect: (callback) => {
					const stream = useStream();
					stream.on('_connected_', callback);
					return () => stream.off('_connected_', callback);
				},
			}),
		};
	}
	return shared.store;
}

/** Mount only on Hataskey LTL surfaces; hidden deck tabs and KeepAlive pages suspend their subscription. */
export function useLtlEmojiVote(active: MaybeRefOrGetter<boolean>) {
	const activated = ref(true);
	const subscription = getSharedStore().subscribe(false);
	const stopWatch = watch(() => activated.value && toValue(active), value => subscription.setActive(value), { immediate: true });
	onActivated(() => { activated.value = true; });
	onDeactivated(() => { activated.value = false; });
	onScopeDispose(() => {
		stopWatch();
		subscription.release();
	});
	return subscription;
}
