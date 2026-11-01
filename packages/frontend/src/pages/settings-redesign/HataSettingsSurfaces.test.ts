/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ leaves: { value: false, __v_isRef: true } }));

vi.mock('@/components/MkSwitch.vue', () => ({ default: defineComponent({
	emits: ['update:modelValue'],
	template: '<button type="button" data-leaves-switch @click="$emit(\'update:modelValue\', true)"><slot name="label"/><slot name="caption"/></button>',
}) }));
vi.mock('@/preferences.js', () => ({ prefer: { model: (key: string) => { if (key !== 'hatafeed.leaves') throw new Error(`unexpected preference: ${key}`); return fixture.leaves; } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: {
	_customSettings: {
		_visual: { hatafeedLeaves: '若葉を舞わせる', hatafeedLeavesCaption: '背景に表示します' },
	},
} } } }));

vi.mock('@/components/HataFeedDisplaySettings.vue', () => ({ default: defineComponent({ props: { embedded: Boolean }, template: '<section data-hatafeed-display :data-embedded="embedded" />' }) }));

import HataFeedSettingsSurface from './HataFeedSettingsSurface.vue';

const mounted: Array<{ app: ReturnType<typeof createApp>; container: HTMLDivElement }> = [];

afterEach(() => {
	for (const item of mounted.splice(0)) { item.app.unmount(); item.container.remove(); }
	fixture.leaves.value = false;
});

function mount(component: unknown) {
	const app = createApp(defineComponent({ setup: () => () => h(component as any, { motionEnabled: false }) }));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return container;
}

describe('独立Hataskey設定面', () => {
	test('HataFeed面は新しい表示設定を埋め込みモードで開く', () => {
		const container = mount(HataFeedSettingsSurface);
		expect(container.querySelector('[data-hatafeed-display]')?.getAttribute('data-embedded')).toBe('true');
	});
});
