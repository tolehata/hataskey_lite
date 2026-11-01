/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, nextTick, ref, watch } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { useHatagoesBarCollapse } from '@/utility/hatagoes-bar-collapse.js';

const filename = 'src/components/hataskey3/Hk3App.vue';
const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
const script = descriptor.scriptSetup!.content;
const setup = ts.createSourceFile(`${filename}.ts`, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = [
	'sideNavHovered', 'sideNavFocused', 'sideNavFocusTransfer', 'sideNavPointerInput',
	'sideNavLaunchPadOpen', 'sideNavInstanceMenuOpen', 'sideNavCollapsed', 'sideNavExpanded',
	'onDocumentPointerDown', 'onDocumentKeyDown', 'onSideNavEnter', 'onSideNavFocus',
	'onSideNavKeyUp', 'holdSideNavKeyboardFocus', 'onSideNavBlur', 'closeSideNav',
];
const statements = setup.statements.filter(statement => {
	if (ts.isFunctionDeclaration(statement)) return statement.name != null && names.includes(statement.name.text);
	if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(item => ts.isIdentifier(item.name) && names.includes(item.name.text));
	return ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
		&& statement.expression.expression.getText(setup) === 'watch' && statement.getText(setup).includes('sideNavHovered.value = false');
});
const code = ts.transpileModule(`${statements.map(statement => statement.getText(setup)).join('\n')}\nreturn { ${names.join(', ')} };`, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

type State = {
	sideNavHovered: ReturnType<typeof ref<boolean>>;
	sideNavFocused: ReturnType<typeof ref<boolean>>;
	sideNavLaunchPadOpen: ReturnType<typeof ref<boolean>>;
	sideNavInstanceMenuOpen: ReturnType<typeof ref<boolean>>;
	sideNavExpanded: ReturnType<typeof computed<boolean>>;
	sideNavCollapsed: ReturnType<typeof ref<boolean>>;
	onDocumentPointerDown: () => void;
	onDocumentKeyDown: () => void;
	onSideNavEnter: (event: PointerEvent) => void;
	onSideNavFocus: (event: FocusEvent) => Promise<void>;
	onSideNavKeyUp: (event: KeyboardEvent) => void;
	onSideNavBlur: (event: FocusEvent) => void;
	closeSideNav: (event: KeyboardEvent) => void;
};

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

function mount() {
	const isMobile = ref(false);
	const isHataGoesPage = ref(false);
	const scope = effectScope();
	const state = scope.run(() => new Function('ref', 'computed', 'nextTick', 'watch', 'isMobile', 'isHatadyTimeline', 'isHataGoesPage', 'useHatagoesBarCollapse', code)(ref, computed, nextTick, watch, isMobile, ref(false), isHataGoesPage, useHatagoesBarCollapse)) as State;
	const container = window.document.createElement('div');
	const rail = window.document.createElement('div');
	const theme = window.document.createElement('button'); theme.title = 'Theme';
	const settings = window.document.createElement('button'); settings.title = 'Settings';
	container.append(rail, theme, settings);
	window.document.body.append(container);
	let focusVisible = false;

	function button(title: string) {
		const element = window.document.createElement('button');
		element.title = title;
		const matches = element.matches.bind(element);
		Object.defineProperty(element, 'matches', { value: (selector: string) => selector === ':focus-visible' ? focusVisible : matches(selector) });
		return element;
	}

	for (const element of [theme, settings]) {
		const matches = element.matches.bind(element);
		Object.defineProperty(element, 'matches', { value: (selector: string) => selector === ':focus-visible' ? focusVisible : matches(selector) });
	}

	function render() {
		// Hk3SideNav の v-if と同様、rail のボタンを展開時に差し替える。
		rail.replaceChildren(button('More'), button('Home'));
	}

	render();
	const stopRender = watch(state.sideNavExpanded, render);
	const onFocus = (event: FocusEvent) => { void state.onSideNavFocus(event); };
	const onBlur = (event: FocusEvent) => state.onSideNavBlur(event);
	const onKeyUp = (event: KeyboardEvent) => state.onSideNavKeyUp(event);
	const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') state.closeSideNav(event); };
	container.addEventListener('focusin', onFocus);
	container.addEventListener('focusout', onBlur);
	container.addEventListener('keyup', onKeyUp);
	container.addEventListener('keydown', onKeyDown);
	window.document.addEventListener('pointerdown', state.onDocumentPointerDown, true);
	window.document.addEventListener('keydown', state.onDocumentKeyDown, true);
	const cleanup = () => {
		window.document.removeEventListener('pointerdown', state.onDocumentPointerDown, true);
		window.document.removeEventListener('keydown', state.onDocumentKeyDown, true);
		stopRender(); scope.stop(); container.remove();
	};
	cleanups.push(cleanup);
	return {
		state, isMobile, isHataGoesPage, container, theme, settings,
		setFocusVisible: (value: boolean) => { focusVisible = value; },
		railButton: (title: string) => Array.from(rail.querySelectorAll('button')).find(item => item.title === title)!,
		pointerDown: (target: HTMLElement) => target.dispatchEvent(new Event('pointerdown', { bubbles: true })),
		key: (target: HTMLElement, type: 'keydown' | 'keyup', key: string) => target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, key })),
		cleanup,
	};
}

