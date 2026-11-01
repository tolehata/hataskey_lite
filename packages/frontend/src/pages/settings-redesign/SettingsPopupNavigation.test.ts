/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: ポップアップを開くだけの項目が、右ペインまで遷移させないことを見張る。
 *
 * ⚠️MkA は自前で `@click.prevent="nav"` を持ち、nav() が router.pushByPath(to) を
 *   必ず走らせる。親側に `@click.prevent` を書いても、それはリンクの既定動作を
 *   止めるだけで MkA 自身の処理は止まらない。両方が同じ要素に乗るため、
 *   ポップアップ項目を MkA で描くと「ポップアップが開くのに右ペインが
 *   /settings/hata-custom (Hataskey UI 設定) へ飛ぶ」ことになる。
 *   これは実際に起きた不具合なので、描き方が MkA へ戻ったら落とす。
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
import shellSource from './index.vue?raw';
import categorySource from './SettingsCategorySurface.vue?raw';
import bentoSource from './SettingsBentoNavigation.vue?raw';
import { settingsDestinations } from './settings-destinations.js';
import mkaSource from '@/components/global/MkA.vue?raw';

describe('settings redesign popup navigation', () => {
	test('MkAは自前でrouter遷移する（この前提が崩れたら本テストの理由が消える）', () => {
		// ⚠️陽性対照。MkA が遷移しなくなったなら、この見張り自体を見直すこと。
		expect(mkaSource).toContain('router.pushByPath(props.to');
		expect(mkaSource).toContain('@click.prevent="nav"');
	});

	test('詳細の設定入口はbuttonからshellへ渡し、MkAの自動遷移を起こさない', () => {
		const launcher = categorySource.match(/<button v-for="destination in section.destinations"[^>]*>/u)?.[0];
		expect(launcher).toBeDefined();
		expect(launcher).toContain('type="button"');
		expect(launcher).toContain("emit('openDestination', destination.id, $event)");
		expect(launcher).toContain(':data-settings-destination-id="destination.id"');
		expect(launcher).not.toContain(':to=');
		expect(shellSource).toContain('@openDestination="openBentoDestination"');
		expect(shellSource).toContain('const accepted = await goToSetting(destination);');
	});

	test('カテゴリカードはrouteを直接開かず、guardを持つshellへ選択を伝える', () => {
		expect(bentoSource).toContain('@click="select(category.id)"');
		expect(bentoSource).toContain("if (id !== props.activeCategoryId) emit('select', id);");
		expect(shellSource).toContain('@select="selectBentoCategory"');
		expect(shellSource).toContain('if (category == null || !await requestSurfaceDiscard()) return;');
		expect(bentoSource).not.toContain('<MkA');
	});

	test('MkA誤用の検出器はpopup行を識別する', () => {
		const offenders = (source: string) => source.match(/<MkA\b[^>]*:to="(?:item|destination)\.route"/gu) ?? [];
		expect(offenders('<MkA v-for="destination in destinations" :to="destination.route"/>')).toHaveLength(1);
		expect(offenders(categorySource)).toEqual([]);
		expect(offenders(bentoSource)).toEqual([]);
	});

	test('ポップアップで開く行き先が実際に存在する', () => {
		expect(settingsDestinations.some(item => item.id === 'hata-ui-setup')).toBe(false);
		const popups = settingsDestinations.filter(item => item.activation?.kind === 'popup');
		// 現状: Hatask / Hatady / 天気・地震 / マスコット / 設定の引っ越し
		expect(popups.length).toBeGreaterThanOrEqual(5);
		// ⚠️ポップアップ項目の route は共有の /settings/hata-custom なので、
		//   route だけで遷移先を決めてはいけない。
		expect(popups.every(item => item.route === '/settings/hata-custom')).toBe(true);
	});
});
