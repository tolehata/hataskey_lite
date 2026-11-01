/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { ref, shallowRef } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { interceptConcrntPostRequest } from './post-interceptor.js';
import type { PostFormProps } from '@/types/post-form.js';

function evaluate(source: string, bindings: Record<string, unknown>): Record<string, unknown> {
	const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
	return new Function(...Object.keys(bindings), code)(...Object.values(bindings));
}

function dispatcher() {
	const source = ts.createSourceFile('os.ts', readFileSync(resolve(process.cwd(), 'src/os.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
	const statements = source.statements.filter(statement =>
		(ts.isVariableStatement(statement) && statement.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === 'postFormInterceptors')) ||
		(ts.isFunctionDeclaration(statement) && ['registerPostFormInterceptor', 'post'].includes(statement.name?.text ?? '')));
	const body = statements.map(statement => statement.getText(source).replace(/^export /, '')).join('\n');
	const postDirect = vi.fn(async () => undefined);
	return { ...evaluate(`${body}\nreturn { registerPostFormInterceptor, post };`, { postDirect }), postDirect } as {
		registerPostFormInterceptor: (interceptor: (request: PostFormProps) => boolean) => () => void;
		post: (request?: PostFormProps) => Promise<void>;
		postDirect: typeof postDirect;
	};
}

function mountShell(filename: string, bindings: Record<string, unknown>) {
	const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
	const source = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup!.content, ts.ScriptTarget.Latest, true);
	const statements = source.statements.filter(statement =>
		(ts.isFunctionDeclaration(statement) && statement.name?.text === 'interceptConcrntPostForm') ||
		(ts.isVariableStatement(statement) && statement.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === 'releaseConcrntPostInterceptor')) ||
		(ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
			&& ['onMounted', 'onUnmounted', 'onActivated', 'onDeactivated'].includes(statement.expression.expression.getText(source))
			&& /releaseConcrntPostInterceptor|pageActive\.value/.test(statement.getText(source))));
	const mounted: (() => void)[] = [];
	const unmounted: (() => void)[] = [];
	const deactivated: (() => void)[] = [];
	const activated: (() => void)[] = [];
	const os = dispatcher();
	evaluate(statements.map(statement => statement.getText(source)).join('\n'), {
		...bindings, os, interceptConcrntPostRequest,
		onMounted: (callback: () => void) => mounted.push(callback),
		onUnmounted: (callback: () => void) => unmounted.push(callback),
		onActivated: (callback: () => void) => activated.push(callback),
		onDeactivated: (callback: () => void) => deactivated.push(callback),
	});
	mounted.forEach(callback => callback());
	return { os, unmount: () => unmounted.forEach(callback => callback()), deactivate: () => deactivated.forEach(callback => callback()), activate: () => activated.forEach(callback => callback()) };
}

describe('ordinary CTL post requests', () => {
	it('accepts only an empty new-post request and a ready composer', () => {
		const focus = vi.fn();
		expect(interceptConcrntPostRequest({}, focus)).toBe(true);
		expect(interceptConcrntPostRequest({}, undefined)).toBe(false);
		for (const request of [
			{ reply: null }, { renote: null }, { channel: null }, { initialText: '' },
			{ initialUseExternalAccount: false }, { restoreDraft: true }, { initialVisibility: 'specified' },
			{ initialFiles: [] }, { externalReply: null }, { updateMode: false },
		] satisfies PostFormProps[]) {
			expect(interceptConcrntPostRequest(request, focus)).toBe(false);
		}
		expect(focus).toHaveBeenCalledOnce();
	});
});

