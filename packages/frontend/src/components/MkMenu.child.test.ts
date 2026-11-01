/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* eslint-disable vue/one-component-per-file -- Fixtures mount the real child wrapper with a size-reporting inner menu stub. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, defineComponent, h, nextTick, shallowReactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkMenuChild from './MkMenu.child.vue';
import type { App, PropType } from 'vue';
import type { MenuItem } from '@/types/menu.js';

vi.mock('./MkMenu.vue', async () => {
	const { defineComponent: component, h: render } = await import('vue');
	return { default: component({
		props: {
			items: { type: Array as PropType<MenuItem[]>, required: true },
			align: { type: String, default: undefined },
			width: { type: Number, default: undefined },
			maxWidth: { type: Number, default: undefined },
			maxHeight: { type: Number, default: undefined },
			asDrawer: Boolean,
		},
		emits: ['close'],
		setup: (props, { emit }) => () => render('div', {
			'data-test-child-content': '',
			'data-max-width': props.maxWidth,
			'data-max-height': props.maxHeight,
			'data-width': props.width,
			'data-drawer': String(props.asDrawer),
			onChildClose: (event: Event) => emit('close', (event as CustomEvent<boolean>).detail),
		}),
	}) };
});

type ChildProps = { items: MenuItem[]; anchorElement: HTMLElement; rootElement: HTMLElement; width?: number };
const mounted: Array<{ app: App<Element>; container: HTMLElement; anchor: HTMLElement; root: HTMLElement; owner: HTMLElement }> = [];
const observers: Array<{ callback: ResizeObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
let visualViewport: EventTarget & { width: number; height: number; offsetLeft: number; offsetTop: number };
let viewportWidth = 390;
let viewportHeight = 700;
let rootRect: DOMRect;
let anchorRect: DOMRect;
let childRect: DOMRect;
let ownerRect: DOMRect;
let offsetOwner: HTMLElement | null;
let viewportAvailable = true;
let originalViewport: PropertyDescriptor | undefined;
let originalOffsetParent: PropertyDescriptor | undefined;

function rect(left: number, top: number, width: number, height: number): DOMRect { return new DOMRect(left, top, width, height); }

async function flush(): Promise<void> { await nextTick(); await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

beforeEach(() => {
	viewportWidth = 390;
	viewportHeight = 700;
	rootRect = rect(20, 80, 240, 400);
	anchorRect = rect(20, 120, 240, 40);
	childRect = rect(0, 0, 240, 180);
	ownerRect = rect(0, 0, 390, 700);
	offsetOwner = null;
	viewportAvailable = true;
	observers.splice(0);
	visualViewport = Object.assign(new EventTarget(), { width: 390, height: 700, offsetLeft: 0, offsetTop: 0 });
	originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
	originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
	// Happy DOM does not implement these geometry APIs; install only this
	// fixture's read-only accessors and restore their original descriptors below.
	Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewportAvailable ? visualViewport : null });
	vi.spyOn(window.document.documentElement, 'clientWidth', 'get').mockImplementation(() => viewportWidth);
	vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
	vi.spyOn(window, 'innerHeight', 'get').mockImplementation(() => viewportHeight);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		if (this.hasAttribute('data-test-menu-anchor')) return anchorRect;
		if (this.hasAttribute('data-test-menu-root')) return rootRect;
		if (this.hasAttribute('data-test-child-root')) return childRect;
		if (this.hasAttribute('data-test-offset-owner')) return ownerRect;
		return rect(0, 0, 0, 0);
	});
	Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-test-child-root') ? offsetOwner : null; } });
	vi.stubGlobal('ResizeObserver', class {
		observe = vi.fn();
		disconnect = vi.fn();
		constructor(callback: ResizeObserverCallback) { observers.push({ callback, observe: this.observe, disconnect: this.disconnect }); }
	});
});

