/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, ref, watch } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { isHataskeyTimelineAllowed } from './hataskey-timeline-availability.js';
import type { ComputedRef, Ref } from 'vue';
import { $i } from '@/i.js';

const readFileSync = process.getBuiltinModule('fs')!.readFileSync;
const resolve = process.getBuiltinModule('path')!.resolve;
const runInNewContext = process.getBuiltinModule('vm')!.runInNewContext;

vi.mock('@/i.js', async () => {
	const { reactive } = await import('vue');
	return { $i: reactive({ policies: { ltlAvailable: true, gtlAvailable: true, btlAvailable: true } }) };
});
vi.mock('@/instance.js', () => ({ instance: { policies: { ltlAvailable: true, gtlAvailable: true, btlAvailable: true } } }));

if (!$i) throw new Error('Missing mocked account');
const policies = $i.policies;
const scopes: ReturnType<typeof effectScope>[] = [];
beforeEach(() => { Object.assign(policies, { ltlAvailable: true, gtlAvailable: true, btlAvailable: true }); });
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); });

// Exercise the production SFC state without mounting unrelated timelines or APIs.
function setupState<T>(file: string, names: string[], context: Record<string, unknown>, includeRoleWatcher = false): T {
	const content = parse(readFileSync(resolve(process.cwd(), file), 'utf8')).descriptor.scriptSetup?.content;
	if (!content) throw new Error('Missing setup script');
	const source = ts.createSourceFile(`${file}.ts`, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const selected = source.statements.filter(statement => {
		if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(d => ts.isIdentifier(d.name) && names.includes(d.name.text));
		if (ts.isFunctionDeclaration(statement)) return !!statement.name && names.includes(statement.name.text);
		return includeRoleWatcher && ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
			&& statement.expression.expression.getText(source) === 'watch'
			&& statement.expression.arguments[0].getText(source).includes('isHataskeyTimelineAllowed');
	});
	const code = ts.transpileModule(`(() => { ${selected.map(s => s.getText(source)).join('\n')}\nreturn { ${names.join(',')} }; })()`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
	}).outputText;
	const scope = effectScope();
	scopes.push(scope);
	return scope.run(() => runInNewContext(code, { ref, computed, watch, isHataskeyTimelineAllowed, ...context })) as T;
}

function normal(saved = 'local') {
	const topNav = ref(['following', 'local', 'social', 'mixed'].map(id => ({ id, visible: true })));
	const storage = { getItem: () => saved, setItem: vi.fn() };
	const state = setupState<{
		tab: Ref<string>;
		visibleTopTabs: ComputedRef<{ id: string }[]>;
		tabOrder: ComputedRef<string[]>;
		switchTab: (tab: string) => void;
	}>('src/ui/simple.vue', ['getInitialTab', 'tab', 'visibleTopTabs', 'tabOrder', 'switchTab'], {
				prefer: { r: { 'simpleUi.topNav': topNav, 'simpleUi.showTrendingTab': ref(true), 'simpleUi.showHatadyTab': ref(true) } },
				i18n: { ts: { _hata: { _hataskeyUi3: { tabTrending: 'Trending', tabHatady: 'Hatady' } } } },
				miLocalStorage: storage, showOHTL: ref(true), showOLTL: ref(true), showCTL: ref(false),
				isCollectionTimelinePage: ref(false), timelinePickerKind: ref(null), contentEl: ref(null),
			}, true);
	return { ...state, topNav, storage };
}

type Tab = { id: string; type: string };
type Frame = { id: string; activeTab: string; tabs: Tab[] };
type Slot = { id: string; frames: Frame[] };

function deck(concrnt = false) {
	const profile = ref({ slots: [
		{ id: 'main', frames: [{ id: 'frame', activeTab: 'local', tabs: [{ id: 'local', type: 'local' }, { id: 'home', type: 'home' }, { id: 'global', type: 'global' }] }] },
		{ id: 'restricted', frames: [{ id: 'restricted-frame', activeTab: 'social', tabs: [{ id: 'social', type: 'social' }] }] },
	] });
	const saved = JSON.stringify(profile.value);
	const select = vi.fn().mockResolvedValue({ canceled: true });
	let nextId = 0;
	const state = setupState<{
		slots: ComputedRef<Slot[]>; visibleSlots: ComputedRef<Slot[]>;
		activeTabOf: (frame: Frame) => Tab;
		setActiveTab: (slotId: string, frameId: string, tabId: string) => void;
		addSlotWithTab: (partial: { type: string }) => void;
		columnTypeMenu: (anchor: unknown, onPick: unknown) => { text?: string }[];
		addColumn: (event: { currentTarget: object }) => Promise<void>;
	}>('src/ui/_common_/hatasaba-deck.vue', [
				'slots', 'visibleSlots', 'activeTabOf', 'mapSlots', 'commitSlots', 'setActiveTab',
				'newTab', 'newFrameFromTab', 'newSlotFromTab', 'addSlotWithTab', 'columnTypeMenu', 'addColumn',
			], {
				activeProfile: profile, commitActiveProfile: (update: (p: typeof profile.value) => typeof profile.value) => { profile.value = update(profile.value); },
				genId: () => String(nextId++), externalReady: ref(true), concrntReady: ref(concrnt),
				COLUMN_META: new Proxy({}, { get: (_target, key) => ({ title: String(key) }) }),
				copy: { addColumn: 'add' }, os: { select },
			});
	return { ...state, profile, saved, select };
}

