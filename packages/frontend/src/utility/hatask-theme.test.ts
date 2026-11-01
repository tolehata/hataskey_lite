/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { getHataskHatakyuStyle } from './hatask-theme.js';

vi.mock('@/preferences.js', () => ({ prefer: { r: { 'hataBranding.useHatakyu': { value: true } } } }));

const base = resolve(process.cwd(), 'src/components/hatask');
const skins = readFileSync(resolve(base, 'hatask-themes.scss'), 'utf8');
const source = readFileSync(resolve(process.cwd(), 'src/pages/hatask.vue'), 'utf8');
const homeFilename = resolve(process.cwd(), 'src/pages/hatagoes.vue');
const homeStyle = parse(readFileSync(homeFilename, 'utf8')).descriptor.styles.find(style => style.module);
if (!homeStyle) throw new Error('Missing HataGoes module styles');
const layoutSource = readFileSync(resolve(base, 'HataskAkatsukiLayout.vue'), 'utf8');
const pageScopedStyle = parse(source).descriptor.styles.find(style => style.scoped);
if (!pageScopedStyle) throw new Error('Missing page styles');
const pageStyle = pageScopedStyle.content;
const layoutStyle = parse(layoutSource).descriptor.styles[0].content;
let css: string;
let sharedStyles: Awaited<ReturnType<typeof compileStyleAsync>>;
let homeStyles: Awaited<ReturnType<typeof compileStyleAsync>>;
beforeAll(async () => {
	const outputs = await Promise.all([
		compileStyleAsync({ source: skins, filename: resolve(base, 'hatask-themes.scss'), id: 'skins', preprocessLang: 'scss' }),
		compileStyleAsync({ source: pageStyle, filename: 'hatask.vue', id: 'data-v-page', scoped: true, preprocessLang: 'scss' }),
		compileStyleAsync({ source: layoutStyle, filename: 'HataskAkatsukiLayout.vue', id: 'data-v-layout', scoped: true, preprocessLang: 'scss' }),
		compileStyleAsync({ source: homeStyle.content, filename: homeFilename, id: 'hatagoes-shell', modules: true }),
	]);
	for (const result of outputs) expect(result.errors).toEqual([]);
	sharedStyles = outputs[0];
	homeStyles = outputs[3];
	css = outputs.slice(0, 3).map(result => result.code).join('\n');
});

