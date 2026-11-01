/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import HatagoesScreenPicker from './HatagoesScreenPicker.vue';
import { HATAGOES_CATALOG } from '@/utility/hatagoes-catalog.js';

let cleanup: (() => void) | undefined;

function mount(pins: string[] = [], appPins: string[] = [], options: Record<string, unknown> = {}) {
	const open = vi.fn(), savePins = vi.fn(), saveAppPins = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatagoesScreenPicker, { screens: HATAGOES_CATALOG, pins, appPins, ready: true, saving: false, onOpen: open, onSavePins: savePins, onSaveAppPins: saveAppPins, ...options }) });
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	return { target, open, savePins, saveAppPins };
}

function button(target: HTMLElement, label: string) { return target.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!; }

function pointer(target: HTMLElement, name: string, options: MouseEventInit = {}) {
	target.dispatchEvent(new MouseEvent(name, { bubbles: true, button: 0, ...options }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); });

describe('HataGoes screen picker', () => {
	test('opens a destination on a short press', () => {
		const view = mount();
		const destination = button(view.target, 'カレンダー');
		pointer(destination, 'pointerdown'); pointer(destination, 'pointerup'); destination.click();
		expect(view.open).toHaveBeenCalledWith(expect.objectContaining({ id: 'hatask.cal' }));
	});

	test.each([
		['HataIntro', 'hatask.intro', 'intro'],
		['HataIgo', 'hatask.hataigo', 'igo'],
	])('long pressing %s opens App pin actions without navigating', async (label, id, feature) => {
		const view = mount();
		const destination = button(view.target, label);
		expect(destination.closest('section[aria-label="Hataskey App"]')).not.toBeNull();
		expect(destination.querySelector(`[data-hata-feature="${feature}"]`)).not.toBeNull();
		pointer(destination, 'pointerdown');
		await vi.advanceTimersByTimeAsync(550);
		pointer(destination, 'pointerup'); destination.click();
		await nextTick();
		expect(view.open).not.toHaveBeenCalled();
		const add = [...view.target.querySelectorAll('button')].find(item => item.textContent === '＋にピン留め')!;
		add.click();
		expect(view.saveAppPins).toHaveBeenCalledWith([id]);
	});

	test('scroll gestures cancel long pressing', async () => {
		const view = mount();
		const destination = button(view.target, 'HataIntro');
		pointer(destination, 'pointerdown', { clientY: 5 });
		pointer(destination, 'pointermove', { clientY: 30 });
		await vi.advanceTimersByTimeAsync(600);
		expect(view.target.querySelector('[aria-label="HataIntroの操作"]')).toBeNull();
	});

	test('a full common pin list still permits removal but prevents a sixth pin', () => {
		const view = mount(['hatask.cal', 'hatask.todo', 'hatady.records', 'hatady.collection', 'hatafeed.issues']);
		expect(button(view.target, 'HataIntroをナビに追加').disabled).toBe(true);
		button(view.target, 'カレンダーをナビから外す').click();
		expect(view.savePins).toHaveBeenCalledWith(['hatask.todo', 'hatady.records', 'hatady.collection', 'hatafeed.issues']);
	});

	test('Hatask picker keeps today fixed and uses its own pin label', async () => {
		const view = mount(['hatask.today', 'hatask.cal', 'hatask.todo'], [], { pinLabel: 'Hataskのピン', pinLimit: 5, fixedPinIds: ['hatask.today'], inlineReorder: true });
		expect(view.target.querySelector('[aria-label="きょうをHataskのピンから外す"]')).toBeNull();
		expect(view.target.querySelector('[aria-label="固定ピン"]')).toBeNull();
		expect(view.target.querySelector('[aria-label="カレンダーをHataskのピンから外す"]')).toBeNull();
		expect(view.target.textContent).not.toContain('並べ替え・設定');
		expect(view.target.querySelector('[aria-label="ToDoを上へ"]')).toBeNull();
		button(view.target, 'ピンを編集').click();
		await nextTick();
		expect(view.target.querySelector('[aria-label="固定ピン"]')).toBeTruthy();
		expect(button(view.target, 'カレンダーを上へ').disabled).toBe(true);
		button(view.target, 'ToDoを上へ').click();
		expect(view.savePins).toHaveBeenCalledWith(['hatask.today', 'hatask.todo', 'hatask.cal']);
		button(view.target, 'カレンダーをHataskのピンから外す').click();
		expect(view.savePins).toHaveBeenCalledWith(['hatask.today', 'hatask.todo']);
		expect(view.target.textContent).toContain('Hataskのピン 3/5');
		expect(view.target.textContent).not.toContain('スクラッチパッド');
		expect(view.target.textContent).not.toContain('支援管理');
		button(view.target, 'ピンの編集を完了').click();
		await nextTick();
		expect(view.target.querySelector('[aria-label="固定ピン"]')).toBeNull();
		expect(view.target.querySelector('[aria-label="カレンダーをHataskのピンから外す"]')).toBeNull();
	});

	test('non-pinnable destinations remain open without a pin action', async () => {
		const view = mount(['hatask.today'], [], { pinnableIds: ['hatask.today', 'hatask.cal'] });
		expect(button(view.target, 'Hatask の設定')).toBeTruthy();
		expect(view.target.querySelector('[aria-label="Hatask の設定をナビに追加"]')).toBeNull();
		button(view.target, 'Hatask の設定').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }));
		await nextTick();
		expect(view.target.querySelector('[aria-label="Hatask の設定の操作"]')).toBeTruthy();
		expect([...view.target.querySelectorAll('[aria-label="Hatask の設定の操作"] button')].map(item => item.textContent)).not.toContain('ナビに追加');
		button(view.target, 'Hatask の設定').click();
		expect(view.open).not.toHaveBeenCalled();
	});
});
