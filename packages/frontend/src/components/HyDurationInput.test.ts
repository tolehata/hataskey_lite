/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HyDurationInput from './HyDurationInput.vue';

vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

function mountDuration(initial: number | null, maximum = 128849018820) {
	const value = ref(initial), maxSeconds = ref(maximum), updates = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h('form', [h(HyDurationInput, {
		modelValue: value.value,
		maxSeconds: maxSeconds.value,
		label: '鑑賞時間',
		'onUpdate:modelValue': (next: number | null) => { updates(next); value.value = next; },
	})]) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return { target, value, maxSeconds, updates, form: target.querySelector('form')!, inputs: () => Array.from(target.querySelectorAll('input')) };
}

async function settle() { await nextTick(); await nextTick(); }

async function type(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
}

function button(target: HTMLElement, text: string) {
	const found = Array.from(target.querySelectorAll('button')).find(item => item.textContent === text || item.getAttribute('aria-label') === text);
	expect(found, `button ${text}`).toBeTruthy();
	return found!;
}

async function click(target: HTMLElement, text: string) { button(target, text).click(); await settle(); }

describe('duration entry and native form validity', () => {
	test('an overflowing total blocks submission and preserves every field until another field repairs it', async () => {
		const { target, value, updates, form, inputs } = mountDuration(3600, 3600);
		await click(target, '時・分・秒');
		const [hours, minutes, seconds] = inputs();
		await type(minutes, '1');
		expect(form.checkValidity()).toBe(false);
		expect(hours.validity.customError).toBe(true);
		expect(value.value).toBe(3600);
		expect(updates).not.toHaveBeenCalled();
		await type(seconds, '5');
		expect(inputs().map(input => input.value)).toEqual(['1', '1', '5']);
		expect(form.checkValidity()).toBe(false);
		// Changing display modes must not conceal an invalid draft from the form.
		await click(target, '分で入力');
		expect(inputs()).toEqual([hours, minutes, seconds]);
		expect(form.checkValidity()).toBe(false);
		await type(hours, '0');
		expect(inputs().map(input => input.value)).toEqual(['0', '1', '5']);
		expect(form.checkValidity()).toBe(true);
		expect(hours.validity.customError).toBe(false);
		expect(updates).toHaveBeenLastCalledWith(65);
		expect(value.value).toBe(65);
	});

	test('decimal minutes keep the focused input and entered text while emitting integer seconds', async () => {
		const { target, value, inputs, form } = mountDuration(null);
		const input = inputs()[0];
		input.focus();
		await type(input, '1.5');
		expect(value.value).toBe(90);
		expect(inputs()).toEqual([input]);
		expect(window.document.activeElement).toBe(input);
		expect(input.value).toBe('1.5');
		await type(input, '1.50');
		expect(input.value).toBe('1.50');
		expect(window.document.activeElement).toBe(input);
		expect(form.checkValidity()).toBe(true);
		await click(target, '時・分・秒');
		expect(inputs().map(part => part.value)).toEqual(['0', '1', '30']);
		expect(value.value).toBe(90);
	});

	test('native range errors remain visible when another part changes, then retain its corrected total', async () => {
		const { target, inputs, value, updates, form } = mountDuration(null, 7200);
		await click(target, '時・分・秒');
		const [hours, minutes] = inputs();
		await type(minutes, '61');
		expect(minutes.validity.rangeOverflow).toBe(true);
		await type(hours, '1');
		expect(inputs().map(input => input.value)).toEqual(['1', '61', '']);
		expect(form.checkValidity()).toBe(false);
		expect(updates).not.toHaveBeenCalled();
		await type(minutes, '59');
		expect(value.value).toBe(7140);
		expect(inputs().map(input => input.value)).toEqual(['1', '59', '']);
		expect(form.checkValidity()).toBe(true);
	});

	test('empty and explicit zero remain distinct in both entry modes', async () => {
		const { target, inputs, value, form } = mountDuration(null);
		expect(inputs()[0].value).toBe('');
		await type(inputs()[0], '0');
		expect(value.value).toBe(0);
		await type(inputs()[0], '');
		expect(value.value).toBeNull();
		await click(target, '時・分・秒');
		expect(inputs().map(input => input.value)).toEqual(['', '', '']);
		await type(inputs()[1], '0');
		expect(value.value).toBe(0);
		await type(inputs()[1], '');
		expect(value.value).toBeNull();
		expect(form.checkValidity()).toBe(true);
	});

	test('clearing an invalid draft also clears validity when its model was already null', async () => {
		const { target, inputs, value, form } = mountDuration(null, 3600);
		await click(target, '時・分・秒');
		await type(inputs()[1], '-1');
		expect(form.checkValidity()).toBe(false);
		expect(value.value).toBeNull();
		await click(target, '時間を未入力に戻す');
		expect(inputs().map(input => input.value)).toEqual(['', '', '']);
		expect(value.value).toBeNull();
		expect(form.checkValidity()).toBe(true);
	});

	test('presets respect the maximum and explicitly replace an invalid draft', async () => {
		const { target, inputs, value, form } = mountDuration(null, 300);
		expect(button(target, '15分').disabled).toBe(true);
		await click(target, '15分');
		expect(value.value).toBeNull();
		await type(inputs()[0], '6');
		expect(form.checkValidity()).toBe(false);
		await click(target, '5分');
		expect(value.value).toBe(300);
		expect(inputs()[0].value).toBe('5');
		expect(form.checkValidity()).toBe(true);
	});

	test('restored values update the current mode without removing its focused input', async () => {
		const { inputs, value, form } = mountDuration(null);
		const input = inputs()[0];
		input.focus();
		value.value = 7;
		await settle();
		expect(inputs()).toEqual([input]);
		expect(window.document.activeElement).toBe(input);
		expect(Number(input.value)).toBeCloseTo(7 / 60);
		expect(form.checkValidity()).toBe(true);
	});

	test('changed limits validate the aggregate without changing the draft or stored value', async () => {
		const { target, inputs, value, maxSeconds, form } = mountDuration(3660, 7200);
		await click(target, '時・分・秒');
		maxSeconds.value = 3600;
		await settle();
		expect(inputs().map(input => input.value)).toEqual(['1', '1', '0']);
		expect(inputs()[0].validity.customError).toBe(true);
		expect(form.checkValidity()).toBe(false);
		expect(value.value).toBe(3660);
		maxSeconds.value = 7200;
		await settle();
		expect(form.checkValidity()).toBe(true);
		expect(value.value).toBe(3660);
	});

	test('second precision survives switching modes, including the legacy maximum duration', async () => {
		const { target, inputs, value, updates, form } = mountDuration(61);
		expect(inputs().map(input => input.value)).toEqual(['0', '1', '1']);
		await click(target, '分で入力');
		await click(target, '時・分・秒');
		expect(inputs().map(input => input.value)).toEqual(['0', '1', '1']);
		expect(updates).not.toHaveBeenCalled();
		value.value = 128849018820;
		await settle();
		expect(inputs().map(input => input.value)).toEqual(['35791394', '7', '0']);
		expect(form.checkValidity()).toBe(true);
		await click(target, '分で入力');
		expect(inputs()[0].value).toBe('2147483647');
		expect(value.value).toBe(128849018820);
	});
});
