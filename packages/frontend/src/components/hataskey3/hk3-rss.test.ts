// SPDX-FileCopyrightText: Tolehata and hatasaba-project
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fetchRssFeeds, normalizeRssFeed, roundRobinRss, rssText, safeRssUrl } from './hk3-rss.js';
import type { RssFeed } from './hk3-rss.js';

const feeds: RssFeed[] = [
	{ id: 'first', url: 'https://first.example/rss', name: 'First' },
	{ id: 'second', url: 'https://second.example/rss', name: 'Second' },
];

describe('RSS safety and normalization', () => {
	it('rejects unsafe and credential-bearing URLs, including original article links', () => {
		for (const url of ['javascript:alert(1)', 'data:text/html,x', 'https://user:pass@example.com/x', '//example.com/x', 'file:///x']) expect(safeRssUrl(url)).toBeNull();
		expect(safeRssUrl('https://example.com/x')).toBe('https://example.com/x');
		const [article] = normalizeRssFeed(feeds[0], { items: [{ title: 'Article', link: 'javascript:alert(1)' }] });
		expect(article.url).toBeNull();
	});
	it('turns feed HTML into plain text without script, style, or markup', () => {
		expect(rssText('<p>Hello <b>world</b><script>alert(1)</script></p><style>bad</style><p>A &amp; B</p>')).toBe('Hello world\nA & B');
		const [article] = normalizeRssFeed(feeds[0], { title: '<i>Source</i>', items: [{ title: '<b>Title</b>', content: '<p>Body</p><script>bad()</script>', contentSnippet: 'Summary', pubDate: 'not a date' }] });
		expect(article).toMatchObject({ title: 'Title', body: 'Body', summary: 'Summary', date: null });
	});
	it('interleaves priority feeds and limits each feed to ten items', () => {
		const first = normalizeRssFeed(feeds[0], { items: Array.from({ length: 12 }, (_, i) => ({ guid: String(i), title: `A${i}` })) });
		const second = normalizeRssFeed(feeds[1], { items: [{ guid: 'x', title: 'B0' }] });
		expect(first).toHaveLength(10);
		expect(roundRobinRss([first, second]).slice(0, 4).map(item => item.title)).toEqual(['A0', 'B0', 'A1', 'A2']);
	});
});

describe('fetchRssFeeds', () => {
	it('keeps successful empty feeds distinct from failure and retains partial results', async () => {
		const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('first.example') ? { items: [{ title: 'A', link: 'https://safe.example/a' }] } : { error: true }), { status: 200 }));
		const result = await fetchRssFeeds(feeds, new AbortController().signal, fetcher as unknown as typeof fetch);
		expect(result).toMatchObject({ successes: 1, failures: 1 });
		expect(result.articles.map(item => item.title)).toEqual(['A']);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(fetcher.mock.calls[0][0]).toContain('/api/fetch-rss?url=');
		const empty = await fetchRssFeeds([feeds[0]], new AbortController().signal, vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })) as unknown as typeof fetch);
		expect(empty).toMatchObject({ successes: 1, failures: 0, articles: [] });
	});
	it('aborted requests never publish a late successful result', async () => {
		const controller = new AbortController();
		let resolve!: (response: Response) => void;
		const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
		const pending = fetchRssFeeds([feeds[0]], controller.signal, fetcher as unknown as typeof fetch);
		controller.abort();
		resolve(new Response(JSON.stringify({ items: [{ title: 'late' }] }), { status: 200 }));
		await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
	});
});
