/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';

type Caller = 'menu' | 'settings';
const sources: Record<Caller, string> = {
	menu: 'utility/get-user-menu.ts',
	settings: 'pages/settings/mute-block.vue',
};

// Exercise the actual operation handlers without loading their unrelated page setup.
function operation(caller: Caller, bindings: Record<string, unknown>): (...args: unknown[]) => Promise<void> {
	const source = readFileSync(`${process.cwd()}/src/${sources[caller]}`, 'utf8');
	const script = source.match(/<script lang="ts" setup>([\s\S]*?)<\/script>/u)?.[1] ?? source;
	const ast = ts.createSourceFile('blocking.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const name = caller === 'settings' ? 'unblock' : 'toggleBlock';
	const declarations: ts.FunctionDeclaration[] = [];

	function visit(node: ts.Node): void {
		if (ts.isFunctionDeclaration(node) && node.name?.text === name) declarations.push(node);
		ts.forEachChild(node, visit);
	}

	visit(ast);
	const declaration = declarations.at(0);
	if (!declaration) throw new Error(`Missing blocking handler: ${caller}`);
	const code = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings));
}

async function settle(): Promise<void> {
	for (let index = 0; index < 4; index++) await Promise.resolve();
}

function fixture(caller: Caller, blocked: boolean, options: { canceled?: boolean; admin?: boolean } = {}) {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const pending = new Promise<void>((success, failure) => { resolve = success; reject = failure; });
	const request = vi.fn(() => pending);
	const emit = vi.fn();
	const user = { id: 'acted-user', username: 'flower-owner', isBlocking: blocked };
	const os = {
		confirm: vi.fn().mockResolvedValue({ canceled: options.canceled === true }),
		alert: vi.fn(), toast: vi.fn(), popupMenu: vi.fn(), apiWithDialog: request,
	};
	const action = operation(caller, {
		user,
		userIsAdmin: options.admin === true,
		getConfirmed: vi.fn().mockResolvedValue(options.canceled !== true),
		misskeyApi: request, globalEvents: { emit }, os,
		i18n: { ts: { blockConfirm: '確認', unblockConfirm: '解除', unblock: '解除', cannotBlockOrMuteAdministrator: '対象外' } },
	});

	async function openSettings(): Promise<void> { await action(user, { target: null }); }

	async function run(): Promise<void> {
		if (caller !== 'settings') return action();
		await openSettings();
		await os.popupMenu.mock.calls[0][0][0].action();
	}

	return { request, emit, resolve, reject, run, openSettings };
}

const operations = [
	['menu', false], ['menu', true], ['settings', true],
] as const;

describe('ブロック操作の完了通知', () => {
	test.each(operations)('%s blocked=%s: 成功前には送らず、成功後に操作対象を1回通知する', async (caller, blocked) => {
		const f = fixture(caller, blocked);
		const finished = f.run();
		await settle();
		expect(f.request).toHaveBeenCalledExactlyOnceWith(blocked ? 'blocking/delete' : 'blocking/create', { userId: 'acted-user' });
		expect(f.emit).not.toHaveBeenCalled();
		f.resolve();
		await finished;
		await settle();
		expect(f.emit).toHaveBeenCalledExactlyOnceWith('userBlockingChanged', { userId: 'acted-user' });
	});

	test.each(operations)('%s blocked=%s: API失敗では通知しない', async (caller, blocked) => {
		const f = fixture(caller, blocked);
		const finished = f.run().catch(() => undefined);
		await settle();
		expect(f.request).toHaveBeenCalledOnce();
		f.reject(new Error('failed request'));
		await finished;
		await settle();
		expect(f.emit).not.toHaveBeenCalled();
	});

	test.each(['menu'] as const)('%s: 確認キャンセル・管理者拒否ではAPIも通知も発生しない', async caller => {
		for (const options of [{ canceled: true }, { admin: true }]) {
			const f = fixture(caller, false, options);
			await f.run();
			await settle();
			expect(f.request).not.toHaveBeenCalled();
			expect(f.emit).not.toHaveBeenCalled();
		}
	});

	test('設定の解除メニューを開くだけでは通知しない', async () => {
		const f = fixture('settings', true);
		await f.openSettings();
		expect(f.request).not.toHaveBeenCalled();
		expect(f.emit).not.toHaveBeenCalled();
	});
});
