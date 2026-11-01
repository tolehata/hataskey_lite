/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachIOSViewportRecovery } from './ios-viewport-recovery.js';

const cleanups: Array<() => void> = [];
const routeListeners = new Set<() => void>();
const router = {
	on: vi.fn((_event: 'change', listener: () => void) => routeListeners.add(listener)),
	off: vi.fn((_event: 'change', listener: () => void) => routeListeners.delete(listener)),
};
let viewport: EventTarget & { scale: number; offsetTop: number };
let root: HTMLElement;
let hidden = false;

function shift(x = 12, y = 320) {
	vi.stubGlobal('scrollX', x);
	vi.stubGlobal('scrollY', y);
}

function attach() {
	const stop = attachIOSViewportRecovery(router);
	cleanups.push(stop);
	return stop;
}

function pageshow() {
	window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	hidden = false;
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
	vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5 });
	viewport = Object.assign(new EventTarget(), { scale: 1, offsetTop: 0 });
	vi.stubGlobal('visualViewport', viewport);
	shift(0, 0);
	vi.stubGlobal('scrollTo', vi.fn(() => shift(0, 0)));
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
	vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
	root = window.document.createElement('div');
	root.scrollTo = vi.fn(() => { root.scrollTop = 0; root.scrollLeft = 0; });
	const descriptor = Object.getOwnPropertyDescriptor(window.document, 'scrollingElement');
	Object.defineProperty(window.document, 'scrollingElement', { configurable: true, get: () => root });
	cleanups.push(() => {
		if (descriptor) Object.defineProperty(window.document, 'scrollingElement', descriptor);
		else Reflect.deleteProperty(window.document, 'scrollingElement');
	});
});

