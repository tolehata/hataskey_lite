/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});
import {
	canonicalSearchIdForDescriptor,
	canonicalSearchIdForPreferenceKey,
	generatedPreferenceSearchId,
	preferenceAuxiliaryControls,
	preferenceControls,
	settingsInventoryKeys,
} from './settings-preferences-catalog.js';
import {
	isRedesignedPreferenceSearchId,
	mergeRedesignedPreferenceSearchItems,
	preferenceDestinationForSearchTarget,
	redesignedPreferenceStableIdAliases,
	settingsDestinationCatalogItemsV2,
	suppressLegacyPreferenceSearchMarkers,
} from './settings-preferences-search-index.js';
import type { SearchIndexItem } from '@/utility/inapp-search.js';
import type { SettingsControlCatalogItemV2 } from '@/utility/settings-control-search-v2.js';
import { assertSettingsCatalogRelationsV2, buildSettingsCatalogV2, canonicalStableIdForCatalogV2, getRelatedSettingsV2, searchSettingsV2 } from '@/utility/settings-search-v2.js';

const metadata = {
	persistence: 'test fixture: legacy preference generator metadata',
	saveMode: 'test fixture: immediate legacy preference model',
	availability: 'test fixture: all settings layouts',
	owner: 'test fixture: legacy preferences',
	applicableUi: 'test fixture: all UIs',
} as const;

function generatedLegacyControls(): SettingsControlCatalogItemV2[] {
	const controls = settingsInventoryKeys.map((key, index) => ({
		stableId: `settings.control.legacy-${index}`,
		route: '/settings/preferences',
		label: `Legacy ${key}`,
		aliases: [key],
		preferenceKeys: [key],
		legacyMarkerParentId: `legacy-marker-${index}`,
		legacyMarkerAncestorIds: [`legacy-marker-${index}`],
		persistence: 'profile' as const,
		saveMode: 'immediate' as const,
		availability: 'all' as const,
		owner: 'core' as const,
		applicableUi: 'all' as const,
		metadataEvidence: metadata,
		relatedHostId: `settings.control.legacy-${index}`,
		sourceFile: 'src/pages/settings/preferences.vue',
		sourceLine: index + 1,
		destructive: false,
	}));
	const animation = controls.find(control => control.preferenceKeys[0] === 'animation');
	if (animation == null) throw new Error('animation fixture is missing');
	return [...controls, { ...animation, stableId: 'settings.control.legacy-animation-duplicate', sourceLine: controls.length + 1 }];
}

function legacyMarkers(): SearchIndexItem[] {
	return settingsInventoryKeys.map((key, index) => ({
		id: `legacy-marker-${index}`,
		path: '/settings/preferences',
		label: `Legacy marker ${key}`,
		keywords: [key],
		texts: [],
	}));
}

