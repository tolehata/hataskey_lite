/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { isRetiredExternalHost, purgeRetiredExternalAccountLocalData, purgeRetiredExternalAccountsFromProfile } from './external-account-policy.js';

function createStorage(initial: Record<string, string>) {
	const values = new Map(Object.entries(initial));
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => { values.set(key, value); },
		removeItem: (key: string) => { values.delete(key); },
	};
	return { storage, values };
}

describe('外部アカウント連携の撤去先', () => {
	test('旗池3丁目とシュリンピアの表記揺れだけを撤去先として扱う', () => {
		expect(isRetiredExternalHost('o.hata.blog')).toBe(true);
		expect(isRetiredExternalHost('O.HATA.BLOG:443')).toBe(true);
		expect(isRetiredExternalHost('mk.shrimpia.network.')).toBe(true);
		expect(isRetiredExternalHost('mi.les-requin.net')).toBe(false);
		expect(isRetiredExternalHost('ddoskey.com')).toBe(false);
		expect(isRetiredExternalHost('o.hata.blog.example.com')).toBe(false);
		expect(isRetiredExternalHost('misskey.hatachanoima.net')).toBe(false);
	});

	test('混在データから撤去先だけを除き、現在利用できる接続先の情報を保持する', () => {
		const { storage, values } = createStorage({
			externalEmojiCache: JSON.stringify({ host: 'o.hata.blog', emojis: [] }),
			externalEmojiUrlMapCache: JSON.stringify({ host: 'mi.les-requin.net', map: { legacy: 'https://o.hata.blog/old.webp' } }),
			externalEmojiUrlMap: JSON.stringify({
				'o.hata.blog': { fetchedAt: 1, emojis: {} },
				'mi.les-requin.net': { fetchedAt: 2, emojis: { legacy: 'https://o.hata.blog/old.webp' } },
			}),
			externalFavoriteEmojis: JSON.stringify([
				{ reaction: ':old:', host: 'mk.shrimpia.network', url: 'https://mk.shrimpia.network/old.webp' },
				{ reaction: ':keep:', host: 'mi.les-requin.net', url: 'https://mi.les-requin.net/keep.webp' },
				'👍',
			]),
			externalRecentReactions: JSON.stringify([
				{ reaction: ':old@o.hata.blog:', host: null, url: null },
				{ reaction: ':keep:', host: 'mi.les-requin.net', url: null },
			]),
			extNotifLastReadAt: '2026-08-07T00:00:00.000Z',
			miauth_host: 'mi.les-requin.net',
			miauth_session: 'allowed-session',
		});

		const result = purgeRetiredExternalAccountLocalData(storage);

		expect(result.changed).toBe(true);
		expect(values.has('externalEmojiCache')).toBe(false);
		expect(JSON.parse(String(values.get('externalEmojiUrlMap')))).toEqual({
			'mi.les-requin.net': { fetchedAt: 2, emojis: { legacy: 'https://o.hata.blog/old.webp' } },
		});
		expect(JSON.parse(String(values.get('externalFavoriteEmojis')))).toEqual([
			{ reaction: ':keep:', host: 'mi.les-requin.net', url: 'https://mi.les-requin.net/keep.webp' },
			'👍',
		]);
		expect(JSON.parse(String(values.get('externalRecentReactions')))).toEqual([
			{ reaction: ':keep:', host: 'mi.les-requin.net', url: null },
		]);
		expect(values.get('externalEmojiUrlMapCache')).toContain('mi.les-requin.net');
		expect(values.get('extNotifLastReadAt')).toBe('2026-08-07T00:00:00.000Z');
		expect(values.get('miauth_host')).toBe('mi.les-requin.net');
		expect(values.get('miauth_session')).toBe('allowed-session');
	});

	test('撤去先のMiAuthだけを消し、壊れた無関係データでは過剰削除しない', () => {
		const { storage, values } = createStorage({
			miauth_host: 'MK.SHRIMPIA.NETWORK:443',
			miauth_session: 'retired-session',
			externalEmojiCache: '{broken-json',
			externalFavoriteEmojis: 'not-json',
		});

		const first = purgeRetiredExternalAccountLocalData(storage);
		expect(first.removedKeys).toEqual(expect.arrayContaining(['miauth_host', 'miauth_session']));
		expect(values.get('externalEmojiCache')).toBe('{broken-json');
		expect(values.get('externalFavoriteEmojis')).toBe('not-json');

		const second = purgeRetiredExternalAccountLocalData(storage);
		expect(second.changed).toBe(false);
	});

	test('撤去アカウントの既読時刻だけを消す', () => {
		const { storage, values } = createStorage({ extNotifLastReadAt: '2026-08-07T00:00:00.000Z' });
		expect(purgeRetiredExternalAccountLocalData(storage).changed).toBe(false);
		expect(values.has('extNotifLastReadAt')).toBe(true);
		expect(purgeRetiredExternalAccountLocalData(storage, true).changed).toBe(true);
		expect(values.has('extNotifLastReadAt')).toBe(false);
	});

	test('設定profile内の全scopeで撤去先の認証情報だけを初期化する', () => {
		const retiredScope = { server: 'example.test', account: 'retired-user' };
		const allowedScope = { server: 'example.test', account: 'allowed-user' };
		const profile = {
			name: 'backup',
			preferences: {
				'external.enabled': [[retiredScope, true, {}], [allowedScope, true, {}]],
				'external.host': [[retiredScope, 'o.hata.blog:443', {}], [allowedScope, 'mi.les-requin.net', {}]],
				'external.token': [[retiredScope, 'retired-token', {}], [allowedScope, 'allowed-token', {}]],
				'external.userId': [[retiredScope, 'retired-id', {}], [allowedScope, 'allowed-id', {}]],
				'external.username': [[retiredScope, 'retired-name', {}], [allowedScope, 'allowed-name', {}]],
				'external.avatarUrl': [[retiredScope, 'https://o.hata.blog/avatar.webp', {}], [allowedScope, 'https://mi.les-requin.net/avatar.webp', {}]],
				'external.enableOHTL': [[retiredScope, true, {}], [allowedScope, false, {}]],
			},
		};

		const result = purgeRetiredExternalAccountsFromProfile(profile);
		expect(result.changed).toBe(true);
		expect(result.profile.preferences['external.host']).toEqual([[retiredScope, '', {}], [allowedScope, 'mi.les-requin.net', {}]]);
		expect(result.profile.preferences['external.token']).toEqual([[retiredScope, null, {}], [allowedScope, 'allowed-token', {}]]);
		expect(result.profile.preferences['external.enableOHTL']).toEqual(profile.preferences['external.enableOHTL']);
		expect(profile.preferences['external.token'][0][1]).toBe('retired-token');
	});

	test('同一scopeに許可ホストが重複する壊れたprofileでは許可側の認証情報を消さない', () => {
		const duplicatedScope = { server: 'example.test', account: 'duplicated-user' };
		const profile = {
			preferences: {
				'external.enabled': [[duplicatedScope, true, {}]],
				'external.host': [[duplicatedScope, 'o.hata.blog', {}], [duplicatedScope, 'mi.les-requin.net', {}]],
				'external.token': [[duplicatedScope, 'ambiguous-token', {}]],
			},
		};

		const result = purgeRetiredExternalAccountsFromProfile(profile);

		expect(result.changed).toBe(true);
		expect(result.profile.preferences['external.host']).toEqual([
			[duplicatedScope, '', {}],
			[duplicatedScope, 'mi.les-requin.net', {}],
		]);
		expect(result.profile.preferences['external.enabled'][0][1]).toBe(true);
		expect(result.profile.preferences['external.token'][0][1]).toBe('ambiguous-token');
	});
});
