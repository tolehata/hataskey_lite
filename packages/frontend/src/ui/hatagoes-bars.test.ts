/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useHatagoesBarCollapse } from '@/utility/hatagoes-bar-collapse.js';

describe.each(['simple', 'universal'])('%s HataGoes bars', ui => {
	it('keeps the bars visible and applies open/close changes only to the current HataGoes visit', () => {
		const filename = `src/ui/${ui}.vue`;
		const sfc = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
		if (!sfc.scriptSetup || !sfc.template) throw new Error('Missing SFC blocks');
		const setup = ts.createSourceFile(filename, sfc.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const names = ['isHataGoesPage', 'sidebarCollapsed', 'rightWidgetsCollapsed'];
		const statements = setup.statements.filter(statement => ts.isVariableStatement(statement)
			&& statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)));
		const code = ts.transpileModule(`${statements.map(statement => statement.getText(setup)).join('\n')}\nreturn { sidebarCollapsed, rightWidgetsCollapsed };`, {
			compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
		}).outputText;
		const route = ref({ path: '/hatask' });
		const savedRight = ref(false);
		const savedLeft = ref(false);
		const commit = vi.fn();
		const setRight = vi.fn((value: boolean) => { savedRight.value = value; });
		const bindings = { computed, useHatagoesBarCollapse, mainRouter: { currentRoute: route }, prefer: { r: { 'simpleUi.sidebarCollapsed': savedLeft }, commit }, savedRightWidgetsCollapsed: savedRight, setRightWidgetsCollapsed: setRight };
		const scope = effectScope();
		try {
			const state = scope.run(() => new Function(...Object.keys(bindings), code)(...Object.values(bindings))) as {
				sidebarCollapsed: ReturnType<typeof ref<boolean>>;
				rightWidgetsCollapsed: ReturnType<typeof ref<boolean>>;
			};
			route.value = { path: '/hatagoes' };
			expect(state.sidebarCollapsed.value).toBe(true);
			expect(state.rightWidgetsCollapsed.value).toBe(true);
			state.sidebarCollapsed.value = false;
			state.rightWidgetsCollapsed.value = false;
			expect(commit).not.toHaveBeenCalled();
			expect(setRight).not.toHaveBeenCalled();
			state.sidebarCollapsed.value = true;
			state.rightWidgetsCollapsed.value = true;
			route.value = { path: '/hatask' };
			expect(state.sidebarCollapsed.value).toBe(false);
			expect(state.rightWidgetsCollapsed.value).toBe(false);
			state.rightWidgetsCollapsed.value = true;
			expect(setRight).toHaveBeenCalledWith(true);

			const template = sfc.template.content;
			expect(template).toContain('@toggleCollapse="rightWidgetsCollapsed = !rightWidgetsCollapsed"');
			expect(template).not.toContain('!deckActive && !isHataGoesPage');
			expect(template).not.toContain('!topNavActive && !isHataGoesPage');
			expect(template).not.toContain('!isMobile && !isHataGoesPage');
			expect(template).not.toContain('isDesktop && !isHataGoesPage');
		} finally {
			scope.stop();
		}
	});
});
