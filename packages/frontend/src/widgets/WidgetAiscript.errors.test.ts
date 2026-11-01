/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import WidgetAiscript from './WidgetAiscript.vue';

const state = vi.hoisted(() => ({
	alert: vi.fn(),
	parseError: null as Error | null,
	execError: null as Error | null,
	runtimeError: null as Error | null,
	lastOptions: null as { err?: (error: Error) => void; log?: (type: string, params: { val: unknown }) => void } | null,
}));

vi.mock('@syuilo/aiscript', () => ({
	Parser: class {
		parse() {
			if (state.parseError) throw state.parseError;
			return [];
		}
	},
	Interpreter: class {
		constructor(_env: unknown, options: typeof state.lastOptions) {
			state.lastOptions = options;
		}
		async exec() {
			if (state.execError) throw state.execError;
			if (state.runtimeError) state.lastOptions?.err?.(state.runtimeError);
			state.lastOptions?.log?.('end', { val: { isMutable: true, value: { type: 'num', value: 2 } } });
		}
	},
	utils: { valToString: (value: { value: number }) => String(value.value) },
}));
vi.mock('./widget.js', () => ({
	useWidgetPropsManager: () => ({ widgetProps: { showHeader: true, script: '1 + 1' }, configure: vi.fn() }),
}));
vi.mock('@/os.js', () => ({ alert: state.alert }));
vi.mock('@/aiscript/api.js', () => ({ aiScriptReadline: vi.fn(), createAiScriptEnv: () => ({}) }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _widgets: { aiscript: 'AiScript' } } } }));
vi.mock('@/utility/id.js', () => ({ genId: () => Math.random().toString() }));
vi.mock('@/components/MkContainer.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ setup: (_props, { slots }) => () => render('div', slots.default?.()) }) };
});

let container: HTMLElement;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
	state.alert.mockReset();
	state.parseError = null;
	state.execError = null;
	state.runtimeError = null;
	state.lastOptions = null;
	container = document.createElement('div');
	document.body.append(container);
	app = createApp(defineComponent({ setup: () => () => h(WidgetAiscript) }));
	app.mount(container);
});

afterEach(() => {
	app.unmount();
	container.remove();
});

async function run() {
	container.querySelector('button')!.click();
	await nextTick();
	await Promise.resolve();
	await nextTick();
}

describe('AiScript Widget errors', () => {
	test('asynchronous interpreter errors appear in the log and alert', async () => {
		state.runtimeError = new Error('async failure');
		await run();
		expect(container.querySelector('.log.error')?.textContent).toBe('Error: async failure');
		expect(state.alert).toHaveBeenCalledWith({ type: 'error', title: 'AiScript Error', text: 'Error: async failure' });
		// The current AiScript version wraps end values in a mutable container.
		expect(container.querySelector('.log.end')?.textContent).toBe('2');
	});

	test.each([
		['parseError', 'Syntax Error'],
		['execError', 'AiScript Internal Error'],
	] as const)('%s is classified and logged', async (kind, title) => {
		state[kind] = new Error(kind);
		await run();
		expect(container.querySelector('.log.error')?.textContent).toBe(`Error: ${kind}`);
		expect(state.alert).toHaveBeenCalledWith({ type: 'error', title, text: `Error: ${kind}` });
	});
});