afterEach(() => {
	for (const { app, container, anchor, root, owner } of mounted.splice(0)) {
		app.unmount(); container.remove(); anchor.remove(); root.remove(); owner.remove();
	}
	vi.restoreAllMocks(); vi.unstubAllGlobals();
	if (originalViewport) Object.defineProperty(window, 'visualViewport', originalViewport);
	else Reflect.deleteProperty(window, 'visualViewport');
	if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', originalOffsetParent);
	else Reflect.deleteProperty(HTMLElement.prototype, 'offsetParent');
});

async function mountChild(options: { width?: number; positionedOwner?: boolean; scaledOwner?: boolean } = {}) {
	const anchor = window.document.createElement('button'); anchor.setAttribute('data-test-menu-anchor', '');
	const root = window.document.createElement('div'); root.setAttribute('data-test-menu-root', '');
	const owner = window.document.createElement('div'); owner.setAttribute('data-test-offset-owner', '');
	const container = window.document.createElement('div');
	window.document.body.append(anchor, root, owner, container);
	if (options.positionedOwner) {
		offsetOwner = owner;
		owner.scrollLeft = 12; owner.scrollTop = 18;
		Object.defineProperty(owner, 'clientLeft', { value: 2 });
		Object.defineProperty(owner, 'clientTop', { value: 3 });
		if (options.scaledOwner) {
			Object.defineProperty(owner, 'offsetWidth', { value: 200 });
			Object.defineProperty(owner, 'offsetHeight', { value: 150 });
		}
	}
	const props = shallowReactive<ChildProps>({ items: [{ text: '位置を変更', action: vi.fn() }], anchorElement: anchor, rootElement: root, width: options.width });
	const closed = vi.fn(); const actioned = vi.fn();
	const app = createApp(defineComponent({ setup: () => () => h(MkMenuChild, { ...props, 'data-test-child-root': '', onClosed: closed, onActioned: actioned }) }));
	app.mount(container); mounted.push({ app, container, anchor, root, owner });
	await flush();
	const element = container.querySelector<HTMLElement>('[data-test-child-root]');
	const content = container.querySelector<HTMLElement>('[data-test-child-content]');
	if (!element || !content) throw new Error('Child menu did not mount');
	return { app, container, anchor, root, owner, props, element, content, closed, actioned };
}

function notifyResize(): void {
	for (const observer of observers) observer.callback([], {} as ResizeObserver);
}

