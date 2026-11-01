/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, shallowRef } from 'vue';
import MkNotificationToastRing from './MkNotificationToastRing.vue';
import type { App } from 'vue';

let app: App | undefined;
let notifyResize: () => void;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('ResizeObserver', class {
		constructor(callback: () => void) { notifyResize = callback; }
		observe = observe;
		disconnect = disconnect;
	});
});
afterEach(() => {
	app?.unmount();
	app = undefined;
	window.document.body.innerHTML = '';
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function target(width = 360, height = 120) {
	const element = window.document.createElement('div');
	element.style.borderTopLeftRadius = '24px';
	window.document.body.append(element);
	const bounds = vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, width, height));
	return { element, bounds };
}

async function mount(element: HTMLElement | null, integrated = true, motion = true) {
	const targetRef = shallowRef(element);
	const elapsed = ref(0);
	const root = window.document.createElement('div');
	window.document.body.append(root);
	app = createApp({ render: () => h(MkNotificationToastRing, { target: targetRef.value, elapsed: elapsed.value, integrated, motion }) });
	app.mount(root);
	await nextTick();
	return { targetRef, elapsed };
}

describe('notification outline visibility and measurement', () => {
	it('starts empty in the navbar and draws as elapsed time advances', async () => {
		const { element } = target();
		const { elapsed } = await mount(element);
		expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 360 120');
		const paths = [...element.querySelectorAll('path')];
		expect(paths).toHaveLength(2);
		for (const path of paths) {
			expect(path.getAttribute('pathLength')).toBe('1');
			expect(path.getAttribute('stroke-dashoffset')).toBe('1');
		}
		elapsed.value = 2000;
		await nextTick();
		for (const path of paths) expect(path.getAttribute('stroke-dashoffset')).toBe('0.6');
	});

	it('waits for the first full second when motion is disabled', async () => {
		const { element } = target();
		const { elapsed } = await mount(element, true, false);
		elapsed.value = 999;
		await nextTick();
		expect(element.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('1');
		elapsed.value = 1000;
		await nextTick();
		expect(element.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.8');
	});

	it('recovers zero geometry when a hidden navbar becomes visible', async () => {
		const { element, bounds } = target(0, 0);
		await mount(element);
		expect(element.querySelector('svg')).toBeNull();
		bounds.mockReturnValue(new DOMRect(0, 0, 360, 120));
		notifyResize();
		await nextTick();
		expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 360 120');
		expect(element.querySelector('svg')?.style.width).toBe('360px');
		expect(element.querySelector('svg')?.style.height).toBe('120px');
		expect(element.querySelector('path')?.getAttribute('d')).toContain('359 24');
	});

	it('tracks the changing outline without stretching an old viewBox', async () => {
		const { element, bounds } = target(300, 60);
		await mount(element);
		bounds.mockReturnValue(new DOMRect(0, 0, 300, 124));
		notifyResize();
		await nextTick();
		const svg = element.querySelector('svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 300 124');
		expect(svg?.style.height).toBe('124px');
	});

	it('attaches to a late navbar ref and moves to its replacement without resetting progress', async () => {
		const first = target();
		const second = target(280, 90);
		const { targetRef, elapsed } = await mount(null);
		expect(window.document.querySelector('svg')).toBeNull();
		elapsed.value = 2500;
		targetRef.value = first.element;
		await nextTick();
		expect(first.element.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.5');
		targetRef.value = second.element;
		await nextTick();
		expect(first.element.querySelector('svg')).toBeNull();
		expect(second.element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 280 90');
		expect(second.element.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0.5');
		expect(observe).toHaveBeenLastCalledWith(second.element);
		app?.unmount();
		app = undefined;
		expect(second.element.querySelector('svg')).toBeNull();
		expect(disconnect).toHaveBeenCalled();
	});

	it('starts the floating outline full rather than empty', async () => {
		const { element } = target(300, 80);
		await mount(element, false);
		expect(element.querySelectorAll('path')).toHaveLength(1);
		expect(element.querySelector('path')?.getAttribute('stroke-dashoffset')).toBe('0');
	});
});
