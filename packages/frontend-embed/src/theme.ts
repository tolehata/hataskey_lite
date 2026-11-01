/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// TODO: (可能な部分を)sharedに抽出して frontend と共通化

import tinycolor from 'tinycolor2';
import lightTheme from '@@/themes/_light-cherrypick.json5';
import darkTheme from '@@/themes/_dark-cherrypick.json5';
import type { BundledTheme } from 'shiki/themes';

export type Theme = {
	id: string;
	name: string;
	author: string;
	desc?: string;
	base?: 'dark' | 'light';
	props: Record<string, string>;
	codeHighlighter?: {
		base: BundledTheme;
		overrides?: Record<string, any>;
	} | {
		base: '_none_';
		overrides: Record<string, any>;
	};
};

let timeout: number | null = null;

export function assertIsTheme(theme: Record<string, unknown>): theme is Theme {
	return typeof theme === 'object' && theme !== null && 'id' in theme && 'name' in theme && 'author' in theme && 'props' in theme;
}

export function applyTheme(theme: Theme, persist = true) {
	if (timeout) window.clearTimeout(timeout);

	window.document.documentElement.classList.add('_themeChanging_');

	timeout = window.setTimeout(() => {
		window.document.documentElement.classList.remove('_themeChanging_');
	}, 1000);

	const colorScheme = theme.base === 'dark' ? 'dark' : 'light';

	window.document.documentElement.dataset.colorScheme = colorScheme;

	// Deep copy
	const _theme = JSON.parse(JSON.stringify(theme));

	if (_theme.base) {
		const base = [lightTheme, darkTheme].find(x => x.id === _theme.base);
		if (base) _theme.props = Object.assign({}, base.props, _theme.props);
	}

	const props = compile(_theme);

	for (const tag of window.document.head.children) {
		if (tag.tagName === 'META' && tag.getAttribute('name') === 'theme-color') {
			tag.setAttribute('content', props['htmlThemeColor']);
			break;
		}
	}

	for (const [k, v] of Object.entries(props)) {
		window.document.documentElement.style.setProperty(`--MI_THEME-${k}`, v.toString());
	}

	// iframeを正常に透過させるために、cssのcolor-schemeは `light dark;` 固定にしてある。style.scss参照
}

const MAX_THEME_REFERENCE_DEPTH = 8;

function getThemeReferenceColor(theme: Theme, key: string, stack: string[], depth: number): tinycolor.Instance {
	if (depth >= MAX_THEME_REFERENCE_DEPTH) {
		throw new Error('Theme reference limit exceeded');
	}

	if (stack.includes(key)) {
		throw new Error('Theme contains circular references');
	}

	const nextValue = theme.props[key];
	if (typeof nextValue !== 'string') {
		throw new Error(`Theme references missing property: ${key}`);
	}

	return getColor(theme, nextValue, [...stack, key], depth + 1);
}

function getColor(theme: Theme, val: string, stack: string[] = [], depth = 0): tinycolor.Instance {
	if (val[0] === '@') { // ref (prop)
		return getThemeReferenceColor(theme, val.substring(1), stack, depth);
	} else if (val[0] === '$') { // ref (const)
		return getThemeReferenceColor(theme, val, stack, depth);
	} else if (val[0] === ':') { // func
		if (depth >= MAX_THEME_REFERENCE_DEPTH) {
			throw new Error('Theme reference limit exceeded');
		}

		const parts = val.split('<');
		const funcTxt = parts.shift();
		const argTxt = parts.shift();

		if (funcTxt && argTxt) {
			const func = funcTxt.substring(1);
			const arg = parseFloat(argTxt);
			const color = getColor(theme, parts.join('<'), stack, depth + 1);

			switch (func) {
				case 'darken': return color.darken(arg);
				case 'lighten': return color.lighten(arg);
				case 'alpha': return color.setAlpha(arg);
				case 'hue': return color.spin(arg);
				case 'saturate': return color.saturate(arg);
			}
		}
	}

	// other case
	return tinycolor(val);
}

function compile(theme: Theme): Record<string, string> {
	const props = {};

	for (const [k, v] of Object.entries(theme.props)) {
		if (k.startsWith('$')) continue; // ignore const

		props[k] = v.startsWith('"') ? v.replace(/^"\s*/, '') : genValue(getColor(theme, v));
	}

	return props;
}

function genValue(c: tinycolor.Instance): string {
	return c.toRgbString();
}
