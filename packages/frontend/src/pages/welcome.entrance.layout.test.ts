/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseCss } from 'postcss';
import { describe, expect, test } from 'vitest';
import { createApp, h } from 'vue';
import WelcomeHatadyHeading from './welcome.entrance.hatady-heading.vue';
import WelcomeHataskHeading from './welcome.entrance.hatask-heading.vue';
import type { Component } from 'vue';
import type { AtRule, Document, Root, Rule } from 'postcss';

// Source/DOM contracts only: these assertions do not measure rendered line boxes,
// browser layout, pixel positions, or the visual smoothness of an animation.
const sourcePath = resolve(process.cwd(), 'src/pages/welcome.entrance.hataskey.vue');
function headingMarkup(component: Component): string {
	const host = window.document.createElement('div');
	const app = createApp({ render: () => h(component) });
	app.mount(host);
	const markup = host.innerHTML;
	app.unmount();
	return markup;
}
const source = readFileSync(sourcePath, 'utf8').replace('<WelcomeHatadyHeading/>', headingMarkup(WelcomeHatadyHeading)).replace('<WelcomeHataskHeading/>', headingMarkup(WelcomeHataskHeading));
const css = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.hataskey.css'), 'utf8');
const scope = '[data-hataskey-entrance]';
const geometryProperty = /^(?:position|display|float|clear|inset(?:-.+)?|top|right|bottom|left|(?:min-|max-)?(?:width|height|inline-size|block-size)|margin(?:-.+)?|padding(?:-.+)?|border(?:-.+)?|line-height|vertical-align|font(?:-.+)?|letter-spacing|white-space|grid(?:-.+)?|place(?:-.+)?|align(?:-.+)?|justify(?:-.+)?)$/;

function parseTemplate(markup: string): DocumentFragment {
	const parsed = parseSfc(markup, { filename: sourcePath });
	if (parsed.errors.length > 0) throw new Error(`welcome SFC must parse without errors (actual: ${parsed.errors.length})`);
	assert.ok(parsed.descriptor.template, 'welcome SFC must contain a template');
	const template = window.document.createElement('template');
	template.innerHTML = parsed.descriptor.template.content;
	return template.content;
}

function conditions(rule: Rule): { name: string; params: string }[] {
	const result: { name: string; params: string }[] = [];
	for (let parent: AtRule | Document | Root | Rule | undefined = rule.parent; parent; parent = parent.parent) {
		if (parent.type !== 'atrule') continue;
		const atRule = parent as AtRule;
		result.push({ name: atRule.name, params: atRule.params });
	}
	return result;
}

function baseRule(styles: Root, className: string): Rule {
	const matches: Rule[] = [];
	styles.walkRules(rule => {
		if (conditions(rule).length === 0 && rule.selectors.includes(`${scope} .${className}`)) matches.push(rule);
	});
	assert.equal(matches.length, 1, `expected one base rule for ${className}`);
	return matches[0];
}

function declarations(rule: Rule): Record<string, string> {
	const result: Record<string, string> = {};
	rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
	return result;
}

function exactRule(styles: Root, selector: string, expectedConditions: { name: string; params: string }[] = []): Rule {
	const normalized = expectedConditions.map(condition => ({ ...condition, params: condition.params.replace(/\s+/g, '') }));
	const matches: Rule[] = [];
	styles.walkRules(rule => {
		if (!rule.selectors.includes(selector)) return;
		const context = conditions(rule).map(condition => ({ ...condition, params: condition.params.replace(/\s+/g, '') }));
		if (JSON.stringify(context) === JSON.stringify(normalized)) matches.push(rule);
	});
	assert.equal(matches.length, 1, `expected one rule for ${selector} in ${JSON.stringify(normalized)}`);
	return matches[0];
}

