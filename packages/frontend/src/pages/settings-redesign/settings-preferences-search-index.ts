/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Runtime search inventory for the redesigned preferences surface.  The Vite
 * source generator intentionally continues to read the legacy page for its
 * compatibility index; this adapter replaces only that page's controls with
 * the explicit new-surface inventory before the catalog is built.
 */

import {
	generatedPreferenceSearchId,
	destinationForPreferenceKey,
	preferenceAuxiliaryControls,
	preferenceControls,
	settingsInventoryKeys,
	uiSDisplaySizeSearchId,
	
} from './settings-preferences-catalog.js';
import { destinationForId, settingsDestinationSections, settingsDestinations } from './settings-destinations.js';
import type { SettingsInventoryKey } from './settings-preferences-catalog.js';
import type { SettingsControlCatalogItemV2 } from '@/utility/settings-control-search-v2.js';
import type { SettingsCatalogV2, SettingsDestinationCatalogItemV2 } from '@/utility/settings-search-v2.js';
import { assertSettingsCatalogRelationsV2 } from '@/utility/settings-search-v2.js';
import { i18n } from '@/i18n.js';

const LEGACY_PREFERENCES_SOURCE = 'src/pages/settings/preferences.vue';
const REDESIGNED_PREFERENCES_SOURCE = 'src/pages/settings-redesign/settings-preferences-catalog.ts';
const PREFERENCES_ROUTE = '/settings/preferences';
const settingsInventoryKeySet = new Set<string>(settingsInventoryKeys);
const uiSBottomNavSearchId = generatedPreferenceSearchId('simpleUi.bottomNav');

function uiSDisplaySizeSearchItem(): SettingsControlCatalogItemV2 {
	const copy = i18n.ts._hata._hataskeyUi3._displaySize;
	return {
		stableId: uiSDisplaySizeSearchId,
		route: PREFERENCES_ROUTE,
		label: copy.title,
		description: copy.caption,
		aliases: ['サイズ', '表示密度', 'コンパクト', '画面', 'UI S', 'display size', 'density', 'compact', 'screen', '显示大小', '显示密度', '紧凑'],
		preferenceKeys: [],
		storageRefs: [{ kind: 'local', key: 'hataskeyUiSDisplaySize' }],
		legacyMarkerAncestorIds: [],
		semanticGroupId: 'settings.semantic.preference.hataskey-ui-s',
		sourceSemanticGroupId: 'settings.semantic.preference.hataskey-ui-s',
		categoryId: 'hataskey-ui',
		persistence: 'device',
		saveMode: 'immediate',
		availability: 'all',
		owner: 'hatasaba',
		applicableUi: 'all',
		metadataEvidence: {
			persistence: 'hatasaba-device-prefs saves hataskeyUiSDisplaySize in miLocalStorage',
			saveMode: 'SettingsPreferencesSurface calls setHataskeyUiSDisplaySize on every selection',
			availability: 'the UI S settings section is mounted on desktop and mobile',
			owner: 'UI S display size control',
			applicableUi: 'the setting can be edited from every UI; its effect applies only to UI S',
		},
		destinationId: 'hataskey-ui-s',
		relationDestinationId: 'hataskey-ui',
		relatedHostId: uiSDisplaySizeSearchId,
		sourceFile: 'src/pages/settings-redesign/SettingsPreferencesSurface.vue',
		sourceLine: 1,
		destructive: false,
	};
}

