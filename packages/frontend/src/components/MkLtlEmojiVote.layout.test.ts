/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, compileTemplate, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { App, RenderFunction } from 'vue';

const filename = resolve(process.cwd(), 'src/components/MkLtlEmojiVote.vue');
const parsed = parse(readFileSync(filename, 'utf8'), { filename });
type CompiledStyle = Awaited<ReturnType<typeof compileStyleAsync>>;
type Rule = {
	selector: string;
	property: string;
	value: string;
	important: boolean;
	specificity: number;
	order: number;
	reducedMotion: boolean;
	narrow: boolean;
};
type Styles = { classes: Record<string, string>; rules: Rule[] };
type Scenario = { navbar: boolean; width: number; reducedMotion?: boolean };
const scenarios: Scenario[] = [
	{ navbar: false, width: 720 }, { navbar: false, width: 320 },
	{ navbar: true, width: 440 }, { navbar: true, width: 320 },
];
const apps: App[] = [];
const hosts: HTMLElement[] = [];
let actual: Styles;
let oldHorizontal: Styles;
let render: RenderFunction;

/** Only the selectors used by these layout assertions; not a browser CSS engine. */
function specificity(selector: string): number {
	const flat = selector.replace(/:not\((:[\w-]+)\)/gu, '$1');
	const classParts = /\.[\w-]+|\[[^\]]+\]|(?<!:):[\w-]+(?:\([^)]*\))?/gu;
	const classes = flat.match(classParts)?.length ?? 0;
	const types = flat.replace(/::before/gu, ' before').replace(classParts, '').replace(/[\s>*+~]/gu, '');
	if (types && !/^(?:h2|p|i|before)$/u.test(types)) throw new Error(`Unsupported layout selector: ${selector}`);
	return classes * 100 + (types ? 1 : 0);
}

function rulesFrom(style: CompiledStyle, accept: (selector: string) => boolean, offset = 0): Rule[] {
	expect(style.errors).toEqual([]);
	const root = style.rawResult?.root;
	if (!root) throw new Error('SCSS compiler did not produce a PostCSS tree');
	const rules: Rule[] = [];
	root.walkRules(rule => {
		const selectors = rule.selectors.filter(accept);
		if (!selectors.length) return;
		let reducedMotion = false;
		let narrow = false;
		for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
			if (parent.type !== 'atrule') continue;
			if (parent.name === 'media' && parent.params === '(prefers-reduced-motion: reduce)') reducedMotion = true;
			else if (parent.name === 'container' && parent.params === '(max-width: 350px)') narrow = true;
			else throw new Error(`Unsupported layout condition: @${parent.name} ${parent.params}`);
		}
		for (const selector of selectors) {
			const weight = specificity(selector);
			rule.walkDecls(cssDeclaration => {
				rules.push({ selector, property: cssDeclaration.prop, value: cssDeclaration.value, important: !!cssDeclaration.important, specificity: weight, order: offset + rules.length, reducedMotion, narrow });
			});
		}
	});
	return rules;
}

function stylesFrom(style: CompiledStyle, shared: Rule[]): Styles {
	const classes = style.modules;
	if (!classes) throw new Error('Missing production CSS Modules mapping');
	const classNames = ['row', 'clip', 'card', 'state', 'stateCopy', 'symbol', 'waitDots', 'dismiss', 'bodyViewport', 'confetti'].map(name => classes[name]);
	if (classNames.some(name => !name)) throw new Error('Missing production layout class');
	const rules = rulesFrom(style, selector => !selector.includes(':deep(') && classNames.some(name => selector.includes(`.${name}`)), shared.length);
	return { classes, rules: [...shared, ...rules] };
}

function declaration(styles: Styles, element: Element, property: string, scenario: Scenario, pseudo?: 'before'): string | undefined {
	return styles.rules.filter(rule => {
		if (rule.property !== property || (rule.reducedMotion && !scenario.reducedMotion) || (rule.narrow && scenario.width > 350)) return false;
		if (rule.selector.endsWith('::before')) return pseudo === 'before' && element.matches(rule.selector.slice(0, -8));
		return !pseudo && element.matches(rule.selector);
	}).sort((a, b) => Number(a.important) - Number(b.important) || a.specificity - b.specificity || a.order - b.order).at(-1)?.value;
}

function inherited(styles: Styles, element: Element, property: 'color' | 'text-align', scenario: Scenario): string | undefined {
	const value = declaration(styles, element, property, scenario);
	if (value && value !== 'inherit') return value;
	return element.parentElement ? inherited(styles, element.parentElement, property, scenario) : undefined;
}

