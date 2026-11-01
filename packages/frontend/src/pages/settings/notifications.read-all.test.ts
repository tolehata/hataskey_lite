/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { refreshNotificationUnreadState } from '@/utility/notification-unread-sync.js';
import { forgetNotificationUnreadState } from '@/utility/notification-unread-state.js';

const fixture = vi.hoisted(() => ({
	account: { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 3 },
	api: vi.fn(),
	read: vi.fn(),
}));
vi.mock('@/i.js', () => ({ $i: fixture.account }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccount: (partial: object) => Object.assign(fixture.account, partial) }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixture.api(...args) }));

type TemplateNode = NonNullable<NonNullable<ReturnType<typeof parse>['descriptor']['template']>['ast']>['children'][number];
type ElementNode = Extract<TemplateNode, { type: 1 }>;

function allElements(nodes: TemplateNode[]): ElementNode[] {
	return nodes.flatMap(node => node.type === 1 ? [node, ...allElements(node.children)] : []);
}

/** Execute the real button binding and handler without mounting unrelated settings. */
function readAction(filename: string): () => Promise<void> {
	const path = resolve(process.cwd(), filename);
	const descriptor = parse(readFileSync(path, 'utf8'), { filename: path }).descriptor;
	if (!descriptor.template?.ast || !descriptor.scriptSetup) throw new Error('Missing notification component source');
	const button = allElements(descriptor.template.ast.children).find(node =>
		node.props.some(prop => prop.type === 7 && prop.name === 'tooltip' && prop.exp?.type === 4 && prop.exp.content === 'i18n.ts.markAllAsRead')
		|| node.children.some(child => child.type === 5 && child.content.type === 4 && child.content.content === 'i18n.ts.markAsReadAllNotifications'));
	const click = button?.props.find(prop => prop.type === 7 && prop.name === 'on' && prop.arg?.type === 4 && prop.arg.content === 'click');
	if (click?.type !== 7 || click.exp?.type !== 4) throw new Error('Missing mark-all-read click handler');
	const source = ts.createSourceFile(path, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'readAllNotifications').map(node => node.getText(source));
	const code = ts.transpileModule(`${functions.join('\n')}\n(() => { const action = ${click.exp.content}; return typeof action === 'function' ? action() : action; });`, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
	}).outputText;
	return runInNewContext(code, { $i: fixture.account, os: { apiWithDialog: fixture.read }, refreshNotificationUnreadState }, { timeout: 1000 }) as () => Promise<void>;
}

function deferred() {
	let finish: () => void = () => { throw new Error('Promise resolver not initialized'); };
	const promise = new Promise<void>(done => { finish = done; });
	return { promise, resolve: finish };
}

beforeEach(() => {
	Object.assign(fixture.account, { id: 'owner-a', hasUnreadNotification: true, unreadNotificationsCount: 3 });
	fixture.api.mockReset().mockResolvedValue({ unreadNotificationsCount: 0, revision: '1' });
	fixture.read.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { forgetNotificationUnreadState('owner-a'); forgetNotificationUnreadState('owner-b'); });

describe.each([
	['widget', 'src/widgets/WidgetNotifications.vue'],
	['settings', 'src/pages/settings/notifications.vue'],
])('%s mark-all-read without stream events', (_name, filename) => {
	test('clears the badge only after the read succeeds and the server count is fetched', async () => {
		const request = deferred();
		fixture.read.mockReturnValue(request.promise);
		const action = readAction(filename)();
		expect(fixture.read).toHaveBeenCalledExactlyOnceWith('notifications/mark-all-as-read', {});
		expect(fixture.api).not.toHaveBeenCalled();
		expect(fixture.account.unreadNotificationsCount).toBe(3);
		request.resolve();
		await action;
		expect(fixture.api).toHaveBeenCalledExactlyOnceWith('notifications/unread-count', {});
		expect(fixture.account).toMatchObject({ hasUnreadNotification: false, unreadNotificationsCount: 0 });
	});

	test('keeps notifications that arrived after mark-all-read in the badge', async () => {
		fixture.api.mockResolvedValue({ unreadNotificationsCount: 2, revision: '2' });
		await readAction(filename)();
		expect(fixture.account).toMatchObject({ hasUnreadNotification: true, unreadNotificationsCount: 2 });
	});

	test('does not apply a completed read to an account switched during the request', async () => {
		const request = deferred();
		fixture.read.mockReturnValue(request.promise);
		const action = readAction(filename)();
		fixture.account.id = 'owner-b';
		request.resolve();
		await action;
		expect(fixture.api).not.toHaveBeenCalled();
		expect(fixture.account).toMatchObject({ id: 'owner-b', hasUnreadNotification: true, unreadNotificationsCount: 3 });
	});

	test('a failed read keeps the badge and does not request a count', async () => {
		fixture.read.mockRejectedValue(new Error('read failed'));
		await readAction(filename)().catch(() => undefined);
		expect(fixture.api).not.toHaveBeenCalled();
		expect(fixture.account).toMatchObject({ hasUnreadNotification: true, unreadNotificationsCount: 3 });
	});
});
