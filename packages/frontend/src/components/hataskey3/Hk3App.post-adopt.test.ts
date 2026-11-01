/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, nextTick, ref, shallowRef, watch } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hk3CanAdoptPostForm } from './hk3-state.js';
import { useHk3SidePage } from './use-hk3-side-page.js';
import { interceptConcrntPostRequest } from '@/utility/concrnt/post-interceptor.js';

const filename = 'src/components/hataskey3/Hk3App.vue';
const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
const setup = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const selected = setup.statements.filter(statement =>
	(ts.isFunctionDeclaration(statement) && ['interceptPostForm', 'toggleComposeWindow', 'onMobileCompose'].includes(statement.name?.text ?? '')) ||
	(ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && ['pendingAdopt', 'isConcrntTimeline'].includes(declaration.name.text))) ||
	(ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(setup) === 'watch' && statement.getText(setup).includes('pendingAdopt')),
);
const code = ts.transpileModule(`${selected.map(statement => statement.getText(setup)).join('\n')}\nreturn { interceptPostForm, toggleComposeWindow, onMobileCompose };`, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const timelineDeclarations = setup.statements.filter(statement => ts.isVariableStatement(statement)
	&& statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && ['isHatadyTimeline', 'isConcrntTimeline'].includes(declaration.name.text)));
const timelineCode = ts.transpileModule(`${timelineDeclarations.map(statement => statement.getText(setup)).join('\n')}\nreturn { isHatadyTimeline, isConcrntTimeline };`, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));

function mount(options: { mobile: boolean; home: boolean; deck: boolean; ctl?: boolean; visible?: boolean; composer?: { adopt: (request: unknown) => boolean } }) {
	const postDirect = vi.fn();
	const post = vi.fn();
	const focusConcrntComposer = vi.fn();
	const composerRef = shallowRef(options.composer ?? null);
	const isHome = ref(options.home);
	const isMobile = ref(options.mobile);
	const deckActive = ref(options.deck);
	const composeWindowOpen = ref(false);
	const timelineVisible = ref(options.visible ?? true);
	const timelineRef = shallowRef({ mobileNavigation: { active: options.ctl ? 'ctl' : 'local' }, focusConcrntComposer });
	const drawerOpen = ref(true);
	const mobileDockRef = ref({ closeMenu: vi.fn() });
	const closeMobilePane = vi.fn();
	const mainRouter = { currentRoute: ref({ name: options.home ? 'index' : 'page', path: options.home ? '/' : '/page' }), pushByPath: vi.fn(() => { isHome.value = true; }) };
	const scope = effectScope();
	const bindings = { computed, watch, nextTick, composerRef, isHome, isMobile, deckActive, composeWindowOpen, timelineVisible, timelineRef, drawerOpen, mobileDockRef, closeMobilePane, mainRouter, sidePageSession: ref(null), sidePage: { restoreForComposer: vi.fn() }, isHatadyTimeline: ref(false), launchHatadyRecord: vi.fn(), hk3CanAdoptPostForm, interceptConcrntPostRequest, os: { postDirect, post } };
	const state = scope.run(() => new Function(...Object.keys(bindings), code)(...Object.values(bindings))) as { interceptPostForm: (request: unknown) => boolean; toggleComposeWindow: () => void; onMobileCompose: () => void };
	cleanups.push(() => scope.stop());
	return { ...state, composerRef, composeWindowOpen, postDirect, post, focusConcrntComposer, timelineVisible, mainRouter, drawerOpen, closeMobilePane, mobileDockRef };
}