function required(parent: ParentNode, selector: string): HTMLElement {
	const element = parent.querySelector<HTMLElement>(selector);
	if (!element) throw new Error(`Missing production DOM element: ${selector}`);
	return element;
}

/** Render the production template with inert data. No effects, geometry mocks or network setup. */
function fixture(styles: Styles, scenario: Scenario, contentPhase = 'tallying', leaving = false, motion = true) {
	const host = window.document.createElement('div');
	const effectTarget = window.document.createElement('div');
	window.document.body.append(host, effectTarget);
	hosts.push(host, effectTarget);
	const emoji = { id: 'emoji', name: 'local', url: '/emoji/local.webp', isSensitive: false };
	const noop = () => {};
	const app = Vue.createApp(Vue.defineComponent({
		components: { MkCustomEmoji: Vue.defineComponent({ setup: () => () => Vue.h('span', { 'data-custom-emoji': '' }) }) },
		setup: () => ({
			themeTextColors: {}, phase: leaving ? 'leaving' : contentPhase, contentPhase, motion, navbar: scenario.navbar,
			active: true, submitting: false, canVote: true, isResult: contentPhase === 'result', remaining: 10, bodyHeight: null,
			dismiss: noop, vote: noop, holdBodyHeight: noop, measureBodyHeight: noop, releaseBodyHeight: noop,
			round: { candidates: [emoji], rankings: [{ emoji, rank: 1, count: 1 }], total: 1 }, selectedEmoji: emoji,
			voteError: null, rankLabel: () => '1位', announcement: '', effectTarget, rainFading: false, rainTiles: [], rainImage: '',
		}),
		render,
	}));
	app.config.globalProperties.$style = styles.classes;
	app.mount(host);
	apps.push(app);
	return { root: required(host, `.${styles.classes.row}`), effectTarget };
}

function centeringIssues(styles: Styles, root: HTMLElement, scenario: Scenario): string[] {
	const state = required(root, `.${styles.classes.state}`);
	const copy = required(state, `.${styles.classes.stateCopy}`);
	const symbol = required(state, `.${styles.classes.symbol}`);
	const issues: string[] = [];
	if (declaration(styles, state, 'display', scenario) !== 'flex') issues.push('state does not use the reviewed flex layout');
	if ((declaration(styles, state, 'flex-direction', scenario) ?? 'row') !== 'column') issues.push('state shares horizontal space between icon and copy');
	if (declaration(styles, state, 'align-items', scenario) !== 'center') issues.push('state children are not centered on the cross axis');
	if (declaration(styles, copy, 'width', scenario) !== '100%') issues.push('copy does not span the state width');
	if (inherited(styles, required(copy, 'h2'), 'text-align', scenario) !== 'center') issues.push('heading is not centered inside the copy');
	if (declaration(styles, symbol, 'display', scenario) !== 'grid' || declaration(styles, symbol, 'place-items', scenario) !== 'center') issues.push('shared icon box is not centered inside the symbol');
	return issues;
}

beforeAll(async () => {
	expect(parsed.errors).toEqual([]);
	const style = parsed.descriptor.styles.find(item => item.module && item.lang === 'scss');
	if (!style || !parsed.descriptor.template) throw new Error('Missing production template or module SCSS');
	const oldState = '.state { display: flex; align-items: center; justify-content: center; gap: 15px; padding: 15px 0 7px; text-align: center; }';
	const broken = style.content.replace(/\.state\s*\{[^}]*\}/u, oldState).replace(/(\.stateCopy\s*\{\s*)width:\s*100%;/u, '$1');
	expect(broken).not.toBe(style.content);
	const compile = (source: string) => compileStyleAsync({ source, filename, id: 'ltl-emoji-vote-layout', modules: true, preprocessLang: 'scss' });
	const sharedFilename = resolve(process.cwd(), 'src/style.scss');
	// Compile the actual shared stylesheet. CSS @import URLs remain unrequested text;
	// only its .ti declarations enter this local layout contract.
	const [component, positiveControl, shared] = await Promise.all([
		compile(style.content), compile(broken),
		compileStyleAsync({ source: readFileSync(sharedFilename, 'utf8'), filename: sharedFilename, id: 'shared-icons', preprocessLang: 'scss' }),
	]);
	const iconRules = rulesFrom(shared, selector => selector === '.ti' || selector === '.ti::before');
	expect(iconRules.some(rule => rule.property === 'width')).toBe(true);
	actual = stylesFrom(component, iconRules);
	oldHorizontal = stylesFrom(positiveControl, iconRules);
	const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename, id: 'ltl-emoji-vote-layout', compilerOptions: { mode: 'function', prefixIdentifiers: true, cacheHandlers: false } });
	expect(compiled.errors).toEqual([]);
	render = new Function('Vue', compiled.code)(Vue) as RenderFunction;
}, 30000);

