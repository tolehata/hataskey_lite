/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it, vi } from 'vitest';
import * as ts from 'typescript';
import swSource from '../../../sw/src/sw.ts?raw';

const runInNewContext = process.getBuiltinModule('vm')!.runInNewContext;

function runSw(source: string, dependencies: Record<string, unknown>, globals: Record<string, unknown>) {
	const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
	const context = { exports: {}, require: (name: string) => dependencies[name] ?? {}, console, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, URL, Response, _DEV_: false, ...globals };
	runInNewContext(code, context);
	return context;
}

describe('service worker notification handlers', () => {
	it('closes only exact owner and notification IDs, including legacy read-all pushes without IDs', async () => {
		const handlers = new Map<string, (event: any) => void>();
		const one = { data: { type: 'notification', userId: 'owner', body: { id: 'one' } }, close: vi.fn() };
		const other = { data: { type: 'notification', userId: 'owner', body: { id: 'other' } }, close: vi.fn() };
		const differentOwner = { data: { type: 'notification', userId: 'elsewhere', body: { id: 'one' } }, close: vi.fn() };
		const empty = vi.fn();
		runSw(swSource, {
			'idb-keyval': { get: vi.fn() }, 'cherrypick-js': {},
			'@/scripts/create-notification.js': { createNotification: vi.fn(), createEmptyNotification: empty },
			'@/scripts/lang.js': { swLang: {} }, '@/scripts/operations.js': {},
		}, {
			addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
			registration: { getNotifications: vi.fn(async () => [one, other, differentOwner]) },
			clients: { matchAll: vi.fn(async () => []) },
		});
		const push = async (type: string, body: unknown) => {
			let task: Promise<unknown> = Promise.resolve();
			handlers.get('push')!({ data: { json: () => ({ type, body, userId: 'owner' }) }, waitUntil: (promise: Promise<unknown>) => { task = promise; } });
			await task;
		};
		await push('readNotification', { id: 'one' });
		expect(one.close).toHaveBeenCalledOnce();
		expect(other.close).not.toHaveBeenCalled();
		expect(differentOwner.close).not.toHaveBeenCalled();
		await push('readAllNotifications', undefined);
		expect(other.close).not.toHaveBeenCalled();
		await push('notificationChanged', { ids: ['other'] });
		expect(other.close).toHaveBeenCalledOnce();
		expect(empty).not.toHaveBeenCalled();
	});

	it('click and close mark the individual notification', async () => {
		const handlers = new Map<string, (event: any) => void>();
		const api = vi.fn(async () => undefined);
		const openClient = vi.fn(async () => ({ focus: vi.fn() }));
		runSw(swSource, {
			'idb-keyval': { get: vi.fn() }, 'cherrypick-js': {},
			'@/scripts/create-notification.js': {}, '@/scripts/lang.js': { swLang: {} },
			'@/scripts/operations.js': { api, openClient, sendMarkAllAsRead: vi.fn() },
		}, { addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler) });
		const notification = { data: { type: 'notification', userId: 'owner', body: { id: 'opaque123', type: 'receiveFollowRequest' } }, close: vi.fn() };
		let task: Promise<unknown> = Promise.resolve();
		handlers.get('notificationclick')!({ action: '', notification, waitUntil: (promise: Promise<unknown>) => { task = promise; } });
		await task;
		expect(openClient).toHaveBeenCalledWith('push', '/my/follow-requests', 'owner');
		expect(api).toHaveBeenCalledWith('notifications/mark-as-read', 'owner', { notificationIds: ['opaque123'] });
		api.mockClear();
		handlers.get('notificationclose')!({ notification, waitUntil: (promise: Promise<unknown>) => { task = promise; } });
		await task;
		expect(api).toHaveBeenCalledWith('notifications/mark-as-read', 'owner', { notificationIds: ['opaque123'] });
	});

});
