/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

const filename = 'src/ui/_common_/hatasaba-deck.vue';
const { descriptor } = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename });
const script = ts.createSourceFile(filename, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true);

function evaluate(names: string[], bindings: Record<string, unknown>) {
	const selected = script.statements.filter(statement =>
		(ts.isFunctionDeclaration(statement) && names.includes(statement.name?.text ?? '')) ||
		(ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text))));
	expect(selected).toHaveLength(names.length);
	const code = ts.transpileModule(`${selected.map(statement => statement.getText(script)).join('\n')}\nreturn { ${names.join(', ')} };`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
	}).outputText;
	return new Function(...Object.keys(bindings), code)(...Object.values(bindings));
}

function fixture() {
	const props = Vue.reactive({ hk3: false, active: true });
	const connection = Vue.reactive({ connection: {} as object | null, settings: { enabled: true } });
	const externalReady = Vue.ref(false);
	const colRefs = new Map();
	const slots = Vue.ref([{ id: 'slot', frames: [{ id: 'frame', activeTab: 'ctl', tabs: [{ id: 'ctl', type: 'ctl' }, { id: 'home', type: 'home' }] }] }]);
	const ConcrntTimeline = Vue.defineComponent({
		props: ['active', 'embedded'],
		setup: (childProps) => {
			const draft = Vue.ref('');
			return () => Vue.h('textarea', { value: draft.value, 'data-active': String(childProps.active), onInput: (event: Event) => { draft.value = (event.target as HTMLTextAreaElement).value; } });
		},
	});
	const normal = Vue.defineComponent({ render: () => Vue.h('p', 'local') });
	const select = vi.fn(async (_options: unknown) => ({ canceled: false, result: 'ctl' }));
	const addSlotWithTab = vi.fn();
	const recordInColumn = vi.fn();
	const bindings = {
		props, computed: Vue.computed, concrntState: connection, externalReady, externalHost: Vue.ref(''), externalToken: Vue.ref(''),
		copy: new Proxy({}, { get: (_target, key) => String(key) }), NOTE_SRC: { home: 'home' },
		ConcrntTimeline, MkStreamingNotesTimeline: normal, Hk3DeckTimeline: normal, MkExternalTimeline: normal,
		colRefs, slots, visibleSlots: slots, recordInColumn, HTMLElement,
		isHataskeyTimelineAllowed: () => true, os: { select }, addSlotWithTab,
		globalEvents: { emit: vi.fn() },
	};
	const functions = evaluate(['COLUMN_META', 'concrntReady', 'tabIcon', 'tabTitle', 'activeTabOf', 'resolveColumn', 'buildColumnProps', 'columnPropsCache', 'columnProps', 'onDeckKeydown', 'columnTypeMenu', 'addColumn', 'reloadAll'], bindings);
	return { ...functions, props, connection, externalReady, colRefs, slots, ConcrntTimeline, normal, select, addSlotWithTab, recordInColumn };
}

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

