/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, ref } from 'vue';
import { describe, expect, test, vi } from 'vitest';
import type { ComputedRef, Ref } from 'vue';

const filename = 'src/pages/hatask.vue';
const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
if (!descriptor.scriptSetup) throw new Error('Missing Hatask script setup');
const page = ts.createSourceFile(filename + '.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function functionNode(name: string): ts.FunctionDeclaration & { body: ts.Block } {
	const node = page.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
	if (!node || !ts.isFunctionDeclaration(node) || !node.body) throw new Error(`Missing function: ${name}`);
	return node as ts.FunctionDeclaration & { body: ts.Block };
}

function declaration(name: string, statements: ts.NodeArray<ts.Statement> = page.statements): string {
	for (const statement of statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const node = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name);
		if (node) return `${statement.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let'} ${node.getText(page)};`;
	}
	throw new Error(`Missing variable: ${name}`);
}

function lifecycle(name: string): ts.Block {
	const statement = page.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(page) === name && (name !== 'onMounted' || node.getText(page).includes('const defaultSettings')) && (name !== 'onUnmounted' || node.getText(page).includes('cleanupHataskState')));
	if (!statement || !ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) throw new Error(`Missing lifecycle: ${name}`);
	const callback = statement.expression.arguments.at(0);
	if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) throw new Error(`Missing lifecycle callback: ${name}`);
	return callback.body;
}

function paneActiveWatcher(): ts.Block {
	const statement = page.statements.find(node =>
		ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) &&
		node.expression.expression.getText(page) === 'watch' &&
		node.expression.arguments[0]?.getText(page) === '() => props.paneActive',
	);
	if (!statement || !ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) throw new Error('Missing paneActive watcher');
	const callback = statement.expression.arguments[1];
	if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) throw new Error('Missing paneActive callback');
	return callback.body;
}

function statementMatching(statements: ts.NodeArray<ts.Statement>, pattern: RegExp): ts.Statement {
	const matches = statements.filter(statement => pattern.test(statement.getText(page)));
	if (matches.length !== 1) throw new Error(`Expected one source statement for ${pattern}, found ${matches.length}`);
	return matches[0];
}

