/* SPDX-License-Identifier: AGPL-3.0-only */

export function isIOSDevice(device: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): boolean {
	// iPad's desktop browsing mode uses a Macintosh UA. Do not use deviceKind:
	// it describes the chosen layout, which can also be overridden by the user.
	return /iPhone|iPad|iPod/i.test(device.userAgent)
		|| (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1);
}

export function initViewportInset(): void {
	// Safari's OS UA version is frozen; gate by device, not an OS version number.
	// No persisted preference: each device calculates its own layout on boot.
	window.document.documentElement.toggleAttribute('data-ios-top-inset', isIOSDevice(navigator));
}

export function getViewportTopInset(element: Element = window.document.documentElement): number {
	// A containing UI shell can override this when it already reserves the gap.
	const inset = Number.parseFloat(getComputedStyle(element).getPropertyValue('--MI-fixed-top-inset'));
	return Number.isFinite(inset) ? Math.max(0, inset) : 0;
}
