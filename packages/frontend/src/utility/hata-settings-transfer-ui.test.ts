/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, test } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const japanese = load(source('../../locales/ja-JP.yml')) as {
	_hata: {
		_customSettings: { _general: Record<string, string> };
		_settingsTransfer: { _window: Record<string, string>; _utility: { categories: Record<string, string> } };
	};
};
const transferCopy = japanese._hata._settingsTransfer._window;

describe('旗鯖独自設定の入出力UI', () => {
	test('Hataskey全体タブから入出力モーダルを開ける', () => {
		const page = source('src/pages/settings/hata-custom.vue');
		expect(page).toContain('const copy = i18n.ts._hata._customSettings;');
		expect(page).toContain('const generalCopy = copy._general;');
		expect(page).toContain('{{ generalCopy.transferTitle }}');
		expect(japanese._hata._customSettings._general.transferTitle).toBe('Hataskey独自設定の一括入出力');
		expect(page).toContain('import(\'@/components/MkHataSettingsTransfer.vue\')');
	});

	test('カテゴリ別チェックボックスと異版警告を備える', () => {
		const modal = source('src/components/MkHataSettingsTransfer.vue');
		const transfer = source('src/utility/hata-settings-transfer.ts');
		expect(modal).toContain('type="checkbox"');
		expect(modal).toContain('const copy = i18n.ts._hata._settingsTransfer._window;');
		expect(modal).toContain('title: copy.differentVersionTitle');
		expect(modal).toContain('{{ copy.importLead }}');
		expect(modal).toContain('{{ copy.privacyTitle }}');
		expect(modal).toContain('{{ copy.urlWarningDescription }}');
		expect(transferCopy.differentVersionTitle).toBe('異なるバージョンの設定ファイル');
		expect(transferCopy.importLead).toContain('合わない設定は個別にスキップ');
		expect(transferCopy.privacyTitle).toBe('アカウントのログイン情報や利用記録は設定ファイルに含みません');
		expect(transferCopy.urlWarningDescription).toContain('カスタムフォントURL');
		expect(transferCopy.urlWarningDescription).toContain('非公開RSSや署名付きURL');
		expect(transferCopy.urlWarningDescription).toContain('保存先と共有先を確認してから書き出してください');
		expect(transfer).toContain("id: 'hataSideStudio', label: copy.categories.hataSideStudioLabel");
		expect(japanese._hata._settingsTransfer._utility.categories.hataSideStudioLabel).toBe('HataSideStudio');
		expect(transfer).toContain('categories.hataSideStudio =');
	});

	test('操作後も上下を維持するリサイズ可能な専用ウィンドウを使う', () => {
		const modal = source('src/components/MkHataSettingsTransfer.vue');
		// ⚠️設定画面の右ペインへ埋め込めるよう、窓は差し替え式になった。
		//   窓として出す道が残っていることを、差し替え式のまま見張る。
		expect(modal).toContain('<component :is="embedded ? SettingsEmbeddedWindow : MkWindow"');
		expect(modal).toContain('ref="transferWindow"');
		expect(modal).toContain(':canResize="true"');
		expect(modal).toContain(':closeButton="true"');
		expect(modal).not.toContain('<MkModal');
		expect(modal).toContain('data-hata-settings-transfer-window');
		expect(modal).toContain('grid-template-rows: minmax(0, 1fr) auto;');
		expect(modal).toContain('.scrollArea {');
		expect(modal).toMatch(/\.scrollArea\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s);
		expect(modal).not.toMatch(/\.window\s*\{[^}]*contain:/s);
		expect(modal).not.toContain('.window::after {');
		expect(modal).toContain('<template #header>');
		expect(modal).toContain('<footer :class="$style.actionBar">');
		expect(modal).not.toContain('@media');
	});
});
