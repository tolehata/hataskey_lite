/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { getHataskEventDetailsPosition } from './hatask-event-details-position.js';
import type { HataskEventDetailsPosition, HataskEventDetailsPositionInput } from './hatask-event-details-position.js';

function fixture(overrides: Partial<HataskEventDetailsPositionInput> = {}): HataskEventDetailsPositionInput {
	return { anchor: { left: 480, right: 520, top: 200, bottom: 240 }, viewport: { left: 0, top: 0, width: 1280, height: 800 }, width: 460, height: 320, ...overrides };
}

/** Checked against deliberately broken positions before use as an overflow detector. */
function clippedEdges(input: HataskEventDetailsPositionInput, result: HataskEventDetailsPosition): string[] {
	const horizontalGutter = Math.min(12, input.viewport.width / 2);
	const verticalGutter = Math.min(12, input.viewport.height / 2);
	const renderedHeight = Math.min(input.height, result.maxHeight);
	return [
		![result.left, result.top, result.width, result.maxHeight, result.arrowLeft ?? 0].every(Number.isFinite) && 'non-finite',
		result.width < 0 && 'negative-width',
		result.maxHeight < 0 && 'negative-height',
		result.left < input.viewport.left + horizontalGutter && 'left',
		result.top < input.viewport.top + verticalGutter && 'top',
		result.left + result.width > input.viewport.left + input.viewport.width - horizontalGutter && 'right',
		result.top + renderedHeight > input.viewport.top + input.viewport.height - verticalGutter && 'bottom',
	].filter((value): value is string => typeof value === 'string');
}