function assertFediverseDisclosure(markup: string, stylesSource: string): void {
	const template = parseTemplate(markup);
	const section = template.querySelector('#fediverse');
	assert.ok(section, 'Fediverse section must exist');
	assert.ok(!section.querySelector('[data-fediverse-connection-note],.fediverse-connection-note,.fediverse-map-footer'), 'deleted reciprocal-interaction copy must not remain in the DOM');
	assert.ok(!section.outerHTML.includes('別のサーバーにいる人の投稿を見たり、フォローや返信でお互いにやり取りできます。'), 'deleted Japanese reciprocal-interaction copy must not remain in attributes');
	assert.ok(!section.outerHTML.includes('Read posts by people on other servers, follow each other, and exchange replies.'), 'deleted English reciprocal-interaction copy must not remain in attributes');

	const status = template.querySelector('.federation-status-notice');
	assert.ok(status, 'alternative federation status must exist');
	assert.ok(!status.querySelector('a'), 'top federation status must not retain an explanation link');
	const statusCopy = status.querySelector('[data-federation-status-copy]');
	assert.ok(statusCopy);
	assert.equal(statusCopy.querySelectorAll(':scope > span').length, 2);
	assert.equal(statusCopy.querySelectorAll(':scope > [data-federation-status-copy-wide]').length, 1);
	assert.equal(statusCopy.querySelectorAll(':scope > [data-federation-status-copy-compact]').length, 1);

	const disclosure = section.querySelector('.fediverse-primer-disclosure');
	const toggle = disclosure?.querySelector('[data-fediverse-primer-toggle]');
	const panel = disclosure?.querySelector('[data-fediverse-primer-panel]');
	assert.ok(disclosure && toggle && panel, 'mail analogy must be one accessible disclosure');
	assert.equal(disclosure.getAttribute('data-fediverse-primer-state'), 'closed');
	assert.equal(toggle.tagName, 'BUTTON');
	assert.equal(toggle.id, 'fediverse-primer-toggle');
	assert.equal(toggle.getAttribute('aria-expanded'), 'false');
	assert.equal(toggle.getAttribute('aria-controls'), panel.id);
	assert.equal(toggle.textContent.trim(), '連合って？');
	assert.equal(toggle.querySelector(':scope > span')?.getAttribute('data-en'), 'What is federation?');
	assert.equal(panel.getAttribute('role'), 'region');
	assert.equal(panel.getAttribute('aria-labelledby'), toggle.id);
	assert.equal(panel.getAttribute('aria-hidden'), 'true');
	assert.ok(panel.querySelector('.fediverse-primer-collapse-inner > .fediverse-primer'));

	const styles = parseCss(stylesSource);
	const notice = declarations(baseRule(styles, 'federation-status-notice'));
	assert.equal(notice.display, 'flex');
	assert.equal(notice['justify-content'], 'center');
	assert.equal(notice['flex-wrap'], 'nowrap');
	const statusParagraph = declarations(exactRule(styles, `${scope} .federation-status-notice>p`));
	assert.equal(statusParagraph['text-align'], 'center');
	assert.equal(statusParagraph['white-space'], 'nowrap');
	assert.equal(statusParagraph['text-wrap'], 'nowrap');
	assert.equal(declarations(exactRule(styles, `${scope} [data-federation-status-copy-compact]`)).display, 'none');
	const mobile = [{ name: 'container', params: 'hataskey-entrance (max-width:620px)' }];
	assert.equal(declarations(exactRule(styles, `${scope} [data-federation-status-copy-wide]`, mobile)).display, 'none');
	assert.equal(declarations(exactRule(styles, `${scope} [data-federation-status-copy-compact]`, mobile)).display, 'inline');
	assert.ok(!stylesSource.includes('.federation-status-notice a'), 'removed status-link styles must not remain');

	const disclosureStyle = declarations(baseRule(styles, 'fediverse-primer-disclosure'));
	assert.equal(disclosureStyle.display, 'grid');
	assert.equal(disclosureStyle['margin-top'], '64px');
	assert.equal(disclosureStyle['padding-top'], '20px');
	assert.equal(disclosureStyle['border-top'], '1px solid var(--divider)');
	const toggleStyle = declarations(baseRule(styles, 'fediverse-primer-toggle'));
	assert.equal(toggleStyle.display, 'inline-flex');
	assert.equal(toggleStyle['justify-self'], 'center');
	assert.equal(toggleStyle['min-height'], '44px');
	assert.equal(toggleStyle.border, '0');
	const collapse = declarations(baseRule(styles, 'fediverse-primer-collapse'));
	assert.equal(collapse.display, 'grid');
	assert.equal(collapse['grid-template-rows'], '0fr');
	assert.equal(collapse.visibility, 'hidden');
	assert.equal(collapse['pointer-events'], 'none');
	assert.match(collapse.transition, /grid-template-rows/);
	const expanded = declarations(exactRule(styles, `${scope} .fediverse-primer-disclosure[data-fediverse-primer-state="open"] .fediverse-primer-collapse`));
	assert.equal(expanded['grid-template-rows'], '1fr');
	assert.equal(expanded.visibility, 'visible');
	assert.equal(expanded['pointer-events'], 'auto');
	const collapseInner = declarations(baseRule(styles, 'fediverse-primer-collapse-inner'));
	assert.equal(collapseInner['min-height'], '0');
	assert.equal(collapseInner.overflow, 'hidden');
	const reduced = [{ name: 'media', params: '(prefers-reduced-motion:reduce)' }];
	const reducedCollapse = exactRule(styles, `${scope} .fediverse-primer-collapse`, reduced);
	const reducedToggle = exactRule(styles, `${scope} .fediverse-primer-toggle>i`, reduced);
	for (const rule of [reducedCollapse, reducedToggle]) {
		const transition = rule.nodes.find(node => node.type === 'decl' && node.prop === 'transition');
		assert.ok(transition && transition.type === 'decl');
		assert.equal(transition.value, 'none');
		assert.equal(transition.important, true);
	}
}