describe('redesigned preferences search index', () => {
	test('finds UI S display size as a device setting', () => {
		const stableId = 'settings.control.device.hataskey-ui-s-display-size';
		const merged = mergeRedesignedPreferenceSearchItems([]);
		const item = merged.find(control => control.stableId === stableId);
		expect(item).toMatchObject({ destinationId: 'hataskey-ui-s', persistence: 'device', saveMode: 'immediate', preferenceKeys: [], storageRefs: [{ kind: 'local', key: 'hataskeyUiSDisplaySize' }] });
		expect(isRedesignedPreferenceSearchId(stableId)).toBe(true);
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		for (const query of ['表示サイズ', 'サイズ', '表示密度', 'コンパクト', '画面', 'UI S']) {
			expect(searchSettingsV2(catalog, query).results.some(result => result.stableId === stableId), query).toBe(true);
		}
	});
	test('routes bottom navigation searches to the UI S settings section', () => {
		const stableId = generatedPreferenceSearchId('simpleUi.bottomNav');
		const merged = mergeRedesignedPreferenceSearchItems([]);
		const item = merged.find(control => control.stableId === stableId);
		expect(item).toMatchObject({ destinationId: 'hataskey-ui-s', preferenceKeys: ['hataskeyUi3BottomNav'], saveMode: 'immediate', availability: 'all' });
		expect(canonicalSearchIdForPreferenceKey('hataskeyUi3BottomNav')).toBe(stableId);
		expect(canonicalSearchIdForPreferenceKey('simpleUi.bottomNav')).toBe(stableId);
		expect(isRedesignedPreferenceSearchId(stableId)).toBe(true);
		const generated = { ...item!, stableId: 'settings.control.generated-ui-s-bottom-nav' };
		expect(mergeRedesignedPreferenceSearchItems([generated]).filter(control => control.preferenceKeys.includes('hataskeyUi3BottomNav'))).toHaveLength(1);
		expect(redesignedPreferenceStableIdAliases([generated]).get(generated.stableId)).toBe(stableId);
		expect(preferenceDestinationForSearchTarget(item!)).toBe('hataskey-ui-s');
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		for (const query of ['下部ナビバー', '並び替え', 'モバイル', 'ウィジェット', 'HataGoes', 'Hatask', 'Hatady', 'simpleUi.bottomNav', 'hataskeyUi3BottomNav']) {
			expect(searchSettingsV2(catalog, query).results.some(result => result.stableId === stableId), query).toBe(true);
		}
	});
	test('aliases every shared custom-page border control to one new row and preserves unrelated custom controls', () => {
		const keys = ['postFormVisibilityBorder.enabled', 'postFormVisibilityBorder.width', 'postFormVisibilityBorder.color.public', 'postFormVisibilityBorder.color.home', 'postFormVisibilityBorder.color.followers', 'postFormVisibilityBorder.color.specified'];
		const custom = generatedLegacyControls().filter(item => keys.includes(item.preferenceKeys[0]!)).map(item => ({ ...item, stableId: `${item.stableId}-custom`, sourceFile: 'src/pages/settings/hata-custom.vue', route: '/settings/hata-custom', owner: 'hatasaba' as const, unmet: [{ kind: 'preference' as const, id: 'pfvbEnabled', behavior: 'explain' as const }] }));
		const unrelated = { ...custom[0]!, stableId: 'settings.control.custom-unrelated', preferenceKeys: ['hideBotsInTimeline'], aliases: ['hideBotsInTimeline'] };
		const generated = [...generatedLegacyControls(), ...custom, unrelated];
		const aliases = redesignedPreferenceStableIdAliases(generated);
		const merged = mergeRedesignedPreferenceSearchItems(generated);
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2(), aliases);
		expect(merged.find(item => item.stableId === unrelated.stableId)?.destinationId).toBe('hataskey-ui');
		expect(aliases.has(unrelated.stableId)).toBe(false);
		for (const [index, key] of keys.entries()) {
			const stableId = generatedPreferenceSearchId(key);
			expect(merged.filter(item => item.preferenceKeys.includes(key))).toHaveLength(1);
			expect(catalog.byStableId.get(stableId)?.unmet).toBeUndefined();
			expect(aliases.get(custom[index]!.stableId)).toBe(stableId);
			expect(canonicalStableIdForCatalogV2(catalog, custom[index]!.stableId)).toBe(stableId);
			expect(catalog.byStableId.get(stableId)).toMatchObject({ route: '/settings/preferences', destinationId: 'hataskey-ui-s', persistence: 'profile', saveMode: 'immediate', preferenceKeys: [key] });
		}
		for (const query of ['公開範囲', '色分け', '投稿フォーム', 'ぼかし', 'ノートの色', '左辺']) {
			const results = searchSettingsV2(catalog, query).results;
			expect(results.some(result => result.stableId === generatedPreferenceSearchId(keys[0]!)), query).toBe(true);
			expect(results.some(result => custom.some(item => item.stableId === result.stableId)), query).toBe(false);
		}
	});

	test.each([
		['hataskeyUi3SideMenuBackground', ['左サイドメニュー', '左メニュー', 'サイドバー', 'sidebar']],
		['hataskeyUi3RightPaneBackground', ['右ペイン', 'ウィジェット', 'Hatask', 'widgets']],
		['hataskeyUi3GlassDensity', ['透過度', '透明度', '濃さ', 'opacity', 'transparency', 'density', '浓度']],
	] as const)('finds the independent background setting %s by appearance aliases', (key, queries) => {
		const stableId = generatedPreferenceSearchId(key);
		const merged = mergeRedesignedPreferenceSearchItems([]);
		const descriptor = merged.find(item => item.stableId === stableId);
		expect(descriptor).toMatchObject({ destinationId: 'hataskey-ui-s', preferenceKeys: [key], persistence: 'profile', saveMode: 'immediate', owner: 'hatasaba' });
		expect(descriptor?.aliases).not.toContain('投稿フォーム');
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		for (const query of [...queries, '背景', 'すりガラス']) {
			expect(searchSettingsV2(catalog, query).results.some(result => result.stableId === stableId), query).toBe(true);
		}
	});
	test('finds the UI S background by its label and image aliases without a composer alias', () => {
		const key = 'hataskeyUi3TimelineBackground';
		const stableId = generatedPreferenceSearchId(key);
		const merged = mergeRedesignedPreferenceSearchItems([]);
		const descriptor = merged.find(item => item.stableId === stableId);
		expect(descriptor).toMatchObject({ destinationId: 'hataskey-ui-s', preferenceKeys: [key], persistence: 'profile', saveMode: 'immediate', owner: 'hatasaba' });
		expect(descriptor?.aliases).not.toContain('投稿フォーム');
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		for (const query of ['タイムライン背景', '背景', 'すりガラス', 'ヘッダー', 'アイコン', 'background', 'avatar', '磨砂玻璃']) {
			expect(searchSettingsV2(catalog, query).results.some(result => result.stableId === stableId), query).toBe(true);
		}
	});
	test('finds UI S RSS controls and keeps their device-local destination', () => {
		const merged = mergeRedesignedPreferenceSearchItems([]);
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		for (const key of ['hataskeyUi3RssEnabled', 'hataskeyUi3RssFeeds', 'hataskeyUi3RssAutoSwitch', 'hataskeyUi3RssReadSeconds', 'hataskeyUi3RssReadMode']) {
			const stableId = generatedPreferenceSearchId(key);
			expect(merged.find(item => item.stableId === stableId)).toMatchObject({ destinationId: 'hataskey-ui-s', preferenceKeys: [key], persistence: 'device' });
			for (const query of ['RSS', 'フィード', 'リーダー']) expect(searchSettingsV2(catalog, query).results.some(result => result.stableId === stableId)).toBe(true);
		}
	});
	test('finds all UI3 composer preferences in Hataskey UI S under each search term', () => {
		const key = 'hataskeyUi3ComposerPosition';
		const stableId = generatedPreferenceSearchId(key);
		const merged = mergeRedesignedPreferenceSearchItems([]);
		const descriptor = merged.find(item => item.stableId === stableId);
		expect(descriptor).toMatchObject({ destinationId: 'hataskey-ui-s', preferenceKeys: [key], persistence: 'profile', saveMode: 'immediate', owner: 'hatasaba' });
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		const keys = ['hataskeyUi3ComposerShortcut1', 'hataskeyUi3ComposerShortcut2', 'hataskeyUi3ComposerEmojiPosition', key];
		for (const preferenceKey of keys) {
			const item = merged.find(entry => entry.stableId === generatedPreferenceSearchId(preferenceKey));
			expect(item).toMatchObject({ destinationId: 'hataskey-ui-s', preferenceKeys: [preferenceKey], categoryId: 'hataskey-ui' });
			for (const query of ['投稿フォーム', 'Hataskey UI S', 'UI3']) {
				expect(searchSettingsV2(catalog, query).results.some(result => result.stableId === item?.stableId)).toBe(true);
			}
		}
		expect(searchSettingsV2(catalog, '投稿フォームの位置').results.some(result => result.stableId === stableId)).toBe(true);
	});
	test('finds both navbar switches even though they have no legacy settings controls', () => {
		const merged = mergeRedesignedPreferenceSearchItems([]);
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		for (const [key, label] of [['emojiAdditionNotice', '絵文字追加通知'], ['hourlyTimeNotice', '時報']]) {
			const stableId = generatedPreferenceSearchId(key);
			expect(merged.find(item => item.stableId === stableId)).toMatchObject({
				destinationId: 'notifications-preferences', persistence: 'profile', saveMode: 'immediate', applicableUi: 'simple', owner: 'hatasaba',
			});
			expect(searchSettingsV2(catalog, label).results.some(result => result.stableId === stableId)).toBe(true);
		}
	});
	test('legacy and new preference controls are each materialized exactly once', () => {
		expect(preferenceControls).toHaveLength(122);
		expect(preferenceAuxiliaryControls).toHaveLength(18);
		expect(settingsInventoryKeys).toHaveLength(140);
		const merged = mergeRedesignedPreferenceSearchItems(generatedLegacyControls());
		const preferenceDescriptors = merged.filter(item => item.route === '/settings/preferences');
		expect(preferenceDescriptors).toHaveLength(settingsInventoryKeys.length + 2);
		expect(new Set(preferenceDescriptors.map(item => item.preferenceKeys[0])).size).toBe(settingsInventoryKeys.length + 2);
		expect(new Set(preferenceDescriptors.map(item => item.stableId)).size).toBe(settingsInventoryKeys.length + 2);
		for (const key of settingsInventoryKeys) {
			const descriptor = preferenceDescriptors.find(item => item.preferenceKeys[0] === key);
			expect(descriptor?.stableId, key).toBe(generatedPreferenceSearchId(key));
			expect(descriptor?.legacyMarkerParentId, key).toMatch(/^legacy-marker-/u);
		}
	});

	test('runtime-generated legacy ids all rewrite to the canonical preference controls', () => {
		const generated = generatedLegacyControls();
		const aliases = new Map(redesignedPreferenceStableIdAliases(generated));
		expect(aliases.get(generatedPreferenceSearchId('hataskeyUi3BottomNav'))).toBe(generatedPreferenceSearchId('simpleUi.bottomNav'));
		aliases.delete(generatedPreferenceSearchId('hataskeyUi3BottomNav'));
		expect(aliases.size).toBe(generated.length);
		expect(new Set(aliases.values()).size).toBe(settingsInventoryKeys.length);
		for (const item of generated) expect(aliases.get(item.stableId)).toBe(generatedPreferenceSearchId(item.preferenceKeys[0]!));
		expect(aliases.get('settings.control.legacy-animation-duplicate')).toBe(generatedPreferenceSearchId('animation'));
		const unknown = { ...generated[0]!, stableId: 'settings.control.legacy-unknown', aliases: ['fixture.unknown'], preferenceKeys: ['fixture.unknown'], storageRefs: [] };
		expect(() => redesignedPreferenceStableIdAliases([unknown])).toThrow(/not represented exactly once/u);
		const multiKey = { ...generated[0]!, stableId: 'settings.control.legacy-multi', preferenceKeys: [settingsInventoryKeys[0]!, settingsInventoryKeys[1]!] };
		expect(() => redesignedPreferenceStableIdAliases([multiKey])).toThrow(/not represented exactly once/u);
		const duplicate = { ...generated[0]! };
		expect(() => redesignedPreferenceStableIdAliases([generated[0]!, duplicate])).toThrow(/duplicate legacy preference descriptor id/u);
	});

	test('legacy device swipe ids map to the redesigned swipe row only with storage evidence', () => {
		const deviceSwipe: SettingsControlCatalogItemV2 = {
			...generatedLegacyControls()[0]!,
			stableId: 'settings.control.devicehorizontalswipe-1mqerrh',
			preferenceKeys: [],
			aliases: ['deviceHorizontalSwipe'],
			storageRefs: [{ kind: 'local', key: 'hatasabaTabSwipeEnabled' }],
		};
		expect(redesignedPreferenceStableIdAliases([deviceSwipe]).get(deviceSwipe.stableId))
			.toBe(generatedPreferenceSearchId('enableHorizontalSwipe'));
		expect(() => redesignedPreferenceStableIdAliases([{ ...deviceSwipe, storageRefs: [] }])).toThrow(/not represented exactly once/u);
		expect(() => redesignedPreferenceStableIdAliases([{ ...deviceSwipe, aliases: [] }])).toThrow(/not represented exactly once/u);
		expect(() => redesignedPreferenceStableIdAliases([{ ...deviceSwipe, preferenceKeys: ['lang'] }])).toThrow(/not represented exactly once/u);
	});

	test('legacy runtime ids are inferred from aliases and storage evidence', () => {
		const base = generatedLegacyControls()[0]!;
		const special = (overrides: Partial<SettingsControlCatalogItemV2>): SettingsControlCatalogItemV2 => ({
			...base,
			...overrides,
		});
		const dataSaverKeys = [
			'dataSaver.media',
			'dataSaver.avatar',
			'dataSaver.disableUrlPreview',
			'dataSaver.urlPreviewThumbnail',
			'dataSaver.code',
		] as const;
		const generated = [
			special({
				stableId: 'settings.control.lang-iirt1l',
				preferenceKeys: [],
				aliases: ['lang'],
				storageRefs: [{ kind: 'local', key: 'lang' }],
			}),
			special({
				stableId: 'settings.control.useboldfont-1hpnn4z',
				preferenceKeys: [],
				aliases: ['useBoldFont'],
				storageRefs: [{ kind: 'local', key: 'useBoldFont' }],
			}),
			special({
				stableId: 'settings.control.usesystemfont-1nx4imd',
				preferenceKeys: [],
				aliases: ['useSystemFont'],
				storageRefs: [{ kind: 'local', key: 'useSystemFont' }],
			}),
			...dataSaverKeys.map((key, index) => special({
				stableId: `settings.control.data-saver-${index}`,
				preferenceKeys: ['dataSaver'],
				aliases: [key],
				storageRefs: [{ kind: 'pref', key: 'dataSaver' }],
			})),
			special({
				stableId: 'settings.group.src-pages-settings-preferences-vue-pu703b',
				preferenceKeys: [],
				aliases: ['i18n.ts.additionalEmojiDictionary'],
				storageRefs: [{ kind: 'pizzax', store: 'base', key: 'additionalUnicodeEmojiIndexes', scope: 'device' }],
				isGroup: true,
			}),
			special({
				stableId: 'settings.control.i18n-ts-enableall-1fiasic',
				preferenceKeys: [],
				aliases: ['i18n.ts.enableAll'],
				storageRefs: [{ kind: 'pref', key: 'dataSaver' }],
			}),
			special({
				stableId: 'settings.control.i18n-ts-disableall-1y966ue',
				preferenceKeys: [],
				aliases: ['i18n.ts.disableAll'],
				storageRefs: [{ kind: 'pref', key: 'dataSaver' }],
			}),
		];
		const aliases = redesignedPreferenceStableIdAliases(generated);

		expect(aliases.get('settings.control.lang-iirt1l')).toBe(generatedPreferenceSearchId('lang'));
		expect(aliases.get('settings.control.useboldfont-1hpnn4z')).toBe(generatedPreferenceSearchId('useBoldFont'));
		expect(aliases.get('settings.control.usesystemfont-1nx4imd')).toBe(generatedPreferenceSearchId('useSystemFont'));
		for (const [index, key] of dataSaverKeys.entries()) {
			expect(aliases.get(`settings.control.data-saver-${index}`)).toBe(generatedPreferenceSearchId(key));
		}
		expect(aliases.get('settings.group.src-pages-settings-preferences-vue-pu703b')).toBe(generatedPreferenceSearchId('additionalUnicodeEmojiIndexes'));
		expect(aliases.get('settings.control.i18n-ts-enableall-1fiasic')).toBe('settings.destination.misskey-data-saver');
		expect(aliases.get('settings.control.i18n-ts-disableall-1y966ue')).toBe('settings.destination.misskey-data-saver');

		const collision = special({
			stableId: 'settings.control.alias-collision',
			preferenceKeys: ['lang'],
			aliases: ['lang', 'i18n.ts.enableAll'],
			storageRefs: [{ kind: 'local', key: 'lang' }],
		});
		expect(redesignedPreferenceStableIdAliases([collision]).get(collision.stableId)).toBe(generatedPreferenceSearchId('lang'));

		const storageFreeEnableAll = special({
			stableId: 'settings.control.i18n-ts-enableall-without-storage',
			preferenceKeys: [],
			aliases: ['i18n.ts.enableAll'],
			storageRefs: [],
		});
		expect(() => redesignedPreferenceStableIdAliases([storageFreeEnableAll])).toThrow();

		const ambiguousBulkAction = special({
			stableId: 'settings.control.bulk-data-saver-ambiguous',
			preferenceKeys: [],
			aliases: ['i18n.ts.enableAll', 'i18n.ts.disableAll'],
			storageRefs: [{ kind: 'pref', key: 'dataSaver' }],
		});
		expect(() => redesignedPreferenceStableIdAliases([ambiguousBulkAction])).toThrow();
	});

	test('the legacy page generator cannot make a dynamic new-surface setting disappear', () => {
		const merged = mergeRedesignedPreferenceSearchItems([]);
		expect(merged).toHaveLength(settingsInventoryKeys.length + 2);
		const catalog = buildSettingsCatalogV2([], merged, undefined, settingsDestinationCatalogItemsV2());
		for (const key of settingsInventoryKeys) {
			const stableId = generatedPreferenceSearchId(key);
			expect(catalog.byStableId.get(stableId)?.controlId, key).toBe(stableId);
			expect(searchSettingsV2(catalog, key).results.some(result => result.stableId === stableId), key).toBe(true);
			expect(preferenceDestinationForSearchTarget(catalog.byStableId.get(stableId)!), key).not.toBeNull();
			expect(isRedesignedPreferenceSearchId(stableId), key).toBe(true);
		}
	});

	test('CherryPick-owned controls keep their product category even when their destination is shared', () => {
		const catalog = buildSettingsCatalogV2([], mergeRedesignedPreferenceSearchItems([]), undefined, settingsDestinationCatalogItemsV2());
		const cherryKeys = preferenceControls.filter(control => control.cherry).map(control => control.key);
		expect(cherryKeys).toHaveLength(36);
		for (const key of cherryKeys) {
			const descriptor = catalog.byStableId.get(generatedPreferenceSearchId(key));
			expect(descriptor?.categoryId, key).toBe('cherrypick');
			expect(descriptor?.owner, key).toBe('cherrypick');
		}
		for (const control of preferenceAuxiliaryControls.filter(control => 'cherry' in control && control.cherry === true)) {
			const descriptor = catalog.byStableId.get(generatedPreferenceSearchId(control.key));
			expect(descriptor?.categoryId, control.key).toBe('cherrypick');
			expect(descriptor?.owner, control.key).toBe('cherrypick');
		}
	});

	test('manifest destinationと明示source mapが、旧markerではない関連fallbackの正本になる', () => {
		const destinations = settingsDestinationCatalogItemsV2();
		// Hataskey UI S と、コンカレント連携(BETA)を加えた現在の destination は53件。
		expect(destinations).toHaveLength(53);
		expect(new Set(destinations.map(item => item.destinationId)).size).toBe(53);
		for (const destination of destinations) expect(destination.label.trim(), destination.destinationId).not.toBe('');
		const mappedSources = [
			['src/pages/settings/accounts.vue', 'account-switch', 'account-profiles', '/settings/accounts'],
			['src/pages/settings/avatar-decoration.vue', 'account-avatar', 'account-profile', '/settings/avatar-decoration'],
			['src/pages/settings/cherrypick.vue', 'cherrypick-settings', 'cherrypick-display', '/settings/cherrypick'],
			['src/pages/settings/connect.vue', 'account-connect', 'account-apps', '/settings/connect'],
			['src/pages/settings/privacy.vue', 'account-privacy', 'account-security', '/settings/privacy'],
			['src/pages/settings/profile.vue', 'account-profile', 'account-avatar', '/settings/profile'],
			['src/pages/settings/drive.vue', 'account-drive', 'account-drive-cleaner', '/settings/drive'],
			['src/pages/settings/deck.vue', 'misskey-deck', 'misskey-navbar', '/settings/deck'],
			['src/pages/settings/hata-custom.vue', 'hataskey-ui', 'hata-settings-transfer', '/settings/hata-custom'],
			['src/pages/settings/hidden-reactions-manage.vue', 'timeline-hidden-reactions', 'timeline-display', '/settings/hidden-reactions'],
			['src/pages/settings/notifications.vue', 'notifications-page', 'notifications-sounds', '/settings/notifications'],
			['src/pages/settings/timeline.vue', 'timeline-display', 'timeline-note-display', '/settings/timeline'],
		] as const;
		const retained = mergeRedesignedPreferenceSearchItems(mappedSources.map(([sourceFile, _destinationId, _relationDestinationId, route], index) => ({
			stableId: `settings.control.source-${index}`, route, label: `source ${index}`, aliases: [], preferenceKeys: [], legacyMarkerAncestorIds: [],
			persistence: 'profile', saveMode: 'immediate', availability: 'all', owner: 'core', applicableUi: 'all', metadataEvidence: metadata,
			relatedHostId: `settings.control.source-${index}`, sourceFile, sourceLine: index + 1, destructive: false,
		} satisfies SettingsControlCatalogItemV2)));
		for (const [sourceFile, destinationId, relationDestinationId] of mappedSources) {
			const item = retained.find(item => item.sourceFile === sourceFile);
			expect(item?.destinationId).toBe(destinationId);
			expect(item?.relationDestinationId).toBe(relationDestinationId);
		}
		for (const key of settingsInventoryKeys) {
			const item = retained.find(item => item.preferenceKeys[0] === key)!;
			expect(item.destinationId, key).toBe(preferenceDestinationForSearchTarget(item));
			expect(item.relationDestinationId, key).toBeTruthy();
			expect(item.relationDestinationId, key).not.toBe(item.destinationId);
		}
	});

	test('legacy preference markers remain lookup-compatible but cannot be returned by the redesigned search', () => {
		const catalog = buildSettingsCatalogV2(legacyMarkers(), mergeRedesignedPreferenceSearchItems(generatedLegacyControls()), undefined, settingsDestinationCatalogItemsV2());
		const markers = catalog.descriptors.filter(item => item.source === 'legacy' && item.route === '/settings/preferences');
		const source = catalog.byStableId.get(generatedPreferenceSearchId(settingsInventoryKeys[0]!))!;
		expect(source.related.length).toBeGreaterThan(0);
		const beforeTotal = source.relatedTotal!;
		const marker = markers[0]!;
		source.related = [...source.related, { stableId: marker.stableId, kind: 'fallback', reason: 'fixture', weight: 0 }];
		source.relatedIds = source.related.map(relation => relation.stableId);
		source.relatedTotal = beforeTotal + 1;
		suppressLegacyPreferenceSearchMarkers(catalog);
		expect(markers).toHaveLength(140);
		for (const descriptor of markers) {
			expect(descriptor.searchable).toBe(false);
			expect(descriptor.related).toEqual([]);
		}
		expect(source.relatedIds).not.toContain(marker.stableId);
		expect(source.relatedTotal).toBe(beforeTotal);
		expect(catalog.descriptors.some(descriptor => descriptor.source === 'destination' && descriptor.route === '/settings/preferences' && descriptor.searchable)).toBe(false);
		expect(catalog.descriptors.every(descriptor => !descriptor.relatedIds.some(id => markers.some(markerDescriptor => markerDescriptor.stableId === id)))).toBe(true);
		for (const key of settingsInventoryKeys) {
			const control = catalog.byStableId.get(generatedPreferenceSearchId(key));
			expect(control?.anchor, key).toMatch(/^legacy-marker-/u);
			expect(canonicalSearchIdForDescriptor(control!, catalog.descriptors), key).toBe(generatedPreferenceSearchId(key));
		}
	});

	test('production merge keeps every searchable control related while legacy markers and navigation-only destinations stay out of direct search', () => {
		const catalog = buildSettingsCatalogV2(legacyMarkers(), mergeRedesignedPreferenceSearchItems(generatedLegacyControls()), undefined, settingsDestinationCatalogItemsV2());
		suppressLegacyPreferenceSearchMarkers(catalog);
		assertSettingsCatalogRelationsV2(catalog);
		const zeroRelated = catalog.descriptors.filter(descriptor => descriptor.source === 'control' && descriptor.searchable && !descriptor.destructive && descriptor.related.length === 0);
		expect(zeroRelated).toHaveLength(0);
		const legacyMarkersInRelations = new Set(catalog.descriptors.filter(descriptor => descriptor.source === 'legacy' && descriptor.route === '/settings/preferences').map(descriptor => descriptor.stableId));
		expect(catalog.descriptors.every(descriptor => descriptor.relatedIds.every(id => !legacyMarkersInRelations.has(id)))).toBe(true);
		for (const descriptor of catalog.descriptors) {
			for (const related of getRelatedSettingsV2(catalog, descriptor.stableId)) {
				expect(related.destructive).not.toBe(true);
				expect(related.searchable || related.source === 'destination').toBe(true);
				expect(related.source === 'destination' && descriptor.route === related.route && descriptor.destinationId != null && descriptor.destinationId === related.destinationId).toBe(false);
			}
		}
		const destination = catalog.descriptors.find(descriptor => descriptor.source === 'destination')!;
		expect(searchSettingsV2(catalog, destination.label).results.some(result => result.stableId === destination.stableId)).toBe(false);
	});
});
