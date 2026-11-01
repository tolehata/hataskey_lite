/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { describe, expect, test } from 'vitest';
import shellSource from './index.vue?raw';
import gatewaySource from './gateway.vue?raw';
import panelSource from './SettingsSearchPanel.vue?raw';
import relatedSource from './SettingsRelatedLinks.vue?raw';
import controlRelatedSource from '@/components/settings-redesign/SettingsControlRelated.vue?raw';
import ui2BodySource from '@/components/HatasabaUi2SettingsBody.vue?raw';
import immediateSource from '@/components/HatasabaUi2ImmediateSettings.vue?raw';
import previewSource from '@/components/MkHatasabaUi2PreviewWindow.vue?raw';
import bentoSource from './SettingsBentoNavigation.vue?raw';
import bentoCatalogSource from './settings-bento-catalog.ts?raw';

interface TranslationTree {
	[key: string]: string | TranslationTree;
}

function settingsRedesignTree(locale: unknown): TranslationTree {
	const root = locale as { _hata?: { _settingsRedesign?: TranslationTree } };
	if (root._hata?._settingsRedesign == null) throw new Error('missing _hata._settingsRedesign locale namespace');
	return root._hata._settingsRedesign;
}

function flatten(tree: TranslationTree, prefix = ''): Map<string, string> {
	const values = new Map<string, string>();
	for (const [key, value] of Object.entries(tree)) {
		const pathKey = prefix === '' ? key : `${prefix}.${key}`;
		if (typeof value === 'string') {
			values.set(pathKey, value);
			continue;
		}
		for (const [childKey, childValue] of flatten(value, pathKey)) values.set(childKey, childValue);
	}
	return values;
}

function placeholders(value: string): string[] {
	return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/gu)].map(match => match[1]).sort();
}

function assertSameLocaleShape(base: Map<string, string>, candidate: Map<string, string>): void {
	expect([...candidate.keys()].sort()).toEqual([...base.keys()].sort());
	for (const [key, value] of base) {
		expect(placeholders(candidate.get(key) ?? ''), key).toEqual(placeholders(value));
	}
}

async function loadLocale(locale: string): Promise<Map<string, string>> {
	const source = await fs.readFile(path.resolve(process.cwd(), `../../locales/${locale}.yml`), 'utf8');
	return flatten(settingsRedesignTree(loadYaml(source)));
}

