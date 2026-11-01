/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import MkWindow from './MkWindow.vue';

const viewport = vi.hoisted(() => ({ inset: 0 }));
vi.mock('@/os.js', () => ({ claimZIndex: () => 100, contextMenu: vi.fn() }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { windowRestore: '戻す', windowMinimize: '最小化', windowMaximize: '最大化', close: '閉じる' } } }));
vi.mock('@/utility/viewport-inset.js', () => ({
	getViewportTopInset: (element?: Element) => element?.closest('[data-contained]') ? 0 : viewport.inset,
}));

const cleanup: Array<() => void> = [];
let heightAssignments = new WeakMap<CSSStyleDeclaration, string>();
const cases = [
	{ name: 'desktop', inset: 0, contained: false },
	{ name: 'iOS viewport', inset: 16, contained: false },
	{ name: 'iOS contained shell', inset: 16, contained: true },
];

function setViewportHeight(height: number) {
	Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

beforeEach(() => {
	const height = Object.getOwnPropertyDescriptor(window, 'innerHeight')!;
	const width = Object.getOwnPropertyDescriptor(window, 'innerWidth')!;
	cleanup.push(() => {
		Object.defineProperty(window, 'innerHeight', height);
		Object.defineProperty(window, 'innerWidth', width);
	});
	setViewportHeight(600);
	Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	// Happy DOM drops height: var(--token, fallback). Keep the actual assignment
	// for this geometry fixture; native pixel/percentage style handling stays intact.
	heightAssignments = new WeakMap();
	const setHeight = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'height')!.set!;
	vi.spyOn(CSSStyleDeclaration.prototype, 'height', 'set').mockImplementation(function(this: CSSStyleDeclaration, value: string) {
		heightAssignments.set(this, value);
		setHeight.call(this, value);
	});
	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function(this: HTMLElement) {
		if (!this.matches('[data-mk-window]')) return 0;
		return this.style.width === '100%' ? window.innerWidth : parseFloat(this.style.width) || 300;
	});
	vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function(this: HTMLElement) {
		if (!this.matches('[data-mk-window]')) return 0;
		const height = heightAssignments.get(this.style) ?? this.style.height;
		return height === 'var(--MI-viewport-height, 100dvh)' || height === '100%' ? window.innerHeight - viewport.inset : parseFloat(height) || 200;
	});
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
		const origin = this.closest('[data-contained]') ? viewport.inset : 0;
		return new DOMRect(parseFloat(this.style.left) || 0, (parseFloat(this.style.top) || 0) + origin, this.offsetWidth, this.offsetHeight);
	});
	const listen = window.addEventListener.bind(window);
	vi.spyOn(window, 'addEventListener').mockImplementation((...args) => {
		listen(...args);
		cleanup.push(() => window.removeEventListener(args[0], args[1], args[2]));
	});
});

afterEach(() => {
	cleanup.splice(0).reverse().forEach(fn => fn());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function mountWindow(contained: boolean) {
	const host = window.document.createElement('div');
	if (contained) host.dataset.contained = '';
	window.document.body.append(host);
	const app = createApp({
		setup: () => () => h(MkWindow, { initialWidth: 300, initialHeight: 200, canResize: true }, {
			header: () => h('span', { 'data-window-title': '' }, 'ウィンドウ'),
			default: () => h('button', '本文の操作'),
		}),
	});
	app.directive('tooltip', {});
	app.mount(host);
	cleanup.push(() => { app.unmount(); host.remove(); });
	await nextTick();
	const root = host.querySelector<HTMLElement>('[data-mk-window]')!;
	const click = async (icon: string) => {
		root.querySelector(`.${icon}`)!.closest('button')!.click();
		await nextTick();
	};
	return { root, click };
}

function drag(element: Element, from: number, to: number) {
	element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: from }));
	window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: to }));
	window.dispatchEvent(new MouseEvent('mouseup'));
}

describe('MkWindow viewport top exclusion', () => {
	test.each(cases)('$name centers, maximizes and restores within the available viewport', async ({ inset, contained }) => {
		viewport.inset = inset;
		const { root, click } = await mountWindow(contained);
		const localInset = contained ? 0 : inset;
		const initialTop = localInset + (600 - inset - 200) / 2;
		expect(root.style.top).toBe(`${initialTop}px`);
		await click('ti-rectangle');
		expect(root.style.top).toBe(`${localInset}px`);
		expect(heightAssignments.get(root.style)).toBe(inset > 0 ? 'var(--MI-viewport-height, 100dvh)' : '100%');
		expect(root.offsetHeight).toBe(600 - inset);
		expect(root.getBoundingClientRect().top).toBe(inset);
		await click('ti-picture-in-picture');
		expect(root.style.top).toBe(`${initialTop}px`);
		expect(root.style.height).toBe('200px');
	});

	test.each(cases)('$name clamps dragging and both resize edges without moving the opposite edge', async ({ inset, contained }) => {
		viewport.inset = inset;
		const { root } = await mountWindow(contained);
		const title = root.querySelector('[data-window-title]')!.parentElement!;
		drag(title, root.getBoundingClientRect().top + 20, -100);
		expect(root.getBoundingClientRect().top).toBe(inset);
		const localInset = contained ? 0 : inset;
		root.style.top = `${localInset + 100}px`;
		const bottom = root.getBoundingClientRect().bottom;
		drag(root.children[1], root.getBoundingClientRect().top, -100);
		expect(root.getBoundingClientRect().top).toBe(inset);
		expect(root.getBoundingClientRect().bottom).toBe(bottom);
		drag(root.children[3], bottom, 900);
		expect(root.getBoundingClientRect().top).toBe(inset);
		expect(root.getBoundingClientRect().bottom).toBe(600);
	});

	test('desktop minimized restore keeps its existing size behavior', async () => {
		viewport.inset = 0;
		const { root, click } = await mountWindow(false);
		await click('ti-minimize');
		setViewportHeight(120);
		window.dispatchEvent(new Event('resize'));
		await click('ti-maximize');
		expect(root.style.height).toBe('200px');
		expect(root.style.top).toBe('-80px');
	});

	test.each(cases.filter(item => item.inset > 0))('$name keeps the title reachable after a short viewport and minimized restore', async ({ inset, contained }) => {
		viewport.inset = inset;
		const { root, click } = await mountWindow(contained);
		await click('ti-minimize');
		setViewportHeight(120);
		window.dispatchEvent(new Event('resize'));
		await click('ti-maximize');
		expect(root.getBoundingClientRect().top).toBe(inset);
		expect(root.getBoundingClientRect().bottom).toBe(120);
		expect(root.offsetHeight).toBe(120 - inset);
	});
});
