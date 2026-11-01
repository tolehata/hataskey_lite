/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { ComputedRef, InjectionKey } from 'vue';
import tinycolor from 'tinycolor2';

// Editors rendered inside UI S can carry the same reactive palette into Teleports.
export const HK3_THEME_CONTEXT: InjectionKey<ComputedRef<Record<string, string>>> = Symbol('hk3-theme');

// Hataskey UI 3 のテーマ色。通常はユーザーのテーマ(アクセント・背景・文字色)から作り、
// テーマが読めないときは下の既定配色(明暗で同じオレンジ系アクセント)を使う。

export type Hk3ThemeMode = 'light' | 'dark';

const LIGHT = {
	'--hk3-bg': '#f7f4f1',
	'--hk3-surface': '#eeeae6',
	'--hk3-text': '#221d19',
	'--hk3-divider': 'color-mix(in srgb, #221d19 40%, transparent)',
	'--hk3-accent': '#e56b0a',
	'--hk3-neutral-100': '#faf7f4',
	'--hk3-neutral-200': '#ede9e5',
	'--hk3-neutral-300': '#dad5d0',
	'--hk3-neutral-400': '#bdb7b1',
	'--hk3-neutral-500': '#9e9892',
	'--hk3-neutral-600': '#807a74',
	'--hk3-neutral-700': '#635e59',
	'--hk3-neutral-800': '#46423e',
	'--hk3-neutral-900': '#2e2b28',
	'--hk3-accent-100': '#fff3e8',
	'--hk3-accent-200': '#ffe2c8',
	'--hk3-accent-300': '#ffc792',
	'--hk3-accent-400': '#ffa55a',
	'--hk3-accent-500': '#ff8a2a',
	'--hk3-accent-600': '#cc5c00',
	'--hk3-accent-700': '#a44a00',
	'--hk3-accent-800': '#763500',
	'--hk3-accent-900': '#4a2408',
	'--hk3-shadow-sm': '0 1px 2px color-mix(in srgb, #2e2b28 14%, transparent)',
	'--hk3-shadow-md': '0 3px 10px color-mix(in srgb, #2e2b28 16%, transparent)',
	'--hk3-shadow-lg': '0 12px 32px color-mix(in srgb, #2e2b28 22%, transparent)',
} as const;

const DARK: Record<keyof typeof LIGHT, string> = {
	'--hk3-bg': '#1c1a18',
	'--hk3-surface': '#242220',
	'--hk3-text': '#e6e1db',
	'--hk3-divider': 'color-mix(in srgb, #e6e1db 26%, transparent)',
	'--hk3-accent': '#d98f56',
	'--hk3-neutral-100': '#201e1c',
	'--hk3-neutral-200': '#2a2725',
	'--hk3-neutral-300': '#353230',
	'--hk3-neutral-400': '#4a4643',
	'--hk3-neutral-500': '#67625e',
	'--hk3-neutral-600': '#86807b',
	'--hk3-neutral-700': '#a49e98',
	'--hk3-neutral-800': '#c3bdb7',
	'--hk3-neutral-900': '#dcd6d0',
	'--hk3-accent-100': '#2c2520',
	'--hk3-accent-200': '#372d26',
	'--hk3-accent-300': '#4c3a2d',
	'--hk3-accent-400': '#7a5638',
	'--hk3-accent-500': '#d98f56',
	'--hk3-accent-600': '#c47d47',
	'--hk3-accent-700': '#e3aa7c',
	'--hk3-accent-800': '#ebbf9b',
	'--hk3-accent-900': '#f2d6bf',
	'--hk3-shadow-sm': '0 0 0 1px color-mix(in srgb, #e6e1db 6%, transparent), 0 1px 2px color-mix(in srgb, #000 45%, transparent)',
	'--hk3-shadow-md': '0 0 0 1px color-mix(in srgb, #e6e1db 8%, transparent), 0 4px 12px color-mix(in srgb, #000 50%, transparent)',
	'--hk3-shadow-lg': '0 0 0 1px color-mix(in srgb, #e6e1db 10%, transparent), 0 14px 36px color-mix(in srgb, #000 60%, transparent)',
};

/** ユーザーのテーマ(Misskey のテーマ設定)から取った基準色。 */
export type Hk3ThemeBase = { accent: string; bg: string; fg: string };