describe('UI S side nav input modality', () => {
	it('uses manual expansion only in HataGoes and resumes hover expansion on exit', async () => {
		const view = mount();
		view.state.onSideNavEnter({ pointerType: 'mouse' } as PointerEvent);
		expect(view.state.sideNavExpanded.value).toBe(true);
		view.isHataGoesPage.value = true;
		expect(view.state.sideNavExpanded.value).toBe(false);
		view.setFocusVisible(true);
		view.theme.focus();
		view.key(view.theme, 'keyup', 'Tab');
		await nextTick();
		expect(view.state.sideNavExpanded.value).toBe(false);
		view.state.sideNavCollapsed.value = false;
		expect(view.state.sideNavExpanded.value).toBe(true);
		view.state.sideNavHovered.value = false;
		expect(view.state.sideNavExpanded.value).toBe(true);
		view.key(view.theme, 'keydown', 'Escape');
		expect(view.state.sideNavExpanded.value).toBe(false);
		view.state.onSideNavEnter({ pointerType: 'mouse' } as PointerEvent);
		expect(view.state.sideNavExpanded.value).toBe(false);
		view.isHataGoesPage.value = false;
		expect(view.state.sideNavExpanded.value).toBe(true);
		view.state.sideNavHovered.value = false;
		expect(view.state.sideNavExpanded.value).toBe(false);
	});

	it('clears keyboard hold on a pointer click inside the nav and stays collapsed after pointer leave', async () => {
		const view = mount();
		view.setFocusVisible(true);
		view.theme.focus(); view.settings.focus();
		expect(view.state.sideNavFocused.value).toBe(true);
		view.state.onSideNavEnter({ pointerType: 'mouse' } as PointerEvent);
		view.pointerDown(view.theme);
		view.setFocusVisible(false);
		view.theme.focus();
		view.state.sideNavHovered.value = false;
		await nextTick();
		expect(view.state.sideNavFocused.value).toBe(false);
		expect(view.state.sideNavExpanded.value).toBe(false);
	});

	it('ignores focus restored by a pointer closed popup, then resumes on Enter, Space, and Tab', async () => {
		const view = mount();
		view.setFocusVisible(true);
		view.settings.focus(); await nextTick();
		const popup = window.document.createElement('button'); window.document.body.append(popup);
		try {
			view.pointerDown(view.theme);
			popup.focus();
			view.theme.focus(); // MkModal の trigger.focus()。focus-visible が true でも pointer 起因。
			await nextTick();
			expect(view.state.sideNavExpanded.value).toBe(false);
			view.key(view.theme, 'keydown', 'Enter'); view.key(view.theme, 'keyup', 'Enter');
			await nextTick();
			expect(view.state.sideNavFocused.value).toBe(true);
			view.pointerDown(view.theme);
			view.key(view.theme, 'keydown', ' '); view.key(view.theme, 'keyup', ' ');
			await nextTick();
			expect(view.state.sideNavFocused.value).toBe(true);
			view.pointerDown(view.theme);
			popup.focus();
			view.key(popup, 'keydown', 'Tab'); view.settings.focus(); view.key(view.settings, 'keyup', 'Tab');
			await nextTick();
			expect(view.state.sideNavFocused.value).toBe(true);
		} finally { popup.remove(); }
	});

	it('transfers keyboard focus to the matching expanded button and lets Escape cancel it', async () => {
		const view = mount();
		view.setFocusVisible(true);
		const collapsed = view.railButton('More');
		collapsed.focus();
		await nextTick();
		expect(window.document.activeElement).toBe(view.railButton('More'));
		expect(window.document.activeElement).not.toBe(collapsed);
		expect(view.state.sideNavExpanded.value).toBe(true);
		view.key(view.railButton('More'), 'keydown', 'Escape');
		await nextTick();
		expect(view.state.sideNavFocused.value).toBe(false);
		expect(view.state.sideNavExpanded.value).toBe(false);
	});

	it('cancels a pending focus transfer on pointerdown, while explicit menu pins remain', async () => {
		const view = mount();
		view.setFocusVisible(true);
		const collapsed = view.railButton('More');
		collapsed.focus();
		view.pointerDown(window.document.body);
		collapsed.blur();
		await nextTick();
		expect(view.state.sideNavFocused.value).toBe(false);
		expect(view.state.sideNavExpanded.value).toBe(false);
		expect(window.document.activeElement).not.toBe(view.railButton('More'));
		view.state.sideNavLaunchPadOpen.value = true;
		expect(view.state.sideNavExpanded.value).toBe(true);
		view.pointerDown(window.document.body);
		expect(view.state.sideNavExpanded.value).toBe(true);
		view.state.sideNavLaunchPadOpen.value = false;
		view.state.sideNavInstanceMenuOpen.value = true;
		view.pointerDown(window.document.body);
		expect(view.state.sideNavExpanded.value).toBe(true);
	});

	it('clears hold when the desktop nav disappears and unregisters document capture listeners', async () => {
		const view = mount();
		view.setFocusVisible(true); view.settings.focus();
		view.isMobile.value = true; await nextTick();
		expect(view.state.sideNavFocused.value).toBe(false);
		view.isMobile.value = false; await nextTick();
		view.settings.blur();
		view.settings.focus();
		view.cleanup();
		view.state.sideNavFocused.value = true;
		view.pointerDown(window.document.body);
		expect(view.state.sideNavFocused.value).toBe(true);
		expect(script).toContain("window.document.addEventListener('pointerdown', onDocumentPointerDown, true)");
		expect(script).toContain("window.document.removeEventListener('pointerdown', onDocumentPointerDown, true)");
		expect(script).toContain("window.document.addEventListener('keydown', onDocumentKeyDown, true)");
		expect(script).toContain("window.document.removeEventListener('keydown', onDocumentKeyDown, true)");
		expect(descriptor.template!.content).toContain('@keyup="onSideNavKeyUp"');
	});
});
