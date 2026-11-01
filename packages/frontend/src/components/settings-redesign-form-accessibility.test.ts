/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import mkInputSource from './MkInput.vue?raw';
import mkTextareaSource from './MkTextarea.vue?raw';
import mkCodeEditorSource from './MkCodeEditor.vue?raw';
import mkColorInputSource from './MkColorInput.vue?raw';
import mkRadioSource from './MkRadio.vue?raw';
import mkRangeSource from './MkRange.vue?raw';
import mkSelectSource from './MkSelect.vue?raw';
import mkSwitchSource from './MkSwitch.vue?raw';
import mkSwitchButtonSource from './MkSwitch.button.vue?raw';
import type { App, Component } from 'vue';

const popupMenu = vi.hoisted(() => vi.fn());
const popup = vi.hoisted(() => vi.fn((..._args: unknown[]) => ({ dispose: vi.fn() })));

vi.mock('@/os.js', () => ({
	popupMenu,
	popup,
}));

vi.mock('@/utility/haptic.js', () => ({
	haptic: vi.fn(),
}));
vi.mock('@/i18n.js', () => ({
	i18n: { ts: { preview: 'Preview', save: 'Save', switch: 'Switch' }, tsx: {} },
}));
vi.mock('@/components/settings-redesign/SettingsControlRelated.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ render: () => null }) };
});

vi.mock('@/components/MkSwitch.button.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		default: defineComponent({
			props: ['checked', 'disabled'],
			setup(props) {
				return () => h('span', {
					'aria-hidden': 'true',
					'data-testid': 'switch-toggle',
					'data-checked': String(props.checked),
				});
			},
		}),
	};
});

vi.mock('@/components/MkCode.core.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return {
		default: defineComponent({
			props: ['code'],
			setup(props) {
				return () => h('pre', { 'aria-hidden': 'true' }, props.code);
			},
		}),
	};
});

import MkInput from '@/components/MkInput.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkCodeEditor from '@/components/MkCodeEditor.vue';
import MkColorInput from '@/components/MkColorInput.vue';
import MkRange from '@/components/MkRange.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';

type Mounted = { app: App<Element>; container: HTMLDivElement };
const mounted: Mounted[] = [];

function mount(component: Component, props: Record<string, unknown>, slots: Record<string, () => unknown> = {}): Mounted {
	const app = createApp(defineComponent({
		setup() {
			return () => h(component, props, slots);
		},
	}));
	app.directive('adaptive-border', {});
	app.directive('tooltip', {});
	app.directive('panel', {});
	app.component('Mfm', defineComponent({ render: () => null }));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	const item = { app, container };
	mounted.push(item);
	return item;
}

function pointerEvent(type: string, clientX = 0, pointerId = 1): Event {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		button: { value: 0 },
		clientX: { value: clientX },
		pointerId: { value: pointerId },
		pointerType: { value: 'mouse' },
	});
	return event;
}

afterEach(() => {
	popupMenu.mockReset();
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
});

