/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, inject } from 'vue';
import { ui } from '@@/js/config.js';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { useNoteCharmMobileDisplay } from '@/utility/note-charm-device.js';

/** Actual rendered deck state, not the saved desktop preference. */
export const noteCharmDeckActiveKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('noteCharmDeckActive');

export function useNoteCharmAvailability(): ComputedRef<boolean> {
	const deckActive = inject(noteCharmDeckActiveKey, null);
	const mobileDisplay = useNoteCharmMobileDisplay();
	return computed(() => !mobileDisplay.value && ui !== 'deck' && ui !== 'hataskey3' && !deckActive?.value);
}
