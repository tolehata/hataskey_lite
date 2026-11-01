/* SPDX-License-Identifier: AGPL-3.0-only */
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';

/** A mobile timeline can host the composer's existing picker without owning its draft. */
export type Hk3ComposerEmojiHost = {
	target: ShallowRef<HTMLElement | null>;
	enabled: ComputedRef<boolean>;
	open: Ref<boolean>;
};

export const hk3ComposerEmojiHostKey: InjectionKey<Hk3ComposerEmojiHost> = Symbol('hk3-composer-emoji-host');