const mountBody = lifecycle('onMounted');
const mountSettingsStatements = [
	declaration('defaultSettings', mountBody.statements),
	declaration('loadResults', mountBody.statements),
	statementMatching(mountBody.statements, /^if \(loadResults\[5\]/u).getText(page),
	statementMatching(mountBody.statements, /^settings\.value = \{ \.\.\.defaultSettings,/u).getText(page),
	statementMatching(mountBody.statements, /^hataskIntroductionReady = true;/u).getText(page),
	statementMatching(mountBody.statements, /^showHataskIntroduction\(\);$/u).getText(page),
];

function sourceFunctions(removeReadGuard = false): string {
	return ['registryGet', 'registrySet', 'saveSettings', 'acceptLoadedHataskSettings', 'showHataskIntroduction', 'startTutFromTheme', 'skipTutorial', 'reopenTutorial', 'cleanupHataskState'].map(name => {
		const node = functionNode(name);
		if (!removeReadGuard || name !== 'showHataskIntroduction') return node.getText(page);
		const guard = node.body.statements[0];
		if (!ts.isIfStatement(guard) || !guard.expression.getText(page).includes('!loadedKeys.has(\'settings\')')) throw new Error('Missing read guard for positive control');
		// Remove the actual first guard to demonstrate that a failed read would otherwise open onboarding.
		const body = ts.factory.updateBlock(node.body, node.body.statements.filter(statement => statement !== guard));
		const mutant = ts.factory.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, body);
		return ts.createPrinter().printNode(ts.EmitHint.Unspecified, mutant, page);
	}).join('\n');
}

type Settings = Record<string, unknown>;
type State = {
	settings: Ref<Settings>;
	loadedKeys: Set<string>;
	showTutorial: Ref<boolean>;
	showTutTheme: Ref<boolean>;
	tutStep: Ref<number>;
	tutThemes: ComputedRef<Array<{ id: string }>>;
	active: boolean;
	ready: boolean;
	loadFromMount: () => Promise<void>;
	activate: () => void;
	setPaneActive: (active: boolean) => void;
	deactivate: () => void;
	unmount: () => void;
	acceptLoadedHataskSettings: (value: unknown) => boolean;
	showHataskIntroduction: () => void;
	startTutFromTheme: () => void;
	skipTutorial: () => void;
	reopenTutorial: () => void;
};

function deferred<T>() {
	let succeed: (value: T) => void = () => { throw new Error('Deferred promise not initialized'); };
	let fail: (reason: unknown) => void = () => { throw new Error('Deferred promise not initialized'); };
	const promise = new Promise<T>((resolveValue, rejectValue) => { succeed = resolveValue; fail = rejectValue; });
	return { promise, succeed, fail };
}

function fixture(options: { settings?: unknown; removeReadGuard?: boolean; embedded?: boolean; paneActive?: boolean } = {}) {
	const saved = { theme: 'kisetsu', tutorialDone: true, v2Onboarded: true, animations: true, akatsukiNoticeShown: false, hatakyuNoticeShown: false, customPreference: { keep: ['saved'] } };
	const readSettings = vi.fn(async (): Promise<unknown> => Object.hasOwn(options, 'settings') ? options.settings : saved);
	const writeSettings = vi.fn(async (_value: unknown): Promise<void> => undefined);
	const misskeyApi = vi.fn(async (endpoint: string, params: { key: string; scope: string[]; value?: unknown }) => {
		if (endpoint === 'i/registry/get') return params.key === 'settings' ? readSettings() : undefined;
		if (endpoint === 'i/registry/set' && params.key === 'settings') return writeSettings(params.value);
		throw new Error(`Unexpected API: ${endpoint}/${params.key}`);
	});
	const popup = vi.fn();
	const nextTick = vi.fn((callback: () => unknown) => Promise.resolve(callback()));
	const variables = ['SCOPE', 'loadedKeys', 'settings', 'hataskPageActive', 'hataskIntroductionReady', 'showTutorial', 'showTutTheme', 'tutStep', 'tutThemes'].map(name => declaration(name)).join('\n');
	// Execute the actual relevant mount/activation statements, leaving unrelated clocks, flowers and network subscriptions outside this fixture.
	const activation = [/^hataskPageActive = !props\.embedded \|\| props\.paneActive;/u, /^showHataskIntroduction\(\);$/u].map(pattern => statementMatching(lifecycle('onActivated').statements, pattern).getText(page)).join('\n');
	const paneActivation = paneActiveWatcher().getText(page);
	const code = `${variables}\n${sourceFunctions(options.removeReadGuard)}
	async function loadFromMount() { ${mountSettingsStatements.join('\n')} }
	function activate() { ${activation} }
	function setPaneActive(active) { props.paneActive = active; ${paneActivation} }
	function deactivate() { ${statementMatching(lifecycle('onDeactivated').statements, /^cleanupHataskState\(\);$/u).getText(page)} }
	function unmount() { ${statementMatching(lifecycle('onBeforeUnmount').statements, /^cleanupHataskState\(\);$/u).getText(page)} }
	({ settings, loadedKeys, showTutorial, showTutTheme, tutStep, tutThemes,
		get active() { return hataskPageActive; }, get ready() { return hataskIntroductionReady; },
		loadFromMount, activate, setPaneActive, deactivate, unmount, acceptLoadedHataskSettings, showHataskIntroduction, startTutFromTheme, skipTutorial, reopenTutorial });`;

	const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
	const documentFixture = { body: { dataset: {} }, querySelectorAll: () => [] };
	const state = runInNewContext(compiled.outputText, {
		props: { embedded: options.embedded ?? false, paneActive: options.paneActive ?? true },
		ref, computed, nextTick, misskeyApi,
		isPlannerCollectionKey: () => false, defaultFlower: {}, HATASK_MEAL_TEMPLATE_KEY: 'meal-templates',
		copy: {},
		i18n: { ts: { _hata: { _hatask: { _settings: {} } } } },
		os: { popup },
		closeFlowerDetail: vi.fn(), closeFlowerCollection: vi.fn(), closeEventDetail: vi.fn(), closeBlankCalendarActions: vi.fn(), hatakMascotActive: ref(true), stopMascotCardRotation: vi.fn(),
		hfTimer: null, eqPollTimer: null, eqStream: null, showMobileNav: ref(true), navProtectionObserver: null, navVisibilityTimer: null,
		canAccessHataFeed: ref(false), refreshSharedEventAccess: vi.fn(), invalidateCommunityFlowers: vi.fn(),
		useStream: () => ({ state: 'connected', on: vi.fn(), off: vi.fn() }),
		streamConnected: ref(false), onEqEvent: vi.fn(), onEqStreamConn: vi.fn(), onEqStreamDisc: vi.fn(), startEqPoll: vi.fn(),
		['document']: documentFixture,
		window: { document: documentFixture },
	}, { timeout: 1000 }) as State;

	return { state, readSettings, writeSettings, misskeyApi, popup };
}

describe('Hataskの初回導入と設定読込', () => {
	test('HataGoesで非表示のまま先読みした未完了案内は、初めてペインを開いた時に始まる', async () => {
		const current = fixture({ settings: { theme: 'akatsuki', tutorialDone: false }, embedded: true, paneActive: false });
		await current.state.loadFromMount();
		expect(current.state.ready).toBe(true);
		expect(current.state.showTutTheme.value).toBe(false);
		current.state.setPaneActive(true);
		expect(current.state.showTutTheme.value).toBe(true);
		expect(current.state.showTutorial.value).toBe(false);
		current.state.setPaneActive(false);
		current.state.setPaneActive(true);
		expect(current.state.showTutTheme.value).toBe(true);
		current.state.startTutFromTheme();
		current.state.tutStep.value = 3;
		current.state.setPaneActive(false);
		current.state.setPaneActive(true);
		expect(current.state.showTutorial.value).toBe(true);
		expect(current.state.tutStep.value).toBe(3);
		expect(current.writeSettings).not.toHaveBeenCalled();
	});

	test('HataGoesで先読みした完了済み案内は、ペインを開いても表示しない', async () => {
		const current = fixture({ settings: { theme: 'akatsuki', tutorialDone: true }, embedded: true, paneActive: false });
		await current.state.loadFromMount();
		current.state.setPaneActive(true);
		expect(current.state.showTutTheme.value).toBe(false);
		expect(current.state.showTutorial.value).toBe(false);
		expect(current.writeSettings).not.toHaveBeenCalled();
	});

	test('埋め込みの非表示ペインは再活性化しても導入画面を開かない', async () => {
		const current = fixture({ settings: { theme: 'akatsuki', tutorialDone: false }, embedded: true, paneActive: false });
		await current.state.loadFromMount();
		current.state.deactivate();
		current.state.activate();
		expect(current.state.active).toBe(false);
		expect(current.state.showTutorial.value).toBe(false);
	});

	test('旧版の案内を未読でも、既存利用者には再訪・再読込で告知せず保存済みテーマを保持する', async () => {
		const themes = ['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu', 'halloween'];
		for (const theme of themes) {
			for (const oldFlags of [{}, { v2Onboarded: false, akatsukiNoticeShown: false, hatakyuNoticeShown: false }]) {
				const saved = { theme, tutorialDone: true, customPreference: { keep: ['saved'] }, ...oldFlags };
				const current = fixture({ settings: saved });
				current.state.showHataskIntroduction();
				await current.state.loadFromMount();
				current.state.deactivate();
				current.state.activate();
				await current.state.loadFromMount();
				expect(current.state.settings.value).toMatchObject(saved);
				expect(current.state.tutThemes.value.map(item => item.id)).toEqual(themes);
				expect(current.state.showTutTheme.value).toBe(false);
				expect(current.state.showTutorial.value).toBe(false);
				expect(current.popup).not.toHaveBeenCalled();
				expect(current.writeSettings).not.toHaveBeenCalled();
			}
		}
	});

	test('通信失敗の既定値を成功扱いせず、初回導入と保存を止める（陽性対照付き）', async () => {
		for (const removeReadGuard of [true, false]) {
			const current = fixture({ removeReadGuard });
			current.readSettings.mockRejectedValue(new Error('offline'));
			await current.state.loadFromMount();
			expect(current.state.loadedKeys.has('settings')).toBe(false);
			expect(current.state.showTutTheme.value).toBe(removeReadGuard);
			expect(current.popup).not.toHaveBeenCalled();
			expect(current.writeSettings).not.toHaveBeenCalled();
		}
	});

	test.each([null, undefined, [], 'broken', 1, false].map(value => ({ value })))('不正な読込値 $value はsettingsを置換せず書込み権限を取り消す', ({ value }) => {
		const { state, writeSettings } = fixture();
		const before = state.settings.value;
		state.loadedKeys.add('settings');
		expect(state.acceptLoadedHataskSettings(value)).toBe(false);
		expect(state.settings.value).toBe(before);
		expect(state.loadedKeys.has('settings')).toBe(false);
		expect(writeSettings).not.toHaveBeenCalled();
	});

	test.each([null, []].map(settings => ({ settings })))('読込成功印がない値を拒否し、実registryGetから$settingsを受けても導入を出さない', async ({ settings }) => {
		const current = fixture({ settings });
		expect(current.state.acceptLoadedHataskSettings({ theme: 'suri' })).toBe(false);
		await current.state.loadFromMount();
		expect(current.state.loadedKeys.has('settings')).toBe(false);
		expect(current.state.showTutTheme.value).toBe(false);
		expect(current.popup).not.toHaveBeenCalled();
		expect(current.writeSettings).not.toHaveBeenCalled();
	});

	test('NO_SUCH_KEYは新規利用の正常な既定値としてテーマ選択だけを出す', async () => {
		const current = fixture();
		current.readSettings.mockRejectedValue({ code: 'NO_SUCH_KEY' });
		await current.state.loadFromMount();
		expect(current.state.loadedKeys.has('settings')).toBe(true);
		expect(current.state.settings.value.theme).toBe('akatsuki');
		expect(current.state.showTutTheme.value).toBe(true);
		expect(current.state.showTutorial.value).toBe(false);
		expect(current.popup).not.toHaveBeenCalled();
		expect(current.writeSettings).not.toHaveBeenCalled();
	});

	test('初回のテーマ選択から本編へ進み、スキップ後も既存テーマと保存内容を保持する', async () => {
		const current = fixture({ settings: { theme: 'hatakyu', tutorialDone: false, customPreference: { keep: ['saved'] } } });
		await current.state.loadFromMount();
		expect(current.state.showTutTheme.value).toBe(true);
		current.state.startTutFromTheme();
		expect(current.state.showTutorial.value).toBe(true);
		expect(current.state.showTutTheme.value).toBe(false);
		current.state.tutStep.value = 3;
		current.state.showHataskIntroduction();
		expect(current.state.tutStep.value).toBe(3);
		expect(current.state.showTutTheme.value).toBe(false);
		current.state.skipTutorial();
		expect(current.state.showTutorial.value).toBe(false);
		expect(current.state.settings.value).toMatchObject({ theme: 'hatakyu', tutorialDone: true, customPreference: { keep: ['saved'] } });
		expect(current.writeSettings).toHaveBeenCalledWith(current.state.settings.value);
		current.state.deactivate();
		current.state.activate();
		expect(current.state.showTutTheme.value).toBe(false);
		expect(current.popup).not.toHaveBeenCalled();
	});

	test('既存利用者は設定から明示的にチュートリアルを再表示できる', async () => {
		const current = fixture();
		await current.state.loadFromMount();
		const before = { ...current.state.settings.value };
		current.state.reopenTutorial();
		expect(current.state.showTutTheme.value).toBe(true);
		current.state.startTutFromTheme();
		expect(current.state.showTutTheme.value).toBe(false);
		expect(current.state.showTutorial.value).toBe(true);
		expect(current.state.tutStep.value).toBe(0);
		expect(current.state.settings.value).toEqual(before);
		expect(current.writeSettings).not.toHaveBeenCalled();
	});

	test('設定読込中に離脱した場合は初回導入も復帰まで待つ', async () => {
		const current = fixture();
		const read = deferred<Settings>();
		current.readSettings.mockReturnValueOnce(read.promise);
		const loading = current.state.loadFromMount();
		current.state.deactivate();
		read.succeed({ theme: 'suri', tutorialDone: false });
		await loading;
		expect(current.state.ready).toBe(true);
		expect(current.state.active).toBe(false);
		expect(current.state.showTutTheme.value).toBe(false);
		current.state.activate();
		expect(current.state.showTutTheme.value).toBe(true);
		expect(current.state.settings.value.theme).toBe('suri');
		expect(current.popup).not.toHaveBeenCalled();
		current.state.unmount();
		expect(current.state.active).toBe(false);
		expect(current.writeSettings).not.toHaveBeenCalled();
	});
});