function uiSBottomNavSearchItem(): SettingsControlCatalogItemV2 {
	const copy = i18n.ts._hata._hataskeyUi3._bottomNav;
	return {
		stableId: uiSBottomNavSearchId,
		route: PREFERENCES_ROUTE,
		label: copy.title,
		description: copy.caption,
		aliases: ['下部ナビバー', '並び替え', 'モバイル', 'ウィジェット', 'HataGoes', 'Hatask', 'Hatady', 'bottom navigation', 'reorder', 'mobile', 'widgets', '底部导航栏', '调整顺序', '移动端', '小组件', 'simpleUi.bottomNav', 'hataskeyUi3BottomNav', 'Hataskey UI S'],
		preferenceKeys: ['hataskeyUi3BottomNav'],
		legacyMarkerAncestorIds: [],
		semanticGroupId: 'settings.group.hataskey-ui-s.bottom-nav',
		sourceSemanticGroupId: 'settings.group.hataskey-ui-s.bottom-nav',
		categoryId: 'hataskey-ui',
		persistence: 'profile',
		saveMode: 'immediate',
		availability: 'all',
		owner: 'hatasaba',
		applicableUi: 'all',
		metadataEvidence: {
			persistence: 'UI S saves hataskeyUi3BottomNav; simpleUi.bottomNav is read only for legacy fallback',
			saveMode: 'HataskeyUiSBottomNavSettings commits every edit immediately',
			availability: 'the settings section is mounted on desktop and mobile',
			owner: 'UI S bottom navigation settings surface',
			applicableUi: 'the settings section can be edited from every UI',
		},
		destinationId: 'hataskey-ui-s',
		relationDestinationId: 'hataskey-ui',
		relatedHostId: uiSBottomNavSearchId,
		sourceFile: 'src/pages/settings-redesign/HataskeyUiSBottomNavSettings.vue',
		sourceLine: 1,
		destructive: false,
	};
}

// These page sources share the redesigned destination shown for their
// existing route. This mapping records current placement, not a relation
// fallback.
const CURRENT_DESTINATION_BY_SOURCE_FILE: Readonly<Record<string, string>> = {
	'src/pages/settings/accounts.vue': 'account-switch',
	'src/pages/settings/avatar-decoration.vue': 'account-avatar',
	'src/pages/settings/cherrypick.vue': 'cherrypick-settings',
	'src/pages/settings/connect.vue': 'account-connect',
	'src/pages/settings/privacy.vue': 'account-privacy',
	'src/pages/settings/profile.vue': 'account-profile',
	'src/pages/settings/drive.vue': 'account-drive',
	'src/pages/settings/deck.vue': 'misskey-deck',
	'src/pages/settings/hata-custom.vue': 'hataskey-ui',
	'src/pages/settings/hidden-reactions-manage.vue': 'timeline-hidden-reactions',
	'src/pages/settings/notifications.vue': 'notifications-page',
	'src/pages/settings/timeline.vue': 'timeline-display',
};

// An isolated source row must move to an adjacent meaningful setting, never
// just reopen the destination that already contains it.
const RELATION_DESTINATION_BY_SOURCE_FILE: Readonly<Record<string, string>> = {
	'src/pages/settings/note-charm.vue': 'account-profile',
	'src/components/MkNoteCharmSettings.vue': 'account-profile',
	'src/pages/settings/accounts.vue': 'account-profiles',
	'src/pages/settings/avatar-decoration.vue': 'account-profile',
	'src/pages/settings/cherrypick.vue': 'cherrypick-display',
	'src/pages/settings/connect.vue': 'account-apps',
	'src/pages/settings/privacy.vue': 'account-security',
	'src/pages/settings/profile.vue': 'account-avatar',
	'src/pages/settings/drive.vue': 'account-drive-cleaner',
	'src/pages/settings/deck.vue': 'misskey-navbar',
	'src/pages/settings/hata-custom.vue': 'hata-settings-transfer',
	'src/pages/settings/hidden-reactions-manage.vue': 'timeline-display',
	'src/pages/settings/notifications.vue': 'notifications-sounds',
	'src/pages/settings/timeline.vue': 'timeline-note-display',
};

