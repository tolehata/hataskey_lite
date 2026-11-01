/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { getCanvasView, hexToHsv, hsvToHex, minimapPanFromDrag, penPressure, pointerSamples } from './hatadint-input.js';

function pointer(overrides: Partial<PointerEvent> = {}): PointerEvent {
	return { pointerId: 7, pointerType: 'pen', clientX: 20, clientY: 40, pressure: 0.5, ...overrides } as PointerEvent;
}

describe('Hatadint pressure input', () => {
	test.each([0, 0.1, 0.5, 1])('preserves a valid pen pressure of %s', pressure => {
		expect(penPressure(pointer({ pressure }))).toBe(pressure);
	});

	test.each([Number.NaN, Infinity, -Infinity, -0.1, 1.1])('uses full width for invalid pressure %s', pressure => {
		expect(penPressure(pointer({ pressure }))).toBe(1);
	});

	test.each(['mouse', 'touch', ''])('uses full width for %s input', pointerType => {
		expect(penPressure(pointer({ pointerType, pressure: 0.2 }))).toBe(1);
	});

	test('uses full width when pressure is disabled', () => {
		expect(penPressure(pointer({ pressure: 0 }), false)).toBe(1);
	});

	test('retains coalesced sample order without duplicating the parent event', () => {
		const first = pointer({ clientX: 1, pressure: 0.1 });
		const last = pointer({ clientX: 2, pressure: 0.9 });
		const parent = pointer({ getCoalescedEvents: () => [first, last] });
		expect(pointerSamples(parent)).toEqual([first, last]);
	});

	test('filters other pointers and non-finite coordinates', () => {
		const valid = pointer({ clientX: 100 });
		const parent = pointer({ getCoalescedEvents: () => [pointer({ pointerId: 8 }), pointer({ clientX: NaN }), valid, pointer({ clientY: Infinity })] });
		expect(pointerSamples(parent)).toEqual([valid]);
	});

	test.each(['unavailable', 'empty', 'invalid', 'throws'])('uses the parent when coalesced samples are %s', mode => {
		const parent = pointer();
		if (mode !== 'unavailable') parent.getCoalescedEvents = () => {
			if (mode === 'throws') throw new Error('not supported');
			return mode === 'invalid' ? [pointer({ pointerId: 99 })] : [];
		};
		expect(pointerSamples(parent)).toEqual([parent]);
	});
});

describe('Hatadint canvas viewport', () => {
	test('a fitted or exactly fitting canvas does not need a preview', () => {
		expect(getCanvasView(800, 600, 1, 0, 0, 1000, 800)).toEqual({ clipped: false, miniHeight: 120, rect: { left: 0, top: 0, width: 160, height: 120 } });
		expect(getCanvasView(800, 600, 1, 0, 0, 800, 600).clipped).toBe(false);
	});

	test('clipping begins at subpixel overflow instead of a zoom threshold', () => {
		expect(getCanvasView(800, 600, 1, 1e-8, 0, 800, 600).clipped).toBe(false);
		expect(getCanvasView(800, 600, 1, 0.001, 0, 800, 600).clipped).toBe(true);
		expect(getCanvasView(800, 600, 0.5, 101, 0, 600, 500).clipped).toBe(true);
	});

	test('an enlarged centered canvas shows its cropped middle', () => {
		expect(getCanvasView(800, 600, 2, 0, 0, 800, 600)).toEqual({ clipped: true, miniHeight: 120, rect: { left: 40, top: 30, width: 80, height: 60 } });
	});

	test('positive translation clips the right and bottom of the artwork', () => {
		expect(getCanvasView(800, 600, 1, 100, 150, 800, 600).rect).toEqual({ left: 0, top: 0, width: 140, height: 90 });
	});

	test('negative translation clips the left and top of the artwork', () => {
		expect(getCanvasView(800, 600, 1, -100, -150, 800, 600).rect).toEqual({ left: 20, top: 30, width: 140, height: 90 });
	});

	test.each([[800, 0], [-800, 0], [0, 600], [0, -600], [900, 700]])('omits the frame when the canvas has no visible area at pan %s,%s', (x, y) => {
		expect(getCanvasView(800, 600, 1, x, y, 800, 600)).toMatchObject({ clipped: true, rect: null });
	});

	test('preserves portrait and wide aspect ratios at custom miniature sizes', () => {
		expect(getCanvasView(400, 800, 1, 0, 0, 400, 400, 100)).toEqual({ clipped: true, miniHeight: 200, rect: { left: 0, top: 50, width: 100, height: 100 } });
		expect(getCanvasView(1200, 400, 1, 0, 0, 600, 400, 180)).toEqual({ clipped: true, miniHeight: 60, rect: { left: 45, top: 0, width: 90, height: 60 } });
	});

	test('does not create a preview for an unmeasured or invalid viewport', () => {
		expect(getCanvasView(800, 600, 1, 0, 0, 0, 600)).toEqual({ clipped: false, miniHeight: 0, rect: null });
		expect(getCanvasView(800, 600, NaN, 0, 0, 800, 600).rect).toBeNull();
		expect(getCanvasView(800, 600, 1, Infinity, 0, 800, 600).rect).toBeNull();
	});

	test('dragging the miniature frame pans opposite to the artwork at the correct zoom scale', () => {
		expect(minimapPanFromDrag(25, -15, 10, -20, 800, 600, 2, 160)).toEqual({ x: -75, y: 185 });
		expect(minimapPanFromDrag(25, -15, 0, 0, 800, 600, 2, 160)).toEqual({ x: 25, y: -15 });
	});

	test('portrait dragging moves the frame by the same number of miniature pixels', () => {
		const before = getCanvasView(400, 800, 2, 0, 0, 400, 400, 100);
		const pan = minimapPanFromDrag(0, 0, 10, 20, 400, 800, 2, 100);
		const after = getCanvasView(400, 800, 2, pan.x, pan.y, 400, 400, 100);
		expect(after.rect!.left - before.rect!.left).toBe(10);
		expect(after.rect!.top - before.rect!.top).toBe(20);
	});

	test('an unmeasured miniature leaves the current pan alone', () => {
		expect(minimapPanFromDrag(25, -15, 10, 20, 800, 600, 2, 0)).toEqual({ x: 25, y: -15 });
	});
});

