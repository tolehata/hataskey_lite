/* SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

const claims = new Set<symbol>();
const claimCount = ref(0);
export const hataMascotSuppressed = computed(() => claimCount.value > 0);

/** Each live Hata app or shell claims suppression only while it is visible. */
export function useHataMascotSuppression(active: MaybeRefOrGetter<boolean>): void {
	const token = Symbol('hata-mascot-suppression');
	let mountedActive = true;

	function sync() {
		if (mountedActive && toValue(active)) claims.add(token);
		else claims.delete(token);
		claimCount.value = claims.size;
	}

	watch(() => toValue(active), sync, { immediate: true });
	onActivated(() => { mountedActive = true; sync(); });
	onDeactivated(() => { mountedActive = false; sync(); });
	onBeforeUnmount(() => { mountedActive = false; sync(); });
}
