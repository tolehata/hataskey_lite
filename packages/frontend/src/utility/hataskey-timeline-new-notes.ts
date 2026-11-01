/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, inject, onActivated, onDeactivated, onUnmounted, ref, shallowRef, toValue, watch, watchEffect } from 'vue';
import type { InjectionKey, MaybeRefOrGetter } from 'vue';
import type * as Misskey from 'cherrypick-js';

export type HataskeyTimelineNewNotesAvatar = {
	id: string;
	url?: string;
	user?: Misskey.entities.UserLite;
};

export type HataskeyTimelineNewNotes = {
	/** Omit for notices that keep their original text presentation. */
	count?: number;
	text: string;
	icon: string;
	show: () => void | Promise<void>;
	/** 新着ノートの投稿者。既存の文言だけを使う consumer は省略できる。 */
	avatars?: readonly HataskeyTimelineNewNotesAvatar[];
	/** バナー文言に含まれるカスタム絵文字の解決用。 */
	emojiUrls?: Record<string, string>;
	author?: Misskey.entities.UserLite | null;
};

export function createHataskeyTimelineNewNotes(activeKey: MaybeRefOrGetter<string | null>) {
	const current = shallowRef<{ owner: symbol; key: string; notice: HataskeyTimelineNewNotes } | null>(null);
	return {
		activeKey: computed(() => toValue(activeKey)),
		notice: computed(() => current.value?.key === toValue(activeKey) ? current.value.notice : null),
		update(owner: symbol, key: string | undefined, notice: HataskeyTimelineNewNotes | null) {
			if (key != null && key === toValue(activeKey) && notice != null) {
				current.value = { owner, key, notice };
			} else if (current.value?.owner === owner) {
				current.value = null;
			}
		},
	};
}

export const hataskeyTimelineNewNotesKey: InjectionKey<ReturnType<typeof createHataskeyTimelineNewNotes>> = Symbol('hataskey-timeline-new-notes');

/** 新着キューは元のタイムラインが保持し、表示中のタイムラインだけがナビバーを使う。 */
export function useHataskeyTimelineNewNotes(key: MaybeRefOrGetter<string | undefined>, notice: MaybeRefOrGetter<HataskeyTimelineNewNotes | null>) {
	const context = inject(hataskeyTimelineNewNotesKey, null);
	const active = ref(true);
	const owner = Symbol('timeline');
	const integrated = computed(() => context != null && active.value && toValue(key) != null && toValue(key) === context.activeKey.value);

	watchEffect(() => {
		context?.update(owner, toValue(key), integrated.value ? toValue(notice) : null);
	});
	onActivated(() => { active.value = true; });
	onDeactivated(() => { active.value = false; });
	onUnmounted(() => context?.update(owner, undefined, null));

	return integrated;
}

/** Keep the last content during the navbar's 350ms collapse, never its action. */
export function useRetainedHataskeyTimelineNewNotes(
	notice: MaybeRefOrGetter<HataskeyTimelineNewNotes | null>,
	motion: MaybeRefOrGetter<boolean>,
) {
	const retained = shallowRef<HataskeyTimelineNewNotes | null>(null);
	let timer: number | undefined;
	const clear = () => { window.clearTimeout(timer); timer = undefined; };
	watch([() => toValue(notice), () => toValue(motion)], ([current, animate]) => {
		clear();
		if (current) retained.value = current;
		else if (!animate) retained.value = null;
		else if (retained.value) timer = window.setTimeout(() => { retained.value = null; timer = undefined; }, 350);
	}, { immediate: true, flush: 'sync' });
	onUnmounted(clear);
	return retained;
}
