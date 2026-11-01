/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** hata-12.0 以降、外部アカウント連携から撤去した接続先。 */
export const RETIRED_EXTERNAL_HOSTS = [
	'o.hata.blog',
	'mk.shrimpia.network',
] as const;

const HOST_SCOPED_CACHE_KEYS = [
	'externalEmojiCache',
	'externalEmojiUrlMapCache',
] as const;

const HOST_SCOPED_LIST_KEYS = [
	'externalFavoriteEmojis',
	'externalRecentReactions',
] as const;

type ExternalAccountStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type RetiredExternalAccountPurgeResult = {
	changed: boolean;
	removedKeys: string[];
	rewrittenKeys: string[];
};

function normalizeExternalHostname(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const candidate = value.trim().toLowerCase();
	if (candidate === '') return null;

	try {
		const parsed = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
		return parsed.hostname.toLowerCase().replace(/\.+$/, '');
	} catch {
		// 壊れた旧データでも、ポートや末尾ドットだけの差なら撤去対象として扱う。
		return candidate.split(':', 1)[0]?.replace(/\.+$/, '') || null;
	}
}

export function isRetiredExternalHost(host: unknown): boolean {
	const normalized = normalizeExternalHostname(host);
	return normalized != null && RETIRED_EXTERNAL_HOSTS.some(retiredHost => retiredHost === normalized);
}

function referencesRetiredExternalHost(value: unknown): boolean {
	if (typeof value === 'string') {
		if (isRetiredExternalHost(value)) return true;
		const reactionHost = value.match(/@([^:]+):$/)?.[1];
		if (reactionHost && isRetiredExternalHost(reactionHost)) return true;
		if (/^https?:\/\//i.test(value)) {
			try {
				return isRetiredExternalHost(new URL(value).hostname);
			} catch {
				return false;
			}
		}
		return false;
	}
	if (Array.isArray(value)) return value.some(referencesRetiredExternalHost);
	if (value == null || typeof value !== 'object') return false;
	return Object.entries(value).some(([key, item]) => isRetiredExternalHost(key) || referencesRetiredExternalHost(item));
}

function safeGet(storage: ExternalAccountStorage, key: string): string | null {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

function safeRemove(storage: ExternalAccountStorage, key: string, removedKeys: string[]): void {
	try {
		storage.removeItem(key);
		removedKeys.push(key);
	} catch {
		// localStorage が利用できない環境でも起動を止めない。
	}
}

function safeRewrite(storage: ExternalAccountStorage, key: string, value: unknown, rewrittenKeys: string[]): void {
	try {
		storage.setItem(key, JSON.stringify(value));
		rewrittenKeys.push(key);
	} catch {
		// 容量超過などの場合は、他の削除処理を続行する。
	}
}

/**
 * 廃止ホストに結び付く端末内データだけを削除する。
 * 現在利用中の別ホストのキャッシュ・お気に入り・MiAuth情報は保持する。
 */
export function purgeRetiredExternalAccountLocalData(storage: ExternalAccountStorage, retiredAccountWasLinked = false): RetiredExternalAccountPurgeResult {
	const removedKeys: string[] = [];
	const rewrittenKeys: string[] = [];

	for (const key of HOST_SCOPED_CACHE_KEYS) {
		const stored = safeGet(storage, key);
		if (stored == null) continue;
		try {
			const parsed = JSON.parse(stored);
			if (parsed && typeof parsed === 'object' && isRetiredExternalHost(parsed.host)) safeRemove(storage, key, removedKeys);
		} catch {
			// 由来を確認できない壊れた値は、他ホストのデータを守るため残す。
		}
	}

	const hostMapKey = 'externalEmojiUrlMap';
	const hostMapStored = safeGet(storage, hostMapKey);
	if (hostMapStored != null) {
		try {
			const parsed = JSON.parse(hostMapStored);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				const kept = Object.fromEntries(Object.entries(parsed).filter(([host]) => !isRetiredExternalHost(host)));
				if (Object.keys(kept).length !== Object.keys(parsed).length) {
					if (Object.keys(kept).length === 0) safeRemove(storage, hostMapKey, removedKeys);
					else safeRewrite(storage, hostMapKey, kept, rewrittenKeys);
				}
			}
		} catch {
			// 壊れた値は対象ホストのものと断定できないため残す。
		}
	}

	for (const key of HOST_SCOPED_LIST_KEYS) {
		const stored = safeGet(storage, key);
		if (stored == null) continue;
		try {
			const parsed = JSON.parse(stored);
			if (!Array.isArray(parsed)) continue;
			const kept = parsed.filter(item => !referencesRetiredExternalHost(item));
			if (kept.length === parsed.length) continue;
			if (kept.length === 0) safeRemove(storage, key, removedKeys);
			else safeRewrite(storage, key, kept, rewrittenKeys);
		} catch {
			// 旧形式を判定できない場合は、利用者が選んだ絵文字を消さない。
		}
	}

	const pendingHost = safeGet(storage, 'miauth_host');
	if (isRetiredExternalHost(pendingHost)) {
		safeRemove(storage, 'miauth_host', removedKeys);
		safeRemove(storage, 'miauth_session', removedKeys);
	}

	if (retiredAccountWasLinked && safeGet(storage, 'extNotifLastReadAt') != null) {
		safeRemove(storage, 'extNotifLastReadAt', removedKeys);
	}

	return {
		changed: removedKeys.length > 0 || rewrittenKeys.length > 0,
		removedKeys,
		rewrittenKeys,
	};
}