describe('custom Deck CTL columns', () => {
	test('offers CTL in column, tab and stacked-frame menus independently of Misskey', async () => {
		const current = fixture();
		const picked = vi.fn();
		const menu = current.columnTypeMenu(window.document.createElement('button'), picked);
		const entry = menu.find((item: { text?: string }) => item.text === 'CTL（コンカレント）');
		expect(entry.icon).toBe('concrnt-icon');
		entry.action();
		expect(picked).toHaveBeenCalledWith({ type: 'ctl' });
		await current.addColumn({ currentTarget: window.document.createElement('button') });
		expect(current.select.mock.calls[0][0]).toMatchObject({ items: expect.arrayContaining([{ value: 'ctl', label: 'CTL（コンカレント）' }]) });
		expect(current.addSlotWithTab).toHaveBeenCalledWith({ type: 'ctl' });
		current.connection.settings.enabled = false;
		current.externalReady.value = true;
		expect(current.columnTypeMenu(window.document.createElement('button'), picked).some((item: { icon?: string }) => item.icon === 'concrnt-icon')).toBe(false);
		current.connection.settings.enabled = true;
		current.connection.connection = null;
		await current.addColumn({ currentTarget: window.document.createElement('button') });
		expect(current.select.mock.calls[1][0]).toMatchObject({ items: expect.not.arrayContaining([expect.objectContaining({ value: 'ctl' })]) });
	});

	test.each([false, true])('uses the common timeline and official icon even after disconnect (HK3=%s)', hk3 => {
		const current = fixture();
		current.props.hk3 = hk3;
		const tab = { id: 'ctl', type: 'ctl' };
		expect(current.resolveColumn(tab)).toBe(current.ConcrntTimeline);
		expect(current.tabIcon(tab)).toBe('concrnt-icon');
		expect(current.tabTitle(tab)).toBe('CTL');
		expect(current.buildColumnProps(tab)).toEqual({ embedded: true, hataskeyUi: true });
		current.connection.connection = null;
		expect(current.resolveColumn(tab)).toBe(current.ConcrntTimeline);
		expect(current.resolveColumn({ id: 'home', type: 'home' })).toBe(current.normal);
	});

	function panes() {
		const found: string[] = [];
		type TemplateNode = NonNullable<NonNullable<typeof descriptor.template>['ast']>['children'][number];

		function visit(node: TemplateNode) {
			if (node.type !== 1) return;
			if (node.children.some(child => child.type === 1 && child.tag === 'component')) found.push(node.loc.source);
			for (const child of node.children) visit(child);
		}

		for (const child of descriptor.template!.ast!.children) visit(child);
		expect(found).toHaveLength(3);
		return found;
	}

	test.each([0, 1, 2])('retains the actual template pane and draft across inactive tabs/layout %s', async layout => {
		const current = fixture();
		const frame = current.slots.value[0].frames[0];
		const tab = frame.tabs[0];
		const compiled = compileTemplate({ source: panes()[layout], filename, id: 'deck-pane', compilerOptions: { mode: 'function', prefixIdentifiers: true } });
		expect(compiled.errors).toEqual([]);
		const render = new Function('Vue', compiled.code)(Vue);
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const app = Vue.createApp({
			setup: () => ({ frame, tab, activeTabOf: current.activeTabOf, resolveColumn: current.resolveColumn, columnProps: current.columnProps, setPaneRef: vi.fn(), setColRef: vi.fn() }),
			render,
		});
		app.config.globalProperties.$style = {};
		app.mount(target);
		cleanups.push(() => { app.unmount(); target.remove(); });
		const input = target.querySelector('textarea')!;
		input.value = 'CTL 下書き';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await Vue.nextTick();
		expect(input.dataset.active).toBe('true');
		frame.activeTab = 'home';
		await Vue.nextTick();
		expect(target.querySelector('textarea')).toBe(input);
		expect(input.dataset.active).toBe('false');
		expect((target.firstElementChild as HTMLElement).style.display).toBe('none');
		frame.activeTab = 'ctl';
		await Vue.nextTick();
		expect(input.value).toBe('CTL 下書き');
		expect(input.dataset.active).toBe('true');
		current.props.active = false;
		await Vue.nextTick();
		expect(input.dataset.active).toBe('false');
		expect(target.querySelector('textarea')).toBe(input);
	});

	test('routes p/n only from the identified active CTL frame and keeps native/editor paths', () => {
		const current = fixture();
		const focusComposer = vi.fn();
		current.colRefs.set('ctl', { focusComposer });
		const target = window.document.createElement('div');
		target.dataset.deckFrame = 'frame';
		const button = window.document.createElement('button');
		const input = window.document.createElement('textarea');
		target.append(button, input);
		target.addEventListener('keydown', current.onDeckKeydown);
		const key = (element: HTMLElement, options: KeyboardEventInit = {}) => {
			const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true, ...options });
			element.dispatchEvent(event);
			return event;
		};
		expect(key(button).defaultPrevented).toBe(true);
		expect(key(button, { key: 'n' }).defaultPrevented).toBe(true);
		expect(focusComposer).toHaveBeenCalledTimes(2);
		expect(key(input).defaultPrevented).toBe(false);
		expect(key(button, { ctrlKey: true }).defaultPrevented).toBe(false);
		current.props.active = false;
		expect(key(button).defaultPrevented).toBe(false);
		current.props.active = true;
		current.slots.value[0].frames[0].activeTab = 'home';
		expect(key(button).defaultPrevented).toBe(false);
		current.slots.value[0].frames[0].activeTab = 'ctl';
		target.dataset.deckFrame = 'unknown';
		expect(key(button).defaultPrevented).toBe(false);
		expect(focusComposer).toHaveBeenCalledTimes(2);
		expect(current.recordInColumn).not.toHaveBeenCalled();
	});

	test('refreshes only the active CTL tab', () => {
		const current = fixture();
		const reloadTimeline = vi.fn();
		current.colRefs.set('ctl', { reloadTimeline });
		current.reloadAll();
		expect(reloadTimeline).toHaveBeenCalledOnce();
		current.slots.value[0].frames[0].activeTab = 'home';
		current.reloadAll();
		current.slots.value[0].frames[0].activeTab = 'ctl';
		current.props.active = false;
		current.reloadAll();
		expect(reloadTimeline).toHaveBeenCalledOnce();
	});
});