describe('settings redesign shared form accessibility', () => {
	test('Switchは可視ラベルと装飾つまみのどちらも一度だけ委譲し、helpは切り替えない', async () => {
		const value = ref(false);
		const update = vi.fn((next: boolean) => { value.value = next; });
		const item = mount(MkSwitch, {
			modelValue: value.value,
			'onUpdate:modelValue': update,
		}, {
			default: () => '通知を受け取る',
			caption: () => '重要な更新を知らせます',
		});
		await nextTick();

		const checkbox = item.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		const visual = item.container.querySelector<HTMLElement>('[data-testid="switch-toggle"]');
		if (checkbox == null || visual == null) throw new Error('スイッチの操作面を生成できませんでした');
		expect(item.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
		expect(visual.getAttribute('aria-hidden')).toBe('true');
		expect(window.document.getElementById(checkbox.getAttribute('aria-labelledby') ?? '')?.textContent).toContain('通知を受け取る');
		expect(window.document.getElementById(checkbox.getAttribute('aria-describedby') ?? '')?.textContent).toContain('重要な更新を知らせます');

		const visibleLabel = Array.from(item.container.querySelectorAll('label')).find(label => label.textContent?.includes('通知を受け取る'));
		if (visibleLabel == null) throw new Error('可視ラベルを生成できませんでした');
		const withHelp = mount(MkSwitch, {
			modelValue: false,
			helpText: '補足',
			'onUpdate:modelValue': update,
		}, { default: () => '補足付き設定' });
		await nextTick();
		const helpCheckbox = withHelp.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		const helpDescriptionIds = helpCheckbox?.getAttribute('aria-describedby')?.split(' ') ?? [];
		expect(helpDescriptionIds).toHaveLength(2);
		expect(helpDescriptionIds.some(id => window.document.getElementById(id)?.textContent?.includes('補足'))).toBe(true);
		expect(helpDescriptionIds.some(id => window.document.getElementById(id)?.tagName === 'SPAN')).toBe(true);
		withHelp.container.querySelector<HTMLElement>('.ti-help-circle')?.parentElement?.click();
		expect(update).not.toHaveBeenCalled();

		visibleLabel.click();
		await nextTick();
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenLastCalledWith(true);
		visual.parentElement?.click();
		await nextTick();
		expect(update).toHaveBeenCalledTimes(2);
		expect(update).toHaveBeenLastCalledWith(false);

		const noBody = mount(MkSwitch, { modelValue: false, noBody: true, ariaLabel: '切り替え' });
		await nextTick();
		const compactCheckbox = noBody.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(compactCheckbox?.hasAttribute('aria-labelledby')).toBe(false);
		expect(compactCheckbox?.hasAttribute('aria-describedby')).toBe(false);
		expect(compactCheckbox?.getAttribute('aria-label')).toBe('切り替え');
		expect(mkSwitchSource).toContain('i18n.ts.switch');
	});

	test('Inputは非nativeラベルとaria-labelledby/説明IDを安定して接続する', async () => {
		const item = mount(MkInput, { modelValue: '', placeholder: '表示名' }, {
			label: () => '表示名',
			caption: () => '30文字まで',
		});
		await nextTick();

		const input = item.container.querySelector<HTMLInputElement>('input');
		const label = item.container.querySelector<HTMLElement>('[id^="mk-input-"]');
		if (input == null || label == null) throw new Error('入力欄の表示ラベルを生成できませんでした');
		expect(label.tagName).toBe('DIV');
		expect(input.getAttribute('aria-labelledby')).toBe(label.id);
		expect(window.document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toContain('30文字まで');
	});

	test('Inputの表示ラベルは通常クリックだけを入力へ委譲し、内包buttonのクリックを奪わない', async () => {
		const buttonClick = vi.fn();
		const item = mount(MkInput, { modelValue: '', placeholder: '表示名' }, {
			label: () => h('span', [h('span', '表示名'), h('button', { type: 'button', onClick: buttonClick }, '説明')]),
		});
		await nextTick();

		const input = item.container.querySelector<HTMLInputElement>('input');
		const label = item.container.querySelector<HTMLElement>('[id^="mk-input-"]');
		const button = label?.querySelector<HTMLButtonElement>('button');
		if (input == null || label == null || button == null) throw new Error('Inputのラベル要素を生成できませんでした');
		label.click();
		expect(window.document.activeElement).toBe(input);
		input.blur();
		button.click();
		expect(buttonClick).toHaveBeenCalledTimes(1);
		expect(window.document.activeElement).not.toBe(input);
	});

	test('Textarea・CodeEditor・ColorInputの可視label/captionは実controlへ接続する', async () => {
		const cases: Array<{ component: Component; props: Record<string, unknown>; selector: string; label: string; caption: string }> = [
			{ component: MkTextarea, props: { modelValue: '' }, selector: 'textarea', label: '説明文', caption: '改行を含めて入力できます' },
			{ component: MkCodeEditor, props: { modelValue: '', lang: 'css' }, selector: 'textarea', label: 'カスタムCSS', caption: 'CSSだけを入力してください' },
			{ component: MkColorInput, props: { modelValue: '#112233' }, selector: 'input[type="color"]', label: 'アクセントカラー', caption: '16進数の色を選びます' },
		];
		for (const entry of cases) {
			const item = mount(entry.component, entry.props, { label: () => entry.label, caption: () => entry.caption });
			await nextTick();
			const label = item.container.querySelector<HTMLLabelElement>('label');
			const control = item.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(entry.selector);
			if (label == null || control == null) throw new Error(`${entry.label} のlabel/controlを生成できませんでした`);
			expect(label.htmlFor).toBe(control.id);
			expect(control.getAttribute('aria-labelledby')).toBe(label.id);
			expect(window.document.getElementById(control.getAttribute('aria-describedby') ?? '')?.textContent).toContain(entry.caption);
			expect(label.textContent).toContain(entry.label);
		}
	});

	test('Selectは名前付きのnative menu buttonとしてEnter・Space・矢印で一度だけ開き、required/readonly/disabledを保つ', async () => {
		let close: (() => void) | undefined;
		popupMenu.mockImplementation((_items, _anchor, options) => {
			close = options.onClosing;
		});
		const item = mount(MkSelect, {
			modelValue: 'normal',
			items: [{ value: 'normal', label: '標準' }, { value: 'compact', label: 'コンパクト' }],
			required: true,
		}, {
			label: () => '表示密度',
			caption: () => 'タイムラインの余白',
		});
		await nextTick();

		const selectButton = item.container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
		if (selectButton == null) throw new Error('選択欄のmenu buttonを生成できませんでした');
		expect(selectButton.getAttribute('role')).toBeNull();
		expect(selectButton.getAttribute('aria-required')).toBe('true');
		expect(window.document.getElementById(selectButton.getAttribute('aria-labelledby') ?? '')?.textContent).toContain('表示密度');
		const keydown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
		selectButton.dispatchEvent(keydown);
		await nextTick();
		expect(keydown.defaultPrevented).toBe(true);
		expect(popupMenu).toHaveBeenCalledTimes(1);
		expect(selectButton.getAttribute('aria-expanded')).toBe('true');

		selectButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await nextTick();
		expect(popupMenu).toHaveBeenCalledTimes(1);
		close?.();
		await nextTick();
		expect(selectButton.getAttribute('aria-expanded')).toBe('false');

		const disabled = mount(MkSelect, {
			modelValue: 'normal',
			items: [{ value: 'normal', label: '標準' }],
			disabled: true,
		}, { label: () => '無効な選択' });
		await nextTick();
		const disabledButton = disabled.container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
		expect(disabledButton?.disabled).toBe(true);
		expect(disabledButton?.getAttribute('aria-disabled')).toBe('true');
		disabledButton?.click();
		expect(popupMenu).toHaveBeenCalledTimes(1);

		const readonly = mount(MkSelect, {
			modelValue: 'normal',
			items: [{ value: 'normal', label: '標準' }],
			readonly: true,
		}, { label: () => '読み取り専用の選択' });
		await nextTick();
		const readonlyButton = readonly.container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
		expect(readonlyButton?.disabled).toBe(false);
		expect(readonlyButton?.getAttribute('aria-readonly')).toBe('true');
		expect(readonlyButton?.getAttribute('aria-disabled')).toBe('true');
		readonlyButton?.click();
		expect(popupMenu).toHaveBeenCalledTimes(1);
	});

	test('Rangeはsliderの値を公開し、矢印・Home・Endでstep/min/maxを守る', async () => {
		const value = ref(4);
		const updates: number[] = [];
		const dragEnds: number[] = [];
		const item = mount(MkRange, {
			modelValue: value.value,
			min: 0,
			max: 10,
			step: 2,
			textConverter: (next: number) => `${next}%`,
			'onUpdate:modelValue': (next: number) => { updates.push(next); value.value = next; },
			onDragEnded: (next: number) => dragEnds.push(next),
		}, {
			label: () => '透明度',
			caption: () => '背景の見え方を調整',
		});
		await nextTick();

		const slider = item.container.querySelector<HTMLElement>('[role="slider"]');
		if (slider == null) throw new Error('スライダーのthumbを生成できませんでした');
		expect(slider.getAttribute('tabindex')).toBe('0');
		expect(slider.getAttribute('aria-valuemin')).toBe('0');
		expect(slider.getAttribute('aria-valuemax')).toBe('10');
		expect(slider.getAttribute('aria-valuenow')).toBe('4');
		expect(slider.getAttribute('aria-valuetext')).toBe('4%');

		for (const key of ['ArrowRight', 'ArrowLeft', 'End', 'Home']) {
			slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
			await nextTick();
		}
		expect(updates).toEqual([6, 4, 10, 0]);
		expect(dragEnds).toEqual([6, 4, 10, 0]);
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
		await nextTick();
		expect(updates).toEqual([6, 4, 10, 0]);
		expect(dragEnds).toEqual([6, 4, 10, 0]);

		slider.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
		expect(window.document.activeElement).toBe(slider);
		window.dispatchEvent(new Event('pointerup'));

		const disabledUpdates = vi.fn();
		const disabled = mount(MkRange, {
			modelValue: 0,
			min: 0,
			max: 10,
			disabled: true,
			'onUpdate:modelValue': disabledUpdates,
		});
		await nextTick();
		const disabledSlider = disabled.container.querySelector<HTMLElement>('[role="slider"]');
		expect(disabledSlider?.getAttribute('aria-disabled')).toBe('true');
		expect(disabledSlider?.getAttribute('tabindex')).toBe('-1');
		disabledSlider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
		expect(disabledUpdates).not.toHaveBeenCalled();
	});

	test('Rangeの連続更新はpointer終了時に同じ値を再送しない', async () => {
		const updates: number[] = [];
		const dragEnds: number[] = [];
		const item = mount(MkRange, {
			modelValue: 4,
			min: 0,
			max: 10,
			continuousUpdate: true,
			'onUpdate:modelValue': (next: number) => updates.push(next),
			onDragEnded: (next: number) => dragEnds.push(next),
		});
		await nextTick();
		const slider = item.container.querySelector<HTMLElement>('[role="slider"]');
		if (slider == null) throw new Error('連続更新のsliderを生成できませんでした');

		slider.dispatchEvent(pointerEvent('pointerdown'));
		window.dispatchEvent(pointerEvent('pointermove', 100));
		window.dispatchEvent(pointerEvent('pointerup', 100));
		await nextTick();

		expect(updates).toEqual([10]);
		expect(dragEnds).toEqual([10]);
	});

	test('Rangeはunmount時にactive dragを解放し、tooltipとwindow listenerを残さない', async () => {
		const updates = vi.fn();
		const dragEnds = vi.fn();
		popup.mockClear();
		const item = mount(MkRange, {
			modelValue: 4,
			min: 0,
			max: 10,
			continuousUpdate: true,
			'onUpdate:modelValue': updates,
			onDragEnded: dragEnds,
		});
		await nextTick();
		const slider = item.container.querySelector<HTMLElement>('[role="slider"]');
		if (slider == null) throw new Error('unmount検証用のsliderを生成できませんでした');

		slider.dispatchEvent(pointerEvent('pointerdown', 0, 7));
		const popupProps = popup.mock.calls.at(-1)?.[1] as { showing?: { value: boolean } } | undefined;
		expect(popupProps?.showing?.value).toBe(true);
		item.app.unmount();
		expect(popupProps?.showing?.value).toBe(false);

		window.dispatchEvent(pointerEvent('pointermove', 100, 7));
		window.dispatchEvent(pointerEvent('pointerup', 100, 7));
		await nextTick();
		expect(updates).not.toHaveBeenCalled();
		expect(dragEnds).not.toHaveBeenCalled();
	});

	test('Rangeは別pointerの終了を無視し、開始pointerの終了でdragを片付ける', async () => {
		const updates: number[] = [];
		const dragEnds: number[] = [];
		const item = mount(MkRange, {
			modelValue: 4,
			min: 0,
			max: 10,
			'onUpdate:modelValue': (next: number) => updates.push(next),
			onDragEnded: (next: number) => dragEnds.push(next),
		});
		await nextTick();
		const slider = item.container.querySelector<HTMLElement>('[role="slider"]');
		if (slider == null) throw new Error('別pointer検証用のsliderを生成できませんでした');

		slider.dispatchEvent(pointerEvent('pointerdown', 0, 1));
		window.dispatchEvent(pointerEvent('pointerup', 100, 2));
		window.dispatchEvent(pointerEvent('pointermove', 100, 1));
		window.dispatchEvent(pointerEvent('pointerup', 100, 1));
		await nextTick();

		expect(updates).toEqual([10]);
		expect(dragEnds).toEqual([10]);

		window.dispatchEvent(pointerEvent('pointermove', 0, 1));
		window.dispatchEvent(pointerEvent('pointerup', 0, 1));
		await nextTick();
		expect(updates).toEqual([10]);
		expect(dragEnds).toEqual([10]);
	});

	test('Rangeはactive drag中の別pointerdownで先行dragの完了イベントを落とさない', async () => {
		const updates: number[] = [];
		const dragEnds: number[] = [];
		const item = mount(MkRange, {
			modelValue: 4,
			min: 0,
			max: 10,
			'onUpdate:modelValue': (next: number) => updates.push(next),
			onDragEnded: (next: number) => dragEnds.push(next),
		});
		await nextTick();
		const slider = item.container.querySelector<HTMLElement>('[role="slider"]');
		if (slider == null) throw new Error('multi-pointer検証用のsliderを生成できませんでした');

		slider.dispatchEvent(pointerEvent('pointerdown', 0, 1));
		window.dispatchEvent(pointerEvent('pointermove', 100, 1));
		slider.dispatchEvent(pointerEvent('pointerdown', 0, 2));
		window.dispatchEvent(pointerEvent('pointerup', 100, 2));
		window.dispatchEvent(pointerEvent('pointerup', 100, 1));
		await nextTick();

		expect(updates).toEqual([10]);
		expect(dragEnds).toEqual([10]);
	});

	test('Radiosはradio/radiogroupを公開し、無効項目を飛ばして矢印移動する', async () => {
		const updates: string[] = [];
		const item = mount(MkRadios, {
			modelValue: 'first',
			'onUpdate:modelValue': (next: string) => updates.push(next),
		}, {
			label: () => '表示位置',
			caption: () => '画面内での位置を選びます',
			default: () => [
				h('option', { value: 'first' }, '先頭'),
				h('option', { value: 'disabled', disabled: true }, '無効'),
				h('option', { value: 'last' }, '末尾'),
			],
		});
		await nextTick();

		const group = item.container.querySelector<HTMLElement>('[role="radiogroup"]');
		const radios = Array.from(item.container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
		if (group == null) throw new Error('radiogroupを生成できませんでした');
		expect(radios).toHaveLength(3);
		expect(radios[0].checked).toBe(true);
		expect(radios[0].tabIndex).toBe(0);
		expect(radios[1].disabled).toBe(true);
		expect(radios[1].tabIndex).toBe(-1);
		expect(radios[0].name).toBe(radios[2].name);
		expect(window.document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent).toContain('表示位置');
		expect(window.document.getElementById(group.getAttribute('aria-describedby') ?? '')?.textContent).toContain('画面内での位置を選びます');

		const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
		radios[0].dispatchEvent(arrow);
		await nextTick();
		expect(arrow.defaultPrevented).toBe(true);
		expect(updates).toEqual(['last']);
		expect(window.document.activeElement).toBe(radios[2]);

		radios[2].click();
		await nextTick();
		expect(updates).toEqual(['last']);
	});

	test('実装はnative controlを使い、labelの中に別の操作部を入れない', () => {
		expect(mkSwitchSource).toContain('type="checkbox"');
		expect(mkSwitchSource).toContain('@change="onInputChange"');
		expect(mkSwitchSource).toContain('<label :for="inputId" :class="$style.toggle">');
		expect(mkSwitchButtonSource).toContain(':aria-hidden="decorative || undefined"');
		expect(mkSwitchButtonSource).toContain('.decorative');
		expect(mkInputSource).toContain(':aria-labelledby="labelId"');
		expect(mkInputSource).toContain('@click="onLabelClick"');
		expect(mkSelectSource).not.toContain('role="combobox"');
		expect(mkSelectSource).toContain('aria-haspopup="menu"');
		expect(mkSelectSource).toContain(':aria-required="required || undefined"');
		expect(mkSelectSource).toContain('appearance: none;');
		expect(mkSelectSource).toContain('-moz-appearance: none;');
		expect(mkSelectSource).toContain('border: 0;');
		expect(mkSelectSource).toContain('border-radius: 0;');
		expect(mkSelectSource).toContain('background: transparent;');
		expect(mkSelectSource).toContain('font: inherit;');
		expect(mkSelectSource).toContain('line-height: inherit;');
		expect(mkSelectSource).toContain('letter-spacing: inherit;');
		expect(mkSelectSource).toContain('text-align: inherit;');
		expect(mkSelectSource).toContain('text-transform: none;');
		expect(mkSelectSource).toContain('text-decoration: none;');
		expect(mkSelectSource).toContain('min-inline-size: 0;');
		expect(mkSelectSource).toContain('box-shadow: none;');
		expect(mkSelectSource).toContain('&:focus-visible');
		expect(mkRangeSource).toContain('role="slider"');
		expect(mkRangeSource).toContain('aria-orientation="horizontal"');
		expect(mkRangeSource).toContain(':aria-disabled="disabled || undefined"');
		expect(mkRangeSource).toContain('@pointerdown="onPointerdown"');
		expect(mkRangeSource).toContain('touch-action: none;');
		expect(mkRangeSource).toContain('&:focus-visible');
		expect(mkRadioSource).toContain('<label');
		expect(mkRadioSource).toContain('type="radio"');
		expect(mkRadioSource).toContain('@change="onChange"');
		for (const source of [mkTextareaSource, mkCodeEditorSource, mkColorInputSource]) {
			expect(source).toContain(':for="inputId"');
			expect(source).toContain(':id="inputId"');
		}
		for (const source of [mkInputSource, mkTextareaSource, mkCodeEditorSource, mkColorInputSource, mkSelectSource]) {
			expect(source).toMatch(/\.label\s*\{\s*display: block;/);
		}
		expect(mkRangeSource).toContain('window.addEventListener(\'pointerup\', onMouseup);');
		expect(mkRangeSource).toContain('window.addEventListener(\'pointercancel\', onMouseup);');
		expect(mkRangeSource).not.toContain('window.addEventListener(\'pointerup\', onMouseup, { once: true });');
		expect(mkRangeSource).toContain('releasePointerCapture?.(pointerId)');
		expect(mkRangeSource).toContain('let activeDragCleanup: (() => void) | null = null;');
		expect(mkRangeSource).toContain('if (activeDragCleanup != null) return;');
		expect(mkRangeSource).toContain('emit(\'dragEnded\', next);');
		expect(mkRangeSource).toContain('--mk-range-thumb-width: 44px;');
		expect(mkRangeSource).toContain('width: calc(100% - var(--mk-range-thumb-width));');
	});
});