type PreferenceScope = Record<string, unknown>;

export const RETIRED_EXTERNAL_ACCOUNT_DEFAULTS = {
	'external.enabled': false,
	'external.host': '',
	'external.token': null,
	'external.userId': null,
	'external.username': null,
	'external.avatarUrl': null,
} as const;

function isSamePreferenceScope(a: PreferenceScope, b: PreferenceScope): boolean {
	return (a.server ?? null) === (b.server ?? null)
		&& (a.account ?? null) === (b.account ?? null)
		&& (a.device ?? null) === (b.device ?? null);
}

/** バックアップを含む設定profileから、全scopeの廃止ホスト認証情報を除去する。 */
export function purgeRetiredExternalAccountsFromProfile<T>(source: T): { profile: T; changed: boolean } {
	if (source == null || typeof source !== 'object') return { profile: source, changed: false };

	let profile: T;
	try {
		profile = JSON.parse(JSON.stringify(source)) as T;
	} catch {
		return { profile: source, changed: false };
	}

	const preferences = (profile as { preferences?: Record<string, unknown> }).preferences;
	if (preferences == null || typeof preferences !== 'object') return { profile, changed: false };
	const hostRecords = preferences['external.host'];
	if (!Array.isArray(hostRecords)) return { profile, changed: false };

	const parsedHostRecords: { scope: PreferenceScope; value: unknown }[] = [];
	const retiredScopes: PreferenceScope[] = [];
	for (const record of hostRecords) {
		if (!Array.isArray(record) || record.length < 2 || record[0] == null || typeof record[0] !== 'object') continue;
		const scope = record[0] as PreferenceScope;
		parsedHostRecords.push({ scope, value: record[1] });
		if (isRetiredExternalHost(record[1])) retiredScopes.push(scope);
	}
	if (retiredScopes.length === 0) return { profile, changed: false };
	const ambiguousScopes = retiredScopes.filter(scope => parsedHostRecords.some(record => (
		isSamePreferenceScope(scope, record.scope)
		&& typeof record.value === 'string'
		&& record.value.trim() !== ''
		&& !isRetiredExternalHost(record.value)
	)));

	let changed = false;
	for (const [key, defaultValue] of Object.entries(RETIRED_EXTERNAL_ACCOUNT_DEFAULTS)) {
		const records = preferences[key];
		if (!Array.isArray(records)) continue;
		for (const record of records) {
			if (!Array.isArray(record) || record.length < 2 || record[0] == null || typeof record[0] !== 'object') continue;
			const scope = record[0] as PreferenceScope;
			if (key === 'external.host') {
				if (!isRetiredExternalHost(record[1])) continue;
			} else {
				if (!retiredScopes.some(retiredScope => isSamePreferenceScope(retiredScope, scope))) continue;
				// 壊れたimport等で同一scopeに許可ホストもある場合、対応を断定できない認証値は保持する。
				if (ambiguousScopes.some(ambiguousScope => isSamePreferenceScope(ambiguousScope, scope))) continue;
			}
			if (record[1] === defaultValue) continue;
			record[1] = defaultValue;
			changed = true;
		}
	}

	return { profile, changed };
}
