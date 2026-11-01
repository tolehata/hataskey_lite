/* SPDX-License-Identifier: AGPL-3.0-only */
import { canonicalHatagoesScreenId, HATAGOES_CATALOG, isHatagoesVisibleScreen } from './hatagoes-catalog.js';
import type { HatagoesCatalogEntry, HatagoesCatalogGroup, HatagoesScreenId } from './hatagoes-catalog.js';

export type HatagoesAppPinGroup = Exclude<HatagoesCatalogGroup, 'hatady' | 'hatafeed'>;
export const HATAGOES_APP_PIN_LIMIT = 8;

// K22 pins apps, not the four basic Hatask tabs or the app-directory screens.
// Explicit IDs prevent future administrative routes from appearing by accident.
const HATASK_APP_IDS = [
	'hatask.recipe', 'hatask.garden', 'hatask.support', 'hatask.ranking', 'hatask.appearance',
] as const satisfies readonly HatagoesScreenId[];
const HATASKEY_APP_IDS = [
	'hatask.card-maker', 'hatask.emotion-analysis', 'hatask.drawing-tool',
	'hatask.side-studio', 'hatask.earthquake', 'hatask.mascot', 'hatask.games',
	'hatask.bubble-game', 'hatask.reversi',
	'hatask.clicker', 'hatask.hataigo', 'hatask.qr', 'hatask.scratchpad', 'hatask.api-console',
	'hatask.intro', 'hatask.hata-docs', 'hatask.pages', 'hatask.play', 'hatask.gallery', 'hatask.whats-new',
] as const satisfies readonly HatagoesScreenId[];

export type HatagoesAppPinId = (typeof HATASK_APP_IDS | typeof HATASKEY_APP_IDS)[number];
const candidateGroups: ReadonlyMap<string, HatagoesAppPinGroup> = new Map([
	...HATASK_APP_IDS.map(id => [id, 'hatask'] as const),
	...HATASKEY_APP_IDS.map(id => [id, 'hataskey'] as const),
]);

export type HatagoesAppPinCandidate = HatagoesCatalogEntry & { group: HatagoesAppPinGroup };

/** Caller passes its access-filtered catalog; inaccessible apps stay in saved account data. */
export function getHatagoesAppPinCandidates(screens: readonly HatagoesCatalogEntry[] = HATAGOES_CATALOG): HatagoesAppPinCandidate[] {
	return screens.filter(isHatagoesVisibleScreen).flatMap(screen => {
		const group = candidateGroups.get(screen.id);
		return group ? [{ ...screen, group }] : [];
	});
}

/** Empty is intentional. Unknown and duplicate IDs never consume a slot. */
export function normalizeHatagoesAppPins(value: unknown): HatagoesAppPinId[] {
	if (!Array.isArray(value)) return [];
	const result: HatagoesAppPinId[] = [];
	const seen = new Set<string>();
	for (const rawId of value) {
		if (typeof rawId !== 'string') continue;
		const id = canonicalHatagoesScreenId(rawId);
		if (!candidateGroups.has(id) || seen.has(id)) continue;
		seen.add(id);
		result.push(id as HatagoesAppPinId);
		if (result.length === HATAGOES_APP_PIN_LIMIT) break;
	}
	return result;
}