/** 表示中のテーマの基準色を読む。テーマは documentElement に直接置かれている。 */
export function readHk3ThemeBase(): Hk3ThemeBase | null {
	const style = window.document.documentElement.style;
	const accent = style.getPropertyValue('--MI_THEME-accent').trim();
	const bg = style.getPropertyValue('--MI_THEME-bg').trim();
	const fg = style.getPropertyValue('--MI_THEME-fg').trim();
	return accent && bg && fg ? { accent, bg, fg } : null;
}

const mix = (a: string, percent: number, b: string) => `color-mix(in srgb, ${a} ${percent}%, ${b})`;

/**
 * テーマの基準色から UI3 のトークンを作る。段階色は背景・文字色との混色で作るため、
 * 明暗どちらのテーマでも「100〜300 は背景寄りの淡い色、700〜900 は文字寄りの濃い色」になる。
 */
function tokensFromTheme(mode: Hk3ThemeMode, base: Hk3ThemeBase): Record<keyof typeof LIGHT, string> {
	const { accent, bg, fg } = base;
	const fixed = mode === 'dark' ? DARK : LIGHT;
	return {
		...fixed,
		'--hk3-bg': bg,
		'--hk3-surface': mix(fg, mode === 'dark' ? 5 : 5, bg),
		'--hk3-text': fg,
		'--hk3-divider': `color-mix(in srgb, ${fg} ${mode === 'dark' ? 26 : 40}%, transparent)`,
		'--hk3-accent': accent,
		'--hk3-neutral-100': mix(fg, 3, bg),
		'--hk3-neutral-200': mix(fg, 8, bg),
		'--hk3-neutral-300': mix(fg, 16, bg),
		'--hk3-neutral-400': mix(fg, 28, bg),
		'--hk3-neutral-500': mix(fg, 42, bg),
		'--hk3-neutral-600': mix(fg, 55, bg),
		'--hk3-neutral-700': mix(fg, 67, bg),
		'--hk3-neutral-800': mix(fg, 80, bg),
		'--hk3-neutral-900': mix(fg, 90, bg),
		'--hk3-accent-100': mix(accent, mode === 'dark' ? 12 : 10, bg),
		'--hk3-accent-200': mix(accent, mode === 'dark' ? 20 : 20, bg),
		'--hk3-accent-300': mix(accent, 38, bg),
		'--hk3-accent-400': mix(accent, 62, bg),
		'--hk3-accent-500': mix(accent, 88, bg),
		'--hk3-accent-600': mix(accent, 85, fg),
		'--hk3-accent-700': mix(accent, 72, fg),
		'--hk3-accent-800': mix(accent, 55, fg),
		'--hk3-accent-900': mix(accent, 35, fg),
	};
}

/**
 * UI3 の色トークンに加え、UI3 内に表示する既存ページ(設定・通知など)も同じ色で
 * 馴染むよう、主要な MI_THEME 変数をルート要素の範囲だけで上書きする。
 * テーマの基準色が取れればそれに従い、取れないときは UI3 既定の配色を使う。
 * body 直下へテレポートされるポップアップはユーザーのテーマのまま表示される。
 */
export function hk3ThemeStyle(mode: Hk3ThemeMode, base: Hk3ThemeBase | null = null): Record<string, string> {
	const tokens = base ? tokensFromTheme(mode, base) : mode === 'dark' ? DARK : LIGHT;
	const accent = tinycolor(tokens['--hk3-accent']);
	const fallbackAccent = mode === 'dark' ? DARK['--hk3-accent'] : LIGHT['--hk3-accent'];
	const renoteAccent = (accent.isValid() ? accent : tinycolor(fallbackAccent)).complement().toHexString();
	return {
		...tokens,
		'--hk3-renote-accent': renoteAccent,
		'--hk3-renote-bg': mix(renoteAccent, 12, tokens['--hk3-bg']),
		'--hk3-renote-border': mix(renoteAccent, 45, tokens['--hk3-bg']),
		'--hk3-renote-fg': mix(renoteAccent, 20, tokens['--hk3-text']),
		'color-scheme': mode,
		'--MI_THEME-accent': tokens['--hk3-accent'],
		'--MI_THEME-accentedBg': `color-mix(in srgb, ${tokens['--hk3-accent']} 15%, transparent)`,
		'--MI_THEME-bg': tokens['--hk3-bg'],
		'--MI_THEME-fg': tokens['--hk3-text'],
		'--MI_THEME-panel': tokens['--hk3-bg'],
		'--MI_THEME-divider': `color-mix(in srgb, ${tokens['--hk3-text']} 14%, transparent)`,
	};
}