describe('Hatadint color conversion', () => {
	test.each([
		[0, '#ff0000'], [60, '#ffff00'], [120, '#00ff00'], [180, '#00ffff'], [240, '#0000ff'], [300, '#ff00ff'], [360, '#ff0000'],
	] as const)('converts hue %s to %s and back', (h, hex) => {
		expect(hsvToHex(h, 100, 100)).toBe(hex);
		expect(hexToHsv(hex)).toEqual({ h: h % 360, s: 100, v: 100 });
	});

	test('keeps the selected hue when changing to gray or white', () => {
		const previous = { h: 240, s: 80 };
		expect(hexToHsv('#808080', previous)).toEqual({ h: 240, s: 0, v: 128 / 255 * 100 });
		expect(hexToHsv('#ffffff', previous)).toEqual({ h: 240, s: 0, v: 100 });
	});

	test('black preserves hue and saturation so raising brightness restores color', () => {
		const black = hexToHsv('#000000', { h: 210, s: 80 })!;
		expect(black).toEqual({ h: 210, s: 80, v: 0 });
		expect(hsvToHex(black.h, black.s, 100)).toBe('#3399ff');
	});

	test('keeps uppercase input valid and stabilizes half-channel rounding', () => {
		expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 100, v: 100 });
		expect(hsvToHex(0, 80, 70)).toBe('#b32424');
		expect(hsvToHex(0, 0, 50)).toBe('#808080');
	});

	test.each(['red', '#fff', '#fffffff', '#ff0000ff', '#ff00gg', 'ff0000', ' #ff0000'])('rejects malformed HEX %s without choosing a replacement color', hex => {
		expect(hexToHsv(hex, { h: 30, s: 60 })).toBeNull();
	});

	test('clamps controls at their allowed limits', () => {
		expect(hsvToHex(-1, 110, 120)).toBe('#ff0000');
		expect(hsvToHex(361, -20, 100)).toBe('#ffffff');
		expect(hsvToHex(200, 100, -1)).toBe('#000000');
	});

	test('round-trips representative colors including near-black and unequal channels', () => {
		for (const hex of ['#123456', '#abcdef', '#010203', '#fffeff', '#32ab87', '#b32424', '#808080', '#000000']) {
			const hsv = hexToHsv(hex)!;
			expect(hsvToHex(hsv.h, hsv.s, hsv.v), hex).toBe(hex);
		}
	});
});
