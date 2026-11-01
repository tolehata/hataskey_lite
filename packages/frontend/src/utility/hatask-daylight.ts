/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type ColorStops = readonly [number, number, number];

interface DaylightPalette {
	background: number;
	canvas: ColorStops;
	left: ColorStops;
	right: ColorStops;
}

export type HataskDaylightMode = 'light' | 'dark';

export type HataskDaylightStyle = {
	'--hak-daylight-bg': string;
	'--hak-daylight-start': string;
	'--hak-daylight-middle': string;
	'--hak-daylight-end': string;
	'--hak-daylight-left-start': string;
	'--hak-daylight-left-middle': string;
	'--hak-daylight-left-end': string;
	'--hak-daylight-right-start': string;
	'--hak-daylight-right-middle': string;
	'--hak-daylight-right-end': string;
};

/** Accent strength at local midnight, dawn, noon and sunset; hues belong to the user's theme. */
const PALETTES: readonly DaylightPalette[] = [
	{ background: 2, canvas: [6, 3, 8], left: [5, 2, 7], right: [7, 3, 6] },
	{ background: 3, canvas: [12, 5, 2], left: [10, 4, 2], right: [11, 5, 3] },
	{ background: 1, canvas: [3, 1, 7], left: [2, 1, 5], right: [3, 2, 6] },
	{ background: 4, canvas: [14, 8, 3], left: [12, 6, 3], right: [13, 7, 4] },
];

/**
 * Pure background-only projection. It never changes the selected light/dark theme.
 * Smoothstep makes both color and its rate continuous at every six-hour boundary,
 * including midnight. Seconds are retained so the caller can update at any cadence.
 * Theme colors remain CSS references, so runtime theme switches also update the
 * gradient without reading or caching DOM colors. Neutral mixing keeps the
 * existing foreground readable even with a custom theme or forced appearance.
 * An invalid clock falls back to dawn strength, not a second clock read.
 */
export function getHataskDaylightStyle(now: Date, mode: HataskDaylightMode): HataskDaylightStyle {
	const hour = Number.isFinite(now.getTime())
		? now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600 + now.getMilliseconds() / 3600000
		: 6;
	const position = hour / 6;
	const phase = Math.floor(position);
	const fraction = position - phase;
	const progress = fraction * fraction * (3 - 2 * fraction);
	const from = PALETTES[phase];
	const to = PALETTES[(phase + 1) % PALETTES.length];
	const neutral = mode === 'dark' ? '#000' : '#fff';
	const base = `color-mix(in srgb, var(--MI_THEME-bg, ${neutral}) 2%, ${neutral})`;
	const color = (start: number, end: number): string => {
		const strength = Number(((start + (end - start) * progress) * (mode === 'dark' ? .5 : 1)).toFixed(6));
		return `color-mix(in srgb, var(--MI_THEME-accent, var(--MI_THEME-fg, ${neutral})) ${strength}%, ${base})`;
	};

	return {
		'--hak-daylight-bg': color(from.background, to.background),
		'--hak-daylight-start': color(from.canvas[0], to.canvas[0]),
		'--hak-daylight-middle': color(from.canvas[1], to.canvas[1]),
		'--hak-daylight-end': color(from.canvas[2], to.canvas[2]),
		'--hak-daylight-left-start': color(from.left[0], to.left[0]),
		'--hak-daylight-left-middle': color(from.left[1], to.left[1]),
		'--hak-daylight-left-end': color(from.left[2], to.left[2]),
		'--hak-daylight-right-start': color(from.right[0], to.right[0]),
		'--hak-daylight-right-middle': color(from.right[1], to.right[1]),
		'--hak-daylight-right-end': color(from.right[2], to.right[2]),
	};
}
