/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 外部アカウント連携の接続先を、URLではなくサーバー名とアイコンで示すための表示情報。
// 公開の /api/meta だけを匿名で読む（トークンやCookieは送らない）。取れなければ既知の名前かホスト名に戻す。

import { isAllowedExternalHost } from '@/utility/external-api.js';
import { normalizeConcrntServerInfo } from '@/utility/concrnt/server-info.js';
import type { ConcrntServerInfo } from '@/utility/concrnt/server-info.js';

export type ExternalServerInfo = ConcrntServerInfo;

const cache = new Map<string, Promise<ExternalServerInfo>>();

/** Display data only: name and icon pass the same validation as Concrnt server chips. */
export function fetchExternalServerInfo(host: string, fallbackName?: string): Promise<ExternalServerInfo> {
	const fallback = normalizeConcrntServerInfo(host, { nickname: fallbackName });
	if (!isAllowedExternalHost(host)) return Promise.resolve(fallback);
	const cached = cache.get(host);
	if (cached) return cached;
	const promise = (async () => {
		try {
			const response = await window.fetch(`https://${host}/api/meta`, {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detail: false }),
				credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(8000),
			});
			if (!response.ok) return fallback;
			const meta: unknown = await response.json();
			const value = meta !== null && typeof meta === 'object' ? meta as Record<string, unknown> : {};
			const info = normalizeConcrntServerInfo(host, { nickname: value.name ?? fallbackName, logo: value.iconUrl });
			return info.name === host && fallbackName ? { ...info, name: fallback.name } : info;
		} catch {
			return fallback;
		}
	})();
	cache.set(host, promise);
	// A failed lookup is retried next time; a successful one is kept for this page session.
	void promise.then(info => { if (!info.iconUrl && info.name === fallback.name) cache.delete(host); });
	return promise;
}
