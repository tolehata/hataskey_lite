/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import Hk3PostSuccess from './Hk3PostSuccess.vue';

let now = 0;
let sequence = 0;
let reduced = false;
const frames = new Map<number, FrameRequestCallback>();
const listeners = new Set<() => void>();
const cleanups: (() => void)[] = [];

beforeEach(() => {
	now = 0;
	reduced = false;
	frames.clear();
	listeners.clear();
	vi.spyOn(performance, 'now').mockImplementation(() => now);
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		frames.set(++sequence, callback);
		return sequence;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('matchMedia', () => ({
		get matches() { return reduced; },
		addEventListener: (_: string, listener: () => void) => listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
	}));
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function step(time: number) {
	now = time;
	const callbacks = [...frames.values()];
	frames.clear();
	callbacks.forEach(callback => callback(time));
}

function mount(text = 'ノートを作成しました', motion = true) {
	const state = ref({ text, motion, key: 1 });
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(Hk3PostSuccess, state.value) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return {
		state, target, app,
		plane: () => target.querySelector('svg')!,
		letters: () => [...target.querySelectorAll<HTMLElement>('[aria-hidden="true"] > span')].filter(el => !el.hasAttribute('data-post-trail')),
	};
}

describe('UI S post confirmation', () => {
	it('reveals text in order and flies away, leaving the complete accessible message', () => {
		const view = mount();
		expect(view.target.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('ノートを作成しました');
		expect(view.letters().every(letter => letter.style.opacity === '0')).toBe(true);
		step(220);
		expect(Number(view.letters()[0].style.opacity)).toBeGreaterThan(Number(view.letters()[4].style.opacity));
		expect(view.letters().at(-1)?.style.opacity).toBe('0');
		expect(Number(view.plane().style.opacity)).toBeGreaterThan(0);
		step(1100);
		expect(view.letters().every(letter => letter.style.opacity === '1')).toBe(true);
		expect(view.plane().style.opacity).toBe('0');
		expect(frames.size).toBe(0);
	});
	it('finishes a long localized message and restarts cleanly for the next toast', async () => {
		const view = mount('Your note has been created successfully — visible only on this server');
		step(1100);
		expect(view.letters().every(letter => letter.style.opacity === '1')).toBe(true);
		view.state.value = { ...view.state.value, key: 2 };
		await nextTick();
		expect(view.letters().every(letter => letter.style.opacity === '0')).toBe(true);
		expect(frames.size).toBe(1);
		view.app.unmount();
		expect(frames.size).toBe(0);
		expect(listeners.size).toBe(0);
	});
	it.each([false, true])('shows a still complete message when motion is reduced (OS=%s)', os => {
		reduced = os;
		const view = mount(undefined, os);
		expect(view.letters().every(letter => letter.style.opacity === '1')).toBe(true);
		expect(view.plane().style.opacity).toBe('1');
		expect(frames.size).toBe(0);
	});
	it('stops immediately if the OS reduced-motion preference changes during flight', () => {
		const view = mount();
		step(200);
		reduced = true;
		listeners.forEach(listener => listener());
		expect(view.letters().every(letter => letter.style.opacity === '1')).toBe(true);
		expect(view.plane().style.opacity).toBe('1');
		expect(frames.size).toBe(0);
	});
});
