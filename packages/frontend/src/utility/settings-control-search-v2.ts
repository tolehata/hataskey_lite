/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** The generated V2 source inventory deliberately contains no executable page expressions. */
export type HataCustomCategoryV2 =
	| 'general'
	| 'font'
	| 'glassUi'
	| 'visual'
	| 'hatask'
	| 'hatady'
	| 'mascot'
	| 'earthquake'
	| 'accessibility';

export type SettingsPopupIdV2 =
	| 'hatasaba-ui2'
	| 'earthquake'
	| 'ui-setup'
	| 'settings-transfer'
	| 'hatask'
	| 'hatady'
	| 'mascot';

export type SettingsPersistenceV2 = 'device' | 'profile' | 'account';
export type SettingsSaveModeV2 = 'immediate' | 'buffered' | 'reload';
export type SettingsAvailabilityV2 = 'all' | 'desktop' | 'mobile';
export type SettingsOwnerV2 = 'core' | 'cherrypick' | 'hatasaba';
export type SettingsApplicableUiValueV2 = 'all' | 'default' | 'deck' | 'simple' | 'simple-deck';
export type SettingsApplicableUiV2 = SettingsApplicableUiValueV2 | readonly SettingsApplicableUiValueV2[];

export type SettingsStorageRefV2 =
	| { kind: 'pref'; key: string }
	| { kind: 'pizzax'; store: 'base' | 'deck'; key: string; scope: 'device' | 'account' | 'deviceAccount' }
	| { kind: 'local'; key: string; family?: boolean }
	| { kind: 'indexeddb'; database: string; store: string; key: string; fields: readonly string[] }
	| { kind: 'registry'; scope: readonly string[]; key: string }
	| { kind: 'api'; endpoint: string; fields?: readonly string[] };

export type SettingsMetadataEvidenceV2 = {
	persistence: string;
	saveMode: string;
	availability: string;
	owner: string;
	applicableUi: string;
};

export type SettingsActivationStepV2 =
	| { kind: 'category'; id: HataCustomCategoryV2 }
	| { kind: 'popup'; id: SettingsPopupIdV2 }
	| { kind: 'reveal'; id: string };
export type SettingsActivationFocusV2 = { kind: 'control' | 'group'; id: string };
export type SettingsActivationUnmetV2 = { kind: 'policy' | 'consent' | 'preference' | 'runtime-data'; id: string; behavior: 'focus' | 'explain' };

export type SettingsControlActivationV2 =
	| { kind: 'hata-custom-category'; category: HataCustomCategoryV2; steps?: SettingsActivationStepV2[]; focus?: SettingsActivationFocusV2; unmet?: SettingsActivationUnmetV2[] }
	| { kind: 'popup'; category: HataCustomCategoryV2; popup: SettingsPopupIdV2; steps?: SettingsActivationStepV2[]; focus?: SettingsActivationFocusV2; unmet?: SettingsActivationUnmetV2[] };

export type SettingsControlSearchDescriptorV2 = {
	stableId: string;
	route: string;
	sourceFile: string;
	sourceLine: number;
	component: string;
	label: string;
	labelExpression?: string;
	labelI18nKeys?: string[];
	caption?: string;
	captionExpression?: string;
	captionI18nKeys?: string[];
	aliases?: string[];
	/** Safe i18n labels inherited from a runtime child and resolved for the active locale. */
	aliasI18nKeys?: string[];
	/**
	 * A deliberately-audited legacy or product term whose exact query must
	 * prefer this destination over a coincidental label match elsewhere.
	 * These are intentionally rare; generic aliases remain ordinary aliases.
	 */
	primaryAliases?: string[];
	inheritedLabel?: boolean;
	modelExpression?: string;
	preferenceKeys: string[];
	legacyMarkerParentId?: string;
	legacyMarkerAncestorIds: string[];
	conditions: string[];
	semanticGroupId?: string;
	sourceSemanticGroupId?: string;
	isGroup?: boolean;
	activation?: SettingsControlActivationV2;
	/**
	 * A static parent host to focus when this individual control is behind a
	 * runtime-only condition. The item stays individually searchable; selecting
	 * it never changes the prerequisite merely to make its own DOM mount.
	 */
	focusId?: string;
	/** Source evidence for a non-catalog static parent focus host. */
	focusHostSourceFile?: string;
	focusHostSourceLine?: number;
	focusHostConditions?: string[];
	/** A structured prerequisite explanation for a static parent focus. */
	unmet?: SettingsActivationUnmetV2[];
	persistence: SettingsPersistenceV2;
	saveMode: SettingsSaveModeV2;
	availability: SettingsAvailabilityV2;
	owner: SettingsOwnerV2;
	applicableUi: SettingsApplicableUiV2;
	storageRefs?: SettingsStorageRefV2[];
	/** Every searchable/generated descriptor carries source-specific evidence. */
	metadataEvidence: SettingsMetadataEvidenceV2;
	/** The visible redesigned destination that currently contains this control. */
	destinationId?: string;
	/** Explicit alternate destination used only when no stronger related setting is available. */
	relationDestinationId?: string;
	relatedHostId: string;
	searchable: boolean;
	intentionallyExcluded?: boolean;
	exclusionReason?: string;
	destructive: boolean;
};

