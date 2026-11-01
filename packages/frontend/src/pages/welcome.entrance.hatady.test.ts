/* SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, h } from 'vue';
import { parse as parseCss } from 'postcss';
import { describe, expect, test } from 'vitest';
import WelcomeHatadyHeading from './welcome.entrance.hatady-heading.vue';
import WelcomeHataskHeading from './welcome.entrance.hatask-heading.vue';
import type { Component } from 'vue';
import type { Root, Rule } from 'postcss';

// Component DOM and source contracts, not browser font or animation measurements.
const css = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.hataskey.css'), 'utf8');
const previewCss = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.previews.css'), 'utf8');
const globalScss = readFileSync(resolve(process.cwd(), 'src/style.scss'), 'utf8');
const scope = '[data-hataskey-entrance]';
const homeIcon = `${scope} .symbol-home .symbol-icon>i`;
const homeGlyph = `${homeIcon}::before`;

function declarations(rule: Rule): Record<string, string> {
	const result: Record<string, string> = {};
	// The SCSS .ti block has a nested pseudo-element. Keep its font size separate
	// from the element's font size instead of folding both into one declaration.
	for (const node of rule.nodes) {
		if (node.type === 'decl') result[node.prop] = node.value;
	}
	return result;
}

function styleFor(styles: Root, selector: string): Record<string, string> {
	const matches: Rule[] = [];
	styles.walkRules(rule => {
		if (rule.selectors.includes(selector)) matches.push(rule);
	});
	assert.ok(matches.length <= 1, `${selector} must not acquire state-dependent geometry`);
	if (!matches.length) return {};
	assert.equal(matches[0].parent?.type, 'root', `${selector} must apply at every viewport size and animation state`);
	return declarations(matches[0]);
}

function nativeIconStyles(): { icon: Record<string, string>; glyph: Record<string, string> } {
	const block = globalScss.match(/^\.ti\s*\{[\s\S]*?^\}/m)?.[0];
	assert.ok(block, 'native .ti source must be inspected, not an isolated mock stylesheet');
	const styles = parseCss(block);
	const icon = styles.nodes.find((node): node is Rule => node.type === 'rule' && node.selector === '.ti');
	assert.ok(icon);
	const glyph = icon.nodes.find((node): node is Rule => node.type === 'rule' && node.selector === '&::before');
	assert.ok(glyph, 'native pseudo-element scaling must be included in this regression check');
	return { icon: declarations(icon), glyph: declarations(glyph) };
}

function inEm(value: string, inheritedEm: number): number {
	const match = value.match(/^(\d*\.?\d+)(em|%)$/);
	assert.ok(match, `unexpected icon sizing expression: ${value}`);
	return Number(match[1]) * inheritedEm / (match[2] === '%' ? 100 : 1);
}

function headingIconMetrics(stylesSource: string, iconSelector = homeIcon): { boxWidth: number; glyphEm: number } {
	const styles = parseCss(stylesSource);
	const native = nativeIconStyles();
	// These selectors deliberately increase in specificity: .ti, the ordinary
	// welcome symbol, then the heading-specific reset. Source order is irrelevant.
	const icon = {
		...native.icon,
		...styleFor(styles, `${scope} .symbol-icon>i`),
		...styleFor(styles, iconSelector),
	};
	const glyph = { ...native.glyph, ...styleFor(styles, `${iconSelector}::before`) };
	const iconEm = inEm(icon['font-size'], 1);
	return {
		boxWidth: inEm(icon.width, iconEm),
		glyphEm: inEm(glyph['font-size'], iconEm),
	};
}

function assertSingleCharacterIcon(stylesSource: string, iconSelector = homeIcon): void {
	const { boxWidth, glyphEm } = headingIconMetrics(stylesSource, iconSelector);
	assert.ok(boxWidth <= 1, `icon element exceeds the one-character text slot: ${boxWidth}em`);
	assert.ok(glyphEm <= 1, `Tabler pseudo-element exceeds the one-character text slot: ${glyphEm}em`);
}

function withoutRule(selector: string): string {
	const styles = parseCss(css);
	let removed = false;
	styles.walkRules(rule => {
		if (!rule.selectors.includes(selector)) return;
		rule.remove();
		removed = true;
	});
	assert.ok(removed, `positive control must actually remove ${selector}`);
	return styles.toString();
}

function heading(component: Component): HTMLElement {
	const host = window.document.createElement('div');
	const app = createApp({ render: () => h(component) });
	app.mount(host);
	const clone = host.cloneNode(true) as HTMLElement;
	app.unmount();
	return clone;
}

describe('Current welcome heading and Hatady theme contracts', () => {
	test('ホームのアイコンを1emに保ち、本体128%との二重拡大を防ぐ', () => {
		assertSingleCharacterIcon(css);
		expect(headingIconMetrics(css)).toEqual({ boxWidth: 1, glyphEm: 1 });
		const home = heading(WelcomeHataskHeading);
		expect(home.querySelector('.symbol-home .symbol-icon > i')?.className).toBe('ti ti-home');
		expect(home.querySelector('[data-symbol-last]')?.textContent).toBe('ホーム');
	});
	test('陽性対照：要素または疑似要素のリセットを外すと拡大を検出する', () => {
		expect(() => assertSingleCharacterIcon(withoutRule(homeIcon))).toThrow('icon element exceeds');
		expect(() => assertSingleCharacterIcon(withoutRule(homeGlyph))).toThrow('Tabler pseudo-element exceeds');
	});
	test('学びは本、趣味は走る人、日々はめくるカレンダーとし、助詞を同じ句に収める', () => {
		const root = heading(WelcomeHatadyHeading);
		const copy = root.querySelector('[data-symbol-lang="ja"]')!;
		expect([...copy.querySelectorAll('.symbol-text')].map(el => el.textContent)).toEqual(['学び', '趣味', '日々']);
		expect([...copy.querySelectorAll('.symbol-phrase')].map(el => el.textContent)).toEqual(['学びも、', '趣味も、', '日々のことも。']);
		expect([...copy.querySelectorAll('[data-motif]')].map(el => el.getAttribute('data-motif'))).toEqual(['book', 'runner', 'calendar']);
		expect(copy.querySelectorAll('svg')).toHaveLength(3);
		expect(copy.querySelectorAll('.welcome-calendar-page')).toHaveLength(2);
		expect(styleFor(parseCss(css), `${scope} .symbol-phrase`)['white-space']).toBe('nowrap');
		for (const keyframe of ['welcome-book-turn', 'welcome-runner-stride', 'welcome-calendar-turn']) expect(previewCss).toContain(`@keyframes ${keyframe}`);
		expect(previewCss).toContain('.welcome-hatady-heading svg *{animation:none!important}');
	});
	test('Hatadyの記録ボタンは本体のテーマ対比色を使い、ライト・ダークとも読める', () => {
		const styles = parseCss(readFileSync(resolve(process.cwd(), 'src/components/hatady-ui.css'), 'utf8'));
		const get = (selector: string) => {
			const values: Record<string, string> = {};
			styles.walkRules(rule => { if (rule.selectors.includes(selector)) Object.assign(values, declarations(rule)); });
			return values;
		};
		const base = get('.hatady-scope');
		const lum = (color: string) => {
			if (color.length === 4) color = '#' + [...color.slice(1)].map(ch => ch + ch).join('');
			const c = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
			return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
		};
		for (const theme of [base, { ...base, ...get('.hatady-scope[data-hatady-theme=\'dark\']') }]) {
			const values = [lum(theme['--hy-accent']), lum(theme['--hy-on-accent'])].sort((a, b) => b - a);
			expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
		}
		const preview = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.hatady-preview.vue'), 'utf8');
		expect(preview).toContain('class="hy-primary"');
		expect(preview).toContain('color: var(--hy-on-accent)');
		expect(preview).not.toContain('background:linear-gradient');
	});
});