afterEach(() => {
	cleanups.splice(0).reverse().forEach(cleanup => cleanup());
	routeListeners.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('iOS document viewport recovery', () => {
	it('resets only document offsets instantly and stops checking after the finite settle window', async () => {
		const pane = window.document.createElement('section');
		pane.scrollTop = 840;
		pane.scrollLeft = 28;
		pane.scrollTo = vi.fn();
		window.document.body.append(pane);
		cleanups.push(() => pane.remove());
		shift();
		root.scrollTop = 320;
		root.scrollLeft = 12;
		attach();
		await vi.advanceTimersByTimeAsync(16);
		expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
		expect(root.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
		expect([pane.scrollLeft, pane.scrollTop]).toEqual([28, 840]);
		expect(pane.scrollTo).not.toHaveBeenCalled();
		shift();
		await vi.advanceTimersByTimeAsync(84);
		expect(window.scrollY).toBe(0);
		shift();
		await vi.advanceTimersByTimeAsync(250);
		expect(window.scrollTo).toHaveBeenCalledTimes(3);
		expect(vi.getTimerCount()).toBe(0);
		shift();
		await vi.advanceTimersByTimeAsync(2000);
		expect(window.scrollY).toBe(320);
	});

	it.each(['pageshow', 'visible', 'focus', 'focusout', 'viewport resize', 'window resize', 'route'])('recovers after %s, after the synchronous event has finished', async event => {
		attach();
		await vi.advanceTimersByTimeAsync(400);
		shift();
		if (event === 'pageshow') pageshow();
		if (event === 'visible') window.document.dispatchEvent(new Event('visibilitychange'));
		if (event === 'focus') window.dispatchEvent(new Event('focus'));
		if (event === 'focusout') window.document.dispatchEvent(new Event('focusout'));
		if (event === 'viewport resize') viewport.dispatchEvent(new Event('resize'));
		if (event === 'window resize') window.dispatchEvent(new Event('resize'));
		if (event === 'route') routeListeners.forEach(listener => listener());
		expect(window.scrollTo).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(16);
		expect(window.scrollY).toBe(0);
		expect(window.scrollTo).toHaveBeenCalledOnce();
	});

	it('handles root-only scroll and does nothing for a visualViewport offset alone', async () => {
		viewport.offsetTop = 200;
		attach();
		await vi.advanceTimersByTimeAsync(400);
		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(root.scrollTo).not.toHaveBeenCalled();
		root.scrollTop = 100;
		pageshow();
		await vi.advanceTimersByTimeAsync(16);
		expect(root.scrollTop).toBe(0);
		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(viewport.offsetTop).toBe(200);
	});

	it.each(['absent', 'rounded'])('accepts an %s visualViewport scale at normal zoom', async kind => {
		if (kind === 'absent') vi.stubGlobal('visualViewport', undefined);
		else viewport.scale = 1.00001;
		shift();
		attach();
		await vi.advanceTimersByTimeAsync(16);
		expect(window.scrollY).toBe(0);
	});

	it('does not register listeners or change scroll on a non-iOS device', async () => {
		vi.stubGlobal('navigator', { userAgent: 'Android', maxTouchPoints: 5 });
		const added = vi.spyOn(window, 'addEventListener');
		shift();
		root.scrollTop = 120;
		attach();
		pageshow();
		await vi.advanceTimersByTimeAsync(1000);
		expect(added).not.toHaveBeenCalled();
		expect(router.on).not.toHaveBeenCalled();
		expect(window.scrollY).toBe(320);
		expect(root.scrollTop).toBe(120);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(['hidden', 'input', 'textarea', 'select', 'contenteditable', 'zoom in', 'zoom out'])('rechecks %s protection at every queued settle point', async protection => {
		shift();
		attach();
		// Change conditions without an event that would itself cancel the pending work.
		if (protection === 'hidden') hidden = true;
		else if (protection === 'zoom in') viewport.scale = 2;
		else if (protection === 'zoom out') viewport.scale = 0.9;
		else {
			const editor = window.document.createElement(protection === 'contenteditable' ? 'span' : protection);
			if (protection === 'contenteditable') Object.defineProperty(editor, 'isContentEditable', { value: true });
			vi.spyOn(window.document, 'activeElement', 'get').mockReturnValue(editor);
		}
		await vi.advanceTimersByTimeAsync(400);
		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(root.scrollTo).not.toHaveBeenCalled();
		expect(window.scrollY).toBe(320);
		pageshow();
		await vi.advanceTimersByTimeAsync(400);
		expect(window.scrollTo).not.toHaveBeenCalled();
		expect(root.scrollTo).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('queues focusout while the old editor is active and recovers after focus reaches the body', async () => {
		attach();
		await vi.advanceTimersByTimeAsync(400);
		let active: Element = window.document.createElement('textarea');
		vi.spyOn(window.document, 'activeElement', 'get').mockImplementation(() => active);
		shift();
		window.document.dispatchEvent(new Event('focusout'));
		expect(window.scrollTo).not.toHaveBeenCalled();
		active = window.document.body;
		await vi.advanceTimersByTimeAsync(16);
		expect(window.scrollY).toBe(0);
		expect(window.scrollTo).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(400);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(['pointer', 'touch', 'key', 'wheel', 'hidden', 'pagehide'])('cancels pending correction on %s without interrupting the new operation', async operation => {
		shift();
		attach();
		if (operation === 'pointer') {
			window.document.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1 }));
			// A viewport/route event during the gesture must not arm a new correction.
			window.dispatchEvent(new Event('resize'));
			routeListeners.forEach(listener => listener());
			window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1 }));
		}
		if (operation === 'touch') {
			window.document.dispatchEvent(new Event('touchstart'));
			window.document.dispatchEvent(new Event('focusout'));
			window.dispatchEvent(Object.assign(new Event('touchend'), { touches: [] }));
		}
		if (operation === 'key') window.document.dispatchEvent(new Event('keydown'));
		if (operation === 'wheel') window.dispatchEvent(new Event('wheel'));
		if (operation === 'hidden') {
			hidden = true;
			window.document.dispatchEvent(new Event('visibilitychange'));
			hidden = false;
		}
		if (operation === 'pagehide') window.dispatchEvent(new Event('pagehide'));
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(500);
		expect(window.scrollY).toBe(320);
		pageshow();
		await vi.advanceTimersByTimeAsync(16);
		expect(window.scrollY).toBe(0);
	});

	it('replaces an existing guard, coalesces bfcache events, and removes all work on unmount', async () => {
		const targets = [window, window.document, viewport];
		const subscriptions = targets.map(target => ({ add: vi.spyOn(target, 'addEventListener'), remove: vi.spyOn(target, 'removeEventListener') }));
		const first = attach();
		const second = attach();
		first(); // A stale shell cleanup must not stop the replacement.
		expect(routeListeners.size).toBe(1);
		const addedCounts = subscriptions.map(subscription => subscription.add.mock.calls.length);
		for (let index = 0; index < 3; index++) pageshow();
		expect(subscriptions.map(subscription => subscription.add.mock.calls.length)).toEqual(addedCounts);
		expect(vi.getTimerCount()).toBe(3);
		shift();
		await vi.advanceTimersByTimeAsync(16);
		expect(window.scrollTo).toHaveBeenCalledOnce();
		second();
		second();
		expect(routeListeners.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		for (const subscription of subscriptions) {
			for (const args of subscription.add.mock.calls) expect(subscription.remove).toHaveBeenCalledWith(...args);
		}
		shift();
		pageshow();
		viewport.dispatchEvent(new Event('resize'));
		window.dispatchEvent(new Event('focus'));
		window.document.dispatchEvent(new Event('focusout'));
		await vi.advanceTimersByTimeAsync(1000);
		expect(window.scrollY).toBe(320);
	});
});
