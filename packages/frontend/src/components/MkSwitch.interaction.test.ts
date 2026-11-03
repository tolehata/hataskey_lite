/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import hatasabaUi2BodySource from './HatasabaUi2SettingsBody.vue?raw';
import mkSwitchSource from './MkSwitch.vue?raw';
import mkSwitchButtonSource from './MkSwitch.button.vue?raw';

vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { itsOn: 'オン', itsOff: 'オフ', switch: '切り替え' } } }));
vi.mock('@/components/settings-redesign/SettingsControlRelated.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		default: defineComponent({
			inheritAttrs: false,
			props: { fullWidth: Boolean },
			setup(props, { attrs }) {
				return () => h('div', { ...attrs, 'data-related-host': '', 'data-full-width': String(props.fullWidth) });
			},
		}),
	};
});

import MkSwitch from './MkSwitch.vue';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

function mountSwitch(props: Record<string, unknown> = {}, redesigned = false) {
	const value = ref(false);
	const updates = vi.fn((next: boolean) => { value.value = next; });
	const app = createApp(defineComponent({
		setup() {
			return () => h(MkSwitch, {
				modelValue: value.value,
				'onUpdate:modelValue': updates,
				...props,
			}, {
				default: () => 'ナビゲーションを表示',
			});
		},
	}));
	app.directive('tooltip', {});
	if (redesigned) {
		app.provide(settingsSearchV2ContextKey, {
			catalog: ref(null),
			navigateToSetting: vi.fn(),
		});
	}
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, value, updates };
}

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('MkSwitch native-label interaction', () => {
	test('decorative visual track delegates one native click to its checkbox', async () => {
		const item = mountSwitch();
		await nextTick();
		const track = item.container.querySelector<HTMLElement>('[data-testid="switch-toggle"]');
		const checkbox = item.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		if (track == null || checkbox == null) throw new Error('switch controls were not rendered');

		track.click();
		await nextTick();
		expect(checkbox.checked).toBe(true);
		expect(item.value.value).toBe(true);
		expect(item.updates).toHaveBeenCalledTimes(1);
		expect(item.updates).toHaveBeenLastCalledWith(true);
	});

	test('explicit aria-label and aria-labelledby are applied to the native checkbox', async () => {
		const named = mountSwitch({ 'aria-label': '上部ナビゲーションのホームを表示' });
		await nextTick();
		const namedInput = named.container.querySelector<HTMLInputElement>('input');
		expect(namedInput?.getAttribute('aria-label')).toBe('上部ナビゲーションのホームを表示');
		expect(namedInput?.hasAttribute('aria-labelledby')).toBe(false);

		const labelled = mountSwitch({ 'aria-labelledby': 'external-nav-item-label' });
		await nextTick();
		const labelledInput = labelled.container.querySelector<HTMLInputElement>('input');
		expect(labelledInput?.getAttribute('aria-labelledby')).toBe('external-nav-item-label');
		expect(labelledInput?.hasAttribute('aria-label')).toBe(false);

		const compact = mountSwitch({ noBody: true });
		await nextTick();
		const compactInput = compact.container.querySelector<HTMLInputElement>('input');
		expect(compactInput?.getAttribute('aria-label')).toBe('切り替え');
		expect(compactInput?.hasAttribute('aria-describedby')).toBe(false);
	});

	test('Hataskey UI top and bottom navigation rows provide a real switch label', () => {
		expect(hatasabaUi2BodySource.match(/navVisibilityLabel\(item\)/gu)).toHaveLength(2);
		expect(hatasabaUi2BodySource).toContain('<template #label><span :class="$style.srOnly">{{ navVisibilityLabel(item) }}</span></template>');
		expect(hatasabaUi2BodySource.match(/<MkSwitch compact :modelValue="item\.visible !== false"/gu)).toHaveLength(2);
	});

	test('compact redesigned switches opt out of card density without removing their accessible label', () => {
		const source = hatasabaUi2BodySource;
		expect(source).toContain('<MkSwitch compact');
		expect(mkSwitchSource).toContain('[$style.compact]: compact');
		expect(mkSwitchSource).toContain('isSettingsRedesign && !compact');
		expect(mkSwitchSource).toContain('.redesigned.compact');
		expect(mkSwitchSource).toContain('clip-path: inset(50%)');
		expect(mkSwitchSource).toContain('--mk-switch-width: 52px');
		expect(mkSwitchSource).toContain('height: 30px');
		expect(mkSwitchSource).toContain('@container (max-width: 680px)');
		expect(mkSwitchSource).toContain('.redesigned:not(.compact) > .toggle');
		expect(mkSwitchButtonSource).toContain('--height: var(--mk-switch-height, 21px)');
		expect(mkSwitchButtonSource).toContain('width: var(--mk-switch-width, calc(var(--height) * 1.6))');
	});

	test('the permanent Hataskey UI basic group opts into flat rows without changing ordinary switch cards', () => {
		expect(hatasabaUi2BodySource.match(/:flat="mode === 'permanent'"/gu)).toHaveLength(4);
		expect(hatasabaUi2BodySource).toContain('data-settings-flat-row');
		expect(mkSwitchSource).toContain('[$style.flat]: flat');
		expect(mkSwitchSource).toContain('.redesigned.flat');
		expect(mkSwitchSource).toContain('min-height: 56px');
		// Flat rows own their surface, but still expose the item-level related host.
		expect(mkSwitchSource).toContain('v-if="isSettingsRedesign && !compact" fullWidth');
		expect(mkSwitchSource).not.toContain('isSettingsRedesign && !compact && !flat');

		const flat = mountSwitch({ flat: true, 'data-settings-search-id': 'settings.control.ui2-basic' }, true);
		expect(flat.container.querySelector('[data-settings-flat-row]')).not.toBeNull();
		const related = flat.container.querySelector<HTMLElement>('[data-related-host]');
		expect(related?.getAttribute('data-settings-search-id')).toBe('settings.control.ui2-basic');
		expect(related?.getAttribute('data-full-width')).toBe('true');
	});
});
