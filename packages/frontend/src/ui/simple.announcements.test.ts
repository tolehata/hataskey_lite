/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import XAnnouncements from './_common_/announcements.vue';
import type { App } from 'vue';

type Announcement = { id: string; display: string; title: string; text: string; icon: string };
const session = vi.hoisted(() => ({ user: null as { unreadAnnouncements: Announcement[] } | null }));
vi.mock('@/i.js', () => ({ get $i() { return session.user; } }));

const source = readFileSync(resolve(process.cwd(), 'src/ui/simple.vue'), 'utf8');
const parsed = parse(source, { filename: 'simple.vue' });
type TemplateNode = NonNullable<NonNullable<typeof parsed.descriptor.template>['ast']>['children'][number];
type ElementNode = Extract<TemplateNode, { type: 1 }>;

function elements(nodes: TemplateNode[], parents: ElementNode[] = []): { node: ElementNode; parents: ElementNode[] }[] {
	return nodes.flatMap(node => node.type === 1 ? [{ node, parents }, ...elements(node.children, [...parents, node])] : []);
}

function templateElements(text = source) {
	const ast = parse(text).descriptor.template?.ast;
	if (!ast) throw new Error('Missing simple template');
	return elements(ast.children);
}

function directive(node: ElementNode, name: string, argument?: string) {
	return node.props.find(prop => prop.type === 7 && prop.name === name
		&& (argument === undefined || (prop.arg?.type === 4 && prop.arg.content === argument)));
}

function expression(node: ElementNode, name: string, argument?: string) {
	const prop = directive(node, name, argument);
	return prop?.type === 7 && prop.exp?.type === 4 ? prop.exp.content : undefined;
}

function assertBannerIntegration(text: string) {
	const nodes = templateElements(text);
	const banners = nodes.filter(({ node }) => node.tag === 'XAnnouncements');
	expect(banners).toHaveLength(1);
	const banner = banners.at(0);
	if (!banner) throw new Error('Missing announcements component');
	const wrapper = banner.parents.at(-1);
	const column = banner.parents.at(-2);
	if (!wrapper || !column) throw new Error('Missing announcements ancestors');
	expect(expression(wrapper, 'bind', 'class')).toBe('$style.announcementsBanner');
	expect(expression(column, 'bind', 'class')).toBe('$style.mainColumnInner');
	expect(expression(wrapper, 'if')).toBe('$i');
	// The only display condition is the account, never desktop/tab/deck mode.
	expect([...banner.parents, banner.node].flatMap(node => node.props.filter(prop => prop.type === 7 && ['if', 'show'].includes(prop.name)).map(prop => prop.loc.source))).toEqual(['v-if="$i"']);
	const content = column.children.find(node => node.type === 1 && expression(node, 'bind', 'class') === '$style.content');
	if (!content) throw new Error('Missing scrollable content');
	expect(column.children.indexOf(wrapper)).toBeLessThan(column.children.indexOf(content));
	const navbar = column.children.find(node => node.type === 1 && expression(node, 'bind', 'class')?.includes('$style.topBar,'));
	if (!navbar) throw new Error('Missing timeline-column navbar');
	expect(column.children.indexOf(wrapper)).toBeLessThan(column.children.indexOf(navbar));
}

const mounted: { app: App<Element>; container: HTMLDivElement }[] = [];

