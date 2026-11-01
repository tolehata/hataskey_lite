/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const filename = 'src/ui/simple.vue';
const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
const setup = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
type Root = NonNullable<NonNullable<typeof descriptor.template>['ast']>;
type Child = Root['children'][number];
type Element = Extract<Child, { type: 1 }>;

function element(predicate: (node: Element) => boolean): Element {
	let found: Element | undefined;

	function visit(node: Root | Child) {
		if (node.type === 1 && predicate(node)) found ??= node;
		if ('children' in node && Array.isArray(node.children)) node.children.forEach(child => visit(child as Child));
	}

	visit(descriptor.template!.ast!);
	if (!found) throw new Error('Missing production search template');
	return found;
}

function prop(node: Element, name: string): string | undefined {
	const value = node.props.find(item => item.type === 6 ? item.name === name : item.arg?.type === 4 && item.arg.content === name);
	return value?.type === 6 ? value.value?.content : value?.exp?.type === 4 ? value.exp.content : undefined;
}

const bottom = element(node => prop(node, 'class')?.includes('$style.bottomSearchBar') ?? false);
const scrim = element(node => node.props.some(item => item.type === 6 && item.name === 'data-navbar-search-scrim'));
const content = element(node => prop(node, 'ref') === 'contentEl');
const scriptNames = [
	'navbarSearchOpen', 'navbarSearchShell', 'navbarSearchTrigger', 'navbarSearchContent', 'navbarSearchHeight',
	'navbarSearchViewportHeight', 'navbarSearchKeyboardInset', 'navbarSearchMaxHeight', 'navbarSearchFocusVersion',
	'simpleDrawerShowing', 'widgetsShowing', 'showBottomBar', 'showTopBar', 'lastScrollY', 'scrollTimer',
	'setNavbarSearchTrigger', 'updateNavbarSearchHeight', 'updateNavbarSearchViewport', 'toggleNavbarSearch',
	'closeNavbarSearch', 'searchFocusTargets', 'onNavbarSearchKeydown', 'onContentScroll', 'openSearch',
];
const statements = setup.statements.filter(statement => {
	if (ts.isFunctionDeclaration(statement)) return statement.name != null && scriptNames.includes(statement.name.text);
	if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(item => ts.isIdentifier(item.name) && scriptNames.includes(item.name.text));
	return ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
		&& statement.expression.expression.getText(setup) === 'watch' && statement.getText(setup).includes('closeNavbarSearch(false)');
});
const code = ts.transpileModule(`${statements.map(statement => statement.getText(setup)).join('\n')}\nreturn { ${scriptNames.join(', ')} };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const compiled = compileTemplate({ source: `<div><div ref="contentEl" data-background :inert="${prop(content, 'inert')}" @scroll="onContentScroll"></div>${scrim.loc.source}${bottom.loc.source}</div>`, filename, id: 'navbar-search-test', compilerOptions: { mode: 'function', prefixIdentifiers: true, cacheHandlers: false } });
if (compiled.errors.length) throw new Error(`Search fixture compilation failed: ${String(compiled.errors[0])}`);
const render = new Function('Vue', compiled.code)(Vue);
const classes = new Proxy({}, { get: (_target, key) => key });
const cleanups: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

type SearchState = {
	navbarSearchOpen: Vue.Ref<boolean>;
	navbarSearchHeight: Vue.Ref<number>;
	navbarSearchKeyboardInset: Vue.Ref<number>;
	simpleDrawerShowing: Vue.Ref<boolean>;
	widgetsShowing: Vue.Ref<boolean>;
	showBottomBar: Vue.Ref<boolean>;
	closeNavbarSearch: (restore?: boolean) => void;
	updateNavbarSearchViewport: () => void;
	openSearch: () => void;
};

function mount() {
	let mounts = 0;
	const Search = Vue.defineComponent({
		props: ['active', 'maxHeight', 'motion'], emits: ['height', 'close'],
		setup(props, { emit, expose }) {
			mounts++;
			const query = Vue.ref(''); const input = Vue.ref<HTMLInputElement | null>(null);
			expose({ focus: () => input.value?.focus({ preventScroll: true }) });
			return () => Vue.h('div', { 'data-search-stub': '', 'data-active': props.active }, [
				Vue.h('input', { ref: input, type: 'search', value: query.value, onInput: (event: Event) => { query.value = (event.target as HTMLInputElement).value; } }),
				Vue.h('button', { 'data-grow': '', onClick: () => emit('height', 300) }, 'Results'),
				Vue.h('button', { 'data-shrink': '', onClick: () => emit('height', 59) }, 'Compact'),
			]);
		},
	});
	const bindings = {
		ref: Vue.ref, computed: Vue.computed, nextTick: Vue.nextTick, watch: Vue.watch,
		mainRouter: { currentRef: Vue.ref({ path: '/' }), push: vi.fn() },
		tab: Vue.ref('local'), isDesktop: Vue.ref(false), deckActive: Vue.ref(false),
		timelinePickerKind: Vue.ref<string | null>(null),
		visibleBottomNav: Vue.ref([{ id: 'notifications' }, { id: 'search' }, { id: 'home' }]),
		contentEl: Vue.ref<HTMLElement | null>(null), pullRefresh: { reset: vi.fn() },
	};
	let state!: SearchState;
	const app = Vue.createApp({ components: { MkMobileNavbarSearch: Search }, setup() {
		state = new Function(...Object.keys(bindings), code)(...Object.values(bindings)) as SearchState;
		return {
			...bindings, ...state, i18n: { ts: { search: 'Search', close: 'Close' } },
			isHataskPage: false, isExternalTab: false, isChannelDetailPage: false, isPageView: false,
			bottomNavHasPage: false, footerIsDark: true, newNotesMotionEnabled: false,
			isSearchPage: false, isHomeTL: true, isNotifPage: false, isHataFeedPage: false,
			hasUnreadNotif: false, showUnreadNotifCount: false, unreadNotifCount: 0,
			playSimpleNavMotion: vi.fn(), goHome: vi.fn(), goToNotifications: vi.fn(), goToHatask: vi.fn(), goToHatady: vi.fn(), goToHataFeed: vi.fn(), onPostClick: vi.fn(),
		};
	}, render });
	app.config.globalProperties.$style = classes;
	const target = window.document.createElement('div'); window.document.body.append(target); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return { target, state, bindings, mounts: () => mounts, trigger: () => target.querySelector<HTMLButtonElement>('[data-navbar-search-toggle]')!, input: () => target.querySelector<HTMLInputElement>('input')!, body: () => target.querySelector<HTMLElement>('.navbarSearchBody')! };
}

async function flush() { await Vue.nextTick(); await Vue.nextTick(); }

async function click(element: HTMLElement) { element.click(); await flush(); }

describe('Hataskey mobile navbar search integration', () => {
	it('opens only the navbar search in place, preserves order, query and scroll, and restores the trigger label', async () => {
		const view = mount(); const input = view.input();
		const background = view.target.querySelector<HTMLElement>('[data-background]')!; background.scrollTop = 240;
		const order = [...view.target.querySelectorAll('.bottomNavRow > button')];
		await click(view.trigger());
		expect(view.bindings.mainRouter.push).not.toHaveBeenCalled();
		expect(view.trigger().getAttribute('aria-label')).toBe('Close');
		expect(window.document.activeElement).toBe(input);
		expect(background.hasAttribute('inert')).toBe(true);
		input.value = 'saved query'; input.dispatchEvent(new Event('input', { bubbles: true }));
		await click(view.target.querySelector<HTMLButtonElement>('[data-grow]')!);
		expect(view.body().style.height).toBe('300px');
		await click(view.trigger());
		expect(view.trigger().getAttribute('aria-label')).toBe('Search');
		expect(window.document.activeElement).toBe(view.trigger());
		expect(background.scrollTop).toBe(240);
		await click(view.trigger());
		expect(view.input()).toBe(input); expect(input.value).toBe('saved query'); expect(view.mounts()).toBe(1);
		expect([...view.target.querySelectorAll('.bottomNavRow > button')]).toEqual(order);
		expect(view.body().style.height).toBe('300px');
		view.state.openSearch(); expect(view.bindings.mainRouter.push).toHaveBeenCalledWith('/search');
	});

	it('keeps the navbar visible while searching and clamps height without moving query focus', async () => {
		const view = mount(); await click(view.trigger());
		await click(view.target.querySelector<HTMLButtonElement>('[data-grow]')!);
		view.state.showBottomBar.value = false; await flush();
		expect(view.target.querySelector('.bottomSearchBar')?.classList.contains('bottomBarHidden')).toBe(false);
		const viewport = { height: 360, offsetTop: 30, scale: 1 }; vi.stubGlobal('visualViewport', viewport); vi.stubGlobal('innerHeight', 800);
		view.input().focus(); view.state.updateNavbarSearchViewport(); await flush();
		expect(view.state.navbarSearchKeyboardInset.value).toBe(410);
		expect(view.body().style.height).toBe('210px'); expect(window.document.activeElement).toBe(view.input());
		await click(view.target.querySelector<HTMLButtonElement>('[data-shrink]')!); expect(view.body().style.height).toBe('59px');
		viewport.scale = 2; view.state.updateNavbarSearchViewport(); expect(view.state.navbarSearchKeyboardInset.value).toBe(0);
	});

	it('ignores composition and handled Escape, closes on ordinary Escape/outside, and avoids route focus restoration', async () => {
		const view = mount(); await click(view.trigger());
		view.input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true })); await flush();
		expect(view.state.navbarSearchOpen.value).toBe(true);
		const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); handled.preventDefault(); view.input().dispatchEvent(handled); await flush();
		expect(view.state.navbarSearchOpen.value).toBe(true);
		view.input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await flush();
		expect(window.document.activeElement).toBe(view.trigger());
		await click(view.trigger()); await click(view.target.querySelector<HTMLElement>('[data-navbar-search-scrim]')!);
		expect(view.state.navbarSearchOpen.value).toBe(false); expect(window.document.activeElement).toBe(view.trigger());
		await click(view.trigger());
		const destination = window.document.createElement('button'); window.document.body.append(destination); destination.focus();
		view.bindings.mainRouter.currentRef.value = { path: '/my/notifications' }; await flush();
		expect(view.state.navbarSearchOpen.value).toBe(false); expect(window.document.activeElement).toBe(destination); destination.remove();
	});

	it('excludes drawer, widgets, timeline selection and desktop changes without changing saved nav items', async () => {
		const view = mount(); const ids = view.bindings.visibleBottomNav.value.map(item => item.id);
		await click(view.trigger()); view.state.simpleDrawerShowing.value = true; await flush(); expect(view.state.navbarSearchOpen.value).toBe(false);
		await click(view.trigger()); view.state.widgetsShowing.value = true; await flush(); expect(view.state.navbarSearchOpen.value).toBe(false);
		await click(view.trigger()); view.bindings.timelinePickerKind.value = 'list'; await flush(); expect(view.state.navbarSearchOpen.value).toBe(false);
		await click(view.trigger()); view.bindings.isDesktop.value = true; await flush(); expect(view.state.navbarSearchOpen.value).toBe(false);
		expect(view.bindings.visibleBottomNav.value.map(item => item.id)).toEqual(ids);
	});
});
