/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SearchIndexItem } from '@/utility/inapp-search.js';
import type {
	SettingsApplicableUiV2,
	SettingsApplicableUiValueV2,
	SettingsAvailabilityV2,
	SettingsControlActivationV2,
	SettingsActivationUnmetV2,
	SettingsControlCatalogItemV2,
	SettingsOwnerV2,
	SettingsPersistenceV2,
	SettingsSaveModeV2,
	SettingsStorageRefV2,
	SettingsMetadataEvidenceV2,
} from '@/utility/settings-control-search-v2.js';
import { compareStringEquals, normalizeStringWithHiragana } from '@/utility/intl-string.js';

/** The relation types which are meaningful to a person looking for a setting. */
export type SettingsRelatedKindV2 = 'sameTopic' | 'alternative' | 'dependency' | 'legacyAlias' | 'uiCounterpart' | 'fallback';

export type SettingsRelationReasonKeyV2 = 'sameSection' | 'sameGroup' | 'sameNestedGroup' | 'samePreference' | 'sameFeature' | 'sharedVisibleTerm';

export type SettingsCatalogPresentationV2 = {
	/** Localized category labels keyed by the stable category id. */
	categoryLabels?: Readonly<Record<string, string>>;
	/** Localized fallback labels/descriptions keyed by their original route. */
	fallback?: Readonly<Record<string, Partial<{ label: string; description: string; aliases: readonly string[] }>>>;
	relationReasons?: Partial<Record<SettingsRelationReasonKeyV2, string>>;
	noRelatedReasons?: Partial<Record<'fallback' | 'marker' | 'default', string>>;
	fallbackReason?: string;
	activationUnavailableReason?: string;
};

export interface SettingsRelatedV2 {
	stableId: string;
	kind: SettingsRelatedKindV2;
	/**
	 * Stable presentation key for consumers which want to resolve their own
	 * locale copy. It is optional solely for compatibility with pre-V2 test
	 * fixtures and third-party catalog consumers; generated relations always
	 * provide it.
	 */
	reasonKey?: SettingsRelationReasonKeyV2;
	reason: string;
	weight: number;
}

export interface SettingsCatalogDescriptorV2 {
	stableId: string;
	legacyId?: string;
	/** The injected control identity to focus after navigation. */
	controlId?: string;
	/** Legacy marker that contains this control, retained for old-surface support. */
	legacyMarkerParentId?: string;
	/** Full legacy-marker ancestry, when the generator can determine it. */
	legacyMarkerAncestorIds?: string[];
	semanticGroupId?: string;
	/** Broader, explicitly-audited feature/source relation after static section evidence. */
	sourceSemanticGroupId?: string;
	isGroup?: boolean;
	/** Optional route-local action required before the control can receive focus. */
	activation?: SettingsControlActivationV2;
	/** A static group/control host used when this item itself is conditionally unmounted. */
	focusId?: string;
	/** A prerequisite which search must explain, never click or mutate. */
	unmet?: SettingsActivationUnmetV2[];
	/** Where the entry originated; controls are the authoritative searchable inventory. */
	source: 'control' | 'legacy' | 'fallback' | 'destination';
	/** Stable manifest id for an explicit redesigned settings destination. */
	destinationId?: string;
	/** Explicit manifest destination used only after ordinary relation evidence is exhausted. */
	relationDestinationId?: string;
	/** Generator provenance retained for audit diagnostics and explicit source relations. */
	sourceFile?: string;
	sourceLine?: number;
	/** Whether this descriptor is eligible for the main result list. */
	searchable: boolean;
	route: string;
	/** Original generator route when a known broken inference was remapped. */
	sourceRoute?: string;
	/** Why a legacy dynamic route is preserved for lookup but is not navigable/searchable. */
	routeExclusionReason?: string;
	anchor?: string;
	label: string;
	description?: string;
	icon?: string;
	categoryId: string;
	categoryLabel: string;
	aliases: string[];
	/** Exact, audited destination aliases ranked ahead of incidental labels. */
	primaryAliases?: string[];
	legacyLabels: string[];
	preferenceKeys: string[];
	persistence: SettingsPersistenceV2;
	saveMode: SettingsSaveModeV2;
	availability: SettingsAvailabilityV2;
	owner: SettingsOwnerV2;
	applicableUi: SettingsApplicableUiV2;
	storageRefs?: SettingsStorageRefV2[];
	metadataEvidence: SettingsMetadataEvidenceV2;
	relatedHostId?: string;
	relatedIds: string[];
	related: SettingsRelatedV2[];
	/** Number of meaningful related destinations before the bounded payload cap. */
	relatedTotal?: number;
	/** True for the explicit entries for routes the old generator could not index. */
	isFallback?: boolean;
	fallbackReason?: string;
	destructive?: boolean;
	/** Audited only after no meaningful, available relation could be proved. */
	noRelatedReason?: string;
	/**
	 * A legacy hash may be safe to reopen only when one activation path can be
	 * proved from its descendant controls.  The reason is retained instead of
	 * guessing a default category when several paths exist.
	 */
	activationUnavailableReason?: string;
	/** A deterministic tie-breaker for clients which render their own result rows. */
	searchRank: number;
}

export interface SettingsCatalogV2 {
	descriptors: SettingsCatalogDescriptorV2[];
	/** Alias retained for consumers which call the collection `items`. */
	items: SettingsCatalogDescriptorV2[];
	byStableId: ReadonlyMap<string, SettingsCatalogDescriptorV2>;
	byLegacyId: ReadonlyMap<string, SettingsCatalogDescriptorV2>;
	/** Runtime old-control id to redesigned canonical-control id rewrites. */
	canonicalStableIdByLegacyStableId: ReadonlyMap<string, string>;
	fallbackRoutes: string[];
}

export type SettingsMatchKindV2 = 'labelExact' | 'labelPrefix' | 'labelIncludes' | 'alias' | 'preferenceKey' | 'description' | 'related';

export type SettingsSearchResultV2 = SettingsCatalogDescriptorV2 & {
	score: number;
	matchKind: SettingsMatchKindV2;
};

export interface SettingsSearchOptionsV2 {
	limit?: number;
	suggestionsLimit?: number;
	includeSuggestions?: boolean;
	suggestionsOnly?: boolean;
}

export interface SettingsSearchResponseV2 {
	results: SettingsSearchResultV2[];
	/** Total direct matches before the UI result limit is applied. */
	totalResults: number;
	suggestions: SettingsSearchResultV2[];
	normalizedQuery: string;
}

/**
 * Accept an older generated module during an HMR transition, while always
 * materialising the complete metadata contract in the catalog itself.
 */
type SettingsControlCatalogInputV2 = Omit<SettingsControlCatalogItemV2, 'legacyMarkerAncestorIds'> & {
	legacyMarkerAncestorIds?: string[];
};

/** A visible navigation destination from the redesigned settings manifest. */
export type SettingsDestinationCatalogItemV2 = {
	destinationId: string;
	stableId: string;
	route: string;
	label: string;
	/** Existing marker or sub-surface target retained from the manifest. */
	anchor?: string;
	controlId?: string;
	focusId?: string;
	aliases: string[];
	icon?: string;
	categoryId?: string;
	activation?: SettingsControlActivationV2;
	persistence: SettingsPersistenceV2;
	saveMode: SettingsSaveModeV2;
	availability: SettingsAvailabilityV2;
	owner: SettingsOwnerV2;
	applicableUi: SettingsApplicableUiV2;
	metadataEvidence: SettingsMetadataEvidenceV2;
};

const FALLBACKS = [
	['/settings/drive/cleaner', '/settings/drive/cleaner'],
	['/settings/theme/install', '/settings/theme/install'],
	['/settings/theme/manage', '/settings/theme/manage'],
	['/settings/statusbar', '/settings/statusbar'],
	['/settings/plugin/install', '/settings/plugin/install'],
	['/settings/apps', '/settings/apps'],
	['/settings/webhook/edit/:webhookId', '/settings/connect'],
	['/settings/webhook/new', '/settings/webhook/new'],
	['/settings/custom-css', '/settings/custom-css'],
	['/settings/account-stats', '/settings/account-stats'],
	['/settings/external-account', '/settings/external-account'],
	['/settings/hata-custom', '/settings/hata-custom'],
	['/settings/hidden-reactions', '/settings/hidden-reactions'],
] as const;

const KNOWN_SETTINGS_ROUTES = new Set([
	'/settings', '/settings/profile', '/settings/note-charm', '/settings/avatar-decoration', '/settings/privacy', '/settings/emoji-palette', '/settings/drive', '/settings/drive/cleaner',
	'/settings/notifications', '/settings/email', '/settings/security', '/settings/preferences', '/settings/theme/install', '/settings/theme/manage',
	'/settings/theme', '/settings/navbar', '/settings/timeline', '/settings/statusbar', '/settings/sounds', '/settings/plugin/install', '/settings/plugin',
	'/settings/account-data', '/settings/mute-block', '/settings/connect', '/settings/apps', '/settings/webhook/edit/:webhookId', '/settings/webhook/new',
	'/settings/deck', '/settings/custom-css', '/settings/profiles', '/settings/accounts', '/settings/other', '/settings/hata-custom', '/settings/external-account',
	'/settings/hidden-reactions', '/settings/account-stats', '/settings/cherrypick', '/settings/hatafeed', '/settings/concrnt',
]);

const ENGLISH_CATEGORY_LABELS_V2: Record<string, string> = {
	'hataskey-ui': 'Hataskey UI', 'display-notes': 'Display density and notes', 'theme-font': 'Themes and fonts', 'timeline-posting': 'Timeline and posting',
	reactions: 'Reactions', 'notification-sound': 'Notifications and sounds', account: 'Account', 'hata-tools': 'Hataskey tools', cherrypick: 'CherryPick',
	'data-connect': 'Data and connections', 'misskey-ui': 'Misskey UI', behavior: 'Behavior',
};

const ENGLISH_FALLBACK_LABELS: Record<string, { label: string; aliases: string[]; description: string }> = {
	'/settings/drive/cleaner': { label: 'Clean up Drive', aliases: ['ファイル整理', 'ドライブ整理', 'drive cleaner'], description: 'Organize files in Drive' },
	'/settings/theme/install': { label: 'Install theme', aliases: ['テーマ追加', 'テーマ導入', 'theme install'], description: 'Add a theme' },
	'/settings/theme/manage': { label: 'Manage themes', aliases: ['テーマ管理', 'theme manage'], description: 'Manage installed themes' },
	'/settings/statusbar': { label: 'Status bar', aliases: ['status bar', '状態バー'], description: 'Configure the status bar' },
	'/settings/plugin/install': { label: 'Install plugin', aliases: ['プラグイン追加', 'plugin install'], description: 'Add a plugin' },
	'/settings/apps': { label: 'Connected apps', aliases: ['アプリ連携', 'apps'], description: 'Manage connected apps' },
	'/settings/webhook/edit/:webhookId': { label: 'Edit Webhook', aliases: ['webhook 編集', 'Webhook設定'], description: 'Choose a Webhook to edit from the connections screen' },
	'/settings/webhook/new': { label: 'Add Webhook', aliases: ['webhook 新規', 'Webhook作成'], description: 'Create a Webhook' },
	'/settings/custom-css': { label: 'Custom CSS', aliases: ['custom css', 'CSS'], description: 'Configure custom CSS' },
	'/settings/account-stats': { label: 'Account statistics', aliases: ['統計', 'account statistics'], description: 'View account statistics' },
	'/settings/external-account': { label: 'External account', aliases: ['外部連携', 'external account'], description: 'Configure external account connections' },
	'/settings/hata-custom': { label: 'Hataskey features', aliases: ['旗鯖', 'Hataskey独自設定', 'custom features'], description: 'Configure Hataskey features' },
	'/settings/hidden-reactions': { label: 'Hidden reactions', aliases: ['リアクション非表示', 'hidden reactions'], description: 'Manage hidden reactions' },
};

