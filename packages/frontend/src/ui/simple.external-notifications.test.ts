/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { compileStyleAsync, compileTemplate, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { App, ComputedRef } from 'vue';
import { SIDEBAR_ICON_OVERRIDES } from '@/utility/sidebar-icon-overrides.js';
import { hataAppForMenuIcon } from '@/utility/hata-app-brand.js';

const filename = resolve(process.cwd(), 'src/ui/simple.vue');
const source = readFileSync(filename, 'utf8');
const parsed = parse(source, { filename });
type TemplateNode = NonNullable<NonNullable<typeof parsed.descriptor.template>['ast']>['children'][number];
type ElementNode = Extract<TemplateNode, { type: 1 }>;
type CompiledStyle = Awaited<ReturnType<typeof compileStyleAsync>>;
let compiledStyle: CompiledStyle | undefined;
const mounted: { app: App<Element>; container: HTMLDivElement; style: HTMLStyleElement }[] = [];

function elements(nodes: TemplateNode[], parents: ElementNode[] = []): { node: ElementNode; parents: ElementNode[] }[] {
	return nodes.flatMap(node => node.type === 1 ? [{ node, parents }, ...elements(node.children, [...parents, node])] : []);
}

function expression(node: ElementNode, name: string, argument?: string): string | undefined {
	const prop = node.props.find(item => item.type === 7 && item.name === name && (argument === undefined || (item.arg?.type === 4 && item.arg.content === argument)));
	return prop?.type === 7 && prop.exp?.type === 4 ? prop.exp.content : undefined;
}

function collapsedTemplate() {
	const ast = parsed.descriptor.template?.ast;
	if (!ast) throw new Error('Missing simple UI template');
	const matches = elements(ast.children).filter(({ node }) => node.tag === 'button' && expression(node, 'for') === 'item in studioCollapsedButtons');
	if (matches.length !== 1) throw new Error('Expected exactly one real collapsed button loop');
	const button = matches[0];
	const branch = button.parents.at(-1);
	if (!branch || branch.tag !== 'template') throw new Error('Missing collapsed template branch');
	const parents = button.parents.slice(0, -1);
	// Keep the actual ancestor attributes and conditional branch, excluding unrelated UI.
	const content = parents.map(node => node.loc.source.slice(0, node.loc.source.indexOf('>') + 1)).join('')
		+ branch.loc.source + parents.map(node => `</${node.tag}>`).reverse().join('');
	return { button: button.node, branch, parents, content };
}

function stylesheet() {
	const css = compiledStyle?.rawResult?.root;
	const classes = compiledStyle?.modules;
	if (!css || !classes) throw new Error('Simple UI CSS modules did not compile');
	return { css, classes };
}

beforeAll(async () => {
	const style = parsed.descriptor.styles.find(block => block.module);
	if (!style) throw new Error('Missing simple UI module stylesheet');
	compiledStyle = await compileStyleAsync({ source: style.content, filename, id: 'simple-external-notifications', preprocessLang: 'scss', modules: true });
	if (compiledStyle.errors.length) throw new Error(compiledStyle.errors.map(String).join('\n'));
});

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
		item.style.remove();
	}
});

type Button = { id: string; type: 'button'; menuId: string; label: string; icon: string; shape: 'circle' | 'pill'; background: string; foreground: string };
type Mode = 'manual' | 'deck';

function productionBindings(mode: Mode, shape: Button['shape']) {
	const block = parsed.descriptor.scriptSetup;
	if (!block) throw new Error('Missing simple UI script');
	const file = ts.createSourceFile('simple.ts', block.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const variables = ['isExternalLinked', 'sidebarFolded', 'studioCollapsedButtons'].map(name => {
		const statement = file.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name));
		if (!statement) throw new Error(`Missing production binding: ${name}`);
		return statement.getText(file);
	});
	const functions = ['studioMenuItemAvailable', 'studioItemStyle', 'studioIcon'].map(name => {
		const statement = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
		if (!statement) throw new Error(`Missing production function: ${name}`);
		return statement.getText(file);
	});
	const buttons = ['timeline', 'externalNotifications', 'notifications', 'unavailable'].map(menuId => ({ id: `saved-${menuId}`, type: 'button', menuId, label: menuId, icon: 'ti ti-bell', shape, background: 'transparent', foreground: '#333' }) satisfies Button);
	const profile = Vue.ref({ expanded: { width: 'normal', columns: 1 }, collapsed: { buttons } });
	const enabled = Vue.ref(false);
	const token = Vue.ref<string | null | undefined>(null);
	const deckActive = Vue.ref(mode === 'deck');
	const sidebarCollapsed = Vue.ref(mode === 'manual');
	const code = ts.transpileModule(`${variables.join('\n')}\n${functions.join('\n')}\n({ isExternalLinked, sidebarFolded, studioCollapsedButtons, studioMenuItemAvailable, studioItemStyle, studioIcon });`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
	const bindings = runInNewContext(code.outputText, {
		computed: Vue.computed, prefer: { r: { 'external.enabled': enabled, 'external.token': token } },
		deckActive, sidebarCollapsed, studioProfile: profile,
		navbarItemDef: { timeline: {}, notifications: {}, unavailable: { show: false } },
		SIDEBAR_ICON_OVERRIDES, gradientCss: (item: Button) => item.background,
	}, { timeout: 1000 }) as {
		isExternalLinked: ComputedRef<boolean>;
		sidebarFolded: ComputedRef<boolean>;
		studioCollapsedButtons: ComputedRef<Button[]>;
		studioMenuItemAvailable: (menuId: string) => boolean;
		studioItemStyle: (item: Button) => Record<string, string>;
		studioIcon: (item: Button) => string;
	};
	return { bindings, profile, enabled, token, deckActive, sidebarCollapsed };
}

