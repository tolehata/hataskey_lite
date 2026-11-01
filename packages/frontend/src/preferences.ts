/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createVisibilityAwareInterval } from '@@/js/interval.js';
import type { StorageProvider } from '@/preferences/manager.js';
import { cloudBackup } from '@/preferences/utility.js';
import { miLocalStorage } from '@/local-storage.js';
import { isSameScope, PreferencesManager } from '@/preferences/manager.js';
import { store } from '@/store.js';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { TAB_ID } from '@/tab-id.js';

const syncGroup = 'default';

// ===== 旗鯖fork: 機密プリファレンスの簡易難読化 =====
// localStorage を直接覗いた時にトークン文字列がそのまま見えるのを防ぐ。
// (XSS等の積極的攻撃には対抗できない、あくまでカジュアル覗き見対策)
// `OBF1:` プレフィックスで難読化済みを識別、無いものは旧形式(平文)として後方互換で扱う。
const OBFUSCATE_KEY = 'hatasaba-external-token-key-v1';
const SENSITIVE_PREF_KEYS = new Set(['external.token']);

function xorBytes(input: Uint8Array, key: Uint8Array): Uint8Array {
	const out = new Uint8Array(input.length);
	for (let i = 0; i < input.length; i++) {
		out[i] = input[i] ^ key[i % key.length];
	}
	return out;
}

function obfuscate(plaintext: string): string {
	try {
		const keyBytes = new TextEncoder().encode(OBFUSCATE_KEY);
		const plainBytes = new TextEncoder().encode(plaintext);
		const xored = xorBytes(plainBytes, keyBytes);
		let bin = '';
		for (let i = 0; i < xored.length; i++) bin += String.fromCharCode(xored[i]);
		return 'OBF1:' + btoa(bin);
	} catch {
		return plaintext;
	}
}

function deobfuscate(stored: string): string {
	if (!stored.startsWith('OBF1:')) return stored;
	try {
		const b64 = stored.slice(5);
		const bin = atob(b64);
		const xored = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) xored[i] = bin.charCodeAt(i);
		const keyBytes = new TextEncoder().encode(OBFUSCATE_KEY);
		const plainBytes = xorBytes(xored, keyBytes);
		return new TextDecoder().decode(plainBytes);
	} catch {
		return stored;
	}
}

// profile.preferences[k] は配列。各要素は [scope, value, meta] のレコード。
// 機密キーは全レコードの value(レコード[1])部分を変換する。
function transformProfileForSave(profile: any): any {
	if (!profile?.preferences) return profile;
	const cloned = JSON.parse(JSON.stringify(profile));
	for (const k of Object.keys(cloned.preferences)) {
		if (!SENSITIVE_PREF_KEYS.has(k)) continue;
		const records = cloned.preferences[k];
		if (!Array.isArray(records)) continue;
		for (const record of records) {
			// record = [scope, value, meta]
			if (Array.isArray(record) && typeof record[1] === 'string' && record[1] !== '' && !record[1].startsWith('OBF1:')) {
				record[1] = obfuscate(record[1]);
			}
		}
	}
	return cloned;
}

function transformProfileForLoad(profile: any): any {
	if (!profile?.preferences) return profile;
	for (const k of Object.keys(profile.preferences)) {
		if (!SENSITIVE_PREF_KEYS.has(k)) continue;
		const records = profile.preferences[k];
		if (!Array.isArray(records)) continue;
		for (const record of records) {
			if (Array.isArray(record) && typeof record[1] === 'string' && record[1].startsWith('OBF1:')) {
				record[1] = deobfuscate(record[1]);
			}
		}
	}
	return profile;
}