const ENGLISH_RELATION_REASONS_V2: Record<SettingsRelationReasonKeyV2, string> = {
	sameSection: 'In the same settings section',
	sameGroup: 'In the same settings group',
	sameNestedGroup: 'In the same item group',
	samePreference: 'Uses related settings',
	sameFeature: 'Part of the same feature',
	sharedVisibleTerm: 'Uses similar visible wording',
};

const ENGLISH_NO_RELATED_REASONS_V2: Record<'fallback' | 'marker' | 'default', string> = {
	fallback: 'No related destination can be verified because this screen has no generated setting controls',
	marker: 'No meaningfully related setting is verified in this settings group',
	default: 'No meaningfully related setting is verified in the current catalog',
};

function categoryLabelV2(id: string, presentation: SettingsCatalogPresentationV2 | undefined): string {
	// The builder is also used by workers and tests before the active locale is
	// available. Keep that no-presentation path deterministic and English; the
	// shell passes its complete active-locale presentation explicitly.
	return presentation?.categoryLabels?.[id] ?? ENGLISH_CATEGORY_LABELS_V2[id] ?? id;
}

function fallbackInfoV2(sourceRoute: string, presentation: SettingsCatalogPresentationV2 | undefined): { label: string; aliases: string[]; description: string } {
	const base = ENGLISH_FALLBACK_LABELS[sourceRoute];
	if (base == null) throw new Error(`Unknown settings fallback route: ${sourceRoute}`);
	const localized = presentation?.fallback?.[sourceRoute];
	return {
		label: localized?.label ?? base.label,
		aliases: [...(localized?.aliases ?? base.aliases)],
		description: localized?.description ?? base.description,
	};
}

function relationReasonV2(key: SettingsRelationReasonKeyV2, presentation: SettingsCatalogPresentationV2 | undefined): string {
	return presentation?.relationReasons?.[key] ?? ENGLISH_RELATION_REASONS_V2[key];
}

function noRelatedReasonV2(key: 'fallback' | 'marker' | 'default', presentation: SettingsCatalogPresentationV2 | undefined): string {
	return presentation?.noRelatedReasons?.[key] ?? ENGLISH_NO_RELATED_REASONS_V2[key];
}

// A finite, audited concept map for fallback-only pages. These are not route
// or category shortcuts: each entry names one source setting's actual peer.
const FALLBACK_SEMANTIC_GROUPS: Readonly<Record<string, string>> = {
	'/settings/drive/cleaner': 'settings.semantic.feature.drive-cleaner',
};

const LEGACY_ROUTE_SEMANTIC_GROUPS: Readonly<Record<string, string>> = {
	'/settings/concrnt': 'settings.semantic.feature.concrnt-linking',
	'/settings/emoji-palette': 'settings.semantic.feature.emoji-input',
	// The code editor is the install form itself; the existing Plugin settings
	// marker is its named management peer, rather than a generic same-route
	// recommendation.
	'/settings/plugin': 'settings.semantic.feature.plugin-install',
};

const KNOWN_ALIASES: Array<[string, string[]]> = [
	['useBlurEffectForModal', ['ぼかし', 'bokashi', 'モーダルのぼかし']],
	['removeModalBgColorForBlur', ['ぼかし', 'モーダル背景', '透明']],
	['useBlurEffect', ['ぼかし', 'blur']],
	['showPageTabBarBottom', ['下のバー', '下部バー', 'タブバー']],
	['securityKeyAndPasskey', ['パスキー', 'pasuki', 'セキュリティキー', 'passkey', '2FA', '2段階認証', 'セキュリティ']],
	['passwordLessLogin', ['パスキー', 'pasuki', 'パスワードレス', 'passkey']],
	['useEnterToSend', ['Enterで送信', 'エンターで送信', '送信']],
	['sendOnEnter', ['Enterで送信', 'エンターで送信', '送信']],
	['fontSize', ['フォント', '文字サイズ', 'font']],
	['useSystemFont', ['フォント', 'システムフォント', 'font']],
	['useBoldFont', ['フォント', '太字フォント', 'font']],
	['enableHighQualityImagePlaceholders', ['ぼかし', '画像プレースホルダー']],
	['showReplyTargetNoteInSemiTransparent', ['opacity', '透明度', '透過', '半透明']],
	['noteSpacing', ['間隔', '詰める', '余白']],
	['classicNoteSpacingDisplay', ['間隔', '詰める', '余白']],
	['showGapBetweenNotesInTimeline', ['間隔', '詰める', '余白']],
	['simpleUi.glassUiCardOpacity', ['透過', 'opacity', '角丸カード']],
	['simpleUi.hideBotsInTimeline', ['bot', '自動投稿', 'ノイズ']],
	['simpleUi.showHatadyTab', ['Hatady', '記録', 'タイムライン', 'タブ']],
	['simpleUi.bottomNav', ['ナビ', 'タブ', '下のバー']],
	['nicknameEnabled', ['ニックネーム', 'ニャ']],
	['chat.sendOnEnter', ['Enterで送信', 'エンターで送信']],
	['hataBranding.useHatakyu', ['ハタキュ', 'アイコン', 'ブランディング']],
	['weatherEffect.enabled', ['天気', '雨', '雪', '若葉', '演出']],
	['deck.columnAlign', ['カラム']],
	['deck.wallpaper', ['壁紙']],
	['deck.menuPosition', ['メニュー位置']],
];

const KEYWORD_ALIASES: Record<string, string[]> = {
	concrnt: ['コンカレント', 'Concrnt', 'concurrent', 'CTL'],
	note: ['ノート'], notes: ['ノート'], gap: ['間隔', 'すき間'], spacing: ['間隔'], timeline: ['タイムライン'],
	font: ['フォント'], blur: ['ぼかし'], send: ['送信'], enter: ['Enter'], bottom: ['下', '下部'],
};

