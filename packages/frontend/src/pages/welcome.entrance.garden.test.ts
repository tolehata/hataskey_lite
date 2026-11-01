/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseCss } from 'postcss';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HataskeyWelcomeController } from './welcome.entrance.hataskey.js';
import type { Rule } from 'postcss';

// Exercise the actual controller without mounting unrelated welcome features.
// DOM/source contracts cover the garden rendered by each of the four Hatask
// themes. They do not measure browser layout, font rendering or CSS animation
// smoothness.
const css = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.hataskey.css'), 'utf8');
const nativeCss = readFileSync(resolve(process.cwd(), 'src/style.scss'), 'utf8');
const scope = '[data-hataskey-entrance]';
const themes = ['kisetsu', 'kashin', 'suri', 'hatakyu'] as const;
const modes = ['light', 'dark'] as const;
const variants = themes.flatMap(theme => modes.map(mode => ({ theme, mode })));
const fixtures: { controller: HataskeyWelcomeController; root: HTMLElement }[] = [];

function fixture(theme: typeof themes[number], mode: typeof modes[number], reduced = false) {
	const root = window.document.createElement('div');
	root.dataset.hataskeyEntrance = '';
	root.innerHTML = '<div class="hatask-mock"><div class="hatask-body"></div></div>';
	window.document.body.append(root);
	const mock = root.querySelector<HTMLElement>('.hatask-mock');
	const body = root.querySelector<HTMLElement>('.hatask-body');
	assert.ok(mock && body);
	const controller = new HataskeyWelcomeController();
	controller.rootRef(root);
	controller.hataskRef(mock);
	controller.hataskBodyRef(body);
	controller.theme = theme;
	controller.colorMode = mode;
	controller.deckMotionQuery = { matches: reduced } as MediaQueryList;
	controller.renderHatask();
	fixtures.push({ controller, root });
	const garden = body.querySelector<HTMLElement>('[data-hatask-feature="garden"]');
	assert.ok(garden);
	return { controller, root, body, garden };
}

function actualGardenInvariant(garden: Element, iconName: 'ti-seeding' | 'ti-flower'): HTMLElement {
	const layer = garden.querySelector<HTMLElement>('[data-floweremoji]');
	assert.ok(layer, 'actual garden must own a growth layer');
	const visual = layer.parentElement;
	assert.ok(visual);
	assert.equal(visual.children.length, 2, 'actual garden has exactly one ring and one icon layer');
	assert.equal(visual.querySelectorAll('svg').length, 1);
	assert.equal(visual.querySelector('img'), null, 'the old mascot must not overlap the growth glyph');
	assert.equal(layer.querySelectorAll('i').length, 1, 'actual growth uses only one icon at a time');
	assert.ok(layer.querySelector(`.ti.${iconName}[aria-hidden="true"]`));
	assert.equal(layer.style.position, 'absolute');
	assert.match(layer.style.getPropertyValue('inset'), /^0(?:px)?$/, 'growth layer fills and centers in the progress ring');
	assert.equal(visual.style.position, 'relative');
	return layer;
}

function ruleDeclarations(styles: string, selector: string): Record<string, string> {
	const found: Rule[] = [];
	parseCss(styles).walkRules(rule => {
		if (rule.selectors.includes(selector)) found.push(rule);
	});
	assert.equal(found.length, 1, `${selector} must have one all-state geometry rule`);
	assert.equal(found[0].parent?.type, 'root');
	return Object.fromEntries(found[0].nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
}

function normalizedGlyphInvariant(styles: string, selector: string): void {
	// Positive native evidence: the surrounding app still enlarges normal .ti
	// glyphs. The garden must explicitly opt out without changing other icons.
	const native = nativeCss.match(/^\.ti\s*\{[\s\S]*?^\}/m)?.[0];
	assert.ok(native);
	assert.match(native, /width:\s*1\.28em/);
	assert.match(native, /font-size:\s*128%/);
	const icon = ruleDeclarations(styles, selector);
	const glyph = ruleDeclarations(styles, `${selector}::before`);
	assert.deepEqual(icon, { display: 'block', width: '1em', height: '1em', 'font-size': '1em', 'line-height': '1', 'vertical-align': '0' });
	assert.deepEqual(glyph, { display: 'block', 'font-size': '1em', 'line-height': '1' });
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	for (const { controller, root } of fixtures.splice(0)) {
		controller.cancelHataskFlower();
		root.remove();
	}
	vi.useRealTimers();
});