function assertServerNameFontFallback(stylesSource: string): void {
	const styles = parseCss(stylesSource);
	const expected = 'Righteous,\'Zen Kaku Gothic New\',\'Hiragino Kaku Gothic ProN\',Meiryo,system-ui,sans-serif';
	for (const className of ['header-identity-word', 'server-name']) {
		const fontFamily = declarations(baseRule(styles, className))['font-family'];
		assert.equal(fontFamily, expected, `${className} must keep Righteous for Latin text and use the existing Japanese sans-serif stack for Kanji`);
		assert.ok(!fontFamily.includes('cursive'), `${className} must not fall back to an environment-dependent cursive font`);
	}
}

function assertHeaderIdentityStaysOnTextLayer(templateSource: string, stylesSource: string): void {
	assert.doesNotMatch(templateSource, /header-identity-platform|identity-face-platform|data-server-name-japanese/u);
	const styles = parseCss(stylesSource);
	assert.equal(declarations(exactRule(styles, `${scope} .identity-face-server`)).animation, undefined);
	const headerFace = declarations(exactRule(styles, `${scope} .header-identity-face`));
	assert.equal(headerFace['will-change'], undefined);
	assert.equal(declarations(exactRule(styles, `${scope} .header-identity-word`)).animation, undefined);
	const headerWord = declarations(exactRule(styles, `${scope} .header-identity-word`));
	assert.equal(headerWord['-webkit-font-smoothing'], 'auto');
	assert.equal(headerWord['text-rendering'], 'optimizeLegibility');
}

function assertDesktopSectionSpacing(stylesSource: string): void {
	const styles = parseCss(stylesSource);
	const desktop = [{ name: 'container', params: 'hataskey-entrance (min-width:821px)' }];
	const mobile = [{ name: 'container', params: 'hataskey-entrance (max-width:820px)' }];
	assert.equal(declarations(exactRule(styles, `${scope} .more-features`, desktop)).padding, '106px 0 112px');
	const hatakyu = exactRule(styles, `${scope} #hatakyu`, desktop);
	const hatakyuPadding = hatakyu.nodes.find(node => node.type === 'decl' && node.prop === 'padding-block');
	assert.ok(hatakyuPadding && hatakyuPadding.type === 'decl');
	assert.equal(hatakyuPadding.value, '120px');
	assert.equal(hatakyuPadding.important, true);
	const join = exactRule(styles, `${scope} .join-section`, desktop);
	for (const [property, value] of [['padding-top', '120px'], ['padding-bottom', 'calc(max(72px,8dvh) + 24px)']] as const) {
		const declaration = join.nodes.find(node => node.type === 'decl' && node.prop === property);
		assert.ok(declaration && declaration.type === 'decl');
		assert.equal(declaration.value, value);
		assert.equal(declaration.important, true);
	}
	assert.equal(declarations(exactRule(styles, `${scope} .more-features`, mobile)).padding, '68px 0 74px');
	assert.equal(declarations(exactRule(styles, `${scope} .join-section`, mobile))['padding-bottom'], 'max(24px,env(safe-area-inset-bottom))');
}

