/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import {
	assertSettingsCatalogRelationsV2,
	canonicalStableIdForCatalogV2,
	buildSettingsCatalogV2 as buildSettingsCatalogV2Impl,
	getRelatedSettingsV2,
	MAX_RELATED_SETTINGS_V2,
	searchSettingsV2,
	
} from './settings-search-v2.js';
import type { SettingsCatalogPresentationV2, SettingsDestinationCatalogItemV2 } from './settings-search-v2.js';
import type { SearchIndexItem } from '@/utility/inapp-search.js';
import type { SettingsControlCatalogItemV2, SettingsControlSearchDescriptorV2 } from '@/utility/settings-control-search-v2.js';
import { toSettingsControlCatalogItemsV2 } from '@/utility/settings-control-search-v2.js';
import { initIntlString } from '@/utility/intl-string.js';
import settingsSearchPanelSource from '@/pages/settings-redesign/SettingsSearchPanel.vue?raw';
import settingsShellSource from '@/pages/settings-redesign/index.vue?raw';
import settingsDestinationsSource from '@/pages/settings-redesign/settings-destinations.ts?raw';

type TestControlItem = Omit<SettingsControlCatalogItemV2,
	'legacyMarkerAncestorIds' | 'persistence' | 'saveMode' | 'availability' | 'owner' | 'applicableUi' | 'metadataEvidence' | 'relatedHostId'
> & Partial<Pick<SettingsControlCatalogItemV2,
	'legacyMarkerAncestorIds' | 'persistence' | 'saveMode' | 'availability' | 'owner' | 'applicableUi' | 'metadataEvidence' | 'relatedHostId'
>>;

const fixtureMetadata = {
	persistence: 'test fixture: no production storage inference',
	saveMode: 'test fixture: no production save inference',
	availability: 'test fixture: no production viewport inference',
	owner: 'test fixture',
	applicableUi: 'test fixture',
} as const;

/** Test-only defaults are deliberately kept outside the production builder. */
function buildSettingsCatalogV2(
	searchIndex: SearchIndexItem[],
	controlItems: TestControlItem[] = [],
	presentation?: SettingsCatalogPresentationV2,
	destinationItems: SettingsDestinationCatalogItemV2[] = [],
	canonicalStableIdByLegacyStableId: ReadonlyMap<string, string> = new Map(),
) {
	const materialized = controlItems.map(item => ({
		legacyMarkerAncestorIds: [],
		persistence: 'profile' as const,
		saveMode: 'immediate' as const,
		availability: 'all' as const,
		owner: 'core' as const,
		applicableUi: 'all' as const,
		metadataEvidence: fixtureMetadata,
		...item,
	}));
	// Search-unit fixtures intentionally predate generated related-display hosts.
	// The production builder receives a typed generated catalog item instead.
	return buildSettingsCatalogV2Impl(searchIndex, materialized as unknown as SettingsControlCatalogItemV2[], presentation, destinationItems, canonicalStableIdByLegacyStableId);
}

function fixture(): SearchIndexItem[] {
	return [
		{ id: '2fa', path: '/settings/security', label: '${i18n.ts[\'2fa\']}', keywords: ['2fa'], texts: [], icon: 'ti ti-lock' },
		{ id: 'passkey', parentId: '2fa', label: '${i18n.ts.securityKeyAndPasskey}', keywords: ['security', 'key', 'passkey'], texts: [] },
		{ id: 'blur', path: '/settings/preferences', label: '${i18n.ts.useBlurEffectForModal}', keywords: ['blur', 'modal'], texts: [] },
		{ id: 'opacity', path: '/settings/preferences', label: '${i18n.ts.showReplyTargetNoteInSemiTransparent}', keywords: ['transparent'], texts: [] },
		{ id: 'bar', path: '/settings/preferences', label: '${i18n.ts.showPageTabBarBottom}', keywords: ['tabs', 'tabbar', 'bottom'], texts: [] },
		{ id: 'enter', path: '/settings/preferences', label: '${i18n.ts[\'_settings\'][\'_chat\'].sendOnEnter}', keywords: ['send', 'enter'], texts: [] },
		{ id: 'font', path: '/settings/preferences', label: '${i18n.ts.fontSize}', keywords: ['font', 'size'], texts: [] },
		{ id: 'gap', path: '/settings/timeline', label: '${i18n.ts.showGapBetweenNotesInTimeline}', keywords: ['note', 'timeline', 'gap'], texts: [] },
	];
}

