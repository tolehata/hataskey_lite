/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, ref, watch } from 'vue';
import type { Ref } from 'vue';

// HataGoes の開閉状態だけを一時保持する。保存済みの設定や自動拡大の状態は変更しない。
export function useHatagoesBarCollapse(
	active: Readonly<Ref<boolean>>,
	getNormalCollapsed: () => boolean,
	setNormalCollapsed?: (collapsed: boolean) => void,
) {
	const sessionCollapsed = ref(true);
	watch(active, entered => {
		if (entered) sessionCollapsed.value = true;
	}, { flush: 'sync' });

	return computed({
		get: () => active.value ? sessionCollapsed.value : getNormalCollapsed(),
		set: (collapsed: boolean) => {
			if (active.value) sessionCollapsed.value = collapsed;
			else setNormalCollapsed?.(collapsed);
		},
	});
}
