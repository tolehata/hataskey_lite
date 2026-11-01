/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HatagoesCreateHost from './HatagoesCreateHost.vue';

vi.mock('./HatagoesDialog.vue', () => ({ default: { render: () => null } }));

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.restoreAllMocks(); });

describe('HataGoes mobile create host', () => {
	test('Escape inside a child dialog leaves the parent create sheet open', async () => {
		const close = vi.fn();
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const mobile = ref(true);
		const app = createApp({ render: () => h(HatagoesCreateHost, { open: true, mobile: mobile.value, maxHeight: 500, onClose: close }, {
			default: () => [h('button', { 'aria-label': '閉じる' }, '閉じる'), h('input', { 'aria-label': '入力中の下書き' }), h('div', { role: 'dialog', 'aria-label': '子ダイアログ' }, [h('button', { 'aria-label': '子を閉じる' }, '子を閉じる')])],
		}) });
		app.mount(target);
		cleanup = () => { app.unmount(); target.remove(); };
		await nextTick();
		const draft = target.querySelector<HTMLInputElement>('[aria-label="入力中の下書き"]');
		if (!draft) throw new Error('Missing draft input');
		draft.value = '入力途中の文章';
		mobile.value = false;
		await nextTick();
		expect(target.querySelector('[aria-label="入力中の下書き"]')).toBe(draft);
		expect(draft.value).toBe('入力途中の文章');
		const child = target.querySelector<HTMLElement>('[aria-label="子を閉じる"]');
		child?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		expect(close).not.toHaveBeenCalled();
		const parent = target.querySelector<HTMLElement>('[aria-label="閉じる"]');
		parent?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		expect(close).toHaveBeenCalledOnce();
	});

	test('returns the mobile menu to its top on every opening', async () => {
		const focus = vi.spyOn(HTMLElement.prototype, 'focus');
		const opened = ref(false);
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const app = createApp({ render: () => h(HatagoesCreateHost, { open: opened.value, mobile: true, maxHeight: 120 }, { default: () => h('div', { style: 'height: 600px' }, h('button', { 'aria-label': '閉じる' }, '閉じる')) }) });
		app.mount(target);
		cleanup = () => { app.unmount(); target.remove(); };
		opened.value = true;
		await nextTick();
		await nextTick();
		const scroll = target.querySelector<HTMLElement>('div[class*="mobileScroll"]');
		if (!scroll) throw new Error('Missing mobile scroll surface');
		scroll.scrollTop = 80;
		opened.value = false;
		await nextTick();
		opened.value = true;
		await nextTick();
		await nextTick();
		expect(target.querySelector<HTMLElement>('div[class*="mobileScroll"]')?.scrollTop).toBe(0);
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});
});
