/* SPDX-License-Identifier: AGPL-3.0-only */
import { HATAGOES_CATALOG } from './hatagoes-catalog.js';
import type { HatagoesApp, HatagoesCatalogEntry } from './hatagoes-catalog.js';

export type HatagoesCommonView = 'home' | 'screens' | 'search' | 'notifications' | 'settings';
export type HatagoesLocation = { view: HatagoesCommonView } | { view: 'app'; path: string; app: HatagoesApp };
const commonViews = new Set(['home', 'screens', 'search', 'notifications', 'settings']);
const originPaths = new WeakMap<object, string>();

export function isHatagoesPath(path: string): boolean {
	return path.split(/[?#]/u, 1)[0] === '/hatagoes';
}

export function rememberHatagoesOrigin(router: object, before: string, after: string): void {
	if (!isHatagoesPath(before) && isHatagoesPath(after) && before.startsWith('/') && !before.startsWith('//')) originPaths.set(router, before);
}

export function getHatagoesOrigin(router: object): string {
	return originPaths.get(router) ?? '/';
}

/** Only local, known app routes may be embedded. External URLs never reach a child router. */
export function hatagoesAppForPath(path: string): HatagoesApp | null {
	if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/u.test(path)) return null;
	const base = path.split(/[?#]/u, 1)[0];
	// URL dot-segment normalization must not turn an allowed prefix into a
	// different destination, including percent-encoded dot segments.
	if (new URL(path, 'https://hatagoes.invalid').pathname !== base) return null;
	if (/^\/hatady(?:\/|$)/u.test(base)) return 'hatady';
	if (/^\/hatafeed(?:\/|$)/u.test(base) || base === '/settings/hatafeed') return 'hatafeed';
	if (/^\/hatask(?:\/|$)/u.test(base)) return 'hatask';
	const match = HATAGOES_CATALOG.find(screen => screen.path.split('?')[0] === base);
	if (match) return match.app;
	// Games and tools have their own detail URLs; keep their original semantics.
	if (/^\/(?:reversi|bubble-game|flash|scratchpad|pages|play|gallery)(?:\/|$)/u.test(base)) return 'hatask';
	return null;
}

export function readHatagoesLocation(fullPath: string): HatagoesLocation {
	if (!isHatagoesPath(fullPath)) return { view: 'home' };
	const query = new URLSearchParams(fullPath.split('?')[1]?.split('#')[0] ?? '');
	const view = query.get('view') ?? 'home';
	if (commonViews.has(view)) return { view: view as HatagoesCommonView };
	const app = hatagoesAppForPath(view);
	return app ? { view: 'app', path: view, app } : { view: 'home' };
}

/** HataIntro owns back navigation while it is the active embedded page. */
export function isHatagoesIntroPath(fullPath: string): boolean {
	if (!isHatagoesPath(fullPath)) return false;
	const paneLocation = readHatagoesLocation(fullPath);
	if (paneLocation.view !== 'app') return false;
	const pathname = new URL(paneLocation.path, 'https://hatagoes.invalid').pathname;
	return pathname === '/hatask/intro' || pathname === '/hata-docs';
}

export function hatagoesUrl(view: string): string {
	return view === 'home' ? '/hatagoes' : `/hatagoes?${new URLSearchParams({ view })}`;
}

/**
 * 旗鯖fork: 単独の Hatask 画面は廃止した。メインの画面で開かれた /hatask は、
 * タブや記録の指定を保ったまま HataGoes の中の Hatask に置き換える。
 * HataGoes のペインは自前のルーターで /hatask を描くので、置き換えるのはメインのルーターだけ。
 * /hatask/intro などの下位画面はそれぞれ独立した画面なので対象にしない。
 */
export function hatagoesUrlForStandaloneHatask(fullPath: string): string | null {
	return fullPath.split(/[?#]/u, 1)[0] === '/hatask' ? hatagoesUrl(fullPath) : null;
}

export function hatagoesScreenPath(screen: HatagoesCatalogEntry): string {
	if (!screen.tab) return screen.path;
	const url = new URL(screen.path, 'https://hatagoes.invalid');
	url.searchParams.set('tab', screen.tab);
	return `${url.pathname}${url.search}${url.hash}`;
}

export function hatagoesTab(path: string): string | undefined {
	if (path.split(/[?#]/u, 1)[0] === '/hatafeed/beta') return 'beta';
	const url = new URL(path, 'https://hatagoes.invalid');
	const tab = url.searchParams.get('tab');
	if (tab !== null) return tab;
	if (url.pathname === '/hatask') {
		const notice = url.searchParams.get('notice');
		if (notice === 'calendar') return 'cal';
		if (notice === 'mood') return 'mood';
	}
	return undefined;
}

/** Filters and detail IDs do not change the screen selected in the app capsule. */
export function isHatagoesCurrentScreen(screen: HatagoesCatalogEntry, path: string): boolean {
	if (screen.action || hatagoesAppForPath(path) !== screen.app) return false;
	const targetPath = hatagoesScreenPath(screen);
	const target = new URL(targetPath, 'https://hatagoes.invalid');
	const current = new URL(path, 'https://hatagoes.invalid');
	const appRoot = `/${screen.app}`;
	const rootOrBeta = (pathname: string) => pathname === appRoot || screen.app === 'hatafeed' && pathname === '/hatafeed/beta';
	if (rootOrBeta(target.pathname) && rootOrBeta(current.pathname)) return (hatagoesTab(targetPath) ?? 'home') === (hatagoesTab(path) ?? 'home');
	return target.pathname === current.pathname && [...target.searchParams].every(([key, value]) => current.searchParams.get(key) === value);
}

export function withHatagoesTab(path: string, tab: string): string {
	const url = new URL(path, 'https://hatagoes.invalid');
	url.searchParams.delete('hgKind');
	url.searchParams.delete('hgId');
	if (url.pathname.startsWith('/hatafeed/')) url.pathname = '/hatafeed';
	url.searchParams.set('tab', tab);
	return `${url.pathname}${url.search}${url.hash}`;
}

/** A tab change must not create a second data owner or discard unsaved input. */
export function hatagoesPageKey(path: string): string {
	const url = new URL(path, 'https://hatagoes.invalid');
	if (/^\/hatafeed\/(?:n\/[^/]+|[^/]+)$/u.test(url.pathname)) return '/hatafeed';
	if (url.pathname === '/hatask' || url.pathname === '/hatady' || url.pathname === '/hatafeed') return url.pathname;
	return url.pathname;
}

/** Auxiliary tools get independent routers while each app has one live owner. */
export function hatagoesPaneKey(path: string): string {
	const key = hatagoesPageKey(path);
	return key === '/hatask' || key === '/hatady' || key === '/hatafeed' ? key.slice(1) : `tool:${key}`;
}
