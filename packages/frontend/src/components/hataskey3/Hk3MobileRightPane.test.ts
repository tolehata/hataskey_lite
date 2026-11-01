/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import Hk3MobileRightPane from './Hk3MobileRightPane.vue';

vi.mock('@/i18n.js', () => ({ i18n: { ts: { close: 'Close', _hata: { _hataskeyUi3: { paneWidgets: 'Widgets' } } } } }));
vi.mock('./Hk3RightPane.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['initialTab', 'mobile'],
		emits: ['tabChange'],
		setup(props, { slots }) {
			return () => h('aside', { 'data-tab': props.initialTab, 'data-mobile': props.mobile }, [
				h('header', [
					h('strong', props.initialTab === 'widgets' ? 'Widgets' : 'Hatask'),
					...(props.initialTab === 'widgets' ? [h('button', { type: 'button', 'aria-label': 'Edit widgets' }, 'Edit')] : []),
					...(slots.close?.() ?? []),
				]),
				h('input', { 'aria-label': 'Widget setting' }),
				h('a', { href: '/hatask' }, 'Open Hatask'),
			]);
		},
	}) };
});

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

function mount() {
	const state = reactive<{ pane: 'widgets' | 'hatask' | null; glass: boolean; motion: boolean }>({ pane: 'widgets', glass: true, motion: false });
	const events = { close: vi.fn(), tabChange: vi.fn() };
	const shell = window.document.createElement('div');
	shell.dataset.hk3Theme = 'light';
	const target = window.document.createElement('div');
	shell.append(target);
	window.document.body.append(shell);
	const app = createApp({ render: () => h(Hk3MobileRightPane, { ...state, onClose: events.close, onTabChange: events.tabChange }) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); shell.remove(); });
	return { state, events, target, button: (selector: string) => target.querySelector<HTMLButtonElement>(selector)! };
}

function key(element: Element, name: string, extra: KeyboardEventInit = {}) {
	element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra }));
}

describe('Hk3MobileRightPane', () => {
	it('shows one selected title and keeps the close control in the mobile header', async () => {
		const view = mount();
		await nextTick();
		const dialog = view.target.querySelector('[role="dialog"]');
		expect(dialog?.getAttribute('aria-label')).toBe('Widgets');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
		expect(dialog?.hasAttribute('data-glass')).toBe(true);
		expect(view.target.querySelector('aside')?.getAttribute('data-tab')).toBe('widgets');
		expect(view.target.querySelectorAll('header')).toHaveLength(1);
		expect(view.target.querySelector('header strong')?.textContent).toBe('Widgets');
		expect(view.target.querySelector('[role="tablist"]')).toBeNull();
		expect(view.target.querySelector('header [aria-label="Edit widgets"]')).not.toBeNull();
		expect(window.document.activeElement).toBe(view.button('[aria-label="Close"]'));
		view.state.pane = 'hatask'; await nextTick();
		expect(view.target.querySelector('aside')?.getAttribute('data-tab')).toBe('hatask');
		expect(view.target.querySelector('header strong')?.textContent).toBe('Hatask');
		expect(view.target.querySelector('header [aria-label="Edit widgets"]')).toBeNull();
		expect(view.events.tabChange).not.toHaveBeenCalled();
		view.state.glass = false; await nextTick();
		expect(dialog?.hasAttribute('data-glass')).toBe(false);
	});

	it('keeps keyboard focus inside the pane but leaves external popup focus alone', async () => {
		const view = mount(); await nextTick();
		const close = view.button('[aria-label="Close"]');
		const link = view.target.querySelector<HTMLAnchorElement>('a[href]')!;
		const edit = view.button('[aria-label="Edit widgets"]');
		edit.focus(); key(edit, 'Tab', { shiftKey: true });
		expect(window.document.activeElement).toBe(link);
		link.focus(); key(link, 'Tab');
		expect(window.document.activeElement).toBe(edit);
		const popup = window.document.createElement('button'); window.document.body.append(popup);
		popup.focus(); key(popup, 'Escape');
		expect(window.document.activeElement).toBe(popup);
		expect(view.events.close).not.toHaveBeenCalled();
		popup.remove();
		key(close, 'Escape');
		expect(view.events.close).toHaveBeenCalledOnce();
	});

	it('closes from scrim and Hatask links, and makes a leaving pane inert', async () => {
		const view = mount(); await nextTick();
		view.target.querySelector<HTMLElement>('a[href]')!.click();
		view.target.querySelector<HTMLElement>('[role="dialog"]')!.previousElementSibling?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(view.events.close).toHaveBeenCalledTimes(2);
		view.state.motion = true; await nextTick();
		view.state.pane = null; await nextTick();
		const leaving = view.target.querySelector('[role="dialog"]')?.parentElement;
		expect(leaving?.hasAttribute('inert')).toBe(true);
		expect(leaving?.getAttribute('aria-hidden')).toBe('true');
	});

	it('does not take focus from a popup outside the app when opening', async () => {
		const popup = window.document.createElement('button');
		window.document.body.append(popup);
		popup.focus();
		const view = mount(); await nextTick();
		expect(view.target.querySelector('[role="dialog"]')).not.toBeNull();
		expect(window.document.activeElement).toBe(popup);
		popup.remove();
	});
});
