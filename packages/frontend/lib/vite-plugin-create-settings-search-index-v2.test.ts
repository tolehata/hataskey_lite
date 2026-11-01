/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { compileTemplate, parse as parseSfc } from 'vue/compiler-sfc';
import { load as loadYaml } from 'js-yaml';
import { resolveSettingsControlSearchDescriptionV2, resolveSettingsControlSearchLabelV2, toSettingsControlCatalogItemsV2 } from '../src/utility/settings-control-search-v2.js';
import { canonicalStableIdForCatalogV2, assertSettingsCatalogRelationsV2, buildSettingsCatalogV2, searchSettingsV2 } from '../src/utility/settings-search-v2.js';
import { initIntlString } from '../src/utility/intl-string.js';
import { MarkerIdAssigner, collectFileMarkers } from './vite-plugin-create-search-index.js';
import {
	aggregateParentContainedSettingsVocabularyV2,
	collectSettingsControlDescriptorsV2,
	collectSettingsDescriptorReachabilityAuditV2,
	collectSettingsSearchDescriptorsV2,
	collectSettingsInteractiveInventoryV2,
	collectSettingsInteractiveStaticGroupsV2,
	collectStaticGroupHostsV2,
	collectSettingsStorageKeyAuditV2,
	collectSettingsStorageKeyAuditFromRepositoryV2,
	collectSettingsTransitiveControlAuditV2,
	default as pluginCreateSettingsSearchIndexV2,
	injectSettingsSearchIdsV2,
	readSettingsRoutesV2,
	resolveSettingsInteractiveInventoryDispositionsV2,
	SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2,
	validateSettingsControlDescriptorsV2,
} from './vite-plugin-create-settings-search-index-v2.js';

// Catalog tests explicitly install the real locale below. The bootstrap
// module normally fetches it, which is unrelated to this offline generator.
vi.mock('@@/js/locale.js', () => ({ locale: {} }));

const routes = readSettingsRoutesV2(`
	children: [{ path: '/deck', component: page(() => import('@/pages/settings/deck.vue')) }, {
		path: '/statusbar', component: page(() => import('@/pages/settings/statusbar.vue'))
	}]
`);

const extensionTargets = [
	{
		filePath: 'src/components/MkNoteCharmSettings.vue',
		routeOverride: '/settings/note-charm',
		owner: 'hatasaba',
		applicableUi: 'all',
	},
	{
		filePath: 'src/components/concrnt/ConcrntSettings.vue',
		routeOverride: '/settings/concrnt',
		persistence: 'device',
		saveMode: 'immediate',
		availability: 'all',
		owner: 'hatasaba',
		applicableUi: 'all',
	},
	{
		filePath: 'src/pages/settings/index.vue',
		routeOverride: '/settings',
		persistence: 'device',
		saveMode: 'immediate',
		owner: 'core',
		applicableUi: 'all',
	},
	{
		// The popup is now a thin window wrapper. The shared body carries every
		// meaningful setting control and is also used by the permanent surface.
		filePath: 'src/components/HatasabaUi2SettingsBody.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' },
	},
	{
		filePath: 'src/components/HatasabaUi2ImmediateSettings.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'hata-custom-category', category: 'glassUi' },
		saveMode: 'immediate',
		owner: 'hatasaba',
		applicableUi: 'simple',
	},
	{
		filePath: 'src/components/MkEarthquakeSettings.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'popup', category: 'earthquake', popup: 'earthquake' },
	},
	{
		filePath: 'src/components/MkPushNotificationAllowButton.vue',
		routeOverride: '/settings/notifications',
		persistence: 'account',
		saveMode: 'immediate',
		availability: 'all',
		owner: 'core',
		applicableUi: 'all',
	},
	{
		filePath: 'src/components/MkUISetup.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'popup', category: 'general', popup: 'ui-setup' },
	},
	{
		filePath: 'src/components/MkHataSettingsTransfer.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'popup', category: 'general', popup: 'settings-transfer' },
	},
	{
		filePath: 'src/pages/HataskSettings.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'popup', category: 'hatask', popup: 'hatask' },
	},
	{
		filePath: 'src/components/HataFeedDisplaySettings.vue',
		routeOverride: '/settings/hatafeed',
		saveMode: 'immediate',
		owner: 'hatasaba',
		applicableUi: 'all',
	},
	{
		filePath: 'src/components/HatadyDisplaySettings.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'popup', category: 'hatady', popup: 'hatady' },
	},
	{
		filePath: 'src/pages/MkMascotSettings.vue',
		routeOverride: '/settings/hata-custom',
		activation: { kind: 'popup', category: 'mascot', popup: 'mascot' },
	},
] as const;

const activationTargets = extensionTargets.flatMap(target => target.activation == null ? [] : [target.activation]);

function targetMetadata(sourceFile: string) {
	const target = extensionTargets.find(candidate => candidate.filePath === sourceFile);
	if (target == null) return {};
	const { filePath: _filePath, ...metadata } = target;
	return metadata;
}

async function collectRealSettingsInventory() {
	const [routerSource, settingsFiles] = await Promise.all([
		fs.readFile('src/router.definition.ts', 'utf8'),
		glob('src/pages/settings/*.vue'),
	]);
	const files = [...new Set([...settingsFiles, ...extensionTargets.map(target => target.filePath)])].sort();
	const currentRoutes = readSettingsRoutesV2(routerSource);
	const results = await Promise.all(files.map(async sourceFile => {
		const source = await fs.readFile(sourceFile, 'utf8');
		return {
			sourceFile,
			source,
			descriptors: collectSettingsSearchDescriptorsV2(sourceFile, source, currentRoutes, targetMetadata(sourceFile)),
			injected: injectSettingsSearchIdsV2(sourceFile, source, currentRoutes, targetMetadata(sourceFile), activationTargets),
		};
	}));
	const descriptors = await aggregateParentContainedSettingsVocabularyV2(process.cwd(), currentRoutes, results.flatMap(result => result.descriptors));
	return { currentRoutes, files, results, descriptors };
}

async function collectRealInteractiveInventory() {
	const files = [...new Set([...await glob('src/pages/settings/*.vue'), ...extensionTargets.map(target => target.filePath)])].sort();
	const items = (await Promise.all(files.map(async sourceFile => collectSettingsInteractiveInventoryV2(sourceFile, await fs.readFile(sourceFile, 'utf8'))))).flat();
	return { files, items };
}

async function collectStorageAuditInput() {
	const inventory = await collectRealSettingsInventory();
	const settingsSourceFiles = new Set(inventory.files);
	const registryFiles = new Set([
		'src/preferences/def.ts',
		'src/store.ts',
		'src/ui/deck/deck-store.ts',
		'src/local-storage.ts',
	]);
	const runtimeFiles = (await glob('src/**/*.{ts,vue}')).sort()
		.filter(file => !settingsSourceFiles.has(file) && !registryFiles.has(file));
	const [preferenceDefinition, baseStore, deckStore, localStorageDefinition, runtimeSources] = await Promise.all([
		fs.readFile('src/preferences/def.ts', 'utf8'),
		fs.readFile('src/store.ts', 'utf8'),
		fs.readFile('src/ui/deck/deck-store.ts', 'utf8'),
		fs.readFile('src/local-storage.ts', 'utf8'),
		Promise.all(runtimeFiles.map(async file => ({ file, code: await fs.readFile(file, 'utf8') }))),
	]);
	return {
		preferenceDefinition,
		pizzaxStores: [
			{ store: 'base' as const, source: baseStore },
			{ store: 'deck' as const, source: deckStore },
		],
		localStorageDefinition,
		settingsSources: inventory.results.map(result => ({ file: result.sourceFile, code: result.source })),
		runtimeSources,
		descriptors: inventory.descriptors,
	};
}

async function collectRealLegacyIndex() {
	const files = (await glob('src/pages/settings/*.vue')).sort();
	const assigner = new MarkerIdAssigner();
	return (await Promise.all(files.map(async sourceFile => {
		const source = await fs.readFile(sourceFile, 'utf8');
		const absoluteFile = path.join(process.cwd(), sourceFile);
		return collectFileMarkers(absoluteFile, assigner.processFile(absoluteFile, source).code);
	}))).flat();
}

export function resolveRuntimeI18nTextV2(value: string, translations: Record<string, unknown>): string {
	const resolveExpression = (expression: string): string => {
		const match = expression.match(/^i18n\.ts((?:\.[A-Za-z0-9_]+|\[['"][^'"]+['"]\])+)$/u);
		if (match == null) throw new Error(`unresolved runtime i18n expression: ${expression}`);
		const parts = [...match[1].matchAll(/\.([A-Za-z0-9_]+)|\[['"]([^'"]+)['"]\]/gu)].map(item => item[1] ?? item[2]);
		let current: unknown = translations;
		for (const part of parts) current = current != null && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined;
		if (typeof current !== 'string') throw new Error(`runtime i18n expression is not a string: ${expression}`);
		return current;
	};
	return value.replace(/\$\{([^{}]+)\}/gu, (_whole, expression: string) => resolveExpression(expression))
		.replace(/(?<![\w$])i18n\.ts((?:\.[A-Za-z0-9_]+|\[['"][^'"]+['"]\])+)/gu, (_whole, suffix: string) => resolveExpression(`i18n.ts${suffix}`))
		.replace(/\$\{[^{}]*\}/gu, () => { throw new Error(`unresolved runtime i18n text: ${value}`); });
}

async function buildRealCatalogFromVirtualModule() {
	const plugin = pluginCreateSettingsSearchIndexV2({
		targetFilePaths: ['src/pages/settings/*.vue', ...extensionTargets],
		mainVirtualModule: 'search-index-v2:settings-real-catalog',
		routerDefinitionPath: 'src/router.definition.ts',
		expectedControlCount: 547,
	});
	const load = typeof plugin.load === 'function' ? plugin.load : undefined;
	if (load == null) throw new Error('settings V2 plugin did not expose virtual loader');
	const generated = await load.call({}, '\0search-index-v2:settings-real-catalog');
	const payload = (generated as string).match(/^export const settingsControlSearchIndexV2 = ([\s\S]+);\n$/u)?.[1];
	if (payload == null) throw new Error('settings V2 virtual module payload is missing');
	const descriptors = JSON.parse(payload);
	const translations = loadYaml(await fs.readFile('../../locales/ja-JP.yml', 'utf8')) as Record<string, unknown>;
	const { updateI18n } = await import('../src/i18n.js');
	updateI18n(translations as never);
	const {
		mergeRedesignedPreferenceSearchItems,
		redesignedPreferenceStableIdAliases,
		settingsDestinationCatalogItemsV2,
		suppressLegacyPreferenceSearchMarkers,
	} = await import('../src/pages/settings-redesign/settings-preferences-search-index.js');
	const { generatedPreferenceSearchId } = await import('../src/pages/settings-redesign/settings-preferences-catalog.js');
	const [rawLegacy, inventory] = await Promise.all([
		collectRealLegacyIndex(),
		collectRealInteractiveInventory(),
	]);
	const legacy = rawLegacy.map(item => ({
		...item,
		label: resolveRuntimeI18nTextV2(item.label, translations),
		texts: item.texts.map(text => resolveRuntimeI18nTextV2(text, translations)),
		keywords: item.keywords.map(keyword => resolveRuntimeI18nTextV2(keyword, translations)),
	}));
	const controls = toSettingsControlCatalogItemsV2(descriptors, translations);
	const catalog = buildSettingsCatalogV2(legacy, controls);
	const stableIdAliases = redesignedPreferenceStableIdAliases(controls);
	const productionCatalog = buildSettingsCatalogV2(
		legacy,
		mergeRedesignedPreferenceSearchItems(controls),
		undefined,
		settingsDestinationCatalogItemsV2(),
		stableIdAliases,
	);
	suppressLegacyPreferenceSearchMarkers(productionCatalog);
	return { catalog, productionCatalog, controls, descriptors, inventory, legacy, stableIdAliases, generatedPreferenceSearchId };
}

