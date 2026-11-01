/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onScopeDispose, readonly, ref } from 'vue';
import { ui } from '@@/js/config.js';

type NoteCharmDevice = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
	userAgentData?: unknown;
};

export function isNoteCharmSmartphone(device: NoteCharmDevice = navigator): boolean {
	const ua = device.userAgent;
	// iPad's mobile UA contains "Mobile", while its desktop mode says Macintosh.
	if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && device.maxTouchPoints > 1)) return false;
	if (/iPhone|iPod/i.test(ua)) return true;
	const clientHint = device.userAgentData;
	if (clientHint != null && typeof clientHint === 'object' && 'mobile' in clientHint && clientHint.mobile === true) return true;
	// Do not use viewport width or deviceKind: rotation and chosen layouts must
	// not enable phone hardware or disable a narrow desktop/tablet window.
	return /\bMobile\b/i.test(ua);
}

/** Match the shell's mobile layout as well as physical phone browsers. */
export function isNoteCharmMobileDisplay(): boolean {
	// main-boot maps "default" to universal and null/legacy/unknown values to
	// simple. The exported config value can still be null during its first boot.
	const narrowShell = ui === 'default' || ui === 'zen' ? window.innerWidth <= 500 : window.innerWidth < 1100;
	return isNoteCharmSmartphone() || narrowShell;
}

const mobileDisplay = ref(false);
let subscribers = 0;

function updateMobileDisplay(): void {
	mobileDisplay.value = isNoteCharmMobileDisplay();
}

/** All notes and settings share one listener; the last consumer removes it. */
export function useNoteCharmMobileDisplay() {
	updateMobileDisplay();
	if (subscribers++ === 0) window.addEventListener('resize', updateMobileDisplay, { passive: true });
	onScopeDispose(() => {
		if (--subscribers === 0) window.removeEventListener('resize', updateMobileDisplay);
	});
	return readonly(mobileDisplay);
}
