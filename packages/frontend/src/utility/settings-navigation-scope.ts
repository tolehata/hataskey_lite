/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SettingsCatalogDescriptorV2 } from './settings-search-v2.js';
import type { SettingsSearchNavigationTargetV2 } from './settings-search-v2-context.js';

/** The subset of a shell navigation item that can safely scope catalog data. */
export type SettingsNavigationScopeV2 = SettingsSearchNavigationTargetV2 & {
	categoryId?: string;
};

function activationCategory(target: Pick<SettingsCatalogDescriptorV2, 'activation'>): string | null {
	return target.activation?.category ?? null;
}

/**
 * A settings route is not itself a meaningful count scope: both preferences
 * and hata-custom carry unrelated controls. Count only an exact control, or a
 * category/activation combination that the catalog can prove.
 */
export function descriptorMatchesSettingsNavigationScopeV2(
	descriptor: SettingsCatalogDescriptorV2,
	target: SettingsNavigationScopeV2,
): boolean {
	if (descriptor.source !== 'control' || !descriptor.searchable || descriptor.route !== target.route) return false;
	if (target.controlId != null) return descriptor.controlId === target.controlId || descriptor.stableId === target.controlId;
	if (target.categoryId == null && target.activation == null) return false;
	if (target.categoryId != null && descriptor.categoryId !== target.categoryId) return false;
	if (target.activation == null) return true;
	return activationCategory(descriptor) === target.activation.category
		&& (target.activation.kind !== 'popup'
			|| descriptor.activation?.kind !== 'popup'
			|| descriptor.activation.popup === target.activation.popup);
}

export function countSettingsNavigationScopeV2(
	descriptors: readonly SettingsCatalogDescriptorV2[],
	target: SettingsNavigationScopeV2,
): number {
	return descriptors.filter(descriptor => descriptorMatchesSettingsNavigationScopeV2(descriptor, target)).length;
}

/**
 * Select sources for a route-tail related block without treating every item on
 * the same route as one topic. A focused control wins; otherwise only an
 * active hata-custom category can retain a route-level relationship scope.
 */
export function relatedSourcesForSettingsNavigationV2({
	descriptors,
	byStableId,
	currentRoute,
	activeTarget,
	activeHataCustomCategory,
	fallback,
}: {
	descriptors: readonly SettingsCatalogDescriptorV2[];
	byStableId: ReadonlyMap<string, SettingsCatalogDescriptorV2>;
	currentRoute: string;
	activeTarget: SettingsSearchNavigationTargetV2 | null;
	activeHataCustomCategory: string | null;
	fallback: SettingsCatalogDescriptorV2 | null;
}): SettingsCatalogDescriptorV2[] {
	if (fallback != null) return [fallback];
	const exactId = activeTarget?.controlId ?? activeTarget?.stableId;
	if (exactId != null) {
		const exact = byStableId.get(exactId)
			?? descriptors.find(descriptor => descriptor.controlId === exactId);
		if (exact != null && exact.searchable && exact.route === currentRoute) return [exact];
	}

	if (currentRoute !== '/settings/hata-custom' || activeHataCustomCategory == null) return [];
	return descriptors.filter(descriptor => (
		descriptor.searchable
		&& descriptor.route === currentRoute
		&& (
			activationCategory(descriptor) === activeHataCustomCategory
			|| (activeHataCustomCategory === 'glassUi' && descriptor.categoryId === 'hataskey-ui')
		)
	));
}