// The preference surface shares one physical route, so an explicit, distinct
// destination is needed even for a category that currently has one row.
// Strong same-feature/section evidence still wins before this fallback.
const RELATED_DESTINATION_BY_PREFERENCE_DESTINATION: Readonly<Record<string, string>> = {
	'hataskey-ui-s': 'hataskey-ui',
	'display-general': 'display-preferences',
	'display-preferences': 'display-general',
	'timeline-note-display': 'timeline-group',
	'timeline-post-form': 'timeline-note-display',
	'timeline-group': 'timeline-note-display',
	'notifications-preferences': 'notifications-page',
	'timeline-chat': 'notifications-preferences',
	'cherrypick-display': 'cherrypick-search',
	'cherrypick-search': 'cherrypick-external-navigation',
	'cherrypick-external-navigation': 'cherrypick-search',
	'misskey-general': 'display-general',
	'misskey-accessibility': 'display-preferences',
	'misskey-performance': 'misskey-data-saver',
	'misskey-data-saver': 'misskey-performance',
	'misskey-other': 'misskey-general',
};

const CATEGORY_BY_DESTINATION_SECTION: Readonly<Record<string, string>> = {
	'hataskey-ui': 'hataskey-ui',
	'display-appearance': 'display-notes',
	'timeline-posting': 'timeline-posting',
	'notifications-sound': 'notification-sound',
	'hataskey-tools': 'hata-tools',
	cherrypick: 'cherrypick',
	// 旗鯖fork: アカウント系は用途ごとに節を割った。⚠️どれも索引上は account。
	profile: 'account',
	'account-login': 'account',
	'mute-block': 'account',
	drive: 'account',
	'data-migration': 'account',
	connections: 'account',
	'misskey-ui': 'misskey-ui',
	misc: 'misskey-ui',
};

type PreferenceInventoryItem = {
	key: SettingsInventoryKey;
	destinationId: string;
	label: string;
	caption: readonly string[];
	cherry: boolean;
};

function sourceCategoryId(destinationId: string, cherry: boolean): string {
	if (cherry) return 'cherrypick';
	const destination = destinationForId(destinationId);
	if (destination?.categoryId != null) return destination.categoryId;
	if (destinationId.startsWith('cherrypick-')) return 'cherrypick';
	if (destinationId.startsWith('timeline-')) return 'timeline-posting';
	if (destinationId.startsWith('notifications-')) return 'notification-sound';
	if (destinationId.startsWith('display-')) return 'display-notes';
	return 'misskey-ui';
}

function isLegacyPreferencesControl(item: SettingsControlCatalogItemV2): boolean {
	return item.sourceFile === LEGACY_PREFERENCES_SOURCE && item.route === PREFERENCES_ROUTE;
}

/** Only the six shared border controls move out of the old custom page. */
function isLegacyVisibilityBorderControl(item: SettingsControlCatalogItemV2): boolean {
	return item.sourceFile === 'src/pages/settings/hata-custom.vue' && item.route === '/settings/hata-custom'
		&& item.preferenceKeys.length === 1
		&& item.preferenceKeys[0]!.startsWith('postFormVisibilityBorder.')
		&& settingsInventoryKeySet.has(item.preferenceKeys[0]!);
}

function isReplacedPreferenceControl(item: SettingsControlCatalogItemV2): boolean {
	return isLegacyPreferencesControl(item) || isLegacyVisibilityBorderControl(item) || isUiSBottomNavControl(item);
}

function isUiSBottomNavControl(item: SettingsControlCatalogItemV2): boolean {
	return item.sourceFile === 'src/pages/settings-redesign/HataskeyUiSBottomNavSettings.vue'
		&& item.preferenceKeys.includes('hataskeyUi3BottomNav');
}

/**
 * Preserve runtime-generated IDs from preferences and the shared custom-page border controls.
 * The generator is the only source that knows those IDs, so this mapping is
 * deliberately built from its current output rather than a static catalog.
 */
