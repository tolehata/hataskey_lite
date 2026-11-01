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
import { afterEach, describe, expect, test } from 'vitest';
import type { ComputedRef } from 'vue';

const filename = resolve(process.cwd(), 'src/pages/hatask.vue');
const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor;
if (!descriptor.scriptSetup) throw new Error('Missing Hatask script setup');
const page = ts.createSourceFile('hatask.vue.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); });

function initializer(name: string): ts.Expression {
	for (const statement of page.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const found = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name);
		if (found?.initializer) return found.initializer;
	}
	throw new Error(`Missing Hatask initializer: ${name}`);
}

function modeExpression(legacyControl: boolean): string {
	const expression = initializer('themeMode');
	if (!legacyControl) return expression.getText(page);
	let removed = 0;
	const transformed = ts.transform(expression, [context => root => {
		function visit(node: ts.Node): ts.Node {
			if (ts.isBlock(node)) {
				const statements = node.statements.filter(statement => {
					if (ts.isIfStatement(statement) && statement.expression.getText(page) === "isAkatsuki.value || settings.value.theme === 'koke' || settings.value.theme === 'halloween'") {
						removed++;
						return false;
					}
					return true;
				});
				return ts.visitEachChild(ts.factory.updateBlock(node, statements), visit, context);
			}
			return ts.visitEachChild(node, visit, context);
		}

		return ts.visitNode(root, visit) as ts.Expression;
	}]);
	try {
		if (removed !== 1) throw new Error(`Expected one Akatsuki branch for the positive control, found ${removed}`);
		return ts.createPrinter().printNode(ts.EmitHint.Expression, transformed.transformed[0], page);
	} finally {
		transformed.dispose();
	}
}

type Mode = 'dark' | 'light';
type Settings = { theme?: string | null; autoTheme?: boolean; darkMode?: boolean };
type Options = { settings?: Settings; osDark?: boolean; appDark?: boolean; detected?: Mode; legacyControl?: boolean };

function fixture(options: Options = {}) {
	const settings = ref<Settings>({ theme: 'akatsuki', autoTheme: true, darkMode: false, ...options.settings });
	const prefersDark = ref(options.osDark ?? false);
	const misskeyTheme = ref<Mode>(options.detected ?? 'light');
	const appDark = ref(options.appDark ?? false);
	const store = { r: { darkMode: appDark } };
	const code = [
		`const isAkatsuki = ${initializer('isAkatsuki').getText(page)};`,
		`const themeMode = ${modeExpression(options.legacyControl ?? false)};`,
		'({ isAkatsuki, themeMode });',
	].join('\n');
	const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
	const modes = runInNewContext(compiled.outputText, { computed, settings, prefersDark, misskeyTheme, store }, { timeout: 1000 }) as {
		isAkatsuki: ComputedRef<boolean>;
		themeMode: ComputedRef<Mode>;
	};
	return { ...modes, settings, prefersDark, misskeyTheme, appDark };
}

// Keep all eight signal combinations explicit; legacy expectations are independent of the page's OR expression.
const signals = [
	{ osDark: false, appDark: false, detected: 'light', legacy: 'light' },
	{ osDark: false, appDark: true, detected: 'light', legacy: 'light' },
	{ osDark: false, appDark: false, detected: 'dark', legacy: 'dark' },
	{ osDark: false, appDark: true, detected: 'dark', legacy: 'dark' },
	{ osDark: true, appDark: false, detected: 'light', legacy: 'dark' },
	{ osDark: true, appDark: true, detected: 'light', legacy: 'dark' },
	{ osDark: true, appDark: false, detected: 'dark', legacy: 'dark' },
	{ osDark: true, appDark: true, detected: 'dark', legacy: 'dark' },
] as const;
const legacyThemes = ['kisetsu', 'kashin', 'suri', 'hatakyu'] as const;

