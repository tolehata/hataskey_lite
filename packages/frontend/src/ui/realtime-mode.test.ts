/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Pizzax } from '@/lib/pizzax.js';

const persistence = vi.hoisted(() => ({
	values: new Map<string, { realtimeMode: boolean }>(),
	get: vi.fn(),
	set: vi.fn(),
}));

vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/store.js', () => ({ store: {} }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/idb-proxy.js', () => ({ get: persistence.get, set: persistence.set }));
vi.mock('broadcast-channel', () => ({
	BroadcastChannel: class {
		addEventListener() {}
		postMessage() {}
	},
}));

const stateKey = 'pizzax::realtime-regression';

function createStore() {
	return new Pizzax('realtime-regression', { realtimeMode: { where: 'device', default: true } });
}

function toggleFixture(path: string, state: ReturnType<typeof createStore>, removeAwait = false) {
	const source = readFileSync(resolve(process.cwd(), 'src/ui', path), 'utf8');
	const script = parse(source).descriptor.scriptSetup;
	if (!script) throw new Error('Missing setup script');
	const file = ts.createSourceFile(path, script.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const handler = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'toggleRealtimeMode');
	if (!handler) throw new Error('Missing realtime toggle');
	const original = handler.getText(file);
	const body = removeAwait ? original.replace('await store.set(', 'store.set(') : original;
	if (removeAwait) expect(body).not.toBe(original);
	const reload = vi.fn();
	let menuAction: (() => Promise<void>) | undefined;
	const compiled = ts.transpileModule(`${body}\ntoggleRealtimeMode;`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
	});
	const toggle = runInNewContext(compiled.outputText, {
		store: state,
		'window': { 'location': { reload } },
		i18n: { ts: {} },
		os: { popupMenu: (items: { action?: () => Promise<void> }[]) => { menuAction = items.find(item => item.action)?.action; } },
	}, { timeout: 1000 }) as (event?: object) => Promise<void> | void;
	return {
		reload,
		click: () => {
			const result = toggle({ currentTarget: {} });
			return Promise.resolve(menuAction ? menuAction() : result);
		},
	};
}

beforeEach(() => {
	localStorage.clear();
	persistence.values.clear();
	persistence.get.mockReset().mockImplementation(async (key: string) => structuredClone(persistence.values.get(key)));
	persistence.set.mockReset().mockImplementation(async (key: string, value: { realtimeMode: boolean }) => {
		persistence.values.set(key, structuredClone(value));
	});
});

describe.each(['simple.vue', '_common_/navbar.vue'])('%s のリアルタイム切替', (path) => {
	test.each([true, false])('保存完了後にリロードし、起動し直しても %s の反転を保持する', async (initial) => {
		persistence.values.set(stateKey, { realtimeMode: initial });
		const state = createStore();
		await state.ready;
		const saved = Promise.withResolvers<void>();
		persistence.set.mockImplementationOnce(async (key: string, value: { realtimeMode: boolean }) => {
			await saved.promise;
			persistence.values.set(key, structuredClone(value));
		});
		const { click, reload } = toggleFixture(path, state);
		const completed = click();
		await vi.waitFor(() => expect(persistence.set).toHaveBeenCalledOnce());
		expect(state.s.realtimeMode).toBe(!initial);
		expect(persistence.values.get(stateKey)?.realtimeMode).toBe(initial);
		expect(reload).not.toHaveBeenCalled();
		saved.resolve();
		await completed;
		expect(reload).toHaveBeenCalledOnce();
		const restored = createStore();
		await restored.ready;
		expect(restored.s.realtimeMode).toBe(!initial);
	});

	test('保存に失敗した場合はリロードしない', async () => {
		persistence.values.set(stateKey, { realtimeMode: true });
		const state = createStore();
		await state.ready;
		const failure = new Error('Storage write failed');
		persistence.set.mockRejectedValueOnce(failure);
		const { click, reload } = toggleFixture(path, state);
		await expect(click()).rejects.toBe(failure);
		expect(reload).not.toHaveBeenCalled();
		const restored = createStore();
		await restored.ready;
		expect(restored.s.realtimeMode).toBe(true);
	});

	test('陽性対照: 保存待ちを外すとリロード時点ではオンのままになる', async () => {
		persistence.values.set(stateKey, { realtimeMode: true });
		const state = createStore();
		await state.ready;
		const saved = Promise.withResolvers<void>();
		persistence.set.mockImplementationOnce(async (key: string, value: { realtimeMode: boolean }) => {
			await saved.promise;
			persistence.values.set(key, structuredClone(value));
		});
		const { click, reload } = toggleFixture(path, state, true);
		await click();
		expect(reload).toHaveBeenCalledOnce();
		const restoredBeforeSave = createStore();
		await restoredBeforeSave.ready;
		expect(restoredBeforeSave.s.realtimeMode).toBe(true);
		saved.resolve();
		await vi.waitFor(() => expect(persistence.values.get(stateKey)?.realtimeMode).toBe(false));
	});
});
