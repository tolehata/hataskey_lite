/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHatagoesCompositionClock, HATAGOES_MERGE_CUES } from './hatagoes-composition.js';

describe('hatagoes composition clock', () => {
	let frames: Map<number, FrameRequestCallback>;
	let nextId: number;
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
	});
	afterEach(() => vi.unstubAllGlobals());

	it('uses the source scene boundaries', () => {
		expect(HATAGOES_MERGE_CUES).toEqual({ Three: 0, Gather: 3.2, Merge: 6, Reveal: 8.6, Hold: 12 });
	});

	it('keeps elapsed time across pause and visibility changes', () => {
		const onFrame = vi.fn();
		const clock = createHatagoesCompositionClock({ duration: 14, loop: true, onFrame });
		clock.play(); step(1000); step(2500);
		expect(clock.time).toBe(1.5);
		clock.pause();
		expect(frames.size).toBe(0);
		clock.play(); step(10000); step(10500);
		expect(clock.time).toBe(2);
		clock.setVisible(false);
		expect(frames.size).toBe(0);
		clock.setVisible(true); step(30000); step(30500);
		expect(clock.time).toBe(2.5);
		clock.destroy();
		expect(frames.size).toBe(0);
	});

	it('holds the visible final frame and emits completion once', () => {
		const onFrame = vi.fn(), onComplete = vi.fn();
		const clock = createHatagoesCompositionClock({ duration: 14, endAt: 13.4, loop: false, onFrame, onComplete });
		clock.play(); step(0); step(14000);
		expect(clock.time).toBe(13.4);
		expect(onFrame).toHaveBeenLastCalledWith(13.4);
		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(frames.size).toBe(0);
		clock.replay(); step(20000); step(21000);
		expect(clock.time).toBe(1);
		clock.destroy();
	});

	it('can replay directly from completion without leaving two RAF callbacks', () => {
		const onComplete = vi.fn(() => clock.replay());
		const clock = createHatagoesCompositionClock({ duration: 1, loop: false, onFrame: vi.fn(), onComplete });
		clock.play(); step(0); step(1000);
		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(clock.time).toBe(0);
		expect(frames.size).toBe(1);
		clock.destroy();
		expect(frames.size).toBe(0);
	});
});
