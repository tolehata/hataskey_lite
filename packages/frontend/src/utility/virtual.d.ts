/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type XGeneratedSearchIndexItem = {
	id: string;
	parentId?: string;
	path?: string;
	label: string;
	keywords: string[];
	texts: string[];
	icon?: string;
	inlining?: string[];
};

type XHataCustomCategoryV2 =
	| 'general'
	| 'font'
	| 'glassUi'
	| 'visual'
	| 'hatask'
	| 'hatady'
	| 'mascot'
	| 'earthquake'
	| 'accessibility';

type XSettingsPopupIdV2 =
	| 'hatasaba-ui2'
	| 'earthquake'
	| 'ui-setup'
	| 'settings-transfer'
	| 'hatask'
	| 'hatady'
	| 'mascot';

type XSettingsActivationStepV2 =
	| { kind: 'category'; id: XHataCustomCategoryV2 }
	| { kind: 'popup'; id: XSettingsPopupIdV2 }
	| { kind: 'reveal'; id: string };

type XSettingsControlActivationV2 =
	| {
		kind: 'hata-custom-category';
		category: XHataCustomCategoryV2;
		steps?: XSettingsActivationStepV2[];
		focus?: { kind: 'control' | 'group'; id: string };
		unmet?: Array<{ kind: 'policy' | 'consent' | 'preference' | 'runtime-data'; id: string; behavior: 'focus' | 'explain' }>;
	}
	| {
		kind: 'popup';
		category: XHataCustomCategoryV2;
		popup: XSettingsPopupIdV2;
		steps?: XSettingsActivationStepV2[];
		focus?: { kind: 'control' | 'group'; id: string };
		unmet?: Array<{ kind: 'policy' | 'consent' | 'preference' | 'runtime-data'; id: string; behavior: 'focus' | 'explain' }>;
	};

declare module 'search-index' {
	export type GeneratedSearchIndexItem = XGeneratedSearchIndexItem;
}

declare module 'search-index:settings' {
	export const searchIndexes: XGeneratedSearchIndexItem[];
}

type XSettingsControlSearchDescriptorV2 = {
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
	/** Safe i18n aliases aggregated from an unreachable runtime child. */
	aliasI18nKeys?: string[];
	primaryAliases?: string[];
	inheritedLabel?: boolean;
	modelExpression?: string;
	preferenceKeys: string[];
	legacyMarkerParentId?: string;
	legacyMarkerAncestorIds: string[];
	semanticGroupId?: string;
	sourceSemanticGroupId?: string;
	isGroup?: boolean;
	conditions: string[];
	activation?: XSettingsControlActivationV2;
	/** A statically-mounted control/group host used when this descriptor is conditional. */
	focusId?: string;
	/** Prerequisites which search explains but never mutates. */
	unmet?: Array<{ kind: 'policy' | 'consent' | 'preference' | 'runtime-data'; id: string; behavior: 'focus' | 'explain' }>;
	persistence: 'device' | 'profile' | 'account';
	saveMode: 'immediate' | 'buffered' | 'reload';
	availability: 'all' | 'desktop' | 'mobile';
	owner: 'core' | 'cherrypick' | 'hatasaba';
	applicableUi: 'all' | 'default' | 'deck' | 'simple' | 'simple-deck' | ReadonlyArray<'all' | 'default' | 'deck' | 'simple' | 'simple-deck'>;
	storageRefs?: Array<
		| { kind: 'pref'; key: string }
		| { kind: 'pizzax'; store: 'base' | 'deck'; key: string; scope: 'device' | 'account' | 'deviceAccount' }
		| { kind: 'local'; key: string; family?: boolean }
		| { kind: 'registry'; scope: readonly string[]; key: string }
		| { kind: 'api'; endpoint: string; fields?: readonly string[] }
	>;
	metadataEvidence: { persistence: string; saveMode: string; availability: string; owner: string; applicableUi: string };
	relatedHostId: string;
	searchable: boolean;
	intentionallyExcluded?: boolean;
	exclusionReason?: string;
	destructive: boolean;
};

declare module 'search-index-v2:settings' {
	export const settingsControlSearchIndexV2: XSettingsControlSearchDescriptorV2[];
}

declare module 'search-index:admin' {
	export const searchIndexes: XGeneratedSearchIndexItem[];
}
