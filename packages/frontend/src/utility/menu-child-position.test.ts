/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { getMenuChildPosition } from './menu-child-position.js';
import type { MenuChildPosition, MenuChildPositionInput } from './menu-child-position.js';

function fixture(overrides: Partial<MenuChildPositionInput> = {}): MenuChildPositionInput {
	return { root: { left: 160, right: 400 }, anchor: { top: 100 }, menu: { width: 240, height: 320 }, viewport: { left: 0, top: 0, width: 1280, height: 800 }, ...overrides };
}

/** Bounds detector also used against the former right-or-left-only algorithm below. */
function clippedEdges(input: MenuChildPositionInput, result: MenuChildPosition): string[] {
	const { viewport, menu } = input;
	const horizontalMargin = Math.min(16, viewport.width / 2);
	const verticalMargin = Math.min(16, viewport.height / 2);
	const width = Math.min(Math.max(0, menu.width), result.maxWidth);
	const height = Math.min(Math.max(0, menu.height), result.maxHeight);
	return [
		!Object.values(result).every(Number.isFinite) && 'non-finite',
		result.maxWidth < 0 && 'negative-width',
		result.maxHeight < 0 && 'negative-height',
		result.left < viewport.left + horizontalMargin && 'left',
		result.top < viewport.top + verticalMargin && 'top',
		result.left + width > viewport.left + viewport.width - horizontalMargin && 'right',
		result.top + height > viewport.top + viewport.height - verticalMargin && 'bottom',
	].filter((value): value is string => typeof value === 'string');
}

describe('child menu viewport positioning', () => {
	test('the detector catches the old flip putting a mobile submenu beyond the left edge', () => {
		const input = fixture({ root: { left: 16, right: 272 }, menu: { width: 256, height: 320 }, viewport: { left: 0, top: 0, width: 320, height: 640 } });
		// For a full-width anchor, the former root.left + anchor.offsetWidth
		// placement equals root.right; its fallback never checked the left edge.
		let oldLeft = input.root.right;
		if (oldLeft + input.menu.width >= input.viewport.width - 16) oldLeft = input.root.left - input.menu.width;
		const oldPosition = { left: oldLeft, top: input.anchor.top - 8, maxWidth: 288, maxHeight: 608 };
		expect(oldLeft).toBe(-240);
		expect(clippedEdges(input, oldPosition)).toEqual(['left']);
		expect(clippedEdges(input, getMenuChildPosition(input))).toEqual([]);
	});

	test('an adjacent right-hand submenu remains beside the desktop parent', () => {
		const input = fixture();
		expect(getMenuChildPosition(input)).toEqual({ left: 400, top: 92, maxWidth: 1248, maxHeight: 768 });
		expect(clippedEdges(input, getMenuChildPosition(input))).toEqual([]);
	});

	test('the left adjacent side is used when only that side has room', () => {
		const input = fixture({ root: { left: 1010, right: 1250 } });
		expect(getMenuChildPosition(input).left).toBe(770);
		expect(clippedEdges(input, getMenuChildPosition(input))).toEqual([]);
	});

	test('a menu fitting exactly against the right margin does not flip', () => {
		const input = fixture({ root: { left: 784, right: 1024 } });
		expect(getMenuChildPosition(input).left).toBe(1024);
		expect(clippedEdges(input, getMenuChildPosition(input))).toEqual([]);
	});

	test.each([320, 375, 414])('at %spx, three successive child levels stay accessible at either edge', viewportWidth => {
		for (const edge of ['left', 'right'] as const) {
			const menuWidth = 256;
			let parentLeft = edge === 'left' ? 16 : viewportWidth - 16 - menuWidth;
			for (let level = 0; level < 3; level++) {
				const input = fixture({ root: { left: parentLeft, right: parentLeft + menuWidth }, anchor: { top: 80 + level * 48 }, menu: { width: menuWidth, height: 320 }, viewport: { left: 0, top: 0, width: viewportWidth, height: 760 } });
				const result = getMenuChildPosition(input);
				expect(result.left).toBe(parentLeft);
				expect(result.top).toBe(input.anchor.top - 8);
				expect(clippedEdges(input, result), `${edge}, level ${level + 1}`).toEqual([]);
				parentLeft = result.left;
			}
		}
	});

	test.each([
		{ root: { left: -120, right: -20 }, expected: 16 },
		{ root: { left: 600, right: 880 }, expected: 99 },
	])('offscreen parents are clamped into the visible viewport: $root', ({ root, expected }) => {
		const input = fixture({ root, menu: { width: 260, height: 200 }, viewport: { left: 0, top: 0, width: 375, height: 700 } });
		const result = getMenuChildPosition(input);
		expect(result.left).toBe(expected);
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test('oversized menus use both viewport limits and remain within the visible area', () => {
		const input = fixture({ root: { left: 30, right: 290 }, anchor: { top: 560 }, menu: { width: 900, height: 1400 }, viewport: { left: 0, top: 0, width: 320, height: 600 } });
		const result = getMenuChildPosition(input);
		expect(result).toEqual({ left: 16, top: 16, maxWidth: 288, maxHeight: 568 });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([
		{ anchorTop: -100, expectedTop: 16 },
		{ anchorTop: 16, expectedTop: 16 },
		{ anchorTop: 792, expectedTop: 464 },
		{ anchorTop: 1100, expectedTop: 464 },
	])('vertical position follows the anchor unless a viewport edge intervenes: $anchorTop', ({ anchorTop, expectedTop }) => {
		const input = fixture({ anchor: { top: anchorTop } });
		const result = getMenuChildPosition(input);
		expect(result.top).toBe(expectedTop);
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test('a shifted visual viewport uses its own bounds without converting CSS origins', () => {
		const input = fixture({ root: { left: 40, right: 296 }, anchor: { top: 750 }, menu: { width: 256, height: 300 }, viewport: { left: 48, top: 120, width: 375, height: 640 } });
		const result = getMenuChildPosition(input);
		expect(result).toEqual({ left: 64, top: 444, maxWidth: 343, maxHeight: 608 });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test.each([0, 1, 16, 31, 32])('a viewport of %spx never produces a negative size or an offscreen position', dimension => {
		const input = fixture({ root: { left: -500, right: 500 }, anchor: { top: 500 }, viewport: { left: 12, top: 23, width: dimension, height: dimension } });
		const result = getMenuChildPosition(input);
		expect(result).toEqual({ left: 12 + dimension / 2, top: 23 + dimension / 2, maxWidth: 0, maxHeight: 0 });
		expect(clippedEdges(input, result)).toEqual([]);
	});

	test('frozen DOM measurements are read without mutation', () => {
		const input = fixture();
		for (const measurement of Object.values(input)) Object.freeze(measurement);
		Object.freeze(input);
		const before = JSON.stringify(input);
		expect(getMenuChildPosition(input)).toEqual(getMenuChildPosition(input));
		expect(JSON.stringify(input)).toBe(before);
	});
});
