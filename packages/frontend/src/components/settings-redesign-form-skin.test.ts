/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import settingsPreferencesSource from '../pages/settings-redesign/SettingsPreferencesSurface.vue?raw';
import formLinkSource from './form/link.vue?raw';
import mkButtonSource from './MkButton.vue?raw';
import mkCodeEditorSource from './MkCodeEditor.vue?raw';
import mkColorInputSource from './MkColorInput.vue?raw';
import mkInputSource from './MkInput.vue?raw';
import mkRadioSource from './MkRadio.vue?raw';
import mkRadiosSource from './MkRadios.vue?raw';
import mkRangeSource from './MkRange.vue?raw';
import mkSelectSource from './MkSelect.vue?raw';
import mkSwitchSource from './MkSwitch.vue?raw';
import mkTextareaSource from './MkTextarea.vue?raw';

const skinSources = [
	mkSwitchSource,
	mkInputSource,
	mkSelectSource,
	mkRangeSource,
	mkRadioSource,
	mkRadiosSource,
	mkTextareaSource,
	mkColorInputSource,
	mkCodeEditorSource,
];

describe('settings redesign form skin', () => {
	test('新設定シェルのcontextがある時だけ各フォームにスキンを付与する', () => {
		for (const source of skinSources) {
			expect(source).toContain("settingsSearchV2ContextKey");
			expect(source).toContain('isSettingsRedesign');
		}
		expect(mkSwitchSource).toContain('[$style.redesigned]: isSettingsRedesign');
		expect(mkInputSource).toContain('[$style.redesigned]: isSettingsRedesign');
		expect(mkSelectSource).toContain('[$style.redesigned]: isSettingsRedesign');
		expect(mkRangeSource).toContain('settingsRedesign: isSettingsRedesign');
	});

	test('既存の保存・更新イベントとフォーカス入力を削らない', () => {
		expect(mkSwitchSource).toContain("emit('update:modelValue', nextValue)");
		expect(mkSwitchSource).toContain("emit('change', nextValue)");
		expect(mkInputSource).toContain("emit('update:modelValue'");
		expect(mkTextareaSource).toContain("emit('update:modelValue'");
		expect(mkCodeEditorSource).toContain("emit('update:modelValue'");
		expect(mkSelectSource).toContain('tabindex="0"');
		expect(mkRadioSource).toContain('type="radio"');
		expect(mkRadioSource).toContain(':checked="checked"');
		expect(mkRadioSource).toContain('@change="onChange"');
		expect(mkRadiosSource).toContain("role: 'radiogroup'");
	});

	test('全操作フォームは検索ID属性をrootへ受け、render関数のMkRadiosも転送する', () => {
		for (const source of skinSources.filter(source => source !== mkRadiosSource)) {
			expect(source).not.toContain('inheritAttrs: false');
		}
		expect(mkRadiosSource).toContain('...context.attrs');
		expect(mkRadiosSource).toContain('context.attrs.class');
	});

	test('設定行とbuttonは黒枠を持たず、入力欄だけ強いtheme境界を保つ', () => {
		expect(settingsPreferencesSource).toContain('.heading, .toolbox { border: 1px solid');
		expect(settingsPreferencesSource).toContain('.control {\n\tmin-width: 0;\n\tborder: 0;');
		expect(settingsPreferencesSource).toContain('background: transparent;\n\tbox-shadow: none;');
		expect(settingsPreferencesSource).toContain('.actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center;');
		expect(mkSwitchSource).toContain('padding: 15px 18px;\n\tborder: 0;\n\tborder-radius: 22px;\n\tbackground: transparent;');
		expect(mkButtonSource).toContain('.root.redesigned {\n\tmin-height: 44px;\n\tpadding: 10px 18px;\n\tborder: 0;');
		expect(formLinkSource).toContain('.main.redesigned {\n\tmin-height: 44px;\n\tpadding: 10px 18px;\n\tbackground: var(--MI_THEME-panel);\n\tborder: 0;');
		expect(mkRadioSource).toContain('border-color: transparent;');

		const inputBorderFallback = 'var(--settings-input-border, color-mix(in srgb, var(--MI_THEME-fg) 30%, var(--MI_THEME-divider)))';
		for (const source of [
			mkInputSource,
			mkSelectSource,
			mkTextareaSource,
			mkColorInputSource,
		]) {
			expect(source).toContain(inputBorderFallback);
		}
	});

	test('ライト／ダーク等のradio群と補助actionを中央配置する', () => {
		expect(mkRadiosSource).toContain('> .body {\n\t\t\tgap: 8px;\n\t\t\tjustify-content: center;');
		expect(settingsPreferencesSource).toContain('justify-content: center;');
	});
});
