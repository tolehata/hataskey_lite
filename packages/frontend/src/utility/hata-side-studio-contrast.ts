/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataSideRgb = { r: number; g: number; b: number };

export function parseHataSideRgb(value: string): HataSideRgb | null {
	const match = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
	if (!match) return null;
	return {
		r: Math.max(0, Math.min(255, Number(match[1]))),
		g: Math.max(0, Math.min(255, Number(match[2]))),
		b: Math.max(0, Math.min(255, Number(match[3]))),
	};
}

function channelLuminance(channel: number): number {
	const normalized = channel / 255;
	return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function hataSideRelativeLuminance(color: HataSideRgb): number {
	return (0.2126 * channelLuminance(color.r)) + (0.7152 * channelLuminance(color.g)) + (0.0722 * channelLuminance(color.b));
}

export function hataSideContrastRatio(foreground: HataSideRgb, background: HataSideRgb): number {
	const lighter = Math.max(hataSideRelativeLuminance(foreground), hataSideRelativeLuminance(background));
	const darker = Math.min(hataSideRelativeLuminance(foreground), hataSideRelativeLuminance(background));
	return (lighter + 0.05) / (darker + 0.05);
}

export function chooseHataSideReadableText(backgrounds: HataSideRgb[]): { color: '#111111' | '#ffffff'; ratio: number } {
	const candidates = [
		{ color: '#111111' as const, rgb: { r: 17, g: 17, b: 17 } },
		{ color: '#ffffff' as const, rgb: { r: 255, g: 255, b: 255 } },
	];
	return candidates
		.map(candidate => ({ color: candidate.color, ratio: Math.min(...backgrounds.map(background => hataSideContrastRatio(candidate.rgb, background))) }))
		.sort((a, b) => b.ratio - a.ratio)[0];
}

export function inspectHataSideContrast(foregrounds: HataSideRgb[], backgrounds: HataSideRgb[], threshold = 4.5): { low: boolean; minimumRatio: number; recommended: '#111111' | '#ffffff'; recommendedRatio: number } {
	const ratios = foregrounds.flatMap(foreground => backgrounds.map(background => hataSideContrastRatio(foreground, background)));
	const minimumRatio = ratios.length > 0 ? Math.min(...ratios) : Number.POSITIVE_INFINITY;
	const recommendation = chooseHataSideReadableText(backgrounds);
	return {
		low: minimumRatio < threshold,
		minimumRatio,
		recommended: recommendation.color,
		recommendedRatio: recommendation.ratio,
	};
}
