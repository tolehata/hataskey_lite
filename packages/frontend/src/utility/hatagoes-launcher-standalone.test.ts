/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { effectScope, nextTick, ref, watch } from 'vue';
import { describe, expect, test, vi } from 'vitest';
import { HATAGOES_CATALOG } from './hatagoes-catalog.js';

function usageWatch(page: 'hatady' | 'hatafeed') {
	const filename = `src/pages/${page}.vue`;
	const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
	const setup = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const marker = page === 'hatady' ? 'hatadyUsageScreenIds' : 'hataFeedUsageScreenIds';
	const statement = setup.statements.find(item => ts.isExpressionStatement(item) && ts.isCallExpression(item.expression)
		&& item.expression.expression.getText(setup) === 'watch' && item.getText(setup).includes(marker));
	if (!statement) throw new Error(`Missing ${page} usage watcher`);
	return ts.transpileModule(statement.getText(setup), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

describe('standalone HataGoes usage accounting', () => {
	test('Hatady records its actual tab only outside an embedded pane', async () => {
		const code = usageWatch('hatady');
		const calls: string[] = [];
		const scope = effectScope();
		try {
			const activeTab = ref('records');
			const bindings = {
				watch, activeTab, props: { embedded: false },
				hatadyUsageScreenIds: { home: 'hatady.home', records: 'hatady.records', collection: 'hatady.collection' },
				recordHatagoesScreenUsage: (_user: string, id: string) => calls.push(id),
				$i: { id: 'owner' }, hatadyUsageScreens: HATAGOES_CATALOG,
			};
			scope.run(() => new Function(...Object.keys(bindings), code)(...Object.values(bindings)));
			expect(calls).toEqual(['hatady.records']);
			activeTab.value = 'collection'; await nextTick();
			expect(calls).toEqual(['hatady.records', 'hatady.collection']);
		} finally { scope.stop(); }
		const embeddedCalls = vi.fn();
		const embeddedScope = effectScope();
		try {
			const activeTab = ref('home');
			const bindings = {
				watch, activeTab, props: { embedded: true }, hatadyUsageScreenIds: { home: 'hatady.home', records: 'hatady.records' },
				recordHatagoesScreenUsage: embeddedCalls, $i: { id: 'owner' }, hatadyUsageScreens: HATAGOES_CATALOG,
			};
			embeddedScope.run(() => new Function(...Object.keys(bindings), code)(...Object.values(bindings)));
			activeTab.value = 'records'; await nextTick();
			expect(embeddedCalls).not.toHaveBeenCalled();
		} finally { embeddedScope.stop(); }
	});

	test('HataFeed waits for access and never counts embedded tab restoration', async () => {
		const code = usageWatch('hatafeed');
		const calls: string[] = [];
		const scope = effectScope();
		try {
			const activeTab = ref('issues');
			const canAccess = ref(false);
			const isStaff = ref(false);
			const bindings = {
				watch, activeTab, canAccess, isStaff, props: { embedded: false },
				hataFeedUsageScreenIds: { home: 'hatafeed.home', issues: 'hatafeed.issues', emoji: 'hatafeed.emoji' },
				recordHatagoesScreenUsage: (_user: string, id: string) => calls.push(id),
				$i: { id: 'owner' }, HATAGOES_CATALOG,
			};
			scope.run(() => new Function(...Object.keys(bindings), code)(...Object.values(bindings)));
			expect(calls).toEqual([]);
			canAccess.value = true; await nextTick();
			expect(calls).toEqual(['hatafeed.issues']);
		} finally { scope.stop(); }
		const embeddedCalls = vi.fn();
		const embeddedScope = effectScope();
		try {
			const activeTab = ref('home');
			const bindings = {
				watch, activeTab, canAccess: ref(true), isStaff: ref(false), props: { embedded: true },
				hataFeedUsageScreenIds: { home: 'hatafeed.home', issues: 'hatafeed.issues' },
				recordHatagoesScreenUsage: embeddedCalls, $i: { id: 'owner' }, HATAGOES_CATALOG,
			};
			embeddedScope.run(() => new Function(...Object.keys(bindings), code)(...Object.values(bindings)));
			activeTab.value = 'issues'; await nextTick();
			expect(embeddedCalls).not.toHaveBeenCalled();
		} finally { embeddedScope.stop(); }
	});
});
