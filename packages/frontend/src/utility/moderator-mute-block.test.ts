/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { computed } from 'vue';
import { describe, expect, test, vi } from 'vitest';

type Caller = 'menu';
type Handler = 'toggleMute' | 'toggleBlock' | 'toggleRenoteMute';
const sources: Record<Caller, string> = {
	menu: 'utility/get-user-menu.ts',
};

// Execute the actual role declarations and handlers, without unrelated page setup.
function operation(caller: Caller, handler: Handler, bindings: Record<string, unknown>): () => Promise<void> {
	const source = readFileSync(`${process.cwd()}/src/${sources[caller]}`, 'utf8');
	const script = source.match(/<script lang="ts" setup>([\s\S]*?)<\/script>/u)?.[1] ?? source;
	const ast = ts.createSourceFile('moderation.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const declarations = new Map<string, string>();
	let action: string | undefined;

	function visit(node: ts.Node): void {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ['userIsAdmin', 'excludedFromReactionHiding'].includes(node.name.text)) {
			declarations.set(node.name.text, `const ${node.getText(ast)};`);
		}
		if (ts.isFunctionDeclaration(node) && node.name?.text === handler) action = node.getText(ast);
		ts.forEachChild(node, visit);
	}

	visit(ast);
	if (!declarations.has('userIsAdmin') || !action) throw new Error(`Missing role check or handler: ${caller}/${handler}`);
	const code = ts.transpileModule([...declarations.values(), action].join('\n'), {
		compilerOptions: { target: ts.ScriptTarget.ES2022 },
	}).outputText;
	return new Function(...Object.keys(bindings), `${code}; return ${handler};`)(...Object.values(bindings));
}

const roles = [
	{ label: '一般ユーザー', roles: [], denied: false },
	{ label: 'モデレーター', roles: [{ isAdministrator: false, isModerator: true }], denied: false },
	{ label: '管理者', roles: [{ isAdministrator: true, isModerator: false }], denied: true },
	{ label: '管理者兼モデレーター', roles: [{ isAdministrator: true, isModerator: true }], denied: true },
	{ label: '管理者フラグあり・公開ロールなし', roles: [], isAdmin: true, denied: true },
	{ label: '管理者フラグなし・モデレーター', roles: [{ isAdministrator: false, isModerator: true }], isAdmin: false, denied: false },
];

const operations = [
	['menu', 'toggleMute', 'mute/create'],
	['menu', 'toggleBlock', 'blocking/create'],
	['menu', 'toggleRenoteMute', 'renote-mute/create'],
] as const;

describe.each(operations)('%s/%s: 対象の権限による操作可否', (caller, handler, endpoint) => {
	test.each(roles)('$label', async role => {
		const user = {
			id: 'target-user', username: 'target', roles: role.roles,
			...('isAdmin' in role ? { isAdmin: role.isAdmin } : {}),
			isMuted: false, isBlocking: false, isRenoteMuted: false,
		};
		const request = vi.fn().mockResolvedValue(undefined);
		const updateMutedUserState = vi.fn();
		const emit = vi.fn();
		const os = {
			confirm: vi.fn().mockResolvedValue({ canceled: false }),
			select: vi.fn().mockResolvedValue({ canceled: false, result: 'indefinitely' }),
			alert: vi.fn(), toast: vi.fn(),
		};
		const action = operation(caller, handler, {
			user, computed,
			getConfirmed: vi.fn().mockResolvedValue(true),
			misskeyApi: request, updateMutedUserState, globalEvents: { emit }, os,
			i18n: { ts: { cannotBlockOrMuteAdministrator: '管理者はミュート・ブロックできません' } },
		});

		await action();
		await Promise.resolve();

		if (role.denied) {
			expect(os.alert).toHaveBeenCalledExactlyOnceWith({ type: 'error', text: '管理者はミュート・ブロックできません' });
			expect(request).not.toHaveBeenCalled();
			expect(updateMutedUserState).not.toHaveBeenCalled();
			expect(emit).not.toHaveBeenCalled();
		} else {
			expect(request).toHaveBeenCalledExactlyOnceWith(endpoint, {
				userId: 'target-user',
				...(caller === 'menu' && handler === 'toggleMute' ? { expiresAt: null } : {}),
			});
			expect(os.alert).not.toHaveBeenCalled();
			expect(os.toast).not.toHaveBeenCalled();
			if (handler === 'toggleMute') {
				expect(updateMutedUserState).toHaveBeenCalledExactlyOnceWith('target-user', true, null, false);
			}
		}
	});
});
