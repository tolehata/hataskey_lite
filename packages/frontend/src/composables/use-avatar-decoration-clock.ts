/* SPDX-License-Identifier: AGPL-3.0-only */
import { onScopeDispose, ref, watch } from 'vue';

/** Wake only at a decoration's next boundary; ordinary avatars allocate no timer. */
export function useAvatarDecorationClock(decorations: () => { availableFrom?: string | null; availableUntil?: string | null }[], onBoundary?: () => void) {
	const now = ref(Date.now());
	let timer: number | undefined;

	function schedule() {
		window.clearTimeout(timer);
		now.value = Date.now();
		const boundaries = decorations().flatMap(decoration => [decoration.availableFrom, decoration.availableUntil])
			.filter((date): date is string => date != null)
			.map(date => Date.parse(date)).filter(date => date > now.value);
		if (boundaries.length > 0) timer = window.setTimeout(() => { schedule(); onBoundary?.(); }, Math.min(Math.min(...boundaries) - now.value, 2_147_483_647));
	}

	watch(() => decorations().map(decoration => [decoration.availableFrom, decoration.availableUntil]), schedule, { immediate: true });
	onScopeDispose(() => window.clearTimeout(timer));
	return now;
}