async function mountCollapsed(mode: Mode, shape: Button['shape'] = 'circle', legacyImportant = false) {
	const { css, classes } = stylesheet();
	const sheet = css.clone();
	if (legacyImportant) {
		let changed = 0;
		sheet.walkRules(rule => {
			if (rule.selector !== `.${classes.hssCollapsedItem}`) return;
			rule.walkDecls('display', declaration => { declaration.important = true; changed++; });
		});
		if (changed !== 1) throw new Error('Legacy important positive control did not change one display declaration');
	}
	const template = compileTemplate({ source: collapsedTemplate().content, filename, id: 'simple-external-fixture' });
	if (template.errors.length) throw new Error(template.errors.map(String).join('\n'));
	const code = ts.transpileModule(template.code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
	const moduleExports = {} as { render?: Vue.RenderFunction };
	runInNewContext(code.outputText, { exports: moduleExports, require: (name: string) => {
		if (name !== 'vue') throw new Error(`Unexpected fixture runtime import: ${name}`);
		return Vue;
	} }, { timeout: 1000 });
	if (!moduleExports.render) throw new Error('The actual collapsed template did not compile to a render function');
	const state = productionBindings(mode, shape);
	const unread = Vue.ref(true);
	const app = Vue.createApp(Vue.defineComponent({
		render: moduleExports.render,
		setup: () => ({
			...state.bindings, studioProfile: state.profile, deckActive: state.deckActive, sidebarCollapsed: state.sidebarCollapsed,
			isDesktop: true, topNavActive: false, glassEffect: false, announcementsHeight: 0, isFoldableWide: false,
			sbFadeTop: false, sbFadeBottom: false, hasUnreadNotif: false, showUnreadNotifCount: false, unreadNotifCount: 0,
			hasUnreadAnnouncements: false, hasUnreadChat: false, extNotifHasUnread: unread, hataAppForMenuIcon, footerIsDark: false,
			onSbScroll: () => {}, studioButtonLabel: (item: Button) => item.label, sidebarItemActive: () => false, studioItemClick: () => {},
		}),
	}));
	app.config.globalProperties.$style = classes;
	app.directive('tooltip', {});
	const container = window.document.createElement('div');
	const style = window.document.createElement('style');
	style.textContent = sheet.toString();
	window.document.head.append(style);
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container, style });
	await Vue.nextTick();
	const items = (): HTMLButtonElement[] => [...container.querySelectorAll<HTMLButtonElement>(`.${classes.hssCollapsedItem}`)];
	const item = (index: number): HTMLButtonElement => {
		const button = items().at(index);
		if (!button) throw new Error(`Missing collapsed item at saved index ${index}`);
		return button;
	};
	return { ...state, unread, container, items, item, sheet, classes };
}

/**
 * Read the actual author declarations plus Vue's inline display. This bounded
 * cascade checks importance explicitly; it is not browser/device visual evidence.
 */
function displayValue(element: HTMLElement, sheet: ReturnType<typeof stylesheet>['css']): string {
	const inline = element.style.getPropertyValue('display');
	if (inline && element.style.getPropertyPriority('display') === 'important') return inline;
	const declarations: { value: string; important: boolean }[] = [];
	sheet.walkRules(rule => {
		// The collapsed-button rules are unconditional. Ignore other responsive UI.
		if (rule.parent?.type !== 'root') return;
		const ruleDeclarations: { value: string; important: boolean }[] = [];
		rule.walkDecls('display', declaration => { ruleDeclarations.push({ value: declaration.value, important: declaration.important === true }); });
		if (ruleDeclarations.length === 0) return;
		if (!element.matches(rule.selector)) return;
		declarations.push(...ruleDeclarations);
	});
	const important = declarations.filter(declaration => declaration.important);
	const candidates = important.length ? important : inline ? [{ value: inline }] : declarations;
	const values = new Set(candidates.map(declaration => declaration.value));
	if (values.size !== 1) throw new Error('Display cascade gained conflicting declarations; extend this focused check explicitly');
	return [...values][0];
}