describe('Hatask theme replacement', () => {
	test.each([
		['koke', '#f8fbf4', '#213025', '24px', '#7a8f70', '#819475'],
		['kisetsu', '#fffdf8', '#242018', '6px', '#baae98', '#6c5d46'],
		['kashin', '#fffdf7', '#292231', '22px', '#655347', '#aa94a4'],
		['suri', '#fffdf6', '#20202f', '0px', '#1a1a2e', '#c3b8d0'],
		['hatakyu', '#fdf6e6', '#332b22', '3px', '#b4996d', '#9a7953'],
		['halloween', '#fffaf2', '#231a31', '24px', '#8a6a8a', '#927da5'],
	])('%s uses its new palette through the shared layout in both modes', (theme, light, dark, radius, lightRule, darkRule) => {
		const style = window.document.createElement('style'); style.textContent = css; window.document.head.append(style);
		const root = window.document.createElement('div'); root.className = 'htk-root'; root.dataset.theme = theme; root.setAttribute('data-v-page', '');
		const layout = window.document.createElement('section'); layout.className = 'htk-akatsuki-layout'; layout.dataset.enabled = 'true'; layout.setAttribute('data-v-layout', ''); layout.setAttribute('data-v-page', '');
		root.append(layout); window.document.body.append(root);
		try {
			for (const mode of ['light', 'dark']) {
				root.dataset.mode = mode; layout.dataset.mode = mode;
				const rootTokens = getComputedStyle(root); const tokens = getComputedStyle(layout);
				expect(rootTokens.getPropertyValue('--surface').trim()).toBe(mode === 'light' ? light : dark);
				expect(tokens.getPropertyValue('--surface').trim()).toBe(mode === 'light' ? light : dark);
				expect(tokens.getPropertyValue('--card-radius').trim()).toBe(radius);
				for (const target of [rootTokens, tokens]) {
					expect(target.getPropertyValue('--bg-image')).toContain('-gradient(');
					expect(target.getPropertyValue('--rule2').trim()).toBe(mode === 'light' ? lightRule : darkRule);
				}
				if (mode === 'dark' || theme === 'kashin') expect(rootTokens.getPropertyValue('--on-accent').trim()).not.toBe('#fff');
			}
		} finally { root.remove(); style.remove(); }
	});

	test.each(['light', 'dark'])('苔の%s配色は分離したダイアログにも届き、文字と操作を読み取れる', mode => {
		const contrast = (a: string, b: string) => {
			const luminance = (hex: string) => {
				expect(hex).toMatch(/^#[\da-f]{6}$/iu);
				const rgb = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
					.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
				return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
			};
			const [darker, lighter] = [luminance(a), luminance(b)].sort((x, y) => x - y);
			return (lighter + .05) / (darker + .05);
		};
		expect(contrast('#ffffff', '#accb99')).toBeLessThan(4.5);
		const style = window.document.createElement('style'); style.textContent = css; window.document.head.append(style);
		const host = window.document.createElement('div'); window.document.body.append(host);
		host.innerHTML = `<div class="htk-root"></div><div class="htk-modal-ov"></div><div class="htk-event-details-theme"></div><div class="htk-theme-preview"></div><div class="htk-theme-action"></div><div data-hatask-support></div><div data-hatask-ranking></div><div data-hatask-theme="koke" data-hatask-mode="${mode}"></div>`;
		try {
			for (const element of host.querySelectorAll<HTMLElement>(':scope > div')) {
				element.dataset.theme = 'koke'; element.dataset.mode = mode;
				const tokens = getComputedStyle(element);
				const color = (name: string) => tokens.getPropertyValue(name).trim();
				expect(color('--surface')).toBe(mode === 'light' ? '#f8fbf4' : '#213025');
				const backgrounds = ['--bg', '--surface', '--rail-paper', '--aside-paper'].map(color);
				backgrounds.push(...(color('--bg-image').match(/#[\da-f]{6}/giu) ?? []));
				for (const background of backgrounds) {
					for (const foreground of ['--fg', '--fg-2', '--fg-3']) expect(contrast(color(foreground), background), foreground).toBeGreaterThanOrEqual(4.5);
				}
				for (const [foreground, background] of [['--on-accent', '--accent'], ['--htk-on-ink', '--accent-ink'], ['--on-accent2', '--accent2']]) {
					expect(contrast(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5);
				}
				expect(contrast('#ffffff', color('--hak-badge-bg'))).toBeGreaterThanOrEqual(4.5);
				expect(contrast(color('--accent-ink'), color('--surface'))).toBeGreaterThanOrEqual(3);
				expect(contrast(color('--rule2'), color('--surface'))).toBeGreaterThanOrEqual(3);
			}
		} finally { host.remove(); style.remove(); }
	});

	test.each(['light', 'dark'])('ハロウィンの%s配色はプレビュー・分離ダイアログへ届き、背景別の文字色を保つ', mode => {
		const contrast = (a: string, b: string) => {
			const luminance = (hex: string) => {
				expect(hex).toMatch(/^#[\da-f]{6}$/iu);
				const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
					.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
				return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
			};
			const [darker, lighter] = [luminance(a), luminance(b)].sort((x, y) => x - y);
			return (lighter + .05) / (darker + .05);
		};
		// The orange fill needs dark text; its darker ink variant needs white text.
		expect(contrast('#ffffff', '#e8661c')).toBeLessThan(4.5);
		expect(contrast('#2a1a2e', '#b3470b')).toBeLessThan(4.5);
		const style = window.document.createElement('style'); style.textContent = css; window.document.head.append(style);
		const host = window.document.createElement('div'); window.document.body.append(host);
		host.innerHTML = `<div class="htk-root"></div><div class="htk-modal-ov"></div><div class="htk-event-details-theme"></div><div class="htk-theme-preview"></div><div class="htk-theme-action"></div><div data-hatask-support></div><div data-hatask-ranking></div><div data-hatask-theme="halloween" data-hatask-mode="${mode}"></div>`;
		try {
			for (const element of host.querySelectorAll<HTMLElement>(':scope > div')) {
				element.dataset.theme = 'halloween'; element.dataset.mode = mode;
				const tokens = getComputedStyle(element);
				const color = (name: string) => tokens.getPropertyValue(name).trim();
				expect(color('--surface')).toBe(mode === 'light' ? '#fffaf2' : '#231a31');
				if (mode === 'light') {
					const moonOutline = color('--bg-image').match(/,\s*(#[\da-f]{6}) 12px 13px/iu)?.[1];
					expect(moonOutline).toBeDefined();
					expect(contrast(moonOutline ?? '#ffffff', color('--bg'))).toBeGreaterThanOrEqual(3);
				}
				for (const background of ['--bg', '--surface', '--rail-paper', '--aside-paper']) {
					for (const foreground of ['--fg', '--fg-2', '--fg-3']) expect(contrast(color(foreground), color(background)), `${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
				}
				for (const [foreground, background] of [['--on-accent', '--accent'], ['--htk-on-ink', '--accent-ink'], ['--on-accent2', '--accent2']]) {
					expect(contrast(color(foreground), color(background)), `${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
				}
				expect(contrast('#ffffff', color('--hak-badge-bg'))).toBeGreaterThanOrEqual(4.5);
				expect(contrast(color('--accent-ink'), color('--surface'))).toBeGreaterThanOrEqual(4.5);
				expect(contrast(color('--rule2'), color('--surface'))).toBeGreaterThanOrEqual(3);
				for (const name of ['--candy-1', '--candy-2', '--candy-3']) expect(color(name)).toMatch(/^#[\da-f]{6}$/iu);
			}
		} finally { host.remove(); style.remove(); }
	});

	test('ハロウィンの背景変数は共有画面とプレビューに届き、明色へ戻すと元の値へ切り替わる', () => {
		const style = window.document.createElement('style'); style.textContent = css; window.document.head.append(style);
		const host = window.document.createElement('div'); window.document.body.append(host);
		host.innerHTML = '<div class="htk-root" data-theme="halloween" data-v-page><section class="htk-akatsuki-layout" data-enabled="true" data-v-page data-v-layout></section></div><div class="htk-theme-preview" data-theme="halloween"></div><div data-hatask-theme="halloween"></div>';
		const darkSky = 'radial-gradient(circle at 57% 24px, #ffe9b8 0 13px, #ffcf7a44 14px, transparent 70px), radial-gradient(ellipse at 0% 100%, #6b3fa066, transparent 60%), linear-gradient(180deg, #1e1530, #120c1a)';
		const lightSky = 'radial-gradient(circle at 57% 24px, #fff4c7 0 12px, #96632c 12px 13px, #e7b45a55 14px, transparent 70px), radial-gradient(circle at 88% 0%, #ffd58a80, transparent 32%), radial-gradient(#6b3fa014 1.2px, transparent 1.5px)';
		try {
			for (const mode of ['dark', 'light']) {
				for (const element of host.querySelectorAll<HTMLElement>('*')) {
					element.dataset.mode = mode;
					if (element.hasAttribute('data-hatask-theme')) element.dataset.hataskMode = mode;
				}
				for (const element of host.querySelectorAll<HTMLElement>('*')) {
					const tokens = getComputedStyle(element);
					expect(tokens.getPropertyValue('--bg-image').replace(/\s+/gu, '')).toBe((mode === 'dark' ? darkSky : lightSky).replace(/\s+/gu, ''));
					expect(tokens.getPropertyValue('--bg-size').replace(/\s+/gu, '')).toBe(mode === 'dark' ? 'auto' : 'auto,auto,16px16px');
				}
			}
		} finally { host.remove(); style.remove(); }
	});

	test.each([
		{
			mode: 'dark',
			wideSky: 'radial-gradient(circle at 24% 34px, #ffe9b8 0 16px, #ffcf7a44 17px, transparent 90px), radial-gradient(ellipse at 100% 100%, #6b3fa066, transparent 55%), linear-gradient(180deg, #1e1530, #120c1a)',
			mobileSky: 'radial-gradient(circle at 57% 24px, #ffe9b8 0 13px, #ffcf7a44 14px, transparent 70px), radial-gradient(ellipse at 0% 100%, #6b3fa066, transparent 60%), linear-gradient(180deg, #1e1530, #120c1a)',
			background: '#150f1f',
			size: 'auto',
		},
		{
			mode: 'light',
			wideSky: 'radial-gradient(circle at 24% 34px, #fff4c7 0 15px, #96632c 15px 16px, #e7b45a55 17px, transparent 90px), radial-gradient(circle at 92% 0%, #ffd58a80, transparent 22%), radial-gradient(#6b3fa014 1.2px, transparent 1.5px)',
			mobileSky: 'radial-gradient(circle at 57% 24px, #fff4c7 0 12px, #96632c 12px 13px, #e7b45a55 14px, transparent 70px), radial-gradient(circle at 88% 0%, #ffd58a80, transparent 32%), radial-gradient(#6b3fa014 1.2px, transparent 1.5px)',
			background: '#f7ecdc',
			size: 'auto, auto, 16px 16px',
		},
	])('HataGoesの$mode背景は幅に応じてPC用画像とモバイル用の共有背景を選ぶ', ({ mode, wideSky, mobileSky, background, size }) => {
		const normalize = (value: string) => value.replace(/\s+/gu, '');
		const style = window.document.createElement('style'); style.textContent = `${sharedStyles.code}\n${homeStyles.code}`; window.document.head.append(style);
		const root = window.document.createElement('div'); root.className = homeStyles.modules?.shell ?? '';
		root.dataset.hatagoesRoot = ''; root.dataset.hataskTheme = 'halloween'; root.dataset.hataskMode = mode;
		window.document.body.append(root);
		const baseBackground = { prop: 'background', value: normalize('var(--bg-image, none), var(--bg, var(--MI_THEME-bg))'), important: false };
		const matchingBackgrounds = () => {
			const declarations: { prop: string; value: string; important: boolean }[] = [];
			for (const compiled of [sharedStyles, homeStyles]) {
				const stylesheet = compiled.rawResult?.root;
				if (!stylesheet) throw new Error('Missing compiled background styles');
				stylesheet.walkRules(rule => {
					if (rule.parent?.type !== 'root') return;
					const backgrounds = rule.nodes.filter(node => node.type === 'decl' && (node.prop === 'background' || node.prop === 'background-image'));
					if (!backgrounds.length || !rule.selectors.some(selector => root.matches(selector))) return;
					for (const declaration of backgrounds) {
						if (declaration.type === 'decl') declarations.push({ prop: declaration.prop, value: normalize(declaration.value), important: !!declaration.important });
					}
				});
			}
			return declarations;
		};
		try {
			expect(root.className).not.toBe('');
			for (const narrow of ['false', 'true', 'false']) {
				root.dataset.narrow = narrow;
				const computed = getComputedStyle(root);
				expect(normalize(computed.getPropertyValue('--bg-image'))).toBe(normalize(mobileSky));
				expect(computed.getPropertyValue('--bg').trim()).toBe(background);
				expect(normalize(computed.backgroundSize)).toBe(normalize(size));
				if (narrow === 'false') {
					expect(matchingBackgrounds()).toEqual([baseBackground, { prop: 'background-image', value: normalize(wideSky), important: false }]);
					expect(normalize(computed.backgroundImage)).toBe(normalize(wideSky));
				} else {
					// happy-dom drops the valid multi-image + color shorthand. Inspect the
					// matching declarations and resolved image token instead of claiming a rendered result.
					expect(matchingBackgrounds()).toEqual([baseBackground]);
					const imageProbe = window.document.createElement('div');
					imageProbe.style.backgroundImage = computed.getPropertyValue('--bg-image');
					expect(normalize(imageProbe.style.backgroundImage)).toBe(normalize(mobileSky));
				}
			}
			root.dataset.hataskTheme = 'koke';
			expect(matchingBackgrounds()).toEqual([baseBackground]);
		} finally { root.remove(); style.remove(); }
	});

	test('old dedicated layouts and page swipes are removed while the saved IDs remain', () => {
		const template = parse(source).descriptor.template?.content;
		if (!template) throw new Error('Missing page template');
		expect(template).toContain(':enabled="true"');
		const hasLegacy = (value: string) => /\b(?:o1[abdk]|hk-panels|hk-wind|htkTouchStart)\b/u.test(value);
		expect(hasLegacy(`${source}\n<div class="o1k"/>`)).toBe(true);
		expect(hasLegacy(source)).toBe(false);
		expect(template.match(/<HataskAkatsukiLayout\b/gu)).toHaveLength(1);
		expect(source).toContain('settings.value = { ...defaultSettings, ...settings.value }');
	});

	test('all production home and navigation icons receive existing Hatakyu illustrations', async () => {
		const art = readFileSync(resolve(base, 'hatask-hatakyu.scss'), 'utf8');
		const compiled = await compileStyleAsync({ source: art, filename: 'hatask-hatakyu.scss', id: 'art', preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		const icons = [...new Set([...layoutSource.slice(0, layoutSource.indexOf('const recordActions:')).matchAll(/icon: 'ti (ti-[\w-]+)'/gu), ...readFileSync(resolve(process.cwd(), 'src/utility/hatask-akatsuki.ts'), 'utf8').matchAll(/icon: 'ti (ti-[\w-]+)'/gu)].map(match => match[1]))];
		const root = window.document.createElement('div'); root.className = 'htk-root'; root.dataset.theme = 'hatakyu';
		const button = window.document.createElement('button'); button.className = 'hak-focus-option'; root.append(button);
		const icon = window.document.createElement('i'); button.append(icon);
		const stylesheet = compiled.rawResult?.root;
		if (!stylesheet) throw new Error('Missing compiled illustration styles');
		const covered = (name: string) => {
			icon.className = `ti ${name}`;
			const stickers: string[] = []; const painted: string[] = [];
			stylesheet.walkRules(rule => {
				if (!rule.selector.includes('::after') && rule.selectors.some(selector => icon.matches(selector))) rule.walkDecls('--hatakyu-sticker', decl => { stickers.push(decl.value); });
				if (rule.selector.includes('::after') && rule.selectors.some(selector => icon.matches(selector.replace('::after', '')))) painted.push(rule.selector);
			});
			return painted.length > 0 && stickers.some(value => value.startsWith('var(--hatakyu-'));
		};
		expect(covered('ti-unknown-positive-control')).toBe(false);
		for (const name of icons) expect(covered(name), name).toBe(true);
		const assets = getHataskHatakyuStyle();
		for (const value of Object.values(assets)) {
			const path = String(value).match(/^url\("\/client-assets\/(hatakyu\/[^"?]+)"\)$/u)?.[1];
			if (!path) throw new Error(`Invalid asset URL: ${String(value)}`);
			expect(existsSync(resolve(process.cwd(), 'assets', path)), path).toBe(true);
		}
	});
});
