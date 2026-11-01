/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, beforeEach, describe, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Theme } from '@/theme.js';
import lightTheme from '@@/themes/_light.json5';
import darkTheme from '@@/themes/_dark.json5';

vi.mock('@/i18n.js', () => ({
	i18n: {
		ts: {
			_theme: {
				alreadyInstalled: 'already installed',
				invalid: 'invalid',
			},
		},
	},
	updateI18n: vi.fn(),
}));

vi.mock('@/os.js', () => ({
	alert: vi.fn(),
}));

const cloneTheme = <T>(value: T): T => structuredClone(value);

const createTheme = (base: 'light' | 'dark', options: {
	id: string;
	name: string;
	accent: string;
	bg: string;
	fg: string;
}): Theme => {
	const builtin = base === 'dark' ? darkTheme : lightTheme;

	return {
		id: options.id,
		name: options.name,
		author: 'tester',
		base,
		props: {
			...cloneTheme(builtin.props),
			accent: options.accent,
			bg: options.bg,
			fg: options.fg,
		},
	};
};

const primaryTheme = createTheme('light', {
	id: 'primary-theme',
	name: 'Primary Theme',
	accent: '#224488',
	bg: '#faf7f2',
	fg: '#1a1a1a',
});

const previewTheme = createTheme('dark', {
	id: 'preview-theme',
	name: 'Preview Theme',
	accent: '#55aa33',
	bg: '#101820',
	fg: '#f4f4f4',
});

const replacementTheme = createTheme('dark', {
	id: 'replacement-theme',
	name: 'Replacement Theme',
	accent: '#bb5500',
	bg: '#18110f',
	fg: '#f6e7df',
});

const loadThemeModule = async () => {
	vi.resetModules();
	return await import('@/theme.js');
};

const resetDocument = () => {
	window.localStorage.clear();
	document.head.innerHTML = '<meta name="theme-color" content="#000000">';
	document.documentElement.className = '';
	document.documentElement.removeAttribute('data-color-scheme');
	document.documentElement.style.cssText = '';
	Reflect.deleteProperty(document, 'startViewTransition');
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		value: 'visible',
	});
};

describe('ThemeManager', () => {
	beforeEach(() => {
		resetDocument();
	});

	afterEach(() => {
		window.localStorage.clear();
	});

	test('通常テーマをDOMと端末キャッシュへ適用する', async () => {
		const { applyTheme, compile } = await loadThemeModule();
		const compiled = compile(primaryTheme);

		applyTheme(primaryTheme);

		assert.strictEqual(document.documentElement.dataset.colorScheme, 'light');
		assert.strictEqual(document.documentElement.style.getPropertyValue('--MI_THEME-accent'), compiled.accent);
		assert.strictEqual(document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content'), compiled.htmlThemeColor);
		assert.strictEqual(window.localStorage.getItem('themeId'), primaryTheme.id);
		assert.strictEqual(window.localStorage.getItem('colorScheme'), 'light');
	});

	test('非永続適用はDOMだけを切り替え、現在のキャッシュを保持する', async () => {
		const { applyTheme, compile } = await loadThemeModule();

		applyTheme(primaryTheme);
		const cachedTheme = window.localStorage.getItem('theme');
		const cachedThemeId = window.localStorage.getItem('themeId');

		applyTheme(previewTheme, false);

		assert.strictEqual(document.documentElement.dataset.colorScheme, 'dark');
		assert.strictEqual(document.documentElement.style.getPropertyValue('--MI_THEME-accent'), compile(previewTheme).accent);
		assert.strictEqual(window.localStorage.getItem('theme'), cachedTheme);
		assert.strictEqual(window.localStorage.getItem('themeId'), cachedThemeId);
	});

	test('別の通常テーマを適用するとDOMとキャッシュを更新する', async () => {
		const { applyTheme, compile } = await loadThemeModule();

		applyTheme(primaryTheme);
		applyTheme(replacementTheme);

		assert.strictEqual(document.documentElement.dataset.colorScheme, 'dark');
		assert.strictEqual(document.documentElement.style.getPropertyValue('--MI_THEME-accent'), compile(replacementTheme).accent);
		assert.strictEqual(window.localStorage.getItem('themeId'), replacementTheme.id);
	});

	test('適用済みテーマのキャッシュだけを消去する', async () => {
		const { applyTheme, clearAppliedThemeCache } = await loadThemeModule();

		applyTheme(primaryTheme);
		clearAppliedThemeCache();

		assert.strictEqual(window.localStorage.getItem('theme'), null);
		assert.strictEqual(window.localStorage.getItem('themeId'), null);
		assert.strictEqual(window.localStorage.getItem('themeCachedVersion'), null);
		assert.strictEqual(window.localStorage.getItem('colorScheme'), 'light');
	});

	test('ViewTransitionのready拒否を未処理にせずテーマ変更を完了する', async () => {
		let rejectReady: (reason: DOMException) => void = () => undefined;
		const ready = new Promise<void>((_resolve, reject) => {
			rejectReady = reject;
		});
		const transition = {
			ready,
			finished: Promise.resolve(),
		};
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: vi.fn((update: () => Promise<void>) => {
				void update();
				return transition;
			}),
		});

		const { applyTheme, compile } = await loadThemeModule();
		applyTheme(primaryTheme);
		rejectReady(new DOMException('transition aborted', 'AbortError'));
		await new Promise<void>((resolve) => setTimeout(resolve, 0));

		assert.strictEqual(document.documentElement.style.getPropertyValue('--MI_THEME-accent'), compile(primaryTheme).accent);
		assert.strictEqual(window.localStorage.getItem('themeId'), primaryTheme.id);
		assert.isFalse(document.documentElement.classList.contains('_themeChanging_'));
	});

	test('RouterViewとnavbarもready拒否を消費する', () => {
		for (const relativePath of ['src/components/global/RouterView.vue', 'src/ui/_common_/navbar.vue']) {
			const source = readFileSync(`${process.cwd()}/${relativePath}`, 'utf8');
			assert.match(source, /const transition = window\.document\.startViewTransition/);
			assert.match(source, /void transition\.ready\.catch\(\(\) => undefined\);/);
		}
	});
});
