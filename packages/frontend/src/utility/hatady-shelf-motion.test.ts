/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createHatadyShelfMotion } from './hatady-shelf-motion.js';

const cleanups: Array<() => void> = [];
let pending: Map<number, FrameRequestCallback>;
let frameId: number;
let reduced: boolean;
let motionEvent: EventTarget;

function frame(time: number): void {
	const callbacks = [...pending.values()];
	pending.clear();
	callbacks.forEach(callback => callback(time));
}

function runFrames(start: number, rate = 60): void {
	for (let index = 0; index <= rate; index++) frame(start + index * 1000 / rate);
}

beforeEach(() => {
	vi.useFakeTimers();
	pending = new Map();
	frameId = 0;
	reduced = false;
	motionEvent = new EventTarget();
	Object.defineProperty(motionEvent, 'matches', { get: () => reduced });
	vi.spyOn(window, 'matchMedia').mockReturnValue(motionEvent as MediaQueryList);
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { pending.set(++frameId, callback); return frameId; });
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { pending.delete(id); });
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function mountShelf() {
	const shelf = window.document.createElement('div');
	for (const label of ['一冊目', '二冊目', '三冊目']) {
		const button = window.document.createElement('button');
		button.textContent = label;
		button.setAttribute('aria-label', label);
		shelf.append(button);
	}
	window.document.body.append(shelf);
	let left = 0;
	const settings = { paused: false, enabled: true, blocked: false };
	// Some scroll surfaces round assignments to physical pixels. Reading that
	// rounded value each frame must not discard all motion below one pixel.
	Object.defineProperties(shelf, {
		clientWidth: { value: 180 },
		scrollWidth: { get: () => shelf.querySelector('[data-hatady-shelf-copy]:not([hidden])') ? 660 : 330 },
		scrollLeft: { get: () => left, set: value => { left = Math.round(value); } },
	});
	vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
		return this.parentElement === shelf ? Array.from(shelf.children).indexOf(this) * 110 : 0;
	});
	const state = vi.fn();
	const motion = createHatadyShelfMotion({ element: shelf, paused: () => settings.paused, motionEnabled: () => settings.enabled, blocked: () => settings.blocked, onStateChange: state });
	cleanups.push(() => { motion.dispose(); shelf.remove(); });
	return { shelf, motion, settings, state };
}

describe('home shelf automatic scrolling', () => {
	test.each([60, 120])('fractional movement accumulates on a pixel-rounded scroll surface at %i Hz', rate => {
		const { shelf, state } = mountShelf();
		expect(state).toHaveBeenLastCalledWith({ overflow: true, running: true });
		runFrames(0, rate);
		expect(shelf.scrollLeft).toBe(18);
	});

	test('wheel and hover pause, then resume from the manually chosen position', async () => {
		const { shelf } = mountShelf();
		runFrames(0);
		shelf.dispatchEvent(new Event('wheel'));
		expect(pending.size).toBe(0);
		shelf.scrollLeft = 100;
		await vi.advanceTimersByTimeAsync(3500);
		runFrames(2000);
		expect(shelf.scrollLeft).toBe(118);
		shelf.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
		expect(pending.size).toBe(0);
		shelf.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
		runFrames(4000);
		expect(shelf.scrollLeft).toBe(136);
	});

	test('pause, a dialog, disabled animation and reduced motion prevent movement without losing original actions', () => {
		const { shelf, motion, settings } = mountShelf();
		for (const key of ['paused', 'blocked'] as const) {
			settings[key] = true; motion.refresh(); expect(pending.size).toBe(0);
			settings[key] = false; motion.refresh(); expect(pending.size).toBe(1);
		}
		settings.enabled = false; motion.refresh(); expect(pending.size).toBe(0);
		settings.enabled = true; motion.refresh(); expect(pending.size).toBe(1);
		reduced = true; motionEvent.dispatchEvent(new Event('change')); expect(pending.size).toBe(0);
		expect(shelf.querySelector('[data-hatady-shelf-copy]:not([hidden])')).toBeNull();
		reduced = false; motionEvent.dispatchEvent(new Event('change'));
		const selected = vi.fn();
		shelf.querySelector('button')!.addEventListener('click', selected);
		shelf.querySelector<HTMLElement>('[data-hatady-shelf-copy]')!.click();
		expect(selected).toHaveBeenCalledOnce();
		expect(shelf.querySelectorAll('button')).toHaveLength(3);
		motion.dispose();
		expect(shelf.querySelector('[data-hatady-shelf-copy]')).toBeNull();
		expect(pending.size).toBe(0);
	});
});