describe('settings control search index V2', () => {
	test('LTL emoji vote setting uses the same visible timeline destination from navigation and search', async () => {
		const { productionCatalog, generatedPreferenceSearchId } = await buildRealCatalogFromVirtualModule();
		const { controlsForPreferenceDestination } = await import('../src/pages/settings-redesign/settings-preferences-catalog.js');
		const { settingsDestinationSections } = await import('../src/pages/settings-redesign/settings-destinations.js');
		const destination = settingsDestinationSections.find(section => section.id === 'timeline-posting')?.items.find(item => item.id === 'timeline-group');
		expect(destination?.route).toBe('/settings/preferences');
		expect(controlsForPreferenceDestination('timeline-group').filter(control => control.key === 'ltlEmojiVoteEnabled')).toHaveLength(1);
		for (const query of ['LTLの絵文字投票を表示', '絵文字投票', 'ltlEmojiVoteEnabled']) {
			const result = searchSettingsV2(productionCatalog, query).results.find(item => item.preferenceKeys.includes('ltlEmojiVoteEnabled'));
			expect(result, query).toMatchObject({
				stableId: generatedPreferenceSearchId('ltlEmojiVoteEnabled'),
				route: destination?.route,
				destinationId: destination?.id,
			});
			expect(result?.activation, query).toBeUndefined();
		}
		expect(productionCatalog.descriptors.filter(item => item.searchable && item.preferenceKeys.includes('ltlEmojiVoteEnabled'))).toHaveLength(1);
	});

	test('LTL絵文字投票の設定を両検索経路へ載せ、一般カテゴリの既存stableIdを保つ', async () => {
		const sourceFile = 'src/pages/settings/preferences.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const absoluteFile = path.join(process.cwd(), sourceFile);
		const assigned = new MarkerIdAssigner().processFile(absoluteFile, source).code;
		const legacy = collectFileMarkers(absoluteFile, assigned).find(marker => marker.label.includes('showLtlEmojiVote'));
		expect(legacy?.keywords).toEqual(expect.arrayContaining(['ltl', 'emoji', 'vote', 'deck', '絵文字', '投票']));
		expect(legacy?.texts.join(' ')).toContain('showLtlEmojiVoteDescription');
		const currentRoutes = readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8'));
		const entries = collectSettingsControlDescriptorsV2(sourceFile, source, currentRoutes).filter(entry => entry.preferenceKeys.includes('ltlEmojiVoteEnabled'));
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			route: '/settings/preferences', component: 'MkSwitch', persistence: 'profile', searchable: true,
			labelI18nKeys: ['i18n.ts._hata._customSettings._general.showLtlEmojiVote'],
			captionI18nKeys: ['i18n.ts._hata._customSettings._general.showLtlEmojiVoteDescription'],
		});
		expect(entries[0].activation).toBeUndefined();
		const hataCustomFile = 'src/pages/settings/hata-custom.vue';
		const hataCustomSource = await fs.readFile(hataCustomFile, 'utf8');
		expect(hataCustomSource).not.toContain('ltlEmojiVoteEnabled');
		const groups = collectSettingsSearchDescriptorsV2(hataCustomFile, hataCustomSource, currentRoutes).filter(entry => entry.isGroup && entry.labelI18nKeys?.includes('i18n.ts._hata._customSettings.title'));
		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({
			stableId: 'settings.group.src-pages-settings-hata-custom-vue-28qg9w',
			activation: { kind: 'hata-custom-category', category: 'general' },
		});
	});

	test('runtime i18n template literal is resolved from the locale tree and unresolved expressions fail', () => {
		const translations = { _preferencesProfile: { manageProfiles: 'プロファイルの管理' } };
		expect(resolveRuntimeI18nTextV2('${i18n.ts._preferencesProfile.manageProfiles}', translations)).toBe('プロファイルの管理');
		expect(() => resolveRuntimeI18nTextV2('${i18n.ts._preferencesProfile.missing}', translations)).toThrow('runtime i18n expression');
	});
	test('実routerではsettings componentを同一route objectのpathへ対応させ、直前の動的routeを跨がない', async () => {
		const currentRoutes = readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8'));
		expect(currentRoutes.get('profile')).toBe('/settings/profile');
		expect(currentRoutes.get('webhook.edit')).toBe('/settings/webhook/edit/:webhookId');
		expect([...currentRoutes.values()]).not.toContain('/settings/instance-info/:host');
	});

	test('SearchMarkerがなくてもフォーム操作を個別に抽出し、親マーカーと設定キーを保持する', () => {
		const entries = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<SearchMarker markerId="deck-root"><MkPreferenceContainer k="deck.columnGap">
				<MkRange v-model="columnGap"><template #label>{{ i18n.ts._deck.columnGap }}</template></MkRange>
			</MkPreferenceContainer></SearchMarker>
			<MkSwitch v-model="unmarked"><template #label>Unmarked switch</template></MkSwitch>
		</template>`, routes);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({ route: '/settings/deck', modelExpression: 'columnGap', preferenceKeys: ['deck.columnGap'], legacyMarkerParentId: 'deck-root', searchable: true });
		expect(entries[1]).toMatchObject({ route: '/settings/deck', modelExpression: 'unmarked', searchable: true });
		expect(entries[0].stableId).not.toContain(':');
	});

	test('nested SearchMarkerの祖先stackをrootから保持し、兄弟と非Markerは混ぜない', () => {
		const entries = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<SearchMarker markerId="root"><MkSwitch v-model="rootValue">Root</MkSwitch>
				<SearchMarker markerId="child"><MkSwitch v-model="childValue">Child</MkSwitch></SearchMarker>
			</SearchMarker>
			<SearchMarker markerId="sibling"><MkSwitch v-model="siblingValue">Sibling</MkSwitch></SearchMarker>
			<MkSwitch v-model="outsideValue">Outside</MkSwitch>
		</template>`, routes);
		expect(entries.map(entry => ({ parent: entry.legacyMarkerParentId, ancestors: entry.legacyMarkerAncestorIds }))).toEqual([
			{ parent: 'root', ancestors: ['root'] },
			{ parent: 'child', ancestors: ['root', 'child'] },
			{ parent: 'sibling', ancestors: ['sibling'] },
			{ parent: undefined, ancestors: [] },
		]);
		expect(toSettingsControlCatalogItemsV2(entries, {}).map(entry => entry.legacyMarkerAncestorIds)).toEqual([
			['root'], ['root', 'child'], ['sibling'], [],
		]);
		expect(entries[0].stableId).not.toBe(entries[1].stableId);
	});

	test('条件付き・動的ラベルを落とさず、検索不能理由を明示する', () => {
		const entries = collectSettingsControlDescriptorsV2('src/pages/settings/statusbar.statusbar.vue', `<template>
			<MkInput v-if="statusbar.type === 'rss'" v-model="statusbar.props.url"><template #label>{{ statusbar.name }}</template></MkInput>
		</template>`, routes);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ route: '/settings/statusbar', searchable: false, intentionallyExcluded: true });
		expect(entries[0].conditions).toEqual(["statusbar.type === 'rss'"]);
	});

	test('純i18nラベルは安全なresolverで実行時の検索・表示文言へ変換する', () => {
		const [entry] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="enabled"><template #label>{{ i18n.ts._deck.columnGap }}</template></MkSwitch>
		</template>`, routes);
		expect(entry).toMatchObject({ searchable: true, label: '', labelI18nKeys: ['i18n.ts._deck.columnGap'] });
		expect(resolveSettingsControlSearchLabelV2(entry, { _deck: { columnGap: 'カラムの間隔' } })).toBe('カラムの間隔');
		expect(toSettingsControlCatalogItemsV2([entry], { _deck: { columnGap: 'カラムの間隔' } })[0]).toMatchObject({ label: 'カラムの間隔', route: '/settings/deck' });
		// A searchable descriptor is an inventory contract. Missing locale copy
		// must report its exact provenance instead of silently shrinking search.
		expect(() => toSettingsControlCatalogItemsV2([entry], {})).toThrow(new RegExp(`unresolved searchable label: ${entry.stableId} \\(src/pages/settings/deck\\.vue:${entry.sourceLine}\\)`));
		const unsafe = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="enabled"><template #label>{{ i18n.tsx.example({ n: count }) }}</template></MkSwitch>
		</template>`, routes)[0];
		expect(unsafe).toMatchObject({ searchable: false, intentionallyExcluded: true });
	});

	test('captionはliteral又は許可済みi18nだけを利用者向けdescriptionへ渡す', () => {
		const [literal] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="enabled"><template #label>有効</template><template #caption>短い説明</template></MkSwitch>
		</template>`, routes);
		expect(resolveSettingsControlSearchDescriptionV2(literal, {})).toBe('短い説明');
		expect(toSettingsControlCatalogItemsV2([literal], {})[0]).toMatchObject({ description: '短い説明' });
		const [safe] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="enabled"><template #label>有効</template><template #caption>{{ i18n.ts.help }}</template></MkSwitch>
		</template>`, routes);
		expect(resolveSettingsControlSearchDescriptionV2(safe, { help: 'ヘルプ文' })).toBe('ヘルプ文');
		expect(toSettingsControlCatalogItemsV2([safe], { help: 'ヘルプ文' })[0]).toMatchObject({ description: 'ヘルプ文' });
		const [unsafe] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="enabled"><template #label>有効</template><template #caption>{{ pageLocalHint }}</template></MkSwitch>
		</template>`, routes);
		expect(resolveSettingsControlSearchDescriptionV2(unsafe, {})).toBeNull();
		expect(toSettingsControlCatalogItemsV2([unsafe], {})[0]).not.toHaveProperty('description');
	});

	test('script setupの安全なi18n alias chainを正規化し、関数呼出は除外する', () => {
		const [entry] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="enabled"><template #label>{{ generalCopy.enabled }}</template></MkSwitch>
		</template><script setup lang="ts">
			const enabled = prefer.model('enabled');
			const copy = i18n.ts._hata._customSettings;
			const generalCopy = copy._general;
			const unsafeCopy = makeCopy(i18n.ts._hata);
		</script>`, routes, { persistence: 'profile' });
		expect(entry).toMatchObject({
			searchable: true,
			labelExpression: '${i18n.ts._hata._customSettings._general.enabled}',
			labelI18nKeys: ['i18n.ts._hata._customSettings._general.enabled'],
		});
		expect(resolveSettingsControlSearchLabelV2(entry, { _hata: { _customSettings: { _general: { enabled: '有効' } } } })).toBe('有効');
		const [unsafe] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="enabled"><template #label>{{ unsafeCopy.enabled }}</template></MkSwitch>
		</template><script setup>const unsafeCopy = makeCopy(i18n.ts._hata);</script>`, routes, { persistence: 'profile' });
		expect(unsafe).toMatchObject({ searchable: false, intentionallyExcluded: true });
	});

	test('ラベルを持たない補助controlは最寄りSearchMarkerの安全な表示名を使う', () => {
		const source = '<template><SearchMarker :label="i18n.ts.group"><MkSwitch v-model="enabled"></MkSwitch><input v-model="nativeEnabled" /></SearchMarker></template>';
		const entries = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', source, routes);
		expect(entries).toHaveLength(2);
		expect(entries.every(entry => entry.searchable && entry.inheritedLabel)).toBe(true);
		expect(entries[0].labelI18nKeys).toEqual(['i18n.ts.group']);
		const injected = injectSettingsSearchIdsV2('src/pages/settings/deck.vue', source, routes);
		expect(injected.code).toMatch(/<MkSwitch[^>]*data-settings-search-id="[^"]+"[^>]*><\/MkSwitch>/u);
		expect(injected.code).toMatch(/<input[^>]*data-settings-search-id="[^"]+"[^>]*\/>/u);
		expect(parseSfc(injected.code).errors).toHaveLength(0);
	});

	test('warning/alert/errorの近接コピーは未ラベルcontrolの検索ラベルへ昇格しない', () => {
		for (const className of ['warning', 'alert', 'error']) {
			const source = `<template><div class="${className}">{{ i18n.ts.nearbyNotice }}</div><MkSwitch v-model="enabled"></MkSwitch></template>`;
			const [entry] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', source, routes);
			expect(entry, className).toMatchObject({ searchable: false, intentionallyExcluded: true });
			expect(entry.labelI18nKeys, className).toBeUndefined();
			expect(entry.inheritedLabel, className).toBeUndefined();
		}
	});

	test('重複ID・壊れたroute・件数回帰の陽性対照を検出する', () => {
		const entry = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', '<template><MkSwitch v-model="a">A</MkSwitch></template>', routes)[0];
		expect(() => validateSettingsControlDescriptorsV2([entry, { ...entry }])).toThrow('duplicate stable id');
		expect(() => validateSettingsControlDescriptorsV2([{ ...entry, route: '/broken' }])).toThrow('invalid route');
		expect(() => validateSettingsControlDescriptorsV2([entry], 2)).toThrow('count regression');
		expect(() => validateSettingsControlDescriptorsV2([{ ...entry, intentionallyExcluded: true, exclusionReason: 'positive control' }])).toThrow('contradictory classification');
	});

	test('表示コピーではstableIdを保ち、条件は意味の異なるcontrolとして区別する', () => {
		const before = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-if="enabled"><template #label>旧コピー {{ i18n.ts._deck.columnGap }}</template></MkSwitch>
		</template>`, routes)[0];
		const copyOnly = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-if="enabled"><template #label>新コピー {{ i18n.ts._deck.columnGap }}</template></MkSwitch>
		</template>`, routes)[0];
		const changedCondition = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-if="featureEnabled"><template #label>新コピー {{ i18n.ts._deck.columnGap }}</template></MkSwitch>
		</template>`, routes)[0];
		expect(copyOnly.stableId).toBe(before.stableId);
		expect(changedCondition.stableId).not.toBe(before.stableId);
	});

	test('前方への別control追加で既存IDをずらさず、同一semantic identityはfail-fastにする', () => {
		const original = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="first"><template #label>{{ i18n.ts.first }}</template></MkSwitch>
			<MkSwitch v-model="existing"><template #label>{{ i18n.ts.existing }}</template></MkSwitch>
		</template>`, routes);
		const inserted = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch v-model="newBefore"><template #label>{{ i18n.ts.newBefore }}</template></MkSwitch>
			<MkSwitch v-model="first"><template #label>{{ i18n.ts.first }}</template></MkSwitch>
			<MkSwitch v-model="existing"><template #label>{{ i18n.ts.existing }}</template></MkSwitch>
		</template>`, routes);
		expect(inserted.find(entry => entry.modelExpression === 'existing')?.stableId).toBe(original.find(entry => entry.modelExpression === 'existing')?.stableId);
		expect(() => collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch><template #label>{{ i18n.ts.same }}</template></MkSwitch>
			<MkSwitch><template #label>{{ i18n.ts.same }}</template></MkSwitch>
		</template>`, routes)).toThrow('duplicate semantic identity');
		const explicitlyKeyed = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', `<template>
			<MkSwitch data-settings-search-key="first"><template #label>{{ i18n.ts.same }}</template></MkSwitch>
			<MkSwitch data-settings-search-key="second"><template #label>{{ i18n.ts.same }}</template></MkSwitch>
		</template>`, routes);
		expect(explicitlyKeyed.map(entry => entry.stableId)).toHaveLength(2);
		expect(new Set(explicitlyKeyed.map(entry => entry.stableId)).size).toBe(2);
	});

	test('破壊的分類は明示metadataだけを受け入れ、removeという語だけでは付けない', () => {
		const [ordinary] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', '<template><MkSwitch v-model="removeModalBgColorForBlur">背景ぼかし</MkSwitch></template>', routes);
		const [explicit] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', '<template><MkSwitch data-settings-search-destructive="true" v-model="purge">完全に削除</MkSwitch></template>', routes);
		expect(ordinary.destructive).toBe(false);
		expect(explicit.destructive).toBe(true);
		expect(() => collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', '<template><MkSwitch data-settings-search-destructive="false">削除</MkSwitch></template>', routes)).toThrow('must be explicitly true');
	});

	test('Pizzaxのcomputed getter/setterはprofile preferenceに偽装せず正本storageRefを保持する', () => {
		const [descriptor] = collectSettingsControlDescriptorsV2('src/pages/settings/profile.vue', `<template>
			<MkSelect v-model="reactionAcceptance"><template #label>{{ i18n.ts.reactionAcceptance }}</template></MkSelect>
		</template><script setup>const reactionAcceptance = computed(store.makeGetterSetter('reactionAcceptance'));</script>`, new Map([...routes, ['profile', '/settings/profile']]));
		expect(descriptor).toMatchObject({
			preferenceKeys: ['reactionAcceptance'],
			storageRefs: [{ kind: 'pizzax', store: 'base', scope: 'account', key: 'reactionAcceptance' }],
			persistence: 'account',
		});
	});

	test('SearchMarker外のcontrolにもdescriptorと同じdata IDを一度だけ注入する', () => {
		const source = '<template><MkSwitch v-model="unmarked"><template #label>{{ i18n.ts.enabled }}</template></MkSwitch></template>';
		const [descriptor] = collectSettingsControlDescriptorsV2('src/pages/settings/deck.vue', source, routes);
		const injected = injectSettingsSearchIdsV2('src/pages/settings/deck.vue', source, routes);
		expect(injected.code).toContain(`data-settings-search-id="${descriptor.stableId}"`);
		expect(injected.code.match(/data-settings-search-id=/gu)).toHaveLength(1);
		const lineShifted = injectSettingsSearchIdsV2('src/pages/settings/deck.vue', `\n\n${source}`, routes);
		expect(lineShifted.code).toContain(`data-settings-search-id="${descriptor.stableId}"`);
		expect(() => injectSettingsSearchIdsV2('src/pages/settings/deck.vue', '<template><MkSwitch data-settings-search-id="wrong" v-model="unmarked">A</MkSwitch></template>', routes)).toThrow('duplicate data-settings-search-id');
	});

	test('raw native/groupの関連欄はlabel/button外かつfull-widthで注入し、v-for IDを複製しない', () => {
		const source = `<template>
			<SearchMarker markerId="visual" :label="i18n.ts.visual">
				<div class="rangeRow"><label><input v-model="opacity" /></label></div>
				<div v-for="row in rows"><button @click="settings.value[row] = true">{{ row }}</button></div>
			</SearchMarker>
		</template>`;
		const injected = injectSettingsSearchIdsV2('src/pages/settings/deck.vue', source, routes, {
			// The fixture deliberately has only raw native/runtime rows. A production
			// source must supply this whole contract rather than inheriting a broad
			// profile/default fallback.
			persistence: 'profile', saveMode: 'immediate', availability: 'all', owner: 'core', applicableUi: 'all',
		});
		expect(injected.code.match(/<SettingsControlRelated full-width data-settings-search-id="[^"]+" \/>/gu)).toHaveLength(2);
		const labelStart = injected.code.indexOf('<label>');
		const labelEnd = injected.code.indexOf('</label>', labelStart);
		const buttonStart = injected.code.indexOf('<button ');
		const buttonEnd = injected.code.indexOf('</button>', buttonStart);
		expect(injected.code.slice(labelStart, labelEnd)).not.toContain('<SettingsControlRelated');
		expect(injected.code.slice(buttonStart, buttonEnd)).not.toContain('<SettingsControlRelated');
		expect(injected.code).toMatch(/<button @click="settings\.value\[row\] = true">/u);
		expect(injected.code).not.toMatch(/<button[^>]*data-settings-search-id=/u);
		expect(parseSfc(injected.code).errors).toHaveLength(0);
	});

	test('実設定51ファイルの主要フォーム352項目を漏れなく分類する', async () => {
		const [routerSource, files] = await Promise.all([
			fs.readFile('src/router.definition.ts', 'utf8'),
			glob('src/pages/settings/*.vue'),
		]);
		const currentRoutes = readSettingsRoutesV2(routerSource);
		const entries = (await Promise.all(files.sort().map(async file => collectSettingsControlDescriptorsV2(
			file, await fs.readFile(file, 'utf8'), currentRoutes,
		)))).flat();
		expect(files).toHaveLength(51);
		// The LTL emoji vote and device swipe switches add two controls to the measured 350-item
		// settings-page population; the extension targets are counted separately.
		expect(entries).toHaveLength(354);
		validateSettingsControlDescriptorsV2(entries, 354);
		expect(entries.filter(entry => entry.searchable || entry.intentionallyExcluded).length).toBe(354);
		const excluded = entries.filter(entry => entry.intentionallyExcluded);
		expect(excluded.length).toBeGreaterThan(0);
		expect(Object.fromEntries([...new Set(excluded.map(entry => entry.exclusionReason))].map(reason => [reason, excluded.filter(entry => entry.exclusionReason === reason).length]))).toEqual({
			'二段階認証登録フローの確認コード入力であり、設定値ではない。検索から認証・登録フローを開始しない': 1,
			'選択済みのアバター装飾を編集する一時popup内の値で、検索は親のアバター装飾グループへ安全に到達する': 6,
			'v-for 内の設定グループで、個別対象識別子は実行時に決まる': 15,
			'ラベルがページローカル状態に依存し、ビルド時に安全な検索語へ評価できない': 1,
			'router.definition.ts にこの設定コンポーネントの到達可能なルートがない': 1,
			'連合有効時だけ表示されるインスタンスミュートの子SFCで、検索は親設定グループへ安全に到達する': 1,
			'ソフト・ハードの二つの親設定で同じ子SFCが使われるため、検索はワードミュート設定グループへ集約する': 1,
			'通知種類ごとのv-for行で同じ子SFCが複製されるため、検索は通知受信設定グループへ集約する': 2,
			'常時 disabled の表示専用コントロールで、設定値を変更できない': 2,
			'サウンドイベントごとのv-for行で同じ子SFCが複製されるため、検索はサウンド設定グループへ集約する': 4,
			'選択済みステータスバーごとのv-for行で同じ子SFCが複製されるため、検索はステータスバー設定グループへ集約する': 18,
			'インストール済みテーマを閲覧・削除対象として選ぶ一時状態で、選択自体は保存しない': 1,
			'MiAuth認証を始める前の接続先候補。検索から認証フローを開始しない': 1,
			'readonly の表示専用コントロールで、設定値を変更できない': 3,
			'Webhook編集は動的webhookIdを必要とし、検索から固定URLへ到達できない': 11,
		});
		const injected = await Promise.all(files.map(async file => injectSettingsSearchIdsV2(file, await fs.readFile(file, 'utf8'), currentRoutes)));
		expect(injected.reduce((count, item) => count + (item.code.match(/data-settings-search-id=/gu)?.length ?? 0), 0)).toBeGreaterThan(0);
		expect(injected.flatMap(item => parseSfc(item.code).errors)).toHaveLength(0);
	});

	test('interactive母集団はbuttonを含め、全件を理由付きで分類する', async () => {
		const [inventory, controls] = await Promise.all([collectRealInteractiveInventory(), collectRealSettingsInventory()]);
		const materializedGroups = controls.descriptors
			.filter((descriptor): descriptor is typeof descriptor & { isGroup: true; staticGroupKey: string } => descriptor.isGroup === true && descriptor.staticGroupKey != null)
			.map(descriptor => ({ key: descriptor.staticGroupKey, stableId: descriptor.stableId }));
		const resolved = resolveSettingsInteractiveInventoryDispositionsV2(inventory.items, controls.descriptors, materializedGroups);
		const groups = controls.descriptors.filter(descriptor => descriptor.isGroup === true);
		const classifications = ['user-facing-setting', 'navigation-action', 'save-cancel', 'disabled-display-only', 'runtime-collection', 'destructive'] as const;
		const bySource = Object.fromEntries([
			'src/components/HatasabaUi2SettingsBody.vue', 'src/components/HatasabaUi2ImmediateSettings.vue', 'src/components/HataFeedDisplaySettings.vue', 'src/components/HatadyDisplaySettings.vue', 'src/components/MkUISetup.vue', 'src/pages/HataskSettings.vue', 'src/pages/MkMascotSettings.vue', 'src/pages/settings/hata-custom.vue',
		].map(sourceFile => [sourceFile, Object.fromEntries(classifications.map(classification => [classification, inventory.items.filter(item => item.sourceFile === sourceFile && item.classification === classification).length]))]));
		// Measured target closure: 50 settings SFCs plus 12 distinct extension targets.
		// Keep the raw population separate from the smaller catalog-descriptor
		// count so new visible buttons cannot disappear behind an old total.
		expect(inventory.files).toHaveLength(63);
		expect(inventory.items).toHaveLength(730);
		expect(Object.fromEntries(classifications.map(classification => [classification, inventory.items.filter(item => item.classification === classification).length]))).toEqual({
			'user-facing-setting': 460,
			'navigation-action': 170,
			'save-cancel': 32,
			'disabled-display-only': 19,
			'runtime-collection': 48,
			destructive: 1,
		});
		expect(bySource).toEqual({
			'src/components/HatasabaUi2SettingsBody.vue': { 'user-facing-setting': 10, 'navigation-action': 12, 'save-cancel': 2, 'disabled-display-only': 2, 'runtime-collection': 2, destructive: 0 },
			'src/components/HatasabaUi2ImmediateSettings.vue': { 'user-facing-setting': 2, 'navigation-action': 0, 'save-cancel': 0, 'disabled-display-only': 0, 'runtime-collection': 0, destructive: 0 },
			'src/components/HataFeedDisplaySettings.vue': { 'user-facing-setting': 3, 'navigation-action': 4, 'save-cancel': 0, 'disabled-display-only': 0, 'runtime-collection': 0, destructive: 0 },
			'src/components/HatadyDisplaySettings.vue': { 'user-facing-setting': 1, 'navigation-action': 7, 'save-cancel': 2, 'disabled-display-only': 0, 'runtime-collection': 0, destructive: 0 },
			'src/components/MkUISetup.vue': { 'user-facing-setting': 4, 'navigation-action': 1, 'save-cancel': 2, 'disabled-display-only': 0, 'runtime-collection': 0, destructive: 0 },
			'src/pages/HataskSettings.vue': { 'user-facing-setting': 11, 'navigation-action': 8, 'save-cancel': 2, 'disabled-display-only': 0, 'runtime-collection': 0, destructive: 0 },
			'src/pages/MkMascotSettings.vue': { 'user-facing-setting': 77, 'navigation-action': 16, 'save-cancel': 0, 'disabled-display-only': 0, 'runtime-collection': 12, destructive: 0 },
			'src/pages/settings/hata-custom.vue': { 'user-facing-setting': 28, 'navigation-action': 13, 'save-cancel': 1, 'disabled-display-only': 0, 'runtime-collection': 1, destructive: 0 },
		});
		expect(inventory.items.filter(item => item.sourceFile === 'src/components/HatasabaUi2SettingsBody.vue')).toHaveLength(28);
		expect(inventory.items.every(item => item.reason.length > 0)).toBe(true);
		expect(inventory.items.filter(item => item.searchableControl).every(item => item.classification === 'user-facing-setting' || item.classification === 'destructive')).toBe(true);
		expect(inventory.items.every(item => (item.descriptorStableId == null) !== (item.exclusionReason == null))).toBe(true);
		// Carousel arrows and dots remain in the raw inventory even when a
		// static theme group owns their search destination.
		expect(resolved).toHaveLength(730);
		expect(resolved.every(item => (item.descriptorStableId == null) !== (item.exclusionReason == null))).toBe(true);
		const descriptorIds = new Set(controls.descriptors.filter(descriptor => descriptor.searchable).map(descriptor => descriptor.stableId));
		expect(resolved.filter(item => item.descriptorStableId != null).every(item => descriptorIds.has(item.descriptorStableId!))).toBe(true);
		expect(resolved.filter(item => item.classification === 'runtime-collection').every(item => item.descriptorStableId == null || item.descriptorStableId.startsWith('settings.group.'))).toBe(true);
		expect(groups.length).toBeGreaterThan(0);
		expect(groups.every(group => (group.label.length > 0 || group.labelI18nKeys?.length) && !/\d+:\d+/u.test(group.stableId))).toBe(true);
	});

	test('handler本体・代入先を読み、設定操作と一時UI操作を取り違えない', async () => {
		const inventory = await collectRealInteractiveInventory();
		const find = (sourceFile: string, actionExpression: string) => inventory.items.find(item => item.sourceFile === sourceFile && item.actionExpression === actionExpression);
		expect(find('src/components/HatadyDisplaySettings.vue', 'choose(opt.value)')).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/pages/settings/hata-custom.vue', 'onFontChange(preset.id)')).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/pages/settings/hata-custom.vue', '!isDeckLike&&(noteSpacing=opt.value)')).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/pages/settings/hata-custom.vue', 'activeCat=cat.id')).toMatchObject({ classification: 'navigation-action' });
		expect(find('src/pages/HataskSettings.vue', "toggle('autoTheme')")).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/pages/HataskSettings.vue', 'slideTheme(-1)')).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/components/MkUISetup.vue', "choose('simple')")).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/components/MkUISetup.vue', 'backFromConfirm')).toMatchObject({ classification: 'navigation-action' });
		expect(find('src/pages/MkMascotSettings.vue', "toggleDisplay('tellNotifications')")).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/pages/MkMascotSettings.vue', 'selectPreviewPhrase(pi)')).toMatchObject({ classification: 'navigation-action' });
		expect(find('src/pages/MkMascotSettings.vue', 'chooseBirthdayImage')).toMatchObject({ classification: 'user-facing-setting' });
		expect(find('src/components/HatasabaUi2SettingsBody.vue', 'save')).toMatchObject({ classification: 'save-cancel' });
		// Dynamic disabled conditions remain interactive; only literal true is
		// display-only. This protects carousel/theme controls from false removal.
		expect(find('src/pages/HataskSettings.vue', 'slideTheme(-1)')).toMatchObject({ classification: 'user-facing-setting' });
		const fixture = collectSettingsInteractiveInventoryV2('src/components/InventoryFixture.vue', `<template>
			<button disabled @click="persist">always disabled</button>
			<button :disabled="saving" @click="persist">busy only</button>
			<button @click="view = 'next'">view</button>
		</template><script setup>function persist() { settings.value.enabled = true; }</script>`);
		expect(fixture.map(item => item.classification)).toEqual(['disabled-display-only', 'user-facing-setting', 'navigation-action']);
		const broken = [{
			sourceFile: 'src/components/BrokenInventory.vue', sourceLine: 1, component: 'button', actionExpression: 'persist',
			classification: 'user-facing-setting' as const, reason: 'fixture', searchableControl: true,
		}];
		expect(() => resolveSettingsInteractiveInventoryDispositionsV2(broken, [])).toThrow('unclassified interactive group');
	});

	test('条件付きcontrolは外側の条件も考慮して無条件の静的hostへ遡り、focus監査にそのIDを残す', () => {
		const sourceFile = 'src/components/ConditionalSettingsFixture.vue';
		const source = `<template>
			<FormSection>
				<template #label>{{ i18n.ts.outerSettings }}</template>
				<div v-if="advancedEnabled">
					<FormSection>
						<template #label>{{ i18n.ts.innerSettings }}</template>
						<MkSwitch v-model="prefer.model('advancedSetting')">{{ i18n.ts.advancedSetting }}</MkSwitch>
					</FormSection>
				</div>
			</FormSection>
		</template>`;
		const target = { routeOverride: '/settings/fixture', persistence: 'profile' as const, saveMode: 'immediate' as const, availability: 'all' as const, owner: 'core' as const, applicableUi: 'all' as const };
		const raw = collectSettingsInteractiveInventoryV2(sourceFile, source);
		const hosts = collectStaticGroupHostsV2(sourceFile, source, target);
		const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, new Map(), target);
		const control = descriptors.find(descriptor => descriptor.component === 'MkSwitch');
		const outer = hosts.find(host => host.labelI18nKeys?.includes('i18n.ts.outerSettings'));
		const inner = hosts.find(host => host.labelI18nKeys?.includes('i18n.ts.innerSettings'));
		expect(raw).toHaveLength(1);
		expect(raw[0]?.staticGroupKey).toBe(outer?.key);
		expect(outer?.conditions).toEqual([]);
		expect(inner?.conditions).toEqual(['advancedEnabled']);
		expect(control).toMatchObject({ focusId: outer?.stableId, unmet: [{ kind: 'runtime-data', id: 'conditional-setting', behavior: 'explain' }] });
		const audit = collectSettingsDescriptorReachabilityAuditV2(descriptors);
		expect(audit).toHaveLength(1);
		expect(audit[0]).toMatchObject({ disposition: 'parent-static-group', focusId: outer?.stableId });
	});

	test('hata-customのcategory activationは外側条件だけを満たし、内側条件だけを親groupへ退避する', () => {
		const sourceFile = 'src/pages/settings/hata-custom.vue';
		const source = `<template>
			<template v-if="activeCat === 'general'">
				<FormSection>
					<template #label>一般設定</template>
					<MkSwitch v-model="prefer.model('simpleUi.hideBotsInTimeline')"><template #label>botを隠す</template></MkSwitch>
					<MkSwitch v-if="allowBots" v-model="prefer.model('simpleUi.hideBotsInTimeline')"><template #label>botの追加設定</template></MkSwitch>
				</FormSection>
			</template>
		</template>`;
		const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, new Map(), {
			routeOverride: '/settings/hata-custom',
			persistence: 'profile',
			saveMode: 'immediate',
			availability: 'all',
			owner: 'hatasaba',
			applicableUi: 'all',
		});
		const [outer, inner] = descriptors.filter(descriptor => descriptor.component === 'MkSwitch');
		expect(outer).toMatchObject({
			conditions: ["activeCat === 'general'"],
			activation: { kind: 'hata-custom-category', category: 'general', focus: { kind: 'control', id: outer?.stableId } },
		});
		expect(outer?.focusId).toBeUndefined();
		expect(inner).toMatchObject({
			conditions: ["activeCat === 'general'", 'allowBots'],
			focusId: expect.stringMatching(/^settings\.group\./u),
			focusHostConditions: ["activeCat === 'general'"],
			unmet: [{ kind: 'runtime-data', id: 'conditional-setting', behavior: 'explain' }],
			activation: { kind: 'hata-custom-category', category: 'general', focus: { kind: 'group' } },
		});
		expect(inner?.activation?.focus?.id).toBe(inner?.focusId);
		const audit = collectSettingsDescriptorReachabilityAuditV2(descriptors);
		expect(audit.find(item => item.stableId === outer?.stableId)).toMatchObject({ disposition: 'activation' });
		expect(audit.find(item => item.stableId === inner?.stableId)).toMatchObject({ disposition: 'parent-static-group', focusId: inner?.focusId });
	});

	test('PREF_DEF・Pizzax・typed local-storageの全キーをcatalogまたは実行時理由へ排他的に分類する', async () => {
		const input = await collectStorageAuditInput();
		const storageTargets = (key: string) => input.descriptors.filter(descriptor => descriptor.storageRefs?.some(ref => ref.kind === 'pizzax' && ref.key === key));
		const realReactionAcceptance = input.descriptors.find(descriptor => descriptor.sourceFile === 'src/pages/settings/profile.vue' && descriptor.modelExpression === 'reactionAcceptance');
		if (realReactionAcceptance?.storageRefs == null) throw new Error(JSON.stringify(realReactionAcceptance));
		expect(realReactionAcceptance).toMatchObject({
			preferenceKeys: ['reactionAcceptance'],
			storageRefs: [{ kind: 'pizzax', key: 'reactionAcceptance', store: 'base', scope: 'account' }],
		});
		expect(storageTargets('reactionAcceptance').map(descriptor => descriptor.stableId)).toHaveLength(1);
		expect(storageTargets('realtimeMode').map(descriptor => descriptor.stableId)).toHaveLength(1);
		const audit = collectSettingsStorageKeyAuditV2(input);
		expect(audit.counts).toEqual({ preference: 291, pizzax: 105, local: 101 });
		expect(audit.items.find(item => item.kind === 'local' && item.key === 'hataskeyUiSDisplaySize')).toMatchObject({
			disposition: 'catalog-control', descriptorStableIds: ['settings.control.device.hataskey-ui-s-display-size'],
		});
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			runtimeSources: input.runtimeSources.map(source => source.file === 'src/utility/hatasaba-device-prefs.ts'
				? { ...source, code: source.code.replace("miLocalStorage.setItem('hataskeyUiSDisplaySize', size)", "miLocalStorage.setItem('disconnectedSize', size)") }
				: source),
		})).toThrow('UI S display size has invalid device control evidence');
		expect(audit.items.find(item => item.kind === 'preference' && item.key === 'hataskeyUi3BottomNav')).toMatchObject({ disposition: 'catalog-control', descriptorStableIds: ['settings.control.preference.simpleui-bottomnav'] });
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			runtimeSources: input.runtimeSources.map(source => source.file.endsWith('/HataskeyUiSBottomNavSettings.vue')
				? { ...source, code: source.code.replace("prefer.commit('hataskeyUi3BottomNav',", "prefer.commit('disconnectedNav',") } : source),
		})).toThrow('redesigned preference control has invalid evidence: hataskeyUi3BottomNav');
		for (const key of ['hataskeyUi3MobileOrder', 'hataskeyUi3MobileGuideShown:${string}']) {
			expect(audit.items.find(item => item.kind === 'local' && item.key === key)).toMatchObject({ disposition: 'runtime', descriptorStableIds: [] });
		}
		expect(audit.items.find(item => item.kind === 'local' && item.key === 'hataSideStudioUiS')).toMatchObject({
			disposition: 'runtime', descriptorStableIds: [],
		});
		expect(audit.items.find(item => item.kind === 'preference' && item.key === 'hataskeyUi3ComposerPosition')).toMatchObject({
			disposition: 'catalog-control', descriptorStableIds: ['settings.control.preference.hataskeyui3composerposition'],
		});
		expect(audit.items.find(item => item.kind === 'preference' && item.key === 'hataskeyUi3TimelineBackground')).toMatchObject({
			disposition: 'catalog-control', descriptorStableIds: ['settings.control.preference.hataskeyui3timelinebackground'],
		});
		for (const key of ['hataskeyUi3SideMenuBackground', 'hataskeyUi3RightPaneBackground', 'hataskeyUi3GlassDensity']) {
			expect(audit.items.find(item => item.kind === 'preference' && item.key === key)).toMatchObject({
				disposition: 'catalog-control', descriptorStableIds: [`settings.control.preference.${key.toLowerCase()}`],
			});
		}
		for (const key of ['hataskeyUi3RssEnabled', 'hataskeyUi3RssFeeds', 'hataskeyUi3RssAutoSwitch', 'hataskeyUi3RssReadSeconds', 'hataskeyUi3RssReadMode']) {
			expect(audit.items.find(item => item.kind === 'preference' && item.key === key)).toMatchObject({
				disposition: 'catalog-control', descriptorStableIds: [`settings.control.preference.${key.toLowerCase()}`],
			});
		}
		expect(audit.items.find(item => item.kind === 'preference' && item.key === 'notificationExcludeBots')).toMatchObject({
			disposition: 'runtime', descriptorStableIds: [], reason: expect.stringContaining('[src/pages/notifications.vue]'),
		});
		expect(audit.items.find(item => item.kind === 'preference' && item.key === 'enableCondensedLine')).toMatchObject({ disposition: 'deprecated', descriptorStableIds: [] });
		// Existing old controls already provide audit evidence for these shared keys.
		for (const key of ['postFormVisibilityBorder.enabled', 'postFormVisibilityBorder.width', 'postFormVisibilityBorder.color.public', 'postFormVisibilityBorder.color.home', 'postFormVisibilityBorder.color.followers', 'postFormVisibilityBorder.color.specified']) {
			const old = input.descriptors.filter(item => item.sourceFile === 'src/pages/settings/hata-custom.vue' && item.preferenceKeys.includes(key));
			expect(old, key).toHaveLength(1);
			expect(old[0]?.storageRefs, key).toContainEqual({ kind: 'pref', key });
			expect(audit.items.find(item => item.kind === 'preference' && item.key === key), key).toMatchObject({ disposition: 'catalog-control', descriptorStableIds: old.map(item => item.stableId) });
		}
		expect(audit.items).toHaveLength(497);
		expect(audit.items.every(item => item.reason.length > 0)).toBe(true);
		expect(audit.items.every(item => item.descriptorStableIds.length > 0
			? item.disposition === 'catalog-control' || item.disposition === 'catalog-group'
			: item.disposition !== 'catalog-control' && item.disposition !== 'catalog-group')).toBe(true);
		const dispositionCounts = Object.fromEntries([...new Set(audit.items.map(item => `${item.kind}:${item.disposition}`))]
			.map(identity => [identity, audit.items.filter(item => `${item.kind}:${item.disposition}` === identity).length]));
		expect(dispositionCounts).toEqual({
			'preference:catalog-control': 227, 'preference:catalog-group': 5, 'preference:runtime': 23,
			'preference:migration': 6, 'preference:deprecated': 18, 'preference:internal': 12,
			'pizzax:catalog-control': 8, 'pizzax:catalog-group': 1, 'pizzax:runtime': 9,
			'pizzax:migration': 3, 'pizzax:cache': 2, 'pizzax:deprecated': 78, 'pizzax:internal': 4,
			'local:catalog-control': 15, 'local:catalog-group': 1, 'local:runtime': 12, 'local:migration': 22,
			'local:cache': 26, 'local:deprecated': 6, 'local:internal': 19,
		});
		expect(audit.items.filter(item => item.kind === 'pizzax' && item.disposition === 'catalog-control')
			.map(item => item.key).sort()).toEqual([
			'darkMode', 'enablePreferencesAutoCloudBackup', 'menuDisplay', 'reactionAcceptance', 'realtimeMode',
			'searchEngine', 'searchEngineUrl', 'searchEngineUrlQuery',
		]);
		expect(audit.items.find(item => item.kind === 'pizzax' && item.key === 'additionalUnicodeEmojiIndexes')).toMatchObject({ disposition: 'catalog-group' });
		expect(audit.items.find(item => item.kind === 'local' && item.key === 'ui_setup_completed')).toMatchObject({ disposition: 'internal', descriptorStableIds: [] });
		expect(audit.items.find(item => item.kind === 'local' && item.key === 'hataRightWidgetsCollapsed')).toMatchObject({
			disposition: 'runtime', descriptorStableIds: [], reason: expect.stringContaining('[src/utility/hatasaba-device-prefs.ts]'),
		});
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			runtimeSources: input.runtimeSources.map(source => source.file !== 'src/utility/hatasaba-device-prefs.ts'
				? source
				: { ...source, code: source.code.replaceAll('hataRightWidgetsCollapsed', 'redactedWidgetState') }),
		})).toThrow('explicit local key has invalid evidence: hataRightWidgetsCollapsed');
		expect(audit.items.find(item => item.kind === 'local' && item.key === 'hata_external_notifications_sidebar_migrated:${string}')).toMatchObject({
			disposition: 'migration',
			descriptorStableIds: [],
			reason: expect.stringContaining('[src/utility/external-notifications-sidebar-migration.ts]'),
		});
		expect(input.descriptors.find(descriptor => descriptor.sourceFile === 'src/pages/settings/index.vue' && descriptor.storageRefs?.some(ref => ref.kind === 'pizzax' && ref.key === 'enablePreferencesAutoCloudBackup'))).toMatchObject({
			route: '/settings', persistence: 'device', saveMode: 'immediate', searchable: true,
		});
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			preferenceDefinition: 'definePreferences({\nphantomUnclassifiedSetting: {},\n})',
		})).toThrow('unclassified preference key: phantomUnclassifiedSetting');
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			preferenceDefinition: 'definePreferences({\nphantomRuntimeSetting: {},\n})',
			runtimeSources: [...input.runtimeSources, {
				file: 'src/utility/phantom-runtime.ts', code: "prefer.commit('phantomRuntimeSetting', true);",
			}],
		})).toThrow('unclassified preference key: phantomRuntimeSetting');
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			descriptors: [...input.descriptors, {
				stableId: 'settings.fixture.internal-conflict', searchable: true, preferenceKeys: [],
				storageRefs: [{ kind: 'local', key: 'ui_setup_completed' }],
			}],
		})).toThrow('contradictory local key classification: ui_setup_completed');
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			settingsSources: input.settingsSources.map(source => source.file !== 'src/pages/settings/index.vue'
				? source
				: { ...source, code: source.code.split('showPreferencesAutoCloudBackupSuggestion').join('redactedPromptState') }),
		})).toThrow('explicit pizzax key has invalid evidence: showPreferencesAutoCloudBackupSuggestion');
	});

	test('実Vite入力でもstorage key XOR監査を実行し、runtime evidence変更を再生成対象にする', async () => {
		const inventory = await collectRealSettingsInventory();
		const audit = await collectSettingsStorageKeyAuditFromRepositoryV2(process.cwd(), inventory.files, inventory.descriptors);
		expect(audit.counts).toEqual({ preference: 291, pizzax: 105, local: 101 });
		for (const key of ['emojiAdditionNotice', 'hourlyTimeNotice']) {
			expect(audit.items.find(item => item.kind === 'preference' && item.key === key)).toMatchObject({
				disposition: 'catalog-control',
				descriptorStableIds: [`settings.control.preference.${key.toLowerCase()}`],
			});
		}
		expect(audit.items.find(item => item.kind === 'preference' && item.key === 'enableCondensedLine')).toMatchObject({ disposition: 'deprecated', descriptorStableIds: [] });
		expect(SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2).toContain('src/ui/universal.vue');
		expect(SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2).toContain('src/preferences/def.ts');
		expect(SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2).toContain('src/utility/retired-portal-migration.ts');
		expect(SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2).toContain('src/utility/hataskey-sound-migration.ts');
		expect(SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2).toContain('src/utility/external-notifications-sidebar-migration.ts');
		expect(SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2).toContain('src/utility/hatask-akatsuki-usage.ts');
		for (const file of ['settings-preferences-catalog.ts', 'settings-preferences-models.ts', 'settings-preferences-search-index.ts', 'SettingsPreferencesSurface.vue']) {
			expect(SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2).toContain(`src/pages/settings-redesign/${file}`);
		}
		expect(audit.items.find(item => item.kind === 'local' && item.key === 'hataskAkatsukiUsage:${string}')).toMatchObject({
			disposition: 'cache', descriptorStableIds: [], reason: expect.stringContaining('[src/utility/hatask-akatsuki-usage.ts]'),
		});
	});

	test('新設定の実catalog・保存model・検索・描画が欠けた場合は公開controlとして監査を通さない', async () => {
		const input = await collectStorageAuditInput();
		for (const key of ['emojiAdditionNotice', 'hourlyTimeNotice']) {
			for (const file of ['settings-preferences-catalog.ts', 'settings-preferences-models.ts']) {
				const sourceFile = `src/pages/settings-redesign/${file}`;
				expect(input.runtimeSources.some(source => source.file === sourceFile && source.code.includes(key))).toBe(true);
				expect(() => collectSettingsStorageKeyAuditV2({
					...input,
					runtimeSources: input.runtimeSources.map(source => source.file !== sourceFile
						? source : { ...source, code: source.code.replaceAll(key, 'missingNavbarNotice') }),
				})).toThrow(`redesigned preference control has invalid evidence: ${key}`);
			}
		}
		for (const [file, binding] of [
			['settings-preferences-search-index.ts', 'preferenceControls.map'],
			['SettingsPreferencesSurface.vue', 'searchIdFor(control.key)'],
		] as const) {
			const sourceFile = `src/pages/settings-redesign/${file}`;
			expect(input.runtimeSources.some(source => source.file === sourceFile && source.code.includes(binding))).toBe(true);
			expect(() => collectSettingsStorageKeyAuditV2({
				...input,
				runtimeSources: input.runtimeSources.map(source => source.file !== sourceFile
					? source : { ...source, code: source.code.replaceAll(binding, 'missingNavbarNoticeBinding') }),
			})).toThrow('redesigned preference control has invalid evidence: emojiAdditionNotice');
		}
	});

	test('ポータル移行のアカウント・プロファイル別キーだけを実装証拠付きで分類し、別キーや証拠欠落は拒否する', async () => {
		const input = await collectStorageAuditInput();
		const key = 'hata_portal_cleanup_migrated:${string}';
		const audit = collectSettingsStorageKeyAuditV2(input);
		expect(audit.items.find(item => item.kind === 'local' && item.key === key)).toMatchObject({
			disposition: 'migration',
			descriptorStableIds: [],
			reason: expect.stringContaining('[src/utility/retired-portal-migration.ts]'),
		});
		// Mutate the real declaration instead of bypassing its parser with a synthetic fixture.
		expect(input.localStorageDefinition).toContain(key);
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			localStorageDefinition: input.localStorageDefinition.replace(key, 'hata_portal_cleanup_unreviewed:${string}'),
		})).toThrow('unclassified local key: hata_portal_cleanup_unreviewed:${string}');
		const evidenceFile = 'src/utility/retired-portal-migration.ts';
		expect(input.runtimeSources.find(source => source.file === evidenceFile)?.code).toContain('hata_portal_cleanup_migrated:');
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			runtimeSources: input.runtimeSources.map(source => source.file !== evidenceFile
				? source
				: { ...source, code: source.code.replace('hata_portal_cleanup_migrated:', 'redacted_portal_marker:') }),
		})).toThrow('explicit local key has invalid evidence: ' + key);
	});

	test('既定音移行のプロファイル・設定キー・scope別キーだけを実装証拠付きで分類し、別キーや証拠欠落は拒否する', async () => {
		const input = await collectStorageAuditInput();
		const key = 'hata_sound_default_migrated:${string}';
		const audit = collectSettingsStorageKeyAuditV2(input);
		expect(audit.items.find(item => item.kind === 'local' && item.key === key)).toMatchObject({
			disposition: 'migration',
			descriptorStableIds: [],
			reason: expect.stringContaining('[src/utility/hataskey-sound-migration.ts]'),
		});
		// Mutate the real declaration instead of bypassing its parser with a synthetic fixture.
		expect(input.localStorageDefinition).toContain(key);
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			localStorageDefinition: input.localStorageDefinition.replace(key, 'hata_sound_default_unreviewed:${string}'),
		})).toThrow('unclassified local key: hata_sound_default_unreviewed:${string}');
		const evidenceFile = 'src/utility/hataskey-sound-migration.ts';
		expect(input.runtimeSources.find(source => source.file === evidenceFile)?.code).toContain('hata_sound_default_migrated:');
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			runtimeSources: input.runtimeSources.map(source => source.file !== evidenceFile
				? source
				: { ...source, code: source.code.replace('hata_sound_default_migrated:', 'redacted_sound_marker:') }),
		})).toThrow('explicit local key has invalid evidence: ' + key);
	});

	test('通知表示フィルターの端末local keyは実sourceで分類し、未登録・証拠消失を拒否する', async () => {
		const input = await collectStorageAuditInput();
		const key = 'hataNotificationView';
		const audit = collectSettingsStorageKeyAuditV2(input);
		expect(audit.items.find(item => item.kind === 'local' && item.key === key)).toMatchObject({
			disposition: 'runtime', descriptorStableIds: [],
			reason: expect.stringContaining('[src/utility/hatasaba-device-prefs.ts, src/pages/notifications.vue]'),
		});
		expect(input.localStorageDefinition).toContain(`'${key}'`);
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			localStorageDefinition: input.localStorageDefinition.replace(`'${key}'`, "'hataNotificationViewUnreviewed'"),
		})).toThrow('unclassified local key: hataNotificationViewUnreviewed');
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			runtimeSources: input.runtimeSources.map(source => ['src/utility/hatasaba-device-prefs.ts', 'src/pages/notifications.vue'].includes(source.file)
				? { ...source, code: source.code.replaceAll(key, 'redactedNotificationView') }
				: source),
		})).toThrow('explicit local key has invalid evidence: hataNotificationView');
	});

	test('HataGoesの端末キャッシュは型と保存実装を証拠に分類し、未登録・証拠消失を拒否する', async () => {
		const input = await collectStorageAuditInput();
		const key = "hatagoes:${'state' | 'create' | 'scroll'}:${string}";
		const audit = collectSettingsStorageKeyAuditV2(input);
		expect(audit.items.find(item => item.kind === 'local' && item.key === key)).toMatchObject({
			disposition: 'cache', descriptorStableIds: [],
			reason: expect.stringContaining('[src/utility/hatasaba-device-prefs.ts]'),
		});
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			localStorageDefinition: input.localStorageDefinition.replace(key, 'hatagoes:unreviewed:${string}'),
		})).toThrow('unclassified local key: hatagoes:unreviewed:${string}');
		expect(() => collectSettingsStorageKeyAuditV2({
			...input,
			runtimeSources: input.runtimeSources.map(source => source.file === 'src/utility/hatasaba-device-prefs.ts'
				? { ...source, code: source.code.replaceAll('hatagoes:', 'unreviewed:') }
				: source),
		})).toThrow('explicit local key has invalid evidence: ' + key);
	});

	test('settings import閉包の独立設定操作はtarget化し、親従属generic componentは理由付きで除外する', async () => {
		const targetSources = [...new Set([...await glob('src/pages/settings/*.vue'), ...extensionTargets.map(target => target.filePath)])];
		const audit = await collectSettingsTransitiveControlAuditV2(process.cwd(), targetSources);
		expect(audit.find(item => item.sourceFile === 'src/components/MkPushNotificationAllowButton.vue')).toMatchObject({
			disposition: 'registered-target',
			parentSourceFiles: ['src/pages/settings/notifications.vue'],
			interactiveActions: ['MkButton:subscribe', 'MkButton:unsubscribe'],
		});
		expect(audit.find(item => item.sourceFile === 'src/components/MkPreferenceContainer.vue')).toMatchObject({
			disposition: 'parent-contained',
		});
		expect(audit.find(item => item.sourceFile === 'src/components/HataFeedProjectSettings.vue')).toMatchObject({
			disposition: 'nonsetting',
			parentSourceFiles: ['src/components/HataFeedDisplaySettings.vue'],
		});
		await expect(collectSettingsTransitiveControlAuditV2(process.cwd(), targetSources.filter(source => source !== 'src/components/MkPushNotificationAllowButton.vue')))
			.rejects.toThrow('unregistered transitive setting control: src/components/MkPushNotificationAllowButton.vue');
	});

	test('チャームは実ノートpreview境界で監査を閉じ、設定本体の未登録は拒否する', async () => {
		const targets = [...new Set([...await glob('src/pages/settings/*.vue'), ...extensionTargets.map(target => target.filePath)])];
		const audit = await collectSettingsTransitiveControlAuditV2(process.cwd(), targets);
		expect(audit.find(item => item.sourceFile === 'src/components/MkNoteCharmSettings.vue')).toMatchObject({ disposition: 'registered-target' });
		expect(audit.find(item => item.sourceFile === 'src/components/MkNoteCharmPreview.vue')).toMatchObject({
			disposition: 'nonsetting', parentSourceFiles: ['src/components/MkNoteCharmSettings.vue'],
			reason: expect.stringContaining('inert'),
		});
		expect(audit.some(item => item.sourceFile === 'src/components/MkMediaAudio.vue')).toBe(false);
		const preview = await fs.readFile('src/components/MkNoteCharmPreview.vue', 'utf8');
		expect(preview).toContain(' inert>');
		expect(preview).toMatch(/<MkNote\b[^>]*:note="sampleNote"[^>]*:mock="true"/);
		await expect(collectSettingsTransitiveControlAuditV2(process.cwd(), targets.filter(source => source !== 'src/components/MkNoteCharmSettings.vue')))
			.rejects.toThrow('unregistered transitive setting control: src/components/MkNoteCharmSettings.vue');
	});

	test('チャームのアカウント下書きと端末即時設定は別々の保存根拠で検索できる', async () => {
		const sourceFile = 'src/components/MkNoteCharmSettings.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, new Map(), targetMetadata(sourceFile));
		for (const modelExpression of ['draft.enabled', 'draft.size', 'draft.color']) {
			expect(descriptors.find(item => item.modelExpression === modelExpression)).toMatchObject({
				searchable: true, route: '/settings/note-charm', persistence: 'account', saveMode: 'buffered',
				storageRefs: [{ kind: 'api', endpoint: 'i/update', fields: ['noteCharm'] }],
			});
		}
		for (const modelExpression of ['noteCharmDisplay.show', 'noteCharmDisplay.showOthers', 'noteCharmDisplay.motion', 'noteCharmDisplay.wind']) {
			expect(descriptors.find(item => item.modelExpression === modelExpression)).toMatchObject({
				searchable: true, persistence: 'device', saveMode: 'immediate',
				storageRefs: [{ kind: 'local', key: 'noteCharmDisplay' }],
			});
		}
		expect(descriptors.find(item => item.labelI18nKeys?.includes('i18n.ts._noteCharm.pattern') && item.isGroup)).toMatchObject({ searchable: true, persistence: 'account', saveMode: 'buffered' });
		for (const action of ['chooseImage', 'removeImage']) {
			expect(descriptors.find(item => item.sourceLine === collectSettingsInteractiveInventoryV2(sourceFile, source).find(control => control.actionExpression === action)?.sourceLine)).toMatchObject({ searchable: true, persistence: 'account', saveMode: 'buffered' });
		}
		const raw = collectSettingsInteractiveInventoryV2(sourceFile, source);
		const groups = descriptors.filter(item => item.isGroup && item.staticGroupKey != null).map(item => ({ key: item.staticGroupKey!, stableId: item.stableId }));
		const resolved = resolveSettingsInteractiveInventoryDispositionsV2(raw, descriptors, groups);
		expect(resolved.find(item => item.component === 'input')).toMatchObject({ descriptorStableId: 'settings.group.note-charm-pattern' });
		const pattern = descriptors.find(item => item.stableId === 'settings.group.note-charm-pattern');
		expect(pattern).toMatchObject({
			focusId: 'settings.group.note-charm-settings',
			focusHostConditions: [],
			unmet: [{ kind: 'policy', id: 'note-charm-role-and-ui', behavior: 'explain' }],
		});
		expect(collectSettingsDescriptorReachabilityAuditV2(descriptors).find(item => item.stableId === pattern?.stableId))
			.toMatchObject({ disposition: 'parent-static-group', focusId: 'settings.group.note-charm-settings' });
		expect(() => collectSettingsDescriptorReachabilityAuditV2(descriptors.map(item => item === pattern ? { ...item, focusId: undefined } : item)))
			.toThrow('conditional control has no static parent focus: settings.group.note-charm-pattern');
		expect(raw.find(item => item.actionExpression === 'save')).toMatchObject({ classification: 'save-cancel' });
		const injected = injectSettingsSearchIdsV2(sourceFile, source, new Map(), targetMetadata(sourceFile)).code;
		expect(parseSfc(injected).errors).toEqual([]);
	});

	test('チャーム検索の実navigation selectorは編集不可時も常設rootに一致する', async () => {
		const sourceFile = 'src/components/MkNoteCharmSettings.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, new Map(), targetMetadata(sourceFile));
		const translations = loadYaml(await fs.readFile('../../locales/ja-JP.yml', 'utf8')) as Record<string, unknown>;
		const catalog = buildSettingsCatalogV2([], toSettingsControlCatalogItemsV2(descriptors, translations));
		const injected = injectSettingsSearchIdsV2(sourceFile, source, new Map(), targetMetadata(sourceFile)).code;
		const template = parseSfc(injected).descriptor.template;
		if (template == null) throw new Error('injected template missing');
		const navigation = await fs.readFile('src/pages/settings-redesign/index.vue', 'utf8');
		const functionSource = navigation.match(/function focusTargetForNavigation\(target: SettingsSearchNavigationTargetV2\): NavigationFocusTarget \| null \{[\s\S]*?\n\}/u)?.[0];
		if (functionSource == null) throw new Error('production navigation focus function missing');
		const focusFor = new Function('descriptorForNavigationTarget', `return (${functionSource.replace('(target: SettingsSearchNavigationTargetV2): NavigationFocusTarget | null', '(target)')});`)((target: unknown) => target);
		const attributeExpression = navigation.match(/const attribute = (focusTarget\.kind === 'group' \? 'data-settings-search-group-id' : 'data-settings-search-id');/u)?.[1];
		if (attributeExpression == null) throw new Error('production navigation selector missing');
		const attributeFor = new Function('focusTarget', `return ${attributeExpression};`);
		const surface = document.createElement('div');
		surface.innerHTML = template.content;
		// The production component removes this entire edit branch when its role
		// or UI prerequisite fails; the common section must survive both cases.
		for (const branch of surface.querySelectorAll('[v-if="canEdit"]')) branch.remove();
		for (const descriptor of catalog.descriptors.filter(item => item.focusId === 'settings.group.note-charm-settings')) {
			const focus = focusFor(descriptor);
			const attribute = attributeFor(focus);
			const matches = [...surface.querySelectorAll(`[${attribute}]`)].filter(element => element.getAttribute(attribute) === focus.id);
			expect(matches, descriptor.stableId).toHaveLength(1);
			expect(matches[0]?.tagName).toBe('SECTION');
			expect(matches[0]?.getAttribute('data-settings-search-group-id')).toBe(focus.id);
		}
		expect(catalog.descriptors.filter(item => item.focusId === 'settings.group.note-charm-settings').length).toBeGreaterThan(3);
	});

	test('チャーム追加後の実Vite設定で仮想module生成の全監査ゲートを通す', async () => {
		const { settingsControlSearchIndexV2: options } = await import('../vite.config.js');
		const plugin = pluginCreateSettingsSearchIndexV2(options);
		const load = typeof plugin.load === 'function' ? plugin.load : undefined;
		if (load == null) throw new Error('virtual loader missing');
		const generated = await load.call({}, '\0' + options.mainVirtualModule);
		const payload = (generated as string).match(/^export const settingsControlSearchIndexV2 = ([\s\S]+);\n$/u)?.[1];
		if (payload == null) throw new Error('virtual catalog missing');
		const descriptors = JSON.parse(payload);
		expect(descriptors).toHaveLength(550);
		const input = await collectStorageAuditInput();
		const audit = collectSettingsStorageKeyAuditV2(input);
		expect(audit.items.find(item => item.kind === 'local' && item.key === 'noteCharmDisplay')).toMatchObject({ disposition: 'catalog-control', descriptorStableIds: expect.any(Array) });
		expect(() => collectSettingsStorageKeyAuditV2({ ...input, descriptors: input.descriptors.filter(item => !item.storageRefs?.some(ref => ref.kind === 'local' && ref.key === 'noteCharmDisplay')) }))
			.toThrow('unclassified local key: noteCharmDisplay');
	});

	test('settings import閉包は未登録のv-for runtime childもfail-fastで検出する', async () => {
		const fixtureRoot = await fs.mkdtemp('/tmp/settings-v2-transitive-runtime-');
		const rootSource = 'src/pages/settings/root.vue';
		const childSource = 'src/pages/settings/RuntimeChild.vue';
		try {
			await fs.mkdir(path.join(fixtureRoot, 'src/pages/settings'), { recursive: true });
			await fs.writeFile(path.join(fixtureRoot, rootSource), `<template><RuntimeChild /></template>\n<script setup lang="ts">\nimport RuntimeChild from './RuntimeChild.vue';\n</script>\n`);
			await fs.writeFile(path.join(fixtureRoot, childSource), `<template><div v-for="row in rows" :key="row.id"><MkSwitch v-model="row.enabled"><template #label>Runtime row</template></MkSwitch></div></template>\n<script setup lang="ts">\nconst rows = [];\n</script>\n`);
			expect(collectSettingsInteractiveInventoryV2(childSource, await fs.readFile(path.join(fixtureRoot, childSource), 'utf8')))
			.toMatchObject([{ classification: 'runtime-collection', component: 'MkSwitch' }]);
			await expect(collectSettingsTransitiveControlAuditV2(fixtureRoot, [rootSource]))
				.rejects.toThrow(`unregistered transitive setting control: ${childSource}`);
		} finally {
			await fs.rm(fixtureRoot, { recursive: true, force: true });
		}
	});

	test('条件付きraw controlのrelated欄はv-if/else-if chainを分断せず、control非表示時は同時に隠す', async () => {
		const sourceFile = 'src/components/MkPushNotificationAllowButton.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const injected = injectSettingsSearchIdsV2(sourceFile, source, readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8')), targetMetadata(sourceFile), activationTargets).code;
		expect(injected).toMatch(/<MkButton[^>]*v-if="supported && !pushRegistrationInServer"[\s\S]*?<\/MkButton>\s*<MkButton[^>]*v-else-if="!showOnlyToRegister/u);
		expect(injected).toContain('<template v-if="(supported &amp;&amp; !pushRegistrationInServer)"><SettingsControlRelated full-width');
		const parsed = parseSfc(injected, { filename: sourceFile });
		expect(parsed.errors).toHaveLength(0);
		const template = parsed.descriptor.template;
		if (template == null) throw new Error('push target template is missing after injection');
		const compiled = compileTemplate({ source: template.content, filename: sourceFile, id: 'settings-push-related' });
		expect(compiled.errors).toEqual([]);
	});

	test('runtime childの各設定行は親groupのrelated欄を描画し、複製されるfocus IDはcontrolへ注入しない', async () => {
		const currentRoutes = readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8'));
		const cases = [
			{ sourceFile: 'src/pages/settings/notifications.notification-config.vue', parentGroupId: 'settings.group.notification-receive-config', minRows: 2 },
			{ sourceFile: 'src/pages/settings/sounds.sound.vue', parentGroupId: 'settings.group.sound-event-config', minRows: 2 },
			{ sourceFile: 'src/pages/settings/statusbar.statusbar.vue', parentGroupId: 'settings.group.statusbar-runtime-settings', minRows: 8 },
			{ sourceFile: 'src/pages/settings/mute-block.word-mute.vue', parentGroupId: 'settings.group.word-mute-runtime-settings', minRows: 1 },
		] as const;
		for (const expected of cases) {
			const source = await fs.readFile(expected.sourceFile, 'utf8');
			const injected = injectSettingsSearchIdsV2(expected.sourceFile, source, currentRoutes, targetMetadata(expected.sourceFile), activationTargets).code;
			const related = injected.match(new RegExp(`<SettingsControlRelated full-width data-settings-search-id="${expected.parentGroupId}"`, 'gu')) ?? [];
			expect(related.length, expected.sourceFile).toBeGreaterThanOrEqual(expected.minRows);
			// The related component owns the parent ID. Raw rows deliberately retain
			// no focus attribute because their component template is used by v-for.
			expect(injected, expected.sourceFile).not.toMatch(new RegExp(`<(?:MkSelect|MkInput|MkSwitch|MkRadios|MkRange|MkTextarea)[^>]*data-settings-search-id="${expected.parentGroupId}"`, 'u'));
			const parsed = parseSfc(injected, { filename: expected.sourceFile });
			expect(parsed.errors, expected.sourceFile).toHaveLength(0);
			if (parsed.descriptor.template == null) throw new Error(`runtime child template is missing: ${expected.sourceFile}`);
			const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename: expected.sourceFile, id: `runtime-related-${expected.parentGroupId}` });
			expect(compiled.errors, expected.sourceFile).toEqual([]);
		}
	});

	test('runtime childと埋め込みeditorの安全な語彙を、到達可能な親groupへ集約する', async () => {
		const inventory = await collectRealSettingsInventory();
		const group = (stableId: string) => inventory.descriptors.find(descriptor => descriptor.stableId === stableId);
		// These children are zero-or-many rows (or popup-only). Their individual
		// IDs intentionally stay out of the catalog, but their labels, captions,
		// and persisted key vocabulary must still find the one safe parent host.
		expect(group('settings.group.notification-receive-config')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts.userList']),
		});
		expect(group('settings.group.statusbar-runtime-settings')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts.refreshInterval', 'i18n.ts.speed']),
			preferenceKeys: expect.arrayContaining(['statusbars']),
		});
		expect(group('settings.group.sound-event-config')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts.sound', 'i18n.ts.volume']),
		});
		expect(group('settings.group.word-mute-runtime-settings')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts._wordMute.muteWords', 'i18n.ts._wordMute.muteWordsDescription']),
		});
		expect(group('settings.group.instance-mute-settings')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts._instanceMute.heading', 'i18n.ts._instanceMute.instanceMuteDescription']),
		});
		expect(group('settings.group.avatar-decoration-adjustment')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts.angle', 'i18n.ts.position', 'i18n.ts.scale', 'i18n.ts.opacity', 'i18n.ts.flip']),
		});
		expect(group('settings.group.emoji-palette-runtime-settings')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts.rename', 'i18n.ts.copy', 'i18n.ts.paste']),
			preferenceKeys: expect.arrayContaining(['emojiPalettes']),
		});
		expect(group('settings.group.watermark-presets')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining([
				'i18n.ts._watermarkEditor.position',
				'i18n.ts._watermarkEditor.angle',
				'i18n.ts._watermarkEditor.opacity',
				'i18n.ts._watermarkEditor.scale',
			]),
			preferenceKeys: expect.arrayContaining(['watermarkPresets']),
		});
		expect(group('settings.group.webhook-management')).toMatchObject({
			aliasI18nKeys: expect.arrayContaining(['i18n.ts._webhookSettings.name', 'i18n.ts._webhookSettings.secret']),
		});
		const childDescriptors = inventory.descriptors.filter(descriptor => [
			'src/pages/settings/notifications.notification-config.vue',
			'src/pages/settings/statusbar.statusbar.vue',
			'src/pages/settings/sounds.sound.vue',
			'src/pages/settings/mute-block.word-mute.vue',
			'src/pages/settings/mute-block.instance-mute.vue',
			'src/pages/settings/avatar-decoration.dialog.vue',
			'src/pages/settings/emoji-palette.palette.vue',
			'src/pages/settings/drive.WatermarkItem.vue',
			'src/pages/settings/webhook.edit.vue',
		].includes(descriptor.sourceFile));
		expect(childDescriptors.every(descriptor => descriptor.searchable === false && descriptor.intentionallyExcluded === true)).toBe(true);
	});

	test('virtual catalog型はdescriptor-levelのalias・focus・unmetを生成器契約と同期する', async () => {
		const declaration = await fs.readFile('src/utility/virtual.d.ts', 'utf8');
		const descriptor = declaration.slice(declaration.indexOf('type XSettingsControlSearchDescriptorV2 = {'));
		expect(descriptor).toContain('aliasI18nKeys?: string[];');
		expect(descriptor).toContain('focusId?: string;');
		expect(descriptor).toContain("unmet?: Array<{ kind: 'policy' | 'consent' | 'preference' | 'runtime-data'; id: string; behavior: 'focus' | 'explain' }>;");
		const inventory = await collectRealSettingsInventory();
		expect(inventory.descriptors.some(descriptor => descriptor.aliasI18nKeys?.length && descriptor.isGroup)).toBe(true);
		expect(inventory.descriptors.some(descriptor => descriptor.focusId != null && descriptor.unmet?.length)).toBe(true);
	});

	test('target metadataはdirect routeとpopupの既存到達経路をdescriptorへ渡す', async () => {
		const [routerSource, ui2Source, earthquakeSource] = await Promise.all([
			fs.readFile('src/router.definition.ts', 'utf8'),
			fs.readFile('src/components/HatasabaUi2SettingsBody.vue', 'utf8'),
			fs.readFile('src/components/MkEarthquakeSettings.vue', 'utf8'),
		]);
		const currentRoutes = readSettingsRoutesV2(routerSource);
		const ui2 = collectSettingsControlDescriptorsV2('src/components/HatasabaUi2SettingsBody.vue', ui2Source, currentRoutes, targetMetadata('src/components/HatasabaUi2SettingsBody.vue'));
		const earthquake = collectSettingsControlDescriptorsV2('src/components/MkEarthquakeSettings.vue', earthquakeSource, currentRoutes, targetMetadata('src/components/MkEarthquakeSettings.vue'));
		expect(ui2).toHaveLength(12);
		// `editor.copy` is a statically-audited i18n proxy. Individual controls
		// with a safe copy path stay searchable; only the runtime value and v-for
		// rows are represented by their semantic groups.
		expect(ui2.filter(entry => entry.searchable)).toHaveLength(9);
		expect(ui2.find(entry => entry.modelExpression === 'editor.draft.editedShowHatadyTab')).toMatchObject({
			searchable: true,
			preferenceKeys: ['simpleUi.showHatadyTab'],
			activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' },
		});
		expect(ui2.find(entry => entry.modelExpression === 'editor.draft.editedDeckIgnoreWidth')).toMatchObject({
			searchable: true,
			persistence: 'device',
			saveMode: 'reload',
			activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' },
		});
		expect(ui2.find(entry => entry.component === 'input')).toMatchObject({
			searchable: false,
			intentionallyExcluded: true,
			exclusionReason: 'ラベルがページローカル状態に依存し、ビルド時に安全な検索語へ評価できない',
			activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' },
		});
		expect(earthquake).toHaveLength(6);
		// A conditional popup remains a real, reachable setting: its existing
		// popup activation is retained instead of collapsing it into a group.
		expect(earthquake.filter(entry => entry.searchable)).toHaveLength(6);
		expect(earthquake.filter(entry => entry.intentionallyExcluded && entry.exclusionReason === 'ポップアップ内で条件により常時 DOM に存在しない')).toHaveLength(0);
	});

	test('Hatask暁の動的なテーマカードとドットは個別の検索項目へ昇格させない', async () => {
		const sourceFile = 'src/pages/HataskSettings.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const currentRoutes = readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8'));
		const descriptors = collectSettingsControlDescriptorsV2(sourceFile, source, currentRoutes, targetMetadata(sourceFile));
		validateSettingsControlDescriptorsV2(descriptors, 11);
		expect(descriptors.some(entry => entry.labelI18nKeys?.includes('i18n.ts._hata._hatask._settings.hatakyuWind'))).toBe(false);
		const excludedIds = ['settings.control.button-dm8pje', 'settings.control.button-1j0olqa', 'settings.control.button-1vx3yo3', 'settings.control.button-1t26f6w'];
		expect(descriptors.filter(entry => entry.intentionallyExcluded).map(entry => entry.stableId)).toEqual(excludedIds);
		expect(descriptors.find(entry => entry.labelI18nKeys?.includes('i18n.ts._hata._hatask._settings.autoAppearanceTheme'))).toMatchObject({
			searchable: true,
			labelI18nKeys: ['i18n.ts._hata._hatask._settings.autoAppearanceTheme', 'i18n.ts._hata._hatask._settings.autoAppearance'],
		});
		for (const stableId of excludedIds) {
			expect(descriptors.find(entry => entry.stableId === stableId)).toMatchObject({
				component: 'button',
				searchable: false,
				intentionallyExcluded: true,
				exclusionReason: expect.any(String),
				activation: { kind: 'popup', category: 'hatask', popup: 'hatask' },
			});
		}
		// Both repeated theme controls persist a setting, but their runtime
		// labels cannot manufacture individual searchable IDs or static hosts.
		const raw = collectSettingsInteractiveInventoryV2(sourceFile, source);
		const searchDescriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, currentRoutes, targetMetadata(sourceFile));
		const groups = searchDescriptors.filter(entry => entry.isGroup && entry.staticGroupKey != null).map(entry => ({ key: entry.staticGroupKey!, stableId: entry.stableId }));
		const resolved = resolveSettingsInteractiveInventoryDispositionsV2(raw, searchDescriptors, groups);
		const themeControls = resolved.filter(entry => entry.actionExpression === 'setV2Theme(t.id)');
		expect(themeControls).toHaveLength(2);
		for (const entry of themeControls) {
			expect(entry).toMatchObject({ classification: 'user-facing-setting', searchableControl: true, descriptorStableId: undefined });
			expect(entry.exclusionReason).toContain('安全な静的設定グループを確定できないため検索対象外');
			expect(descriptors.find(descriptor => descriptor.sourceLine === entry.sourceLine)).toMatchObject({ searchable: false, intentionallyExcluded: true });
		}
	});

	test('Hataskの条件付きダークモード検索は常設の設定グループへ到達する', async () => {
		const sourceFile = 'src/pages/HataskSettings.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const currentRoutes = readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8'));
		const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, currentRoutes, targetMetadata(sourceFile));
		const darkMode = descriptors.find(descriptor => descriptor.labelI18nKeys?.includes('i18n.ts._hata._hatask._settings.darkMode'));
		expect(darkMode).toMatchObject({
			searchable: true,
			focusId: 'settings.group.hatask-runtime-settings',
			unmet: [{ kind: 'runtime-data', id: 'conditional-setting', behavior: 'explain' }],
		});
		expect(collectSettingsDescriptorReachabilityAuditV2(descriptors).find(item => item.stableId === darkMode?.stableId)).toMatchObject({
			disposition: 'parent-static-group',
			focusId: 'settings.group.hatask-runtime-settings',
		});
	});

	test('HataFeed settings search reaches the embedded theme and preserves the leaves preference scope', async () => {
		const sourceFile = 'src/components/HataFeedDisplaySettings.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const metadata = targetMetadata(sourceFile);
		const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, routes, metadata);
		validateSettingsControlDescriptorsV2(descriptors, 4);
		const groupId = 'settings.group.hatafeed-theme';
		expect(descriptors.find(descriptor => descriptor.stableId === groupId)).toMatchObject({
			searchable: true,
			isGroup: true,
			route: '/settings/hatafeed',
			labelI18nKeys: ['i18n.ts._hata._hatafeed._displaySettings.theme'],
			persistence: 'device',
			saveMode: 'immediate',
			storageRefs: [{ kind: 'local', key: 'hatafeedTheme' }],
		});
		expect(descriptors.find(descriptor => descriptor.preferenceKeys.includes('hatafeed.leaves'))).toMatchObject({
			searchable: true,
			route: '/settings/hatafeed',
			persistence: 'profile',
			saveMode: 'immediate',
			storageRefs: [{ kind: 'pref', key: 'hatafeed.leaves' }],
		});
		const injected = injectSettingsSearchIdsV2(sourceFile, source, routes, metadata).code;
		expect(injected.match(/data-settings-search-group-id="settings.group.hatafeed-theme"/gu)).toHaveLength(1);
		const parsed = parseSfc(injected);
		const compiled = compileTemplate({ source: parsed.descriptor.template!.content, filename: sourceFile, id: 'hatafeed-search-focus' });
		expect(compiled.errors).toEqual([]);
	});

	test('Hatady carousel retains its theme inventory and one native focus host across the dialog redesign', async () => {
		const sourceFile = 'src/components/HatadyDisplaySettings.vue';
		const source = await fs.readFile(sourceFile, 'utf8');
		const metadata = targetMetadata(sourceFile);
		const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, source, routes, metadata);
		validateSettingsControlDescriptorsV2(descriptors, 3);
		const groupId = 'settings.group.hatady-display-settings';
		const group = descriptors.find(descriptor => descriptor.stableId === groupId);
		expect(group).toMatchObject({
			searchable: true,
			isGroup: true,
			persistence: 'account',
			saveMode: 'buffered',
			activation: { kind: 'popup', category: 'hatady', popup: 'hatady', focus: { kind: 'group', id: groupId } },
			storageRefs: [{ kind: 'registry', scope: ['client', 'hatady'], key: 'display' }, { kind: 'local', key: 'hatadyTheme' }],
		});
		// Each runtime theme card is represented by the group, so none receives
		// a duplicated focus ID. Save keeps its existing independent identity.
		expect(descriptors.filter(descriptor => descriptor.intentionallyExcluded)).toEqual([
			expect.objectContaining({ component: 'button', conditions: ['opt in themeOptions'], searchable: false }),
		]);
		expect(descriptors.find(descriptor => descriptor.stableId === 'settings.control.i18n-ts-hata-hatady-displaysettings-save-149300c')).toMatchObject({ searchable: true, saveMode: 'buffered' });
		const injected = injectSettingsSearchIdsV2(sourceFile, source, routes, metadata).code;
		const parsed = parseSfc(injected);
		const compiled = compileTemplate({ source: parsed.descriptor.template!.content, filename: sourceFile, id: 'hatady-search-focus' });
		expect(compiled.errors).toEqual([]);
		expect(injected.match(/<div[^>]*data-settings-search-id="settings\.group\.hatady-display-settings"/gu)).toHaveLength(1);
		expect(injected).not.toMatch(/<HyDialog[^>]*data-settings-search-id=/u);
		expect(injected).not.toMatch(/<button[^>]*v-for="opt in themeOptions"[^>]*data-settings-search-id=/u);
		const reinjected = injectSettingsSearchIdsV2(sourceFile, injected, routes, metadata).code;
		expect(reinjected.match(/data-settings-search-group-id="settings\.group\.hatady-display-settings"/gu)).toHaveLength(1);
		// Positive controls: losing either the theme action or the native host
		// must still fail the count guard; no expected-count reduction hides it.
		for (const incomplete of [
			source.replace('@click="choose(opt.value)"', '@click="previewTheme(opt.value)"'),
			source.replace(' data-settings-search-group-id="settings.group.hatady-display-settings"', ''),
		]) {
			expect(() => validateSettingsControlDescriptorsV2(collectSettingsSearchDescriptorsV2(sourceFile, incomplete, routes, metadata), 3)).toThrow('expected 3, got 2');
		}
	});

	test('hata-custom transformは既存カテゴリとpopup launcherだけに到達属性を注入する', async () => {
		const source = await fs.readFile('src/pages/settings/hata-custom.vue', 'utf8');
		const plugin = pluginCreateSettingsSearchIndexV2({
			targetFilePaths: ['src/pages/settings/*.vue', ...extensionTargets],
			mainVirtualModule: 'search-index-v2:settings',
			routerDefinitionPath: 'src/router.definition.ts',
			expectedControlCount: 494,
		});
		const transform = typeof plugin.transform === 'function' ? plugin.transform : undefined;
		expect(transform).toBeTypeOf('function');
		const transformed = await transform!.call({}, source, path.join(process.cwd(), 'src/pages/settings/hata-custom.vue'));
		const transformedCode = typeof transformed === 'string' ? transformed : transformed?.code;
		expect(transformedCode).toBeTypeOf('string');
		const injected = { code: transformedCode! };
		expect(injected.code.match(/:data-settings-category-id="cat\.id"/gu)).toHaveLength(1);
		expect(injected.code.match(/data-settings-popup-launcher="hatasaba-ui2"/gu)).toHaveLength(1);
		expect(injected.code.match(/data-settings-popup-launcher="earthquake"/gu)).toHaveLength(1);
		expect(parseSfc(injected.code).errors).toHaveLength(0);
		await expect(transform!.call({}, '.surface { color: red; }', `${path.join(process.cwd(), 'src/components/HatasabaUi2SettingsBody.vue')}?vue&type=style&index=0&lang.scss`)).resolves.toBeNull();
		const routerSource = await fs.readFile('src/router.definition.ts', 'utf8');
		const reinjected = injectSettingsSearchIdsV2('src/pages/settings/hata-custom.vue', injected.code, readSettingsRoutesV2(routerSource), {}, activationTargets);
		expect(reinjected.code.match(/:data-settings-category-id="cat\.id"/gu)).toHaveLength(1);
		expect(reinjected.code.match(/data-settings-popup-launcher=/gu)).toHaveLength(7);
		expect(() => injectSettingsSearchIdsV2('src/pages/settings/hata-custom.vue', '<template><button @click="openEarthquakeSettings"/></template>', routes, {}, activationTargets)).toThrow('expected exactly one hata-custom category button');
		expect(() => injectSettingsSearchIdsV2('src/pages/settings/hata-custom.vue', '<template><button v-for="cat in categories" @click="activeCat = cat.id"/><button @click="openEarthquakeSettings"/><button @click="openEarthquakeSettings"/></template>', routes, {}, [{ kind: 'popup', category: 'earthquake', popup: 'earthquake' }])).toThrow('expected exactly one earthquake popup launcher');
	});

	test('UI2 rangeは動的copyを偽装せず、静的section groupへ結線する', async () => {
		const source = await fs.readFile('src/components/HatasabaUi2SettingsBody.vue', 'utf8');
		const raw = collectSettingsInteractiveInventoryV2('src/components/HatasabaUi2SettingsBody.vue', source);
		const range = raw.find(item => item.component === 'input' && item.staticGroupKey?.endsWith('|section|hatasaba-ui2-opacity'));
		expect(range).toMatchObject({ classification: 'user-facing-setting', staticGroupLabel: 'hatasaba-ui2-opacity' });
	});

	test('現行legacy catalogとV2 inventoryを同じ実ソース母集団で監査する', async () => {
		const inventory = await collectRealSettingsInventory();
		const settingsFiles = inventory.files.filter(file => file.startsWith('src/pages/settings/'));
		const legacyAssigner = new MarkerIdAssigner();
		const legacy = (await Promise.all(settingsFiles.map(async sourceFile => {
			const source = await fs.readFile(sourceFile, 'utf8');
			const absoluteFile = path.join(process.cwd(), sourceFile);
			return collectFileMarkers(absoluteFile, legacyAssigner.processFile(absoluteFile, source).code);
		}))).flat();
		expect(settingsFiles).toHaveLength(51);
		expect(inventory.files).toHaveLength(63);
		expect(legacy).toHaveLength(284);
		validateSettingsControlDescriptorsV2(inventory.descriptors, 547);
		expect(inventory.descriptors.filter(entry => entry.activation?.kind === 'popup' && entry.route === '/settings/hata-custom').length).toBeGreaterThan(15);
		expect(inventory.results.reduce((count, result) => count + (result.injected.code.match(/data-settings-search-id=/gu)?.length ?? 0), 0)).toBeGreaterThan(0);
		expect(inventory.results.flatMap(result => parseSfc(result.injected.code).errors)).toHaveLength(0);
		expect(inventory.results.find(result => result.sourceFile === 'src/pages/settings/hata-custom.vue')?.injected.code.match(/:data-settings-category-id="cat\.id"/gu)).toHaveLength(1);
		// A product-owned permanent host already declares its related slot. The
		// transform must adopt that stable group ID, not add a second generated
		// host which would make fresh search results focus an unmounted popup.
		const immediate = inventory.results.find(result => result.sourceFile === 'src/components/HatasabaUi2ImmediateSettings.vue')?.injected.code;
		expect(immediate).toBeDefined();
		expect(immediate?.match(/data-settings-search-group-id="settings\.group\.hatasaba-ui2-immediate"/gu)).toHaveLength(1);
		expect(immediate?.match(/<section[^>]*data-settings-search-id="settings\.group\.hatasaba-ui2-immediate"/gu)).toHaveLength(1);
		expect(immediate?.match(/data-settings-related-host="settings\.group\.hatasaba-ui2-immediate"/gu)).toHaveLength(1);
		// Several conditional controls share this static parent. The transform must
		// emit one group focus attribute, rather than appending it once per child
		// and making the generated SFC invalid.
		const earthquake = inventory.results.find(result => result.sourceFile === 'src/components/MkEarthquakeSettings.vue')?.injected.code;
		expect(earthquake?.match(/data-settings-search-group-id="settings\.group\.earthquake-notification-settings"/gu)).toHaveLength(1);
	});

	test('malformed target・欠落target・不正routeはbuild前に検出する', async () => {
		expect(() => collectSettingsControlDescriptorsV2('src/components/BrokenSettings.vue', '<template><MkSwitch>', routes, { routeOverride: '/settings/hata-custom' })).toThrow('settings V2 parse error in src/components/BrokenSettings.vue');
		expect(() => injectSettingsSearchIdsV2('src/components/BrokenSettings.vue', '<template><MkSwitch>', routes, { routeOverride: '/settings/hata-custom' })).toThrow('settings V2 parse error in src/components/BrokenSettings.vue');
		const valid = collectSettingsControlDescriptorsV2('src/components/ValidSettings.vue', '<template><MkSwitch>有効</MkSwitch></template>', routes, { routeOverride: '/not-settings' });
		expect(() => validateSettingsControlDescriptorsV2(valid)).toThrow('invalid route');
		const missingTargetPlugin = pluginCreateSettingsSearchIndexV2({
			targetFilePaths: [{ filePath: 'src/components/DefinitelyMissingSettingsControl.vue', routeOverride: '/settings/hata-custom' }],
			mainVirtualModule: 'search-index-v2:missing',
			routerDefinitionPath: 'src/router.definition.ts',
			expectedControlCount: 0,
		});
		const load = typeof missingTargetPlugin.load === 'function' ? missingTargetPlugin.load : undefined;
		expect(load).toBeTypeOf('function');
		await expect(load!.call({}, '\0search-index-v2:missing')).rejects.toThrow('target matched no SFC');
	});

	test('新しい仮想モジュールは63 source SFC・547項目とactivationを配信する', async () => {
		const plugin = pluginCreateSettingsSearchIndexV2({
			targetFilePaths: ['src/pages/settings/*.vue', ...extensionTargets],
			mainVirtualModule: 'search-index-v2:settings',
			routerDefinitionPath: 'src/router.definition.ts',
			expectedControlCount: 547,
			modulesToHmrOnUpdate: ['src/pages/settings-redesign/index.vue'],
		});
		const load = typeof plugin.load === 'function' ? plugin.load : undefined;
		expect(load).toBeTypeOf('function');
		const generated = await load!.call({}, '\0search-index-v2:settings');
		expect(generated).toContain('settingsControlSearchIndexV2');
		expect(generated).toContain('settings.control.');
		const inventoryJson = (generated as string).match(/^export const settingsControlSearchIndexV2 = ([\s\S]+);\n$/u)?.[1];
		expect(inventoryJson).toBeDefined();
		const inventory = JSON.parse(inventoryJson!) as Array<{ sourceFile: string; route: string; activation?: { kind: string; popup?: string } }>;
		expect(inventory).toHaveLength(547);
		// Safe `editor.copy` controls stay individual; only the three dynamic
		// runtime/value areas become semantic groups.
		expect(inventory.filter(entry => entry.sourceFile === 'src/components/HatasabaUi2SettingsBody.vue' && entry.activation?.popup === 'hatasaba-ui2')).toHaveLength(16);
		expect(inventory.filter(entry => entry.sourceFile === 'src/components/MkEarthquakeSettings.vue' && entry.activation?.popup === 'earthquake')).toHaveLength(6);
		expect(inventory.every(entry => entry.persistence != null && entry.saveMode != null && entry.availability != null)).toBe(true);
	});

	test('実virtual module→i18n resolver→raw catalogとredesigned production catalogは別々の関連契約を満たす', async () => {
		const { catalog, productionCatalog, controls, descriptors, inventory, legacy, stableIdAliases, generatedPreferenceSearchId } = await buildRealCatalogFromVirtualModule();
		const isolated = {
			stableId: 'settings.fixture.isolated-control', source: 'control', searchable: true, destructive: false,
			relatedIds: ['settings.fixture.missing-target'], related: [{ stableId: 'settings.fixture.missing-target', kind: 'sameTopic', reasonKey: 'sameFeature', reason: 'fixture' }],
			relatedHostId: 'settings.fixture.isolated-control', label: '孤立した設定',
		} as never;
		expect(() => assertSettingsCatalogRelationsV2({ descriptors: [isolated], byStableId: new Map() })).toThrow('Unknown settings relation target');
		const sharedVisiblePairs = catalog.descriptors.flatMap(source => source.related
			.filter(relation => relation.reasonKey === 'sharedVisibleTerm')
			.map(relation => ({ source, target: catalog.byStableId.get(relation.stableId)! })));
		expect(sharedVisiblePairs.every(({ target }) => !/^(?:i18n|editor|draft|copy|model(?:Value)?|value|prefer|store)(?:[.\[]|$)/u.test(target.label))).toBe(true);
		expect(catalog.descriptors.filter(descriptor => /^(?:i18n|editor|draft|copy|model(?:Value)?|value|prefer|store)(?:[.\[]|$)/u.test(descriptor.label)).every(descriptor => descriptor.related.every(relation => relation.reasonKey !== 'sharedVisibleTerm'))).toBe(true);
		const forbiddenSharedPairs = new Set([
			['Totp', 'Cherrypick Labs'], ['Totp', 'Function'], ['Totp', 'Patch'], ['Totp', 'Api'], ['Totp', 'Service Connection'],
			['2fa', 'i18n.ts.securityKeyAndPasskey'],
		].map(pair => pair.join('\u0000')));
		expect(catalog.descriptors.some(source => source.owner === 'hatasaba' && source.related.length > 0)).toBe(true);
		expect(sharedVisiblePairs.some(({ source, target }) => forbiddenSharedPairs.has(`${source.label}\u0000${target.label}`))).toBe(false);
		const brandOnlyVisible = sharedVisiblePairs.filter(({ source, target }) => /^(?:CherryPick|Misskey|Hataskey|Hatasaba|UI)$/iu.test(source.label.trim()) || /^(?:CherryPick|Misskey|Hataskey|Hatasaba|UI)$/iu.test(target.label.trim()));
		const longLabelVisible = sharedVisiblePairs.filter(({ source, target }) => source.label.length > 80 || target.label.length > 80);
		const externalNotificationTimeline = catalog.descriptors.filter(source => /外部通知.*(?:popup|ポップアップ)/iu.test(source.label)).flatMap(source => source.related.map(relation => ({ source, target: catalog.byStableId.get(relation.stableId)! }))).filter(({ target }) => /外部.*(?:タイムライン|TL)/iu.test(target.label));
		expect(brandOnlyVisible).toHaveLength(0);
		expect(longLabelVisible).toHaveLength(0);
		expect(externalNotificationTimeline).toHaveLength(0);
		const zeroRelated = catalog.descriptors.filter(descriptor => descriptor.source === 'control' && !descriptor.isGroup && descriptor.searchable && !descriptor.destructive && descriptor.related.length === 0);
		const forbiddenRelationPairs: readonly [RegExp, RegExp][] = [
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
		const relationSuspects = catalog.descriptors.flatMap(source => source.related.flatMap(relation => {
			const target = catalog.byStableId.get(relation.stableId);
			if (target == null) return [];
			return forbiddenRelationPairs.some(([left, right]) => (left.test(source.label) && right.test(target.label)) || (left.test(target.label) && right.test(source.label)))
				? [{ source: source.label, target: target.label, sourceStableId: source.stableId, targetStableId: target.stableId }]
				: [];
		}));
		const productionLabelExpectations = [
			{ sourceFile: 'src/pages/settings/email.vue', sourceLine: 16, labelI18nKey: 'i18n.ts.emailAddress' },
			{ sourceFile: 'src/pages/settings/hata-custom.vue', sourceLine: 233, labelI18nKey: 'i18n.ts._hata._customSettings._ui.foldableSection' },
			{ sourceFile: 'src/pages/settings/emoji-palette.vue', sourceLine: 25, labelI18nKey: 'i18n.ts._emojiPalette.palettes' },
			{ sourceFile: 'src/pages/settings/drive.vue', sourceLine: 105, labelI18nKey: 'i18n.ts.watermark' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 241, labelI18nKey: 'i18n.ts._hata._mascotSettings.minimum' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 242, labelI18nKey: 'i18n.ts._hata._mascotSettings.maximum' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 382, labelI18nKey: 'i18n.ts._hata._mascotSettings.notificationExpression' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 384, labelI18nKey: 'i18n.ts._hata._mascotSettings.optionalLabelPlaceholder' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 441, labelI18nKey: 'i18n.ts._hata._mascotSettings.notificationExpressionSecond' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 443, labelI18nKey: 'i18n.ts._hata._mascotSettings.optionalLabelPlaceholder' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 500, labelI18nKey: 'i18n.ts._hata._mascotSettings.birthdayExpression' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 502, labelI18nKey: 'i18n.ts._hata._mascotSettings.optionalLabelPlaceholder' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 503, labelI18nKey: 'i18n.ts._hata._mascotSettings.birthdayPhrasePlaceholder' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 539, labelI18nKey: 'i18n.ts._hata._mascotSettings.month' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 540, labelI18nKey: 'i18n.ts._hata._mascotSettings.day' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 547, labelI18nKey: 'i18n.ts._hata._mascotSettings.characterBirthday' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 549, labelI18nKey: 'i18n.ts._hata._mascotSettings.optionalLabelPlaceholder' },
			{ sourceFile: 'src/pages/MkMascotSettings.vue', sourceLine: 550, labelI18nKey: 'i18n.ts._hata._mascotSettings.characterBirthdayPhraseExample' },
		] as const;
		const controlByStableId = new Map(controls.map(control => [control.stableId, control]));
		const labelAuditIssues = [
			...catalog.descriptors.filter(descriptor => descriptor.searchable && !descriptor.destructive).flatMap(descriptor => {
				const issues: string[] = [];
				const control = controlByStableId.get(descriptor.stableId);
				if (/^(?:i18n|editor|draft|copy|model(?:Value)?|value|prefer|store)(?:[.\[]|$)/u.test(descriptor.label)) issues.push(`${descriptor.stableId}:internal`);
				if (descriptor.label.length > 80) issues.push(`${descriptor.stableId}:long`);
				if (/名前\s+このキャラを削除|動きなしぴょんぴょんガクガクゆらゆら回転/iu.test(descriptor.label)) issues.push(`${descriptor.stableId}:interactive-text`);
				if (descriptor.sourceFile === 'src/pages/settings/profile.vue' && ['element.name', 'element.value'].includes(descriptor.modelExpression ?? '') && control?.aliases.includes('i18n.ts._profile.verifiedLinkDescription')) issues.push(`${descriptor.stableId}:metadata-notice-label`);
				if (descriptor.sourceFile === 'src/pages/settings/privacy.vue' && [144, 154, 164, 173, 194, 204, 214, 223].includes(descriptor.sourceLine ?? -1) && control?.aliases.includes('i18n.ts._accountSettings.mayNotEffectSomeSituations')) issues.push(`${descriptor.stableId}:privacy-warning-label`);
				return issues;
			}),
			...productionLabelExpectations.flatMap(expected => {
				const descriptor = catalog.descriptors.find(item => item.sourceFile === expected.sourceFile && item.sourceLine === expected.sourceLine);
				const control = descriptor == null ? undefined : controlByStableId.get(descriptor.stableId);
				return descriptor != null && control?.aliases.includes(expected.labelI18nKey)
					? []
					: [`${expected.sourceFile}:${expected.sourceLine}:production-label:${expected.labelI18nKey}`];
			}),
		];
		const compressionControls = catalog.descriptors.filter(descriptor => descriptor.sourceSemanticGroupId === 'settings.semantic.feature.media-compression');
		expect(compressionControls.length).toBeGreaterThanOrEqual(2);
		expect(compressionControls.some(source => source.related.some(relation => compressionControls.some(target => target.stableId === relation.stableId)))).toBe(true);
		const orphanFixture = { ...catalog.descriptors.find(descriptor => descriptor.source === 'control')!, stableId: 'settings.fixture.orphan-control', related: [], relatedIds: [], noRelatedReason: undefined };
		expect([orphanFixture].filter(descriptor => descriptor.source === 'control' && !descriptor.isGroup && descriptor.searchable && !descriptor.destructive && descriptor.related.length === 0)).toHaveLength(1);
		// Measured against both responsive editors in the current source.
		for (const line of [71, 347]) {
			const mascotName = catalog.descriptors.find(descriptor => descriptor.sourceFile === 'src/pages/MkMascotSettings.vue' && descriptor.sourceLine === line);
			expect(mascotName?.label, `Mascot:${line}`).toBe('名前');
		}
		const timelineMotion = catalog.descriptors.find(descriptor => descriptor.sourceFile === 'src/pages/settings/hata-custom.vue' && descriptor.sourceLine === 69);
		expect(timelineMotion?.label).toMatch(/アニメーション方向/u);
		// Runtime Sortable metadata rows have no FormSlot of their own. Their
		// placeholder is the only per-field label; the surrounding verified-link
		// notice must never become the searchable label.
		const profileMetadataLabels = new Map(
			descriptors
				.filter(descriptor => descriptor.sourceFile === 'src/pages/settings/profile.vue' && ['element.name', 'element.value'].includes(descriptor.modelExpression ?? ''))
				.map(descriptor => [descriptor.modelExpression, descriptor.labelI18nKeys?.[0]]),
		);
		expect(profileMetadataLabels).toEqual(new Map([
			['element.name', 'i18n.ts._profile.metadataLabel'],
			['element.value', 'i18n.ts._profile.metadataContent'],
		]));
		const privacySlotLabels = new Map(
			descriptors
				.filter(descriptor => descriptor.sourceFile === 'src/pages/settings/privacy.vue' && [144, 154, 164, 173, 194, 204, 214, 223].includes(descriptor.sourceLine ?? -1))
				.map(descriptor => [descriptor.sourceLine, descriptor.labelI18nKeys?.[0]]),
		);
		expect(privacySlotLabels).toEqual(new Map([
			[144, 'i18n.ts._accountSettings.makeNotesFollowersOnlyBefore'],
			[154, 'i18n.ts._accountSettings.makeNotesFollowersOnlyBefore'],
			[164, 'i18n.ts._accountSettings.makeNotesFollowersOnlyBefore'],
			[173, 'i18n.ts._accountSettings.makeNotesFollowersOnlyBefore'],
			[194, 'i18n.ts._accountSettings.makeNotesHiddenBefore'],
			[204, 'i18n.ts._accountSettings.makeNotesHiddenBefore'],
			[214, 'i18n.ts._accountSettings.makeNotesHiddenBefore'],
			[223, 'i18n.ts._accountSettings.makeNotesHiddenBefore'],
		]));
		for (const expected of productionLabelExpectations) {
			const descriptor = descriptors.find(item => item.sourceFile === expected.sourceFile && item.sourceLine === expected.sourceLine);
			expect(descriptor?.labelI18nKeys, `${expected.sourceFile}:${expected.sourceLine}`).toEqual([expected.labelI18nKey]);
		}
		if (process.env.SETTINGS_RELATION_AUDIT === '1') {
			const samples: Array<Record<string, unknown>> = [];
			const sampledStrata = new Set<string>();
			const reasonCounts = new Map<string, number>();
			const sharedVisibleSamples: Array<Record<string, unknown>> = [];
			for (const descriptor of catalog.descriptors) {
				for (const relation of descriptor.related) {
					reasonCounts.set(relation.reasonKey ?? 'missing', (reasonCounts.get(relation.reasonKey ?? 'missing') ?? 0) + 1);
					if (relation.reasonKey !== 'sharedVisibleTerm' || sharedVisibleSamples.length >= 20) continue;
					const target = catalog.byStableId.get(relation.stableId);
					if (target == null) continue;
					sharedVisibleSamples.push({ source: descriptor.label, sourceStableId: descriptor.stableId, sourceType: descriptor.source, sourceFile: descriptor.sourceFile, sourceLine: descriptor.sourceLine, sourceSemanticGroupId: descriptor.sourceSemanticGroupId, semanticGroupId: descriptor.semanticGroupId, target: target.label, targetStableId: target.stableId, targetType: target.source, targetFile: target.sourceFile, targetLine: target.sourceLine, targetSemanticGroupId: target.sourceSemanticGroupId, targetSemanticGroup: target.semanticGroupId, weight: relation.weight, reason: relation.reason });
				}
			}
			const sampleCandidates = catalog.descriptors
				.filter(item => item.source === 'control' && item.searchable && !item.destructive && item.related.length > 0)
				.sort((left, right) => `${left.owner}|${left.persistence}|${left.categoryId}|${left.stableId}`.localeCompare(`${right.owner}|${right.persistence}|${right.categoryId}|${right.stableId}`));
			const sampleOwners = ['core', 'cherrypick', 'hatasaba'] as const;
			for (const descriptor of [...sampleOwners.flatMap(owner => sampleCandidates.filter(item => item.owner === owner).slice(0, 1)), ...sampleCandidates]) {
				if (samples.length === 20) break;
				const stratum = `${descriptor.owner}|${descriptor.persistence}|${descriptor.categoryId}`;
				if (sampledStrata.has(stratum) && samples.length < 20) continue;
				const relation = descriptor.related[0]!;
				const target = catalog.byStableId.get(relation.stableId);
				if (target == null) continue;
				sampledStrata.add(stratum);
				samples.push({ source: descriptor.label, sourceStableId: descriptor.stableId, sourceType: descriptor.source, sourceFile: descriptor.sourceFile, sourceLine: descriptor.sourceLine, sourceSemanticGroupId: descriptor.sourceSemanticGroupId, semanticGroupId: descriptor.semanticGroupId, target: target.label, targetStableId: target.stableId, targetType: target.source, targetFile: target.sourceFile, targetLine: target.sourceLine, targetSemanticGroupId: target.sourceSemanticGroupId, targetSemanticGroup: target.semanticGroupId, reasonKey: relation.reasonKey, weight: relation.weight, owner: descriptor.owner, persistence: descriptor.persistence, categoryId: descriptor.categoryId });
				if (samples.length === 20) break;
			}
			const zeroByOwnerCategoryFile = Object.fromEntries([...zeroRelated.reduce((counts, descriptor) => { const key = `${descriptor.owner}|${descriptor.categoryId}|${descriptor.sourceFile}`; counts.set(key, (counts.get(key) ?? 0) + 1); return counts; }, new Map<string, number>())].sort());
			console.log(JSON.stringify({ reasonCounts: Object.fromEntries([...reasonCounts].sort()), zeroRelatedControlCount: zeroRelated.length, noRelatedReasonCount: catalog.descriptors.filter(descriptor => descriptor.noRelatedReason != null).length, suspects: relationSuspects.length, labelAudit: labelAuditIssues.length, zeroByOwnerCategoryFile, zeroRelatedControls: zeroRelated.map(descriptor => ({ stableId: descriptor.stableId, label: descriptor.label, sourceFile: descriptor.sourceFile, sourceLine: descriptor.sourceLine, categoryId: descriptor.categoryId, semanticGroupId: descriptor.semanticGroupId, sourceSemanticGroupId: descriptor.sourceSemanticGroupId })), layeredSamples: samples, sharedVisibleSamples }, null, 2));
		}
		// The raw generator audits the old static SFC inventory. Its isolated rows
		// are intentionally resolved only after the redesigned runtime merge.
		const productionZeroRelated = productionCatalog.descriptors.filter(descriptor => descriptor.source === 'control' && descriptor.searchable && !descriptor.destructive && descriptor.related.length === 0);
		const legacyPreferenceControls = controls.filter(control => control.sourceFile === 'src/pages/settings/preferences.vue' && control.route === '/settings/preferences');
		expect(legacyPreferenceControls).toHaveLength(124);
		const legacyBorderControls = controls.filter(control => control.sourceFile === 'src/pages/settings/hata-custom.vue' && control.preferenceKeys.some(key => key.startsWith('postFormVisibilityBorder.')));
		expect(legacyBorderControls).toHaveLength(6);
		// The UI S navigation alias is generated directly, outside the legacy SFC inventory.
		expect(stableIdAliases.get(generatedPreferenceSearchId('hataskeyUi3BottomNav'))).toBe(generatedPreferenceSearchId('simpleUi.bottomNav'));
		expect(stableIdAliases.size).toBe(legacyPreferenceControls.length + legacyBorderControls.length + 1);
		for (const control of legacyBorderControls) {
			const key = control.preferenceKeys[0]!;
			const stableId = generatedPreferenceSearchId(key);
			expect(stableIdAliases.get(control.stableId), key).toBe(stableId);
			expect(canonicalStableIdForCatalogV2(productionCatalog, control.stableId), key).toBe(stableId);
			expect(productionCatalog.byStableId.get(stableId)?.unmet, key).toBeUndefined();
			expect(productionCatalog.byStableId.get(stableId), key).toMatchObject({ route: '/settings/preferences', destinationId: 'hataskey-ui-s', preferenceKeys: [key], persistence: 'profile', saveMode: 'immediate' });
			expect(productionCatalog.descriptors.filter(item => item.source === 'control' && item.preferenceKeys.includes(key)), key).toHaveLength(1);
		}
		for (const query of ['公開範囲', '色分け', '投稿フォーム', 'ぼかし']) {
			expect(searchSettingsV2(productionCatalog, query).results.some(result => result.stableId === generatedPreferenceSearchId('postFormVisibilityBorder.enabled')), query).toBe(true);
		}
		const canonicalPreferenceIds = productionCatalog.descriptors
			.filter(descriptor => descriptor.sourceFile === 'src/pages/settings-redesign/settings-preferences-catalog.ts' && descriptor.route === '/settings/preferences')
			.map(descriptor => descriptor.stableId);
		expect(canonicalPreferenceIds).toHaveLength(140);
		expect(new Set(canonicalPreferenceIds).size).toBe(140);
		const aliasValues = new Set(stableIdAliases.values());
		expect(aliasValues.size).toBe(125);
		// These canonical descriptors have no legacy searchable stable ID,
		// while the redesigned catalog still materializes all 140 canonical descriptors.
		const missingCanonicalIds = canonicalPreferenceIds.filter(id => !aliasValues.has(id)).sort();
		expect(missingCanonicalIds).toEqual([
			generatedPreferenceSearchId('emojiAdditionNotice'),
			generatedPreferenceSearchId('hataskeyUi3ComposerEmojiPosition'),
			generatedPreferenceSearchId('hataskeyUi3ComposerPosition'),
			generatedPreferenceSearchId('hataskeyUi3TimelineBackground'),
			generatedPreferenceSearchId('hataskeyUi3SideMenuBackground'),
			generatedPreferenceSearchId('hataskeyUi3RightPaneBackground'),
			generatedPreferenceSearchId('hataskeyUi3GlassDensity'),
			generatedPreferenceSearchId('hataskeyUi3ComposerShortcut1'),
			generatedPreferenceSearchId('hataskeyUi3ComposerShortcut2'),
			generatedPreferenceSearchId('hataskeyUi3RssEnabled'),
			generatedPreferenceSearchId('hataskeyUi3RssFeeds'),
			generatedPreferenceSearchId('hataskeyUi3RssAutoSwitch'),
			generatedPreferenceSearchId('hataskeyUi3RssReadSeconds'),
			generatedPreferenceSearchId('hataskeyUi3RssReadMode'),
			generatedPreferenceSearchId('hourlyTimeNotice'),
			generatedPreferenceSearchId('smoothTransitionAnimations'),
			generatedPreferenceSearchId('testNotification'),
		].sort());
		expect([...aliasValues].filter(id => !canonicalPreferenceIds.includes(id))).toEqual([generatedPreferenceSearchId('simpleUi.bottomNav'), 'settings.destination.misskey-data-saver']);
		for (const control of legacyPreferenceControls) {
			expect(stableIdAliases.has(control.stableId)).toBe(true);
		}
		expect(stableIdAliases.get('settings.control.lang-iirt1l')).toBe(generatedPreferenceSearchId('lang'));
		expect(stableIdAliases.get('settings.control.useboldfont-1hpnn4z')).toBe(generatedPreferenceSearchId('useBoldFont'));
		expect(stableIdAliases.get('settings.control.usesystemfont-1nx4imd')).toBe(generatedPreferenceSearchId('useSystemFont'));
		expect(stableIdAliases.get('settings.control.devicehorizontalswipe-1mqerrh')).toBe(generatedPreferenceSearchId('enableHorizontalSwipe'));
		expect(stableIdAliases.get('settings.control.i18n-ts-enableall-1fiasic')).toBe('settings.destination.misskey-data-saver');
		expect(stableIdAliases.get('settings.control.i18n-ts-disableall-1y966ue')).toBe('settings.destination.misskey-data-saver');
		expect(stableIdAliases.get('settings.group.src-pages-settings-preferences-vue-pu703b')).toBe(generatedPreferenceSearchId('additionalUnicodeEmojiIndexes'));
		expect(productionZeroRelated.map(descriptor => ({ stableId: descriptor.stableId, label: descriptor.label, semanticGroupId: descriptor.semanticGroupId, sourceSemanticGroupId: descriptor.sourceSemanticGroupId }))).toEqual([]);
		assertSettingsCatalogRelationsV2(productionCatalog);
		const legacyPreferenceMarkers = new Set(productionCatalog.descriptors
			.filter(descriptor => descriptor.source === 'legacy' && descriptor.route === '/settings/preferences')
			.map(descriptor => descriptor.stableId));
		expect(productionCatalog.descriptors.every(descriptor => descriptor.relatedIds.every(id => !legacyPreferenceMarkers.has(id)))).toBe(true);
		for (const descriptor of productionCatalog.descriptors) {
			for (const relation of descriptor.related) {
				const target = productionCatalog.byStableId.get(relation.stableId)!;
				expect(target.destructive).not.toBe(true);
				expect(target.searchable || target.source === 'destination').toBe(true);
				expect(target.source === 'destination' && descriptor.route === target.route && descriptor.destinationId != null && descriptor.destinationId === target.destinationId).toBe(false);
			}
		}
		expect(relationSuspects).toHaveLength(0);
		expect(labelAuditIssues).toHaveLength(0);
		expect(descriptors).toHaveLength(547);
		expect(legacy).toHaveLength(284);
		expect(catalog.byLegacyId.size).toBe(284);
		expect(controls).toHaveLength(descriptors.filter((descriptor: { searchable: boolean }) => descriptor.searchable).length);
		expect(catalog.descriptors.filter(descriptor => descriptor.source === 'control' && descriptor.searchable && !descriptor.destructive).every(descriptor => descriptor.related.length > 0 || descriptor.noRelatedReason != null)).toBe(true);
		expect(catalog.descriptors.filter(descriptor => descriptor.searchable && !descriptor.destructive).filter(descriptor => /^(?:i18n|editor|draft|copy|model(?:Value)?|value|prefer|store)(?:[.\[]|$)/u.test(descriptor.label))).toHaveLength(0);
		expect(catalog.descriptors.filter(descriptor => descriptor.searchable && !descriptor.destructive && descriptor.label.length > 80)).toHaveLength(0);
		expect(catalog.descriptors.every(descriptor => descriptor.related.every(related => related.stableId !== descriptor.stableId && catalog.byStableId.has(related.stableId) && catalog.byStableId.get(related.stableId)?.destructive !== true))).toBe(true);
		expect(catalog.descriptors.every(descriptor => descriptor.persistence != null && descriptor.saveMode != null && descriptor.availability != null && descriptor.owner != null && descriptor.applicableUi != null)).toBe(true);
		expect(inventory.items.every(item => (item.descriptorStableId == null) !== (item.exclusionReason == null))).toBe(true);
		const destructive = catalog.descriptors.filter(descriptor => descriptor.source === 'control' && descriptor.destructive);
		expect(destructive.length).toBeGreaterThan(0);
		for (const descriptor of destructive) {
			expect(searchSettingsV2(catalog, descriptor.label).results.some(result => result.stableId === descriptor.stableId)).toBe(true);
			expect(searchSettingsV2(catalog, descriptor.label, { suggestionsOnly: true }).suggestions.some(result => result.stableId === descriptor.stableId)).toBe(false);
			expect(catalog.descriptors.every(item => !item.relatedIds.includes(descriptor.stableId))).toBe(true);
		}
		await initIntlString(true);
		// The migration dictionary owns one first destination per query family.
		// Check result[0], rather than scanning a long result list: an unrelated
		// label must never make the search appear correct by coincidence.
		const primaryAliasChecks = [
			{ queries: ['透過', 'opacity', 'ｏｐａｃｉｔｙ', 'simpleUi.glassUiCardOpacity', '角丸カード'], stableId: 'settings.group.src-components-hatasabaui2settingsbody-vue-wroy7y', source: 'control', sourceFile: 'src/components/HatasabaUi2SettingsBody.vue', categoryId: 'hataskey-ui', activation: { kind: 'popup', category: 'glassUi', focusKind: 'group' } },
			{ queries: ['ぼかし', 'ボカシ', 'bokashi'], stableId: 'settings.group.src-components-hatasabaui2settingsbody-vue-1wojvcw', source: 'control', sourceFile: 'src/components/HatasabaUi2SettingsBody.vue', categoryId: 'hataskey-ui', activation: { kind: 'popup', category: 'glassUi', focusKind: 'group' } },
			{ queries: ['吹き出し', 'バブル'], stableId: 'settings.control.editor-draft-editedglassuibubble-1oy75h3', source: 'control', sourceFile: 'src/components/HatasabaUi2SettingsBody.vue', categoryId: 'hataskey-ui', activation: { kind: 'popup', category: 'glassUi', focusKind: 'control' } },
			{ queries: ['間隔', '詰める', '余白', 'showGapBetweenNotesInTimeline'], stableId: 'settings.control.showgapbetweennotesintimeline-fhy3lh', source: 'control', sourceFile: 'src/pages/settings/preferences.vue', categoryId: 'timeline-posting', preferenceKey: 'showGapBetweenNotesInTimeline' },
			// The only outer condition is the category itself, which activation
			// already satisfies. Keep the precise individual focus target.
			{ queries: ['bot', '自動投稿', 'ノイズ'], stableId: 'settings.control.hidebotsintimeline-5zn9z0', source: 'control', sourceFile: 'src/pages/settings/hata-custom.vue', categoryId: 'hata-tools', preferenceKey: 'simpleUi.hideBotsInTimeline', activation: { kind: 'hata-custom-category', category: 'general', focusKind: 'control' } },
			{ queries: ['ナビ', 'タブ', '下のバー', 'simpleUi.bottomNav'], stableId: 'settings.group.src-components-hatasabaui2settingsbody-vue-1xtmw3e', source: 'control', sourceFile: 'src/components/HatasabaUi2SettingsBody.vue', categoryId: 'hataskey-ui', activation: { kind: 'popup', category: 'glassUi', focusKind: 'group' } },
			{ queries: ['ニックネーム', 'ニャ', 'nicknameEnabled'], stableId: 'settings.control.nicknameenabled-p90ju4', source: 'control', sourceFile: 'src/pages/settings/cherrypick.vue', categoryId: 'cherrypick', preferenceKey: 'nicknameEnabled' },
			{ queries: ['Enterで送信'], stableId: 'settings.control.chatsendonenter-1d3fj7q', source: 'control', sourceFile: 'src/pages/settings/preferences.vue', categoryId: 'timeline-posting', preferenceKey: 'chat.sendOnEnter' },
			{ queries: ['ハタキュ', 'アイコン', 'ブランディング'], stableId: 'settings.control.usehatakyuillustrations-led4yp', source: 'control', sourceFile: 'src/components/HatasabaUi2ImmediateSettings.vue', categoryId: 'hataskey-ui', preferenceKey: 'hataBranding.useHatakyu', activation: { kind: 'hata-custom-category', category: 'glassUi', focusKind: 'control' } },
			{ queries: ['天気', '雨', '雪', '若葉', '演出'], stableId: 'settings.control.weathereffectenabled-1f2cldp', source: 'control', sourceFile: 'src/pages/settings/hata-custom.vue', categoryId: 'hata-tools', preferenceKey: 'weatherEffect.enabled', activation: { kind: 'hata-custom-category', category: 'accessibility', focusKind: 'control' } },
			{ queries: ['カラム', 'deck.columnAlign'], stableId: 'settings.control.columnalign-dms06i', source: 'control', sourceFile: 'src/pages/settings/deck.vue', categoryId: 'display-notes', preferenceKey: 'deck.columnAlign' },
			{ queries: ['壁紙'], stableId: 'settings.control.deck-wallpaper-138dc9x', source: 'control', sourceFile: 'src/pages/settings/deck.vue', categoryId: 'display-notes', preferenceKey: 'deck.wallpaper' },
			{ queries: ['メニュー位置'], stableId: 'settings.control.menuposition-1pacznk', source: 'control', sourceFile: 'src/pages/settings/deck.vue', categoryId: 'display-notes', preferenceKey: 'deck.menuPosition' },
			// The broad old 2FA wording reaches the static, always-mounted section.
			// Passkey words retain the existing specific legacy marker.
			{ queries: ['2段階'], stableId: 'settings.group.security-key-runtime-settings', source: 'control', sourceFile: 'src/pages/settings/2fa.vue', categoryId: 'account' },
			{ queries: ['セキュリティ'], stableId: 'settings.security.item-tvuwoh', source: 'legacy', categoryId: 'account' },
			{ queries: ['パスキー'], stableId: 'settings.security.item-57xehf', source: 'legacy', categoryId: 'account' },
			{ queries: ['pasuki'], stableId: 'settings.control.usepasswordlesslogin-kpujua', source: 'control', sourceFile: 'src/pages/settings/2fa.vue', categoryId: 'account' },
			{ queries: ['2FA'], stableId: 'settings.group.security-key-runtime-settings', source: 'control', sourceFile: 'src/pages/settings/2fa.vue', categoryId: 'account' },
			{ queries: ['Hataskey全体', '旗鯖全体', 'その他'], stableId: 'settings.group.src-pages-settings-hata-custom-vue-28qg9w', source: 'control', sourceFile: 'src/pages/settings/hata-custom.vue', categoryId: 'hata-tools', activation: { kind: 'hata-custom-category', category: 'general', focusKind: 'group' } },
			// The former generic UI tab must focus the permanent, mounted surface;
			// the legacy popup launcher descriptor remains only for hash compatibility.
			{ queries: ['UI', 'Hataskey UI'], stableId: 'settings.group.hatasaba-ui2-immediate', source: 'control', sourceFile: 'src/components/HatasabaUi2ImmediateSettings.vue', categoryId: 'hataskey-ui', activation: { kind: 'hata-custom-category', category: 'glassUi', focusKind: 'group' } },
			{ queries: ['折りたたみ', 'foldable'], stableId: 'settings.group.hatasaba-ui2-immediate-foldable', source: 'control', sourceFile: 'src/components/HatasabaUi2ImmediateSettings.vue', categoryId: 'hataskey-ui', activation: { kind: 'hata-custom-category', category: 'glassUi', focusKind: 'group' } },
			{ queries: ['ビジュアル'], stableId: 'settings.group.src-pages-settings-hata-custom-vue-iqryzw', source: 'control', sourceFile: 'src/pages/settings/hata-custom.vue', categoryId: 'display-notes', activation: { kind: 'hata-custom-category', category: 'visual', focusKind: 'group' } },
		] as const;
		for (const expected of primaryAliasChecks) {
			for (const query of expected.queries) {
				const result = searchSettingsV2(catalog, query, { limit: 1 }).results[0];
				expect(result, query).toBeDefined();
				expect(result?.stableId, query).toBe(expected.stableId);
				expect(result?.source, query).toBe(expected.source);
				expect(result?.categoryId, query).toBe(expected.categoryId);
				if ('sourceFile' in expected) expect(result?.sourceFile, query).toBe(expected.sourceFile);
				if ('preferenceKey' in expected) expect(result?.preferenceKeys, query).toContain(expected.preferenceKey);
				if ('activation' in expected) {
					expect(result?.activation, query).toMatchObject({
						kind: expected.activation.kind,
						category: expected.activation.category,
					focus: { kind: expected.activation.focusKind, id: 'focusId' in expected.activation ? expected.activation.focusId : expected.stableId },
					});
				}
			}
		}

		// The redesigned shell has four same-route preference shortcuts. Their
		// generated IDs are intentionally stable, but the integration contract
		// must fail if a source/model edit changes one instead of silently leaving
		// a navigation link that can never focus its intended control.
		for (const [stableId, preferenceKey, expectedFocusId] of [
			['settings.control.showgapbetweennotesintimeline-fhy3lh', 'showGapBetweenNotesInTimeline', 'settings.control.showgapbetweennotesintimeline-fhy3lh'],
			['settings.control.showreplytargetnote-1kw238d', 'showReplyTargetNote', 'settings.control.showreplytargetnote-1kw238d'],
			['settings.control.showfixedpostform-h9wq8p', 'showFixedPostForm', 'settings.control.showfixedpostform-h9wq8p'],
			['settings.control.chatsendonenter-1d3fj7q', 'chat.sendOnEnter', 'settings.group.src-pages-settings-preferences-vue-13m3io2'],
		] as const) {
			const matches = catalog.descriptors.filter(descriptor => descriptor.stableId === stableId);
			expect(matches, stableId).toHaveLength(1);
			expect(matches[0]).toMatchObject({
				source: 'control',
				route: '/settings/preferences',
				sourceFile: 'src/pages/settings/preferences.vue',
			});
			expect(matches[0]?.controlId, stableId).toBe(expectedFocusId);
			expect(matches[0]?.preferenceKeys, stableId).toContain(preferenceKey);
		}
	}, 30_000);

	test('target/router/registry/runtime evidence更新時はvirtual moduleと設定検索consumerをHMR対象に含める', () => {
		const plugin = pluginCreateSettingsSearchIndexV2({
			targetFilePaths: ['src/pages/settings/*.vue'],
			mainVirtualModule: 'search-index-v2:settings',
			routerDefinitionPath: 'src/router.definition.ts',
			expectedControlCount: 321,
			modulesToHmrOnUpdate: ['src/pages/settings-redesign/index.vue'],
		});
		const hotUpdate = typeof plugin.hotUpdate === 'function' ? plugin.hotUpdate : undefined;
		expect(hotUpdate).toBeTypeOf('function');
		const sourceModule = { id: 'source' };
		const virtualModule = { id: '\0search-index-v2:settings' };
		const consumerModule = { id: path.join(process.cwd(), 'src/pages/settings-redesign/index.vue').replace(/\\/gu, '/') };
		const modules = new Map([[virtualModule.id, virtualModule], [consumerModule.id, consumerModule]]);
		const updated = hotUpdate!.call({}, {
			file: path.join(process.cwd(), 'src/pages/settings/deck.vue'),
			modules: [sourceModule],
			server: { moduleGraph: { getModuleById: (id: string) => modules.get(id) } },
		} as never) as unknown as Array<{ id: string }>;
		expect(updated.map(module => module.id)).toEqual(['source', virtualModule.id, consumerModule.id]);
		const runtimeEvidenceUpdate = hotUpdate!.call({}, {
			file: path.join(process.cwd(), 'src/ui/universal.vue'),
			modules: [sourceModule],
			server: { moduleGraph: { getModuleById: (id: string) => modules.get(id) } },
		} as never) as unknown as Array<{ id: string }>;
		expect(runtimeEvidenceUpdate.map(module => module.id)).toEqual(['source', virtualModule.id, consumerModule.id]);
		const registryUpdate = hotUpdate!.call({}, {
			file: path.join(process.cwd(), 'src/preferences/def.ts'),
			modules: [sourceModule],
			server: { moduleGraph: { getModuleById: (id: string) => modules.get(id) } },
		} as never) as unknown as Array<{ id: string }>;
		expect(registryUpdate.map(module => module.id)).toEqual(['source', virtualModule.id, consumerModule.id]);
		for (const file of ['settings-preferences-catalog.ts', 'settings-preferences-models.ts', 'settings-preferences-search-index.ts']) {
			const redesignedUpdate = hotUpdate!.call({}, {
				file: path.join(process.cwd(), 'src/pages/settings-redesign', file),
				modules: [sourceModule],
				server: { moduleGraph: { getModuleById: (id: string) => modules.get(id) } },
			} as never) as unknown as Array<{ id: string }>;
			expect(redesignedUpdate.map(module => module.id)).toEqual(['source', virtualModule.id, consumerModule.id]);
		}
		const transitiveComponentUpdate = hotUpdate!.call({}, {
			file: path.join(process.cwd(), 'src/components/MkPreferenceContainer.vue'),
			modules: [sourceModule],
			server: { moduleGraph: { getModuleById: (id: string) => modules.get(id) } },
		} as never) as unknown as Array<{ id: string }>;
		expect(transitiveComponentUpdate.map(module => module.id)).toEqual(['source', virtualModule.id, consumerModule.id]);
	});
});