describe('Hatask event detail viewport positioning', () => {
	test('the bounds detector catches real left and bottom overflow before checking valid positions', () => {
		const input = fixture();
		const result = getHataskEventDetailsPosition(input);
		expect(clippedEdges(input, { ...result, left: 11 })).toEqual(['left']);
		expect(clippedEdges(input, { ...result, top: 469 })).toEqual(['bottom']);
		expect(clippedEdges(input, { ...result, arrowLeft: Number.NaN })).toEqual(['non-finite']);
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([
		{ name: 'below fits', input: fixture(), expected: { top: 252, maxHeight: 536, placement: 'below' } },
		{ name: 'above fits', input: fixture({ anchor: { left: 480, right: 520, top: 600, bottom: 640 } }), expected: { top: 268, maxHeight: 576, placement: 'above' } },
		{ name: 'date partly above viewport', input: fixture({ anchor: { left: 480, right: 520, top: -40, bottom: 40 } }), expected: { top: 52, maxHeight: 736, placement: 'below' } },
		{ name: 'date partly below viewport', input: fixture({ anchor: { left: 480, right: 520, top: 760, bottom: 840 } }), expected: { top: 428, maxHeight: 736, placement: 'above' } },
		{ name: 'both fit, prefer below', input: fixture({ anchor: { left: 480, right: 520, top: 380, bottom: 400 }, height: 200 }), expected: { top: 412, maxHeight: 376, placement: 'below' } },
		{ name: 'below fits exactly', input: fixture({ anchor: { left: 480, right: 520, top: 416, bottom: 436 }, height: 340 }), expected: { top: 448, maxHeight: 340, placement: 'below' } },
		{ name: 'one pixel less below flips above', input: fixture({ anchor: { left: 480, right: 520, top: 417, bottom: 437 }, height: 340 }), expected: { top: 65, maxHeight: 393, placement: 'above' } },
		{ name: 'above fits exactly', input: fixture({ anchor: { left: 480, right: 520, top: 364, bottom: 384 }, viewport: { left: 0, top: 0, width: 1280, height: 600 }, height: 340 }), expected: { top: 12, maxHeight: 340, placement: 'above' } },
		{ name: 'neither fits, below is larger', input: fixture({ anchor: { left: 480, right: 520, top: 300, bottom: 340 }, height: 600 }), expected: { top: 352, maxHeight: 436, placement: 'below' } },
		{ name: 'neither fits, above is larger', input: fixture({ anchor: { left: 480, right: 520, top: 480, bottom: 520 }, height: 600 }), expected: { top: 12, maxHeight: 456, placement: 'above' } },
		{ name: 'equal constrained sides prefer below', input: fixture({ anchor: { left: 480, right: 520, top: 380, bottom: 420 }, height: 600 }), expected: { top: 432, maxHeight: 356, placement: 'below' } },
		{ name: 'exact minimum height still anchors', input: fixture({ anchor: { left: 480, right: 520, top: 204, bottom: 244 }, viewport: { left: 0, top: 0, width: 1280, height: 448 } }), expected: { top: 256, maxHeight: 180, placement: 'below' } },
		{ name: 'one pixel below minimum centers', input: fixture({ anchor: { left: 480, right: 520, top: 203, bottom: 243 }, viewport: { left: 0, top: 0, width: 1280, height: 446 } }), expected: { top: 63, maxHeight: 422, placement: 'center' } },
		{ name: 'custom minimum permits smaller side', input: fixture({ anchor: { left: 480, right: 520, top: 203, bottom: 243 }, viewport: { left: 0, top: 0, width: 1280, height: 446 }, minHeight: 100 }), expected: { top: 255, maxHeight: 179, placement: 'below' } },
	])('$name', ({ input, expected }) => {
		const result = getHataskEventDetailsPosition(input);
		expect(result).toEqual({ left: expected.placement === 'center' ? 410 : 270, width: 460, arrowLeft: expected.placement === 'center' ? null : 230, ...expected });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([
		{ name: 'left edge', left: 0, right: 20, expectedLeft: 12, expectedArrow: 24 },
		{ name: 'right edge', left: 1260, right: 1280, expectedLeft: 808, expectedArrow: 436 },
		{ name: 'partially outside left', left: -50, right: 30, expectedLeft: 12, expectedArrow: 24 },
		{ name: 'partially outside right', left: 1250, right: 1330, expectedLeft: 808, expectedArrow: 436 },
		{ name: 'date wider than viewport', left: -300, right: 1300, expectedLeft: 410, expectedArrow: 230 },
	])('horizontal placement and rounded-corner arrow at $name', ({ left, right, expectedLeft, expectedArrow }) => {
		const input = fixture({ anchor: { left, right, top: 200, bottom: 240 } });
		const result = getHataskEventDetailsPosition(input);
		expect(result.left).toBe(expectedLeft);
		expect(result.arrowLeft).toBe(expectedArrow);
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([320, 375, 414])('a %spx viewport constrains the desired card width', viewportWidth => {
		const input = fixture({ anchor: { left: viewportWidth / 2 - 10, right: viewportWidth / 2 + 10, top: 100, bottom: 140 }, viewport: { left: 0, top: 0, width: viewportWidth, height: 700 } });
		const result = getHataskEventDetailsPosition(input);
		expect(result).toEqual({ left: 12, top: 152, width: viewportWidth - 24, maxHeight: 536, placement: 'below', arrowLeft: (viewportWidth - 24) / 2 });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test('a shifted visual viewport retains its coordinate origin when flipping above', () => {
		const input = fixture({ anchor: { left: 200, right: 240, top: 550, bottom: 590 }, viewport: { left: 48, top: 120, width: 375, height: 640 }, height: 300 });
		const result = getHataskEventDetailsPosition(input);
		expect(result).toEqual({ left: 60, top: 238, width: 351, maxHeight: 406, placement: 'above', arrowLeft: 160 });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test('oversized content uses a scrollable side instead of spanning beyond the viewport', () => {
		const input = fixture({ anchor: { left: 140, right: 180, top: 200, bottom: 240 }, viewport: { left: 0, top: 0, width: 320, height: 600 }, width: 900, height: 1400 });
		const result = getHataskEventDetailsPosition(input);
		expect(result).toEqual({ left: 12, top: 252, width: 296, maxHeight: 336, placement: 'below', arrowLeft: 148 });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([
		{ name: 'zero width', left: 500, right: 500, top: 200, bottom: 240 },
		{ name: 'zero height', left: 480, right: 520, top: 200, bottom: 200 },
		{ name: 'reversed width', left: 520, right: 480, top: 200, bottom: 240 },
		{ name: 'reversed height', left: 480, right: 520, top: 240, bottom: 200 },
		{ name: 'non-finite left', left: Number.NaN, right: 520, top: 200, bottom: 240 },
		{ name: 'non-finite bottom', left: 480, right: 520, top: 200, bottom: Number.POSITIVE_INFINITY },
		{ name: 'entirely left', left: -100, right: 0, top: 200, bottom: 240 },
		{ name: 'entirely right', left: 1280, right: 1320, top: 200, bottom: 240 },
		{ name: 'entirely above', left: 480, right: 520, top: -40, bottom: 0 },
		{ name: 'entirely below', left: 480, right: 520, top: 800, bottom: 840 },
	])('an unmeasurable or invisible anchor centers without an arrow: $name', ({ left, right, top, bottom }) => {
		const input = fixture({ anchor: { left, right, top, bottom } });
		const result = getHataskEventDetailsPosition(input);
		expect(result).toEqual({ left: 410, top: 240, width: 460, maxHeight: 776, placement: 'center', arrowLeft: null });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([240, Number.POSITIVE_INFINITY])('DOMRect-like non-enumerable measurements are still validated: %s', bottom => {
		const anchor = Object.create(null, {
			left: { value: 480 }, right: { value: 520 }, top: { value: 200 }, bottom: { value: bottom },
		}) as HataskEventDetailsPositionInput['anchor'];
		expect(Object.keys(anchor)).toEqual([]);
		const result = getHataskEventDetailsPosition(fixture({ anchor }));
		expect(result.placement).toBe(Number.isFinite(bottom) ? 'below' : 'center');
		expect(result.arrowLeft).toBe(Number.isFinite(bottom) ? 230 : null);
	});

	test.each([0, 1, 16, 23, 24, 25])('an extremely small %spx viewport never produces a negative dimension', size => {
		const input = fixture({ viewport: { left: 12, top: 23, width: size, height: size } });
		const result = getHataskEventDetailsPosition(input);
		const contentSize = Math.max(0, size - 24);
		expect(result).toEqual({ left: 12 + (size - contentSize) / 2, top: 23 + (size - contentSize) / 2, width: contentSize, maxHeight: contentSize, placement: 'center', arrowLeft: null });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([0, 1, 24, 44, 48])('the arrow inset remains legal even for a %spx card', width => {
		const input = fixture({ width });
		const result = getHataskEventDetailsPosition(input);
		expect(result.width).toBe(width);
		expect(result.arrowLeft).toBe(width / 2);
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([
		{ name: 'NaN dimensions', viewport: { left: 0, top: 0, width: Number.NaN, height: Number.NaN } },
		{ name: 'infinite dimensions', viewport: { left: 0, top: 0, width: Number.POSITIVE_INFINITY, height: Number.NEGATIVE_INFINITY } },
		{ name: 'negative dimensions', viewport: { left: 0, top: 0, width: -20, height: -40 } },
		{ name: 'non-finite origin', viewport: { left: Number.NaN, top: Number.POSITIVE_INFINITY, width: 0, height: 0 } },
	])('invalid viewport measurements collapse safely: $name', ({ viewport }) => {
		expect(getHataskEventDetailsPosition(fixture({ viewport }))).toEqual({ left: 0, top: 0, width: 0, maxHeight: 0, placement: 'center', arrowLeft: null });
	});

	test.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('invalid desired dimensions fall back to 460px and the 180px minimum: %s', value => {
		const result = getHataskEventDetailsPosition(fixture({ anchor: { left: 480, right: 520, top: 600, bottom: 640 }, width: value, height: value, minHeight: value }));
		expect(result).toEqual({ left: 270, top: 408, width: 460, maxHeight: 576, placement: 'above', arrowLeft: 230 });
	});

	test('very large finite measurements cannot overflow the resulting arithmetic', () => {
		const result = getHataskEventDetailsPosition(fixture({ viewport: { left: Number.MAX_VALUE, top: Number.MAX_VALUE, width: Number.MAX_VALUE, height: Number.MAX_VALUE }, width: Number.MAX_VALUE, height: Number.MAX_VALUE }));
		expect([result.left, result.top, result.width, result.maxHeight].every(Number.isFinite)).toBe(true);
		expect(result.placement).toBe('center');
		expect(result.arrowLeft).toBeNull();
	});

	test('frozen measurements are not changed by repeat calculations', () => {
		const input = fixture();
		Object.freeze(input.anchor);
		Object.freeze(input.viewport);
		Object.freeze(input);
		const before = JSON.stringify(input);
		expect(getHataskEventDetailsPosition(input)).toEqual(getHataskEventDetailsPosition(input));
		expect(JSON.stringify(input)).toBe(before);
	});
});