function unique(values: string[]): string[] {
	const seen = new Set<string>();
	return values.filter(value => {
		const key = value.trim();
		if (key === '' || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function normalizeHiragana(value: string): string {
	return [...value].map(char => {
		const code = char.charCodeAt(0);
		return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char;
	}).join('');
}

/** Search normalization shared by the catalog and its consumers. */
export function normalizeSettingsSearchQueryV2(value: string): string {
	return normalizeHiragana(value.normalize('NFKC').toLocaleLowerCase('ja-JP')).replace(/\s+/gu, ' ').trim();
}

function hash(value: string): string {
	let result = 2166136261;
	for (const char of value) {
		result ^= char.codePointAt(0) ?? 0;
		result = Math.imul(result, 16777619);
	}
	return (result >>> 0).toString(36);
}

function slug(value: string): string {
	const ascii = normalizeSettingsSearchQueryV2(value).replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
	return ascii || 'item';
}

function expressionKey(value: string): string {
	const match = value.match(/(?:\.|\[['"])([A-Za-z0-9_]+)(?:['"]\])?\}?$/u);
	return match?.[1] ?? value.replace(/^\$\{.*?\./u, '').replace(/\}?$/u, '');
}

function humanize(value: string): string {
	if (!value.includes('${')) return value;
	const key = expressionKey(value);
	for (const [needle, aliases] of KNOWN_ALIASES) {
		if (key === needle) return aliases[0];
	}
	return key.replace(/([a-z])([A-Z])/gu, '$1 $2').replace(/^./u, char => char.toUpperCase());
}

function knownAliases(value: string): string[] {
	const key = expressionKey(value);
	return KNOWN_ALIASES.find(([needle]) => needle === value || needle === key)?.[1] ?? [];
}

function keywordAliases(values: string[]): string[] {
	return values.flatMap(value => KEYWORD_ALIASES[normalizeSettingsSearchQueryV2(value)] ?? []);
}

function validRoute(route: string): boolean {
	return KNOWN_SETTINGS_ROUTES.has(route) && !route.includes('//') && !/[\s#?]/u.test(route);
}

type SettingsCategoryContextV2 = Pick<SettingsControlCatalogInputV2, 'activation' | 'sourceSemanticGroupId' | 'semanticGroupId' | 'isGroup' | 'categoryId'>
	& Partial<Pick<SettingsControlCatalogInputV2, 'sourceFile'>>;

function categoryFor(
	route: string,
	terms = '',
	context: SettingsCategoryContextV2 = {},
	presentation?: SettingsCatalogPresentationV2,
): { id: string; label: string } {
	const value = normalizeSettingsSearchQueryV2(`${route} ${terms}`);
	let id = 'behavior';
	const activationCategory = context.activation?.category;
	const sourceFile = context.sourceFile ?? '';
	const semantic = `${context.semanticGroupId ?? ''} ${context.sourceSemanticGroupId ?? ''}`;
	// `/settings/hata-custom` is a launch surface, not a product category.  Its
	// individual source and activation are the only deterministic evidence for
	// the redesigned IA, so resolve those before route/term heuristics.
	if (route === '/settings/note-charm') id = 'account';
	else if (sourceFile === 'src/components/HatasabaUi2SettingsBody.vue'
		|| sourceFile === 'src/components/HatasabaUi2ImmediateSettings.vue'
		|| /hatasaba-ui2|hatasaba-ui-/u.test(semantic)
		|| (context.activation?.kind === 'popup' && context.activation.popup === 'hatasaba-ui2')) id = 'hataskey-ui';
	else if (route === '/settings/hata-custom' && activationCategory === 'glassUi') id = 'hataskey-ui';
	else if (route === '/settings/hata-custom' && activationCategory === 'font') id = 'theme-font';
	else if (route === '/settings/hata-custom' && activationCategory === 'visual') id = 'display-notes';
	else if (route === '/settings/hata-custom' && activationCategory != null) id = 'hata-tools';
	else if (/hata-custom|旗鯖|custom features/u.test(value)) id = 'hata-tools';
	else if (/cherrypick/u.test(value)) id = 'cherrypick';
	else if (/reaction|emoji|mute|hidden-reactions|リアクション|絵文字|ミュート/u.test(value)) id = 'reactions';
	else if (/notification|sound|通知|サウンド/u.test(value)) id = 'notification-sound';
	else if (/font|theme|custom-css|blur|opacity|transparent|semi|フォント|テーマ|カスタムcss|ぼかし|透過|半透明/u.test(value)) id = 'theme-font';
	else if (/timeline|send|enter|posting|投稿|送信|タイムライン/u.test(value)) id = 'timeline-posting';
	else if (/navbar|deck|avatar-decoration|statusbar|display|表示|ナビ|デッキ/u.test(value)) id = 'display-notes';
	else if (/drive|account-data|apps|connect|webhook|external-account|concrnt|データ|連携/u.test(value)) id = 'data-connect';
	else if (/profile|privacy|security|accounts|account|email|プロフィール|プライバシー|セキュリティ|アカウント/u.test(value)) id = 'account';
	else if (/ui|interface|misskey/u.test(value)) id = 'misskey-ui';
	return { id, label: categoryLabelV2(id, presentation) };
}

function catalogOwnerFor(sourceFile: string | undefined, route: string): SettingsOwnerV2 {
	if (route === '/settings/cherrypick') return 'cherrypick';
	if (route === '/settings/hata-custom' || route === '/settings/concrnt'
		|| sourceFile === 'settings-shell'
		|| sourceFile?.includes('HatasabaUi2') === true
		|| sourceFile?.includes('HataSettings') === true
		|| sourceFile?.endsWith('/HataskSettings.vue') === true
		|| sourceFile?.endsWith('/HatadyDisplaySettings.vue') === true
		|| sourceFile?.endsWith('/MkMascotSettings.vue') === true
		|| sourceFile?.endsWith('/MkEarthquakeSettings.vue') === true
		|| sourceFile?.endsWith('/MkUISetup.vue') === true) return 'hatasaba';
	return 'core';
}

function catalogApplicableUiFor(sourceFile: string | undefined, route: string): SettingsApplicableUiV2 {
	if (sourceFile === 'src/components/HatasabaUi2SettingsBody.vue'
		|| sourceFile === 'src/components/HatasabaUi2ImmediateSettings.vue') return 'simple';
	if (route === '/settings/deck' || sourceFile?.endsWith('/settings/deck.vue') === true) return 'deck';
	return 'all';
}

function applicableUiValues(value: SettingsApplicableUiV2): SettingsApplicableUiValueV2[] {
	return [...new Set(Array.isArray(value) ? value : [value])];
}

function availabilityCovers(source: SettingsAvailabilityV2, target: SettingsAvailabilityV2): boolean {
	// Relations are materialised statically, so a target must be reachable in
	// every viewport in which the source is applicable. An overlap is unsafe:
	// an all-screen control could otherwise recommend a mobile-only target.
	return target === 'all' || target === source;
}

function applicableUiContexts(value: SettingsApplicableUiV2): Set<Exclude<SettingsApplicableUiValueV2, 'all'>> {
	const contexts = new Set<Exclude<SettingsApplicableUiValueV2, 'all'>>();
	for (const item of applicableUiValues(value)) {
		if (item === 'all') {
			contexts.add('default');
			contexts.add('deck');
			contexts.add('simple');
			contexts.add('simple-deck');
		} else if (item === 'simple') {
			contexts.add('simple');
			contexts.add('simple-deck');
		} else {
			contexts.add(item);
		}
	}
	return contexts;
}

function applicableUiCovers(source: SettingsApplicableUiV2, target: SettingsApplicableUiV2): boolean {
	const sourceContexts = applicableUiContexts(source);
	const targetContexts = applicableUiContexts(target);
	return [...sourceContexts].every(context => targetContexts.has(context));
}

function metadataForLegacyDescriptor(route: string, sourceFile?: string): Pick<SettingsCatalogDescriptorV2, 'persistence' | 'saveMode' | 'availability' | 'owner' | 'applicableUi' | 'metadataEvidence'> {
	if (route === '/settings/concrnt') return {
		persistence: 'device', saveMode: 'immediate', availability: 'all', owner: 'hatasaba', applicableUi: 'all',
		metadataEvidence: {
			persistence: 'ConcrntStorage stores settings in the owner-scoped HataskeyConcrnt/private IndexedDB connection record; preferences sync and export exclude it',
			saveMode: 'updateConcrntSettings persists each confirmed setting change',
			availability: 'The Concrnt settings page has no viewport restriction',
			owner: 'Hataskey independent Concrnt v2 integration',
			applicableUi: 'The Concrnt settings route is shared by all shells',
		},
	};
	return {
		persistence: 'profile',
		saveMode: 'immediate',
		availability: 'all',
		owner: catalogOwnerFor(sourceFile, route),
		applicableUi: catalogApplicableUiFor(sourceFile, route),
		metadataEvidence: {
			persistence: '旧検索markerの互換descriptor。保存先の再推測はせず既存profile互換値を保持',
			saveMode: '旧検索markerの互換descriptor。明示save経路を実行しない',
			availability: '旧検索markerに端末幅の静的根拠がないため既存all互換値を保持',
			owner: `legacy route: ${route}`,
			applicableUi: `legacy route: ${route}`,
		},
	};
}

function metadataForControlDescriptor(item: SettingsControlCatalogInputV2): Pick<SettingsCatalogDescriptorV2, 'persistence' | 'saveMode' | 'availability' | 'owner' | 'applicableUi' | 'storageRefs' | 'metadataEvidence'> {
	const evidence = item.metadataEvidence;
	const fields = [
		['persistence', item.persistence],
		['saveMode', item.saveMode],
		['availability', item.availability],
		['owner', item.owner],
		['applicableUi', item.applicableUi],
		['metadataEvidence.persistence', evidence?.persistence],
		['metadataEvidence.saveMode', evidence?.saveMode],
		['metadataEvidence.availability', evidence?.availability],
		['metadataEvidence.owner', evidence?.owner],
		['metadataEvidence.applicableUi', evidence?.applicableUi],
	] as const;
	const missing = fields.filter(([, value]) => value == null || value === '' || (Array.isArray(value) && value.length === 0)).map(([name]) => name);
	if (missing.length > 0) {
		throw new Error(`settings V2 control metadata is incomplete: ${item.stableId} (${item.sourceFile}:${item.sourceLine}) missing ${missing.join(', ')}`);
	}
	return {
		persistence: item.persistence,
		saveMode: item.saveMode,
		availability: item.availability,
		owner: item.owner,
		applicableUi: item.applicableUi,
		...(item.storageRefs?.length ? { storageRefs: item.storageRefs } : {}),
		metadataEvidence: evidence,
	};
}

function fallbackDescriptor(
	sourceRoute: string,
	route: string,
	presentation?: SettingsCatalogPresentationV2,
): Omit<SettingsCatalogDescriptorV2, 'related' | 'relatedIds'> {
	const info = fallbackInfoV2(sourceRoute, presentation);
	const category = categoryFor(sourceRoute, `${info.label} ${info.aliases.join(' ')}`, {}, presentation);
	const stableId = `settings.fallback.${slug(sourceRoute)}`;
	return {
		stableId,
		source: 'fallback',
		searchable: true,
		route,
		sourceRoute,
		// No generated marker exists for this route. The UI must navigate to the route root.
		label: info.label,
		description: info.description,
		categoryId: category.id,
		categoryLabel: category.label,
		aliases: unique(info.aliases),
		legacyLabels: [],
		preferenceKeys: [],
		...metadataForLegacyDescriptor(route),
		...(FALLBACK_SEMANTIC_GROUPS[sourceRoute] ? { semanticGroupId: FALLBACK_SEMANTIC_GROUPS[sourceRoute] } : {}),
		destructive: isDestructive({ label: info.label, aliases: info.aliases, description: info.description }),
		isFallback: true,
		fallbackReason: presentation?.fallbackReason ?? (presentation == null
			? '旧検索generatorがこの設定ルートを生成できなかったため明示登録'
			: 'Explicitly registered because the legacy search generator did not generate this settings route'),
		searchRank: 2,
	};
}

function canonicalRoute(route: string): string {
	const remapped: Record<string, string> = {
		'/settings/mute-block.emoji-mute': '/settings/mute-block',
		'/settings/2fa': '/settings/security',
	};
	return remapped[route] ?? route;
}

const EXCLUDED_DYNAMIC_SETTINGS_ROUTES: Readonly<Record<string, string>> = {
	'/settings/instance-info/:host': 'インスタンス情報は設定値を変更する画面ではなく、動的なhostを検索URLへ埋め込めないため除外',
	'/settings/webhook/edit/:webhookId': 'Webhook編集は動的なwebhookIdを必要とするため、個別編集画面へ固定URLで到達できない。連携画面から対象を選択する',
};

type ResolvedSettingsRouteV2 = { route: string; sourceRoute?: string; routeExclusionReason?: string };

function resolveRoute(item: SearchIndexItem, byId: Map<string, SearchIndexItem>, stack = new Set<string>()): ResolvedSettingsRouteV2 {
	if (item.path != null) {
		const exclusion = EXCLUDED_DYNAMIC_SETTINGS_ROUTES[item.path];
		// Preserve the old marker lookup, but mark it unavailable before any
		// search/navigation surface can select it.  There is no safe fixed URL
		// replacement for a route requiring a runtime host parameter.
		if (exclusion != null) return { route: item.path, sourceRoute: item.path, routeExclusionReason: exclusion };
		const route = canonicalRoute(item.path);
		if (!validRoute(route)) throw new Error(`Invalid settings route: ${item.path}`);
		return route === item.path ? { route } : { route, sourceRoute: item.path };
	}
	if (item.parentId == null) throw new Error(`Settings search item has no route: ${item.id}`);
	if (stack.has(item.id)) throw new Error(`Settings search parent cycle: ${item.id}`);
	const parent = byId.get(item.parentId);
	if (!parent) throw new Error(`Settings search item has missing parent: ${item.id} -> ${item.parentId}`);
	stack.add(item.id);
	return resolveRoute(parent, byId, stack);
}

function resolveParentLabels(item: SearchIndexItem, byId: Map<string, SearchIndexItem>): string[] {
	const labels: string[] = [];
	const seen = new Set<string>();
	for (let current = item; current.parentId != null;) {
		if (seen.has(current.id)) break;
		seen.add(current.id);
		const parent = byId.get(current.parentId);
		if (!parent) break;
		labels.unshift(humanize(parent.label));
		current = parent;
	}
	return labels;
}

function stableIdFor(item: SearchIndexItem, route: string, parentLabels: string[]): string {
	const key = expressionKey(item.label);
	const semantic = [...parentLabels, key, ...item.keywords].join('|');
	return `settings.${slug(route.replace(/^\/settings\//u, ''))}.${slug(key)}-${hash(semantic)}`;
}

function isDestructive(item: Pick<SettingsCatalogDescriptorV2, 'label' | 'aliases' | 'description'>): boolean {
	// Appearance labels can legitimately contain words such as "remove" or "clear".
	// Only keep the stricter treatment for an operation that can clearly destroy an
	// account, all data, or a signed-in session.
	return /(?:\b(?:delete|remove)\s+(?:an?\s+)?account\b|\b(?:delete|clear)\s+(?:all\s+)?data\b|\b(?:log\s*out|sign\s*out)\b|\breset\s+(?:all\s+)?settings\b|アカウント(?:を|の)?削除|(?:全(?:ての?)?データ|すべてのデータ).*(?:削除|消去)|ログアウト|(?:全設定|すべての設定).*(?:初期化|リセット))/iu.test([item.label, ...(item.aliases ?? []), item.description ?? ''].join(' '));
}

function decorate(descriptor: SettingsCatalogDescriptorV2, score: number, matchKind: SettingsMatchKindV2): SettingsSearchResultV2 {
	return { ...descriptor, score, matchKind };
}

function relationTokens(descriptor: SettingsCatalogDescriptorV2): Set<string> {
	// Search aliases include i18n paths, model expressions, and persistence keys
	// so a person can find a setting. They are not human-language evidence that
	// two settings are related: `editor.draft.*` and `i18n.ts.*` must never make
	// an unrelated related-settings card appear.
	// Related cards must be justified by what a person can actually see in the
	// control label. Search aliases intentionally include source expressions,
	// preference keys, and compatibility words, none of which are relation
	// evidence. In particular, never let `i18n.ts.*` or a parent marker alias
	// manufacture a shared-term relation.
	const value = descriptor.label.trim();
	// Aliases are search affordances and have no provenance that they were
	// actually rendered to a person.  Relation evidence is label-only.
	if (/^(?:i18n|editor|draft|copy|model(?:Value)?|value|prefer|store)(?:[.\[]|$)/u.test(value)) return new Set();
	return new Set(normalizeSettingsSearchQueryV2(value)
		.split(/[^\p{Letter}\p{Number}]+/u)
		.filter(token => token.length >= 2 && !SETTINGS_SEARCH_STOPWORDS.has(token) && !/^(?:[a-z]+\.)+[a-z]+$/u.test(token)));
}

const SETTINGS_SEARCH_STOPWORDS = new Set([
	// Source-expression/internal vocabulary.
	'i18n', 'ts', 'editor', 'draft', 'copy', 'model', 'value', 'hata', 'settings', 'setting', 'preference', 'preferences', 'option', 'options',
	// Generic UI verbs/nouns do not prove two settings are meaningfully close.
	'show', 'hide', 'display', 'enable', 'enabled', 'disable', 'disabled', 'use', 'used', 'using', 'usage', 'function', 'feature', 'features', 'configure', 'configuration', 'config', 'toggle', 'on', 'off', 'general', 'other', 'custom', 'cherrypick', 'misskey', 'hataskey', 'hatasaba', 'ui',
	'設定', '項目', 'オプション', '表示', '有効', '無効', '利用', '使用', 'する', '機能', '変更', '選択', '内容', '詳細', 'その他', '全般', '一般', 'カスタム', 'オン', 'オフ',
]);

function preferenceKeyRelation(a: string, b: string): string | null {
	if (a === b) return a;
	const left = a.split(/[._]/u).filter(Boolean);
	const right = b.split(/[._]/u).filter(Boolean);
	let shared = 0;
	while (left[shared] != null && left[shared] === right[shared]) shared++;
	// A single broad namespace (for example `simpleUi`) has no useful topical
	// precision. A two-segment prefix is a meaningful relationship.
	return shared >= 2 ? left.slice(0, shared).join('.') : null;
}

function markerPath(descriptor: SettingsCatalogDescriptorV2): string[] {
	const ancestors = descriptor.legacyMarkerAncestorIds?.filter(Boolean) ?? [];
	if (ancestors.length > 0) return ancestors;
	return descriptor.legacyMarkerParentId == null ? [] : [descriptor.legacyMarkerParentId];
}

function deepestSharedMarker(a: SettingsCatalogDescriptorV2, b: SettingsCatalogDescriptorV2): { markerId: string; isRoot: boolean } | null {
	const aPath = markerPath(a);
	const bPath = markerPath(b);
	let shared = 0;
	while (aPath[shared] != null && aPath[shared] === bPath[shared]) shared++;
	if (shared === 0) return null;
	return { markerId: aPath[shared - 1], isRoot: shared === 1 };
}

function sharedRelationToken(a: SettingsCatalogDescriptorV2, b: SettingsCatalogDescriptorV2, tokens: ReadonlyMap<string, Set<string>>): string | null {
	return [...(tokens.get(a.stableId) ?? [])].find(token => (tokens.get(b.stableId) ?? new Set()).has(token)) ?? null;
}

const MAX_NESTED_MARKER_GROUP_MEMBERS = 8;
const MAX_NEARBY_FEATURE_DISTANCE = 6;
const FINITE_GROUP_PEER_FEATURES = new Set([
	'settings.semantic.feature.preference-profiles',
	'settings.semantic.feature.external-account-linking',
	'settings.semantic.feature.concrnt-linking',
	'settings.semantic.feature.mute-block',
	'settings.semantic.feature.plugin-install',
	'settings.semantic.feature.statusbar-editor',
	'settings.semantic.feature.theme-customization',
	'settings.semantic.feature.drive-cleaner',
	'settings.semantic.feature.mascot-display-settings',
	'settings.semantic.feature.emoji-palette',
]);

// Two source-local controls have no direct visible counterpart but do have an
// audited static host. Keep these exact parent links finite and reviewable.
const FINITE_FEATURE_RELATION_PAIRS = new Set([
	'settings.control.disablenotificationtoast-tiutzw\0settings.control.externalenabled-xrluci',
]);

function finiteFeatureRelationPair(a: SettingsCatalogDescriptorV2, b: SettingsCatalogDescriptorV2): boolean {
	return FINITE_FEATURE_RELATION_PAIRS.has(`${a.stableId}\0${b.stableId}`)
		|| FINITE_FEATURE_RELATION_PAIRS.has(`${b.stableId}\0${a.stableId}`);
}

type RelationCandidateIndexV2 = {
	byRoute: ReadonlyMap<string, ReadonlySet<string>>;
	bySemanticGroup: ReadonlyMap<string, ReadonlySet<string>>;
	bySourceSemanticGroup: ReadonlyMap<string, ReadonlySet<string>>;
	byMarker: ReadonlyMap<string, ReadonlySet<string>>;
	bySourceFile: ReadonlyMap<string, ReadonlySet<string>>;
	byPreferencePrefix: ReadonlyMap<string, ReadonlySet<string>>;
	byCategoryOwnerToken: ReadonlyMap<string, ReadonlySet<string>>;
	byStablePair: ReadonlyMap<string, ReadonlySet<string>>;
};

function addRelationIndexValue(index: Map<string, Set<string>>, key: string, stableId: string): void {
	if (key === '') return;
	const values = index.get(key) ?? new Set<string>();
	values.add(stableId);
	index.set(key, values);
}

function relationPreferencePrefixes(key: string): string[] {
	const segments = key.split(/[._]/u).filter(Boolean);
	return segments.length < 2 ? [] : segments.slice(0, -1).map((_, index) => segments.slice(0, index + 2).join('.'));
}

function buildRelationCandidateIndex(candidates: readonly SettingsCatalogDescriptorV2[]): RelationCandidateIndexV2 {
	const byRoute = new Map<string, Set<string>>();
	const bySemanticGroup = new Map<string, Set<string>>();
	const bySourceSemanticGroup = new Map<string, Set<string>>();
	const byMarker = new Map<string, Set<string>>();
	const bySourceFile = new Map<string, Set<string>>();
	const byPreferencePrefix = new Map<string, Set<string>>();
	const byCategoryOwnerToken = new Map<string, Set<string>>();
	const byStablePair = new Map<string, Set<string>>();
	const candidateIds = new Set(candidates.map(candidate => candidate.stableId));
	for (const candidate of candidates) {
		addRelationIndexValue(byRoute, candidate.route, candidate.stableId);
		for (const group of [candidate.semanticGroupId, candidate.sourceSemanticGroupId]) {
			if (group != null) addRelationIndexValue(bySemanticGroup, group, candidate.stableId);
		}
		// A group descriptor can itself be named by a member's
		// `semanticGroupId`. Index its stable ID so that semantic-group-peer
		// relations remain bounded by the candidate index.
		if (candidate.isGroup) addRelationIndexValue(bySemanticGroup, candidate.stableId, candidate.stableId);
		if (candidate.sourceSemanticGroupId != null) addRelationIndexValue(bySourceSemanticGroup, candidate.sourceSemanticGroupId, candidate.stableId);
		for (const markerId of markerPath(candidate)) addRelationIndexValue(byMarker, markerId, candidate.stableId);
		if (candidate.sourceFile != null) addRelationIndexValue(bySourceFile, candidate.sourceFile, candidate.stableId);
		for (const key of candidate.preferenceKeys) {
			for (const prefix of relationPreferencePrefixes(key)) addRelationIndexValue(byPreferencePrefix, prefix, candidate.stableId);
		}
		for (const token of relationTokens(candidate)) addRelationIndexValue(byCategoryOwnerToken, `${candidate.categoryId}\0${candidate.owner}\0${token}`, candidate.stableId);
	}
	for (const pair of FINITE_FEATURE_RELATION_PAIRS) {
		const [left, right] = pair.split('\0');
		if (candidateIds.has(left) && candidateIds.has(right)) {
			addRelationIndexValue(byStablePair, left, right);
			addRelationIndexValue(byStablePair, right, left);
		}
	}
	return { byRoute, bySemanticGroup, bySourceSemanticGroup, byMarker, bySourceFile, byPreferencePrefix, byCategoryOwnerToken, byStablePair };
}

function relationCandidateIds(index: RelationCandidateIndexV2, descriptor: SettingsCatalogDescriptorV2): Set<string> {
	const ids = new Set<string>();
	const add = (values: ReadonlySet<string> | undefined) => values?.forEach(value => ids.add(value));
	add(index.byStablePair.get(descriptor.stableId));
	for (const group of [descriptor.semanticGroupId, descriptor.sourceSemanticGroupId]) add(index.bySemanticGroup.get(group ?? ''));
	if (descriptor.sourceSemanticGroupId != null) add(index.bySourceSemanticGroup.get(descriptor.sourceSemanticGroupId));
	for (const markerId of markerPath(descriptor)) add(index.byMarker.get(markerId));
	if (descriptor.sourceFile != null) add(index.bySourceFile.get(descriptor.sourceFile));
	for (const key of descriptor.preferenceKeys) for (const prefix of relationPreferencePrefixes(key)) add(index.byPreferencePrefix.get(prefix));
	for (const token of relationTokens(descriptor)) add(index.byCategoryOwnerToken.get(`${descriptor.categoryId}\0${descriptor.owner}\0${token}`));
	if (descriptor.isGroup) add(index.bySemanticGroup.get(descriptor.stableId));
	// Route is an audited fallback key. relationEvidence still decides whether
	// the same route is meaningful, so this never manufactures a relation.
	if (ids.size === 0) add(index.byRoute.get(descriptor.route));
	ids.delete(descriptor.stableId);
	return ids;
}

function isExternalNotificationLabel(label: string): boolean {
	return /外部通知.*(?:popup|ポップアップ)/iu.test(label);
}

function isTimelineNotificationLabel(label: string): boolean {
	return /外部.*(?:タイムライン|TL|OLTL|OHTL)/iu.test(label);
}

function isKnownBadRelationPair(a: SettingsCatalogDescriptorV2, b: SettingsCatalogDescriptorV2): boolean {
	const pairs: readonly [RegExp, RegExp][] = [
		[/プライバシー/iu, /webhook/iu],
		[/cherrypick/iu, /ミュート/iu],
		[/ドライブ|drive/iu, /インスタンスミュート/iu],
		[/自動バックアップ|auto.?backup/iu, /プラグイン|plugin/iu],
		[/検索エンジン|search.?engine/iu, /半球|hemisphere/iu],
		[/検索エンジン|search.?engine/iu, /絵文字辞書|emoji.?dictionary/iu],
		[/言語|language|lang/iu, /リアルタイム|realtime/iu],
		[/言語|language|lang/iu, /プラグイン|plugin/iu],
		[/圧縮度|compression/iu, /透かし|ウォーターマーク|watermark/iu],
		[/圧縮度|compression/iu, /テーマ|theme/iu],
		[/デッキ|deck/iu, /サウンド|sounds?/iu],
		[/外部通知/iu, /(?:TL|OLTL|OHTL|タイムライン|ミュート)/iu],
	];
	return pairs.some(([left, right]) => (left.test(a.label) && right.test(b.label)) || (left.test(b.label) && right.test(a.label)));
}

/**
 * A related-settings list is deliberately bounded in the generated catalog.
 * The UI initially shows three, but keeping every member of a large semantic
 * group would serialise and offer dozens of weakly-distinguishable targets.
 * The deterministic sort below retains the strongest evidence first.
 */
export const MAX_RELATED_SETTINGS_V2 = 12;

function relationEvidence(
	a: SettingsCatalogDescriptorV2,
	b: SettingsCatalogDescriptorV2,
	tokens: ReadonlyMap<string, Set<string>>,
	markerMemberCounts: ReadonlyMap<string, number>,
	semanticMemberCounts: ReadonlyMap<string, number>,
	presentation?: SettingsCatalogPresentationV2,
): SettingsRelatedV2 | null {
	if (b.destructive) return null;
	if (isKnownBadRelationPair(a, b)) return null;
	const internalLabel = /^(?:i18n|editor|draft|copy|model(?:Value)?|value|prefer|store)(?:[.\[]|$)/u;
	if (internalLabel.test(a.label) || internalLabel.test(b.label)) return null;
	if (finiteFeatureRelationPair(a, b)) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
	}
	const sameMediaCompressionFeature = a.sourceSemanticGroupId === 'settings.semantic.feature.media-compression'
		&& b.sourceSemanticGroupId === 'settings.semantic.feature.media-compression';
	if (!sameMediaCompressionFeature && normalizeSettingsSearchQueryV2(a.label) !== '' && normalizeSettingsSearchQueryV2(a.label) === normalizeSettingsSearchQueryV2(b.label)) return null;
	const featureGroups = (descriptor: SettingsCatalogDescriptorV2): string[] => [descriptor.semanticGroupId, descriptor.sourceSemanticGroupId]
		.filter((group): group is string => group?.startsWith('settings.semantic.feature.') === true);
	const sharedFeatureGroup = featureGroups(a).find(group => featureGroups(b).includes(group));
	const pushSource = 'src/components/MkPushNotificationAllowButton.vue';
	if (sharedFeatureGroup === 'settings.semantic.feature.notification-delivery' && (a.sourceFile !== pushSource || b.sourceFile !== pushSource)) return null;
	// The external-account popup has one static parent and a separate toast
	// toggle. Keep that audited parent relationship, while refusing every
	// timeline-looking target from the same feature namespace.
	if (sharedFeatureGroup === 'settings.semantic.feature.external-account-linking'
		&& (isExternalNotificationLabel(a.label) || isExternalNotificationLabel(b.label))) {
		const toast = isExternalNotificationLabel(a.label) ? a : b;
		const target = toast === a ? b : a;
		if (target.preferenceKeys.includes('external.enabled')
			|| target.stableId === 'settings.fallback.settings-external-account') {
			return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
		}
		return null;
	}
	if (sharedFeatureGroup != null && a.sourceFile != null && a.sourceFile === b.sourceFile
		&& ((semanticMemberCounts.get(sharedFeatureGroup) ?? Number.POSITIVE_INFINITY) <= MAX_NESTED_MARKER_GROUP_MEMBERS
			|| relationDistance(a, b, 'sameFeature') <= MAX_NEARBY_FEATURE_DISTANCE)) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
	}
	if (sharedFeatureGroup != null && FINITE_GROUP_PEER_FEATURES.has(sharedFeatureGroup)
		&& (a.isGroup || b.isGroup)) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
	}
	if ((/^通知が既読になったらプッシュ通知を削除する$/u.test(a.label) || /^通知が既読になったらプッシュ通知を削除する$/u.test(b.label))
		&& (b.stableId === 'settings.group.notification-receive-config' || b.sourceFile === pushSource)) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
	}
	// A handful of source-local controls have a named, static feature host but
	// no local section marker. These identities are deliberately finite; do not
	// widen this to route/category fallback.
	if (sharedFeatureGroup === 'settings.semantic.feature.drive-cleaner'
		&& (a.isFallback || b.isFallback || a.stableId === 'settings.fallback.settings-drive-cleaner' || b.stableId === 'settings.fallback.settings-drive-cleaner')) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
	}
	// The Hatady popup has one save control and one static launcher host. Both
	// are the same named feature even though the host is generated from the
	// outer settings page rather than the popup SFC's source group.
	const isHatadyActivation = (activation: SettingsControlActivationV2 | undefined): boolean => activation?.kind === 'popup'
		? activation.popup === 'hatady'
		: activation?.kind === 'hata-custom-category' && activation.category === 'hatady';
	if (isHatadyActivation(a.activation) && isHatadyActivation(b.activation)) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
	}
	if (a.sourceFile === 'src/components/HatadyDisplaySettings.vue' && b.activation?.kind === 'hata-custom-category' && b.activation.category === 'hatady') {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameFeature', reason: relationReasonV2('sameFeature', presentation), weight: 1.05 };
	}
	const sameSemanticGroup = a.semanticGroupId != null && a.semanticGroupId === b.semanticGroupId;
	const isSemanticGroupPeer = a.semanticGroupId === b.stableId || b.semanticGroupId === a.stableId;
	const nearestA = a.legacyMarkerParentId ?? markerPath(a).at(-1);
	const nearestB = b.legacyMarkerParentId ?? markerPath(b).at(-1);
	const commonMarker = deepestSharedMarker(a, b);
	const brandOnly = /^(?:CherryPick|Misskey|Hataskey|Hatasaba|UI)$/iu;
	const sharedToken = a.label.length <= 80 && b.label.length <= 80 && a.categoryId === b.categoryId && a.owner === b.owner && !brandOnly.test(a.label.trim()) && !brandOnly.test(b.label.trim()) && !internalLabel.test(b.label)
		? sharedRelationToken(a, b, tokens)
		: null;
	const preferenceRelation = a.preferenceKeys.flatMap(left => b.preferenceKeys.map(right => preferenceKeyRelation(left, right))).find((value): value is string => value != null);
	if (nearestA != null && nearestA === nearestB && commonMarker?.isRoot !== true && ((markerMemberCounts.get(nearestA) ?? Number.POSITIVE_INFINITY) <= MAX_NESTED_MARKER_GROUP_MEMBERS || relationDistance(a, b, 'sameGroup') <= 3)) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameGroup', reason: relationReasonV2('sameGroup', presentation), weight: 1 };
	}
	if (commonMarker != null && !commonMarker.isRoot && (markerMemberCounts.get(commonMarker.markerId) ?? Number.POSITIVE_INFINITY) <= MAX_NESTED_MARKER_GROUP_MEMBERS && (preferenceRelation != null || sharedToken != null)) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameNestedGroup', reason: relationReasonV2('sameNestedGroup', presentation), weight: 0.9 };
	}
	const sameSourceSection = a.sourceFile != null && a.sourceFile === b.sourceFile
		&& a.sourceLine != null && b.sourceLine != null
		&& (Math.abs(a.sourceLine - b.sourceLine) <= 3 || sharedToken != null || preferenceRelation != null);
	const sharedSemanticId = sameSemanticGroup ? a.semanticGroupId : isSemanticGroupPeer ? (a.semanticGroupId === b.stableId ? a.semanticGroupId : b.semanticGroupId) : undefined;
	if ((sameSemanticGroup || isSemanticGroupPeer) && sharedSemanticId != null && ((semanticMemberCounts.get(sharedSemanticId) ?? Number.POSITIVE_INFINITY) <= MAX_NESTED_MARKER_GROUP_MEMBERS || sameSourceSection) && sameSourceSection) {
		return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sameSection', reason: relationReasonV2('sameSection', presentation), weight: 0.8 };
	}
	if (preferenceRelation != null) return { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'samePreference', reason: relationReasonV2('samePreference', presentation), weight: 0.7 };
	return sharedToken == null ? null : { stableId: b.stableId, kind: 'sameTopic', reasonKey: 'sharedVisibleTerm', reason: relationReasonV2('sharedVisibleTerm', presentation), weight: 0.6 };
}

function relationDistance(a: SettingsCatalogDescriptorV2, b: SettingsCatalogDescriptorV2, reasonKey?: SettingsRelationReasonKeyV2): number {
	if (reasonKey !== 'sameSection' && reasonKey !== 'sameGroup' && reasonKey !== 'sameNestedGroup' && reasonKey !== 'sameFeature') return Number.POSITIVE_INFINITY;
	if (a.sourceFile == null || a.sourceFile !== b.sourceFile || a.sourceLine == null || b.sourceLine == null) return Number.POSITIVE_INFINITY;
	return Math.abs(a.sourceLine - b.sourceLine);
}

function relationTargetIsAvailable(source: SettingsCatalogDescriptorV2, target: SettingsCatalogDescriptorV2): boolean {
	// Manifest destinations are deliberately navigation-only: showing them in
	// ordinary search duplicates the control result, but they remain valid as
	// an explicit related-setting destination.
	return (target.searchable || target.source === 'destination')
		&& !target.destructive
		&& availabilityCovers(source.availability, target.availability)
		&& applicableUiCovers(source.applicableUi, target.applicableUi);
}

/** A relation must alter the visible destination, not just reopen the current control. */
function relationNavigationIsNoop(source: SettingsCatalogDescriptorV2, target: SettingsCatalogDescriptorV2): boolean {
	if (source.route !== target.route) return false;
	// A control or group in the same route can still focus a distinct, useful
	// setting. Only manifest navigation targets are no-ops when they resolve to
	// the destination that already contains the source control.
	return target.source === 'destination'
		&& source.destinationId != null
		&& source.destinationId === target.destinationId;
}

function auditedNoRelatedReason(descriptor: SettingsCatalogDescriptorV2, presentation?: SettingsCatalogPresentationV2): string {
	if (descriptor.isFallback) return noRelatedReasonV2('fallback', presentation);
	if (markerPath(descriptor).length > 0) return noRelatedReasonV2('marker', presentation);
	return noRelatedReasonV2('default', presentation);
}

/** Reject broken related-target metadata before it can reach a navigation surface. */
export function assertSettingsCatalogRelationsV2(catalog: Pick<SettingsCatalogV2, 'descriptors' | 'byStableId'>): void {
	const missingControlRelations: SettingsCatalogDescriptorV2[] = [];
	for (const descriptor of catalog.descriptors) {
		const validateTargets = (targets: string[]) => {
			const seen = new Set<string>();
			for (const stableId of targets) {
				if (stableId === descriptor.stableId) throw new Error(`Settings relation cannot refer to itself: ${stableId}`);
				if (seen.has(stableId)) throw new Error(`Duplicate settings relation target: ${descriptor.stableId} -> ${stableId}`);
				const target = catalog.byStableId.get(stableId);
				if (target == null) throw new Error(`Unknown settings relation target: ${descriptor.stableId} -> ${stableId}`);
				if (!relationTargetIsAvailable(descriptor, target)) throw new Error(`Unavailable settings relation target: ${descriptor.stableId} -> ${stableId}`);
				if (relationNavigationIsNoop(descriptor, target)) throw new Error(`Settings relation cannot reopen the current destination: ${descriptor.stableId} -> ${stableId}`);
				seen.add(stableId);
			}
		};
		validateTargets(descriptor.relatedIds);
		const relationTargets = descriptor.related.map(relation => relation.stableId);
		validateTargets(relationTargets);
		if (relationTargets.length !== descriptor.relatedIds.length || relationTargets.some((stableId, index) => stableId !== descriptor.relatedIds[index])) {
			throw new Error(`Settings relation metadata is inconsistent: ${descriptor.stableId}`);
		}
		if (descriptor.relatedTotal != null && (descriptor.relatedTotal < relationTargets.length || !Number.isSafeInteger(descriptor.relatedTotal))) {
			throw new Error(`Settings relation total is invalid: ${descriptor.stableId}`);
		}
		// Generated controls always declare the exact related-display host.  Small
		// compatibility fixtures without that host predate the source inventory;
		// they remain usable as search-unit fixtures, while the real generator
		// cannot bypass this relation contract.
		if (descriptor.source === 'control' && descriptor.relatedHostId != null && descriptor.searchable && !descriptor.destructive && relationTargets.length === 0 && !descriptor.noRelatedReason) missingControlRelations.push(descriptor);
		if (descriptor.source !== 'control' && descriptor.searchable && !descriptor.destructive && relationTargets.length === 0 && !descriptor.noRelatedReason) {
			throw new Error(`Settings searchable descriptor has no audited relation disposition: ${descriptor.stableId}`);
		}
		if (relationTargets.length > 0 && descriptor.noRelatedReason != null) {
			throw new Error(`Settings relation metadata contradicts audited absence: ${descriptor.stableId}`);
		}
	}
	if (missingControlRelations.length > 0) {
		throw new Error(`Settings searchable control has no meaningful relation:\n${missingControlRelations.map(descriptor => `${descriptor.stableId} | ${descriptor.label} | ${descriptor.sourceFile ?? descriptor.route}`).join('\n')}`);
	}
}

function primaryLegacyAliases(route: string, label: string, aliases: readonly string[]): string[] {
	// `pasuki` is the dedicated passkey/security-key landing, not the adjacent
	// password-less-login toggle. Keep it narrow so the literal `2FA` marker
	// remains the first result for an actual 2FA query.
	return route === '/settings/security' && label === 'パスキー' && aliases.includes('pasuki') ? ['pasuki'] : [];
}

/**
 * Merge legacy markers with the control-level inventory. Control ids are
 * already stable at generation time, so they intentionally pass through
 * unchanged. Legacy markers remain addressable for hashes and old pages, but
 * a marker that contains a searchable control is not also a search result.
 */
export function buildSettingsCatalogV2(
	searchIndex: SearchIndexItem[],
	controlItems: SettingsControlCatalogInputV2[] = [],
	presentation?: SettingsCatalogPresentationV2,
	destinationItems: SettingsDestinationCatalogItemV2[] = [],
	canonicalStableIdByLegacyStableId: ReadonlyMap<string, string> = new Map(),
): SettingsCatalogV2 {
	const byLegacyId = new Map<string, SearchIndexItem>();
	for (const item of searchIndex) {
		if (byLegacyId.has(item.id)) throw new Error(`Duplicate legacy settings search id: ${item.id}`);
		byLegacyId.set(item.id, item);
	}

	const descriptors: SettingsCatalogDescriptorV2[] = [];
	const stableIds = new Set<string>();
	// A control replaces only its exact nearest legacy marker. Ancestors and
	// sibling action markers remain independently searchable.
	const controlMarkerParents = new Set(controlItems.flatMap(item => item.legacyMarkerParentId == null ? [] : [item.legacyMarkerParentId]));
	const legacyIsCoveredByControl = (item: SearchIndexItem) => controlMarkerParents.has(item.id);
	for (const item of searchIndex) {
		const resolved = resolveRoute(item, byLegacyId);
		const route = resolved.route;
		const parentLabels = resolveParentLabels(item, byLegacyId);
		const label = humanize(item.label);
		const aliases = unique([
			...item.keywords,
			...keywordAliases(item.keywords),
			...item.texts.flatMap(text => [humanize(text), ...knownAliases(text)]),
			...knownAliases(item.label),
			...parentLabels,
		]);
		const preferenceKeys = unique([
			...item.keywords.filter(key => /[._]/u.test(key)),
			...(route === '/settings/preferences' ? [expressionKey(item.label)] : []),
		]);
		const category = categoryFor(route, `${label} ${aliases.join(' ')}`, {}, presentation);
		const primaryAliases = primaryLegacyAliases(route, label, aliases);
		const stableId = stableIdFor(item, route, parentLabels);
		if (stableIds.has(stableId)) throw new Error(`Duplicate stable settings search id: ${stableId}`);
		stableIds.add(stableId);
		descriptors.push({
			stableId,
			legacyId: item.id,
			source: 'legacy',
			searchable: !legacyIsCoveredByControl(item) && resolved.routeExclusionReason == null,
			route,
			anchor: item.id,
			sourceRoute: resolved.sourceRoute,
			...(resolved.routeExclusionReason ? { routeExclusionReason: resolved.routeExclusionReason } : {}),
			label,
			description: item.texts.length > 0 ? humanize(item.texts[0]) : undefined,
			icon: item.icon,
			categoryId: category.id,
			categoryLabel: category.label,
			aliases,
			...(primaryAliases.length ? { primaryAliases } : {}),
			legacyLabels: unique([item.label, ...item.texts]),
			preferenceKeys,
			...metadataForLegacyDescriptor(route),
			...(LEGACY_ROUTE_SEMANTIC_GROUPS[route] ? { semanticGroupId: LEGACY_ROUTE_SEMANTIC_GROUPS[route] } : {}),
			relatedIds: [],
			related: [],
			destructive: isDestructive({ label, aliases, description: item.texts[0] }),
			searchRank: item.parentId == null ? 0 : 1,
		});
	}

	for (const item of destinationItems) {
		if (stableIds.has(item.stableId)) throw new Error(`Duplicate stable settings search id: ${item.stableId}`);
		if (!validRoute(item.route)) throw new Error(`Invalid settings route: ${item.route}`);
		stableIds.add(item.stableId);
		const category = item.categoryId != null
			? { id: item.categoryId, label: categoryLabelV2(item.categoryId, presentation) }
			: categoryFor(item.route, `${item.label} ${item.aliases.join(' ')}`, {}, presentation);
		descriptors.push({
			stableId: item.stableId,
			source: 'destination',
			destinationId: item.destinationId,
			...(item.anchor ? { anchor: item.anchor } : {}),
			...(item.controlId ? { controlId: item.controlId } : {}),
			...(item.focusId ? { focusId: item.focusId } : {}),
			...(item.activation ? { activation: item.activation } : {}),
			// A destination is an explicit relation target, not a duplicate direct
			// result for each control that is rendered inside it.
			searchable: false,
			route: item.route,
			label: item.label,
			...(item.icon ? { icon: item.icon } : {}),
			categoryId: category.id,
			categoryLabel: category.label,
			aliases: unique([...item.aliases, item.destinationId]),
			legacyLabels: [],
			preferenceKeys: [],
			persistence: item.persistence,
			saveMode: item.saveMode,
			availability: item.availability,
			owner: item.owner,
			applicableUi: item.applicableUi,
			metadataEvidence: item.metadataEvidence,
			relatedIds: [],
			related: [],
			destructive: false,
			searchRank: 1,
		});
	}

	for (const item of controlItems) {
		if (stableIds.has(item.stableId)) throw new Error(`Duplicate stable settings search id: ${item.stableId}`);
		if (!validRoute(item.route)) throw new Error(`Invalid settings route: ${item.route}`);
		stableIds.add(item.stableId);
		const aliases = unique([
			...item.aliases,
			...(item.stableId === 'settings.group.security-key-runtime-settings' ? ['2段階'] : []),
			...item.preferenceKeys,
			...item.aliases.flatMap(alias => [...knownAliases(alias), ...keywordAliases([alias])]),
			...knownAliases(item.label),
			...keywordAliases([item.label]),
		]);
		const category = item.categoryId != null
			? { id: item.categoryId, label: categoryLabelV2(item.categoryId, presentation) }
			: categoryFor(item.route, `${item.label} ${aliases.join(' ')}`, item, presentation);
		descriptors.push({
			stableId: item.stableId,
			controlId: item.focusId ?? item.stableId,
			...(item.legacyMarkerParentId ? { legacyMarkerParentId: item.legacyMarkerParentId } : {}),
			...(item.legacyMarkerParentId ? { anchor: item.legacyMarkerParentId } : {}),
			...(item.activation ? { activation: item.activation } : {}),
			...(item.focusId ? { focusId: item.focusId } : {}),
			...(item.unmet?.length ? { unmet: item.unmet } : {}),
			source: 'control',
			...(item.destinationId ? { destinationId: item.destinationId } : {}),
			sourceFile: item.sourceFile,
			sourceLine: item.sourceLine,
			searchable: true,
			...(item.legacyMarkerAncestorIds?.length ? { legacyMarkerAncestorIds: [...item.legacyMarkerAncestorIds] } : {}),
			...(item.semanticGroupId ? { semanticGroupId: item.semanticGroupId } : {}),
			...(item.sourceSemanticGroupId ? { sourceSemanticGroupId: item.sourceSemanticGroupId } : {}),
			...(item.isGroup ? { isGroup: true } : {}),
			route: item.route,
			label: item.label,
			description: item.description,
			categoryId: category.id,
			categoryLabel: category.label,
			aliases,
			...(item.primaryAliases?.length || item.stableId === 'settings.group.security-key-runtime-settings' ? {
				primaryAliases: unique([...(item.primaryAliases ?? []), ...(item.stableId === 'settings.group.security-key-runtime-settings' ? ['2段階', '2FA'] : [])]),
			} : {}),
			legacyLabels: [],
			preferenceKeys: unique(item.preferenceKeys),
			...metadataForControlDescriptor(item),
			relatedIds: [],
			related: [],
			destructive: item.destructive,
			...(item.relationDestinationId ? { relationDestinationId: item.relationDestinationId } : {}),
			relatedHostId: item.relatedHostId,
			// The security section is the broad 2FA landing. Direct passkey
			// wording should keep the existing legacy marker ahead of it; the
			// curated `2段階` primary alias still ranks this group first for the
			// migration query.
			searchRank: item.stableId === 'settings.group.security-key-runtime-settings' ? 2 : 0,
		});
	}

	// A legacy hash may land on a marker which has moved behind a category or
	// popup.  Inherit the activation only from an exact nearest marker, falling
	// back to descendants when that is the sole provable path.  A marker with
	// more than one activation deliberately remains route-only: defaulting it
	// to glassUi (or any other category) would make a deep link look successful
	// while focusing a hidden, unrelated setting.
	const exactActivationByLegacyId = new Map<string, SettingsControlCatalogInputV2['activation'][]>();
	const ancestorActivationByLegacyId = new Map<string, SettingsControlCatalogInputV2['activation'][]>();
	for (const item of controlItems) {
		if (item.activation == null) continue;
		if (item.legacyMarkerParentId != null) {
			const values = exactActivationByLegacyId.get(item.legacyMarkerParentId) ?? [];
			values.push(item.activation);
			exactActivationByLegacyId.set(item.legacyMarkerParentId, values);
		}
		for (const markerId of item.legacyMarkerAncestorIds ?? []) {
			const values = ancestorActivationByLegacyId.get(markerId) ?? [];
			values.push(item.activation);
			ancestorActivationByLegacyId.set(markerId, values);
		}
	}
	for (const legacy of descriptors.filter(descriptor => descriptor.source === 'legacy' && descriptor.legacyId != null)) {
		const exact = exactActivationByLegacyId.get(legacy.legacyId!) ?? [];
		const candidates = exact.length > 0
			? exact
			: ancestorActivationByLegacyId.get(legacy.legacyId!) ?? [];
		const activationByIdentity = new Map<string, SettingsControlActivationV2>();
		for (const activation of candidates) {
			if (activation == null) continue;
			activationByIdentity.set(JSON.stringify(activation), activation);
		}
		if (activationByIdentity.size === 1) {
			legacy.activation = [...activationByIdentity.values()][0];
		} else if (activationByIdentity.size > 1) {
			legacy.activationUnavailableReason = presentation?.activationUnavailableReason ?? (presentation == null
				? '複数の設定カテゴリまたはポップアップにまたがるため、旧リンクから自動で開く先を決められない'
				: 'This legacy link spans multiple settings categories or popups, so its destination cannot be opened automatically');
		}
	}

	const existingRoutes = new Set(searchIndex.flatMap(item => item.path == null ? [] : [canonicalRoute(item.path)]));
	for (const [sourceRoute, navigationRoute] of FALLBACKS) {
		if (existingRoutes.has(sourceRoute)) continue;
		const descriptor = fallbackDescriptor(sourceRoute, navigationRoute, presentation);
		if (stableIds.has(descriptor.stableId)) continue;
		stableIds.add(descriptor.stableId);
		descriptors.push({ ...descriptor, relatedIds: [], related: [] });
	}

	const descriptorById = new Map(descriptors.map(descriptor => [descriptor.stableId, descriptor]));
	const destinationById = new Map<string, SettingsCatalogDescriptorV2>();
	for (const descriptor of descriptors) {
		if (descriptor.source !== 'destination' || descriptor.destinationId == null) continue;
		if (destinationById.has(descriptor.destinationId)) throw new Error(`Duplicate settings destination id: ${descriptor.destinationId}`);
		destinationById.set(descriptor.destinationId, descriptor);
	}
	for (const descriptor of descriptors) {
		if (descriptor.label.length > 80 || /^(?:i18n|editor|draft|copy|model(?:Value)?|value|prefer|store)(?:[.\[]|$)/u.test(descriptor.label)) descriptor.searchable = false;
	}
	for (const descriptor of descriptors) {
		if (descriptor.relationDestinationId == null) continue;
		const destination = destinationById.get(descriptor.relationDestinationId);
		if (destination == null) throw new Error(`Unknown settings relation destination: ${descriptor.stableId} -> ${descriptor.relationDestinationId}`);
		if (!relationTargetIsAvailable(descriptor, destination)) throw new Error(`Unavailable settings relation destination: ${descriptor.stableId} -> ${descriptor.relationDestinationId}`);
	}
	const relatedCandidates = descriptors.filter(descriptor => descriptor.source !== 'destination' && descriptor.searchable && !descriptor.destructive);
	const relationTokenMap = new Map(descriptors.map(descriptor => [descriptor.stableId, relationTokens(descriptor)]));
	const relationCandidateIndex = buildRelationCandidateIndex(relatedCandidates);
	const markerMemberCounts = new Map<string, number>();
	const semanticMemberCounts = new Map<string, number>();
	for (const descriptor of relatedCandidates) {
		for (const markerId of new Set(markerPath(descriptor))) markerMemberCounts.set(markerId, (markerMemberCounts.get(markerId) ?? 0) + 1);
		for (const groupId of [descriptor.semanticGroupId, descriptor.sourceSemanticGroupId].filter((value): value is string => value != null)) semanticMemberCounts.set(groupId, (semanticMemberCounts.get(groupId) ?? 0) + 1);
	}
	for (const descriptor of descriptors) {
		if (!descriptor.searchable || descriptor.destructive) {
			descriptor.related = [];
			descriptor.relatedIds = [];
			descriptor.relatedTotal = 0;
			continue;
		}
		if (descriptor.source === 'destination') {
			descriptor.related = [];
			descriptor.relatedIds = [];
			descriptor.relatedTotal = 0;
			descriptor.noRelatedReason = auditedNoRelatedReason(descriptor, presentation);
			continue;
		}
		const candidateDescriptors = [...relationCandidateIds(relationCandidateIndex, descriptor)].map(id => descriptorById.get(id)).filter((candidate): candidate is SettingsCatalogDescriptorV2 => candidate != null);
		const relations = candidateDescriptors
			.filter(candidate => candidate.stableId !== descriptor.stableId
				&& relationTargetIsAvailable(descriptor, candidate)
				&& !relationNavigationIsNoop(descriptor, candidate))
			.map(candidate => relationEvidence(descriptor, candidate, relationTokenMap, markerMemberCounts, semanticMemberCounts, presentation))
			.filter((relation): relation is SettingsRelatedV2 => relation != null)
			.sort((left, right) => {
				const weight = right.weight - left.weight;
				if (weight !== 0) return weight;
				const leftTarget = descriptorById.get(left.stableId)!;
				const rightTarget = descriptorById.get(right.stableId)!;
				const distance = relationDistance(descriptor, leftTarget, left.reasonKey) - relationDistance(descriptor, rightTarget, right.reasonKey);
				return distance || left.stableId.localeCompare(right.stableId);
			});
		// An explicit manifest destination is a last resort. Existing source, marker,
		// feature, preference, and visible-term evidence always outranks it.
		if (relations.length === 0 && descriptor.relationDestinationId != null) {
			const destination = destinationById.get(descriptor.relationDestinationId);
			if (destination != null && destination.stableId !== descriptor.stableId
				&& relationTargetIsAvailable(descriptor, destination)
				&& !isKnownBadRelationPair(descriptor, destination)
				&& !relationNavigationIsNoop(descriptor, destination)) {
				relations.push({ stableId: destination.stableId, kind: 'fallback', reasonKey: 'sameSection', reason: relationReasonV2('sameSection', presentation), weight: 0.5 });
			}
		}
		if (relations.length === 0 && descriptor.source === 'control' && (descriptor.relatedHostId != null || descriptor.sourceFile?.startsWith('src/') === true)) {
			const fallback = candidateDescriptors
				.filter(candidate => candidate.stableId !== descriptor.stableId && relationTargetIsAvailable(descriptor, candidate)
					&& !isKnownBadRelationPair(descriptor, candidate)
					&& normalizeSettingsSearchQueryV2(candidate.label) !== normalizeSettingsSearchQueryV2(descriptor.label)
					&& !(isExternalNotificationLabel(descriptor.label) && isTimelineNotificationLabel(candidate.label))
					&& (candidate.stableId === descriptor.semanticGroupId || (candidate.legacyId != null && [descriptor.legacyMarkerParentId, ...(descriptor.legacyMarkerAncestorIds ?? [])].filter((value): value is string => value != null).includes(candidate.legacyId))))
				.sort((left, right) => Math.abs((left.sourceLine ?? Number.MAX_SAFE_INTEGER) - (descriptor.sourceLine ?? Number.MAX_SAFE_INTEGER)) - Math.abs((right.sourceLine ?? Number.MAX_SAFE_INTEGER) - (descriptor.sourceLine ?? Number.MAX_SAFE_INTEGER)) || left.stableId.localeCompare(right.stableId))[0]
				;
			if (fallback != null) relations.push({ stableId: fallback.stableId, kind: 'sameTopic', reasonKey: 'sameSection', reason: relationReasonV2('sameSection', presentation), weight: 0.5 });
		}
		const uniqueRelations = relations.filter((relation, index, all) => all.findIndex(other => other.stableId === relation.stableId) === index && descriptorById.has(relation.stableId));
		descriptor.relatedTotal = uniqueRelations.length;
		descriptor.related = uniqueRelations.slice(0, MAX_RELATED_SETTINGS_V2);
		descriptor.relatedIds = descriptor.related.map(relation => relation.stableId);
		if (descriptor.related.length === 0) descriptor.noRelatedReason = auditedNoRelatedReason(descriptor, presentation);
	}

	for (const [legacyStableId, canonicalStableId] of canonicalStableIdByLegacyStableId) {
		if (legacyStableId === canonicalStableId) throw new Error(`Settings stable-id alias cannot refer to itself: ${legacyStableId}`);
		if (descriptorById.has(legacyStableId)) throw new Error(`Settings stable-id alias source is still searchable: ${legacyStableId}`);
		if (!descriptorById.has(canonicalStableId)) throw new Error(`Settings stable-id alias target is missing: ${legacyStableId} -> ${canonicalStableId}`);
	}
	const catalog = {
		descriptors,
		items: descriptors,
		byStableId: descriptorById,
		byLegacyId: new Map(descriptors.flatMap(descriptor => descriptor.legacyId == null ? [] : [[descriptor.legacyId, descriptor] as const])),
		canonicalStableIdByLegacyStableId,
		fallbackRoutes: descriptors.flatMap(descriptor => descriptor.isFallback && descriptor.sourceRoute != null ? [descriptor.sourceRoute] : []),
	};
	if (new Set(catalog.fallbackRoutes).size !== catalog.fallbackRoutes.length) throw new Error('Duplicate settings fallback route');
	assertSettingsCatalogRelationsV2(catalog);
	return catalog;
}

/** Resolve a removed runtime control id without polluting the canonical descriptor map. */
export function canonicalStableIdForCatalogV2(catalog: Pick<SettingsCatalogV2, 'canonicalStableIdByLegacyStableId'>, stableId: string): string {
	return catalog.canonicalStableIdByLegacyStableId.get(stableId) ?? stableId;
}

type SearchFieldCacheV2 = {
	label: string;
	aliases: string[];
	primaryAliases: string[];
	preferenceKeys: string[];
	description: string;
	fields: string[];
	fieldHiragana: string[];
};

const searchCatalogCacheV2 = new WeakMap<SettingsCatalogV2, Map<string, SearchFieldCacheV2>>();

function getSearchCatalogCacheV2(catalog: SettingsCatalogV2): Map<string, SearchFieldCacheV2> {
	const existing = searchCatalogCacheV2.get(catalog);
	if (existing != null) return existing;
	const cache = new Map<string, SearchFieldCacheV2>();
	for (const descriptor of catalog.descriptors) {
		const label = normalizeSettingsSearchQueryV2(descriptor.label);
		const aliases = descriptor.aliases.map(normalizeSettingsSearchQueryV2);
		const primaryAliases = descriptor.primaryAliases?.map(normalizeSettingsSearchQueryV2) ?? [];
		const preferenceKeys = descriptor.preferenceKeys.map(normalizeSettingsSearchQueryV2);
		const description = normalizeSettingsSearchQueryV2(descriptor.description ?? '');
		const fields = [label, ...aliases, ...primaryAliases, ...preferenceKeys, description];
		cache.set(descriptor.stableId, { label, aliases, primaryAliases, preferenceKeys, description, fields, fieldHiragana: fields.map(normalizeStringWithHiragana) });
	}
	searchCatalogCacheV2.set(catalog, cache);
	return cache;
}

function scoreMatch(queryTokens: string[], tokenHiragana: string[], whole: string, cached: SearchFieldCacheV2): { score: number; kind: SettingsMatchKindV2 } | null {
	const includes = (field: string, fieldHiragana: string, token: string, tokenHiraganaValue: string) => field.includes(token) || fieldHiragana.includes(tokenHiraganaValue);
	const hasToken = (token: string, tokenHiraganaValue: string) => cached.fields.some((field, index) => includes(field, cached.fieldHiragana[index], token, tokenHiraganaValue));
	if (!queryTokens.every((token, index) => hasToken(token, tokenHiragana[index]))) return null;
	// Product migration aliases are different from generic keyword aliases: an
	// exact old tab name must reopen its audited category, not an unrelated
	// control which happens to mention those two letters.
	if (cached.primaryAliases.some(alias => alias === whole || compareStringEquals(alias, whole))) return { score: 1100, kind: 'alias' };
	if (cached.label === whole) return { score: 1000, kind: 'labelExact' };
	if (cached.label.startsWith(whole)) return { score: 900, kind: 'labelPrefix' };
	if (cached.label.includes(whole)) return { score: 800, kind: 'labelIncludes' };
	if (queryTokens.every(token => cached.label === token)) return { score: 1000, kind: 'labelExact' };
	if (queryTokens.every(token => cached.aliases.some(alias => alias === token))) return { score: 750, kind: 'alias' };
	if (queryTokens.every(token => cached.aliases.some(alias => alias.startsWith(token)))) return { score: 700, kind: 'alias' };
	if (queryTokens.every((token, index) => cached.aliases.some((alias, aliasIndex) => includes(alias, cached.fieldHiragana[1 + aliasIndex], token, tokenHiragana[index])))) return { score: 650, kind: 'alias' };
	if (queryTokens.every((token, index) => cached.preferenceKeys.some((key, keyIndex) => includes(key, cached.fieldHiragana[1 + cached.aliases.length + cached.primaryAliases.length + keyIndex], token, tokenHiragana[index])))) return { score: 600, kind: 'preferenceKey' };
	return { score: 500, kind: 'description' };
}

function editDistance(a: string, b: string, maxDistance = 2): number {
	const left = [...a];
	const right = [...b];
	if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;
	const row = right.map((_, index) => index + 1);
	row.unshift(0);
	for (let i = 0; i < left.length; i++) {
		let diagonal = row[0];
		row[0] = i + 1;
		let minimum = row[0];
		for (let j = 0; j < right.length; j++) {
			const above = row[j + 1];
			row[j + 1] = left[i] === right[j] ? diagonal : Math.min(row[j + 1] + 1, row[j] + 1, diagonal + 1);
			diagonal = above;
			minimum = Math.min(minimum, row[j + 1]);
		}
		if (minimum > maxDistance) return maxDistance + 1;
	}
	return row[right.length];
}

function commonPrefixLength(a: string, b: string): number {
	let length = 0;
	while (a[length] != null && a[length] === b[length]) length++;
	return length;
}

/**
 * 旗鯖fork: 表示名を突き合わせ用に均す。
 * ⚠️IDが違っても利用者には同じ名前に見える。名前でも弾かないと重複して並ぶ。
 */
function settingsLabelKeyV2(label: string): string {
	return normalizeSettingsSearchQueryV2(label);
}

export function searchSettingsV2(catalog: SettingsCatalogV2, query: string, options: SettingsSearchOptionsV2 = {}): SettingsSearchResponseV2 {
	const normalizedQuery = normalizeSettingsSearchQueryV2(query);
	if (normalizedQuery === '') return { results: [], totalResults: 0, suggestions: [], normalizedQuery };
	const queryTokens = normalizedQuery.split(' ').filter(Boolean);
	const tokenHiragana = queryTokens.map(normalizeStringWithHiragana);
	const whole = queryTokens.join(' ');
	const searchCache = getSearchCatalogCacheV2(catalog);
	const limit = Math.max(0, options.limit ?? 20);
	const suggestionsLimit = Math.max(0, options.suggestionsLimit ?? 3);
	const matches = catalog.descriptors.filter(descriptor => descriptor.searchable).flatMap(descriptor => {
		const match = scoreMatch(queryTokens, tokenHiragana, whole, searchCache.get(descriptor.stableId)!);
		if (!match) return [];
		// Destructive entries need a direct enough match; generic descriptions must not promote them.
		if (descriptor.destructive && match.score < 700) return [];
		return [decorate(descriptor, match.score, match.kind)];
	}).sort((a, b) => b.score - a.score || a.searchRank - b.searchRank || a.stableId.localeCompare(b.stableId));
	const results = options.suggestionsOnly ? [] : matches.slice(0, limit);
	if (options.includeSuggestions === false) return { results, totalResults: matches.length, suggestions: [], normalizedQuery };
	const resultIds = new Set(results.map(result => result.stableId));
	// ⚠️「こちらをお探しですか」に、結果と同じ名前をもう一度出さない。
	const shownLabels = new Set(results.map(result => settingsLabelKeyV2(result.label)).filter(key => key !== ''));
	const suggestions: SettingsSearchResultV2[] = [];
	if (options.suggestionsOnly) {
		// A destructive action is only returned as an explicit direct result.
		// Suggestions-only mode is used for predictions and related navigation,
		// neither of which may surface an action that could destroy data/session.
		for (const match of matches.filter(match => !match.destructive).slice(0, suggestionsLimit)) suggestions.push({ ...match, matchKind: 'related' });
	}
	if (matches.length === 0 || options.suggestionsOnly) {
		const predictions: Array<{ descriptor: SettingsCatalogDescriptorV2; score: number }> = [];
		for (const descriptor of catalog.descriptors.filter(item => item.searchable)) {
			const cached = searchCache.get(descriptor.stableId)!;
			const fields = [cached.label, ...cached.aliases, ...cached.preferenceKeys];
			const evidence = queryTokens.map(token => {
				const distances = fields.filter(field => field.length >= 3).map(field => editDistance(token, field, 2));
				const distance = distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY;
				const prefix = fields.some(field => commonPrefixLength(token, field) >= Math.max(3, token.length - 2));
				return { distance, prefix };
			});
			if (evidence.every(item => item.distance <= 2 || item.prefix) && !descriptor.destructive && !suggestions.some(suggestion => suggestion.stableId === descriptor.stableId)) {
				predictions.push({ descriptor, score: 250 - evidence.reduce((total, item) => total + Math.min(item.distance, 50), 0) });
			}
		}
		predictions.sort((a, b) => b.score - a.score || a.descriptor.searchRank - b.descriptor.searchRank || a.descriptor.stableId.localeCompare(b.descriptor.stableId));
		for (const prediction of predictions.slice(0, suggestionsLimit)) {
			if (!suggestions.some(suggestion => suggestion.stableId === prediction.descriptor.stableId)) suggestions.push(decorate(prediction.descriptor, prediction.score, 'related'));
		}
	}
	for (const result of results) {
		for (const relatedId of result.relatedIds) {
			if (resultIds.has(relatedId) || suggestions.some(suggestion => suggestion.stableId === relatedId)) continue;
			const related = catalog.byStableId.get(relatedId);
			// Destructive actions are direct-focus targets only.  They are neither
			// a prediction nor a related suggestion, even for an exact result.
			if (related == null || related.destructive) continue;
			const relatedLabelKey = settingsLabelKeyV2(related.label);
			if (relatedLabelKey !== '' && shownLabels.has(relatedLabelKey)) continue;
			if (relatedLabelKey !== '') shownLabels.add(relatedLabelKey);
			suggestions.push(decorate(related, Math.max(1, result.score - 100), 'related'));
			if (suggestions.length >= suggestionsLimit) break;
		}
		if (suggestions.length >= suggestionsLimit) break;
	}
	return { results, totalResults: matches.length, suggestions, normalizedQuery };
}

export function getRelatedSettingsV2(catalog: SettingsCatalogV2, stableId: string, limit = Number.MAX_SAFE_INTEGER): SettingsCatalogDescriptorV2[] {
	const descriptor = catalog.byStableId.get(stableId);
	if (descriptor == null || limit <= 0) return [];
	return descriptor.relatedIds
		.map(id => catalog.byStableId.get(id))
		.filter((item): item is SettingsCatalogDescriptorV2 => item != null && (item.searchable || item.source === 'destination') && !item.destructive)
		.slice(0, limit);
}
