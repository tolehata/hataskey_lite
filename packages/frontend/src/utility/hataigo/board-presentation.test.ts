/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { BOARD_THEMES, CONFIRM_BELOW_CELL_PX, boardGeometry, boardLineWidths, boardPalette, boardPointLabel, boardStars, contrastRatio, moveBoardFocus, nearestPoint, stoneAppearance } from './board-presentation.js';
import type { BoardTheme, StoneStyle } from './board-presentation.js';
import type { BoardSize } from './rules/board.js';

const themes: BoardTheme[] = ['fuji', 'kaya', 'seiji', 'sakura', 'sumi', 'yoru'];
const styles: StoneStyle[] = ['real', 'flat', 'avatar'];

describe('board design presentation', () => {
	test('the contrast check detects a weak pair (positive control)', () => {
		expect(contrastRatio('#e6e0f2', '#c9c1db')).toBeLessThan(3);
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
	});
	for (const dark of [false, true]) {
		test.each(themes)(`%s keeps lines at 4.5:1 and coordinates at 4.5:1 against the board (dark mode: ${dark})`, theme => {
			const palette = boardPalette(theme, dark);
			expect(palette.background).toMatch(/^#[0-9a-f]{6}$/);
			expect(contrastRatio(palette.line, palette.background)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(palette.label, palette.background)).toBeGreaterThanOrEqual(4.5);
		});
	}
	test('dark-mode boards are darker than their light-mode selves', () => {
		for (const theme of ['fuji', 'kaya', 'seiji', 'sakura'] as const) {
			expect(contrastRatio(boardPalette(theme, true).background, '#000000')).toBeLessThan(contrastRatio(BOARD_THEMES[theme].background, '#000000'));
		}
	});
	test('black stones on dark boards get a light rim; on light boards they do not', () => {
		expect(stoneAppearance('real', 'black', true).shadow).toContain('255, 255, 255');
		expect(stoneAppearance('real', 'black', false).shadow).not.toContain('255, 255, 255');
		expect(stoneAppearance('avatar', 'black', true)).toEqual(stoneAppearance('avatar', 'black', false));
	});
	test('a pointer maps to the nearest intersection and ignores the outer margin', () => {
		expect(nearestPoint(9, 0, 0, 400, 400)).toEqual({ x: 0, y: 0 });
		expect(nearestPoint(9, 49, 51, 400, 400)).toEqual({ x: 1, y: 1 });
		expect(nearestPoint(9, 400, 400, 400, 400)).toEqual({ x: 8, y: 8 });
		expect(nearestPoint(9, -40, 10, 400, 400)).toBeNull();
		expect(nearestPoint(9, 10, 10, 0, 0)).toBeNull();
	});
	test('line width grows with the spacing and the edge stays thicker', () => {
		expect(boardLineWidths(16)).toEqual({ inner: 1, edge: 2 });
		expect(boardLineWidths(40).inner).toBeGreaterThan(boardLineWidths(16).inner);
		expect(CONFIRM_BELOW_CELL_PX).toBeGreaterThanOrEqual(24);
	});
	for (const theme of themes) {
		for (const style of styles) {
			test(`${theme} and ${style} keep contrasting black/white appearances and the same geometry`, () => {
				expect(BOARD_THEMES[theme].background).toBeTruthy();
				expect(stoneAppearance(style, 'black').background).not.toBe(stoneAppearance(style, 'white').background);
				expect(boardGeometry(19, true).stone).toBeCloseTo(100 / 18 * 0.95);
			});
		}
	}
	test('uses the exact real and flat stone design without texture images', () => {
		expect(stoneAppearance('real', 'black').background).toBe('radial-gradient(circle at 36% 30%, #6a6560 0%, #2a2725 38%, #0b0a09 100%)');
		expect(stoneAppearance('real', 'white').background).toBe('radial-gradient(circle at 36% 30%, #ffffff 0%, #f3efe8 45%, #c9c1b3 100%)');
		expect(stoneAppearance('real', 'white').shadow).toContain('inset 0 0 0 1px');
		expect(stoneAppearance('flat', 'black')).toEqual({ background: '#221d19', shadow: 'none' });
		expect(stoneAppearance('flat', 'white')).toEqual({ background: '#faf7f4', shadow: 'inset 0 0 0 1.5px #221d19' });
	});
	test.each([9, 13, 19] as BoardSize[])('%s-line geometry preserves all design ratios and mobile hit diameter', size => {
		for (const labels of [false, true]) {
			const geometry = boardGeometry(size, labels);
			expect(geometry.inset).toBeCloseTo((labels ? 1.05 : 0.62) * 100 / (size + 1));
			expect(geometry.star / geometry.cell).toBeCloseTo(0.26);
			expect(geometry.last / geometry.cell).toBeCloseTo(0.42);
			expect(geometry.hint / geometry.cell).toBeCloseTo(0.82);
			expect(geometry.territory / geometry.cell).toBeCloseTo(0.34);
			const stonePixels = 348 * geometry.fraction * geometry.stone / 100;
			const hitPixels = 348 * geometry.fraction * geometry.hit / 100;
			expect(hitPixels).toBeGreaterThanOrEqual(stonePixels);
			expect(stonePixels).toBeGreaterThan(16);
		}
	});
	test('star coordinates follow the three supplied boards', () => {
		expect(boardStars(9)).toEqual([{ x: 2, y: 2 }, { x: 2, y: 6 }, { x: 6, y: 2 }, { x: 6, y: 6 }, { x: 4, y: 4 }]);
		expect(boardStars(13)).toEqual([{ x: 3, y: 3 }, { x: 3, y: 9 }, { x: 9, y: 3 }, { x: 9, y: 9 }, { x: 6, y: 6 }]);
		expect(boardStars(19)).toHaveLength(9);
		expect(boardStars(19)).toContainEqual({ x: 15, y: 15 });
	});
	test('announces coordinates, color and markings in Japanese', () => {
		expect(boardPointLabel(19, { x: 3, y: 15 }, null)).toBe('D4、空き');
		expect(boardPointLabel(19, { x: 15, y: 3 }, 'black', { dead: true, last: true, number: 32 })).toBe('Q16、黒、死石の印、最終手、32手目');
		expect(boardPointLabel(9, { x: 8, y: 8 }, 'white')).toBe('J1、白');
	});
	test('keyboard focus moves orthogonally and clamps without wrapping', () => {
		expect(moveBoardFocus(9, { x: 0, y: 0 }, 'ArrowLeft')).toEqual({ x: 0, y: 0 });
		expect(moveBoardFocus(9, { x: 8, y: 8 }, 'ArrowRight')).toEqual({ x: 8, y: 8 });
		expect(moveBoardFocus(9, { x: 0, y: 0 }, 'ArrowUp')).toEqual({ x: 0, y: 0 });
		expect(moveBoardFocus(9, { x: 3, y: 3 }, 'ArrowDown')).toEqual({ x: 3, y: 4 });
		expect(moveBoardFocus(9, { x: 3, y: 3 }, 'ArrowRight')).toEqual({ x: 4, y: 3 });
		expect(() => moveBoardFocus(9, { x: -1, y: 0 }, 'ArrowRight')).toThrow(RangeError);
	});
});