describe('Hataskey UI縮小サイドバーの外部通知', () => {
	test('実テンプレートは保存順と既存の連携判定をv-showへ渡し、CSS重要度が非表示を妨げない', () => {
		expect(parsed.errors).toEqual([]);
		const template = collapsedTemplate();
		expect(expression(template.branch, 'if')).toBe('sidebarFolded');
		expect(expression(template.button, 'show')).toBe('studioMenuItemAvailable(item.menuId)');
		expect(expression(template.button, 'bind', 'key')).toBe('item.id');
		expect(expression(template.button, 'bind', 'class')).toContain('$style.hssCollapsedItem');
		expect(expression(template.parents.find(node => node.tag === 'nav') ?? template.branch, 'bind', 'class')).toContain('deckActive || sidebarCollapsed');
		const { css, classes } = stylesheet();
		const declarations: { value: string; important: boolean }[] = [];
		css.walkRules(rule => {
			if (rule.selector === `.${classes.hssCollapsedItem}`) rule.walkDecls('display', declaration => { declarations.push({ value: declaration.value, important: declaration.important === true }); });
		});
		expect(declarations).toEqual([{ value: 'flex', important: false }]);
	});

	test.each(['manual', 'deck'] as const)('%s縮小中は未連携を隠し、接続・解除しても保存位置と通常アイコンを保つ', async mode => {
		const fixture = await mountCollapsed(mode);
		const external = fixture.item(1);
		const originalItems = fixture.items();
		const saved = JSON.stringify(fixture.profile.value);
		for (const [enabled, token, visible] of [[false, null, false], [false, 'linked-token', false], [true, undefined, false], [true, null, false], [true, 'linked-token', true], [false, 'linked-token', false], [true, 'linked-token', true]] as const) {
			fixture.enabled.value = enabled;
			fixture.token.value = token;
			await Vue.nextTick();
			expect(fixture.bindings.isExternalLinked.value).toBe(visible);
			expect(external.style.display).toBe(visible ? '' : 'none');
			expect(displayValue(external, fixture.sheet)).toBe(visible ? 'flex' : 'none');
			expect(window.getComputedStyle(external).display).toBe(visible ? 'flex' : 'none');
			expect(fixture.items()).toEqual(originalItems);
			for (const index of [0, 2]) expect(displayValue(fixture.item(index), fixture.sheet)).toBe('flex');
			expect(displayValue(fixture.item(3), fixture.sheet)).toBe('none');
			expect(JSON.stringify(fixture.profile.value)).toBe(saved);
		}
		expect(external.querySelector(`.${fixture.classes.sbExtDot}`)).not.toBeNull();
		fixture.unread.value = false;
		await Vue.nextTick();
		expect(external.querySelector(`.${fixture.classes.sbExtDot}`)).toBeNull();
	});

	test('旧display:flex!importantを戻す陽性対照では、実v-showのdisplay:noneよりCSSが勝つことを検出する', async () => {
		const fixture = await mountCollapsed('manual', 'circle', true);
		const external = fixture.item(1);
		expect(fixture.bindings.isExternalLinked.value).toBe(false);
		expect(external.style.display).toBe('none');
		expect(displayValue(external, fixture.sheet)).toBe('flex');
		expect(displayValue(external, fixture.sheet)).not.toBe('none');
	});

	test.each(['circle', 'pill'] as const)('%s型は手動縮小からデッキへ切り替えても幅・中央揃え・既存の形状を保つ', async shape => {
		const fixture = await mountCollapsed('manual', shape);
		const saved = JSON.stringify(fixture.profile.value);
		for (const deck of [false, true]) {
			fixture.deckActive.value = deck;
			fixture.sidebarCollapsed.value = !deck;
			await Vue.nextTick();
			expect(fixture.bindings.sidebarFolded.value).toBe(true);
			const icon = fixture.item(0);
			const style = window.getComputedStyle(icon);
			expect(style.display).toBe('flex');
			expect(style.alignItems).toBe('center');
			expect(style.justifyContent).toBe('center');
			expect(style.maxWidth).toBe('44px');
			expect(style.height).toBe(shape === 'pill' ? '40px' : '44px');
			expect(style.minHeight).toBe(shape === 'pill' ? '40px' : '44px');
			expect(style.borderRadius).toBe(shape === 'pill' ? '999px' : '50%');
			expect(icon.getAttribute('data-hss-shape')).toBe(shape);
			expect(JSON.stringify(fixture.profile.value)).toBe(saved);
		}
	});
});
