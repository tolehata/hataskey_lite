/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { describe, expect, test, vi } from 'vitest';

const haptic = vi.hoisted(() => vi.fn());
vi.mock('@/utility/haptic.js', () => ({ haptic }));
vi.mock('./settings-redesign/SettingsControlRelated.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ render: () => null }) };
});

import MkRadio from './MkRadio.vue';
import MkRadios from './MkRadios.vue';

describe('MkRadio native semantics', () => {
	test('a visible label click changes a native radio exactly once', async () => {
		const value = ref('first');
		const app = createApp(defineComponent({
			setup() {
				return () => h('div', [
					h(MkRadio<string>, { modelValue: value.value, value: 'first', 'onUpdate:modelValue': next => value.value = next }, () => 'First'),
					h(MkRadio<string>, { modelValue: value.value, value: 'second', 'onUpdate:modelValue': next => value.value = next }, () => 'Second'),
				]);
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.directive('adaptive-border', {});
		app.mount(container);

		const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		expect(radios).toHaveLength(2);
		expect(radios[0].checked).toBe(true);
		await nextTick();
		expect(radios[0].name).toMatch(/^mk-radio-standalone-/u);
		expect(radios[1].name).toBe(radios[0].name);
		(container.querySelectorAll('label')[1] as HTMLLabelElement).click();
		await nextTick();
		expect(value.value).toBe('second');
		expect(radios[1].checked).toBe(true);
		expect(haptic).toHaveBeenCalledTimes(1);

		app.unmount();
		container.remove();
	});

	test('MkRadios keeps a named native radio group and arrow navigation', async () => {
		const value = ref('one');
		const app = createApp(defineComponent({
			setup() {
				return () => h(MkRadios, { modelValue: value.value, 'onUpdate:modelValue': next => value.value = next }, {
					default: () => [
						h(MkRadio<string>, { modelValue: value.value, value: 'one' }, () => 'One'),
						h(MkRadio<string>, { modelValue: value.value, value: 'two' }, () => 'Two'),
					],
				});
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.directive('adaptive-border', {});
		app.mount(container);
		const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		expect(radios).toHaveLength(2);
		expect(radios[0].name).not.toBe('');
		expect(radios[0].name).toBe(radios[1].name);
		radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await nextTick();
		expect(value.value).toBe('two');
		expect(window.document.activeElement).toBe(radios[1]);

		app.unmount();
		container.remove();
	});
});