const io: StorageProvider = {
	load: () => {
		const savedProfileRaw = miLocalStorage.getItem('preferences');
		if (savedProfileRaw == null) {
			return null;
		} else {
			const profile = JSON.parse(savedProfileRaw);
			return transformProfileForLoad(profile);
		}
	},

	save: (ctx) => {
		const transformed = transformProfileForSave(ctx.profile);
		miLocalStorage.setItem('preferences', JSON.stringify(transformed));
		miLocalStorage.setItem('latestPreferencesUpdate', `${TAB_ID}/${Date.now()}`);
	},

	cloudGet: async (ctx) => {
		// TODO: この取得方法だとアカウントが変わると保存場所も変わってしまうので改修する
		// 例えば複数アカウントある場合でも設定値を保存するための「プライマリアカウント」を設定できるようにするとか
		try {
			const cloudData = await misskeyApi('i/registry/get', {
				scope: ['client', 'preferences', 'sync'],
				key: syncGroup + ':' + ctx.key,
			}) as [any, any][];
			const target = cloudData.find(([scope]) => isSameScope(scope, ctx.scope));
			if (target == null) return null;
			return {
				value: target[1],
			};
		} catch (err: any) {
			if (err.code === 'NO_SUCH_KEY') { // TODO: いちいちエラーキャッチするのは面倒なのでキーが無くてもエラーにならない maybe-get のようなエンドポイントをバックエンドに実装する
				return null;
			} else {
				throw err;
			}
		}
	},

	cloudSet: async (ctx) => {
		let cloudData: [any, any][] = [];
		try {
			cloudData = await misskeyApi('i/registry/get', {
				scope: ['client', 'preferences', 'sync'],
				key: syncGroup + ':' + ctx.key,
			}) as [any, any][];
		} catch (err: any) {
			if (err.code === 'NO_SUCH_KEY') { // TODO: いちいちエラーキャッチするのは面倒なのでキーが無くてもエラーにならない maybe-get のようなエンドポイントをバックエンドに実装する
				cloudData = [];
			} else {
				throw err;
			}
		}

		const i = cloudData.findIndex(([scope]) => isSameScope(scope, ctx.scope));

		if (i === -1) {
			cloudData.push([ctx.scope, ctx.value]);
		} else {
			cloudData[i] = [ctx.scope, ctx.value];
		}

		await misskeyApi('i/registry/set', {
			scope: ['client', 'preferences', 'sync'],
			key: syncGroup + ':' + ctx.key,
			value: cloudData,
		});
	},

	cloudGetBulk: async (ctx) => {
		// TODO: 値の取得を1つのリクエストで済ませたい(バックエンド側でAPIの新設が必要)
		const fetchings = ctx.needs.map(need => io.cloudGet(need).then(res => [need.key, res] as const));
		const cloudDatas = await Promise.all(fetchings);

		const res = {} as Partial<Record<string, any>>;
		for (const cloudData of cloudDatas) {
			if (cloudData[1] != null) {
				res[cloudData[0]] = cloudData[1].value;
			}
		}

		return res;
	},
};

export const prefer = new PreferencesManager(io, $i);

let latestSyncedAt = Date.now();

function syncBetweenTabs() {
	const latest = miLocalStorage.getItem('latestPreferencesUpdate');
	if (latest == null) return;

	const latestTab = latest.split('/')[0];
	const latestAt = parseInt(latest.split('/')[1]);

	if (latestTab === TAB_ID) return;
	if (latestAt <= latestSyncedAt) return;

	prefer.reloadProfile();

	latestSyncedAt = Date.now();

	if (_DEV_) console.log('prefer:synced');
}

window.setInterval(syncBetweenTabs, 5000);

window.document.addEventListener('visibilitychange', () => {
	if (window.document.visibilityState === 'visible') {
		syncBetweenTabs();
	}
});

let latestBackupAt = 0;

// documentが非表示の間は実行されない (同期されていない古い値がバックアップされるのを防ぐ意味もある)
createVisibilityAwareInterval(() => {
	if ($i == null) return;
	if (!store.s.enablePreferencesAutoCloudBackup) return;
	if (prefer.profile.modifiedAt <= latestBackupAt) return;

	cloudBackup().then(() => {
		latestBackupAt = Date.now();
	});
}, 1000 * 60 * 3);

if (_DEV_) {
	(window as any).prefer = prefer;
	(window as any).cloudBackup = cloudBackup;
}
