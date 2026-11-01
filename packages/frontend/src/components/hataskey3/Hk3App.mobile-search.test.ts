/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, nextTick, ref, shallowRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

const filename = 'src/components/hataskey3/Hk3App.vue';
const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
const setup = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = ['mobileMenuOpen', 'mobileSearchOpen', 'mobileDockExpanded', 'mobileDockSuspended', 'drawerOpen', 'mobilePane', 'mobilePaneOpener', 'onMobileSearchOpen', 'closeMobilePane'];
const statements = setup.statements.filter(statement => {
	if (ts.isFunctionDeclaration(statement)) return statement.name != null && names.includes(statement.name.text);
	if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(item => ts.isIdentifier(item.name) && names.includes(item.name.text));
	return ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
		&& statement.expression.expression.getText(setup) === 'watch' && statement.getText(setup).includes('mobileDockRef.value?.closeSearch(false)');
});
const code = ts.transpileModule(`${statements.map(statement => statement.getText(setup)).join('\n')}\nreturn { ${names.join(', ')} };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

async function mount() {
	const { watch } = await import('vue');
	const path = ref('/');
	const currentRef = ref({ path: '/' });
	const closeSearch = vi.fn(); const closeMenu = vi.fn(); const closeComposer = vi.fn();
	const isMobile = ref(true);
	const bindings = { ref, shallowRef, computed, nextTick, watch, path, mainRouter: { currentRef }, isMobile, mobileDockRef: ref({ closeSearch, closeMenu, closeComposer }), rootEl: ref<HTMLElement | null>(null) };
	const scope = effectScope();
	const state = scope.run(() => new Function(...Object.keys(bindings), code)(...Object.values(bindings))) as {
		mobileMenuOpen: ReturnType<typeof ref<boolean>>;
		mobileSearchOpen: ReturnType<typeof ref<boolean>>;
		mobileDockExpanded: ReturnType<typeof computed<boolean>>;
		mobileDockSuspended: ReturnType<typeof computed<boolean>>;
		drawerOpen: ReturnType<typeof ref<boolean>>;
		mobilePane: ReturnType<typeof ref<'hatask' | 'widgets' | null>>;
		onMobileSearchOpen: (open: boolean) => void;
	};
	cleanups.push(() => scope.stop());
	return { state, path, currentRef, isMobile, closeSearch, closeMenu, closeComposer };
}

describe('UI S mobile search parent integration', () => {
	it('uses the aggregate dock state for both background inert and timeline gesture/composer blocking', async () => {
		const view = await mount();
		view.state.drawerOpen.value = true; view.state.mobilePane.value = 'widgets'; await nextTick();
		view.state.onMobileSearchOpen(true);
		expect(view.state.drawerOpen.value).toBe(false); expect(view.state.mobilePane.value).toBeNull();
		expect(view.state.mobileDockExpanded.value).toBe(true);
		view.state.onMobileSearchOpen(false); expect(view.state.mobileDockExpanded.value).toBe(false);
		view.state.mobileMenuOpen.value = true; expect(view.state.mobileDockExpanded.value).toBe(true);
		const template = descriptor.template!.content;
		expect(template).toContain(':inert="confirmationActive || drawerOpen || mobileDockExpanded || mobilePane != null"');
		expect(template).toContain(':mobileMenuOpen="mobileDockExpanded || drawerOpen || mobilePane != null"');
		expect(template).toContain(':mobileComposerOpen="mobileDockRef?.composerOpened ?? false"');
		expect(template).toContain('@searchOpen="onMobileSearchOpen"');
	});

	it('closes search without focus restoration on route/query changes and preserves the off-home hold route exception', async () => {
		const view = await mount();
		view.path.value = '/search'; await nextTick();
		expect(view.closeSearch).toHaveBeenLastCalledWith(false);
		expect(view.closeComposer).toHaveBeenLastCalledWith(true);
		view.closeMenu.mockClear(); view.closeSearch.mockClear();
		view.path.value = '/'; view.currentRef.value = { path: '/?q=next' }; await nextTick();
		expect(view.closeSearch).toHaveBeenCalledWith(false);
		expect(view.closeMenu).not.toHaveBeenCalled();
		view.closeSearch.mockClear(); view.currentRef.value = { path: '/?q=other' }; await nextTick();
		expect(view.closeSearch).toHaveBeenCalledWith(false);
	});

	it('closes search for either mobile panel and clears the state on desktop transition', async () => {
		const view = await mount();
		view.state.drawerOpen.value = true; await nextTick(); expect(view.closeSearch).toHaveBeenLastCalledWith(false);
		view.closeSearch.mockClear(); view.state.mobilePane.value = 'hatask'; await nextTick(); expect(view.closeSearch).toHaveBeenLastCalledWith(false);
		expect(view.closeComposer).toHaveBeenLastCalledWith(true);
		view.state.onMobileSearchOpen(true); await nextTick();
		view.isMobile.value = false; await nextTick();
		expect(view.state.mobileSearchOpen.value).toBe(false); expect(view.state.mobileDockExpanded.value).toBe(false);
		expect(view.closeSearch).toHaveBeenLastCalledWith(false);
	});

	it('suspends the dock only on Hatask and Hata Docs routes, including nested paths', async () => {
		const view = await mount();
		view.state.mobileMenuOpen.value = true;
		for (const route of ['/hatask', '/hatask/', '/hatask/task/1', '/hata-docs', '/hata-docs/guide']) {
			view.path.value = route; await nextTick();
			expect(view.state.mobileDockSuspended.value).toBe(true);
			expect(view.state.mobileDockExpanded.value).toBe(false);
		}
		for (const route of ['/hataskey', '/hata-documents', '/']) {
			view.path.value = route; await nextTick();
			expect(view.state.mobileDockSuspended.value).toBe(false);
		}
		view.state.mobilePane.value = 'hatask';
		expect(view.state.mobileDockSuspended.value).toBe(false);
		const template = descriptor.template!.content;
		expect(template).toContain(':suspended="mobileDockSuspended"');
		expect(template).toContain(':data-dock-suspended="mobileDockSuspended');
	});
});
