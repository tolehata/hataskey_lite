/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, compileTemplate, parse } from '@vue/compiler-sfc';
import { parse as parseCss } from 'postcss';
import * as ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { hatagoesUrl } from '@/utility/hatagoes-navigation.js';

const filename = resolve(process.cwd(), 'src/ui/simple.vue');
const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor;
const root = descriptor.template?.ast?.children.find(node => node.type === 1);
if (root?.type !== 1 || !descriptor.scriptSetup) throw new Error('Missing production shell');
const lane = root.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.type === 4 && prop.arg.content === 'data-note-charm-lane');
if (lane?.type !== 7 || lane.exp?.type !== 4) throw new Error('Missing production charm lane binding');
const laneExpression = lane.exp.content;
const setup = ts.createSourceFile(filename, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const routeCondition = setup.statements.find(statement => ts.isVariableStatement(statement)
	&& statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'isHataGoesPage'));
if (!routeCondition) throw new Error('Missing production HataGoes route condition');
const routeCode = ts.transpileModule(`${routeCondition.getText(setup)}\nreturn isHataGoesPage;`, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

let classes: Record<string, string>;
let css: string;
let render: Vue.RenderFunction;
const cleanup: (() => void)[] = [];

beforeAll(async () => {
	const result = await compileStyleAsync({ filename, source: descriptor.styles[0].content, id: 'charm-shell-test', preprocessLang: 'scss', modules: true });
	expect(result.errors).toEqual([]);
	classes = result.modules!;
	const laneRules: string[] = [];
	parseCss(result.code).walkRules(rule => { if (rule.selector.includes('[data-note-charm-lane=')) laneRules.push(rule.toString()); });
	expect(laneRules.length).toBeGreaterThan(0);
	css = laneRules.join('\n');
	const compiled = compileTemplate({
		source: `<div class="${classes.root}" :data-note-charm-lane="${laneExpression}" style="--note-charm-rail-width: 110px"><div class="${classes.mainColumn}"><div class="${classes.mainColumnInner}" data-test-column></div></div></div>`,
		filename: 'simple-charm-lane-test.vue', id: 'charm-shell-test', compilerOptions: { mode: 'function', prefixIdentifiers: true },
	});
	expect(compiled.errors).toEqual([]);
	render = new Function('Vue', compiled.code)(Vue);
});

afterEach(() => cleanup.splice(0).forEach(dispose => dispose()));

function mount(fullPath: string, options: { available?: boolean; desktop?: boolean; deck?: boolean } = {}) {
	const route = Vue.ref({ path: new URL(fullPath, 'https://local.invalid').pathname });
	const sheet = window.document.createElement('style'); sheet.textContent = css; window.document.head.append(sheet);
	const host = window.document.createElement('div'); window.document.body.append(host);
	const app = Vue.createApp({ render, setup: () => ({
		isHataGoesPage: new Function('computed', 'mainRouter', routeCode)(Vue.computed, { currentRoute: route }),
		noteCharmShellAvailable: options.available ?? true, isDesktop: options.desktop ?? true, deckActive: options.deck ?? false,
	}) });
	app.mount(host);
	cleanup.push(() => { app.unmount(); host.remove(); sheet.remove(); });
	return {
		root: host.firstElementChild!,
		padding: () => Number.parseFloat(window.getComputedStyle(host.querySelector<HTMLElement>('[data-test-column]')!).paddingRight) || 0,
		navigate: async (path: string) => { route.value = { path: new URL(path, 'https://local.invalid').pathname }; await Vue.nextTick(); },
	};
}

test.each(['home', '/hatask?tab=garden', '/hatady?tab=records', '/hatafeed?tab=issues'])('HataGoes %s uses the full content column without a charm lane', view => {
	const shell = mount(hatagoesUrl(view));
	expect(shell.root.hasAttribute('data-note-charm-lane')).toBe(false);
	expect(shell.padding()).toBe(0);
});

test.each(['/', '/@alice', '/notes/note-id'])('the note surface %s retains its outside charm lane', path => {
	const shell = mount(path);
	expect(shell.root.getAttribute('data-note-charm-lane')).toBe('on');
	expect(shell.padding()).toBe(110);
});

test('navigating into HataGoes and back toggles the existing lane without remounting the shell', async () => {
	const shell = mount('/');
	expect(shell.padding()).toBe(110);
	await shell.navigate(hatagoesUrl('/hatask?tab=garden'));
	expect(shell.padding()).toBe(0);
	await shell.navigate('/');
	expect(shell.padding()).toBe(110);
});

test.each([{ desktop: false }, { deck: true }, { available: false }])('preserves the existing unavailable-lane gate %j', options => {
	const shell = mount('/', options);
	expect(shell.root.hasAttribute('data-note-charm-lane')).toBe(false);
	expect(shell.padding()).toBe(0);
});