export type SettingsControlCatalogItemV2 = {
	stableId: string;
	route: string;
	/* Explicit redesigned IA category, when a route is intentionally shared. */
	categoryId?: string;
	label: string;
	description?: string;
	aliases: string[];
	primaryAliases?: string[];
	preferenceKeys: string[];
	legacyMarkerParentId?: string;
	legacyMarkerAncestorIds: string[];
	semanticGroupId?: string;
	sourceSemanticGroupId?: string;
	isGroup?: boolean;
	activation?: SettingsControlActivationV2;
	focusId?: string;
	unmet?: SettingsActivationUnmetV2[];
	persistence: SettingsPersistenceV2;
	saveMode: SettingsSaveModeV2;
	availability: SettingsAvailabilityV2;
	owner: SettingsOwnerV2;
	applicableUi: SettingsApplicableUiV2;
	storageRefs?: SettingsStorageRefV2[];
	metadataEvidence: SettingsMetadataEvidenceV2;
	/** The visible redesigned destination that currently contains this control. */
	destinationId?: string;
	/** Explicit alternate destination used only when no stronger related setting is available. */
	relationDestinationId?: string;
	relatedHostId: string;
	sourceFile: string;
	sourceLine: number;
	destructive: boolean;
};

const I18N_PROPERTY_EXPRESSION = /^i18n\.ts(?:(?:\.[A-Za-z_$][A-Za-z0-9_$]*)|(?:\[['"][^'"\[\]]+['"]\]))*$/u;

function propertySegments(expression: string): string[] | null {
	if (!I18N_PROPERTY_EXPRESSION.test(expression)) return null;
	const segments: string[] = [];
	const tail = expression.slice('i18n.ts'.length);
	const matcher = /\.([A-Za-z_$][A-Za-z0-9_$]*)|\[['"]([^'"\[\]]+)['"]\]/gu;
	for (const match of tail.matchAll(matcher)) segments.push(match[1] ?? match[2]);
	return segments;
}

function lookupI18nProperty(translations: Record<string, unknown>, expression: string): string | null {
	const segments = propertySegments(expression);
	if (segments == null) return null;
	let value: unknown = translations;
	for (const segment of segments) {
		if (value == null || typeof value !== 'object') return null;
		value = (value as Record<string, unknown>)[segment];
	}
	return typeof value === 'string' ? value : null;
}

/**
 * Resolve only the property-only i18n expressions recorded by the generator.
 * This is intentionally not `Function`/`eval`: page-local state and i18n
 * functions with local arguments can never execute through search metadata.
 */
function resolveSafeSettingsControlTextV2(
	descriptor: { literal: string; expression?: string; i18nKeys?: string[] },
	translations: Record<string, unknown>,
): string | null {
	if (descriptor.expression == null) return descriptor.literal.trim() || null;
	const allowed = new Set(descriptor.i18nKeys ?? []);
	let unresolved = false;
	const resolved = descriptor.expression.replace(/\$\{([^}]+)\}/gu, (_whole, rawExpression: string) => {
		const expression = rawExpression.trim();
		if (!allowed.has(expression)) {
			unresolved = true;
			return '';
		}
		const value = lookupI18nProperty(translations, expression);
		if (value == null) {
			unresolved = true;
			return '';
		}
		return value;
	});
	return unresolved ? null : resolved.replace(/\s+/gu, ' ').trim() || null;
}

export function resolveSettingsControlSearchLabelV2(
	descriptor: Pick<SettingsControlSearchDescriptorV2, 'label' | 'labelExpression' | 'labelI18nKeys'>,
	translations: Record<string, unknown>,
): string | null {
	return resolveSafeSettingsControlTextV2({
		literal: descriptor.label,
		expression: descriptor.labelExpression,
		i18nKeys: descriptor.labelI18nKeys,
	}, translations);
}

