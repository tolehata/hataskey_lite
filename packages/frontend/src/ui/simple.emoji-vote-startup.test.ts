/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { computed, effectScope, nextTick, ref, watch } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComputedRef, Ref } from 'vue';

const filename = 'src/ui/simple.vue';
// Incident snapshots can be checked with the same test without replacing the working SFC.
const sourceFilename = process.env.LTL_EMOJI_VOTE_STARTUP_SOURCE ?? filename;
const descriptor = parse(readFileSync(resolve(process.cwd(), sourceFilename), 'utf8'), { filename }).descriptor;
if (!descriptor.scriptSetup) throw new Error('Missing simple.vue setup script');
const setup = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declarations = [
	'deckMode', 'deckActive', 'DESKTOP_THRESHOLD', 'windowWidth', 'isDesktop',
	'contentEl', 'ltlEmojiVoteEffects', 'normalLtlVoteActive', 'ltlEmojiVoteViewport', 'isPageView', 'tab',
];

function declares(statement: ts.Statement, name: string): boolean {
	return ts.isVariableStatement(statement)
		&& statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name);
}

function viewportWatcher(statement: ts.Statement): boolean {
	if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression) || statement.expression.expression.getText(setup) !== 'watch') return false;
	const input = statement.expression.arguments.at(0);
	return !!input && ts.isArrayLiteralExpression(input)
		&& input.elements.some(element => ts.isIdentifier(element) && element.text === 'normalLtlVoteActive');
}

function setupSource(legacyOrder = false): string {
	for (const name of declarations) {
		if (setup.statements.filter(statement => declares(statement, name)).length !== 1) throw new Error(`Expected one production declaration: ${name}`);
	}
	const watchers = setup.statements.filter(viewportWatcher);
	const observerWatch = watchers.at(0);
	if (watchers.length !== 1 || !observerWatch) throw new Error('Expected one production LTL viewport watcher');
	const initialTab = setup.statements.filter(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'getInitialTab');
	if (initialTab.length !== 1) throw new Error('Missing production tab restoration');
	const selected = setup.statements.filter(statement => declarations.some(name => declares(statement, name)) || statement === observerWatch || initialTab.some(node => node === statement));
	if (legacyOrder) {
		// Reinsert the actual LTL block at the position that caused the deployed white screen.
		// The same production declarations/callback and real Vue watch run in both cases.
		const earlyNames = ['contentEl', 'ltlEmojiVoteEffects', 'normalLtlVoteActive', 'ltlEmojiVoteViewport'];
		const earlyBlock = earlyNames.map(name => {
			const statement = selected.find(node => declares(node, name));
			if (!statement) throw new Error(`Missing legacy declaration: ${name}`);
			return statement;
		});
		earlyBlock.push(observerWatch);
		for (const statement of earlyBlock) selected.splice(selected.indexOf(statement), 1);
		const earlyPosition = selected.findIndex(statement => declares(statement, 'isDesktop'));
		if (earlyPosition < 0) throw new Error('Missing the old watcher insertion point');
		selected.splice(earlyPosition + 1, 0, ...earlyBlock);
	}
	return selected.map(statement => statement.getText(setup)).join('\n');
}

type Viewport = { top: string; left: string; width: string; height: string };
type State = {
	tab: Ref<string>;
	isPageView: Ref<boolean>;
	deckMode: Ref<boolean>;
	deckActive: ComputedRef<boolean>;
	windowWidth: Ref<number>;
	contentEl: Ref<HTMLElement | null>;
	normalLtlVoteActive: ComputedRef<boolean>;
	ltlEmojiVoteViewport: Ref<Viewport>;
};
type ObserverRecord = { callback: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
const cleanupScopes: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanupScopes.splice(0)) cleanup(); });