function relativeLuminance(hex: string): number {
	const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	assert.ok(match, `expected a six-digit color, got ${hex}`);
	const channels = match.slice(1).map(value => Number.parseInt(value, 16) / 255)
		.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
	return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function themeDeclarations(styles: Root, selector: string, expectedConditions: { name: string; params: string }[]): Record<string, string> {
	const normalized = expectedConditions.map(condition => ({ ...condition, params: condition.params.replace(/\s+/g, '') }));
	const result: Record<string, string> = {};
	let matches = 0;
	styles.walkRules(rule => {
		if (!rule.selectors.includes(selector)) return;
		const context = conditions(rule).map(condition => ({ ...condition, params: condition.params.replace(/\s+/g, '') }));
		if (JSON.stringify(context) !== JSON.stringify(normalized)) return;
		matches++;
		Object.assign(result, declarations(rule));
	});
	assert.ok(matches > 0, `expected theme rules for ${selector}`);
	return result;
}

function assertFediverseSectionBackground(stylesSource: string): void {
	const styles = parseCss(stylesSource);
	const variants = [
		{ selector: `${scope}[data-color-mode]`, conditions: [] as { name: string; params: string }[], expected: '#f5e4ea' },
		{ selector: `${scope}[data-color-mode="dark"]`, conditions: [] as { name: string; params: string }[], expected: '#2c2028' },
		{ selector: `${scope}[data-color-mode="system"]`, conditions: [{ name: 'media', params: '(prefers-color-scheme:dark)' }], expected: '#2c2028' },
	];
	for (const variant of variants) {
		const theme = themeDeclarations(styles, variant.selector, variant.conditions);
		assert.equal(theme['--fediverseBg'], variant.expected);
		assert.notEqual(theme['--fediverseBg'], theme['--bg'], 'Fediverse needs a section-specific pink surface');
		const ratio = (Math.max(relativeLuminance(theme['--fediverseBg']), relativeLuminance(theme['--fg'])) + .05)
			/ (Math.min(relativeLuminance(theme['--fediverseBg']), relativeLuminance(theme['--fg'])) + .05);
		assert.ok(ratio >= 4.5, `${variant.selector} text contrast is only ${ratio.toFixed(2)}:1`);
	}
	const section = declarations(baseRule(styles, 'fediverse-intro'));
	assert.equal(section.background, 'var(--fediverseBg)');
	assert.equal(section.color, 'var(--fg)');
}

// This deliberately compares source declarations, not a simulated CSS engine.
// All matching symbol rules are inspected, including any responsive override.
// Geometry may not vary between ready/playing/done or reduced-motion states.
function symbolGeometry(styles: Root, element: Element, reduced: boolean): Record<string, string> {
	const result: Record<string, string> = {};
	styles.walkRules(rule => {
		if (!rule.selector.includes('.symbol')) return;
		const context = conditions(rule);
		if (context.some(condition => condition.name.endsWith('keyframes'))) return;
		if (!reduced && context.some(condition => /prefers-reduced-motion\s*:\s*reduce/.test(condition.params))) return;
		if (!rule.selectors.some(selector => element.matches(selector))) return;
		rule.walkDecls(declaration => {
			if (geometryProperty.test(declaration.prop)) result[declaration.prop] = declaration.value;
		});
	});
	const inlineStyle = element.getAttribute('style');
	if (inlineStyle) {
		parseCss(`target{${inlineStyle}}`).walkDecls(declaration => {
			if (geometryProperty.test(declaration.prop)) result[declaration.prop] = declaration.value;
		});
	}
	return result;
}

function assertSymbolLayout(stylesSource: string, markup = source): void {
	const styles = parseCss(stylesSource);
	// Happy DOM may retain matches() results after an ancestor attribute changes
	// in a detached fragment. Each state gets fresh nodes before any CSS matching.
	const variants = ['ready', 'playing', 'done'].map(state => {
		const template = parseTemplate(markup);
		for (const heading of template.querySelectorAll('[data-symbol-heading]')) heading.setAttribute('data-symbol-state', state);
		return { state, swaps: Array.from(template.querySelectorAll('.symbol-swap,.symbol-capsule-swap')) };
	});
	const swaps = variants[0].swaps;
	assert.ok(swaps.length > 0, 'symbol swap targets must exist');
	for (const [index, swap] of swaps.entries()) {
		const heading = swap.closest('[data-symbol-heading]');
		const text = swap.querySelector('.symbol-text,.symbol-capsule-copy');
		const icon = swap.querySelector('.symbol-icon,.symbol-capsule-form');
		assert.ok(heading && text && icon, 'every swap must retain its heading, text and decorative layer');
		const initialSwap = symbolGeometry(styles, swap, false);
		const initialText = symbolGeometry(styles, text, false);
		const initialIcon = symbolGeometry(styles, icon, false);
		assert.equal(initialSwap.position, 'relative', 'text-sized swap must own the decorative layer');
		assert.equal(initialSwap.display, 'inline-block', 'swap must not derive its baseline from a grid icon');
		assert.equal(initialSwap['vertical-align'], 'baseline', 'swap must align with neighboring text');
		assert.equal(initialSwap['white-space'], 'nowrap', 'a symbol word must stay together');
		assert.equal(initialSwap['min-height'], undefined, 'mascot height must not reserve a different line box');
		assert.equal(initialText.display, 'inline-block', 'visible or hidden text must stay in flow');
		assert.equal(initialText.position, undefined, 'text must not be absolutely positioned');
		assert.equal(initialText['line-height'], 'inherit', 'text must keep the surrounding line height');
		assert.equal(initialIcon.position, 'absolute', 'decorative symbols must never determine text geometry');
		assert.equal(initialIcon['min-width'], undefined, 'icon minimum width must not return');
		assert.equal(initialIcon['min-height'], undefined, 'icon minimum height must not return');
		if (icon.classList.contains('symbol-icon')) {
			assert.equal(initialIcon.inset, '0', 'icon must center within the text-sized containing block');
		} else {
			assert.equal(initialIcon['inset-inline'], '0');
			assert.equal(initialIcon.top, '50%');
			assert.equal(initialIcon.height, '.66em');
			assert.equal(initialIcon['margin-top'], '-.33em', 'capsule centering must not compete with transform motion');
		}
		for (const { state, swaps: stateSwaps } of variants) {
			const stateSwap = stateSwaps[index];
			const stateText = stateSwap.querySelector('.symbol-text,.symbol-capsule-copy');
			const stateIcon = stateSwap.querySelector('.symbol-icon,.symbol-capsule-form');
			assert.ok(stateText && stateIcon);
			for (const reduced of [false, true]) {
				assert.deepEqual(symbolGeometry(styles, stateSwap, reduced), initialSwap, `swap geometry must remain stable in ${state}, reduced=${reduced}`);
				assert.deepEqual(symbolGeometry(styles, stateText, reduced), initialText, `text geometry must remain stable in ${state}, reduced=${reduced}`);
				const currentIcon = symbolGeometry(styles, stateIcon, reduced);
				assert.equal(currentIcon.position, 'absolute', 'decorative layer must remain out of flow in every state');
				// Reduced motion may remove only the absolutely-positioned decoration.
				delete currentIcon.display;
				const expectedIcon = { ...initialIcon };
				delete expectedIcon.display;
				assert.deepEqual(currentIcon, expectedIcon, 'decoration geometry must not change when animation finishes');
			}
		}
	}
}

function assertHatadyPhrases(stylesSource: string, markup = source): void {
	const template = parseTemplate(markup);
	const copy = template.querySelector('#hatady h2 .symbol-copy[data-symbol-lang="ja"]');
	assert.ok(copy, 'Japanese Hatady heading must exist');
	const phrases = Array.from(copy.querySelectorAll(':scope > .symbol-phrase'));
	assert.deepEqual(phrases.map(phrase => phrase.textContent), ['学びも、', '趣味も、', '日々のことも。'], 'all three Japanese phrases must keep their particles and punctuation');
	for (const node of Array.from(copy.childNodes)) {
		if (node.nodeName === 'BR') break;
		if (node.nodeType === 8) continue;
		if (node.nodeType === 3 && !node.textContent?.trim()) continue;
		assert.ok(phrases.includes(node as Element), 'no orphaned particle may sit between the phrase wrappers');
	}
	assert.equal(phrases[2].querySelector('[data-symbol-last]')?.textContent, '日々', 'calendar animation and its trailing particle must share a wrapper');
	const phraseStyle = declarations(baseRule(parseCss(stylesSource), 'symbol-phrase'));
	assert.equal(phraseStyle.display, 'inline-block');
	assert.equal(phraseStyle['white-space'], 'nowrap');
}

function assertFooterLayout(stylesSource: string, markup = source): void {
	const styles = parseCss(stylesSource);
	const template = parseTemplate(markup);
	const footer = template.querySelector('.join-acknowledgement');
	assert.ok(footer, 'project acknowledgement footer must exist');
	assert.equal(footer.querySelectorAll('.join-ack-brand,.join-ack-copy,.join-ack-version').length, 3);
	assert.equal(declarations(baseRule(styles, 'join-acknowledgement'))['text-align'], 'center');
	assert.equal(declarations(baseRule(styles, 'join-ack-brand'))['justify-content'], 'center');
	assert.equal(declarations(baseRule(styles, 'join-ack-copy')).margin, '0 auto');
	assert.ok([undefined, 'center'].includes(declarations(baseRule(styles, 'join-ack-version'))['text-align']), 'version must inherit or specify centered text');
	const breaks = footer.querySelectorAll('.join-ack-copy > br.mobile-copy-break');
	assert.equal(breaks.length, 1, 'thanks must have exactly one mobile-only line break');
	assert.equal(breaks[0].previousElementSibling?.textContent, 'HataskeyはCherryPickのフォークで、CherryPickはMisskeyのフォークです。');
	assert.equal(breaks[0].nextElementSibling?.textContent, '両プロジェクトへ深く感謝します。', 'mobile break must be immediately before thanks');
	assert.equal(breaks[0].nextElementSibling.nextElementSibling?.tagName, 'BR', 'the existing final sentence break must remain');
	const breakRules: Rule[] = [];
	styles.walkRules(rule => {
		if (rule.selectors.includes(`${scope} .mobile-copy-break`)) breakRules.push(rule);
	});
	assert.equal(breakRules.length, 2, 'mobile break must have only its base and narrow-container display rules');
	const hiddenRule = breakRules.find(rule => conditions(rule).length === 0);
	const mobileRule = breakRules.find(rule => conditions(rule).length !== 0);
	assert.ok(hiddenRule && mobileRule);
	assert.equal(declarations(hiddenRule).display, 'none', 'desktop must not add the mobile break');
	assert.equal(declarations(mobileRule).display, 'block');
	assert.deepEqual(conditions(mobileRule).map(condition => ({ ...condition, params: condition.params.replace(/\s+/g, '') })), [
		{ name: 'container', params: 'hataskey-entrance(max-width:600px)' },
	], 'the thanks break must be limited to the 600px entrance container');
}

function changeBaseDeclaration(className: string, property: string, value: string): string {
	const styles = parseCss(css);
	const rule = baseRule(styles, className);
	let changed = false;
	rule.walkDecls(property, declaration => {
		declaration.value = value;
		changed = true;
	});
	assert.ok(changed, `positive control must change ${className}.${property}`);
	return styles.toString();
}

function changeConditionalDeclaration(selector: string, expectedConditions: { name: string; params: string }[], property: string, value: string): string {
	const styles = parseCss(css);
	const rule = exactRule(styles, selector, expectedConditions);
	let changed = false;
	rule.walkDecls(property, declaration => {
		declaration.value = value;
		changed = true;
	});
	assert.ok(changed, `positive control must change ${selector}.${property}`);
	return styles.toString();
}

function changeThemeDeclaration(selector: string, expectedConditions: { name: string; params: string }[], property: string, value: string): string {
	const styles = parseCss(css);
	const normalized = expectedConditions.map(condition => ({ ...condition, params: condition.params.replace(/\s+/g, '') }));
	let changed = 0;
	styles.walkRules(rule => {
		if (!rule.selectors.includes(selector)) return;
		const context = conditions(rule).map(condition => ({ ...condition, params: condition.params.replace(/\s+/g, '') }));
		if (JSON.stringify(context) !== JSON.stringify(normalized)) return;
		rule.walkDecls(property, declaration => {
			declaration.value = value;
			changed++;
		});
	});
	assert.equal(changed, 1, `positive control must change one ${selector}.${property}`);
	return styles.toString();
}

function assertDeviceControlsOnly(markup: string): void {
	const template = parseTemplate(markup);
	const controls = template.querySelector('#ui .device-mode-controls');
	assert.ok(controls, 'the preview device controls must remain');
	assert.equal(controls.children.length, 1, 'the removed demo helper must not remain beside the switch');
	assert.deepEqual(Array.from(controls.querySelectorAll('button'), button => button.getAttribute('data-dev')), ['pc', 'mobile']);
	assert.equal(template.querySelector('#ui textarea')?.getAttribute('placeholder'), 'これはデモです。試しに何か書いてみましょう。', 'the composer itself must keep its demo hint');
}

describe('welcome entrance source layout contracts', () => {
	test('連合状態を1行のwide/compact表示に分け、説明を閉じた開閉部へ収める', () => {
		assertFediverseDisclosure(source, css);
	});

	test.each([
		['削除した相互操作文の復活', 'markup', () => source.replace('<div class="fediverse-primer-disclosure"', '<p class="fediverse-connection-note" data-fediverse-connection-note="">別のサーバーにいる人の投稿を見たり、フォローや返信でお互いにやり取りできます。</p><div class="fediverse-primer-disclosure"')],
		['最上部の連合リンクの復活', 'markup', () => source.replace(/(<aside class="federation-status-notice"[\s\S]*?<i class="ti ti-world" aria-hidden="true"><\/i>)/, '$1<a href="#fediverse">連合について</a>')],
		['compact状態文の欠落', 'markup', () => source.replace('data-federation-status-copy-compact=""', 'data-federation-status-copy-wide=""')],
		['説明が最初から展開済み', 'markup', () => source.replace('data-fediverse-primer-state="closed"', 'data-fediverse-primer-state="open"')],
		['状態文の折り返し復活', 'css', () => `${css}\n${scope} .federation-status-notice>p{white-space:normal}`],
		['説明ボタンの左寄せ復活', 'css', () => changeBaseDeclaration('fediverse-primer-toggle', 'justify-self', 'start')],
	] as const)('陽性対照：%sを検出する', (_name, kind, mutate) => {
		const mutated = mutate();
		if (kind === 'css') {
			expect(mutated).not.toBe(css);
			expect(() => assertFediverseDisclosure(source, mutated)).toThrow();
		} else {
			expect(mutated).not.toBe(source);
			expect(() => assertFediverseDisclosure(mutated, css)).toThrow();
		}
	});

	test('動的なサーバー名は英字書体を保ちつつ漢字を角ゴシックへフォールバックする', () => {
		assertServerNameFontFallback(css);
	});

	test('Fediverseセクションはライト・ダークとも専用の淡いピンク背景にする', () => {
		assertFediverseSectionBackground(css);
	});

	test.each([
		['セクション背景の全体色への逆戻り', () => changeBaseDeclaration('fediverse-intro', 'background', 'var(--bg)')],
		['ダーク時の明るいピンク流用', () => changeThemeDeclaration(`${scope}[data-color-mode="dark"]`, [], '--fediverseBg', '#f5e4ea')],
	] as const)('陽性対照：%sを検出する', (_name, mutate) => {
		const mutated = mutate();
		expect(mutated).not.toBe(css);
		expect(() => assertFediverseSectionBackground(mutated)).toThrow();
	});

	test.each([
		['左上サーバー名の明朝フォールバック復活', 'header-identity-word'],
		['ヒーローサーバー名の明朝フォールバック復活', 'server-name'],
	] as const)('陽性対照：%sを検出する', (_name, className) => {
		expect(() => assertServerNameFontFallback(changeBaseDeclaration(className, 'font-family', 'Righteous,cursive'))).toThrow();
	});

	test('左上のサーバー名を固定表示し文字レイヤーのまま保つ', () => {
		assertHeaderIdentityStaysOnTextLayer(source, css);
	});

	test('PCだけMORE HATASKEY・HATAKYU・JOINの上下余白を広げ、モバイル値を保つ', () => {
		assertDesktopSectionSpacing(css);
	});

	test.each([
		['MORE HATASKEYのPC余白復帰', `${scope} .more-features`, 'padding', '82px 0 88px'],
		['HATAKYUのPC余白復帰', `${scope} #hatakyu`, 'padding-block', '96px'],
		['JOINのPC上余白復帰', `${scope} .join-section`, 'padding-top', '96px'],
	] as const)('陽性対照：%sを検出する', (_name, selector, property, value) => {
		const desktop = [{ name: 'container', params: 'hataskey-entrance (min-width:821px)' }];
		expect(() => assertDesktopSectionSpacing(changeConditionalDeclaration(selector, desktop, property, value))).toThrow();
	});

	test('削除した投稿案内を戻さず、端末切り替えと入力欄のヒントを残す', () => {
		assertDeviceControlsOnly(source);
	});

	test('陽性対照：端末切り替えの下に案内文を戻すと検出する', () => {
		const mutated = source.replace('<div class="device-mode-controls">', '<div class="device-mode-controls"><span>ノートを投稿してみてください。3秒カウントダウンも、新着の流れ込みも動きます</span>');
		expect(mutated).not.toBe(source);
		expect(() => assertDeviceControlsOnly(mutated)).toThrow('removed demo helper');
	});

	test('アイコンとカプセルを文字の行ボックスから分離し、全再生状態で文字寸法を保つ', () => {
		assertSymbolLayout(css);
	});

	test('Hatadyの三つの句を保ち、日々と「のことも。」を同じ改行不可の単位に置く', () => {
		assertHatadyPhrases(css);
	});

	test('末尾全体を中央揃えにし、感謝文直前だけ600px以下で改行する', () => {
		assertFooterLayout(css);
	});

	test.each([
		['旧inline-gridの復活', () => changeBaseDeclaration('symbol-swap', 'display', 'inline-grid')],
		['アイコンのインフロー化', () => changeBaseDeclaration('symbol-icon', 'position', 'static')],
		['カプセル図形のインフロー化', () => changeBaseDeclaration('symbol-capsule-form', 'position', 'static')],
		['文字の絶対配置', () => `${css}\n${scope} .symbol-text{position:absolute}`],
		['ハタキュ固有の高さの復活', () => `${css}\n${scope} .symbol-hatakyu{min-height:1.52em}`],
		['アイコン固有の最小幅の復活', () => `${css}\n${scope} .symbol-icon{min-width:1.18em}`],
		['完了時だけの行高変更', () => `${css}\n${scope} [data-symbol-state="done"] .symbol-text{line-height:1}`],
		['reduced-motionだけの高さ変更', () => `${css}\n@media(prefers-reduced-motion:reduce){${scope} .symbol-hatakyu{min-height:1em}}`],
	] as const)('陽性対照：%sを検出する', (_name, mutate) => {
		const mutated = mutate();
		expect(mutated).not.toBe(css);
		expect(() => assertSymbolLayout(mutated)).toThrow();
	});

	test('陽性対照：日々の「のことも。」を句の外へ出すと検出する', () => {
		const mutated = source.replace('日々</span></span>のことも。</span>', '日々</span></span></span>のことも。');
		expect(mutated).not.toBe(source);
		expect(() => assertHatadyPhrases(css, mutated)).toThrow();
	});

	test('陽性対照：句の改行不可を外すと検出する', () => {
		expect(() => assertHatadyPhrases(changeBaseDeclaration('symbol-phrase', 'white-space', 'normal'))).toThrow();
	});

	test('陽性対照：末尾を左揃えへ戻すと検出する', () => {
		expect(() => assertFooterLayout(changeBaseDeclaration('join-acknowledgement', 'text-align', 'left'))).toThrow();
	});

	test('陽性対照：感謝文のモバイル改行を外すと検出する', () => {
		const mutated = source.replace('<br class="mobile-copy-break"><span data-en=" Thank you to both projects.">', '<span data-en=" Thank you to both projects.">');
		expect(mutated).not.toBe(source);
		expect(() => assertFooterLayout(css, mutated)).toThrow();
	});

	test('陽性対照：感謝文の改行を820pxまで広げると検出する', () => {
		const styles = parseCss(css);
		let changed = false;
		styles.walkRules(rule => {
			if (rule.selectors.includes(`${scope} .mobile-copy-break`) && rule.parent?.type === 'atrule') {
				(rule.parent as AtRule).params = 'hataskey-entrance (max-width:820px)';
				changed = true;
			}
		});
		expect(changed).toBe(true);
		expect(() => assertFooterLayout(styles.toString())).toThrow();
	});
});