afterEach(() => {
	for (const app of apps.splice(0)) app.unmount();
	for (const host of hosts.splice(0)) host.remove();
});

describe('LTL 絵文字投票の実テンプレートとコンパイル済み CSS の構造契約（実機座標の検証ではない）', () => {
	test.each(scenarios)('navbar=$navbar width=$width: 旧横並びを同じ中央化検出器で拒否する', scenario => {
		const { root } = fixture(oldHorizontal, scenario);
		expect(centeringIssues(oldHorizontal, root, scenario)).toEqual([
			'state shares horizontal space between icon and copy', 'copy does not span the state width',
		]);
	});

	test.each(scenarios)('navbar=$navbar width=$width: 集計のアイコンと本文を同じ中央軸に配置する', scenario => {
		const { root } = fixture(actual, scenario);
		expect(centeringIssues(actual, root, scenario)).toEqual([]);
		const icon = required(root, '.ti-hourglass');
		expect(declaration(actual, icon, 'width', scenario)).toBe('1.28em');
		expect(declaration(actual, icon, 'font-size', scenario, 'before')).toBe('128%');
		const symbol = required(root, `.${actual.classes.symbol}`);
		expect(declaration(actual, symbol, 'width', scenario)).toBe(scenario.navbar ? '36px' : '45px');
		expect(inherited(actual, required(root, `.${actual.classes.stateCopy} h2`), 'color', scenario)).toBe('var(--ltl-emoji-vote-panel-fg, var(--MI_THEME-fg))');
	});

	test.each([false, true])('navbar=%s: 待機の左側絵文字を外し、雨の参照用絵文字を残す', navbar => {
		const scenario = { navbar, width: 320 };
		const waiting = fixture(actual, scenario, 'waiting').root;
		expect(waiting.querySelector(`.${actual.classes.symbol}`)).toBeNull();
		const copy = required(waiting, `.${actual.classes.stateCopy}`);
		expect(declaration(actual, copy, 'width', scenario)).toBe('100%');
		expect(inherited(actual, required(copy, 'h2'), 'text-align', scenario)).toBe('center');
		const rain = fixture(actual, scenario, 'rain').root;
		expect(required(rain, `.${actual.classes.symbol}`).querySelector('[data-custom-emoji]')).not.toBeNull();
	});

	test.each([false, true])('navbar=%s: 閉じるボタンは 44px 四方で共有アイコンを中央に置く', navbar => {
		const scenario = { navbar, width: 320 };
		const { root } = fixture(actual, scenario, 'result');
		const button = required(root, '[data-emoji-vote-dismiss]');
		for (const property of ['width', 'height']) expect(declaration(actual, button, property, scenario)).toBe('44px');
		expect(declaration(actual, button, 'display', scenario)).toBe('grid');
		expect(declaration(actual, button, 'place-items', scenario)).toBe('center');
		expect(declaration(actual, required(button, '.ti-x'), 'width', scenario)).toBe('1.28em');
	});

	test('退場は行と別 DOM の紙吹雪をともにフェードし、動き OFF では遷移を止める', () => {
		for (const [motion, reducedMotion] of [[true, false], [false, false], [true, true]]) {
			const scenario = { navbar: false, width: 320, reducedMotion };
			const { root, effectTarget } = fixture(actual, scenario, 'result', true, motion);
			const canvas = required(effectTarget, `.${actual.classes.confetti}`);
			expect(declaration(actual, root, 'grid-template-rows', scenario)).toBe('0fr');
			expect(declaration(actual, root, 'opacity', scenario)).toBe('0');
			expect(declaration(actual, canvas, 'opacity', scenario)).toBe('0');
			if (motion && !reducedMotion) {
				expect(declaration(actual, root, 'transition', scenario)).toContain('grid-template-rows');
				expect(declaration(actual, canvas, 'transition', scenario)).toMatch(/^opacity 0?\.3s ease$/u);
			} else {
				for (const node of [root, required(root, `.${actual.classes.bodyViewport}`)]) expect(declaration(actual, node, 'transition', scenario)).toBe('none');
				expect(declaration(actual, canvas, 'display', scenario)).toBe('none');
			}
		}
	});
});