function fixture(options: { savedTab?: string; width?: number; deck?: boolean; legacyOrder?: boolean } = {}) {
	const observers: ObserverRecord[] = [];
	class Observer {
		observe = vi.fn();
		disconnect = vi.fn();
		constructor(public callback: () => void) { observers.push(this); }
	}
	const deckIgnoreWidth = ref(false);
	const scope = effectScope();
	cleanupScopes.push(() => scope.stop());
	// This executes the real setup dependency slice in its source order. Unrelated
	// router/network/theme setup and browser layout are intentionally outside this test.
	const code = ts.transpileModule(`(() => {
		${setupSource(options.legacyOrder)}
		return { tab, isPageView, deckMode, deckActive, windowWidth, contentEl, normalLtlVoteActive, ltlEmojiVoteViewport };
	})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
	const state = scope.run(() => runInNewContext(code, {
		ref, computed, watch,
		isHataskeyTimelineAllowed: () => true,
		ResizeObserver: Observer,
		getComputedStyle: window.getComputedStyle.bind(window),
		['window']: { innerWidth: options.width ?? 1400 },
		deckIgnoreWidth,
		prefer: { r: { 'simpleUi.deckMode': ref(options.deck ?? false) } },
		miLocalStorage: { getItem: (key: string) => key === 'hatasabaUiLastTab' ? options.savedTab ?? 'following' : null },
	}, { timeout: 1000 })) as State;
	return { state, observers, deckIgnoreWidth, stop: () => scope.stop() };
}

function contentFixture() {
	const element = window.document.createElement('div');
	window.document.body.append(element);
	cleanupScopes.push(() => element.remove());
	const geometry = { clientWidth: 1000, clientHeight: 640, offsetTop: 92, offsetLeft: 12 };
	for (const name of Object.keys(geometry) as Array<keyof typeof geometry>) {
		Object.defineProperty(element, name, { get: () => geometry[name], configurable: true });
	}
	return { element, geometry };
}

function observerAt(observers: ObserverRecord[], index: number): ObserverRecord {
	const observer = observers.at(index);
	if (!observer) throw new Error(`Expected observer ${index}`);
	return observer;
}

describe('Hataskey normal LTL startup dependency order', () => {
	it.each(['following', 'local', 'mixed', 'social', 'trending'])('initializes the real watcher with saved tab %s before the content ref mounts', savedTab => {
		const { state, observers } = fixture({ savedTab });
		expect(state.tab.value).toBe(savedTab);
		expect(state.normalLtlVoteActive.value).toBe(savedTab === 'local');
		expect(state.contentEl.value).toBeNull();
		expect(observers).toHaveLength(0);
	});

	it('detects the old watcher position as a tab TDZ using Vue synchronous source evaluation', () => {
		const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			expect(() => fixture({ savedTab: 'local', legacyOrder: true })).toThrow(/Cannot access 'tab' before initialization/u);
		} finally {
			warnings.mockRestore();
		}
	});

	it('measures the LTL content when its DOM ref arrives and follows actual resize geometry', async () => {
		const { state, observers } = fixture({ savedTab: 'local' });
		const content = contentFixture();
		state.contentEl.value = content.element;
		await nextTick();
		expect(observers).toHaveLength(1);
		expect(observerAt(observers, 0).observe).toHaveBeenCalledWith(content.element);
		expect(state.ltlEmojiVoteViewport.value).toEqual({ top: '92px', left: '112px', width: '800px', height: '640px' });
		Object.assign(content.geometry, { clientWidth: 590, clientHeight: 530, offsetTop: 144, offsetLeft: 4 });
		observerAt(observers, 0).callback();
		expect(state.ltlEmojiVoteViewport.value).toEqual({ top: '144px', left: '4px', width: '590px', height: '530px' });
		content.element.style.paddingRight = '110px';
		Object.assign(content.geometry, { clientWidth: 700 });
		observerAt(observers, 0).callback();
		expect(state.ltlEmojiVoteViewport.value).toEqual({ top: '144px', left: '4px', width: '590px', height: '530px' });
	});

	it('observes only local timelines and disconnects when changing to another timeline', async () => {
		const { state, observers } = fixture();
		state.contentEl.value = contentFixture().element;
		await nextTick();
		expect(observers).toHaveLength(0);
		state.tab.value = 'local';
		await nextTick();
		expect(observers).toHaveLength(1);
		state.tab.value = 'social';
		await nextTick();
		expect(state.normalLtlVoteActive.value).toBe(false);
		expect(observerAt(observers, 0).disconnect).toHaveBeenCalledTimes(1);
		state.tab.value = 'local';
		await nextTick();
		expect(observers).toHaveLength(2);
	});

	it('disables normal LTL effects in desktop deck mode and resumes with the normal mobile layout', async () => {
		const { state, observers, deckIgnoreWidth } = fixture({ savedTab: 'local' });
		state.contentEl.value = contentFixture().element;
		await nextTick();
		state.deckMode.value = true;
		await nextTick();
		expect(state.deckActive.value).toBe(true);
		expect(state.normalLtlVoteActive.value).toBe(false);
		expect(observerAt(observers, 0).disconnect).toHaveBeenCalledTimes(1);
		state.windowWidth.value = 800;
		await nextTick();
		expect(state.deckActive.value).toBe(false);
		expect(state.normalLtlVoteActive.value).toBe(true);
		expect(observers).toHaveLength(2);
		deckIgnoreWidth.value = true;
		await nextTick();
		expect(state.deckActive.value).toBe(true);
		expect(observerAt(observers, 1).disconnect).toHaveBeenCalledTimes(1);
	});

	it('disconnects for other pages and replaces the observer when the content element changes', async () => {
		const { state, observers } = fixture({ savedTab: 'local' });
		state.contentEl.value = contentFixture().element;
		await nextTick();
		state.isPageView.value = true;
		await nextTick();
		expect(state.normalLtlVoteActive.value).toBe(false);
		expect(observerAt(observers, 0).disconnect).toHaveBeenCalledTimes(1);
		state.isPageView.value = false;
		await nextTick();
		const replacement = contentFixture();
		state.contentEl.value = replacement.element;
		await nextTick();
		expect(observers).toHaveLength(3);
		expect(observerAt(observers, 1).disconnect).toHaveBeenCalledTimes(1);
		expect(observerAt(observers, 2).observe).toHaveBeenCalledWith(replacement.element);
	});

	it('disconnects its observer on setup scope disposal and stops subsequent reactive work', async () => {
		const { state, observers, stop } = fixture({ savedTab: 'local' });
		state.contentEl.value = contentFixture().element;
		await nextTick();
		stop();
		expect(observerAt(observers, 0).disconnect).toHaveBeenCalledTimes(1);
		state.tab.value = 'social';
		await nextTick();
		state.tab.value = 'local';
		state.contentEl.value = contentFixture().element;
		await nextTick();
		expect(observers).toHaveLength(1);
	});
});
