/* SPDX-License-Identifier: AGPL-3.0-only */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLtlEmojiRain, playLtlEmojiConfetti } from '@/utility/ltl-emoji-vote-effects.js';

const bounds = { left: 100, top: 100, right: 800, bottom: 800, width: 700, height: 700, x: 100, y: 100, toJSON: () => ({}) };
let frames: Map<number, FrameRequestCallback>;
let frameId: number;

function drawFrame(timestamp: number) {
	const pending = [...frames.values()];
	frames.clear();
	for (const callback of pending) callback(timestamp);
}

function canvasFixture(originCount = 1) {
	const canvas = window.document.createElement('canvas');
	window.document.body.append(canvas);
	const context = { setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), fillRect: vi.fn() };
	vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
	vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(bounds);
	const origins = Array.from({ length: originCount }, (_, index) => {
		const img = window.document.createElement('img');
		window.document.body.append(img);
		vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({ ...bounds, left: 430 + index * 100, top: 430, right: 470 + index * 100, bottom: 470, width: 40, height: 40 });
		return img;
	});
	return { canvas, context, origins };
}

beforeEach(() => {
	frames = new Map();
	frameId = 0;
	vi.spyOn(performance, 'now').mockReturnValue(0);
	vi.spyOn(Math, 'random').mockReturnValue(0.5);
	vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
	vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id); }));
});

afterEach(() => {
	window.document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('LTL emoji rain tiles', () => {
	it.each([[290, 680], [750, 900], [320, 1800]])('covers a %i by %i LTL without exceeding the DOM budget', (width, height) => {
		const tiles = makeLtlEmojiRain(width, height);
		expect(tiles.length).toBeGreaterThan(10);
		expect(tiles.length).toBeLessThanOrEqual(400);
		expect(Math.max(...tiles.map(tile => parseFloat(tile['--x']) + parseFloat(tile['--size'])))).toBeGreaterThanOrEqual(width);
		expect(Math.max(...tiles.map(tile => parseFloat(tile['--y']) + parseFloat(tile['--size'])))).toBeGreaterThanOrEqual(height);
	});
});

describe('LTL radial confetti canvas', () => {
	it('emits three bursts totalling 960 pieces and reaches every quadrant around the winning image', () => {
		const { canvas, context, origins } = canvasFixture();
		const stop = playLtlEmojiConfetti(canvas, () => origins, () => true);
		for (const [time, count] of [[0, 320], [150, 640], [300, 960]]) {
			context.fillRect.mockClear();
			drawFrame(time);
			expect(context.fillRect).toHaveBeenCalledTimes(count);
		}
		const positions = context.translate.mock.calls;
		expect(positions.some(([x, y]) => x < 350 && y < 350)).toBe(true);
		expect(positions.some(([x, y]) => x > 350 && y < 350)).toBe(true);
		expect(positions.some(([x, y]) => x < 350 && y > 350)).toBe(true);
		expect(positions.some(([x, y]) => x > 350 && y > 350)).toBe(true);
		stop();
		expect(frames.size).toBe(0);
	});

	it('shares each burst between tied winners using their actual canvas-relative image centers', () => {
		const { canvas, context, origins } = canvasFixture(2);
		const stop = playLtlEmojiConfetti(canvas, () => origins, () => true);
		drawFrame(0);
		expect(context.translate.mock.calls.filter(([x, y]) => x === 350 && y === 350)).toHaveLength(160);
		expect(context.translate.mock.calls.filter(([x, y]) => x === 450 && y === 350)).toHaveLength(160);
		drawFrame(150);
		context.fillRect.mockClear();
		drawFrame(300);
		expect(context.fillRect).toHaveBeenCalledTimes(960);
		stop();
	});

	it('cancels frames, clears pixels, and cannot resume a stopped effect', () => {
		const { canvas, context, origins } = canvasFixture();
		const stop = playLtlEmojiConfetti(canvas, () => origins, () => true);
		const oldCallback = [...frames.values()][0];
		stop();
		expect(frames.size).toBe(0);
		expect(context.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
		oldCallback(150);
		expect(context.fillRect).not.toHaveBeenCalled();
		expect(frames.size).toBe(0);
	});

	it('stops on deactivation and at its hard deadline after frame suspension', () => {
		const { canvas, context, origins } = canvasFixture();
		let active = true;
		playLtlEmojiConfetti(canvas, () => origins, () => active);
		drawFrame(0);
		active = false;
		drawFrame(100);
		expect(frames.size).toBe(0);
		playLtlEmojiConfetti(canvas, () => origins, () => true);
		context.fillRect.mockClear();
		drawFrame(3400);
		expect(frames.size).toBe(0);
		expect(context.fillRect).not.toHaveBeenCalled();
	});

	it('skips delayed bursts after a long frame rather than releasing all of them together', () => {
		const { canvas, context, origins } = canvasFixture();
		const stop = playLtlEmojiConfetti(canvas, () => origins, () => true);
		drawFrame(1000);
		expect(context.fillRect).toHaveBeenCalledTimes(320);
		context.fillRect.mockClear();
		drawFrame(1016);
		expect(context.fillRect).toHaveBeenCalledTimes(320);
		stop();
	});

	it('does not draw from disconnected or offscreen winners', () => {
		const { canvas, context, origins } = canvasFixture(2);
		origins[0].remove();
		vi.mocked(origins[1].getBoundingClientRect).mockReturnValue({ ...bounds, left: -300, right: -260, top: 200, bottom: 240, width: 40, height: 40 });
		const stop = playLtlEmojiConfetti(canvas, () => origins, () => true);
		drawFrame(0);
		drawFrame(150);
		drawFrame(300);
		expect(context.fillRect).not.toHaveBeenCalled();
		expect(frames.size).toBe(0);
		stop();
	});
});