describe('main shell post interception', () => {
	it('routes keyboard/navbar os.post to visible CTL and unregisters on shell removal', async () => {
		const focusComposer = vi.fn();
		const bindings = { showCTL: ref(true), isConcrntTab: ref(true), isPageView: ref(false), deckActive: ref(false), concrntTimeline: shallowRef({ focusComposer }) };
		const shell = mountShell('src/ui/simple.vue', bindings);
		await shell.os.post();
		expect(focusComposer).toHaveBeenCalledOnce();
		expect(shell.os.postDirect).not.toHaveBeenCalled();
		bindings.showCTL.value = false;
		await shell.os.post();
		expect(focusComposer).toHaveBeenCalledTimes(2);
		expect(shell.os.postDirect).not.toHaveBeenCalled();
		shell.unmount();
		await shell.os.post();
		expect(shell.os.postDirect).toHaveBeenCalledWith({});
	});

	it('preserves local explicit inputs, hidden tabs, unrelated pages and Deck', async () => {
		const focusComposer = vi.fn();
		const bindings = { showCTL: ref(true), isConcrntTab: ref(true), isPageView: ref(false), deckActive: ref(false), concrntTimeline: shallowRef({ focusComposer }) };
		const shell = mountShell('src/ui/simple.vue', bindings);
		const request: PostFormProps = { initialText: 'local draft', initialVisibility: 'followers' };
		await shell.os.post(request);
		expect(shell.os.postDirect).toHaveBeenLastCalledWith(request);
		for (const [flag, value] of [[bindings.isConcrntTab, false], [bindings.isPageView, true], [bindings.deckActive, true]] as const) {
			const old = flag.value;
			flag.value = value;
			await shell.os.post();
			flag.value = old;
		}
		expect(shell.os.postDirect).toHaveBeenCalledTimes(4);
		expect(focusComposer).not.toHaveBeenCalled();
	});
});

describe.each([
	['standard timeline', 'src/pages/timeline.vue'],
	['independent CTL page', 'src/pages/concrnt.vue'],
])('%s post interception', (_label, filename) => {
	function fixture() {
		const focusComposer = vi.fn();
		const mainRouter = { currentRoute: ref({ name: 'concrnt', path: '/concrnt' }) };
		const contextActive = ref(true);
		const pageActive = ref(true);
		const bindings = {
			mainRouter, timelineRouter: mainRouter, pageRouter: mainRouter, timelineRoutePath: '/concrnt',
			pagePostContext: () => contextActive.value, pageActive, showCTL: ref(true), src: ref('ctl'), switchTlIfNeeded: vi.fn(),
			concrntTlComponent: shallowRef({ focusComposer }), concrntTimeline: shallowRef({ focusComposer }), props: {},
		};
		return { focusComposer, contextActive, mainRouter, pageActive, bindings };
	}

	it('focuses only the active main page and leaves explicit local requests unchanged', async () => {
		const view = fixture();
		const shell = mountShell(filename, view.bindings);
		await shell.os.post();
		expect(view.focusComposer).toHaveBeenCalledOnce();
		const request: PostFormProps = { initialText: 'explicit local post' };
		await shell.os.post(request);
		expect(shell.os.postDirect).toHaveBeenLastCalledWith(request);
		shell.deactivate();
		await shell.os.post();
		expect(view.focusComposer).toHaveBeenCalledOnce();
		shell.activate();
		await shell.os.post();
		expect(view.focusComposer).toHaveBeenCalledTimes(2);
		shell.unmount();
		await shell.os.post();
		expect(shell.os.postDirect).toHaveBeenCalledTimes(3);
	});

	it('ignores a retained previous route or a shell that cannot identify a posting destination', async () => {
		const view = fixture();
		const shell = mountShell(filename, view.bindings);
		view.mainRouter.currentRoute.value = { name: 'settings', path: '/settings' };
		await shell.os.post();
		view.mainRouter.currentRoute.value = { name: 'concrnt', path: '/concrnt' };
		view.contextActive.value = false;
		await shell.os.post();
		expect(view.focusComposer).not.toHaveBeenCalled();
		expect(shell.os.postDirect).toHaveBeenCalledTimes(2);
	});

	it('does not let a page window intercept the main shell shortcut', async () => {
		const view = fixture();
		const windowRouter = { currentRoute: ref({ name: 'concrnt', path: '/concrnt' }) };
		const shell = mountShell(filename, { ...view.bindings, pageRouter: windowRouter, timelineRouter: windowRouter });
		await shell.os.post();
		expect(view.focusComposer).not.toHaveBeenCalled();
		expect(shell.os.postDirect).toHaveBeenCalledWith({});
	});
});
