/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';
import locales from '../../../../locales/index.js';

// Run the actual SW entrypoints with browser/network dependencies replaced in memory.
// No browser permission request, subscription, or notification is sent by these tests.
function loadSwModule(path: string, modules: Record<string, unknown>, globals: Record<string, unknown>) {
	const source = readFileSync(`${process.cwd()}/../sw/src/${path}`, 'utf8');
	const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
	const exports: Record<string, (...args: any[]) => Promise<void>> = {};
	new Function('require', 'exports', 'globalThis', '_DEV_', compiled.outputText)((id: string) => {
		if (!(id in modules)) throw new Error(`Unexpected SW dependency: ${id}`);
		return modules[id];
	}, exports, globals, false);
	return exports;
}

const data = {
	type: 'notification', userId: 'alice',
	body: { id: 'flower-notice', type: 'hataskFlowerReady', header: 'Hataskのお花', body: '満開です', icon: null, link: '/hatask?tab=garden' },
};

const notificationCopy = {
	hataskFlowerReady: 'flowerReady',
	hataskFlowerBloomed: 'flowerBloomed',
	hataskZukanUpdated: 'zukanUpdated',
	hataskFestivalBloomed: 'festivalBloomed',
} as const;

type FlowerNotificationType = keyof typeof notificationCopy;

describe('Hatask flower push notification', () => {
	test.each(['ja-JP', 'en-US', 'zh-CN'].flatMap(lang => (Object.keys(notificationCopy) as FlowerNotificationType[]).map(type => [lang, type] as const)))('%sの%s通知を組み立てる', async (lang, type) => {
		const showNotification = vi.fn().mockResolvedValue(undefined);
		const locale = locales[lang];
		const flowerData = { ...data, body: { ...data.body, type } };
		const module = loadSwModule('scripts/create-notification.ts', {
			'@/scripts/twemoji-base.js': {}, '@/scripts/operations.js': {}, '@/scripts/get-account-from-id.js': {},
			'@/scripts/hata-custom-notification-copy.js': {}, '@/scripts/get-user-name.js': {},
			'@/scripts/lang.js': { swLang: { i18n: { ts: locale } } },
		}, { registration: { showNotification } });
		await module.createNotification(flowerData);
		expect(showNotification).toHaveBeenCalledExactlyOnceWith(locale._notification._types[type], expect.objectContaining({
			body: locale._hata._customNotifications[notificationCopy[type]], data: flowerData,
		}));
	});

	test.each(Object.keys(notificationCopy) as FlowerNotificationType[])('%sの通知クリックで対象アカウントの「おはな」を開く', async type => {
		const listeners = new Map<string, (event: unknown) => void>();
		const client = { focus: vi.fn() };
		const operations = { openClient: vi.fn().mockResolvedValue(client), sendMarkAllAsRead: vi.fn(), api: vi.fn().mockResolvedValue(undefined) };
		loadSwModule('sw.ts', {
			'idb-keyval': {}, 'cherrypick-js': {}, '@/scripts/create-notification.js': {},
			'@/scripts/lang.js': {}, '@/scripts/operations.js': operations,
		}, { addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler) });
		let completion: Promise<void> | undefined;
		const close = vi.fn();
		listeners.get('notificationclick')!({
			action: '', notification: { data: { ...data, body: { ...data.body, type } }, close },
			waitUntil: (promise: Promise<void>) => { completion = promise; },
		});
		await completion;
		expect(operations.openClient).toHaveBeenCalledExactlyOnceWith('push', '/hatask?tab=garden', 'alice');
		expect(operations.api).toHaveBeenCalledExactlyOnceWith('notifications/mark-as-read', 'alice', { notificationIds: ['flower-notice'] });
		expect(client.focus).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledTimes(1);
	});
});

describe('Hatask decoration unlock push notification', () => {
	const rewardData = {
		type: 'notification', userId: 'alice',
		body: {
			id: 'decoration-notice', type: 'hataskDecorationUnlocked',
			header: 'アイコンデコを獲得しました', body: '「お花の冠」を使えるようになりました。',
			icon: '/files/flower-crown.webp', link: '/settings/avatar-decoration',
		},
	};

	test('獲得通知の見出し・本文・画像をサーバーの内容で表示する', async () => {
		const showNotification = vi.fn().mockResolvedValue(undefined);
		const module = loadSwModule('scripts/create-notification.ts', {
			'@/scripts/twemoji-base.js': {}, '@/scripts/operations.js': {}, '@/scripts/get-account-from-id.js': {},
			'@/scripts/hata-custom-notification-copy.js': {}, '@/scripts/get-user-name.js': {},
			'@/scripts/lang.js': { swLang: { i18n: { ts: locales['ja-JP'] } } },
		}, { registration: { showNotification } });
		await module.createNotification(rewardData);
		expect(showNotification).toHaveBeenCalledExactlyOnceWith(rewardData.body.header, expect.objectContaining({
			body: rewardData.body.body, icon: rewardData.body.icon, data: rewardData,
		}));
	});

	test('獲得通知のクリックで対象アカウントのアイコンデコ設定を開き、その通知だけ既読にする', async () => {
		const listeners = new Map<string, (event: unknown) => void>();
		const client = { focus: vi.fn() };
		const operations = { openClient: vi.fn().mockResolvedValue(client), sendMarkAllAsRead: vi.fn(), api: vi.fn().mockResolvedValue(undefined) };
		loadSwModule('sw.ts', {
			'idb-keyval': {}, 'cherrypick-js': {}, '@/scripts/create-notification.js': {},
			'@/scripts/lang.js': {}, '@/scripts/operations.js': operations,
		}, { addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler) });
		let completion: Promise<void> | undefined;
		const closeNotification = vi.fn();
		const onClick = listeners.get('notificationclick');
		if (!onClick) throw new Error('Missing notificationclick listener');
		onClick({
			action: '', notification: { data: rewardData, 'close': closeNotification },
			waitUntil: (promise: Promise<void>) => { completion = promise; },
		});
		await completion;
		expect(operations.openClient).toHaveBeenCalledExactlyOnceWith('push', rewardData.body.link, 'alice');
		expect(operations.api).toHaveBeenCalledExactlyOnceWith('notifications/mark-as-read', 'alice', { notificationIds: ['decoration-notice'] });
		expect(operations.sendMarkAllAsRead).not.toHaveBeenCalled();
		expect(client.focus).toHaveBeenCalledTimes(1);
		expect(closeNotification).toHaveBeenCalledTimes(1);
	});
});
