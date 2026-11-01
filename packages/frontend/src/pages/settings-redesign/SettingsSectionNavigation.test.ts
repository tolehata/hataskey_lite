/* SPDX-License-Identifier: AGPL-3.0-only */

import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SettingsSectionNavigation from './SettingsSectionNavigation.vue';
import type { App } from 'vue';

vi.mock('@/i18n.js', () => ({
	i18n: { ts: { _hata: { _settingsBento: { details: '詳細設定' } } } },
}));

const items = [
	{ id: 'profile.section0', label: 'プロフィール', icon: 'ti ti-user' },
	{ id: 'profile.section1', label: 'アカウント', icon: 'ti ti-id' },
	{ id: 'profile.section2', label: 'アバター', icon: 'ti ti-photo' },
];
const mounted: Array<{ app: App<Element>; container: HTMLElement }> = [];

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function mountNavigation(initialItems = items, activeId: string | null = items[0].id) {
	const state = reactive({ items: initialItems.map(item => ({ ...item })), activeId, motionEnabled: true });
	const select = vi.fn();
	const app = createApp({ render: () => h(SettingsSectionNavigation, { ...state, onSelect: select }) });
	const container = window.document.createElement('main');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { container, state, select };
}

function getNavigation(container: HTMLElement) {
	const navigation = container.querySelector<HTMLElement>('[data-settings-section-navigation]');
	if (navigation == null) throw new Error('Missing section navigation');
	return navigation;
}

function getButtons(container: HTMLElement) {
	return [...container.querySelectorAll<HTMLButtonElement>('button')];
}

function mockViewport(navigation: HTMLElement, width = 120) {
	vi.spyOn(navigation, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, width, 52));
	return vi.spyOn(navigation, 'scrollTo').mockImplementation((options?: ScrollToOptions | number) => {
		if (typeof options === 'object' && options.left != null) navigation.scrollLeft = options.left;
	});
}

describe('settings section navigation', () => {
	test('空の節一覧では表示せず、一覧が届いたら元の順序で表示する', async () => {
		const { container, state } = mountNavigation([]);
		expect(container.querySelector('nav')).toBeNull();
		state.items = items.map(item => ({ ...item }));
		await nextTick();
		expect(getButtons(container).map(button => button.dataset.settingsSectionId)).toEqual(items.map(item => item.id));
		expect(getNavigation(container).getAttribute('aria-label')).toBe('詳細設定');
	});

	test('選択中だけラベルを表示し、全ボタンに名前と現在位置を伝える', () => {
		const { container } = mountNavigation();
		const buttons = getButtons(container);
		for (const [index, button] of buttons.entries()) {
			expect(button.type).toBe('button');
			expect(button.getAttribute('aria-label')).toBe(items[index].label);
			expect(button.title).toBe(items[index].label);
			expect(button.querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
			expect(button.textContent.trim()).toBe(index === 0 ? items[index].label : '');
		}
		expect(buttons[0].getAttribute('aria-current')).toBe('location');
		expect(buttons.slice(1).every(button => !button.hasAttribute('aria-current'))).toBe(true);
		expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
	});

	test('クリックは選択を通知し、親からの現在位置更新まで表示を勝手に変更しない', async () => {
		const { container, state, select } = mountNavigation();
		const buttons = getButtons(container);
		buttons[1].click();
		buttons[0].click();
		expect(select.mock.calls).toEqual([[items[1].id], [items[0].id]]);
		expect(buttons[0].getAttribute('aria-current')).toBe('location');
		buttons[0].focus();
		state.activeId = items[1].id;
		await nextTick();
		expect(getButtons(container)).toEqual(buttons);
		expect(buttons[1].getAttribute('aria-current')).toBe('location');
		expect(buttons[1].textContent).toContain(items[1].label);
		expect(buttons[0].textContent.trim()).toBe('');
		expect(window.document.activeElement).toBe(buttons[0]);
	});

	test.each([
		{ left: 180, initialScrollLeft: 0, expected: 160 },
		{ left: -80, initialScrollLeft: 200, expected: 100 },
	])('選択項目が外れたら横方向だけ露出する left=$left', async ({ left, initialScrollLeft, expected }) => {
		const { container, state } = mountNavigation();
		await nextTick();
		const navigation = getNavigation(container);
		const buttons = getButtons(container);
		const scrollCapsule = mockViewport(navigation);
		const outerScroll = vi.spyOn(container, 'scrollTo');
		const scrollIntoView = vi.spyOn(buttons[1], 'scrollIntoView');
		vi.spyOn(buttons[1], 'getBoundingClientRect').mockReturnValue(new DOMRect(left, 0, 80, 44));
		container.scrollTop = 123;
		navigation.scrollLeft = initialScrollLeft;
		state.activeId = items[1].id;
		await nextTick();
		expect(scrollCapsule).toHaveBeenCalledWith({ left: expected, behavior: 'auto' });
		expect(navigation.scrollLeft).toBe(expected);
		expect(container.scrollTop).toBe(123);
		expect(outerScroll).not.toHaveBeenCalled();
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	test('表示内の選択項目は横スクロールを維持し、選択なしでは全項目をアイコンだけにする', async () => {
		const { container, state } = mountNavigation();
		await nextTick();
		const navigation = getNavigation(container);
		const scrollCapsule = mockViewport(navigation, 200);
		vi.spyOn(getButtons(container)[1], 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 0, 80, 44));
		navigation.scrollLeft = 40;
		state.activeId = items[1].id;
		await nextTick();
		expect(scrollCapsule).not.toHaveBeenCalled();
		expect(navigation.scrollLeft).toBe(40);
		state.activeId = null;
		state.motionEnabled = false;
		await nextTick();
		expect(getButtons(container).every(button => button.textContent.trim() === '' && !button.hasAttribute('aria-current'))).toBe(true);
		expect(navigation.dataset.motionEnabled).toBe('false');
	});

	test('項目の変更とカプセルの幅変更後も選択項目を露出し、撤去時は幅監視を解除する', async () => {
		let resize: ResizeObserverCallback | undefined;
		const observe = vi.fn();
		const disconnect = vi.fn();
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback: ResizeObserverCallback) { resize = callback; }
			observe = observe;
			disconnect = disconnect;
		});
		const { container, state } = mountNavigation();
		await nextTick();
		const navigation = getNavigation(container);
		const scrollCapsule = mockViewport(navigation);
		const button = getButtons(container)[0];
		vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(180, 0, 80, 44));
		expect(observe).toHaveBeenCalledWith(navigation);
		state.items[0].label = '長さが変わったプロフィール';
		await nextTick();
		expect(button.textContent).toContain(state.items[0].label);
		expect(scrollCapsule).toHaveBeenCalledTimes(1);
		resize?.([], {} as ResizeObserver);
		expect(scrollCapsule).toHaveBeenCalledTimes(2);
		state.items = [];
		await nextTick();
		expect(container.querySelector('nav')).toBeNull();
		expect(disconnect).toHaveBeenCalledTimes(1);
	});
});
