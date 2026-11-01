/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, nextTick, ref, watch } from 'vue';
import { afterEach, describe, expect, test } from 'vitest';

const filename = resolve(process.cwd(), 'src/pages/hatask.vue');
const page = readFileSync(filename, 'utf8');
const { descriptor } = parse(page, { filename });
if (!descriptor.scriptSetup || !descriptor.template) throw new Error('Missing Hatask SFC');
const template = descriptor.template.content;
const script = ts.createSourceFile('hatask.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const tabs = script.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations])
	.find(declaration => declaration.name.getText(script) === 'tabs')?.initializer;
const routeWatch = script.statements.find(statement => ts.isExpressionStatement(statement)
	&& ts.isCallExpression(statement.expression) && statement.expression.expression.getText(script) === 'watch'
	&& statement.expression.arguments[0].getText(script).includes('routeRouter.currentRef.value.props.get(\'tab\')'));
if (!tabs || !routeWatch) throw new Error('Missing actual tabs or route watcher');
const tabsSource = tabs.getText(script);
const routeWatchSource = routeWatch.getText(script);
const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); });

// Execute the page's actual allowlist and watcher, including Vue query updates.
function routeFixture(tab?: string, notice?: string, legacyEye = false) {
	const activeTab = ref('home');
	const route = ref({ props: new Map<string, string | undefined>([['tab', tab], ['notice', notice]]) });
	const scope = effectScope();
	scopes.push(scope);
	const code = `const tabs = ${tabsSource}; ${legacyEye ? 'tabs.value.push({ id: \'eye\' });' : ''}\n${routeWatchSource}\ntabs.value.map(tab => tab.id);`;
	const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	const ids = scope.run(() => runInNewContext(compiled, {
		computed, watch, activeTab, routeRouter: { currentRef: route }, props: { embedded: false }, copy: {}, canReviewRecords: ref(false),
		i18n: { ts: { _hata: { _hatask: { _ranking: { title: 'ランキング' }, _akatsuki: { recipeTab: 'レシピ', supportTab: 'おうえん', reviewTab: '審査' } } } } },
	}, { timeout: 1000 })) as string[];
	return { activeTab, route, ids };
}

describe('Hatask EYEタブの削除', () => {
	test('旧EYEのURLは初回表示もクエリ変更もホームに戻す', async () => {
		const current = routeFixture('eye');
		expect(current.ids).toEqual(['home', 'cal', 'todo', 'mood', 'meal', 'recipe', 'garden', 'support', 'ranking']);
		expect(current.activeTab.value).toBe('home');
		current.route.value.props.set('tab', 'garden');
		await nextTick();
		expect(current.activeTab.value).toBe('garden');
		current.route.value.props.set('tab', 'eye');
		await nextTick();
		expect(current.activeTab.value).toBe('home');
		// Positive control: restoring the retired allowlist entry recreates the broken destination.
		expect(routeFixture('eye', undefined, true).activeTab.value).toBe('eye');
	});

	test.each([
		['todo', 'mood', 'todo'], [undefined, 'mood', 'mood'], [undefined, 'calendar', 'cal'],
		['ranking', undefined, 'ranking'], ['support', undefined, 'support'], ['unknown', undefined, 'home'],
	])('既存のtab=%s / notice=%sは%sを保つ', (tab, notice, expected) => {
		expect(routeFixture(tab, notice).activeTab.value).toBe(expected);
	});

	test('削除したタブへ飛ぶ操作や旧テーマの専用表示を残さない', () => {
		const detectRetiredTab = (source: string) => /(?:activeTab\s*(?:===|=)|\btab\s*:|\bid\s*:)\s*['"]eye['"]|open-eye|tab=eye/u.test(source);
		expect(detectRetiredTab('<div v-if="activeTab===\'eye\'">EYE</div>')).toBe(true);
		expect(detectRetiredTab('{ tab: \'eye\' }')).toBe(true);
		expect(detectRetiredTab(page)).toBe(false);
		expect(template).not.toContain('{{eyePhrase}}');
		expect(page).toContain('function updateEyePhrase()');
		expect(template).toContain('<HataskFlowerCare');
		expect(page).not.toMatch(/\.o1a \.eye\{[^}]*cursor:pointer/u);
	});

	test('EYEページを除いた本体テンプレートをコンパイルできる', () => {
		const result = compileTemplate({ source: template, filename, id: 'hatask-eye-removal' });
		expect(result.errors).toEqual([]);
		expect(result.code).toContain('HataskAkatsukiLayout');
		const control = compileTemplate({ source: '<div><span></div>', filename, id: 'invalid-control' });
		expect(control.errors.length).toBeGreaterThan(0);
	});
});
