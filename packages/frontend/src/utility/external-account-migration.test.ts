/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	state: {
		'external.enabled': true,
		'external.host': 'o.hata.blog',
		'external.token': 'old-token' as string | null,
		'external.userId': 'old-user' as string | null,
		'external.username': 'old-name' as string | null,
		'external.avatarUrl': 'https://o.hata.blog/avatar.webp' as string | null,
		'external.enableOHTL': true,
		'external.enableOLTL': false,
		'external.disableNotificationToast': true,
	},
	commit: vi.fn(),
	save: vi.fn(),
	clearMemory: vi.fn(),
	api: vi.fn(),
	events: [] as string[],
	cloudReady: Promise.resolve() as Promise<void>,
	reactive: {
		'external.enabled': { value: true },
		'external.host': { value: 'o.hata.blog' as string },
		'external.token': { value: 'old-token' as string | null },
		'external.userId': { value: 'old-user' as string | null },
		'external.username': { value: 'old-name' as string | null },
		'external.avatarUrl': { value: 'https://o.hata.blog/avatar.webp' as string | null },
	},
	profile: {
		id: 'profile',
		preferences: {},
	} as Record<string, unknown>,
}));

vi.mock('@/preferences.js', () => ({
	prefer: {
		get cloudReady() { return mocks.cloudReady; },
		s: mocks.state,
		r: mocks.reactive,
		commit: mocks.commit,
		get profile() { return mocks.profile; },
		set profile(value) { mocks.profile = value; },
		save: mocks.save,
	},
}));

vi.mock('@/utility/external-api.js', () => ({
	clearExternalEmojiMemoryCache: mocks.clearMemory,
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => mocks.api(...args) }));
vi.mock('@/i.js', () => ({ $i: { id: 'local-user' } }));

import { migrateRetiredExternalAccount } from './external-account-migration.js';

function noSuchKeyError(): Error & { code: string } {
	return Object.assign(new Error('No such key'), { code: 'NO_SUCH_KEY' });
}

