// SPDX-FileCopyrightText: Tolehata and hatasaba-project
// SPDX-License-Identifier: AGPL-3.0-only

export type RssFeed = { id: string; url: string; name?: string; color?: string };
export type RssArticle = { id: string; feedId: string; source: string; title: string; body: string; summary: string; url: string | null; date: string | null; color: string | null };
export type RssResult = { articles: RssArticle[]; successes: number; failures: number };

type RawItem = { guid?: unknown; link?: unknown; title?: unknown; content?: unknown; summary?: unknown; contentSnippet?: unknown; isoDate?: unknown; pubDate?: unknown };
type RawFeed = { title?: unknown; items?: unknown };

export function safeRssUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	try {
		const url = new URL(value);
		return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? url.href : null;
	} catch { return null; }
}

export function rssText(value: unknown): string {
	if (typeof value !== 'string') return '';
	const doc = new DOMParser().parseFromString(value, 'text/html');
	doc.querySelectorAll('script,style,template,noscript,svg,iframe').forEach(node => node.remove());
	doc.querySelectorAll('br,p,div,li,blockquote,h1,h2,h3,h4').forEach(node => node.append('\n'));
	return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').replace(/[\t ]+/g, ' ').replace(/\n[\s\n]*/g, '\n').trim();
}

export function normalizeRssFeed(feed: RssFeed, raw: RawFeed): RssArticle[] {
	if (!Array.isArray(raw?.items)) throw new Error('Invalid RSS response');
	const source = rssText(feed.name) || rssText(raw.title) || new URL(feed.url).hostname;
	const color = typeof feed.color === 'string' && /^#[0-9a-f]{6}$/i.test(feed.color) ? feed.color : null;
	return raw.items.slice(0, 10).map((value: RawItem, index): RssArticle => {
		const item = value && typeof value === 'object' ? value : {};
		const url = safeRssUrl(item.link);
		const title = rssText(item.title);
		const body = rssText(item.content ?? item.summary ?? item.contentSnippet);
		const summary = rssText(item.contentSnippet ?? item.summary ?? item.content);
		const dateString = typeof item.isoDate === 'string' ? item.isoDate : typeof item.pubDate === 'string' ? item.pubDate : '';
		const date = dateString && Number.isFinite(Date.parse(dateString)) ? dateString : null;
		const key = typeof item.guid === 'string' && item.guid ? item.guid : url ?? `${title}:${date ?? ''}:${index}`;
		return { id: `${feed.id}:${key}`, feedId: feed.id, source, title, body, summary, url, date, color };
	});
}

export function roundRobinRss(groups: RssArticle[][]): RssArticle[] {
	const result: RssArticle[] = [];
	for (let i = 0; i < 10; i++) for (const group of groups) if (group[i]) result.push(group[i]);
	return result;
}

export async function fetchRssFeeds(feeds: RssFeed[], signal: AbortSignal, fetcher: typeof window.fetch = window.fetch): Promise<RssResult> {
	const selected = feeds.slice(0, 5);
	const results = await Promise.all(selected.map(async feed => {
		const url = safeRssUrl(feed.url);
		if (!url) return { ok: false as const, articles: [] };
		try {
			const endpoint = new URL('/api/fetch-rss', window.location.origin);
			endpoint.searchParams.set('url', url);
			const response = await fetcher(endpoint.href, { method: 'GET', credentials: 'same-origin', signal });
			if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
			return { ok: true as const, articles: normalizeRssFeed(feed, await response.json()) };
		} catch {
			return { ok: false as const, articles: [] };
		}
	}));
	if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
	return { articles: roundRobinRss(results.map(result => result.articles)), successes: results.filter(result => result.ok).length, failures: results.filter(result => !result.ok).length };
}
