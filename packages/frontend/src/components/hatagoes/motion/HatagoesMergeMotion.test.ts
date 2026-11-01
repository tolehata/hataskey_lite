/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HatagoesMergeMotion from './HatagoesMergeMotion.vue';

describe('HataGoes merge motion lifecycle', () => {
	let frames: Map<number, FrameRequestCallback>;
	let nextId: number;
	let target: HTMLDivElement;
	let app: ReturnType<typeof createApp>;
	let width: number;
	let resize: (() => void) | undefined;
	const step = (stamp: number) => {
		const pending = [...frames.values()];
		frames.clear();
		for (const callback of pending) callback(stamp);
	};
	beforeEach(() => {
		frames = new Map();
		nextId = 0;
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++nextId; frames.set(id, callback); return id; });
		vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
		width = 960;
		resize = undefined;
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('hatagoes-merge-motion') ? width : 0; });
		vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
		target = window.document.createElement('div');
		window.document.body.append(target);
	});
	afterEach(() => { app?.unmount(); target.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

	it('pauses when inactive or hidden, resumes without jumping, and clears RAF on unmount', async () => {
		const active = ref(true);
		app = createApp({ render: () => h(HatagoesMergeMotion, { active: active.value }) });
		app.mount(target);
		expect(frames.size).toBe(1);
		step(1000); step(2000);
		active.value = false;
		await nextTick();
		expect(frames.size).toBe(0);
		active.value = true;
		await nextTick();
		step(10000); step(10500);
		expect(frames.size).toBe(1);
		width = 0;
		resize?.();
		expect(frames.size).toBe(0);
		width = 960;
		resize?.();
		step(20000); step(20500);
		expect(frames.size).toBe(1);
		Object.defineProperty(window.document, 'hidden', { configurable: true, value: true });
		window.document.dispatchEvent(new Event('visibilitychange'));
		expect(frames.size).toBe(0);
		Object.defineProperty(window.document, 'hidden', { configurable: true, value: false });
		window.document.dispatchEvent(new Event('visibilitychange'));
		step(30000); step(30500);
		expect(frames.size).toBe(1);
		app.unmount();
		expect(frames.size).toBe(0);
		app = undefined as unknown as ReturnType<typeof createApp>;
	});
});
