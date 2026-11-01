/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { computed } from 'vue';
import { miLocalStorage } from '@/local-storage.js';
import { prefer } from '@/preferences.js';
import { setTabSwipeEnabled, tabSwipeEnabled } from '@/utility/hatasaba-device-prefs.js';

/** UI changes reload the app; Hataskey's switch belongs to this device. */
export const usesDeviceHorizontalSwipe = computed(() => {
	const ui = miLocalStorage.getItem('ui') ?? 'simple';
	return ui === 'simple' || ui === 'hataskey3';
});

/** Shared by page gestures and both settings entry points. */
export const horizontalSwipeEnabled = computed(() => usesDeviceHorizontalSwipe.value
	? tabSwipeEnabled.value
	: prefer.r.enableHorizontalSwipe.value);

export function useHorizontalSwipeModel() {
	const profileModel = prefer.model('enableHorizontalSwipe');
	return computed({
		get: () => horizontalSwipeEnabled.value,
		set: (value: boolean) => {
			if (usesDeviceHorizontalSwipe.value) setTabSwipeEnabled(value);
			else profileModel.value = value;
		},
	});
}
