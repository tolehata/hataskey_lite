// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import hataSabaSource from '../../components/HatasabaUi2SettingsBody.vue?raw';
import hataskSource from '../HataskSettings.vue?raw';
import hatadySource from '../../components/HatadyDisplaySettings.vue?raw';
import previewSource from '../../components/MkHatasabaUi2PreviewWindow.vue?raw';
import hataFeedSource from './HataFeedSettingsSurface.vue?raw';
import indexSource from './index.vue?raw';

const brandSource = readFileSync(resolve(process.cwd(), 'src/pages/settings-redesign/settings-redesign-brand.scss'), 'utf8');

describe('settings brand coverage', () => {
	test('uses the text-safe Righteous treatment', () => {
		const block = brandSource.match(/(?:^|\r?\n)\s*\.settingsBrandText\s*\{([\s\S]*?)\r?\n\s*\}/u)?.[1];
		expect(block).toBeDefined();
		expect(block).toContain('font-family: \'HataSettingsRighteous\', \'Righteous\'');
		expect(block).not.toContain('white-space');
	});

	test('covers settings surfaces and headings', () => {
		// ⚠️実装は CSS Modules と併用するため :class 配列で付けている。素のclass属性ではない。
		// 旗鯖fork: 右上の「Hataskey UI／デッキ」表示は削除した。
		//   ⚠️ブランド表記の検査は、残っている箇所で担保する。
		expect(indexSource).toContain("@use './settings-redesign-brand.scss'");
		expect(hataFeedSource).toContain('<HataFeedDisplaySettings embedded/>');
		expect(hataSabaSource).toContain('settingsBrand');
		expect(hataskSource).toContain('<span class="settingsBrandText">{{ copy.title }}</span>');
		// Hatady の表示設定は独自のブランド書体と共通ダイアログへ移行した。
		expect(hatadySource).toContain(':title="copy.title"');
		expect(hatadySource).toContain('<h2 v-if="embedded" :class="$style.embeddedTitle">{{ copy.title }}</h2>');
		expect(hatadySource).toContain("font-family: 'Hatady Brand', sans-serif;");
		expect(previewSource).toContain('<span v-if="previewTitle.brand" class="settingsBrand">{{ previewTitle.brand }}</span>');
		// 旗鯖fork: ⚠️モックの中には文言を置かない（訳の無い言語で空欄になるため）。
		//   ブランド表記は窓の見出しが受け持つ。
	});
});
