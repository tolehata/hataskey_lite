/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeTypes } from '@vue/compiler-core';
import type { ElementNode, RootNode } from '@vue/compiler-core';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function component(name: string) {
	const filename = `src/components/${name}.vue`;
	const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
	const script = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	return { descriptor, script };
}

const header = component('MkNoteHeader');
const sub = component('MkNoteSub');

function declaration(script: ts.SourceFile, name: string) {
	const statement = script.statements.find(item => ts.isVariableStatement(item)
		&& item.declarationList.declarations.some(value => ts.isIdentifier(value.name) && value.name.text === name));
	if (!statement) throw new Error(`Missing declaration: ${name}`);
	return statement.getText(script);
}

function functionCode(script: ts.SourceFile, name: string) {
	const statement = script.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === name);
	if (!statement) throw new Error(`Missing function: ${name}`);
	return statement.getText(script);
}

function transpile(source: string) {
	return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

function elements(node: RootNode | ElementNode): ElementNode[] {
	return node.children.flatMap(child => child.type === NodeTypes.ELEMENT ? [child, ...elements(child)] : []);
}

function boundClass(element: ElementNode, name: string) {
	return element.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind'
		&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === 'class'
		&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION && prop.exp.content === `$style.${name}`);
}

describe('recursive note ticker', () => {
	it('reserves a footer inside each note body, before recursively rendered replies', () => {
		const nodes = elements(sub.descriptor.template!.ast!);
		const main = nodes.find(node => boundClass(node, 'main'))!;
		const body = nodes.find(node => boundClass(node, 'body'))!;
		const footer = nodes.find(node => boundClass(node, 'tickerFooter'))!;
		const reply = nodes.find(node => node.tag === 'MkNoteSub')!;
		const bodyChildren = body.children.filter((node): node is ElementNode => node.type === NodeTypes.ELEMENT);
		expect(elements(main)).toContain(body);
		expect(bodyChildren.at(-1)).toBe(footer);
		expect(elements(main)).not.toContain(reply);
		expect(nodes.indexOf(footer)).toBeLessThan(nodes.indexOf(reply));
		expect(sub.descriptor.template!.content).toContain(':showTicker="false"');
		expect(sub.descriptor.template!.content).toContain('<MkInstanceTicker :host="note.user.host" :instance="note.user.instance" @click.stop="showOnRemote"/>');
		expect(header.descriptor.template!.content).toContain('v-if="tickerVisible"');
		expect(header.descriptor.styles[0].content).toMatch(/\.ticker\s*\{[^}]*position:\s*absolute;[^}]*right:\s*12px;[^}]*bottom:\s*8px;/);
		const css = sub.descriptor.styles[0].content;
		const footerCss = css.match(/\.tickerFooter\s*\{([\s\S]*?)\n\}/)?.[1];
		expect(footerCss).toMatch(/justify-content:\s*flex-end/);
		expect(footerCss).toMatch(/max-width:\s*100%/);
		expect(footerCss).toMatch(/max-width:\s*min\(100%,\s*320px\)/);
		expect(footerCss).not.toMatch(/position:\s*absolute/);
	});

	it('keeps the header default and matches the original ticker preference for each note', () => {
		const headerCode = transpile(`${declaration(header.script, 'props')}\n${declaration(header.script, 'tickerVisible')}\nreturn tickerVisible;`);
		const subCode = transpile(`${declaration(sub.script, 'showTicker')}\nreturn showTicker;`);
		const visible = (setting: string, instance: object | undefined, enabled?: boolean) => {
			const note = { user: { instance } };
			const prefer = { s: { instanceTicker: setting } };
			const supplied = enabled === undefined ? { note } : { note, showTicker: enabled };
			const headerVisible = new Function('defineProps', 'withDefaults', 'prefer', headerCode)(
				() => supplied, (props: object, defaults: object) => ({ ...defaults, ...props }), prefer);
			const subVisible = new Function('props', 'prefer', subCode)({ note }, prefer);
			return { headerVisible: !!headerVisible, subVisible: !!subVisible };
		};
		expect(visible('always', undefined)).toEqual({ headerVisible: true, subVisible: true });
		expect(visible('remote', { name: 'Remote' })).toEqual({ headerVisible: true, subVisible: true });
		expect(visible('remote', undefined)).toEqual({ headerVisible: false, subVisible: false });
		expect(visible('none', { name: 'Remote' })).toEqual({ headerVisible: false, subVisible: false });
		expect(visible('always', undefined, false).headerVisible).toBe(false);
	});

	it('opens the same local note or remote URL when its footer ticker is clicked', () => {
		const code = transpile(`${functionCode(sub.script, 'showOnRemote')}\nreturn showOnRemote;`);
		const router = { pushByPath: vi.fn() };
		const window = { open: vi.fn() };
		const notePage = (note: { id: string }) => `/notes/${note.id}`;
		const click = (note: object) => new Function('props', 'router', 'notePage', 'window', code)(
			{ note }, router, notePage, window)();
		click({ id: 'local', user: { instance: undefined } });
		expect(router.pushByPath).toHaveBeenCalledWith('/notes/local');
		expect(window.open).not.toHaveBeenCalled();
		click({ id: 'remote', user: { instance: {} }, uri: 'https://remote.example/notes/remote' });
		expect(window.open).toHaveBeenCalledWith('https://remote.example/notes/remote', '_blank', 'noopener');
	});
});
