/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, compileTemplate, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { App, RenderFunction } from 'vue';

const filename = resolve(process.cwd(), 'src/components/MkSuperMenu.vue');
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename });
const apps: App[] = [];
const hosts: HTMLElement[] = [];
type Rule = { selector: string; property: string; value: string; reducedMotion: boolean };
let rules: Rule[];
let render: RenderFunction;

beforeAll(async () => {
	if (!descriptor.template || !descriptor.styles[0]) throw new Error('Missing production template or styles');
	const template = compileTemplate({ source: descriptor.template.content, filename, id: 'super-menu-indicator', compilerOptions: { mode: 'function', prefixIdentifiers: true } });
	expect(template.errors).toEqual([]);
	render = new Function('Vue', template.code)(Vue) as RenderFunction;
	const styles = await compileStyleAsync({ source: descriptor.styles[0].content, filename, id: 'super-menu-indicator', preprocessLang: 'scss' });
	expect(styles.errors).toEqual([]);
	if (!styles.rawResult?.root) throw new Error('SCSS compiler did not run');
	rules = [];
	styles.rawResult.root.walkRules(rule => {
		if (!rule.selector.includes('icon') && !rule.selector.includes('itemIndicator')) return;
		const reducedMotion = rule.parent?.type === 'atrule' && rule.parent.name === 'media' && rule.parent.params === '(prefers-reduced-motion: reduce)';
		rule.walkDecls(declaration => { rules.push({ selector: rule.selector, property: declaration.prop, value: declaration.value, reducedMotion }); });
	});
});

afterEach(() => {
	for (const app of apps.splice(0)) app.unmount();
	for (const host of hosts.splice(0)) host.remove();
});

function mount({ grid = false, search = false, branding = false, indicated = true } = {}) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	hosts.push(host);
	const base = { text: '登録申請管理', icon: 'ti ti-user-check', hatakyuAsset: 'test', indicated };
	const app = Vue.createApp({
		components: {
			MkA: Vue.defineComponent({ props: { to: { type: String, required: true } }, setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()) }),
			MkInput: { render: () => Vue.h('input') },
			MkHatakyuIllustration: { render: () => Vue.h('img') },
		},
		setup: () => ({
			grid, rawSearchQuery: search ? '登録' : '', searchIndex: [], rootEl: Vue.ref<HTMLElement | null>(null),
			useHatakyuBranding: () => branding,
			def: [{ items: [
				{ ...base, type: 'a', href: '/admin/registration-applications' },
				{ ...base, type: 'button', action: () => {} },
				{ ...base, to: '/admin/registration-applications' },
			] }],
			searchResult: [{ ...base, id: 'registration', path: '/admin/registration-applications', isRoot: true, label: base.text }],
			searchSelectedIndex: null,
		}),
		render,
	});
	app.mount(host);
	apps.push(app);
	return host;
}

/** CSS/DOM structure check only; no simulated coordinates or visual-pass claim. */
function anchoringIssues(host: HTMLElement, stylesheet: Rule[]): string[] {
	const issues: string[] = [];
	for (const indicator of host.querySelectorAll('.itemIndicator')) {
		const icon = indicator.parentElement!;
		if (!icon.matches('.icon')) issues.push('indicator is not inside its icon');
		const declarations = stylesheet.filter(rule => !rule.reducedMotion && indicator.matches(rule.selector));
		if (!declarations.some(rule => rule.property === 'position' && rule.value === 'absolute')) issues.push('indicator does not use an absolute anchor');
		if (!stylesheet.some(rule => !rule.reducedMotion && icon.matches(rule.selector) && rule.property === 'position' && rule.value === 'relative')) issues.push('icon is not a containing block');
		if (declarations.some(rule => ['top', 'left', 'right', 'bottom'].includes(rule.property))) issues.push('indicator depends on physical text-relative offsets');
	}
	return issues;
}

describe('SuperMenu の申請バッジの構造とコンパイル済み CSS', () => {
	test.each([{ grid: false }, { grid: true }, { grid: true, branding: true }, { search: true }])('表示 $grid / 検索 $search / 画像 $branding でもバッジをアイコンに固定する', options => {
		const host = mount(options);
		expect(host.querySelectorAll('.itemIndicator')).toHaveLength(options.search ? 1 : 3);
		expect(anchoringIssues(host, rules)).toEqual([]);
		for (const indicator of host.querySelectorAll('.itemIndicator')) {
			expect(indicator.getAttribute('aria-hidden')).toBe('true');
			for (const property of ['inset-block-start', 'inset-inline-end']) {
				expect(rules).toContainEqual(expect.objectContaining({ selector: '.rrevdjwu .icon > .itemIndicator', property, value: '0' }));
			}
		}
	});

	test('旧位置指定を陽性対照として同じ検出器が検出する', () => {
		const host = mount();
		const broken = rules.map(rule => rule.selector.includes('itemIndicator') && rule.property === 'position' ? { ...rule, value: 'relative' } : rule);
		broken.push({ selector: '.rrevdjwu .itemIndicator', property: 'left', value: '-72.5px', reducedMotion: false });
		const issues = anchoringIssues(host, broken);
		expect(issues).toContain('indicator does not use an absolute anchor');
		expect(issues).toContain('indicator depends on physical text-relative offsets');
	});

	test('未処理がない時はバッジを出さず、動きを減らす設定では点滅を止める', () => {
		expect(mount({ indicated: false }).querySelector('.itemIndicator')).toBeNull();
		expect(rules).toContainEqual({ selector: '.rrevdjwu .itemIndicator', property: 'animation', value: 'none', reducedMotion: true });
	});
});