describe('settings redesign translations', () => {
	test('ja/en/zh-CN have the same complete namespace and parameter contract', async () => {
		const [ja, en, zh] = await Promise.all(['ja-JP', 'en-US', 'zh-CN'].map(loadLocale));
		// 旗鯖fork: ui2.noChanges と、同名を避けるための nav.misskeyGeneral /
		//   nav.notificationBehavior /
		//   nav.appearanceDetails / nav.timelineOptions /
		//   nav.miscLabel / nav.miscDescription を足したので191から198へ。
		// ⚠️旧設定の帯に出す gateway.legacyNotice を足したので199へ。
		// ⚠️空のときの案内文5件(gateway.empty*)を足したので204へ。
		// ⚠️節を用途ごとに割り直した際の nav 11件（見た目とテーマ／プロフィール説明／
		//   アカウントとログイン／ミュートとブロック説明／ドライブ説明／
		//   データと引っ越し／外部サービス連携 とその説明）を足したので215へ。
		// ⚠️プレビューの下部ナビに専用の読み上げ文言を足したので216へ。
		// ⚠️旧設定から一覧へ戻る導線の文言を足したので217へ。
		// ⚠️無操作のときに出す検索の案内文を足したので218へ。
		// ⚠️「いまの値をすぐ変える」の節ごと mobile.changeCurrentValues を外したので217へ。
		// ⚠️検索欄の例文（search.placeholder「お困りでしょうか？」）を足したので219へ。
		// ⚠️削除済みのモバイル一覧だけが使っていた frequentlyUsedSettings / sessionAndLogin と
		//   mobile の6件を外したので211へ。mobile.featureDescription はカテゴリ面が使うので残す。
		expect(ja.size).toBe(211);
		assertSameLocaleShape(ja, en);
		assertSameLocaleShape(ja, zh);
		expect(ja.get('search.relatedHeading')).toBe('こちらをお探しですか？');
		expect(ja.get('nav.hataToolsDescription')).toBe('Hatask・Hatady');
		expect(ja.get('nav.hataFeedHataLyze')).toBe('HataFeed');
		expect(ja.get('nav.hataToolsDescription')).not.toContain('HATAlyze');
		expect(ja.get('nav.hataFeedHataLyze')).not.toContain('HATAlyze');
		expect(ja.get('legacySettings')).toBe('旧設定');
		expect(ja.get('search.searchTrigger')).toBeUndefined();
		expect(ja.get('searchTrigger')).toBe('お困りでしょうか？');
		expect(ja.get('ui2.recommendedInUse')).toBe('推奨・使用中');
		expect(ja.get('ui2.saveAndReload')).toBe('保存して再読み込み');
		expect(ja.get('ui2.basicItemCount')).toBe('{count}項目');
		expect(ja.get('ui2.reorderKeyboardHint')).toBe('上・下矢印キーで並べ替えできます');
		expect(ja.get('ui2.preview.title')).toBe('Hataskey UI プレビュー');
		expect(ja.get('mobile.featureDescription')).toBe('ナビ・透過率・吹き出し・デッキの表示をまとめて調整します');
		expect(ja.get('mobile.connectionsAndData')).toBeUndefined();
		expect(ja.get('nav.tabletTools')).toBe('独自ツール');
		expect(ja.get('actions.logoutAll')).toBe('すべての端末からログアウト');
		expect(ja.get('immediate.title')).toBe('すぐ反映される設定');
		expect(ja.get('catalog.categories.hataskeyUi')).toBe('Hataskey UI');
		expect(ja.get('immediate.uiSImmediate')).toBe('変更はすぐに保存・反映されます。');
		expect(ja.get('catalog.fallback.hiddenReactions.label')).toBe('非表示リアクション');
		expect(ja.get('catalog.fallback.hiddenReactions.description')).toBe('非表示にするリアクションの管理');
		for (const key of ['driveCleaner', 'themeInstall', 'themeManage', 'statusbar', 'pluginInstall', 'apps', 'webhookEdit', 'webhookNew', 'customCss', 'accountStats', 'externalAccount', 'hataCustom', 'hiddenReactions']) {
			expect(ja.get(`catalog.fallback.${key}.label`), key).toBeTruthy();
			expect(ja.get(`catalog.fallback.${key}.description`), key).toBeTruthy();
		}
		expect(ja.get('catalog.relation.sameNestedGroup')).toBe('同じ項目グループの設定');
		expect(ja.get('catalog.relation.sharedVisibleTerm')).toBe('表示内容が近い設定');
		expect(ja.get('catalog.noRelated.fallback')).toContain('個別の設定項目');
		expect(ja.get('catalog.system.activationUnavailable')).toContain('到達先');
		expect(ja.get('searchPrerequisite.dismiss')).toBe('閉じる');
		expect(ja.get('searchPrerequisite.consent')).toContain('検索から同意は変更していません');
		expect(ja.get('searchPrerequisite.preference')).toContain('検索から設定値は変更していません');
		expect(ja.get('searchPrerequisite.runtimeData')).toContain('対象を勝手に選ばず');
		expect(ja.get('searchPrerequisite.conditional')).toContain('検索から条件は変更していません');
		for (const kind of ['policy', 'consent', 'preference', 'runtimeData', 'conditional']) {
			expect(placeholders(ja.get(`searchPrerequisite.${kind}`) ?? '')).toEqual(['label']);
			expect(placeholders(en.get(`searchPrerequisite.${kind}`) ?? '')).toEqual(['label']);
			expect(placeholders(zh.get(`searchPrerequisite.${kind}`) ?? '')).toEqual(['label']);
		}
		expect(ja.get('searchPrerequisite.policy')).not.toContain('インデックス');
		expect(ja.get('searchPrerequisite.preference')).not.toContain('インデックス');

		// 陽性対照: key / placeholder detectorが壊れていれば、この意図的な
		// 不一致を検出できない。実localeの一致だけを信じない。
		const broken = new Map(en);
		broken.set('search.resultCount', 'Results');
		expect(() => assertSameLocaleShape(ja, broken)).toThrow();
	});

	test('shell/search/related/gateway/UI2 use the namespace instead of Japanese literals', () => {
		for (const source of [shellSource, gatewaySource, panelSource, relatedSource, ui2BodySource, immediateSource, previewSource]) {
			expect(source).toContain('i18n.ts._hata._settingsRedesign');
		}
		for (const source of [shellSource, bentoSource, bentoCatalogSource]) expect(source).toContain('i18n.ts._hata._settingsBento');
		expect(controlRelatedSource).not.toContain('もしかして、以下をお探しですか？');
		expect(relatedSource).toContain('copy.search.relatedHeading');
		expect(gatewaySource).toContain('copy.gateway.legacyRegion');
		expect(shellSource).toContain('copy.legacySettings');
		expect(ui2BodySource).toContain('copyx.ui2.unsavedChanges');
		expect(immediateSource).toContain('redesignCopy.immediate.deviceImmediate');
		expect(previewSource).toContain('copy.ui2.preview.liveNotice');
	});
});