function controlFixture(): TestControlItem[] {
	return [
		{ stableId: 'settings.control.blur', route: '/settings/preferences', label: 'モーダルのぼかし', description: 'モーダル背景の見え方を調整します', aliases: ['useBlurEffectForModal'], preferenceKeys: ['appearance.blur'], legacyMarkerParentId: 'blur', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
		{ stableId: 'settings.control.opacity', route: '/settings/preferences', label: 'ノートの透明度', aliases: ['showReplyTargetNoteInSemiTransparent'], preferenceKeys: ['appearance.opacity'], legacyMarkerParentId: 'opacity', sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
		{ stableId: 'settings.control.bottom-bar', route: '/settings/preferences', label: '下部タブバー', aliases: ['showPageTabBarBottom', '旧タブ名'], preferenceKeys: ['ui.tabBar'], legacyMarkerParentId: 'bar', sourceFile: 'preferences.vue', sourceLine: 3, destructive: false },
		{ stableId: 'settings.control.enter', route: '/settings/preferences', label: 'Enterで送信', aliases: ['sendOnEnter'], preferenceKeys: ['chat.sendOnEnter'], legacyMarkerParentId: 'enter', sourceFile: 'preferences.vue', sourceLine: 4, destructive: false },
		{ stableId: 'settings.control.passkey', route: '/settings/security', label: 'パスキー', aliases: ['securityKeyAndPasskey', '2fa'], preferenceKeys: ['security.passkey'], legacyMarkerParentId: '2fa', sourceFile: 'security.vue', sourceLine: 5, destructive: false },
		{ stableId: 'settings.control.custom-font', route: '/settings/hata-custom', label: 'カスタムフォント', aliases: ['fontUpload'], preferenceKeys: ['appearance.customFont'], activation: { kind: 'hata-custom-category', category: 'glassUi' }, sourceFile: 'hata-custom.vue', sourceLine: 6, destructive: false },
		{ stableId: 'settings.control.bot', route: '/settings/preferences', label: 'botの設定', aliases: ['bot'], preferenceKeys: ['bot.visibility'], sourceFile: 'preferences.vue', sourceLine: 7, destructive: false },
	];
}

describe('settings-search-v2', () => {
	test('専用チャームページの検索結果はプロフィールと同じアカウント分類を維持する', () => {
		const catalog = buildSettingsCatalogV2([], [{ ...controlFixture()[0], stableId: 'settings.control.charm', route: '/settings/note-charm', label: 'チャームの色', aliases: [], preferenceKeys: [], sourceFile: 'src/components/MkNoteCharmSettings.vue' }]);
		expect(catalog.byStableId.get('settings.control.charm')?.categoryId).toBe('account');
	});
	test('Concrntの正式routeを独立した端末設定として索引へ登録する', () => {
		const catalog = buildSettingsCatalogV2([
			{ id: 'concrnt', path: '/settings/concrnt', label: 'コンカレント連携(BETA)', keywords: ['concrnt'], texts: [], icon: 'concrnt-icon' },
			{ id: 'misskey-external', path: '/settings/external-account', label: '外部アカウント連携', keywords: ['external account'], texts: [] },
		]);
		const concrnt = catalog.byLegacyId.get('concrnt');
		expect(concrnt).toMatchObject({ route: '/settings/concrnt', categoryId: 'data-connect', persistence: 'device', owner: 'hatasaba', icon: 'concrnt-icon', semanticGroupId: 'settings.semantic.feature.concrnt-linking' });
		expect(concrnt?.activation).toBeUndefined();
		expect(catalog.byLegacyId.get('misskey-external')?.route).toBe('/settings/external-account');
		expect(catalog.fallbackRoutes).not.toContain('/settings/concrnt');
		for (const query of ['Concrnt', 'コンカレント', 'CTL', 'concurrent']) {
			expect(searchSettingsV2(catalog, query).results.some(result => result.route === '/settings/concrnt')).toBe(true);
		}
	});

	test('Concrntの条件付き設定は常設group focusと未充足説明を保ち、自動activationを作らない', () => {
		const group = 'settings.group.concrnt-connection-settings';
		const catalog = buildSettingsCatalogV2([], [{
			stableId: 'settings.control.concrnt-notifications', route: '/settings/concrnt', label: 'コンカレントの通知を表示', aliases: ['Concrnt'], preferenceKeys: [],
			sourceFile: 'src/components/concrnt/ConcrntSettings.vue', sourceLine: 118, destructive: false, persistence: 'device', owner: 'hatasaba',
			focusId: group, sourceSemanticGroupId: 'settings.semantic.feature.concrnt-linking', unmet: [{ kind: 'runtime-data', id: 'concrnt-account-and-section', behavior: 'explain' }],
		}]);
		expect(catalog.byStableId.get('settings.control.concrnt-notifications')).toMatchObject({ route: '/settings/concrnt', persistence: 'device', focusId: group, unmet: [{ kind: 'runtime-data', id: 'concrnt-account-and-section', behavior: 'explain' }] });
		expect(catalog.byStableId.get('settings.control.concrnt-notifications')?.activation).toBeUndefined();
	});

	test('外部通知の関連先はcontrol IDに依存せず連携の有効設定へ結び、タイムライン設定は混ぜない', () => {
		const items = [
			{ stableId: 'settings.control.external-enabled-native', label: '外部アカウント連携を有効にする', preferenceKeys: ['external.enabled'] },
			{ stableId: 'settings.control.external-toast-native', label: '外部通知のポップアップを無効化', preferenceKeys: ['external.disableNotificationToast'] },
			{ stableId: 'settings.control.external-timeline-native', label: '外部ホームタイムラインを表示', preferenceKeys: ['external.enableOHTL'] },
		].map((item, index) => ({ ...item, route: '/settings/external-account', aliases: [], sourceFile: 'src/pages/settings/external-account.vue', sourceLine: index + 1, destructive: false, sourceSemanticGroupId: 'settings.semantic.feature.external-account-linking' }));
		const catalog = buildSettingsCatalogV2([], items);
		const toast = catalog.byStableId.get('settings.control.external-toast-native');
		expect(toast?.relatedIds).toContain('settings.control.external-enabled-native');
		expect(toast?.relatedIds).not.toContain('settings.control.external-timeline-native');
	});

	test('全件を落とさず、13の生成不能ルートを明示登録する', () => {
		const source = Array.from({ length: 278 }, (_, index) => ({
			id: `fixture-${index}`,
			path: '/settings/preferences',
			label: `fixture setting ${index}`,
			keywords: [`fixture.${index}`],
			texts: [],
		}));
		const catalog = buildSettingsCatalogV2(source);
		expect(catalog.descriptors).toHaveLength(291);
		expect(catalog.fallbackRoutes).toHaveLength(13);
		expect(catalog.descriptors.filter(item => item.isFallback).every(item => item.anchor === undefined)).toBe(true);
		expect(new Set(catalog.descriptors.map(item => item.stableId)).size).toBe(291);
		expect(catalog.byLegacyId.size).toBe(278);
		expect(catalog.descriptors.every(item => item.route.startsWith('/settings/'))).toBe(true);
		expect(catalog.descriptors.every(item => item.relatedIds.every(id => id !== item.stableId && catalog.byStableId.has(id)))).toBe(true);
	});

	test('意味IDは旧IDと分離され、根拠のない関連候補を作らない', () => {
		const catalog = buildSettingsCatalogV2(fixture());
		const passkey = catalog.descriptors.find(item => item.legacyId === 'passkey');
		expect(passkey).toBeDefined();
		expect(passkey!.stableId).not.toBe(passkey!.legacyId);
		expect(passkey!.route).toBe('/settings/security');
		expect(passkey!.anchor).toBe('passkey');
		expect(catalog.descriptors.every(item => item.related.every(related => related.kind === 'sameTopic'))).toBe(true);
	});

	test.each([
		['ぼかし', 'blur'],
		['opacity', 'opacity'],
		['下のバー', 'bar'],
		['2FA', '2fa'],
		['passkey', 'passkey'],
		['Enterで送信', 'enter'],
		['フォント', 'font'],
		['ノート 間隔', 'gap'],
	])('指定語 %s を適切な設定へ案内する', (query, legacyId) => {
		const catalog = buildSettingsCatalogV2(fixture());
		const response = searchSettingsV2(catalog, query);
		expect(response.normalizedQuery).not.toBe('');
		expect(response.results.some(result => result.legacyId === legacyId)).toBe(true);
	});

	test('類似候補を取得でき、設定値に触れない純粋な結果を返す', () => {
		const catalog = buildSettingsCatalogV2(fixture());
		const result = searchSettingsV2(catalog, 'passkey').results[0];
		const related = getRelatedSettingsV2(catalog, result.stableId, 3);
		expect(related).toEqual([]);
	});

	test('検索の一致件数は表示上限とrelated候補から独立して保持する', () => {
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.display-a', route: '/settings/preferences', label: 'fixture A', aliases: ['unique-search-fixture-token'], preferenceKeys: ['display.a'], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.display-b', route: '/settings/preferences', label: 'fixture B', aliases: ['unique-search-fixture-token'], preferenceKeys: ['display.b'], sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
			{ stableId: 'settings.control.display-c', route: '/settings/preferences', label: 'fixture C', aliases: ['unique-search-fixture-token'], preferenceKeys: ['display.c'], sourceFile: 'preferences.vue', sourceLine: 3, destructive: false },
		]);
		const response = searchSettingsV2(catalog, 'unique-search-fixture-token', { limit: 1, suggestionsLimit: 3 });
		expect(response.results).toHaveLength(1);
		expect(response.totalResults).toBe(3);
	});

	test('ローマ字・カナ表記揺れと予測専用応答を扱う', async () => {
		const catalog = buildSettingsCatalogV2(fixture());
		expect(searchSettingsV2(catalog, 'bokashi').results.some(result => result.legacyId === 'blur')).toBe(true);
		expect(searchSettingsV2(catalog, 'ぱすきー').results.some(result => result.legacyId === 'passkey')).toBe(true);
		await initIntlString(true);
		const generalRomaji = buildSettingsCatalogV2([], [{ stableId: 'settings.control.camera', route: '/settings/preferences', label: 'カメラ', aliases: [], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false }]);
		expect(searchSettingsV2(generalRomaji, 'kamera').results.map(result => result.controlId)).toContain('settings.control.camera');
		const typo = searchSettingsV2(catalog, 'bokasi', { suggestionsOnly: true });
		expect(typo.results).toHaveLength(0);
		expect(typo.suggestions.some(result => result.legacyId === 'blur')).toBe(true);
	});

	test.each([
		['透過', 'settings.control.opacity'], ['opacity', 'settings.control.opacity'], ['ぼかし', 'settings.control.blur'],
		['bot', 'settings.control.bot'], ['下のバー', 'settings.control.bottom-bar'], ['Enterで送信', 'settings.control.enter'],
		['2FA', 'settings.control.passkey'], ['パスキー', 'settings.control.passkey'], ['カスタムフォント', 'settings.control.custom-font'],
		['旧タブ名', 'settings.control.bottom-bar'], ['appearance.customFont', 'settings.control.custom-font'], ['bokashi', 'settings.control.blur'], ['pasuki', 'settings.control.passkey'],
	])('control検索 %s は安定control ID %s を返す', (query, controlId) => {
		const catalog = buildSettingsCatalogV2(fixture(), controlFixture());
		expect(searchSettingsV2(catalog, query).results.some(result => result.controlId === controlId)).toBe(true);
	});

	test('controlを検索とroute件数の正本にし、旧markerとの意味重複を抑止する', () => {
		const controls = controlFixture();
		const catalog = buildSettingsCatalogV2(fixture(), controls);
		const controlDescriptors = catalog.descriptors.filter(item => item.source === 'control');
		expect(controlDescriptors).toHaveLength(controls.length);
		expect(controlDescriptors.every(item => item.controlId === item.stableId && item.searchable)).toBe(true);
		expect(catalog.byStableId.get('settings.control.blur')?.description).toBe('モーダル背景の見え方を調整します');
		expect(catalog.byStableId.get('settings.control.blur')).toMatchObject({ anchor: 'blur', legacyMarkerParentId: 'blur' });
		expect(catalog.byStableId.get('settings.control.custom-font')?.activation).toEqual({ kind: 'hata-custom-category', category: 'glassUi' });
		expect(catalog.descriptors.find(item => item.legacyId === '2fa')?.searchable).toBe(false);
		expect(catalog.descriptors.find(item => item.legacyId === 'passkey')?.searchable).toBe(true);
		expect(searchSettingsV2(catalog, 'パスキー').results.some(item => item.controlId === 'settings.control.passkey')).toBe(true);
		expect(catalog.byLegacyId.get('2fa')?.legacyId).toBe('2fa');
	});

	test('実control metadataを広い既定値で補わず、欠落をfail-fastにする', () => {
		const missing = {
			stableId: 'settings.control.missing-metadata', route: '/settings/preferences', label: '欠落fixture', aliases: [], preferenceKeys: [],
			sourceFile: 'preferences.vue', sourceLine: 99, destructive: false,
		} as unknown as SettingsControlCatalogItemV2;
		expect(() => buildSettingsCatalogV2Impl([], [missing])).toThrow('settings V2 control metadata is incomplete: settings.control.missing-metadata (preferences.vue:99)');
	});
	test('removed runtime control ids rewrite to canonical ids and invalid aliases fail fast', () => {
		const controls = [{ stableId: 'settings.control.preference.animation', route: '/settings/preferences', label: 'アニメーション', aliases: [], preferenceKeys: ['animation'], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false }];
		const catalog = buildSettingsCatalogV2([], controls, undefined, [], new Map([
			['settings.control.legacy-animation-a', 'settings.control.preference.animation'],
			['settings.control.legacy-animation-b', 'settings.control.preference.animation'],
		]));
		expect(canonicalStableIdForCatalogV2(catalog, 'settings.control.legacy-animation-a')).toBe('settings.control.preference.animation');
		expect(canonicalStableIdForCatalogV2(catalog, 'settings.control.unknown')).toBe('settings.control.unknown');
		expect(catalog.byStableId.has('settings.control.legacy-animation-a')).toBe(false);
		expect(() => buildSettingsCatalogV2([], controls, undefined, [], new Map([['settings.control.legacy-missing', 'settings.control.preference.missing']]))).toThrow(/alias target is missing/u);
		expect(() => buildSettingsCatalogV2([], controls, undefined, [], new Map([['settings.control.preference.animation', 'settings.control.preference.animation']]))).toThrow(/alias cannot refer to itself/u);
		const second = { ...controls[0]!, stableId: 'settings.control.preference.motion', label: '動き' };
		expect(() => buildSettingsCatalogV2([], [controls[0]!, second], undefined, [], new Map([['settings.control.preference.animation', 'settings.control.preference.motion']]))).toThrow(/alias source is still searchable/u);
	});

	test('hata-customの検索結果パスはrouteで一括せず、sourceと既存activationから新IAへ分類する', () => {
		const catalog = buildSettingsCatalogV2([], [
			{
				stableId: 'settings.group.ui2-glass', route: '/settings/hata-custom', label: 'ガラスとぼかし', aliases: ['透過率'], preferenceKeys: [],
				sourceFile: 'src/components/HatasabaUi2SettingsBody.vue', sourceLine: 1, isGroup: true,
				activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' }, destructive: false,
			},
			{
				stableId: 'settings.control.ui2-immediate', route: '/settings/hata-custom', label: 'バブルデザイン', aliases: [], preferenceKeys: [],
				sourceFile: 'src/components/HatasabaUi2ImmediateSettings.vue', sourceLine: 1,
				activation: { kind: 'hata-custom-category', category: 'glassUi' }, destructive: false,
			},
			{
				stableId: 'settings.control.custom-font', route: '/settings/hata-custom', label: 'カスタムフォント', aliases: [], preferenceKeys: [],
				sourceFile: 'src/pages/settings/hata-custom.vue', sourceLine: 1,
				activation: { kind: 'hata-custom-category', category: 'font' }, destructive: false,
			},
			{
				stableId: 'settings.control.note-density', route: '/settings/hata-custom', label: 'ノートの間隔', aliases: [], preferenceKeys: [],
				sourceFile: 'src/pages/settings/hata-custom.vue', sourceLine: 2,
				activation: { kind: 'hata-custom-category', category: 'visual' }, destructive: false,
			},
			{
				stableId: 'settings.control.hatask', route: '/settings/hata-custom', label: 'Hataskの通知', aliases: [], preferenceKeys: [],
				sourceFile: 'src/pages/settings/hata-custom.vue', sourceLine: 3,
				activation: { kind: 'popup', category: 'hatask', popup: 'hatask' }, destructive: false,
			},
		]);
		expect(catalog.byStableId.get('settings.group.ui2-glass')).toMatchObject({ categoryId: 'hataskey-ui', categoryLabel: 'Hataskey UI', label: 'ガラスとぼかし' });
		expect(catalog.byStableId.get('settings.control.ui2-immediate')?.categoryId).toBe('hataskey-ui');
		expect(catalog.byStableId.get('settings.control.custom-font')).toMatchObject({ categoryId: 'theme-font', categoryLabel: 'Themes and fonts' });
		expect(catalog.byStableId.get('settings.control.note-density')).toMatchObject({ categoryId: 'display-notes', categoryLabel: 'Display density and notes' });
		expect(catalog.byStableId.get('settings.control.hatask')?.categoryId).toBe('hata-tools');
	});

	test('catalog presentationはja/en/zh-CNとfallbackでカテゴリ・fallback・関連理由をlocale化する', () => {
		const controls: TestControlItem[] = [
			{ stableId: 'settings.control.presentation-a', route: '/settings/preferences', label: 'Display A', aliases: ['display'], preferenceKeys: [], semanticGroupId: 'settings.group.presentation', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.presentation-b', route: '/settings/preferences', label: 'Display B', aliases: ['display'], preferenceKeys: [], semanticGroupId: 'settings.group.presentation', sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
		];
		const japanese = buildSettingsCatalogV2([], controls, {
			categoryLabels: { 'display-notes': '表示密度とノート' },
			fallback: { '/settings/drive/cleaner': { label: 'ドライブの整理', description: 'ドライブ内のファイルを整理する設定' } },
			relationReasons: { sameSection: '同じ設定セクションの項目' },
		});
		expect(japanese.byStableId.get('settings.control.presentation-a')).toMatchObject({ categoryLabel: '表示密度とノート' });
		expect(japanese.byStableId.get('settings.control.presentation-a')?.related[0]).toMatchObject({ reasonKey: 'sameSection', reason: '同じ設定セクションの項目' });

		const english = buildSettingsCatalogV2([], controls, {
			categoryLabels: { 'display-notes': 'Display density and notes' },
			fallback: { '/settings/drive/cleaner': { label: 'Clean up Drive', description: 'Organize files in Drive' } },
			relationReasons: { sameSection: 'In the same settings section' },
			noRelatedReasons: { fallback: 'No related setting is available' },
			fallbackReason: 'Registered because the legacy generator did not produce this route',
		});
		const englishFallback = english.descriptors.find(descriptor => descriptor.sourceRoute === '/settings/drive/cleaner');
		expect(english.byStableId.get('settings.control.presentation-a')).toMatchObject({ categoryLabel: 'Display density and notes' });
		expect(english.byStableId.get('settings.control.presentation-a')?.related[0]).toMatchObject({ reason: 'In the same settings section' });
		expect(englishFallback).toMatchObject({ label: 'Clean up Drive', description: 'Organize files in Drive', fallbackReason: 'Registered because the legacy generator did not produce this route' });

		const chinese = buildSettingsCatalogV2([], controls, {
			categoryLabels: { 'display-notes': '显示密度与帖子' },
			fallback: { '/settings/drive/cleaner': { label: '整理网盘', description: '整理网盘中的文件' } },
			relationReasons: { sameSection: '同一设置分区中的项目' },
		});
		expect(chinese.byStableId.get('settings.control.presentation-a')).toMatchObject({ categoryLabel: '显示密度与帖子' });
		expect(chinese.byStableId.get('settings.control.presentation-a')?.related[0]).toMatchObject({ reason: '同一设置分区中的项目' });
		expect(chinese.descriptors.find(descriptor => descriptor.sourceRoute === '/settings/drive/cleaner')).toMatchObject({ label: '整理网盘', description: '整理网盘中的文件' });

		// A caller that has not yet supplied a locale dictionary receives the
		// English fallback—not Japanese hard-coded category/fallback/relation UI.
		const fallbackLocale = buildSettingsCatalogV2([], controls, {});
		const visibleCopy = fallbackLocale.descriptors.flatMap(descriptor => [
			descriptor.categoryLabel,
			descriptor.isFallback ? descriptor.label : '',
			descriptor.isFallback ? descriptor.description ?? '' : '',
			...descriptor.related.map(related => related.reason),
			descriptor.noRelatedReason ?? '',
		]);
		expect(visibleCopy.join(' ')).not.toMatch(/[ぁ-んァ-ヶ]/u);
	});

	test('searchable controlを漏れなくcatalogへ渡し、除外済みcontrolは検索結果に混ぜない', () => {
		const metadata = {
			persistence: 'test fixture', saveMode: 'test fixture', availability: 'test fixture', owner: 'test fixture', applicableUi: 'test fixture',
		};
		const source: SettingsControlSearchDescriptorV2[] = [
			{ stableId: 'settings.control.visible', route: '/settings/preferences', sourceFile: 'preferences.vue', sourceLine: 1, component: 'MkSwitch', label: '表示する設定', preferenceKeys: [], conditions: [], legacyMarkerAncestorIds: [], persistence: 'profile', saveMode: 'immediate', availability: 'all', owner: 'core', applicableUi: 'all', metadataEvidence: metadata, relatedHostId: undefined as never, searchable: true, destructive: false },
			{ stableId: 'settings.control.excluded', route: '/settings/preferences', sourceFile: 'preferences.vue', sourceLine: 2, component: 'MkSwitch', label: '動的な設定', preferenceKeys: [], conditions: [], legacyMarkerAncestorIds: [], persistence: 'profile', saveMode: 'immediate', availability: 'all', owner: 'core', applicableUi: 'all', metadataEvidence: metadata, relatedHostId: undefined as never, searchable: false, intentionallyExcluded: true, exclusionReason: '実行時に識別子が決まる', destructive: false },
		];
		const controls = toSettingsControlCatalogItemsV2(source, {});
		const catalog = buildSettingsCatalogV2([], controls);
		expect(new Set(catalog.descriptors.filter(item => item.source === 'control').map(item => item.controlId))).toEqual(new Set(['settings.control.visible']));
	});

	test('破壊的な候補を関連リンクへ混ぜず、可逆な外観操作は抑止しない', () => {
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.safe', route: '/settings/preferences', label: '表示設定', aliases: ['表示'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.appearance', route: '/settings/preferences', label: 'モーダル背景の透明度', aliases: ['removeModalBgColorForBlur'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
			{ stableId: 'settings.control.delete-account', route: '/settings/preferences', label: 'アカウントを削除', aliases: [], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 3, destructive: true },
		]);
		expect(catalog.descriptors.every(item => item.related.every(related => catalog.byStableId.get(related.stableId)?.destructive !== true))).toBe(true);
		expect(catalog.byStableId.get('settings.control.appearance')?.destructive).toBe(false);
		expect(catalog.byStableId.get('settings.control.delete-account')?.destructive).toBe(true);
		expect(buildSettingsCatalogV2([{ id: 'legacy-blur', path: '/settings/preferences', label: '${i18n.ts.removeModalBgColorForBlur}', keywords: [], texts: [] }]).descriptors.find(item => item.legacyId === 'legacy-blur')?.destructive).toBe(false);
		expect(buildSettingsCatalogV2([{ id: 'legacy-delete', path: '/settings/account-data', label: 'アカウントを削除', keywords: [], texts: [] }]).descriptors.find(item => item.legacyId === 'legacy-delete')?.destructive).toBe(true);
		expect(buildSettingsCatalogV2([]).descriptors.find(item => item.sourceRoute === '/settings/drive/cleaner')?.destructive).toBe(false);
	});

	test('同じrouteだけ・stopwordだけでは関連候補を作らない', () => {
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.one', route: '/settings/preferences', label: '表示設定', aliases: ['i18n.ts.settings'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.two', route: '/settings/preferences', label: '通知設定', aliases: ['i18n.ts.setting'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
		]);
		expect(getRelatedSettingsV2(catalog, 'settings.control.one')).toHaveLength(0);
		expect(getRelatedSettingsV2(catalog, 'settings.control.two')).toHaveLength(0);
	});

	test('明示destinationは既存の強い関連がない時だけfallbackになり、無効化後も関連取得の表示上限を消費しない', () => {
		const destinations: SettingsDestinationCatalogItemV2[] = [{
			destinationId: 'account-privacy', stableId: 'settings.destination.account-privacy', route: '/settings/privacy', label: 'プライバシー', aliases: [],
			persistence: 'device', saveMode: 'immediate', availability: 'all', owner: 'core', applicableUi: 'all', metadataEvidence: fixtureMetadata,
		}];
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.isolated', route: '/settings/preferences', label: '公開範囲の初期値', aliases: [], preferenceKeys: [], relationDestinationId: 'account-privacy', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.strong-a', route: '/settings/privacy', label: 'フォロー設定', aliases: [], preferenceKeys: [], semanticGroupId: 'settings.semantic.follow', relationDestinationId: 'account-privacy', sourceFile: 'privacy.vue', sourceLine: 2, destructive: false },
			{ stableId: 'settings.control.strong-b', route: '/settings/privacy', label: 'フォロー承認', aliases: [], preferenceKeys: [], semanticGroupId: 'settings.semantic.follow', sourceFile: 'privacy.vue', sourceLine: 3, destructive: false },
		], undefined, destinations);
		expect(getRelatedSettingsV2(catalog, 'settings.control.isolated').map(item => item.stableId)).toEqual(['settings.destination.account-privacy']);
		const strongIds = getRelatedSettingsV2(catalog, 'settings.control.strong-a').map(item => item.stableId);
		expect(strongIds).toContain('settings.control.strong-b');
		expect(strongIds).not.toContain('settings.destination.account-privacy');
		const source = catalog.byStableId.get('settings.control.isolated')!;
		source.related = [
			{ stableId: 'settings.destination.account-privacy', kind: 'fallback', reason: 'fixture', weight: 0 },
			{ stableId: 'settings.control.strong-b', kind: 'sameTopic', reason: 'fixture', weight: 0 },
		];
		source.relatedIds = source.related.map(relation => relation.stableId);
		catalog.byStableId.get('settings.destination.account-privacy')!.destructive = true;
		expect(getRelatedSettingsV2(catalog, 'settings.control.isolated', 1).map(item => item.stableId)).toEqual(['settings.control.strong-b']);
	});

	test('明示destinationの未知・利用不能・現在destination再表示をfail-fastまたはno-op排除する', () => {
		const destination: SettingsDestinationCatalogItemV2 = {
			destinationId: 'display-general', stableId: 'settings.destination.display-general', route: '/settings/preferences', label: '全般', aliases: [],
			persistence: 'device', saveMode: 'immediate', availability: 'all', owner: 'core', applicableUi: 'all', metadataEvidence: fixtureMetadata,
		};
		expect(() => buildSettingsCatalogV2([], [{ stableId: 'settings.control.unknown-destination', route: '/settings/preferences', label: '未知', aliases: [], preferenceKeys: [], relationDestinationId: 'missing', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false }], undefined, [destination])).toThrow(/Unknown settings relation destination/);
		const unavailable = { ...destination, availability: 'desktop' as const };
		expect(() => buildSettingsCatalogV2([], [{ stableId: 'settings.control.unavailable-destination', route: '/settings/preferences', label: '利用不能', aliases: [], preferenceKeys: [], relationDestinationId: 'display-general', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false }], undefined, [unavailable])).toThrow(/Unavailable settings relation destination/);
		const noOp = buildSettingsCatalogV2([], [{ stableId: 'settings.control.current-destination', route: '/settings/preferences', label: '現在の表示', aliases: [], preferenceKeys: [], destinationId: 'display-general', relationDestinationId: 'display-general', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false }], undefined, [destination]);
		expect(getRelatedSettingsV2(noOp, 'settings.control.current-destination')).toEqual([]);
	});

	test('navigation-only destination is absent from ordinary search but remains an available related target', () => {
		const destinations: SettingsDestinationCatalogItemV2[] = [{
			destinationId: 'account-privacy', stableId: 'settings.destination.account-privacy', route: '/settings/privacy', label: 'プライバシー', aliases: [],
			persistence: 'device', saveMode: 'immediate', availability: 'all', owner: 'core', applicableUi: 'all', metadataEvidence: fixtureMetadata,
		}];
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.isolated', route: '/settings/preferences', label: '公開範囲の初期値', aliases: [], preferenceKeys: [], destinationId: 'display-general', relationDestinationId: 'account-privacy', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
		], undefined, destinations);
		expect(searchSettingsV2(catalog, 'プライバシー').results.map(item => item.stableId)).not.toContain('settings.destination.account-privacy');
		expect(getRelatedSettingsV2(catalog, 'settings.control.isolated').map(item => item.stableId)).toEqual(['settings.destination.account-privacy']);
	});

	test('内部式・i18n path・汎用tokenはrelated根拠にせず、可視の人間語だけを使う', () => {
		const internalOnly = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.internal-a', route: '/settings/preferences', label: '通知の明るさ', aliases: ['i18n.ts._settings.notificationBrightness', 'editor.draft.sharedColor', 'modelValue', 'hata'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.internal-b', route: '/settings/preferences', label: 'ファイルの保存先', aliases: ['i18n.ts._settings.fileLocation', 'editor.draft.sharedColor', 'modelValue', 'hata'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
		]);
		expect(getRelatedSettingsV2(internalOnly, 'settings.control.internal-a')).toHaveLength(0);

		// Positive control: the detector still joins an actually visible,
		// product-curated word, so the preceding zero is not a dead assertion.
		const humanEvidence = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.human-a', route: '/settings/notifications', label: 'Notification appearance', aliases: ['バブル'], preferenceKeys: [], sourceFile: 'notifications.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.human-b', route: '/settings/notifications', label: 'Notification card appearance', aliases: ['バブル'], preferenceKeys: [], sourceFile: 'notifications.vue', sourceLine: 2, destructive: false },
		]);
		expect(getRelatedSettingsV2(humanEvidence, 'settings.control.human-a').map(item => item.stableId)).toContain('settings.control.human-b');
	});

	test('表示・有効・利用などの汎用UI語だけでは関連を捏造せず、検出器の陽性対照を保つ', () => {
		const genericOnly = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.generic-display', route: '/settings/preferences', label: 'プロフィールの表示', aliases: ['表示', '有効'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.generic-use', route: '/settings/preferences', label: '外部サービスの利用', aliases: ['利用', '使用'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
			{ stableId: 'settings.control.generic-feature', route: '/settings/preferences', label: '実験的な機能', aliases: ['機能', 'する'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 3, destructive: false },
		]);
		expect(getRelatedSettingsV2(genericOnly, 'settings.control.generic-display')).toHaveLength(0);
		expect(getRelatedSettingsV2(genericOnly, 'settings.control.generic-use')).toHaveLength(0);

		const semanticEvidence = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.semantic-a', route: '/settings/notifications', label: 'Notification banner', aliases: ['通知バナー'], preferenceKeys: [], sourceFile: 'notifications.vue', sourceLine: 4, destructive: false },
			{ stableId: 'settings.control.semantic-b', route: '/settings/notifications', label: 'Notification sound', aliases: ['通知バナー'], preferenceKeys: [], sourceFile: 'notifications.vue', sourceLine: 5, destructive: false },
		]);
		expect(getRelatedSettingsV2(semanticEvidence, 'settings.control.semantic-a').map(item => item.stableId)).toEqual(['settings.control.semantic-b']);
	});

	test('feature identity outranks a broad static section, and internal labels never create visible-term evidence', () => {
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.feature-a', route: '/settings/preferences', label: '通知の同期', aliases: [], preferenceKeys: [], semanticGroupId: 'settings.group.broad', sourceSemanticGroupId: 'settings.semantic.feature.sync', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.feature-b', route: '/settings/preferences', label: '同期の通知', aliases: [], preferenceKeys: [], semanticGroupId: 'settings.group.broad', sourceSemanticGroupId: 'settings.semantic.feature.sync', sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
			{ stableId: 'settings.control.internal', route: '/settings/preferences', label: 'i18n.ts.securityKeyAndPasskey', aliases: [], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 3, destructive: false },
			{ stableId: 'settings.control.visible', route: '/settings/preferences', label: 'セキュリティキー', aliases: [], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 4, destructive: false },
		]);
		expect(catalog.byStableId.get('settings.control.feature-a')?.related[0]).toMatchObject({ stableId: 'settings.control.feature-b', reasonKey: 'sameFeature', weight: 1.05 });
		expect(getRelatedSettingsV2(catalog, 'settings.control.internal')).toHaveLength(0);
	});

	test('semantic-group-peerは候補索引経由でrelatedとsuggestionに残る', () => {
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.group.peer', route: '/settings/preferences', label: '通知設定', aliases: [], preferenceKeys: [], isGroup: true, semanticGroupId: 'settings.semantic.group.notifications', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.peer', route: '/settings/preferences', label: '通知音', aliases: [], preferenceKeys: [], semanticGroupId: 'settings.group.peer', sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
		]);
		expect(getRelatedSettingsV2(catalog, 'settings.control.peer').map(item => item.stableId)).toContain('settings.group.peer');
		expect(getRelatedSettingsV2(catalog, 'settings.group.peer').map(item => item.stableId)).toContain('settings.control.peer');
		expect(searchSettingsV2(catalog, '通知設定', { suggestionsLimit: 3 }).suggestions.map(item => item.stableId)).toContain('settings.control.peer');
	});

	test('関連配列は有意根拠順に重複なく有限化し、巨大semantic groupを数十件展開しない', () => {
		const members: TestControlItem[] = Array.from({ length: MAX_RELATED_SETTINGS_V2 + 8 }, (_, index) => ({
			stableId: `settings.control.large-group-${index}`,
			route: '/settings/preferences',
			label: `Alpha${index}`,
			aliases: index === 0 ? ['カード見た目'] : [],
			preferenceKeys: [],
			semanticGroupId: 'settings.group.large-fixture',
			sourceFile: 'preferences.vue',
			sourceLine: (index + 1) * 10,
			destructive: false,
		}));
		members.push({
			stableId: 'settings.control.large-group-lexical-only', route: '/settings/preferences', label: 'カードの見た目', aliases: ['カード見た目'], preferenceKeys: [],
			sourceFile: 'preferences.vue', sourceLine: 99, destructive: false,
		});
		const catalog = buildSettingsCatalogV2([], members);
		const source = catalog.byStableId.get('settings.control.large-group-0')!;
		expect(source.relatedTotal).toBe(0);
		expect(source.related).toHaveLength(0);
		expect(new Set(source.relatedIds).size).toBe(source.relatedIds.length);
		expect(source.noRelatedReason).toBeDefined();
	});

	test('marker関連はnearest一致を優先し、rootだけ・巨大groupだけでは水増ししない', () => {
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.root-a', route: '/settings/preferences', label: '表示A', aliases: [], preferenceKeys: [], legacyMarkerParentId: 'root', legacyMarkerAncestorIds: ['root'], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.root-b', route: '/settings/preferences', label: '通知B', aliases: [], preferenceKeys: [], legacyMarkerParentId: 'root', legacyMarkerAncestorIds: ['root'], sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
			{ stableId: 'settings.control.nearest-a', route: '/settings/preferences', label: '別の項目A', aliases: [], preferenceKeys: [], legacyMarkerParentId: 'shared', legacyMarkerAncestorIds: ['root', 'shared'], sourceFile: 'preferences.vue', sourceLine: 3, destructive: false },
			{ stableId: 'settings.control.nearest-b', route: '/settings/preferences', label: '別の項目B', aliases: [], preferenceKeys: [], legacyMarkerParentId: 'shared', legacyMarkerAncestorIds: ['root', 'shared'], sourceFile: 'preferences.vue', sourceLine: 4, destructive: false },
			{ stableId: 'settings.control.nested-a', route: '/settings/preferences', label: 'Nested notice A', aliases: ['通知'], preferenceKeys: [], legacyMarkerParentId: 'nested-a', legacyMarkerAncestorIds: ['root', 'nested', 'nested-a'], sourceFile: 'preferences.vue', sourceLine: 5, destructive: false },
			{ stableId: 'settings.control.nested-b', route: '/settings/preferences', label: 'Nested notice B', aliases: ['通知'], preferenceKeys: [], legacyMarkerParentId: 'nested-b', legacyMarkerAncestorIds: ['root', 'nested', 'nested-b'], sourceFile: 'preferences.vue', sourceLine: 6, destructive: false },
			...Array.from({ length: 9 }, (_, index) => ({ stableId: `settings.control.giant-${index}`, route: '/settings/preferences', label: `巨大項目${index}`, aliases: ['共通語'], preferenceKeys: [], legacyMarkerParentId: `giant-${index}`, legacyMarkerAncestorIds: ['root', 'giant', `giant-${index}`], sourceFile: 'preferences.vue', sourceLine: index + 7, destructive: false })),
			...Array.from({ length: 9 }, (_, index) => ({ stableId: `settings.control.huge-root-${index}`, route: '/settings/preferences', label: `root項目${index}`, aliases: [], preferenceKeys: [], legacyMarkerParentId: `root-child-${index}`, legacyMarkerAncestorIds: ['root', `root-child-${index}`], sourceFile: 'preferences.vue', sourceLine: index + 16, destructive: false })),
		]);
		expect(getRelatedSettingsV2(catalog, 'settings.control.root-a')).toHaveLength(0);
		expect(getRelatedSettingsV2(catalog, 'settings.control.nearest-a').map(item => item.stableId)).toContain('settings.control.nearest-b');
		expect(getRelatedSettingsV2(catalog, 'settings.control.nested-a').map(item => item.stableId)).toContain('settings.control.nested-b');
		expect(getRelatedSettingsV2(catalog, 'settings.control.giant-0')).toHaveLength(0);
		expect(catalog.byStableId.get('settings.control.giant-0')?.related.every(item => item.reason !== '同じ項目グループの設定')).toBe(true);
		expect(getRelatedSettingsV2(catalog, 'settings.control.huge-root-0')).toHaveLength(0);
		expect(catalog.byStableId.get('settings.control.nearest-a')?.related[0]).toMatchObject({ stableId: 'settings.control.nearest-b', reason: 'In the same settings group', weight: 1 });
		expect(catalog.byStableId.get('settings.control.nested-a')?.related[0]).toMatchObject({ stableId: 'settings.control.nested-b', reason: 'In the same item group', weight: 0.9 });
	});

	test('設定キーは完全一致または2段以上の意味あるprefixだけを関連根拠にする', () => {
		const catalog = buildSettingsCatalogV2([], [
			{ stableId: 'settings.control.simple-a', route: '/settings/preferences', label: '表示A', aliases: [], preferenceKeys: ['simpleUi.alpha'], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false },
			{ stableId: 'settings.control.simple-b', route: '/settings/preferences', label: '通知B', aliases: [], preferenceKeys: ['simpleUi.beta'], sourceFile: 'preferences.vue', sourceLine: 2, destructive: false },
			{ stableId: 'settings.control.deep-a', route: '/settings/preferences', label: '透明A', aliases: [], preferenceKeys: ['simpleUi.glass.opacity'], sourceFile: 'preferences.vue', sourceLine: 3, destructive: false },
			{ stableId: 'settings.control.deep-b', route: '/settings/preferences', label: '透明B', aliases: [], preferenceKeys: ['simpleUi.glass.blur'], sourceFile: 'preferences.vue', sourceLine: 4, destructive: false },
		]);
		expect(getRelatedSettingsV2(catalog, 'settings.control.simple-a')).toHaveLength(0);
		expect(getRelatedSettingsV2(catalog, 'settings.control.deep-a').map(item => item.stableId)).toContain('settings.control.deep-b');
		expect(catalog.byStableId.get('settings.control.deep-a')?.related[0]?.reason).toBe('Uses related settings');
	});

	test('検索候補は抑止済みlegacyを予測せず、複数語の近似根拠を個別に要求する', () => {
		const suppressed = buildSettingsCatalogV2([
			{ id: 'root', path: '/settings/preferences', label: '旧設定', keywords: [], texts: [] },
			{ id: 'legacy-only', parentId: 'root', label: 'legacy hidden candidate', keywords: ['legacyhidden'], texts: [] },
		], [{ stableId: 'settings.control.visible', route: '/settings/preferences', label: '表示設定', aliases: [], preferenceKeys: [], legacyMarkerParentId: 'root', sourceFile: 'preferences.vue', sourceLine: 1, destructive: false }]);
		expect(searchSettingsV2(suppressed, 'legacyhidde', { suggestionsOnly: true }).suggestions.some(item => item.legacyId === 'legacy-only')).toBe(true);
		const multiToken = buildSettingsCatalogV2([], [{ stableId: 'settings.control.blur', route: '/settings/preferences', label: 'ぼかし', aliases: ['bokashi'], preferenceKeys: [], sourceFile: 'preferences.vue', sourceLine: 1, destructive: false }]);
		expect(searchSettingsV2(multiToken, 'bokasi unmatched', { suggestionsOnly: true }).suggestions).toHaveLength(0);
	});

	test('検索パネルはIME確定前に検索せず、キーボード選択を可視範囲へ送る', () => {
		expect(settingsSearchPanelSource).toContain('@compositionstart="isComposing = true"');
		expect(settingsSearchPanelSource).toContain('@compositionend="onCompositionEnd"');
		expect(settingsSearchPanelSource).toContain('if (isComposing.value) return;');
		expect(settingsSearchPanelSource).toContain('scrollIntoView({ block: \'nearest\' })');
		expect(settingsSearchPanelSource).toContain('<Transition name="settings-search-results" :css="isMotionEnabled">');
		expect(settingsSearchPanelSource).toContain('transition: opacity 180ms');
		// ⚠️結果は1件ずつ順に立ち上がるが、遅延は必ず頭打ちにすること。
		//   打鍵のたびに走る場所なので、積み上がると入力が引っかかって感じる。
		expect(settingsSearchPanelSource).toContain('animation-delay: min(calc(var(--i, 0) * 26ms), 130ms);');
		expect(settingsSearchPanelSource).toContain('window.setTimeout(() => {');
		expect(settingsSearchPanelSource).toContain('}, 150);');
		expect(settingsSearchPanelSource).not.toContain('aria-modal');
		expect(settingsSearchPanelSource).not.toContain('trapFocus');
		expect(settingsSearchPanelSource).not.toContain('<SettingsRelatedLinks');
	});

	test('設定ナビはBentoカテゴリを表示し、旧manifestの検索・遷移先を維持する', () => {
		for (const path of [
			'/settings/notifications', '/settings/sounds', '/settings/theme', '/settings/mute-block', '/settings/drive', '/settings/security',
			'/settings/other', '/settings/external-account', '/settings/account-data', '/settings/cherrypick', '/settings/deck', '/settings/navbar', '/settings/statusbar',
		]) expect(settingsDestinationsSource).toContain(path);
		expect(settingsDestinationsSource).toContain('label: copy.nav.hataTools');
		expect(settingsDestinationsSource).toContain('label: copy.nav.cherrypick');
		expect(settingsDestinationsSource).toContain('label: copy.nav.data');
		expect(settingsDestinationsSource).toContain('label: copy.nav.misskey');
		expect(settingsShellSource).toContain('<SettingsBentoNavigation :categories="settingsBentoCategories"');
		expect(settingsShellSource).toContain('@select="selectBentoCategory"');
		expect(settingsShellSource).toContain('settingsDestinationSections.map(section => ({');
		expect(settingsShellSource).toContain('settingsDestinationCatalogItemsV2()');
		expect(settingsDestinationsSource).toContain("destination('hata-settings-transfer'");
		expect(settingsDestinationsSource).toContain("destination('account-export'");
		expect(settingsDestinationsSource).toContain("'ti ti-truck'");
	});

	test('既知の壊れた推定routeをremapし、fallback重複を避ける', () => {
		const remapped = buildSettingsCatalogV2([{
			id: 'emoji-child', path: '/settings/mute-block.emoji-mute', label: '絵文字ミュート', keywords: ['emoji'], texts: [],
		}]);
		const item = remapped.descriptors.find(descriptor => descriptor.legacyId === 'emoji-child');
		expect(item).toMatchObject({ route: '/settings/mute-block', sourceRoute: '/settings/mute-block.emoji-mute' });
		const withFallbackRoute = buildSettingsCatalogV2([{
			id: 'theme-install', path: '/settings/theme/install', label: 'テーマ追加', keywords: ['theme'], texts: [],
		}]);
		expect(withFallbackRoute.descriptors.filter(descriptor => descriptor.sourceRoute === '/settings/theme/install')).toHaveLength(0);
		expect(withFallbackRoute.fallbackRoutes).not.toContain('/settings/theme/install');
		expect(withFallbackRoute.fallbackRoutes).toHaveLength(12);
		expect(new Set(withFallbackRoute.fallbackRoutes)).toEqual(new Set(withFallbackRoute.descriptors.flatMap(descriptor => descriptor.isFallback && descriptor.sourceRoute != null ? [descriptor.sourceRoute] : [])));
		const webhook = buildSettingsCatalogV2([]).descriptors.find(descriptor => descriptor.sourceRoute === '/settings/webhook/edit/:webhookId');
		expect(webhook?.route).toBe('/settings/connect');
		expect(webhook?.anchor).toBeUndefined();
	});

	test('関連先検査は自己参照・重複・不存在を拒否する', () => {
		const catalog = buildSettingsCatalogV2(fixture());
		const source = catalog.descriptors[0]!;
		source.relatedIds = [source.stableId];
		expect(() => assertSettingsCatalogRelationsV2(catalog)).toThrow(/cannot refer to itself/);
		source.relatedIds = ['known', 'known'];
		catalog.byStableId = new Map([...catalog.byStableId, ['known', catalog.descriptors[1]!]]);
		expect(() => assertSettingsCatalogRelationsV2(catalog)).toThrow(/Duplicate settings relation/);
		source.relatedIds = ['missing'];
		expect(() => assertSettingsCatalogRelationsV2(catalog)).toThrow(/Unknown settings relation/);
	});

	// 陽性対照: 旧ID重複は検出器が生きていることを確認してから、正常系の件数を信用する。
	test('陽性対照: 重複legacy idと不正routeを検出する', () => {
		const duplicated = fixture();
		duplicated.push({ ...duplicated[0] });
		expect(() => buildSettingsCatalogV2(duplicated)).toThrow(/Duplicate legacy/);
		const invalid = [{ ...fixture()[0], id: 'invalid', path: 'settings/2fa' }];
		expect(() => buildSettingsCatalogV2(invalid)).toThrow(/Invalid settings route/);
	});
});
