/* SPDX-License-Identifier: AGPL-3.0-only */
import { canonicalHatagoesScreenId, HATAGOES_CATALOG, isHatagoesVisibleScreen } from './hatagoes-catalog.js';
import type { HatagoesCatalogEntry } from './hatagoes-catalog.js';

export const HATAGOES_HATASK_PIN_LIMIT = 5;
export const HATAGOES_HATASK_DESKTOP_PIN_LIMIT = 6;
export const DEFAULT_HATAGOES_HATASK_PINS = [
	'hatask.today', 'hatask.cal', 'hatask.todo', 'hatask.mood', 'hatask.meal',
] as const;

export function isHatagoesHataskPinCandidate(screen: HatagoesCatalogEntry): boolean {
	return screen.app === 'hatask' && !screen.action && screen.access !== 'admin' && screen.access !== 'moderator' && isHatagoesVisibleScreen(screen);
}

export const HATAGOES_HATASK_PIN_CANDIDATES = HATAGOES_CATALOG.filter(isHatagoesHataskPinCandidate).map(screen => screen.id);
const candidates = new Set<string>(HATAGOES_HATASK_PIN_CANDIDATES);

/** The Today tab is permanent; the remaining four slots retain the user's order. */
export function normalizeHatagoesHataskPins(value: unknown): string[] {
	if (!Array.isArray(value)) return [...DEFAULT_HATAGOES_HATASK_PINS];
	const result = ['hatask.today'];
	for (const rawId of value) {
		if (typeof rawId !== 'string') continue;
		const id = canonicalHatagoesScreenId(rawId);
		if (!candidates.has(id) || result.includes(id)) continue;
		result.push(id);
		if (result.length === HATAGOES_HATASK_PIN_LIMIT) break;
	}
	return result;
}

/** An unset desktop key reads the mobile selection without writing or truncating it. */
export function normalizeHatagoesHataskPinsDesktop(value: unknown, mobilePins?: unknown): string[] {
	if (!Array.isArray(value)) return normalizeHatagoesHataskPins(mobilePins);
	const result = ['hatask.today'];
	for (const rawId of value) {
		if (typeof rawId !== 'string') continue;
		const id = canonicalHatagoesScreenId(rawId);
		if (!candidates.has(id) || result.includes(id)) continue;
		result.push(id);
		if (result.length === HATAGOES_HATASK_DESKTOP_PIN_LIMIT) break;
	}
	return result;
}
