/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { isOnBoard, toDisplayPoint } from './rules/board.js';
import type { BoardSize, Color, Point, Stone } from './rules/board.js';

export type BoardTheme = 'fuji' | 'hataskey' | 'kaya' | 'seiji' | 'sakura' | 'sumi' | 'yoru';
export type StoneStyle = 'real' | 'flat' | 'avatar';
export type BoardNumber = { readonly point: Point; readonly number: number };
export type BoardHint = { readonly point: Point; readonly label?: string; readonly kind?: 'candidate' | 'failure' };
export type BoardTerritory = { readonly black: readonly Point[]; readonly white: readonly Point[] };

export type BoardPalette = { readonly background: string; readonly line: string; readonly label: string; readonly dark: boolean };

// Opaque colors only: the line/background contrast is checked in tests (WCAG 2.2 non-text contrast, 3:1).
export const BOARD_THEMES: Readonly<Record<BoardTheme, BoardPalette>> = {
	fuji: { background: '#e6e0f2', line: '#4f4862', label: '#5d5470', dark: false },
	hataskey: { background: '#f4e3d6', line: '#4a403a', label: '#635e59', dark: false },
	kaya: { background: '#e6cb96', line: '#4a3620', label: '#5e4528', dark: false },
	seiji: { background: '#cfe0d6', line: '#2f4d44', label: '#3f5e55', dark: false },
	sakura: { background: '#f3d9da', line: '#6e3d47', label: '#7a4a54', dark: false },
	sumi: { background: '#2b2826', line: '#b3ada6', label: '#b3ada6', dark: true },
	yoru: { background: '#1d2233', line: '#9aa3be', label: '#9aa3be', dark: true },
};

// In the app's dark mode a pale board glares against the page, so light boards are toned down
// together with their lines (both move toward black, which keeps the pair readable).
const DARK_MODE_BOARDS: Readonly<Partial<Record<BoardTheme, BoardPalette>>> = {
	fuji: { background: '#b9b1cc', line: '#2e2840', label: '#2e2840', dark: false },
	hataskey: { background: '#c9b8aa', line: '#2f2824', label: '#2f2824', dark: false },
	kaya: { background: '#c7ab76', line: '#33240f', label: '#33240f', dark: false },
	seiji: { background: '#a9bfb2', line: '#1e352e', label: '#1e352e', dark: false },
	sakura: { background: '#d2b3b5', line: '#4f2a32', label: '#3f1f26', dark: false },
};

export function boardPalette(theme: BoardTheme, darkMode: boolean): BoardPalette {
	return (darkMode ? DARK_MODE_BOARDS[theme] : undefined) ?? BOARD_THEMES[theme];
}

function channel(value: number): number {
	const srgb = value / 255;
	return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative-luminance contrast for #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
	const lum = (hex: string) => {
		const n = Number.parseInt(hex.slice(1), 16);
		return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
	};
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

export function boardGeometry(size: BoardSize, labels: boolean) {
	const inset = (labels ? 1.05 : 0.62) * 100 / (size + 1);
	const fraction = (100 - 2 * inset) / 100;
	const cell = 100 / (size - 1);
	return { inset, fraction, cell, stone: cell * 0.95, hit: cell * 0.95, star: cell * 0.26, last: cell * 0.42, hint: cell * 0.82, territory: cell * 0.34, labelFont: 38 / (size + 1) };
}

/** Line widths in CSS px, from the on-screen distance between two lines. */
export function boardLineWidths(cellPx: number): { inner: number; edge: number } {
	const inner = cellPx >= 34 ? 1.5 : cellPx >= 22 ? 1.25 : 1;
	return { inner, edge: inner + 1 };
}

/**
 * Touch boards under this spacing get a two-step placement. 32px is a little above the
 * 24px minimum target size of WCAG 2.2 (2.5.8), since neighbouring points share every edge.
 */
export const CONFIRM_BELOW_CELL_PX = 32;

export function nearestPoint(size: BoardSize, offsetX: number, offsetY: number, gridWidth: number, gridHeight: number): Point | null {
	if (gridWidth <= 0 || gridHeight <= 0) return null;
	const cellX = gridWidth / (size - 1);
	const cellY = gridHeight / (size - 1);
	const x = Math.round(offsetX / cellX);
	const y = Math.round(offsetY / cellY);
	if (x < 0 || y < 0 || x >= size || y >= size) return null;
	// Ignore touches far outside the outermost lines (e.g. on the coordinate margin).
	if (Math.abs(offsetX / cellX - x) > 0.6 || Math.abs(offsetY / cellY - y) > 0.6) return null;
	return { x, y };
}

export function boardStars(size: BoardSize): Point[] {
	const points = size === 19
		? [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]]
		: size === 13 ? [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]] : [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
	return points.map(([x, y]) => ({ x, y }));
}

export function stoneAppearance(style: StoneStyle, color: Color, darkBoard = false) {
	// On a dark board a black stone needs a light rim, or it melts into the wood.
	if (darkBoard && color === 'black' && style !== 'avatar') {
		const base = stoneAppearance(style, color);
		return { background: base.background, shadow: `inset 0 0 0 1.5px rgba(255, 255, 255, .55), ${base.shadow === 'none' ? '0 0 0 0 transparent' : base.shadow}` };
	}
	if (style === 'flat') return color === 'black'
		? { background: '#221d19', shadow: 'none' }
		: { background: '#faf7f4', shadow: 'inset 0 0 0 1.5px #221d19' };
	if (style === 'avatar') {
		const background = color === 'black' ? '#5c7c8a' : '#c9772f';
		return { background: `linear-gradient(135deg, ${background}, color-mix(in srgb, ${background} 55%, #000))`, shadow: `inset 0 0 0 max(2px, 0.5cqi) ${color === 'black' ? '#0b0a09' : '#faf7f4'}, 0 1px 2px rgba(0,0,0,.35)` };
	}
	return color === 'black'
		? { background: 'radial-gradient(circle at 36% 30%, #6a6560 0%, #2a2725 38%, #0b0a09 100%)', shadow: '0 1px 2px rgba(0,0,0,.45)' }
		: { background: 'radial-gradient(circle at 36% 30%, #ffffff 0%, #f3efe8 45%, #c9c1b3 100%)', shadow: 'inset 0 0 0 1px rgba(34, 29, 25, .28), 0 1px 2px rgba(0,0,0,.35)' };
}

export function boardPointLabel(size: BoardSize, point: Point, stone: Stone, options: { dead?: boolean; last?: boolean; number?: number } = {}): string {
	const parts = [toDisplayPoint(point, size), stone === null ? '空き' : stone === 'black' ? '黒' : '白'];
	if (options.dead) parts.push('死石の印');
	if (options.last) parts.push('最終手');
	if (options.number !== undefined) parts.push(`${options.number}手目`);
	return parts.join('、');
}

/** Arrow movement clamps to the edge, so it never wraps into another row. */
export function moveBoardFocus(size: BoardSize, point: Point, key: string): Point {
	if (!isOnBoard(size, point)) throw new RangeError('Focus outside board');
	const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
	const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
	return { x: Math.max(0, Math.min(size - 1, point.x + dx)), y: Math.max(0, Math.min(size - 1, point.y + dy)) };
}