describe('UI S active CTL post routing', () => {
	it('routes an ordinary shortcut and the sidebar button to CTL without opening the native composer', () => {
		const adopt = vi.fn(() => true);
		const view = mount({ mobile: false, home: true, deck: false, ctl: true, composer: { adopt } });
		expect(view.interceptPostForm({})).toBe(true);
		view.toggleComposeWindow();
		expect(view.focusConcrntComposer).toHaveBeenCalledTimes(2);
		expect(adopt).not.toHaveBeenCalled();
		expect(view.composeWindowOpen.value).toBe(false);
	});

	it('leaves explicit reply, quote and prefilled requests with their original composer', () => {
		const adopt = vi.fn(() => true);
		const view = mount({ mobile: true, home: true, deck: false, ctl: true, composer: { adopt } });
		for (const request of [{ reply: { id: 'reply' } }, { renote: { id: 'quote' } }, { initialText: 'local draft' }]) {
			expect(view.interceptPostForm(request)).toBe(false);
		}
		expect(adopt).not.toHaveBeenCalled();
		expect(view.focusConcrntComposer).not.toHaveBeenCalled();
		expect(view.closeMobilePane).not.toHaveBeenCalled();
	});

	it('closes the mobile overlay only when accepting an ordinary CTL request', () => {
		const view = mount({ mobile: true, home: true, deck: false, ctl: true });
		expect(view.interceptPostForm({})).toBe(true);
		expect(view.mobileDockRef.value.closeMenu).toHaveBeenCalledOnce();
		expect(view.closeMobilePane).toHaveBeenCalledOnce();
		expect(view.drawerOpen.value).toBe(false);
		expect(view.focusConcrntComposer).toHaveBeenCalledOnce();
	});

	it('keeps a hidden CTL and ambiguous Deck context on the existing local path', () => {
		const hidden = mount({ mobile: false, home: true, deck: false, ctl: true, visible: false });
		expect(hidden.interceptPostForm({})).toBe(false);
		expect(hidden.focusConcrntComposer).not.toHaveBeenCalled();
		const adopt = vi.fn(() => true);
		const deck = mount({ mobile: false, home: true, deck: true, ctl: true, composer: { adopt } });
		expect(deck.interceptPostForm({})).toBe(false);
		expect(adopt).not.toHaveBeenCalled();
		expect(deck.composeWindowOpen.value).toBe(false);
		const reply = { reply: { id: 'local-reply' } };
		expect(deck.interceptPostForm(reply)).toBe(true);
		expect(adopt).toHaveBeenCalledWith(reply);
		expect(deck.focusConcrntComposer).not.toHaveBeenCalled();
	});

	it.each([['concrnt', '/concrnt'], ['unnamed', '/timeline']])('lets page %s handle global requests and both navigation buttons', (name, path) => {
		const adopt = vi.fn(() => true);
		const view = mount({ mobile: false, home: false, deck: false, ctl: true, composer: { adopt } });
		view.mainRouter.currentRoute.value = { name, path };
		expect(view.interceptPostForm({})).toBe(false);
		view.toggleComposeWindow();
		view.onMobileCompose();
		expect(view.post).toHaveBeenCalledTimes(2);
		expect(adopt).not.toHaveBeenCalled();
		expect(view.focusConcrntComposer).not.toHaveBeenCalled();
	});
});

describe('UI S post form fallback after delayed adoption', () => {
	it('declines a direct reply before mobile navigation or draft adoption so os.post opens the standard form', () => {
		const adopt = vi.fn(() => true);
		const view = mount({ mobile: true, home: false, deck: false, composer: { adopt } });
		const request = { reply: { id: 'direct', visibility: 'specified', visibleUserIds: ['recipient'] } };
		expect(view.interceptPostForm(request)).toBe(false);
		expect(adopt).not.toHaveBeenCalled();
		expect(view.composeWindowOpen.value).toBe(false);
		expect(view.postDirect).not.toHaveBeenCalled();
	});

	it('opens the standard form when a mobile return-home adoption is rejected', async () => {
		const adopt = vi.fn(() => false);
		const view = mount({ mobile: true, home: false, deck: false, composer: { adopt } });
		const request = { reply: { id: 'reply' } };
		expect(view.interceptPostForm(request)).toBe(true);
		await nextTick(); await nextTick();
		expect(adopt).toHaveBeenCalledWith(request);
		expect(view.postDirect).toHaveBeenCalledOnce();
		expect(view.postDirect).toHaveBeenCalledWith(request);
	});

	it('opens the standard form if the deck window has no composer on the next tick', async () => {
		const view = mount({ mobile: false, home: true, deck: true });
		const request = { renote: { id: 'quote' } };
		expect(view.interceptPostForm(request)).toBe(true);
		expect(view.composeWindowOpen.value).toBe(true);
		await nextTick();
		expect(view.postDirect).toHaveBeenCalledWith(request);
	});
});

