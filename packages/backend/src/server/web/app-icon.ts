/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiMeta } from '@/models/Meta.js';

export const legacyAppIconRoutes = [
	['/static-assets/splash.png', 512],
	['/static-assets/apple-touch-icon.png', 512],
	['/static-assets/favicon.ico', 192],
	['/static-assets/favicon.png', 192],
	['/static-assets/icons/192.png', 192],
	['/static-assets/icons/512.png', 512],
] as const;

const generatedIconPaths = new Set<string>([
	'/favicon.ico',
	'/apple-touch-icon.png',
	...legacyAppIconRoutes.map(([path]) => path),
]);

/** PWA、favicon、起動画面で同じ設定を使う。片方のサイズだけでもPWA設定を優先する。 */
export function resolveAppIconUrl(meta: Pick<MiMeta, 'app192IconUrl' | 'app512IconUrl' | 'iconUrl'>, size: 192 | 512, serverUrl: string): string | null {
	const candidates = size === 192
		? [meta.app192IconUrl, meta.app512IconUrl, meta.iconUrl]
		: [meta.app512IconUrl, meta.app192IconUrl, meta.iconUrl];
	const origin = new URL(serverUrl).origin;
	for (const candidate of candidates) {
		if (!candidate?.trim()) continue;
		try {
			const url = new URL(candidate, serverUrl);
			// 同一サーバーの旧同梱画像・動的アイコンへの自己参照でredirect loopを起こさない。
			// Fastifyの静的ルート照合と同様に復号する。%2Fなどの予約文字は保持する。
			if (url.origin === origin && generatedIconPaths.has(decodeURI(url.pathname))) continue;
			// 相対URLをredirect元のfavicon/旧静的パス基準で解決させない。
			// 外部URLは管理者の指定を保ち、同一サーバーだけルート基準へ正規化する。
			if (url.origin === origin) return `${url.pathname}${url.search}${url.hash}`;
		} catch {
			// 設定値の保存・検証は既存の管理APIに任せ、ここでは書き換えない。
		}
		return candidate;
	}
	return null;
}