export function redesignedPreferenceStableIdAliases(
	generated: readonly SettingsControlCatalogItemV2[],
): ReadonlyMap<string, string> {
	const dataSaverBulkAliases = new Set([
		'i18n.ts.enableAll',
		'i18n.ts.disableAll',
	]);
	const aliases = new Map<string, string>([[generatedPreferenceSearchId('hataskeyUi3BottomNav'), uiSBottomNavSearchId]]);

	for (const item of generated.filter(isReplacedPreferenceControl)) {
		if (isUiSBottomNavControl(item)) { aliases.set(item.stableId, uiSBottomNavSearchId); continue; }
		// The legacy device switch and profile control share one redesigned row.
		const isDeviceHorizontalSwipe = item.aliases.includes('deviceHorizontalSwipe') &&
			(item.storageRefs ?? []).some(ref => ref.kind === 'local' && ref.key === 'hatasabaTabSwipeEnabled');
		const representedPreferenceKeys = [
			...new Set(
				[
					...item.preferenceKeys,
					...item.aliases,
					...(isDeviceHorizontalSwipe ? ['enableHorizontalSwipe'] : []),
					...(item.storageRefs ?? []).flatMap((ref) =>
						'key' in ref ? [ref.key] : [],
					),
				].filter((key) => settingsInventoryKeySet.has(key)),
			),
		];
		const dataSaverBulkAliasCandidates =
			representedPreferenceKeys.length === 0
				? new Set(
					item.aliases.filter((alias) => dataSaverBulkAliases.has(alias)),
				)
				: new Set<string>();
		const hasDataSaverPreferenceRef = (item.storageRefs ?? []).some(
			(ref) => ref.kind === 'pref' && ref.key === 'dataSaver',
		);

		if (
			representedPreferenceKeys.length > 1 ||
			(representedPreferenceKeys.length === 0 &&
				(dataSaverBulkAliasCandidates.size !== 1 ||
					!hasDataSaverPreferenceRef))
		) {
			throw new Error(`[settings-preferences-search] legacy preference descriptor is not represented exactly once: ${item.stableId}`);
		}

		const canonicalStableId =
			representedPreferenceKeys.length === 1
				? generatedPreferenceSearchId(representedPreferenceKeys[0]!)
				: 'settings.destination.misskey-data-saver';
		if (item.stableId === canonicalStableId) throw new Error(`[settings-preferences-search] legacy preference descriptor aliases itself: ${item.stableId}`);
		if (aliases.has(item.stableId)) throw new Error(`[settings-preferences-search] duplicate legacy preference descriptor id: ${item.stableId}`);
		aliases.set(item.stableId, canonicalStableId);
	}
	return aliases;
}

function representativeLegacyControl(
	key: string,
	legacyControls: readonly SettingsControlCatalogItemV2[],
): SettingsControlCatalogItemV2 | undefined {
	return legacyControls.find(item => item.preferenceKeys.includes(key));
}

function fallbackMetadata(key: string): Pick<SettingsControlCatalogItemV2,
	'persistence' | 'saveMode' | 'availability' | 'owner' | 'applicableUi' | 'metadataEvidence'
> {
	const deviceLocal = key === 'lang' || key === 'useBoldFont' || key === 'useSystemFont' || key.startsWith('hataskeyUi3Rss');
	const navbarNotice = key === 'emojiAdditionNotice' || key === 'hourlyTimeNotice';
	// 旗鯖fork: UI S 設定と、他の投稿フォームにも共有される枠色設定。
	const hataskeyUi3 = key.startsWith('hataskeyUi3') || key.startsWith('postFormVisibilityBorder.');
	return {
		persistence: deviceLocal ? 'device' : 'profile',
		saveMode: 'immediate',
		availability: 'all',
		owner: navbarNotice || hataskeyUi3 ? 'hatasaba' : key.startsWith('searchEngine') || key === 'additionalUnicodeEmojiIndexes' || key === 'externalNavigationWarning' || key === 'trustedDomains' ? 'cherrypick' : 'core',
		applicableUi: navbarNotice ? 'simple' : 'all',
		metadataEvidence: {
			persistence: deviceLocal ? `redesigned preference inventory: device value ${key}` : `redesigned preference inventory: preference value ${key}`,
			saveMode: 'redesigned preference surface writes through the existing control model',
			availability: 'redesigned preference destination is available in every settings layout',
			owner: 'redesigned preference inventory',
			applicableUi: 'redesigned preference surface',
		},
	};
}

