/* SPDX-License-Identifier: AGPL-3.0-only */
import { hatagoesAppForPath, hatagoesUrl } from './hatagoes-navigation.js';

/** Links and ordinary clicks must resolve to the same authorized detail screen. */
export function hatagoesSearchResultUrl(item: { url: string; kind: string; targetId?: string | null }): string {
	if (!hatagoesAppForPath(item.url)) return item.url;
	const url = new URL(item.url, 'https://hatagoes.invalid');
	if (item.targetId && !['issue', 'comment'].includes(item.kind)) {
		url.searchParams.set('hgKind', item.kind);
		url.searchParams.set('hgId', item.targetId);
	}
	return hatagoesUrl(`${url.pathname}${url.search}${url.hash}`);
}
