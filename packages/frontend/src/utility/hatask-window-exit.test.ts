/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, nextTick, ref, watch } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { hatagoesUrl, isHatagoesIntroPath } from './hatagoes-navigation.js';

function source(path: string): string { return readFileSync(resolve(process.cwd(), path), 'utf8'); }

function script(path: string): ts.SourceFile {
	const descriptor = parse(source(path), { filename: path }).descriptor;
	if (!descriptor.scriptSetup) throw new Error(`Missing script setup: ${path}`);
	return ts.createSourceFile(path + '.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

const page = script('src/pages/hatask.vue');
const frame = script('src/components/MkPageWindow.vue');
const di = ts.createSourceFile('di.ts', source('src/di.ts'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const routeScopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => { for (const scope of routeScopes.splice(0)) scope.stop(); });

function declaration(file: ts.SourceFile, name: string): ts.VariableDeclaration {
	for (const statement of file.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const found = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name);
		if (found) return found;
	}
	throw new Error(`Missing variable: ${name}`);
}

function functionNode(file: ts.SourceFile, name: string): ts.FunctionDeclaration {
	const node = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
	if (!node || !ts.isFunctionDeclaration(node) || !node.body) throw new Error(`Missing function: ${name}`);
	return node;
}

function callStatement(file: ts.SourceFile, name: string, firstArgument?: string): ts.ExpressionStatement {
	const found = file.statements.find(statement => ts.isExpressionStatement(statement)
		&& ts.isCallExpression(statement.expression)
		&& statement.expression.expression.getText(file) === name
		&& (firstArgument === undefined || (statement.expression.arguments.length > 0 && statement.expression.arguments[0].getText(file) === firstArgument)));
	if (!found || !ts.isExpressionStatement(found)) throw new Error(`Missing call: ${name}(${firstArgument ?? ''})`);
	return found;
}

function evaluate<T>(code: string, context: Record<string, unknown>): T {
	const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
	return runInNewContext(compiled.outputText, context, { timeout: 1000 }) as T;
}

type ExitFunctions = { exitHatask: () => void; handleBack: () => void; goBackToTimeline: () => void; handleAkatsukiAction: (action: { type: 'exit' }) => Promise<void> };

function extractExitFunctions(legacyControl = false): string {
	return ['exitHatask', 'handleBack', 'goBackToTimeline', 'handleAkatsukiAction'].map(name => {
		const node = functionNode(page, name);
		if (!legacyControl || name !== 'exitHatask') return node.getText(page);
		if (!node.body) throw new Error('Missing exit function body');
		const guard = node.body.statements.find(statement => ts.isIfStatement(statement) && statement.expression.getText(page) === 'closePageWindow');
		if (!guard) throw new Error('Missing window close guard for positive control');
		// Mutate the actual AST, not a second implementation: removing only the
		// window guard restores the former return-to-timeline exit behavior.
		const body = ts.factory.updateBlock(node.body, node.body.statements.filter(statement => statement !== guard));
		const legacy = ts.factory.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, body);
		return ts.createPrinter().printNode(ts.EmitHint.Unspecified, legacy, page);
	}).join('\n');
}

function fixture(options: { tab?: string; inWindow?: boolean; embedded?: boolean; legacyControl?: boolean; providedClose?: () => void } = {}) {
	const activeTab = { value: options.tab ?? 'home' };
	const route = { value: '/hatask' };
	const operations: string[] = [];
	const cleanupHataskState = vi.fn(() => { operations.push('cleanup'); });
	const closePageWindow = options.inWindow ? vi.fn(() => { operations.push('close'); options.providedClose?.(); }) : null;
	const emit = vi.fn((event: string) => { operations.push(`emit:${event}`); });
	const routeRouter = { push: vi.fn((path: string) => { operations.push(`push:${path}`); route.value = path; }) };
	const functions = evaluate<ExitFunctions>(`${extractExitFunctions(options.legacyControl)}\n({ exitHatask, handleBack, goBackToTimeline, handleAkatsukiAction });`, { activeTab, closePageWindow, cleanupHataskState, routeRouter, props: { embedded: options.embedded ?? false }, emit });
	return { ...functions, activeTab, route, operations, cleanupHataskState, closePageWindow, routeRouter, emit };
}

describe('Hataskの明示終了と従来の戻る操作', () => {
	test('埋め込み画面の終了は親へ伝え、旧ルートと保存中のタブを保つ', async () => {
		const current = fixture({ tab: 'todo', embedded: true });
		await current.handleAkatsukiAction({ type: 'exit' });
		expect(current.operations).toEqual(['emit:exit']);
		expect(current.route.value).toBe('/hatask');
		expect(current.activeTab.value).toBe('todo');
		expect(current.cleanupHataskState).not.toHaveBeenCalled();
	});
	test.each(['home', 'cal', 'todo'])('ウィンドウの%sからの明示終了はcloseだけを呼び、routeとタブを変更しない', async tab => {
		const current = fixture({ tab, inWindow: true });
		await current.handleAkatsukiAction({ type: 'exit' });
		expect(current.operations).toEqual(['close']);
		expect(current.closePageWindow).toHaveBeenCalledTimes(1);
		expect(current.cleanupHataskState).not.toHaveBeenCalled();
		expect(current.routeRouter.push).not.toHaveBeenCalled();
		expect(current.route.value).toBe('/hatask');
		expect(current.activeTab.value).toBe(tab);
	});

	test('通常ページのホームでは従来どおりcleanupの後にタイムラインへ遷移する', async () => {
		const current = fixture();
		await current.handleAkatsukiAction({ type: 'exit' });
		expect(current.operations).toEqual(['cleanup', 'push:/']);
		expect(current.routeRouter.push).toHaveBeenCalledTimes(1);
		expect(current.route.value).toBe('/');
	});

	test.each(['cal', 'todo', 'mood', 'meal', 'garden', 'ranking', 'hataskapps', 'apps'])('通常ページの%sでは明示終了でもまずホームへ戻す', async tab => {
		const current = fixture({ tab });
		await current.handleAkatsukiAction({ type: 'exit' });
		expect(current.activeTab.value).toBe('home');
		expect(current.operations).toEqual([]);
		expect(current.route.value).toBe('/hatask');
		await current.handleAkatsukiAction({ type: 'exit' });
		expect(current.operations).toEqual(['cleanup', 'push:/']);
	});

	test.each([false, true])('旧テーマの戻る操作は閉窓へ変えず、非home→home→timelineを保つ（window=%s）', inWindow => {
		const current = fixture({ tab: 'cal', inWindow });
		current.handleBack();
		expect(current.activeTab.value).toBe('home');
		expect(current.operations).toEqual([]);
		current.handleBack();
		expect(current.operations).toEqual(['cleanup', 'push:/']);
		if (current.closePageWindow) expect(current.closePageWindow).not.toHaveBeenCalled();
	});

	test('window close分岐を外した旧挙動はroute変更として検出できる', async () => {
		const legacy = fixture({ inWindow: true, legacyControl: true });
		await legacy.handleAkatsukiAction({ type: 'exit' });
		expect(legacy.operations).toEqual(['cleanup', 'push:/']);
		expect(legacy.route.value).toBe('/');
		expect(legacy.closePageWindow).not.toHaveBeenCalled();
		const current = fixture({ inWindow: true });
		await current.handleAkatsukiAction({ type: 'exit' });
		expect(current.operations).toEqual(['close']);
		expect(current.route.value).toBe('/hatask');
	});

	test('全テーマで共通レイアウトの戻る操作を既存処理へ結線する', () => {
		const markup = parse(source('src/pages/hatask.vue')).descriptor.template?.content;
		if (!markup) throw new Error('Missing Hatask template');
		const fragment = window.document.createElement('template'); fragment.innerHTML = markup;
		expect(fragment.content.querySelector('HataskAkatsukiLayout')?.getAttribute('@action')).toBe('handleAkatsukiAction');
		const buttons = [...fragment.content.querySelectorAll('button')];
		expect(buttons.filter(button => button.getAttribute('@click') === 'handleBack')).toHaveLength(0);
	});
});

describe('HataIntroのアプリ入口と現在のルーターへの接続', () => {
	test.each([false, true])('暁と旧テーマでは重複入口を外し、HataIntroをcleanup後に現在の画面で開く（window=%s）', inWindow => {
		const operations: string[] = [];
		const mainRouter = { push: vi.fn((path: string) => { operations.push(`push:${path}`); }) };
		const windowRouter = { push: vi.fn((path: string) => { operations.push(`push:${path}`); }) };
		const currentRouter = inWindow ? windowRouter : mainRouter;
		const closePageWindow = vi.fn();
		const activeTab = { value: 'home' };
		const launchers = evaluate<{
			homeApps: { value: Array<{ id: string; label: string; short: string; fn: () => void }> };
			openAkatsukiApp: (id: string) => void;
		}>([
					`const ${declaration(page, 'routeRouter').getText(page)};`,
					functionNode(page, 'openHataIntro').getText(page),
					functionNode(page, 'openAkatsukiApp').getText(page),
					`const ${declaration(page, 'homeApps').getText(page)};`,
					'({ homeApps, openAkatsukiApp });',
				].join('\n'), {
					useRouter: () => currentRouter,
					mainRouter,
					closePageWindow,
					cleanupHataskState: () => { operations.push('cleanup'); },
					computed: <T>(getter: () => T) => ({ value: getter() }),
					copy: {},
					emotionCopy: { title: 'HATAlyze' },
					tabs: { value: [{ id: 'home' }] },
					activeTab,
					canAccessHataFeed: { value: false },
					canUseMascot: { value: false },
					trackAkatsukiTool: (id: string) => { operations.push(`track:${id}`); },
					...Object.fromEntries([
						'openHataskSettings', 'openDrawingTool', 'openHataCard', 'openHataSideStudio',
						'openHataWhatsNew', 'openHataSettings', 'openHatalyze', 'openHataFeed',
						'openHatady', 'openEarthquake', 'goToMascotSettings',
					].map(name => [name, vi.fn()])),
				});
		const intro = launchers.homeApps.value.find(app => app.id === 'intro');
		if (!intro) throw new Error('Missing HataIntro app');
		const hasGuide = (apps: { id: string }[]) => apps.some(app => app.id === 'guide');
		expect(hasGuide([...launchers.homeApps.value, { id: 'guide' }])).toBe(true);
		expect(hasGuide(launchers.homeApps.value)).toBe(false);
		expect(intro.label).toBe('HataIntro');
		expect(intro.short).toBe('HataIntro');
		intro.fn();
		expect(operations).toEqual(['cleanup', 'push:/hatask/intro']);
		operations.splice(0);
		launchers.openAkatsukiApp('intro');
		expect(operations).toEqual(['track:intro', 'cleanup', 'push:/hatask/intro']);
		operations.splice(0);
		launchers.openAkatsukiApp('guide');
		expect(operations).toEqual([]);
		expect(activeTab.value).toBe('home');
		expect(closePageWindow).not.toHaveBeenCalled();
		expect(currentRouter.push).toHaveBeenCalledTimes(2);
		expect((inWindow ? mainRouter : windowRouter).push).not.toHaveBeenCalled();
	});

	test('もっとのヘルプにある機能解説は、通常の内部リンクでHataIntroトップへ開く', () => {
		function checkHelpLink(code: string): void {
			const navbar = ts.createSourceFile('navbar.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
			const links: Map<string, string>[] = [];

			function visit(node: ts.Node): void {
				if (ts.isObjectLiteralExpression(node)) {
					const properties = new Map(node.properties.flatMap<[string, string]>(property => ts.isPropertyAssignment(property) ? [[property.name.getText(navbar), property.initializer.getText(navbar)]] : []));
					if (properties.get('text') === 'i18n.ts._hata._common.featureGuide') links.push(properties);
				}
				ts.forEachChild(node, visit);
			}

			visit(navbar);
			expect(links).toHaveLength(1);
			expect(Object.fromEntries(links[0])).toEqual({
				type: '\'link\'', text: 'i18n.ts._hata._common.featureGuide', icon: '\'ti ti-book\'', to: '\'/hatask/intro\'',
			});
		}

		const navbar = source('src/navbar.ts');
		expect(() => checkHelpLink(navbar.replace('to: \'/hatask/intro\'', 'to: \'/hata-docs\''))).toThrow();
		checkHelpLink(navbar);
	});

	test('統合ガイドもHatask配下は認証付き、旧機能解説URLは公開のまま保つ', () => {
		const routes = ts.createSourceFile('router.definition.ts', source('src/router.definition.ts'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const definitions: ts.ObjectLiteralExpression[] = [];

		function visit(node: ts.Node): void {
			if (ts.isObjectLiteralExpression(node)) definitions.push(node);
			ts.forEachChild(node, visit);
		}

		visit(routes);

		function properties(path: string): Map<string, string> {
			const matching = definitions.filter(node => node.properties.some(property => ts.isPropertyAssignment(property)
				&& property.name.getText(routes) === 'path'
				&& ts.isStringLiteral(property.initializer) && property.initializer.text === path));
			expect(matching).toHaveLength(1);
			return new Map(matching[0].properties.flatMap<[string, string]>(property => ts.isPropertyAssignment(property) ? [[property.name.getText(routes), property.initializer.getText(routes)]] : []));
		}

		const intro = properties('/hatask/intro');
		expect(intro.get('component')).toBe('page(() => import(\'@/pages/hata-intro.vue\'))');
		expect(intro.get('loginRequired')).toBe('true');
		const guide = properties('/hata-docs');
		expect(guide.get('component')).toBe('page(() => import(\'@/pages/hata-docs.vue\'))');
		expect(guide.get('loginRequired')).toBe('false');
	});
});

function routeQueryWatch(): ts.ExpressionStatement {
	const statement = page.statements.find(item => ts.isExpressionStatement(item)
		&& ts.isCallExpression(item.expression) && item.expression.expression.getText(page) === 'watch'
		&& item.expression.arguments[0].getText(page).includes('routeRouter.currentRef.value.props.get(\'tab\')'));
	if (!statement || !ts.isExpressionStatement(statement)) throw new Error('Missing Hatask route query watcher');
	return statement;
}

function introReturnFixture(options: { inWindow?: boolean; theme?: string; tab?: string; notice?: string } = {}) {
	const mainRoute = ref({ props: new Map<string, string | undefined>() });
	const windowRoute = ref({ props: new Map<string, string | undefined>() });
	const mainRouter = { currentRef: mainRoute };
	const windowRouter = { currentRef: windowRoute };
	const currentRouter = options.inWindow ? windowRouter : mainRouter;
	const otherRouter = options.inWindow ? mainRouter : windowRouter;
	currentRouter.currentRef.value.props.set('tab', options.tab);
	currentRouter.currentRef.value.props.set('notice', options.notice);
	const activeTab = ref('home');
	const settings = ref({ theme: options.theme ?? 'akatsuki' });
	const scope = effectScope();
	routeScopes.push(scope);
	scope.run(() => evaluate([
		`const ${declaration(page, 'routeRouter').getText(page)};`,
		`const ${declaration(page, 'tabs').getText(page)};`,
		routeQueryWatch().getText(page),
		callStatement(page, 'watch', '() => settings.value.theme').getText(page),
	].join('\n'), {
		computed, watch, activeTab, settings, useRouter: () => currentRouter,
		props: { embedded: false },
		copy: {}, canReviewRecords: ref(false), i18n: { ts: { _hata: { _hatask: { _akatsuki: { recipeTab: 'レシピ', supportTab: 'おうえん', reviewTab: '記録確認' }, _ranking: { title: 'ランキング' } } } } },
		showBoot: ref(false), bootKey: ref(0),
	}));
	return { activeTab, settings, currentRouter, otherRouter };
}

describe('HataIntroからHatask Appへ戻るquery', () => {
	test('即時query監視はsettings宣言後に置き、現在のルーター宣言の位置を変えない', () => {
		const queryWatch = routeQueryWatch();
		expect(queryWatch.getStart(page)).toBeGreaterThan(declaration(page, 'settings').getStart(page));
		expect(declaration(page, 'routeRouter').getStart(page)).toBeLessThan(declaration(page, 'settings').getStart(page));
	});

	test.each([false, true])('暁では現在の通常画面・小窓のqueryからApp一覧へ戻り、他方のqueryには反応しない（window=%s）', async inWindow => {
		const current = introReturnFixture({ inWindow, tab: 'hataskapps' });
		expect(current.activeTab.value).toBe('hataskapps');
		current.otherRouter.currentRef.value.props.set('tab', 'cal');
		await nextTick();
		expect(current.activeTab.value).toBe('hataskapps');
		current.currentRouter.currentRef.value.props.set('tab', 'todo');
		await nextTick();
		expect(current.activeTab.value).toBe('todo');
		current.currentRouter.currentRef.value.props.set('tab', 'hataskapps');
		await nextTick();
		expect(current.activeTab.value).toBe('hataskapps');
	});

	test.each(['koke', 'kisetsu', 'kashin', 'suri', 'hatakyu'])('保存済みテーマ%sでもAppへのqueryで共通画面を表示する', theme => {
		expect(introReturnFixture({ theme, tab: 'hataskapps' }).activeTab.value).toBe('hataskapps');
	});

	test('保存済みテーマの非同期読込や切替でも現在のタブを保つ', async () => {
		const current = introReturnFixture({ tab: 'hataskapps' });
		expect(current.activeTab.value).toBe('hataskapps');
		current.settings.value.theme = 'hatakyu';
		await nextTick();
		expect(current.activeTab.value).toBe('hataskapps');
		current.activeTab.value = 'todo';
		current.settings.value.theme = 'akatsuki';
		await nextTick();
		expect(current.activeTab.value).toBe('todo');
	});

	test.each(['eye', 'unknown', 'apps'])('許可外のquery %s はホームへ戻す', async tab => {
		const current = introReturnFixture({ tab });
		expect(current.activeTab.value).toBe('home');
		current.currentRouter.currentRef.value.props.set('tab', 'garden');
		await nextTick();
		expect(current.activeTab.value).toBe('garden');
		current.currentRouter.currentRef.value.props.set('tab', tab);
		await nextTick();
		expect(current.activeTab.value).toBe('home');
	});

	test('既存通知の遷移と明示tabの優先順位を保つ', () => {
		expect(introReturnFixture({ notice: 'mood' }).activeTab.value).toBe('mood');
		expect(introReturnFixture({ notice: 'calendar' }).activeTab.value).toBe('cal');
		expect(introReturnFixture({ tab: 'hataskapps', notice: 'calendar' }).activeTab.value).toBe('hataskapps');
	});
});

describe('MkPageWindowからの終了ハンドラー注入と閉鎖ライフサイクル', () => {
	test('HataGoes内のIntroだけ外枠の戻るを隠し、同じwindowの画面切替で復帰する', () => {
		const currentRef = ref({ _parsedRoute: { fullPath: hatagoesUrl('/hatask?tab=todo') } });
		const windowHistory = ref([{ path: '/hatagoes' }, { path: currentRef.value._parsedRoute.fullPath }]);
		const back = vi.fn();
		const buttons = evaluate<{ value: Array<{ onClick: () => void }> }>(`const ${declaration(frame, 'buttonsLeft').getText(frame)}; buttonsLeft;`, {
			computed, windowRouter: { currentRef }, _history_: windowHistory, isHatagoesIntroPath, i18n: { ts: { goBack: '戻る' } }, back,
		});
		expect(buttons.value).toHaveLength(1);
		for (const path of ['/hatask/intro?from=hataskapps#guide', '/hata-docs']) {
			currentRef.value = { _parsedRoute: { fullPath: hatagoesUrl(path) } };
			expect(buttons.value).toHaveLength(0);
			currentRef.value = { _parsedRoute: { fullPath: hatagoesUrl('notifications') } };
			expect(buttons.value).toHaveLength(1);
		}
		currentRef.value = { _parsedRoute: { fullPath: '/hatask/intro' } };
		expect(buttons.value).toHaveLength(1);
		buttons.value[0].onClick();
		expect(back).toHaveBeenCalledOnce();
		expect(windowHistory.value).toHaveLength(2);
		windowHistory.value = [{ path: '/hatask/intro' }];
		expect(buttons.value).toHaveLength(0);
	});

	test('実DI宣言・provide・injectから既存windowEl.closeまで同じコールバックを結線する', () => {
		const initializer = declaration(di, 'DI').initializer;
		if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error('Missing DI object');
		const property = initializer.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(di) === 'pageWindowClose');
		if (!property || !ts.isPropertyAssignment(property)) throw new Error('Missing page window close key');
		expect(property.initializer.getText(di)).toMatch(/Symbol\(\)\s+as\s+InjectionKey<\(\)\s*=>\s*void>/u);
		const DI = evaluate<{ pageWindowClose: symbol }>(`const DI = ${initializer.getText(di)}; DI;`, {});
		expect(typeof DI.pageWindowClose).toBe('symbol');
		const provided = new Map<symbol, unknown>();
		const windowClose = vi.fn();
		const exposed = vi.fn();
		const unmountCallbacks: Array<() => void> = [];
		const openingWindowsCount = { value: 2 };
		evaluate(`${functionNode(frame, 'close').getText(frame)}\n${callStatement(frame, 'provide', 'DI.pageWindowClose').getText(frame)}\n${callStatement(frame, 'defineExpose').getText(frame)}\n${callStatement(frame, 'onUnmounted').getText(frame)}`, {
			DI, windowEl: { value: { ['close']: windowClose } }, openingWindowsCount,
			provide: (key: symbol, value: unknown) => provided.set(key, value),
			defineExpose: exposed,
			onUnmounted: (callback: () => void) => unmountCallbacks.push(callback),
		});
		const variable = declaration(page, 'closePageWindow');
		const inject = vi.fn((key: symbol, fallback: null) => provided.get(key) ?? fallback);
		const injected = evaluate<(() => void) | null>(`const ${variable.getText(page)}; closePageWindow;`, { DI, inject });
		expect(inject).toHaveBeenCalledWith(DI.pageWindowClose, null);
		expect(injected).toBe(provided.get(DI.pageWindowClose));
		expect(exposed).toHaveBeenCalledWith({ ['close']: injected });
		if (!injected) throw new Error('Missing provided close callback');
		const current = fixture({ tab: 'todo', inWindow: true, providedClose: injected });
		current.exitHatask();
		expect(windowClose).toHaveBeenCalledTimes(1);
		expect(current.route.value).toBe('/hatask');
		expect(current.cleanupHataskState).not.toHaveBeenCalled();
		expect(openingWindowsCount.value).toBe(2);
		expect(unmountCallbacks).toHaveLength(1);
		unmountCallbacks[0]();
		expect(openingWindowsCount.value).toBe(1);
	});

	test('注入先がない通常ページではnullを使い、window ref欠落時のcloseも安全に終わる', () => {
		const variable = declaration(page, 'closePageWindow');
		const injected = evaluate<unknown>(`const ${variable.getText(page)}; closePageWindow;`, { DI: { pageWindowClose: Symbol() }, inject: (_key: symbol, fallback: unknown) => fallback });
		expect(injected).toBeNull();
		expect(() => evaluate(`${functionNode(frame, 'close').getText(frame)}\nclose();`, { windowEl: { value: null } })).not.toThrow();
	});

	test('閉窓のclosed通知とHataskの既存unmount cleanupを早期に横取りしない', () => {
		const template = parse(source('src/components/MkPageWindow.vue')).descriptor.template?.content;
		if (!template) throw new Error('Missing page window template');
		const fragment = window.document.createElement('template'); fragment.innerHTML = template;
		const closedExpression = fragment.content.querySelector('MkWindow')?.getAttribute('@closed');
		if (!closedExpression) throw new Error('Missing original window closed event');
		const emit = vi.fn();
		const windowClose = vi.fn();
		evaluate(`${functionNode(frame, 'close').getText(frame)}\nclose();`, { windowEl: { value: { ['close']: windowClose } }, emit });
		expect(windowClose).toHaveBeenCalledTimes(1);
		expect(emit).not.toHaveBeenCalled();
		evaluate(closedExpression, { emit });
		expect(emit).toHaveBeenCalledWith('closed');
		const cleanupHataskState = vi.fn();
		const invalidateCommunityFlowers = vi.fn();
		let beforeUnmount: (() => void) | undefined;
		evaluate(callStatement(page, 'onBeforeUnmount').getText(page), { cleanupHataskState, invalidateCommunityFlowers, onBeforeUnmount: (callback: () => void) => { beforeUnmount = callback; } });
		expect(cleanupHataskState).not.toHaveBeenCalled();
		expect(invalidateCommunityFlowers).not.toHaveBeenCalled();
		if (!beforeUnmount) throw new Error('Missing Hatask unmount callback');
		beforeUnmount();
		expect(cleanupHataskState).toHaveBeenCalledTimes(1);
		expect(invalidateCommunityFlowers).toHaveBeenCalledTimes(1);
	});
});
