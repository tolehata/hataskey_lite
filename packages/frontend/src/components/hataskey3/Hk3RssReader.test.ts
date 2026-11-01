// SPDX-FileCopyrightText: Tolehata and hatasaba-project
// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';

vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: {
		hataskeyUi3RssFeeds: ref([{ id: 'one', url: 'https://feed.example/rss', name: 'Feed' }]),
		hataskeyUi3RssAutoSwitch: ref(true),
		hataskeyUi3RssReadSeconds: ref(6),
		hataskeyUi3RssReadMode: ref('full'),
		animation: ref(true),
	} } };
});
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _hata: { _hataskeyUi3: { _rss: {
	settings: '設定', reading: 'RSS情報表示中', openReader: '記事を読む', empty: '空', loading: '読込中', error: '失敗', retry: '再試行', noFeeds: 'フィードなし',
	previous: '前へ', next: '次へ', close: '閉じる', readOriginal: '元記事', noContent: '本文なし', untitled: '無題', titleScroll: '横スクロール',
} } } } } }));

import Hk3RssReader from './Hk3RssReader.vue';
import { prefer } from '@/preferences.js';

const response = (items: object[]) => new Response(JSON.stringify({ title: 'Feed', items }), { status: 200 });
const twoArticles = () => response([
	{ guid: 'one', title: 'First article', content: '<p>First body</p>', link: 'https://article.example/1' },
	{ guid: 'two', title: 'Second article', content: '<p>Second body</p>', link: 'https://article.example/2' },
]);
let reduced = false;
let documentHidden = false;
const mediaListeners = new Set<(event: { matches: boolean }) => void>();
const disposals: (() => void)[] = [];
const originalHidden = Object.getOwnPropertyDescriptor(window.document, 'hidden');

async function settle() {
	for (let i = 0; i < 8; i++) await Promise.resolve();
	await nextTick();
}

function mountReader(options: { interrupted?: boolean; paused?: boolean; motion?: boolean; composerPickerOpen?: boolean } = {}) {
	const props = ref({ interrupted: false, paused: false, motion: true, composerPickerOpen: false, ...options });
	const readerOpenEvents: boolean[] = [];
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(Hk3RssReader, { ...props.value, onReaderOpen: (value: boolean) => readerOpenEvents.push(value) }) });
	app.mount(target);
	disposals.push(() => { app.unmount(); target.remove(); });
	return { props, target, readerOpenEvents,
										banner: () => target.querySelector('[aria-hidden="true"][inert]') as HTMLElement | null,
										read: () => target.querySelector<HTMLButtonElement>('button[aria-expanded]'),
										details: () => target.querySelector<HTMLElement>('[aria-hidden="false"]') ?? target.querySelector<HTMLElement>('[class*="details"]'),
	};
}

function showArticle(target: HTMLElement, title: string) { expect(target.querySelector('[data-rss-title]:not([aria-hidden])')?.textContent).toBe(title); }