describe('Hataskey UI role-based timeline availability', () => {
	test('CTL is offered in both deck add menus only while Concrnt is connected', async () => {
		for (const connected of [false, true]) {
			const state = deck(connected);
			const menu = state.columnTypeMenu({}, vi.fn()).map(item => item.text);
			await state.addColumn({ currentTarget: {} });
			const choices = state.select.mock.calls[0][0].items.map((item: { value: string }) => item.value);
			expect(menu.includes('CTL（コンカレント）')).toBe(connected);
			expect(choices.includes('ctl')).toBe(connected);
		}
	});

	test.each([[false, false], [true, false], [false, true], [true, true]])('LTL=%s GTL=%s: account policies override server defaults', (ltl, gtl) => {
		Object.assign(policies, { ltlAvailable: ltl, gtlAvailable: gtl });
		for (const type of ['local', 'social', 'media']) expect(isHataskeyTimelineAllowed(type)).toBe(ltl);
		for (const type of ['mixed', 'global']) expect(isHataskeyTimelineAllowed(type)).toBe(gtl);
		for (const type of ['home', 'following', 'trending', 'hatady', 'ohtl', 'oltl', 'list', 'antenna', 'notifications']) expect(isHataskeyTimelineAllowed(type)).toBe(true);
	});

	test.each(['local', 'social', 'mixed'])('does not restore denied saved tab %s or include it in swipe/wheel navigation', saved => {
		Object.assign(policies, { ltlAvailable: false, gtlAvailable: false });
		const state = normal(saved);
		expect(state.tab.value).toBe('following');
		expect(state.visibleTopTabs.value.map(t => t.id)).toEqual(['following', 'trending', 'hatady']);
		expect(state.tabOrder.value).toEqual(['following', 'trending', 'hatady', 'ohtl', 'oltl']);
		state.switchTab(saved);
		expect(state.tab.value).toBe('following');
		expect(state.storage.setItem).not.toHaveBeenCalled();
	});

	test('revoking an active role moves to home; granting it restores tabs without rewriting visibility', () => {
		const state = normal();
		const saved = JSON.stringify(state.topNav.value);
		expect(state.tab.value).toBe('local');
		policies.ltlAvailable = false;
		expect(state.tab.value).toBe('following');
		expect(state.visibleTopTabs.value.map(t => t.id)).toEqual(['following', 'mixed', 'trending', 'hatady']);
		policies.ltlAvailable = true;
		expect(state.visibleTopTabs.value.map(t => t.id)).toEqual(['following', 'local', 'social', 'mixed', 'trending', 'hatady']);
		expect(JSON.stringify(state.topNav.value)).toBe(saved);
	});

	test('deck hides restricted panes/empty frames and restores saved tabs after permission returns', () => {
		const state = deck();
		policies.ltlAvailable = false;
		policies.gtlAvailable = false;
		expect(state.visibleSlots.value.map(s => s.id)).toEqual(['main']);
		const frame = state.visibleSlots.value[0].frames[0];
		expect(frame.tabs.map(t => t.id)).toEqual(['home']);
		expect(state.activeTabOf(frame).id).toBe('home');
		expect(JSON.stringify(state.profile.value)).toBe(state.saved);
		policies.ltlAvailable = true;
		policies.gtlAvailable = true;
		expect(state.visibleSlots.value).toEqual(state.slots.value);
		expect(state.activeTabOf(state.visibleSlots.value[0].frames[0]).id).toBe('local');
	});

	test('editing an allowed deck tab preserves restricted tabs and frames in storage', () => {
		const state = deck();
		policies.ltlAvailable = false;
		state.setActiveTab('main', 'frame', 'home');
		expect(state.slots.value[0].frames[0].tabs.map(t => t.id)).toEqual(['local', 'home', 'global']);
		expect(state.slots.value[1].frames[0].tabs[0].type).toBe('social');
		state.addSlotWithTab({ type: 'local' });
		expect(state.slots.value).toHaveLength(2);
		state.addSlotWithTab({ type: 'home' });
		expect(state.slots.value).toHaveLength(3);
	});

	test('both deck add menus omit denied local, social and global choices', async () => {
		Object.assign(policies, { ltlAvailable: false, gtlAvailable: false });
		const state = deck();
		const menu = state.columnTypeMenu({}, vi.fn()).map(item => item.text);
		await state.addColumn({ currentTarget: {} });
		const choices = state.select.mock.calls[0][0].items.map((item: { value: string }) => item.value);
		for (const type of ['local', 'social', 'global']) {
			expect(menu).not.toContain(type);
			expect(choices).not.toContain(type);
		}
		expect(menu).toContain('home');
		expect(choices).toContain('home');
		expect(menu).toContain('hatady');
		expect(choices).toContain('hatady');
	});
});
