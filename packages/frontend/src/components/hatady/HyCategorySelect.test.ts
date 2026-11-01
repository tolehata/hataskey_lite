/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HyCategorySelect from './HyCategorySelect.vue';

vi.mock('@/os.js', () => ({ claimZIndex: () => 100 }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { close: '閉じる', _hata: { _hatady: { _controls: { back: '戻る' } } } } } }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false, useBlurEffectForModal: false } } }));
vi.mock('@/utility/touch.js', () => ({ isTouchUsing: false }));
vi.mock('@/utility/device-kind.js', () => ({ deviceKind: 'desktop' }));
vi.mock('@/utility/viewport-inset.js', () => ({ getViewportTopInset: () => 0 }));
vi.mock('@/utility/hatady-prefs.js', async () => ({ hatadyTheme: (await import('vue')).ref('paper') }));

const options = [
	{ value: 'all', label: 'すべて', icon: 'ti ti-layout-grid' },
	{ value: 'study', label: '勉強・読書', icon: 'ti ti-book' },
	{ value: 'movie', label: '映画', icon: 'ti ti-movie' },
	{ value: 'game', label: 'ゲーム', icon: 'ti ti-device-gamepad' },
	{ value: 'exercise', label: '運動', icon: 'ti ti-run' },
	{ value: 'work', label: '作業', icon: 'ti ti-briefcase' },
];
const cleanups: Array<() => void> = [];

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
});
afterEach(async () => {
	cleanups.splice(0).reverse().forEach(cleanup => cleanup());
	await nextTick();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function settle() {
	await nextTick();
	await nextTick();
	await vi.runAllTimersAsync();
	await nextTick();
}

async function mountPicker(initial = 'study', values = options, card = false) {
	const host = window.document.createElement('main');
	window.document.body.append(host);
	const selected = ref(initial);
	const update = vi.fn((value: string) => { selected.value = value; });
	const app = createApp({ render: () => h(HyCategorySelect, { modelValue: selected.value, options: values, label: '活動の種類', card, 'onUpdate:modelValue': update }) });
	app.directive('hotkey', {});
	app.mount(host);
	let mounted = true;
	const unmount = () => { if (mounted) app.unmount(); mounted = false; };
	cleanups.push(() => { unmount(); host.remove(); });
	await settle();
	return { host, selected, update, unmount, trigger: host.querySelector<HTMLButtonElement>('button')! };
}

function choices() {
	return Array.from(window.document.querySelectorAll<HTMLButtonElement>('[role="listbox"] [role="option"]'));
}

async function press(element: HTMLElement, key: string) {
	element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await settle();
}

describe('Hatady category dropdown', () => {
	test('uses the entire labeled card as the embedded category trigger', async () => {
		const view = await mountPicker('study', options, true);
		expect(view.trigger.textContent).toContain('活動の種類');
		expect(view.trigger.querySelector('small')?.textContent).toBe('勉強・読書');
		(view.trigger.querySelector('span span') as HTMLElement).click();
		await settle();
		expect(choices()).toHaveLength(options.length);
	});
	test('opens the existing floating Hatady dialog beside its trigger with all labeled choices', async () => {
		const view = await mountPicker();
		expect(view.trigger.textContent).toBe('勉強・読書');
		expect(view.trigger.querySelector('.ti-book')).not.toBeNull();
		expect(view.trigger.getAttribute('aria-expanded')).toBe('false');
		expect(choices()).toHaveLength(0);
		view.trigger.click();
		await settle();
		const panel = window.document.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(panel.dataset.floating).toBe('true');
		expect(panel.dataset.hatadyTheme).toBe('paper');
		expect(view.host.contains(panel)).toBe(false);
		expect(view.trigger.getAttribute('aria-controls')).toBe(window.document.querySelector('[role="listbox"]')?.id);
		expect(choices().map(button => button.textContent)).toEqual(options.map(option => option.label));
		expect(choices().filter(button => button.getAttribute('aria-selected') === 'true')).toEqual([choices()[1]]);
		expect(window.document.activeElement).toBe(choices()[1]);
		choices()[2].click();
		await settle();
		expect(view.update).toHaveBeenCalledExactlyOnceWith('movie');
		expect(view.trigger.textContent).toBe('映画');
		expect(window.document.querySelector('[role="dialog"]')).toBeNull();
		expect(window.document.activeElement).toBe(view.trigger);
	});

	test('moves focus without committing and Escape restores the trigger without changing selection', async () => {
		const view = await mountPicker();
		await press(view.trigger, 'ArrowDown');
		await press(choices()[1], 'End');
		expect(window.document.activeElement).toBe(choices()[5]);
		await press(choices()[5], 'ArrowDown');
		expect(window.document.activeElement).toBe(choices()[0]);
		await press(choices()[0], 'ArrowUp');
		expect(window.document.activeElement).toBe(choices()[5]);
		await press(choices()[5], 'Home');
		expect(window.document.activeElement).toBe(choices()[0]);
		expect(view.update).not.toHaveBeenCalled();
		await press(choices()[0], 'Escape');
		expect(choices()).toHaveLength(0);
		expect(view.selected.value).toBe('study');
		expect(window.document.activeElement).toBe(view.trigger);
		await press(view.trigger, 'ArrowDown');
		await press(choices()[1], 'ArrowDown');
		await press(choices()[2], 'Enter');
		expect(view.update).toHaveBeenCalledExactlyOnceWith('movie');
	});

	test('backdrop cancellation and unmount release the existing modal focus and anchor ownership', async () => {
		const view = await mountPicker();
		view.trigger.click();
		await settle();
		expect(view.host.inert).toBe(true);
		window.document.querySelector<HTMLElement>('[data-cy-bg]')!.click();
		await settle();
		expect(view.host.inert).toBe(false);
		expect(view.trigger.style.pointerEvents).toBe('auto');
		expect(view.update).not.toHaveBeenCalled();
		view.trigger.click();
		await settle();
		view.unmount();
		await settle();
		expect(window.document.querySelector('[role="dialog"]')).toBeNull();
		expect(view.host.inert).toBe(false);
	});

	test('retains an unknown saved value until a choice is made and cannot open an empty picker', async () => {
		const view = await mountPicker('saved');
		expect(view.trigger.textContent).toBe('活動の種類');
		expect(view.update).not.toHaveBeenCalled();
		view.trigger.click();
		await settle();
		expect(window.document.activeElement).toBe(choices()[0]);
		expect(choices().every(button => button.getAttribute('aria-selected') === 'false')).toBe(true);
		await press(choices()[0], ' ');
		expect(view.update).toHaveBeenCalledExactlyOnceWith('all');
		const empty = await mountPicker('saved', []);
		expect(empty.trigger.disabled).toBe(true);
		empty.trigger.click();
		await settle();
		expect(choices()).toHaveLength(0);
		expect(empty.update).not.toHaveBeenCalled();
	});
});