function inventory(): PreferenceInventoryItem[] {
	const controls = preferenceControls.map(control => ({
		key: control.key,
		destinationId: control.destinationId,
		label: control.label,
		caption: control.caption,
		cherry: control.cherry,
	}));
	const auxiliary = preferenceAuxiliaryControls.map(control => ({
		key: control.key,
		destinationId: control.destinationId,
		label: control.label,
		caption: control.caption,
		cherry: 'cherry' in control && control.cherry === true,
	}));
	const items = [...controls, ...auxiliary];
	const seen = new Set(items.map(item => item.key));
	for (const key of settingsInventoryKeys) {
		if (!seen.has(key)) throw new Error(`[settings-preferences-search] inventory key is not materialized: ${key}`);
	}
	if (seen.size !== settingsInventoryKeys.length) throw new Error('[settings-preferences-search] duplicate preference inventory key');
	return items;
}

function preferenceRelationDestination(destinationId: string): string {
	const relationDestinationId = RELATED_DESTINATION_BY_PREFERENCE_DESTINATION[destinationId];
	if (relationDestinationId == null) throw new Error(`[settings-relation] missing related destination for preference destination: ${destinationId}`);
	if (relationDestinationId === destinationId) throw new Error(`[settings-relation] related preference destination must differ: ${destinationId}`);
	if (destinationForId(relationDestinationId) == null) throw new Error(`[settings-relation] unknown related preference destination: ${destinationId} -> ${relationDestinationId}`);
	return relationDestinationId;
}

/**
 * Source-generated controls preserve conditions, captions, aliases and
 * storage metadata.  Their route, focus ID and label are replaced with the
 * explicit redesigned-surface contract so a dynamic v-for cannot disappear
 * from search when the old SFC changes shape.
 */
function materializePreferenceControl(
	entry: PreferenceInventoryItem,
	legacyControls: readonly SettingsControlCatalogItemV2[],
): SettingsControlCatalogItemV2 {
	const legacy = representativeLegacyControl(entry.key, legacyControls);
	const fallback = fallbackMetadata(entry.key);
	const stableId = generatedPreferenceSearchId(entry.key);
	const cherryOwned = entry.cherry || entry.key === 'externalNavigationWarning' || entry.key === 'trustedDomains' || entry.key.startsWith('searchEngine') || entry.key === 'additionalUnicodeEmojiIndexes';
	const description = legacy?.description ?? entry.caption.join(' ');
	return {
		stableId,
		route: PREFERENCES_ROUTE,
		label: entry.label,
		...(description ? { description } : {}),
		aliases: [...new Set([
			entry.key,
			...(entry.key.startsWith('postFormVisibilityBorder.') ? ['公開範囲', '色分け', '投稿フォーム', 'ぼかし', 'ノートの色', '左辺', 'タイムライン', 'visibility', 'border color', 'post form', 'blur', 'note color', 'timeline', '可见范围', '颜色', '发帖框', '模糊', '帖文左侧'] : []),
			...(entry.key === 'hataskeyUi3TimelineBackground' ? ['背景', 'すりガラス', 'ヘッダー', 'アイコン', 'background', 'frosted glass', 'header', 'avatar', '磨砂玻璃', '头像'] : []),
			...(entry.key === 'hataskeyUi3SideMenuBackground' ? ['左サイドメニュー', '左メニュー', 'サイドバー', '背景', 'すりガラス', 'side menu', 'sidebar', 'background', 'frosted glass', '左侧菜单', '磨砂玻璃'] : []),
			...(entry.key === 'hataskeyUi3RightPaneBackground' ? ['右ペイン', 'ウィジェット', 'Hatask', '背景', 'すりガラス', 'right pane', 'widgets', 'background', 'frosted glass', '右侧面板', '小组件', '磨砂玻璃'] : []),
			...(entry.key === 'hataskeyUi3GlassDensity' ? ['背景', 'すりガラス', '透過度', '透明度', '濃さ', '薄め', '濃いめ', 'background', 'frosted glass', 'opacity', 'transparency', 'density', '磨砂玻璃', '浓度'] : []),
			...(entry.key.startsWith('hataskeyUi3Rss') ? ['RSS', 'フィード', 'リーダー', 'feed', 'reader', '訂閱來源'] : []),
			...(entry.destinationId === 'hataskey-ui-s' ? [
				...(entry.key.startsWith('hataskeyUi3Composer') ? ['投稿フォーム'] : []), 'Hataskey UI S', 'UI3',
			] : []),
			...(legacy?.aliases ?? []),
			...(legacy?.label != null ? [legacy.label] : []),
		])],
		...(legacy?.primaryAliases?.length ? { primaryAliases: legacy.primaryAliases } : {}),
		preferenceKeys: [entry.key],
		...(legacy?.legacyMarkerParentId != null ? { legacyMarkerParentId: legacy.legacyMarkerParentId } : {}),
		legacyMarkerAncestorIds: legacy?.legacyMarkerAncestorIds ?? [],
		semanticGroupId: `settings.semantic.preference.${entry.destinationId}`,
		sourceSemanticGroupId: `settings.semantic.preference.${entry.destinationId}`,
		categoryId: sourceCategoryId(entry.destinationId, entry.cherry),
		// Border rows stay mounted when disabled; old v-if prerequisites do not apply.
		...(!entry.key.startsWith('postFormVisibilityBorder.') && legacy?.unmet?.length ? { unmet: legacy.unmet } : {}),
		persistence: legacy?.persistence ?? fallback.persistence,
		saveMode: legacy?.saveMode ?? fallback.saveMode,
		availability: legacy?.availability ?? fallback.availability,
		owner: cherryOwned ? 'cherrypick' : legacy?.owner ?? fallback.owner,
		applicableUi: legacy?.applicableUi ?? fallback.applicableUi,
		...(legacy?.storageRefs?.length ? { storageRefs: legacy.storageRefs } : {}),
		metadataEvidence: legacy?.metadataEvidence ?? fallback.metadataEvidence,
		destinationId: entry.destinationId,
		relationDestinationId: preferenceRelationDestination(entry.destinationId),
		relatedHostId: stableId,
		sourceFile: REDESIGNED_PREFERENCES_SOURCE,
		sourceLine: 1,
		destructive: false,
	};
}

