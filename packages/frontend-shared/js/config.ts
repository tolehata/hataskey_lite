/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: このモジュールは Web Worker からも読み込まれる。
 *
 * ⚠️モジュール先頭で `window` を直接触ると、ワーカーでは
 *   `ReferenceError: window is not defined` になり、
 *   **そのワーカー全体が起動できなくなる**。
 *   （設定検索のワーカーが実際にこれで落ちていた。Firefox のコンソールで判明）
 * ⚠️主スレッドでの値は一切変えないこと。ワーカーでは以下の値は使われないので、
 *   落ちないための既定値を置くだけにする。
 */
const hasWindow = typeof window !== 'undefined';
const workerFallbackOrigin = typeof self !== 'undefined' && 'location' in self ? self.location.origin : 'http://localhost';

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
const address = new URL(hasWindow
	? (window.document.querySelector<HTMLMetaElement>('meta[property="instance_url"]')?.content || window.location.href)
	: workerFallbackOrigin);
const siteName = hasWindow ? window.document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content : undefined;

export const host = address.host;
export const hostname = address.hostname;
export const url = address.origin;
export const port = address.port;
export const apiUrl = (hasWindow ? window.location.origin : workerFallbackOrigin) + '/api';
export const wsOrigin = hasWindow ? window.location.origin : workerFallbackOrigin;
/**
 * 旗鯖fork: 起動時に実際に読み込まれた言語を割り出す。
 *
 * ⚠️boot.js は navigator.language から言語を決めてロケールのバンドルを読み込むが、
 *   その結果を localStorage へ書き戻さない。ここで localStorage だけを見ていると、
 *   言語を設定画面で明示保存していない利用者で
 *   「UIの文言は日本語なのに、Intl と <html lang> だけ en-US」という食い違いが起きる。
 *   (Hatask の日付・曜日、お花の名前、Hatask Eye の文言が英語になっていた原因)
 * ⚠️判定の順序と比較の仕方は packages/backend/src/server/web/boot.js と必ず同じにすること。
 *   片方だけ直すと、また表示と食い違う。
 */
export function resolveClientLang(stored: string | null, supported: readonly string[], navigatorLang: string): string {
	if (stored != null && supported.includes(stored)) return stored;
	if (supported.includes(navigatorLang)) return navigatorLang;
	// ⚠️boot.js と同じく、接頭辞を navigator.language の「全体」と比べる。
	//   ここを prefix 同士の比較に直すと boot.js が読んだ言語とずれる。
	return supported.find(x => x.split('-')[0] === navigatorLang) ?? 'en-US';
}

export const langs = _LANGS_;
export const lang = resolveClientLang(
	hasWindow ? window.localStorage.getItem('lang') : null,
	langs.map(([code]) => code),
	// ⚠️ワーカーにも navigator は在る。window だけが無い。
	typeof navigator !== 'undefined' ? navigator.language : 'en-US',
);
export const version = _VERSION_;
export const basedMisskeyVersion = _BASEDMISSKEYVERSION_;
export const gitHash = _GIT_HASH_;
export const instanceName = (siteName === 'CherryPick' || siteName == null) ? host : siteName;
export const ui = hasWindow ? window.localStorage.getItem('ui') : null;
export const debug = hasWindow && window.localStorage.getItem('debug') === 'true';
export const isSafeMode = hasWindow && window.localStorage.getItem('isSafeMode') === 'true';
export const prefersReducedMotion = hasWindow && window.matchMedia('(prefers-reduced-motion)').matches;