describe('UI S Hatady composer in a side-page session', () => {
	it('keeps the record action while Hatady is visible in split mode and restores note composer for other timelines', () => {
		const route = ref('/');
		const isHome = computed(() => route.value === '/');
		const deckActive = ref(false);
		const timelineRef = shallowRef<{ mobileNavigation: { active: string } } | null>({ mobileNavigation: { active: 'hatady' } });
		const router = { getCurrentFullPath: () => route.value, pushByPath: (path: string) => { route.value = path; } };
		const scope = effectScope();
		const sidePage = scope.run(() => useHk3SidePage({ router, currentRoute: () => route.value, isHome: () => isHome.value, isMobile: () => false, isDesktopDeck: () => false }))!;
		const timelineVisible = sidePage.timelineVisible;
		const { isHatadyTimeline, isConcrntTimeline } = scope.run(() => new Function('computed', 'timelineVisible', 'timelineRef', 'deckActive', timelineCode)(computed, timelineVisible, timelineRef, deckActive)) as {
			isHatadyTimeline: ReturnType<typeof computed<boolean>>;
			isConcrntTimeline: ReturnType<typeof computed<boolean>>;
		};
		cleanups.push(() => scope.stop());
		const composers = [...descriptor.template!.content.matchAll(/<Hk3Composer\s+v-show="([^"]+)"[^>]*:inert="([^"]+)"/g)];
		expect(composers).toHaveLength(2);
		const expectNativeComposer = (visible: boolean) => {
			for (const [, show, inert] of composers) {
				const state = new Function('isHatadyTimeline', 'isConcrntTimeline', `return { shown: ${show}, inert: ${inert} };`)(isHatadyTimeline.value, isConcrntTimeline.value);
				expect(state).toEqual({ shown: visible, inert: !visible });
			}
		};

		expect(isHatadyTimeline.value).toBe(true);
		expect(isConcrntTimeline.value).toBe(false);
		expectNativeComposer(false);
		route.value = '/hatask';
		expect(sidePage.sidebarNavigated('/hatask')).toBe(true);
		expect(sidePage.mode.value).toBe('split');
		expect(isHatadyTimeline.value).toBe(true);
		timelineRef.value = { mobileNavigation: { active: 'local' } };
		expect(isHatadyTimeline.value).toBe(false);
		expect(isConcrntTimeline.value).toBe(false);
		expectNativeComposer(true);
		timelineRef.value = { mobileNavigation: { active: 'ctl' } };
		expect(isHatadyTimeline.value).toBe(false);
		expect(isConcrntTimeline.value).toBe(true);
		expectNativeComposer(false);
		timelineRef.value = { mobileNavigation: { active: 'hatady' } };
		expect(isConcrntTimeline.value).toBe(false);
		expectNativeComposer(false);
		expect(sidePage.toggle()).toBe(true);
		expect(sidePage.mode.value).toBe('full');
		expect(isHatadyTimeline.value).toBe(false);
		expect(sidePage.toggle()).toBe(true);
		expect(isHatadyTimeline.value).toBe(true);
		expect(sidePage.close()).toBe(true);
		deckActive.value = true;
		expect(isHatadyTimeline.value).toBe(false);

		const template = descriptor.template!.content;
		expect(template).toContain('<Hk3Composer v-show="!isHatadyTimeline && !isConcrntTimeline"');
		expect(template).toContain('<button v-if="isHatadyTimeline"');
	});
});