describe('Hatask garden growth layers', () => {
	test.each(variants)('$theme/$mode: 本体は芽と花を中央の一層で置換し、寸法を保つ', ({ theme, mode }) => {
		const { controller, garden } = fixture(theme, mode);
		const layer = actualGardenInvariant(garden, 'ti-seeding');
		const geometry = layer.parentElement?.getAttribute('style');
		controller.finishHataskFlower();
		expect(actualGardenInvariant(garden, 'ti-flower')).toBe(layer);
		expect(layer.parentElement?.getAttribute('style')).toBe(geometry);
		expect(garden.querySelector<SVGElement>('[data-flowerring]')?.style.strokeDashoffset).toBe('0');
		controller.resetHataskFlower();
		expect(actualGardenInvariant(garden, 'ti-seeding')).toBe(layer);
	});

	test.each(variants)('$theme/$mode: 通常再生は一度だけ開花し、同じ花ノードで安定する', ({ theme, mode }) => {
		const { controller, garden } = fixture(theme, mode);
		const layer = actualGardenInvariant(garden, 'ti-seeding');
		expect(controller.timeouts.size).toBeGreaterThan(0);
		vi.advanceTimersByTime(1600);
		expect(actualGardenInvariant(garden, 'ti-flower')).toBe(layer);
		const flower = layer.querySelector('.ti-flower');
		assert.ok(flower);
		expect(controller.timeouts.size + controller.frames.size).toBe(0);
		vi.advanceTimersByTime(5000);
		expect(actualGardenInvariant(garden, 'ti-flower')).toBe(layer);
		expect(layer.querySelector('.ti-flower')).toBe(flower);
		expect(controller.timeouts.size + controller.frames.size).toBe(0);
	});

	test.each(variants)('$theme/$mode: reduced-motionでは即時開花しアニメーションを残さない', ({ theme, mode }) => {
		const { controller, garden } = fixture(theme, mode, true);
		const layer = actualGardenInvariant(garden, 'ti-flower');
		expect(layer.style.animation).toBe('none');
		expect(controller.timeouts.size + controller.frames.size).toBe(0);
	});

	test.each(modes)('Hatakyu/%s: 上部四つのハタキュショートカットを維持する', mode => {
		const { body } = fixture('hatakyu', mode);
		const shortcuts = [...body.querySelectorAll<HTMLImageElement>('.hatakyu-shortcut img')];
		expect(shortcuts.map(image => image.getAttribute('src'))).toEqual([
			'/client-assets/hatakyu/waving.png',
			'/client-assets/hatakyu/checking-time.png',
			'/client-assets/hatakyu/watering-flower.png',
			'/client-assets/hatakyu/chef-cooking.png',
		]);
	});

	test('陽性対照: 本体の庭への旧画像の再挿入を検出する', () => {
		const { garden } = fixture('hatakyu', 'light');
		const layer = actualGardenInvariant(garden, 'ti-seeding');
		layer.parentElement?.append(window.document.createElement('img'));
		expect(() => actualGardenInvariant(garden, 'ti-seeding')).toThrow(/one ring and one icon layer/);
	});

	test('現存する庭グリフは本体の128%拡大を持ち込まない', () => {
		normalizedGlyphInvariant(css, `${scope} [data-floweremoji]>.ti`);
	});

	test('陽性対照: 現存する庭グリフの局所補正欠落を検出する', () => {
		const selector = `${scope} [data-floweremoji]>.ti`;
		const styles = parseCss(css);
		let removed = false;
		styles.walkRules(rule => {
			if (!rule.selectors.includes(`${selector}::before`)) return;
			rule.remove();
			removed = true;
		});
		expect(removed).toBe(true);
		expect(() => normalizedGlyphInvariant(styles.toString(), selector)).toThrow(/all-state geometry rule/);
	});
});
