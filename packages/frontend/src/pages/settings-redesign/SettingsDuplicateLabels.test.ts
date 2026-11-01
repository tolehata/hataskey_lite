/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 左ペインと検索に出る行き先の表示名が重なっていないことを見張る。
 *
 * ⚠️同じ名前の行き先が複数あると、検索結果に同じ名前が何度も並び、
 *   「こちらをお探しですか」にも同じ名前が積み上がる。利用者からは
 *   「同じ設定項目が増殖している」ようにしか見えない。
 *   ⚠️行き先は共有ルート /settings/preferences を使うものが多く、
 *   名前が唯一の手がかりになるため、名前の重複は実害になる。
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
import { settingsDestinationSections, settingsDestinations } from './settings-destinations.js';

function duplicateLabels(): Array<[string, string[]]> {
	const byLabel = new Map<string, string[]>();
	for (const item of settingsDestinations) {
		const ids = byLabel.get(item.label) ?? [];
		ids.push(item.id);
		byLabel.set(item.label, ids);
	}
	return [...byLabel.entries()].filter(([, ids]) => ids.length > 1);
}

describe('settings destination labels', () => {
	test('行き先の表示名が重複しない', () => {
		expect(duplicateLabels()).toEqual([]);
	});

	test('分類の見出しと、その中の項目名が同じにならない', () => {
		// ⚠️「タイムラインと投稿」の中に「タイムラインと投稿」があると、
		//   検索結果で親子の区別がつかない。
		// ⚠️ただし、その節の代表がただ1つだけの場合(Hataskey UI など)は
		//   見出しと同名で構わない。区別すべき兄弟がいないため。
		const collisions = settingsDestinationSections
			.filter(section => section.items.length > 1)
			.flatMap(section => section.items
				.filter(item => item.label === section.label && item.primary !== true)
				.map(item => `${section.id}/${item.id}`));
		expect(collisions).toEqual([]);
	});

	test('表示名が空でない', () => {
		expect(settingsDestinations.filter(item => item.label.trim() === '')).toEqual([]);
	});
});
