/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHk3HomeScroll } from './hk3-home-scroll.js';

const viewports: HTMLElement[] = [];

function fixture(top = 20000, motion = true) {
	const viewport = window.document.createElement('div');
	window.document.body.append(viewport);
	viewports.push(viewport);
	viewport.scrollTop = top;
	const frames = new Map<number, FrameRequestCallback>();
	let nextId = 0;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
		frames.set(++nextId, callback);
		return nextId;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
	const scroll = createHk3HomeScroll(() => viewport, () => motion);
	const tick = (time: number) => {
		const pending = [...frames.values()];
		frames.clear();
		pending.forEach(callback => callback(time));
	};
	return { viewport, scroll, tick, frames, setMotion: (enabled: boolean) => { motion = enabled; } };
}

afterEach(() => {
	vi.restoreAllMocks();
	viewports.splice(0).forEach(viewport => viewport.remove());
});

describe('UI S Home scroll', () => {
	it('eases a long distance to zero within the duration cap', () => {
		const { viewport, scroll, tick, frames } = fixture();
		scroll.start();
		tick(0);
		tick(225);
		const quarter = viewport.scrollTop;
		tick(450);
		const half = viewport.scrollTop;
		tick(675);
		const threeQuarters = viewport.scrollTop;
		expect(quarter).toBeGreaterThan(half);
		expect(half).toBeGreaterThan(threeQuarters);
		expect(threeQuarters).toBeGreaterThan(0);
		expect(half - threeQuarters).toBeGreaterThan(threeQuarters);
		tick(900);
		expect(viewport.scrollTop).toBe(0);
		expect(frames.size).toBe(0);
	});

	it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('leaves control with manual %s input', type => {
		const { viewport, scroll, tick, frames } = fixture();
		scroll.start();
		tick(0);
		tick(300);
		const stoppedAt = viewport.scrollTop;
		window.dispatchEvent(new Event(type));
		tick(900);
		expect(viewport.scrollTop).toBe(stoppedAt);
		expect(frames.size).toBe(0);
	});

	it('jumps to top with reduced motion and safely replaces a running tap', () => {
		const { viewport, scroll, tick, frames, setMotion } = fixture();
		scroll.start();
		tick(0);
		tick(200);
		const current = viewport.scrollTop;
		scroll.start();
		expect(viewport.scrollTop).toBe(current);
		expect(frames.size).toBe(1);
		setMotion(false);
		tick(300);
		expect(viewport.scrollTop).toBe(0);
		viewport.scrollTop = 500;
		scroll.start();
		expect(viewport.scrollTop).toBe(0);
		expect(frames.size).toBe(0);
	});
});
