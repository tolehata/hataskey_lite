/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { prefer } from '@/preferences.js';
import { clearExternalEmojiMemoryCache } from '@/utility/external-api.js';
import { RETIRED_EXTERNAL_ACCOUNT_DEFAULTS, isRetiredExternalHost, purgeRetiredExternalAccountLocalData, purgeRetiredExternalAccountsFromProfile } from '@/utility/external-account-policy.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';

const CLOUD_MIGRATION_MARKER_PREFIX = 'hata_external_retired_hosts_v1_migrated:';
const SYNC_SCOPE = ['client', 'preferences', 'sync'];
const BACKUP_SCOPE = ['client', 'preferences', 'backups'];

async function purgeRetiredExternalAccountSyncData(): Promise<boolean> {
	const syncValues = await misskeyApi('i/registry/get-all', { scope: SYNC_SCOPE });
	const originalPreferences: Record<string, unknown> = {};
	for (const key of Object.keys(RETIRED_EXTERNAL_ACCOUNT_DEFAULTS)) {
		const records = syncValues[`default:${key}`];
		if (Array.isArray(records)) originalPreferences[key] = records;
	}

	const purged = purgeRetiredExternalAccountsFromProfile({ preferences: originalPreferences });
	if (!purged.changed) return false;

	const writes: Promise<unknown>[] = [];
	for (const key of Object.keys(RETIRED_EXTERNAL_ACCOUNT_DEFAULTS)) {
		const before = originalPreferences[key];
		const after = purged.profile.preferences[key];
		if (!Array.isArray(before) || !Array.isArray(after) || JSON.stringify(before) === JSON.stringify(after)) continue;
		writes.push(misskeyApi('i/registry/set', {
			scope: SYNC_SCOPE,
			key: `default:${key}`,
			value: after,
		}));
	}
	await Promise.all(writes);

	return true;
}

async function purgeRetiredExternalAccountBackups(): Promise<boolean> {
	const backups = await misskeyApi('i/registry/get-all', { scope: BACKUP_SCOPE });
	const writes: Promise<unknown>[] = [];
	for (const [key, stored] of Object.entries(backups)) {
		const purged = purgeRetiredExternalAccountsFromProfile(stored);
		if (!purged.changed) continue;
		writes.push(misskeyApi('i/registry/set', {
			scope: BACKUP_SCOPE,
			key,
			value: purged.profile,
		}));
	}
	await Promise.all(writes);
	return writes.length > 0;
}

async function purgeRetiredExternalAccountCloudData(): Promise<boolean> {
	if ($i == null) return false;
	const marker = `${CLOUD_MIGRATION_MARKER_PREFIX}${$i.id}`;
	if (window.localStorage.getItem(marker) === '1') return false;
	const syncChanged = await purgeRetiredExternalAccountSyncData();
	const backupChanged = await purgeRetiredExternalAccountBackups();
	window.localStorage.setItem(marker, '1');
	return syncChanged || backupChanged;
}

/**
 * 廃止した外部サーバーを利用中だった端末から、認証情報と付随データを取り除く。
 * `prefer.cloudReady` 後に実行し、設定同期で古いトークンが直後に戻るのを防ぐ。
 */
export async function migrateRetiredExternalAccount(): Promise<boolean> {
	try {
		await prefer.cloudReady;
	} catch {
		// クラウド設定が取得できなくても、この端末に残る認証情報の削除を優先する。
	}

	const retiredAccountWasLinked = isRetiredExternalHost(prefer.s['external.host']);
	const localPurge = purgeRetiredExternalAccountLocalData(window.localStorage, retiredAccountWasLinked);
	const profilePurge = purgeRetiredExternalAccountsFromProfile(prefer.profile);
	if (profilePurge.changed) prefer.profile = profilePurge.profile;

	if (retiredAccountWasLinked) {
		// commit() はキーごとの同期通信を起こすため使わない。クラウド上の別ホスト用レコードを
		// 上書きせず、清掃済みprofileに対応する現在のリアクティブ値だけを初期化する。
		prefer.s['external.enabled'] = prefer.r['external.enabled'].value = false;
		prefer.s['external.host'] = prefer.r['external.host'].value = '';
		prefer.s['external.token'] = prefer.r['external.token'].value = null;
		prefer.s['external.userId'] = prefer.r['external.userId'].value = null;
		prefer.s['external.username'] = prefer.r['external.username'].value = null;
		prefer.s['external.avatarUrl'] = prefer.r['external.avatarUrl'].value = null;

		// 永続データは上でホスト単位に除去済み。ここでは旧接続のメモリキャッシュだけを破棄する。
		clearExternalEmojiMemoryCache();
	}

	if (retiredAccountWasLinked || profilePurge.changed) prefer.save();

	// 端末内の清掃を保存した後、同期済みレコードとバックアップもホスト対応が
	// 確認できるものだけ清掃する。通常のcommit()は使わないため、別ホストの値を
	// キー単位の同期で上書きしない。
	let cloudChanged = false;
	try {
		cloudChanged = await purgeRetiredExternalAccountCloudData();
	} catch (error) {
		// 移行済み印は付かないため、クラウド清掃だけ次回起動で再試行される。
		console.error('[external-account-migration] Failed to purge cloud data:', error);
	}

	return retiredAccountWasLinked || localPurge.changed || profilePurge.changed || cloudChanged;
}
