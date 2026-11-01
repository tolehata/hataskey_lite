/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, shallowRef, watch } from 'vue';
import { checkMuted } from '@/utility/emoji-mute.js';
import { filterHiddenReactions, hiddenReactionsVersion } from '@/utility/hidden-reactions.js';
import { hideMutedReactionsLocal } from '@/utility/hatasaba-device-prefs.js';
import { fetchMutedUsers, mutedUsersRevision } from '@/utility/muted-users.js';
import { getMutedReactions, mutedReactionsRevision, requestMutedReactions } from '@/utility/muted-reactions.js';

/** 標準UIと同じ共有キャッシュで、ミュート分を除いた件数をUI Sへ渡す。 */
export function useHk3Reactions(
	noteId: string,
	source: () => Record<string, number>,
	myReaction: () => string | null | undefined,
) {
	const stableCounts = shallowRef<Record<string, number>>({});
	let wasHiding = hideMutedReactionsLocal.value;
	watch([source, myReaction, hideMutedReactionsLocal, mutedUsersRevision, mutedReactionsRevision], () => {
		const counts = source();
		const hiding = hideMutedReactionsLocal.value;
		const justEnabled = hiding && !wasHiding;
		wasHiding = hiding;
		if (!hiding) {
			stableCounts.value = { ...counts };
			return;
		}

		void fetchMutedUsers();
		const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
		requestMutedReactions(noteId, total);
		const entry = getMutedReactions(noteId, total);
		if (entry == null) {
			// 取得中は直前のフィルタ済み表示を維持。OFF→ON時の未処理の件数は残さない。
			if (justEnabled) stableCounts.value = {};
			return;
		}
		stableCounts.value = Object.fromEntries(Object.entries(counts).map(([reaction, count]) => [
			reaction,
			// 自分と同じ絵文字のミュート分も引き、自分の1件だけを下限として残す。
			Math.max(reaction === myReaction() && count > 0 ? 1 : 0, count - (entry.delta[reaction] ?? 0)),
		]));
	}, { immediate: true, deep: true });

	return computed(() => {
		hiddenReactionsVersion.value;
		const counts = filterHiddenReactions(noteId, stableCounts.value);
		return Object.fromEntries(Object.entries(counts).filter(([reaction, count]) => count > 0 && !checkMuted(reaction).value));
	});
}