/**
 * The returned list intentionally removes every generated descriptor from the
 * legacy preferences SFC, including SearchMarker-derived groups, and the six
 * shared visibility border controls from the custom page.  Their
 * content is now represented exactly once by the preference controls and
 * auxiliary rows above; retaining them would offer stale hash anchors in the
 * redesigned surface.
 */
export function mergeRedesignedPreferenceSearchItems(
	generated: readonly SettingsControlCatalogItemV2[],
): SettingsControlCatalogItemV2[] {
	const legacyPreferences = generated.filter(isReplacedPreferenceControl);
	const retained = generated
		.filter(item => !isReplacedPreferenceControl(item))
		.map(item => {
			const destinationId = item.destinationId ?? CURRENT_DESTINATION_BY_SOURCE_FILE[item.sourceFile];
			const relationDestinationId = item.relationDestinationId ?? RELATION_DESTINATION_BY_SOURCE_FILE[item.sourceFile];
			if (destinationId != null && destinationForId(destinationId) == null) throw new Error(`[settings-relation] unknown current destination: ${item.stableId} -> ${destinationId}`);
			if (relationDestinationId != null && destinationForId(relationDestinationId) == null) throw new Error(`[settings-relation] unknown related destination: ${item.stableId} -> ${relationDestinationId}`);
			if (destinationId != null && relationDestinationId === destinationId) throw new Error(`[settings-relation] related destination must differ from current destination: ${item.stableId}`);
			return {
				...item,
				...(destinationId != null ? { destinationId } : {}),
				...(relationDestinationId != null ? { relationDestinationId } : {}),
			};
		});
	return [...retained, ...inventory().map(entry => materializePreferenceControl(entry, legacyPreferences)), uiSBottomNavSearchItem(), uiSDisplaySizeSearchItem()];
}

