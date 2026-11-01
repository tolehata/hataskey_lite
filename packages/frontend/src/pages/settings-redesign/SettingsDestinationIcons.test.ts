/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 設定の行き先が指すアイコンが、実際に Tabler に存在することを見張る。
 *
 * ⚠️存在しないクラス名を書いても、どこもエラーにならない。擬似要素の content が
 *   出ないだけで、⚠️**タブや一覧のアイコンが黙って空白になる**。
 *   実際に `ti-broom` がこれで空白になっていた（ドライブの整理）。
 * ⚠️見た目の検査では捕まえられないので、名前の実在で捕まえる。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
// ⚠️行き先の一覧は翻訳を読む。初期化しないと Proxy の生成で落ち、
//   検査が1件も動かない（実測: Cannot create proxy...）。
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});
import { settingsDestinationSections } from './settings-destinations.js';

/** Tabler webfont の CSS から、定義済みのクラス名を読み出す。 */
function tablerIconNames(): Set<string> {
	const root = resolve(process.cwd(), '../../node_modules/.pnpm');
	const pkg = readdirSync(root).find(name => name.startsWith('@tabler+icons-webfont@'));
	if (pkg == null) throw new Error('tabler icons webfont package not found');
	const css = readFileSync(resolve(root, pkg, 'node_modules/@tabler/icons-webfont/dist/tabler-icons.css'), 'utf8');
	return new Set([...css.matchAll(/\.(ti-[a-z0-9-]+):{1,2}before/gu)].map(match => match[1]));
}

/** `ti ti-foo` から `ti-foo` を取り出す。 */
function iconClass(icon: string): string | null {
	const match = /(?:^|\s)(ti-[a-z0-9-]+)(?:\s|$)/u.exec(icon);
	return match == null ? null : match[1];
}

describe('settings destination icons', () => {
	const names = tablerIconNames();
	// Third-party brand marks that are not in Tabler. Each must be defined by its own stylesheet.
	const brandIcons = new Map([['concrnt-icon', 'src/components/concrnt/concrnt-icon.css']]);

	test('検出器が生きている', () => {
		// ⚠️陽性対照。実在する名前は通り、実在しない名前は落ちること。
		expect(names.size).toBeGreaterThan(1000);
		expect(names.has('ti-cloud')).toBe(true);
		expect(names.has('ti-settings')).toBe(true);
		// ⚠️これが「在る」ことになったら、この検査は何も見張っていない。
		expect(names.has('ti-zz-no-such-icon')).toBe(false);
		expect(names.has('ti-broom')).toBe(false);
		expect(iconClass('ti ti-cloud')).toBe('ti-cloud');
		expect(iconClass('nothing')).toBe(null);
	});

	test('節と項目のアイコンはすべて Tabler に存在する', () => {
		const missing: string[] = [];
		for (const section of settingsDestinationSections) {
			for (const [label, icon] of [[section.label, section.icon] as const, ...section.items.map(item => [item.label, item.icon] as const)]) {
				const name = iconClass(icon);
				const brandCss = brandIcons.get(icon.trim());
				if (brandCss != null) {
					if (!readFileSync(resolve(process.cwd(), brandCss), 'utf8').includes(`.${icon.trim()}`)) missing.push(`${label}: ${icon} (${brandCss} に定義が無い)`);
					continue;
				}
				if (name == null) {
					missing.push(`${label}: ${icon} (ti-* が読み取れない)`);
					continue;
				}
				if (!names.has(name)) missing.push(`${label}: ${name}`);
			}
		}
		expect(missing).toEqual([]);
	});
});