describe('撤去した外部アカウントの移行', () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.commit.mockReset();
		mocks.clearMemory.mockReset();
		mocks.save.mockReset();
		mocks.api.mockReset();
		mocks.events.length = 0;
		mocks.cloudReady = Promise.resolve();
		mocks.api.mockImplementation(async (endpoint: string) => {
			mocks.events.push(endpoint);
			if (endpoint === 'i/registry/get-all') return {};
			return null;
		});
		mocks.state['external.enabled'] = true;
		mocks.state['external.host'] = 'o.hata.blog';
		mocks.state['external.token'] = 'old-token';
		mocks.state['external.userId'] = 'old-user';
		mocks.state['external.username'] = 'old-name';
		mocks.state['external.avatarUrl'] = 'https://o.hata.blog/avatar.webp';
		mocks.state['external.enableOHTL'] = true;
		mocks.state['external.enableOLTL'] = false;
		mocks.state['external.disableNotificationToast'] = true;
		mocks.reactive['external.enabled'].value = true;
		mocks.reactive['external.host'].value = 'o.hata.blog';
		mocks.reactive['external.token'].value = 'old-token';
		mocks.reactive['external.userId'].value = 'old-user';
		mocks.reactive['external.username'].value = 'old-name';
		mocks.reactive['external.avatarUrl'].value = 'https://o.hata.blog/avatar.webp';
		mocks.profile = {
			id: 'profile',
			preferences: {
				'external.enabled': [[{}, true, {}]],
				'external.host': [[{}, mocks.state['external.host'], {}]],
				'external.token': [[{}, mocks.state['external.token'], {}]],
				'external.userId': [[{}, mocks.state['external.userId'], {}]],
				'external.username': [[{}, mocks.state['external.username'], {}]],
				'external.avatarUrl': [[{}, mocks.state['external.avatarUrl'], {}]],
			},
		};
	});

	test('撤去先の認証情報だけを消し、表示と通知の利用者設定を保持する', async () => {
		localStorage.setItem('externalEmojiCache', JSON.stringify({ host: 'o.hata.blog', emojis: [] }));
		const changed = await migrateRetiredExternalAccount();

		expect(changed).toBe(true);
		expect(mocks.commit).not.toHaveBeenCalled();
		expect(mocks.state['external.enabled']).toBe(false);
		expect(mocks.state['external.host']).toBe('');
		expect(mocks.state['external.token']).toBeNull();
		expect(mocks.reactive['external.host'].value).toBe('');
		expect(mocks.reactive['external.token'].value).toBeNull();
		expect(mocks.state['external.enableOHTL']).toBe(true);
		expect(mocks.state['external.enableOLTL']).toBe(false);
		expect(mocks.state['external.disableNotificationToast']).toBe(true);
		expect(mocks.save).toHaveBeenCalledOnce();
		expect(mocks.clearMemory).toHaveBeenCalledOnce();
		expect(localStorage.getItem('externalEmojiCache')).toBeNull();
		expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.api.mock.invocationCallOrder[0]);
	});

	test('利用できる別ホストの認証情報とキャッシュは変更しない', async () => {
		mocks.state['external.host'] = 'mi.les-requin.net';
		mocks.state['external.token'] = 'allowed-token';
		mocks.profile = {
			id: 'profile',
			preferences: {
				'external.host': [[{}, 'mi.les-requin.net', {}]],
				'external.token': [[{}, 'allowed-token', {}]],
			},
		};
		localStorage.setItem('externalEmojiCache', JSON.stringify({ host: 'mi.les-requin.net', emojis: [] }));

		const changed = await migrateRetiredExternalAccount();

		expect(changed).toBe(false);
		expect(mocks.commit).not.toHaveBeenCalled();
		expect(mocks.clearMemory).not.toHaveBeenCalled();
		expect(localStorage.getItem('externalEmojiCache')).toContain('mi.les-requin.net');
	});

	test('クラウド同期とバックアップの全scopeから撤去先の認証情報だけを消す', async () => {
		mocks.state['external.host'] = 'mi.les-requin.net';
		mocks.state['external.token'] = 'allowed-token';
		mocks.profile = {
			id: 'profile',
			preferences: {
				'external.host': [[{}, 'mi.les-requin.net', {}]],
				'external.token': [[{}, 'allowed-token', {}]],
			},
		};

		const retiredScope = { server: 'example.test', account: 'retired-user' };
		const allowedScope = { server: 'example.test', account: 'allowed-user' };
		type CloudRecord = [scope: Record<string, string>, value: unknown];
		const cloudRecords: Record<string, CloudRecord[]> = {
			'external.enabled': [[retiredScope, true], [allowedScope, true]],
			'external.host': [[retiredScope, 'mk.shrimpia.network'], [allowedScope, 'mi.les-requin.net']],
			'external.token': [[retiredScope, 'retired-token'], [allowedScope, 'allowed-token']],
			'external.userId': [[retiredScope, 'retired-id'], [allowedScope, 'allowed-id']],
			'external.username': [[retiredScope, 'retired-name'], [allowedScope, 'allowed-name']],
			'external.avatarUrl': [[retiredScope, 'https://mk.shrimpia.network/avatar.webp'], [allowedScope, 'https://mi.les-requin.net/avatar.webp']],
		};
		const backup = {
			id: 'legacy-backup',
			preferences: Object.fromEntries(Object.entries(cloudRecords).map(([key, records]) => [
				key,
				records.map(([scope, value]) => [scope, value, {}]),
			])),
		};
		mocks.api.mockImplementation(async (endpoint: string, params: { scope: string[]; key?: string; value?: unknown }) => {
			mocks.events.push(endpoint);
			if (endpoint === 'i/registry/get-all' && params.scope.at(-1) === 'sync') {
				return Object.fromEntries(Object.entries(cloudRecords).map(([key, value]) => [`default:${key}`, value]));
			}
			if (endpoint === 'i/registry/get-all' && params.scope.at(-1) === 'backups') return { 'legacy-backup': backup };
			if (endpoint === 'i/registry/set') return null;
			throw noSuchKeyError();
		});

		const changed = await migrateRetiredExternalAccount();

		expect(changed).toBe(true);
		expect(mocks.commit).not.toHaveBeenCalled();
		const writes = mocks.api.mock.calls
			.filter(([endpoint]) => endpoint === 'i/registry/set')
			.map(([, params]) => params as { scope: string[]; key: string; value: unknown });
		const hostWrite = writes.find(write => write.key === 'default:external.host');
		expect(hostWrite?.value as CloudRecord[]).toEqual([[retiredScope, ''], [allowedScope, 'mi.les-requin.net']]);
		const tokenWrite = writes.find(write => write.key === 'default:external.token');
		expect(tokenWrite?.value as CloudRecord[]).toEqual([[retiredScope, null], [allowedScope, 'allowed-token']]);
		const backupWrite = writes.find(write => write.key === 'legacy-backup');
		const backupValue = backupWrite?.value as { preferences: Record<string, unknown[]> };
		expect(backupValue.preferences['external.token']).toEqual([
			[retiredScope, null, {}],
			[allowedScope, 'allowed-token', {}],
		]);
		expect(localStorage.getItem('hata_external_retired_hosts_v1_migrated:local-user')).toBe('1');
	});

	test('キー別同期が混在してもクラウド上の許可ホスト用トークンを上書きしない', async () => {
		mocks.cloudReady = Promise.reject(new Error('initial sync failed'));
		mocks.profile = {
			id: 'profile',
			preferences: {
				'external.enabled': [[{}, true, {}]],
				'external.host': [[{}, 'o.hata.blog', {}]],
				'external.token': [[{}, 'retired-local-token', { sync: true }]],
				'external.userId': [[{}, 'retired-id', {}]],
				'external.username': [[{}, 'retired-name', {}]],
				'external.avatarUrl': [[{}, 'https://o.hata.blog/avatar.webp', {}]],
			},
		};
		mocks.api.mockImplementation(async (endpoint: string, params: { scope: string[] }) => {
			mocks.events.push(endpoint);
			if (endpoint === 'i/registry/get-all' && params.scope.at(-1) === 'sync') {
				return { 'default:external.token': [[{}, 'allowed-remote-token']] };
			}
			if (endpoint === 'i/registry/get-all' && params.scope.at(-1) === 'backups') return {};
			if (endpoint === 'i/registry/set') return null;
			throw noSuchKeyError();
		});

		const changed = await migrateRetiredExternalAccount();

		expect(changed).toBe(true);
		expect(mocks.api.mock.calls.some(([endpoint]) => endpoint === 'i/registry/set')).toBe(false);
		expect(mocks.state['external.host']).toBe('');
		expect(mocks.state['external.token']).toBeNull();
		const preferences = (mocks.profile as { preferences: Record<string, unknown[][]> }).preferences;
		expect(preferences['external.token'][0]).toEqual([{}, null, { sync: true }]);
		expect(localStorage.getItem('hata_external_retired_hosts_v1_migrated:local-user')).toBe('1');
	});

	test('クラウド清掃に失敗しても端末内の認証情報を消し、次回再試行できる', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		mocks.api.mockRejectedValue(new Error('offline'));

		const changed = await migrateRetiredExternalAccount();

		expect(changed).toBe(true);
		expect(mocks.commit).not.toHaveBeenCalled();
		expect(mocks.state['external.host']).toBe('');
		expect(mocks.state['external.token']).toBeNull();
		expect(localStorage.getItem('hata_external_retired_hosts_v1_migrated:local-user')).toBeNull();
		expect(errorSpy).toHaveBeenCalledOnce();
		errorSpy.mockRestore();
	});
});
