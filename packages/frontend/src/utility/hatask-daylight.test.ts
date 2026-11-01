/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { getHataskDaylightStyle } from './hatask-daylight.js';
import type { HataskDaylightMode } from './hatask-daylight.js';

const MODES: HataskDaylightMode[] = ['light', 'dark'];

function localTime(hour: number, minute = 0, second = 0, millisecond = 0): Date {
	return new Date(2026, 8, 5, hour, minute, second, millisecond);
}

function channels(color: string): number[] {
	if (color.startsWith('color-mix(')) return themeChannels(color);
	if (!/^rgb\(\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?\)$/.test(color)) throw new Error(`Invalid RGB color: ${color}`);
	return color.slice(4, -1).split(' ').map(Number);
}

type ThemeColors = { accent: number[]; background: number[] };
const THEME: ThemeColors = { accent: [32, 160, 80], background: [240, 246, 242] };

function themeChannels(color: string, theme: ThemeColors = THEME): number[] {
	const match = /^color-mix\(in srgb, var\(--MI_THEME-accent, var\(--MI_THEME-fg, (#fff|#000)\)\) (\d+(?:\.\d+)?)%, color-mix\(in srgb, var\(--MI_THEME-bg, \1\) 2%, \1\)\)$/.exec(color);
	if (!match) throw new Error(`Invalid theme color: ${color}`);
	const neutral = match[1] === '#fff' ? 255 : 0;
	const weight = Number(match[2]) / 100;
	return theme.accent.map((channel, index) => Number((channel * weight + (theme.background[index] * .02 + neutral * .98) * (1 - weight)).toFixed(6)));
}

function resolved(color: string, theme: ThemeColors): string { return `rgb(${themeChannels(color, theme).join(' ')})`; }

function luminance(color: string): number {
	const rgb = channels(color).map(value => {
		const normalized = value / 255;
		return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
	});
	return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

function contrast(a: string, b: string): number {
	const first = luminance(a);
	const second = luminance(b);
	return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

type Surface = { color: string; alpha: number };

function layoutColors(mode: HataskDaylightMode): { text: string[]; surface: Surface } {
	const source = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
	const selector = mode === 'light' ? '.htk-akatsuki-layout[data-enabled=\'true\'] {' : '.htk-akatsuki-layout[data-enabled=\'true\'][data-mode=\'dark\'] {';
	const block = source.split(selector)[1]?.split('\n}')[0] ?? '';
	const text = ['fg', 'fg-2'].map(name => {
		const hex = block.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6});`, 'i'))?.[1];
		if (!hex) throw new Error(`Missing live Layout ${mode} text token: ${name}`);
		return `rgb(${[1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(' ')})`;
	});
	const surface = block.match(/--surface:\s*rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\s*\);/u);
	if (!surface) throw new Error(`Missing live Layout ${mode} translucent surface token`);
	const rgb = surface.slice(1, 4).map(Number);
	const alpha = Number(surface[4]);
	if (rgb.some(value => !Number.isFinite(value) || value < 0 || value > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error(`Invalid live Layout ${mode} translucent surface token`);
	return { text, surface: { color: `rgb(${rgb.join(' ')})`, alpha } };
}

function composite(background: string, surface: Surface, layers: number): string {
	let result = channels(background);
	const foreground = channels(surface.color);
	for (let layer = 0; layer < layers; layer++) result = result.map((value, index) => foreground[index] * surface.alpha + value * (1 - surface.alpha));
	return `rgb(${result.map(value => Number(value.toFixed(6))).join(' ')})`;
}

describe('暁の時間帯グラデーション', () => {
	test.each(MODES)('%s: 全ペインはピンク固定でなく本体テーマのbg/accentを参照する', mode => {
		const style = getHataskDaylightStyle(localTime(6), mode);
		expect(Object.keys(style)).toHaveLength(10);
		for (const color of Object.values(style)) {
			expect(color).toContain('var(--MI_THEME-accent, var(--MI_THEME-fg,');
			expect(color).toContain('var(--MI_THEME-bg,');
			const rgb = themeChannels(color);
			expect(rgb[1]).toBeGreaterThan(rgb[0]);
			expect(rgb[1]).toBeGreaterThan(rgb[2]);
		}
		const other = { accent: [40, 90, 220], background: [235, 240, 248] };
		const rgb = themeChannels(style['--hak-daylight-start'], other);
		expect(rgb[2]).toBeGreaterThan(rgb[1]);
		expect(rgb).not.toEqual(themeChannels(style['--hak-daylight-start']));
	});

	test.each(MODES)('%s: 夜・朝・昼・夕方は別の配色になる', mode => {
		const colors = [0, 6, 12, 18].map(hour => JSON.stringify(getHataskDaylightStyle(localTime(hour), mode)));
		expect(new Set(colors).size).toBe(4);
	});

	test.each(MODES.flatMap(mode => [0, 6, 12, 18].map(hour => ({ mode, hour }))))('$mode: $hour時の前後で色が急変しない', ({ mode, hour }) => {
		const before = Object.values(getHataskDaylightStyle(localTime(hour, 0, 0, -1), mode));
		const after = Object.values(getHataskDaylightStyle(localTime(hour, 0, 0, 1), mode));
		for (const [index, color] of before.entries()) {
			channels(color).forEach((value, channel) => {
				expect(Math.abs(value - channels(after[index])[channel])).toBeLessThan(.001);
			});
		}
	});

	test.each(MODES)('%s: 時間帯の中間も秒単位で補間される', mode => {
		const dawn = getHataskDaylightStyle(localTime(6), mode);
		const noon = getHataskDaylightStyle(localTime(12), mode);
		const middle = getHataskDaylightStyle(localTime(9), mode);
		channels(middle['--hak-daylight-start']).forEach((value, index) => expect(value).toBeCloseTo((channels(dawn['--hak-daylight-start'])[index] + channels(noon['--hak-daylight-start'])[index]) / 2, 5));
		expect(getHataskDaylightStyle(localTime(9, 0, 30), mode)).not.toEqual(middle);
		expect(getHataskDaylightStyle(localTime(9, 0, 30), mode)).not.toEqual(getHataskDaylightStyle(localTime(9, 1), mode));
	});

	test('旧ダーク昼色と実 surface の二重合成による本文コントラスト不足を検出する', () => {
		const colors = layoutColors('dark');
		expect(colors.surface).toEqual({ color: 'rgb(255 255 255)', alpha: .1 });
		const oldNoon = 'rgb(19 45 58)'; // #132d3a: the regression palette, not the updated production value.
		expect(contrast(oldNoon, colors.text[1])).toBeGreaterThanOrEqual(4.5);
		expect(contrast(composite(oldNoon, colors.surface, 1), colors.text[1])).toBeGreaterThanOrEqual(4.5);
		expect(contrast(composite(oldNoon, colors.surface, 2), colors.text[1])).toBeLessThan(4.5);
	});

	test.each(MODES.flatMap(mode => [
		{ name: 'green', theme: THEME },
		{ name: 'blue', theme: { accent: [40, 90, 220], background: [235, 240, 248] } },
		{ name: 'red-dark', theme: { accent: [255, 40, 60], background: [24, 12, 20] } },
		{ name: 'black-limit', theme: { accent: [0, 0, 0], background: [0, 0, 0] } },
		{ name: 'white-limit', theme: { accent: [255, 255, 255], background: [255, 255, 255] } },
	].map(theme => ({ mode, ...theme }))))('$mode/$name: 全ペインと2層surface合成で実本文のコントラストを保つ', ({ mode, theme }) => {
		const colors = layoutColors(mode);
		const centralBackgrounds = new Set(['--hak-daylight-bg', '--hak-daylight-start', '--hak-daylight-middle', '--hak-daylight-end']);
		// Positive controls ensure malformed channels and insufficient contrast are visible.
		expect(() => channels('rgb(NaN 1 2)')).toThrow('Invalid RGB color');
		expect(contrast('rgb(100 100 100)', 'rgb(100 100 100)')).toBeLessThan(4.5);
		for (let minute = 0; minute < 1440; minute += 15) {
			for (const [property, cssColor] of Object.entries(getHataskDaylightStyle(localTime(0, minute), mode))) {
				const color = resolved(cssColor, theme);
				for (const value of channels(color)) {
					expect(Number.isFinite(value)).toBe(true);
					expect(value).toBeGreaterThanOrEqual(0);
					expect(value).toBeLessThanOrEqual(255);
				}
				// Journal.captureArea -> QuickCapture.pill is the two-surface
				// consumer inside .hak-center. Side panes contain no journal input,
				// so their actual backgrounds are checked with zero/one surface only.
				for (const layers of centralBackgrounds.has(property) ? [0, 1, 2] : [0, 1]) {
					const background = composite(color, colors.surface, layers);
					for (const [index, textColor] of colors.text.entries()) {
						expect(contrast(background, textColor), `${mode} ${minute}分 ${property} surface=${layers}層 ${index === 0 ? '--fg' : '--fg-2'}`).toBeGreaterThanOrEqual(4.5);
					}
				}
			}
		}
	});

	test.each(MODES)('%s: 壊れた日時はユーザーテーマの朝の濃さへフォールバックする', mode => {
		expect(getHataskDaylightStyle(new Date(Number.NaN), mode)).toEqual(getHataskDaylightStyle(localTime(6), mode));
	});

	test('登録色・起動背景にも固定ピンクを残さず、全3ペインへ同じ変数を渡す', () => {
		const layout = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		const page = readFileSync(resolve(process.cwd(), 'src/pages/hatask.vue'), 'utf8');
		expect(layout).toContain('initial-value: transparent;');
		for (const name of ['bg', 'start', 'middle', 'end', 'left-start', 'left-middle', 'left-end', 'right-start', 'right-middle', 'right-end']) expect(layout).toContain(`var(--hak-daylight-${name})`);
		expect(page).toContain(':style="isAkatsuki ? getHataskDaylightStyle(akatsukiNow, themeMode) : undefined"');
		for (const old of ['#ffd9c0', '#ffeef6', '#eaf0ff', '#2c1533']) {
			expect(layout).not.toContain(old);
			const boot = page.split('\n').filter(line => line.includes('.htk-boot{background:linear-gradient(168deg,'));
			expect(boot).toHaveLength(2);
			expect(boot.join('\n')).not.toContain(old);
		}
		expect(() => themeChannels('rgb(255 217 192)')).toThrow('Invalid theme color');
	});

	test('日付ではなくローカル時刻に連動し、深夜の翌日も同じ周期を繰り返す', () => {
		const now = localTime(0);
		expect(getHataskDaylightStyle(localTime(24), 'light')).toEqual(getHataskDaylightStyle(now, 'light'));
		expect(getHataskDaylightStyle(new Date(2026, 11, 31, 18, 24, 10, 500), 'dark')).toEqual(getHataskDaylightStyle(localTime(18, 24, 10, 500), 'dark'));
	});

	test('引数を変更せず、背景以外のテーマ変数や共有された変更可能オブジェクトを返さない', () => {
		const now = localTime(10, 30);
		const timestamp = now.getTime();
		const first = getHataskDaylightStyle(now, 'light');
		const second = getHataskDaylightStyle(now, 'light');
		expect(first).toEqual(second);
		expect(first).not.toBe(second);
		expect(Object.keys(first).every(key => key.startsWith('--hak-daylight-'))).toBe(true);
		expect(now.getTime()).toBe(timestamp);
		first['--hak-daylight-bg'] = 'rgb(0 0 0)';
		expect(getHataskDaylightStyle(now, 'light')).toEqual(second);
	});
});
