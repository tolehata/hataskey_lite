/* SPDX-License-Identifier: AGPL-3.0-only */

export type HataApp = 'hatagoes' | 'hatask' | 'hatady' | 'hatafeed' | 'hataigo';

export const hataAppNames: Record<HataApp, { head: string; tail: string }> = {
	hatagoes: { head: 'Hata', tail: 'Goes' },
	hatask: { head: 'Ha', tail: 'task' },
	hatady: { head: 'Ha', tail: 'tady' },
	hatafeed: { head: 'Hata', tail: 'Feed' },
	hataigo: { head: 'Hata', tail: 'Igo' },
};

const legacyMenuIcons: Record<HataApp, readonly string[]> = {
	hatagoes: ['ti ti-sparkles'],
	hatask: ['ti ti-eye', 'ti ti-layout-dashboard', 'ti ti-checklist'],
	hatady: ['ti ti-book-2'],
	hatafeed: ['ti ti-message-report'],
	hataigo: ['ti ti-circles'],
};

/** Match only the app menu IDs. A custom Studio icon remains the user's choice. */
export function hataAppForMenuIcon(id: string, savedIcon?: string): HataApp | null {
	if (!Object.hasOwn(legacyMenuIcons, id)) return null;
	const app = id as HataApp;
	return savedIcon == null || legacyMenuIcons[app].includes(savedIcon) ? app : null;
}

export function hataAppForSettingsBrand(brand?: string): HataApp | null {
	switch (brand) {
		case 'Hatask': return 'hatask';
		case 'Hatady': return 'hatady';
		case 'HataFeed': return 'hatafeed';
		case 'HataIgo': return 'hataigo';
		case 'HataGoes': return 'hatagoes';
		default: return null;
	}
}

export function hataAppForMenuLabel(id: string, label: string, savedIcon?: string): HataApp | null {
	const app = hataAppForMenuIcon(id, savedIcon);
	return app != null && label === hataAppNames[app].head + hataAppNames[app].tail ? app : null;
}