/** Returns a user-facing caption only when every embedded expression is pre-approved. */
export function resolveSettingsControlSearchDescriptionV2(
	descriptor: Pick<SettingsControlSearchDescriptorV2, 'caption' | 'captionExpression' | 'captionI18nKeys'>,
	translations: Record<string, unknown>,
): string | null {
	return resolveSafeSettingsControlTextV2({
		literal: descriptor.caption ?? '',
		expression: descriptor.captionExpression,
		i18nKeys: descriptor.captionI18nKeys,
	}, translations);
}

function resolveSettingsControlSearchAliasesV2(
	descriptor: Pick<SettingsControlSearchDescriptorV2, 'aliasI18nKeys' | 'stableId' | 'sourceFile' | 'sourceLine'>,
	translations: Record<string, unknown>,
): string[] {
	const resolved: string[] = [];
	for (const expression of descriptor.aliasI18nKeys ?? []) {
		const value = lookupI18nProperty(translations, expression);
		if (value == null) {
			throw new Error(`settings V2 unresolved searchable alias: ${descriptor.stableId} (${descriptor.sourceFile}:${descriptor.sourceLine}; ${expression})`);
		}
		resolved.push(value);
	}
	return resolved;
}

/**
 * Adapter for merging the source-level index into the existing legacy catalog.
 * Consumers pass `i18n.ts`; intentionally excluded controls remain available
 * in the source inventory, while a searchable descriptor must resolve to an
 * actual display label. Silently dropping one would turn a locale typo into
 * an invisible catalog-coverage regression.
 */
export function toSettingsControlCatalogItemsV2(
	descriptors: SettingsControlSearchDescriptorV2[],
	translations: Record<string, unknown>,
): SettingsControlCatalogItemV2[] {
	return descriptors.flatMap(descriptor => {
		if (!descriptor.searchable) return [];
		const label = resolveSettingsControlSearchLabelV2(descriptor, translations);
		if (label == null) {
			throw new Error(`settings V2 unresolved searchable label: ${descriptor.stableId} (${descriptor.sourceFile}:${descriptor.sourceLine})`);
		}
		const description = resolveSettingsControlSearchDescriptionV2(descriptor, translations);
		const localizedAliases = resolveSettingsControlSearchAliasesV2(descriptor, translations);
		return [{
			stableId: descriptor.stableId,
			route: descriptor.route,
			label,
			...(description ? { description } : {}),
			aliases: [...new Set([
				...(descriptor.aliases ?? []),
				...localizedAliases,
				...(descriptor.labelI18nKeys ?? []),
				...(descriptor.captionI18nKeys ?? []),
				...descriptor.preferenceKeys,
				...(descriptor.modelExpression ? [descriptor.modelExpression] : []),
			])],
			...(descriptor.primaryAliases?.length ? { primaryAliases: [...new Set(descriptor.primaryAliases)] } : {}),
			preferenceKeys: descriptor.preferenceKeys,
			...(descriptor.legacyMarkerParentId ? { legacyMarkerParentId: descriptor.legacyMarkerParentId } : {}),
			legacyMarkerAncestorIds: descriptor.legacyMarkerAncestorIds,
			...(descriptor.semanticGroupId ? { semanticGroupId: descriptor.semanticGroupId } : {}),
			...(descriptor.sourceSemanticGroupId ? { sourceSemanticGroupId: descriptor.sourceSemanticGroupId } : {}),
			...(descriptor.isGroup ? { isGroup: true } : {}),
			...(descriptor.activation ? { activation: descriptor.activation } : {}),
			...(descriptor.focusId ? { focusId: descriptor.focusId } : {}),
			...(descriptor.unmet?.length ? { unmet: descriptor.unmet } : {}),
			persistence: descriptor.persistence,
			saveMode: descriptor.saveMode,
			availability: descriptor.availability,
			owner: descriptor.owner,
			applicableUi: descriptor.applicableUi,
			...(descriptor.storageRefs?.length ? { storageRefs: descriptor.storageRefs } : {}),
			metadataEvidence: descriptor.metadataEvidence,
			...(descriptor.destinationId ? { destinationId: descriptor.destinationId } : {}),
			...(descriptor.relationDestinationId ? { relationDestinationId: descriptor.relationDestinationId } : {}),
			relatedHostId: descriptor.relatedHostId,
			sourceFile: descriptor.sourceFile,
			sourceLine: descriptor.sourceLine,
			destructive: descriptor.destructive,
		}];
	});
}