function mountAnnouncements(announcements: Announcement[] | null) {
	session.user = announcements === null ? null : reactive({ unreadAnnouncements: announcements });
	const app = createApp(XAnnouncements);
	app.component('MkA', defineComponent({
		props: { to: { type: String, required: true } },
		setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return container;
}

function announcement(id: string, display = 'banner'): Announcement {
	return { id, display, title: `${id}のお知らせ`, text: `${id}の本文`, icon: 'info' };
}

function script(): ts.SourceFile {
	const block = parsed.descriptor.scriptSetup;
	if (!block) throw new Error('Missing script setup');
	return ts.createSourceFile('simple.ts', block.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function observerFixture(hasElement = true) {
	const file = script();
	const functions = ['updateAnnouncementsHeight', 'startAnnouncementsObserver', 'stopAnnouncementsObserver'].map(name => {
		const node = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
		if (!node) throw new Error(`Missing function: ${name}`);
		return node.getText(file);
	}).join('\n');
	const element = { offsetHeight: 0 };
	const announcementsEl = { value: hasElement ? element : null };
	const announcementsHeight = { value: 0 };
	const observers: { callback: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
	class Observer {
		observe = vi.fn();
		disconnect = vi.fn();
		constructor(public callback: () => void) { observers.push(this); }
	}
	const code = ts.transpileModule(`let announcementsObserver = null;\n${functions}\n({ updateAnnouncementsHeight, startAnnouncementsObserver, stopAnnouncementsObserver });`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
	const methods = runInNewContext(code.outputText, { announcementsEl, announcementsHeight, ResizeObserver: Observer }, { timeout: 1000 }) as {
		updateAnnouncementsHeight: () => void;
		startAnnouncementsObserver: () => void;
		stopAnnouncementsObserver: () => void;
	};
	return { ...methods, element, announcementsEl, announcementsHeight, observers };
}

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
	session.user = null;
});

describe('HataskeyUIのお知らせバナー', () => {
	test('共通バナーを通常・デッキ・各ページ共通のスクロール外上部へ一度だけ結線する', () => {
		assertBannerIntegration(source);
		expect(source).toContain('const XAnnouncements = defineAsyncComponent(() => import(\'./_common_/announcements.vue\'));');
	});

	test('旧来のバナー呼び出し欠落を同じ結線検出器で検出する', () => {
		const missing = source.replace('<XAnnouncements/>', '');
		expect(missing).not.toBe(source);
		expect(() => assertBannerIntegration(missing)).toThrow();
		assertBannerIntegration(source);
	});

	test('既存の未読bannerだけを表示し、詳細リンク・タイトル・本文を保持する', () => {
		const values = [announcement('first'), announcement('normal', 'normal'), announcement('dialog', 'dialog'), announcement('second')];
		const before = JSON.stringify(values);
		const container = mountAnnouncements(values);
		expect([...container.querySelectorAll('a')].map(link => link.getAttribute('href'))).toEqual(['/announcements/first', '/announcements/second']);
		expect(container.textContent).toContain('firstのお知らせ');
		expect(container.textContent).toContain('secondの本文');
		expect(container.textContent).not.toContain('normalのお知らせ');
		expect(container.textContent).not.toContain('dialogのお知らせ');
		expect(JSON.stringify(values)).toBe(before);
	});

	test('共有アカウントの未読更新に追随し、読了したバナーを残さない', async () => {
		const container = mountAnnouncements([announcement('read'), announcement('keep')]);
		if (!session.user) throw new Error('Missing account');
		session.user.unreadAnnouncements = [announcement('keep')];
		await nextTick();
		expect([...container.querySelectorAll('a')].map(link => link.getAttribute('href'))).toEqual(['/announcements/keep']);
		session.user.unreadAnnouncements = [];
		await nextTick();
		expect(container.querySelectorAll('a')).toHaveLength(0);
	});

	test.each([{ values: null }, { values: [] }, { values: [announcement('normal', 'normal')] }])('未ログインまたは該当バナーなしならリンクを出さない ($values)', ({ values }) => {
		const container = mountAnnouncements(values);
		expect(container.querySelector('a')).toBeNull();
	});

	test('お知らせ本文はHTMLとして実行せず、既存リンクにキーボードでフォーカスできる', () => {
		const item = { ...announcement('safe'), title: '<img src=x onerror=alert(1)>', text: '<script>alert(1)</script>' };
		const container = mountAnnouncements([item]);
		expect(container.querySelector('img, script')).toBeNull();
		expect(container.textContent).toContain(item.title);
		expect(container.textContent).toContain(item.text);
		const link = container.querySelector('a');
		if (!link) throw new Error('Missing announcement link');
		link.focus();
		expect(window.document.activeElement).toBe(link);
	});

	test('非同期読込・複数行・読了で変わる実高さを監視し、二重監視と残留を防ぐ', () => {
		const current = observerFixture();
		current.startAnnouncementsObserver();
		current.startAnnouncementsObserver();
		expect(current.observers).toHaveLength(1);
		const observer = current.observers.at(0);
		if (!observer) throw new Error('Missing observer');
		expect(observer.observe).toHaveBeenCalledWith(current.element);
		for (const height of [24, 48, 0, 72]) {
			current.element.offsetHeight = height;
			observer.callback();
			expect(current.announcementsHeight.value).toBe(height);
		}
		current.stopAnnouncementsObserver();
		current.stopAnnouncementsObserver();
		expect(observer.disconnect).toHaveBeenCalledTimes(1);
		current.startAnnouncementsObserver();
		expect(current.observers).toHaveLength(2);
	});

	test('未ログインで要素がないときは監視を作らず、高さを0として扱う', () => {
		const current = observerFixture(false);
		current.startAnnouncementsObserver();
		current.updateAnnouncementsHeight();
		expect(current.observers).toHaveLength(0);
		expect(current.announcementsHeight.value).toBe(0);
		current.stopAnnouncementsObserver();
	});

	test('mount/unmountから高さ監視を開始・解除し、rootのCSS変数へ結線する', () => {
		const file = script();
		for (const [hook, method] of [['onMounted', 'startAnnouncementsObserver'], ['onUnmounted', 'stopAnnouncementsObserver']]) {
			const hooks = file.statements.flatMap(statement => ts.isExpressionStatement(statement)
				&& ts.isCallExpression(statement.expression)
				&& ts.isIdentifier(statement.expression.expression)
				&& statement.expression.expression.text === hook ? [statement.expression] : []);
			expect(hooks.length).toBeGreaterThan(0);
			const methodCalls = hooks.flatMap(call => {
				const callback = call.arguments.at(0);
				if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return [];
				const found: ts.CallExpression[] = [];
				const visit = (node: ts.Node): void => {
					if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === method) found.push(node);
					ts.forEachChild(node, visit);
				};
				visit(callback.body);
				return found;
			});
			expect(methodCalls).toHaveLength(1);
			expect(methodCalls.at(0)?.arguments).toHaveLength(0);
		}
		const root = templateElements().find(({ node }) => node.props.some(prop => prop.type === 6 && prop.name === 'ref' && prop.value?.content === 'timelineCollapseRoot'));
		if (!root) throw new Error('Missing root');
		expect(expression(root.node, 'bind', 'style')).toBe('{ \'--simple-announcements-height\': `${announcementsHeight}px`, \'--note-charm-rail-width\': `${CHARM_RAIL_WIDTH}px` }');
	});

	test('コンパイル済みCSSでバナーの高さ確保とPC/モバイル上部ナビの押し下げを保つ', async () => {
		const style = parsed.descriptor.styles.find(block => block.module);
		if (!style) throw new Error('Missing module stylesheet');
		const compiled = await compileStyleAsync({ source: style.content, filename: resolve(process.cwd(), 'src/ui/simple.vue'), id: 'simple-announcements', preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		const banner = compiled.code.match(/\.announcementsBanner\s*\{([^}]+)\}/u)?.[1];
		// Only the standalone rule; nested descendant rules such as the note charm lane also end in `.topBar`.
		const navbar = compiled.code.match(/(?:^|\})\s*\.topBar\s*\{([^}]+)\}/u)?.[1];
		expect(banner).toMatch(/flex-shrink:\s*0/u);
		expect(banner).toMatch(/position:\s*relative/u);
		expect(banner).toMatch(/z-index:\s*201/u);
		expect(navbar).toMatch(/top:\s*calc\(var\(--simple-announcements-height,\s*0px\)\s*\+\s*var\(--MI-fixed-top-inset,\s*0px\)\)/u);
		expect(navbar).toMatch(/position:\s*fixed/u);
		expect(compiled.code).toMatch(/\.desktopLayout\s+\.topBar\s*\{\s*position:\s*absolute/u);
		expect(compiled.code.replace(/["']/gu, '')).toMatch(/\.root\[data-hata-foldable=true\]\s+\.topBar\s*\{\s*position:\s*absolute/u);
	});
});