beforeEach(() => {
	vi.useFakeTimers();
	reduced = false; documentHidden = false; mediaListeners.clear();
	Object.defineProperty(window.document, 'hidden', { configurable: true, get: () => documentHidden });
	vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => mediaListeners.add(listener), removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => mediaListeners.delete(listener) }));
	vi.stubGlobal('fetch', vi.fn(async () => twoArticles()));
	prefer.r.hataskeyUi3RssFeeds.value = [{ id: 'one', url: 'https://feed.example/rss', name: 'Feed' }];
	prefer.r.hataskeyUi3RssAutoSwitch.value = true;
	prefer.r.hataskeyUi3RssReadSeconds.value = 6;
	prefer.r.hataskeyUi3RssReadMode.value = 'full';
	prefer.r.animation.value = true;
});
afterEach(() => {
	disposals.splice(0).forEach(dispose => dispose());
	if (originalHidden) Object.defineProperty(window.document, 'hidden', originalHidden);
	vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('Hk3RssReader lifecycle', () => {
	it('holds the same article and remaining rotation time through an interruption', async () => {
		const view = mountReader(); await settle();
		showArticle(view.target, 'First article');
		await vi.advanceTimersByTimeAsync(2000);
		view.props.value = { ...view.props.value, interrupted: true }; await settle();
		expect(view.banner()?.getAttribute('aria-hidden')).toBe('true');
		await vi.advanceTimersByTimeAsync(10000);
		showArticle(view.target, 'First article');
		view.props.value = { ...view.props.value, interrupted: false }; await settle();
		await vi.advanceTimersByTimeAsync(3999); showArticle(view.target, 'First article');
		await vi.advanceTimersByTimeAsync(1); showArticle(view.target, 'Second article');
	});

	it('pauses when hidden or reduced, while manual reader navigation still works', async () => {
		const view = mountReader(); await settle();
		documentHidden = true; window.document.dispatchEvent(new Event('visibilitychange')); await settle();
		await vi.advanceTimersByTimeAsync(9000); showArticle(view.target, 'First article');
		documentHidden = false; window.document.dispatchEvent(new Event('visibilitychange')); await settle();
		reduced = true; mediaListeners.forEach(listener => listener({ matches: true })); await settle();
		await vi.advanceTimersByTimeAsync(9000); showArticle(view.target, 'First article');
		view.read()?.click(); await settle();
		expect(view.target.textContent).toContain('RSS情報表示中');
		view.target.querySelectorAll('button').forEach(button => { if (button.textContent?.includes('次へ')) button.click(); });
		await settle(); expect(view.target.querySelector('h3')?.textContent).toBe('Second article');
	});

	it('preserves the remaining time while parent effects pause switching', async () => {
		const view = mountReader(); await settle();
		await vi.advanceTimersByTimeAsync(1000);
		view.props.value = { ...view.props.value, paused: true }; await settle();
		await vi.advanceTimersByTimeAsync(12000); showArticle(view.target, 'First article');
		view.props.value = { ...view.props.value, paused: false }; await settle();
		await vi.advanceTimersByTimeAsync(4999); showArticle(view.target, 'First article');
		await vi.advanceTimersByTimeAsync(1); showArticle(view.target, 'Second article');
	});

	it('keeps details open under a notice and restores focus to the read button on close', async () => {
		const view = mountReader({ motion: false }); await settle();
		view.read()?.click(); await settle();
		expect(view.target.textContent).toContain('First body');
		view.props.value = { ...view.props.value, interrupted: true }; await settle();
		expect(view.target.textContent).toContain('First body');
		view.props.value = { ...view.props.value, interrupted: false }; await settle();
		view.target.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]')?.click(); await settle();
		expect(window.document.activeElement).toBe(view.read());
		view.read()?.click(); await settle();
		view.props.value = { ...view.props.value, interrupted: true }; await settle();
		view.target.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]')?.click(); await settle();
		view.props.value = { ...view.props.value, interrupted: false }; await settle();
		expect(window.document.activeElement).toBe(view.read());
	});

	it('collapses details for the composer picker without stealing draft focus or losing the article', async () => {
		const view = mountReader({ motion: false }); await settle();
		view.read()?.click(); await settle();
		expect(view.readerOpenEvents).toEqual([true]);
		expect(view.details()?.hasAttribute('inert')).toBe(false);
		const draft = window.document.createElement('textarea');
		window.document.body.append(draft);
		disposals.push(() => draft.remove());
		draft.focus();
		view.props.value = { ...view.props.value, composerPickerOpen: true }; await settle();
		expect(view.readerOpenEvents).toEqual([true, false]);
		expect(view.read()?.getAttribute('aria-expanded')).toBe('false');
		expect(window.document.activeElement).toBe(draft);
		showArticle(view.target, 'First article');
		expect(view.read()).not.toBeNull();
		view.read()?.click(); await settle();
		expect(view.readerOpenEvents).toEqual([true, false]);
		view.props.value = { ...view.props.value, composerPickerOpen: false }; await settle();
		view.read()?.click(); await settle();
		expect(view.readerOpenEvents).toEqual([true, false, true]);
	});

	it('aborts an old request and ignores its late response after feed settings change', async () => {
		let resolveOld!: (response: Response) => void;
		const signals: AbortSignal[] = [];
		vi.stubGlobal('fetch', vi.fn((url: string, options: RequestInit) => {
			signals.push(options.signal!);
			if (url.includes('old.example')) return new Promise<Response>(resolve => { resolveOld = resolve; });
			return Promise.resolve(response([{ guid: 'new', title: 'New feed article' }]));
		}));
		prefer.r.hataskeyUi3RssFeeds.value = [{ id: 'old', url: 'https://old.example/rss' }];
		const view = mountReader(); await settle();
		prefer.r.hataskeyUi3RssFeeds.value = [{ id: 'new', url: 'https://new.example/rss' }]; await settle();
		expect(signals[0].aborted).toBe(true);
		showArticle(view.target, 'New feed article');
		resolveOld(response([{ guid: 'old', title: 'Stale article' }])); await settle();
		expect(view.target.textContent).not.toContain('Stale article');
	});

	it('starts the full reading interval only after a slow response arrives', async () => {
		let resolveFetch!: (response: Response) => void;
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveFetch = resolve; })));
		const view = mountReader(); await settle();
		await vi.advanceTimersByTimeAsync(9000);
		expect(view.target.textContent).toContain('読込中');
		resolveFetch(twoArticles()); await settle();
		showArticle(view.target, 'First article');
		await vi.advanceTimersByTimeAsync(5999); showArticle(view.target, 'First article');
		await vi.advanceTimersByTimeAsync(1); showArticle(view.target, 'Second article');
	});

	it('keeps automatic switching off and releases hover/focus after closing the reader', async () => {
		prefer.r.hataskeyUi3RssAutoSwitch.value = false;
		const view = mountReader(); await settle();
		const banner = view.read()?.parentElement as HTMLElement;
		banner.dispatchEvent(new Event('mouseenter'));
		view.read()?.click(); await settle();
		view.target.querySelectorAll('button').forEach(button => { if (button.textContent?.includes('次へ')) button.click(); });
		await settle();
		view.target.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]')?.click(); await settle();
		banner.dispatchEvent(new Event('mouseleave'));
		const outside = window.document.createElement('button'); window.document.body.append(outside);
		view.read()?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
		outside.remove(); await settle();
		await vi.advanceTimersByTimeAsync(10000); showArticle(view.target, 'Second article');
		prefer.r.hataskeyUi3RssAutoSwitch.value = true; await settle();
		await vi.advanceTimersByTimeAsync(6000); showArticle(view.target, 'First article');
	});
});