describe('子メニューの画面内配置とサイズ接続', () => {
	test('390px画面で両側に入らない子は親へ重ね、内側へ幅と高さの上限を渡す', async () => {
		const { element, content } = await mountChild({ width: 460 });
		expect(content.dataset.maxWidth).toBe('358');
		expect(content.dataset.maxHeight).toBe('668');
		expect(content.dataset.width).toBe('460');
		expect(content.dataset.drawer).toBe('false');
		expect(element.style.left).toBe('20px');
		expect(element.style.top).toBe('112px');
	});

	test('visualViewportの拡大・移動範囲を使い、巨大な内容も上下左右16px内へ収める', async () => {
		Object.assign(visualViewport, { width: 260, height: 360, offsetLeft: 40, offsetTop: 90 });
		anchorRect = rect(20, 600, 240, 40);
		childRect = rect(0, 0, 500, 900);
		const { element, content } = await mountChild();
		expect(content.dataset.maxWidth).toBe('228');
		expect(content.dataset.maxHeight).toBe('328');
		expect(element.style.left).toBe('56px');
		expect(element.style.top).toBe('106px');
	});

	test('visualViewportがなければlayout viewportのclientWidthとinnerHeightを使う', async () => {
		viewportAvailable = false;
		viewportWidth = 390; viewportHeight = 500;
		const { element, content } = await mountChild();
		expect(content.dataset.maxWidth).toBe('358');
		expect(content.dataset.maxHeight).toBe('468');
		expect(element.style.left).toBe('20px');
	});

	test('実際のoffsetParentの位置・スクロール・境界幅をCSS座標へ換算する', async () => {
		ownerRect = rect(50, 40, 390, 700);
		const { element, owner } = await mountChild({ positionedOwner: true });
		expect(element.style.left).toBe('-20px');
		expect(element.style.top).toBe('87px');
		expect(parseFloat(element.style.left) + ownerRect.left - owner.scrollLeft + owner.clientLeft).toBe(20);
		expect(parseFloat(element.style.top) + ownerRect.top - owner.scrollTop + owner.clientTop).toBe(112);
	});

	test('拡大中の親でもCSS位置と最大幅をscale補正する', async () => {
		ownerRect = rect(40, 20, 400, 300);
		const { element, content } = await mountChild({ positionedOwner: true, scaledOwner: true });
		expect(content.dataset.maxWidth).toBe('179');
		expect(content.dataset.maxHeight).toBe('334');
		expect(element.style.left).toBe('0px');
		expect(element.style.top).toBe('61px');
	});

	test.each(['transitionend', 'transitioncancel'])('親scaleが0.9から1へ変わった%sで再計測し、子要素のイベントには反応しない', async eventName => {
		ownerRect = rect(40, 20, 180, 135);
		const { element, content, owner } = await mountChild({ positionedOwner: true, scaledOwner: true });
		expect(Number(content.dataset.maxWidth)).toBeCloseTo(358 / 0.9);
		expect(Number(content.dataset.maxHeight)).toBeCloseTo(668 / 0.9);
		ownerRect = rect(40, 20, 200, 150);
		const unrelated = window.document.createElement('span'); owner.append(unrelated);
		unrelated.dispatchEvent(new Event(eventName, { bubbles: true }));
		await flush();
		expect(Number(content.dataset.maxWidth)).toBeCloseTo(358 / 0.9);
		owner.dispatchEvent(new Event(eventName));
		await flush();
		expect(content.dataset.maxWidth).toBe('358');
		expect(content.dataset.maxHeight).toBe('668');
		expect(element.style.left).toBe('-10px');
		expect(element.style.top).toBe('107px');
	});

	test('位置基準の親が変わったら旧transition監視を外し、新親の監視もアンマウント時に解除する', async () => {
		const observeStyle = vi.spyOn(MutationObserver.prototype, 'observe');
		const disconnectStyle = vi.spyOn(MutationObserver.prototype, 'disconnect');
		const { app, container, owner, props } = await mountChild({ positionedOwner: true });
		expect(observeStyle).toHaveBeenCalledWith(owner, { attributes: true, attributeFilter: ['style'] });
		const initialDisconnects = disconnectStyle.mock.calls.length;
		const removeOld = vi.spyOn(owner, 'removeEventListener');
		const newOwner = window.document.createElement('div'); newOwner.setAttribute('data-test-offset-owner', '');
		const newAnchor = window.document.createElement('button'); newAnchor.setAttribute('data-test-menu-anchor', '');
		container.append(newOwner, newAnchor);
		const addNew = vi.spyOn(newOwner, 'addEventListener');
		const removeNew = vi.spyOn(newOwner, 'removeEventListener');
		offsetOwner = newOwner;
		props.anchorElement = newAnchor;
		await flush();
		expect(disconnectStyle).toHaveBeenCalledTimes(initialDisconnects + 1);
		expect(observeStyle).toHaveBeenLastCalledWith(newOwner, { attributes: true, attributeFilter: ['style'] });
		for (const eventName of ['transitionend', 'transitioncancel']) {
			expect(removeOld).toHaveBeenCalledWith(eventName, expect.any(Function));
			expect(addNew).toHaveBeenCalledWith(eventName, expect.any(Function), { passive: true });
		}
		app.unmount();
		expect(disconnectStyle).toHaveBeenCalledTimes(initialDisconnects + 2);
		for (const eventName of ['transitionend', 'transitioncancel']) expect(removeNew).toHaveBeenCalledWith(eventName, expect.any(Function));
		const item = mounted.pop();
		if (item) { item.container.remove(); item.anchor.remove(); item.root.remove(); item.owner.remove(); }
	});

	test('外側メニューのinline位置だけが変わった場合も追随し、class変更では再計測しない', async () => {
		ownerRect = rect(50, 40, 390, 700);
		const { element, owner } = await mountChild({ positionedOwner: true });
		expect(element.style.left).toBe('-20px');
		ownerRect = rect(80, 70, 390, 700);
		owner.style.left = '80px'; owner.style.top = '70px';
		await flush();
		expect(element.style.left).toBe('-50px');
		expect(element.style.top).toBe('57px');
		ownerRect = rect(100, 100, 390, 700);
		owner.classList.add('unrelated-owner-class');
		await flush();
		expect(element.style.left).toBe('-50px');
		owner.style.left = '100px'; owner.style.top = '100px';
		await flush();
		expect(element.style.left).toBe('-70px');
		expect(element.style.top).toBe('27px');
	});

	test('window・文書scroll・visualViewport・ResizeObserverの変化で再配置する', async () => {
		const { element, content, anchor, root } = await mountChild();
		expect(observers).toHaveLength(1);
		expect(observers[0].observe.mock.calls.map(call => call[0])).toEqual([element, root, anchor]);
		anchorRect = rect(20, 500, 240, 40);
		window.dispatchEvent(new Event('resize'));
		await flush();
		expect(element.style.top).toBe('492px');
		anchorRect = rect(20, 200, 240, 40);
		window.document.dispatchEvent(new Event('scroll'));
		await flush();
		expect(element.style.top).toBe('192px');
		visualViewport.height = 300;
		visualViewport.dispatchEvent(new Event('resize'));
		await flush();
		expect(content.dataset.maxHeight).toBe('268');
		expect(element.style.top).toBe('104px');
		visualViewport.offsetTop = 150;
		visualViewport.dispatchEvent(new Event('scroll'));
		await flush();
		expect(element.style.top).toBe('192px');
		childRect = rect(0, 0, 240, 240);
		notifyResize();
		await flush();
		expect(element.style.top).toBe('192px');
		childRect = rect(0, 0, 240, 280);
		notifyResize();
		await flush();
		expect(element.style.top).toBe('166px');
	});

	test('アンカー変更を監視し、アンマウント時に全イベントとサイズ監視を解除する', async () => {
		const removeWindow = vi.spyOn(window, 'removeEventListener');
		const removeDocument = vi.spyOn(window.document, 'removeEventListener');
		const removeViewport = vi.spyOn(visualViewport, 'removeEventListener');
		const { app, container, props, element, root } = await mountChild();
		const replacement = window.document.createElement('button');
		replacement.setAttribute('data-test-menu-anchor', ''); container.append(replacement);
		anchorRect = rect(20, 300, 240, 40);
		props.anchorElement = replacement;
		await flush();
		expect(observers[0].observe.mock.calls.slice(-3).map(call => call[0])).toEqual([element, root, replacement]);
		expect(element.style.top).toBe('292px');
		const disconnects = observers[0].disconnect.mock.calls.length;
		app.unmount();
		expect(observers[0].disconnect).toHaveBeenCalledTimes(disconnects + 1);
		expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
		expect(removeDocument).toHaveBeenCalledWith('scroll', expect.any(Function), true);
		expect(removeViewport).toHaveBeenCalledWith('resize', expect.any(Function));
		expect(removeViewport).toHaveBeenCalledWith('scroll', expect.any(Function));
		const item = mounted.pop();
		if (item) { item.container.remove(); item.anchor.remove(); item.root.remove(); item.owner.remove(); }
	});

	test('子メニューの通常閉鎖と操作完了を親へ区別して伝える', async () => {
		const { content, closed, actioned } = await mountChild();
		content.dispatchEvent(new CustomEvent('child-close', { detail: false }));
		expect(closed).toHaveBeenCalledTimes(1);
		expect(actioned).not.toHaveBeenCalled();
		content.dispatchEvent(new CustomEvent('child-close', { detail: true }));
		expect(actioned).toHaveBeenCalledTimes(1);
	});

	test('子ラッパーはmax-content幅で、位置を変えても計測幅を縮ませない', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/MkMenu.child.vue'), 'utf8');
		const stableWidth = (css: string): boolean => /\.root\s*\{[^}]*width:\s*max-content;/.test(css);
		expect(stableWidth('.root { position: absolute; width: auto; }')).toBe(false);
		expect(stableWidth(source)).toBe(true);
	});
});