/**
 * Materialize every visible manifest item as a navigation-only catalog target.
 * These entries stay out of ordinary search results, but are the only allowed
 * explicit fallback target when a control has no stronger relation evidence.
 */
export function settingsDestinationCatalogItemsV2(): SettingsDestinationCatalogItemV2[] {
	const sectionForDestination = new Map(settingsDestinationSections.flatMap(section => section.items.map(item => [item.id, section.id] as const)));
	const seen = new Set<string>();
	return settingsDestinations.map(destination => {
		if (seen.has(destination.id)) throw new Error(`[settings-destinations] duplicate destination id: ${destination.id}`);
		seen.add(destination.id);
		const sectionId = sectionForDestination.get(destination.id);
		const categoryId = destination.categoryId ?? (sectionId == null ? undefined : CATEGORY_BY_DESTINATION_SECTION[sectionId]);
		const owner = categoryId === 'cherrypick' ? 'cherrypick' : destination.brand != null || sectionId === 'hataskey-tools' ? 'hatasaba' : 'core';
		if (typeof destination.label !== 'string' || destination.label.trim() === '') throw new Error(`[settings-destinations] destination label is missing: ${destination.id}`);
		return {
			destinationId: destination.id,
			stableId: destination.stableId ?? `settings.destination.${destination.id}`,
			route: destination.route,
			label: destination.label,
			...(destination.anchor ? { anchor: destination.anchor } : {}),
			...(destination.controlId ? { controlId: destination.controlId } : {}),
			aliases: [destination.id, ...(destination.brand ? [destination.brand] : [])],
			icon: destination.icon,
			...(categoryId ? { categoryId } : {}),
			...(destination.activation ? { activation: destination.activation } : {}),
			persistence: 'device',
			saveMode: 'immediate',
			availability: 'all',
			owner,
			applicableUi: 'all',
			metadataEvidence: {
				persistence: `redesigned destination manifest: ${destination.id}`,
				saveMode: 'destination navigation does not write a setting value',
				availability: 'visible manifest destination is available in every settings layout',
				owner: `redesigned destination manifest: ${destination.id}`,
				applicableUi: 'redesigned settings shell',
			},
		};
	});
}

/** Legacy page markers remain lookup-compatible but never surface in the redesigned search. */
export function suppressLegacyPreferenceSearchMarkers(catalog: SettingsCatalogV2): void {
	const suppressed = new Set(catalog.descriptors
		.filter(descriptor => descriptor.source === 'legacy' && descriptor.route === PREFERENCES_ROUTE)
		.map(descriptor => descriptor.stableId));
	for (const descriptor of catalog.descriptors) {
		if (!suppressed.has(descriptor.stableId)) continue;
		descriptor.searchable = false;
		descriptor.related = [];
		descriptor.relatedIds = [];
		descriptor.relatedTotal = 0;
	}
	for (const descriptor of catalog.descriptors) {
		if (suppressed.has(descriptor.stableId)) continue;
		const before = descriptor.related;
		const related = before.filter(relation => !suppressed.has(relation.stableId));
		if (related.length === before.length) continue;
		const removed = before.length - related.length;
		descriptor.related = related;
		descriptor.relatedIds = related.map(relation => relation.stableId);
		descriptor.relatedTotal = Math.max(0, (descriptor.relatedTotal ?? before.length) - removed);
	}
	assertSettingsCatalogRelationsV2(catalog);
}

export function preferenceDestinationForSearchTarget(
	target: Pick<SettingsControlCatalogItemV2, 'preferenceKeys'>,
): string | null {
	const destinations = [...new Set(target.preferenceKeys.map(destinationForPreferenceKey).filter((value): value is string => value != null))];
	return destinations.length === 1 ? destinations[0] : null;
}

export function isRedesignedPreferenceSearchId(id: string | undefined): boolean {
	return id === uiSDisplaySizeSearchId || id === uiSBottomNavSearchId || id === generatedPreferenceSearchId('hataskeyUi3BottomNav')
		|| id != null && settingsInventoryKeys.some(key => generatedPreferenceSearchId(key) === id);
}
