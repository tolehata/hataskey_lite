/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';

const fixture = vi.hoisted(() => {
	// `vi.hoisted` runs before ESM imports. Vue only needs the ref marker for
	// the component's v-model compiler output in this focused persistence test.
	const branding = { value: false, __v_isRef: true };
	const foldable = { value: 'auto' as 'auto' | 'on' | 'off', __v_isRef: true };
	const setFoldable = vi.fn((value: 'auto' | 'on' | 'off') => { foldable.value = value; });
	return { branding, foldable, setFoldable };
});

vi.mock('@/components/MkRadios.vue', () => ({ default: defineComponent({ emits: ['update:modelValue'], template: '<button type="button" data-foldable-choice @click="$emit(\'update:modelValue\', \'on\')">常に使う</button>' }) }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: defineComponent({ emits: ['update:modelValue'], template: '<button type="button" data-branding-switch @click="$emit(\'update:modelValue\', true)"><slot name="label"/></button>' }) }));
vi.mock('@/i.js', () => ({ ensureSignin: () => ({ id: 'account-1' }) }));
vi.mock('@/preferences.js', () => ({ prefer: { model: () => fixture.branding } }));
vi.mock('@/utility/hatasaba-device-prefs.js', () => ({ foldableLayoutMode: fixture.foldable, setFoldableLayoutMode: fixture.setFoldable }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: {
	_customSettings: { _ui: {
		foldableSection: '折りたたみ端末向けレイアウト', foldableDescription: '', foldableModeAuto: '自動', foldableModeOn: '常に使う', foldableModeOff: '使わない', foldableAutoCaption: '', foldableDeviceOnly: '',
		brandingSection: 'オリジナルアイコンブランディング', useHatakyu: 'Hataskeyオリジナルのアイコンを使う', useHatakyuDescription: '',
	} },
	_settingsRedesign: { immediate: {
		eyebrow: '関連する既存設定', title: 'すぐ反映される設定', description: '下の項目は上の保存バーと連動しません。選ぶとすぐに保存・反映されます',
		deviceImmediate: 'この端末のみ・すぐ反映', profileImmediate: 'プロフィール同期・すぐ反映',
	} },
} } } }));

import HatasabaUi2ImmediateSettings from './HatasabaUi2ImmediateSettings.vue';

describe('HatasabaUi2ImmediateSettings', () => {
	test('compiles as a permanent-only companion and keeps local/profile writes immediate', async () => {
		const app = createApp(defineComponent({ setup: () => () => h(HatasabaUi2ImmediateSettings, { motionEnabled: false }) }));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);

		expect(container.textContent).not.toContain('関連する既存設定');
		expect(container.querySelector('.settingsBrand')?.textContent).toBe('Hataskey UI');
		expect(container.textContent).toContain('この端末のみ・すぐ反映');
		expect(container.textContent).toContain('プロフィール同期・すぐ反映');
		(container.querySelector('[data-foldable-choice]') as HTMLButtonElement).click();
		await nextTick();
		expect(fixture.setFoldable).toHaveBeenCalledWith('on');
		expect(fixture.foldable.value).toBe('on');
		(container.querySelector('[data-branding-switch]') as HTMLButtonElement).click();
		await nextTick();
		expect(fixture.branding.value).toBe(true);

		app.unmount();
		container.remove();
	});
});