describe('Hatask暁の自動配色と本体テーマの接続', () => {
	test('本体のstoreを実値importし、実ページのcomputed宣言を検査する', () => {
		function assertStoreImport(file: ts.SourceFile) {
			const bindings = file.statements.flatMap(statement => {
				if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
					|| statement.moduleSpecifier.text !== '@/store.js' || !statement.importClause || statement.importClause.isTypeOnly) return [];
				const names = statement.importClause.namedBindings;
				if (!names || !ts.isNamedImports(names)) return [];
				return names.elements.filter(item => !item.isTypeOnly && item.name.text === 'store' && (item.propertyName?.text ?? item.name.text) === 'store');
			});
			expect(bindings).toHaveLength(1);
		}

		for (const incorrect of ['import type { store } from \'@/store.js\';', 'import { store } from \'@/preferences.js\';']) {
			expect(() => assertStoreImport(ts.createSourceFile('control.ts', incorrect, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))).toThrow();
		}
		assertStoreImport(page);
		expect(() => initializer('missingThemePositiveControl')).toThrow('Missing Hatask initializer:');
		for (const name of ['isAkatsuki', 'themeMode']) {
			const expression = initializer(name);
			expect(ts.isCallExpression(expression)).toBe(true);
			if (!ts.isCallExpression(expression)) throw new Error(`Not computed: ${name}`);
			expect(expression.expression.getText(page)).toBe('computed');
		}
	});

	test.each(signals)('暁はOS=$osDark・旧判定=$detectedでも本体darkMode=$appDarkだけを使う', signal => {
		const current = fixture(signal);
		expect(current.isAkatsuki.value).toBe(true);
		expect(current.themeMode.value).toBe(signal.appDark ? 'dark' : 'light');
	});

	test.each(signals)('苔はOS=$osDark・旧判定=$detectedでも本体darkMode=$appDarkに追従する', signal => {
		const current = fixture({ ...signal, settings: { theme: 'koke' } });
		expect(current.isAkatsuki.value).toBe(false);
		expect(current.themeMode.value).toBe(signal.appDark ? 'dark' : 'light');
		current.appDark.value = !signal.appDark;
		expect(current.themeMode.value).toBe(signal.appDark ? 'light' : 'dark');
	});

	test.each(signals)('ハロウィンはOS=$osDark・旧判定=$detectedでも設定プレビューと同じ本体darkMode=$appDarkを使う', signal => {
		const current = fixture({ ...signal, settings: { theme: 'halloween' } });
		expect(current.themeMode.value).toBe(signal.appDark ? 'dark' : 'light');
		current.appDark.value = !signal.appDark;
		expect(current.themeMode.value).toBe(signal.appDark ? 'light' : 'dark');
	});

	test('本体テーマ変更にリアクティブに追従し、OSや旧DOM色判定だけの変更では配色を変えない', async () => {
		const current = fixture();
		const seen: Mode[] = [];
		const scope = effectScope();
		scopes.push(scope);
		scope.run(() => watch(current.themeMode, value => seen.push(value), { immediate: true }));
		expect(seen).toEqual(['light']);
		current.prefersDark.value = true;
		current.misskeyTheme.value = 'dark';
		await nextTick();
		expect(seen).toEqual(['light']);
		current.appDark.value = true;
		await nextTick();
		expect(seen).toEqual(['light', 'dark']);
		current.appDark.value = false;
		await nextTick();
		expect(seen).toEqual(['light', 'dark', 'light']);
	});

	test.each(legacyThemes)('旧%sテーマはOSと既存Misskey色判定のORを保ち、本体darkModeを混ぜない', theme => {
		for (const signal of signals) {
			const current = fixture({ ...signal, settings: { theme } });
			expect(current.isAkatsuki.value).toBe(false);
			expect(current.themeMode.value).toBe(signal.legacy);
			current.appDark.value = !signal.appDark;
			expect(current.themeMode.value).toBe(signal.legacy);
		}
	});

	test.each(['akatsuki', 'koke', 'halloween', ...legacyThemes, undefined])('autoを切った%sテーマは手動値を優先し、autoへ戻しても手動値を失わない', theme => {
		const current = fixture({ settings: { theme, autoTheme: false, darkMode: false }, osDark: true, appDark: true, detected: 'dark' });
		expect(current.themeMode.value).toBe('light');
		current.settings.value.darkMode = true;
		expect(current.themeMode.value).toBe('dark');
		current.appDark.value = false;
		current.prefersDark.value = false;
		current.misskeyTheme.value = 'light';
		expect(current.themeMode.value).toBe('dark');
		current.settings.value.autoTheme = true;
		expect(current.themeMode.value).toBe('light');
		expect(current.settings.value.darkMode).toBe(true);
		current.settings.value.autoTheme = false;
		expect(current.themeMode.value).toBe('dark');
	});

	test.each([undefined, null, ''])('theme=%sの旧保存値は暁へフォールバックし、本体配色を使う', theme => {
		const current = fixture({ settings: { theme }, osDark: true, appDark: false, detected: 'dark' });
		expect(current.isAkatsuki.value).toBe(true);
		expect(current.themeMode.value).toBe('light');
		current.appDark.value = true;
		expect(current.themeMode.value).toBe('dark');
		expect(current.settings.value.theme).toBe(theme);
	});

	test('保存設定の置き換えや旧テーマへの切替後も、現在のテーマに合った自動判定を使う', () => {
		const current = fixture({ osDark: true, appDark: false });
		expect(current.themeMode.value).toBe('light');
		current.settings.value = { theme: 'suri', autoTheme: true, darkMode: false };
		expect(current.themeMode.value).toBe('dark');
		current.settings.value.theme = 'akatsuki';
		expect(current.themeMode.value).toBe('light');
		current.settings.value = { autoTheme: true, darkMode: true };
		expect(current.isAkatsuki.value).toBe(true);
		expect(current.themeMode.value).toBe('light');
	});

	test('暁分岐を除去して旧ORへ差し戻す陽性対照は、OSと本体の逆転を検出する', () => {
		for (const signal of [
			{ osDark: true, appDark: false, detected: 'light' as const },
			{ osDark: false, appDark: true, detected: 'light' as const },
		]) {
			const expected = signal.appDark ? 'dark' : 'light';
			const legacy = fixture({ ...signal, legacyControl: true });
			expect(() => expect(legacy.themeMode.value).toBe(expected)).toThrow();
			const current = fixture(signal);
			expect(current.themeMode.value).toBe(expected);
		}
	});
});
