/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, h, nextTick } from 'vue';
import { parse as parseCss } from 'postcss';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import WelcomePostColumns from './welcome.entrance.post-columns.vue';
import { useWelcomePublicNotes } from '@/utility/welcome-public-notes.js';
import { prefer } from '@/preferences.js';

vi.mock('@/utility/welcome-public-notes.js', async () => {
	const { ref } = await import('vue');
	const enabled = ref(true);
	return { useWelcomePublicNotes: () => ({ enabled }) };
});
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(true) } } };
});
vi.mock('./welcome.entrance.note-stream.vue', async () => {
	const { h } = await import('vue');
	return { default: { props: ['feedKey', 'title'], setup: () => () => h('div', { class: 'public-note-stream' }, [h('a', { href: '#note' }, '投稿'), h('details', [h('summary', '注意書き')])]) } };
});

let width = 483, height = 912, cardTop = 474, reduced = false;
let host: HTMLElement, app: ReturnType<typeof createApp> | undefined;
let resize: (() => void)[] = [], motion: (() => void)[] = [];
let lastScroll: ScrollToOptions | undefined;
const allowed = useWelcomePublicNotes().enabled as { value: boolean };

async function flush() { await nextTick(); await nextTick(); await vi.advanceTimersByTimeAsync(20); await nextTick(); }

function required<T extends Element = HTMLElement>(selector: string): T {
	const element = host.querySelector<T>(selector);
	if (!element) throw new Error(`Missing ${selector}`);
	return element;
}

function status() { return required('.public-post-page-status [role=status]').textContent; }

async function scrollPage(top: number) { cardTop = top; host.dispatchEvent(new Event('scroll')); await flush(); }

async function mount() {
	host = window.document.createElement('div');
	host.dataset.hataskeyEntrance = '';
	window.document.body.append(host);
	app = createApp({ render: () => [h('header', { class: 'site-header' }), h(WelcomePostColumns, { language: 'ja' })] });
	app.mount(host);
	await flush();
}

beforeEach(() => {
	vi.useFakeTimers();
	width = 483; height = 912; cardTop = 474; reduced = false; resize = []; motion = [];
	allowed.value = true; prefer.r.animation.value = true;
	vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize.push(callback); } observe() {} disconnect() {} });
	vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_type: string, callback: () => void) => motion.push(callback), removeEventListener: vi.fn() }));
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16));
	vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('public-post-grid') ? width - 48 : width; });
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		const top = this.classList.contains('public-post-columns') ? cardTop : 0;
		const boxHeight = this.classList.contains('site-header') ? 56 : this.classList.contains('public-post-stage') ? 414 : height;
		return { top, left: 0, width, height: boxHeight, bottom: top + boxHeight, right: width, x: 0, y: top, toJSON: () => ({}) };
	});
	vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(function (this: HTMLElement, options?: number | ScrollToOptions) {
		if (typeof options !== 'object') return;
		lastScroll = options;
		this.scrollLeft = options.left ?? 0;
	});
});
afterEach(() => { app?.unmount(); app = undefined; host?.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('483pxの幅で４列を順に切り替え、逆スクロールでも戻る', async () => {
	await mount();
	expect(status()).toContain('最新の投稿1 / 4');
	expect(required('.public-post-columns').getAttribute('data-scroll-linked')).toBe('true');
	for (const [top, title] of [[365, '人気の投稿2'], [260, 'ファイル付き3'], [155, 'あいさつ4'], [365, '人気の投稿2'], [474, '最新の投稿1']] as const) {
		await scrollPage(top);
		expect(status()).toContain(title);
	}
	expect(required('.public-post-columns').style.height).toBe('');
	expect(required('.public-post-stage').style.position).toBe('');
});

test('連打・手動スワイプ・画面回転後も選択列と操作対象が一致する', async () => {
	await mount();
	const next = required<HTMLButtonElement>('[data-post-next]');
	next.click(); next.click(); await flush();
	expect(status()).toContain('ファイル付き3');
	const track = required('.public-post-grid');
	track.dispatchEvent(new Event('pointerdown'));
	track.scrollLeft = track.clientWidth;
	track.dispatchEvent(new Event('scrollend'));
	await flush();
	expect(status()).toContain('人気の投稿2');
	expect([...track.children].map(el => el.hasAttribute('inert'))).toEqual([true, false, true, true]);
	width = 1200; resize.forEach(callback => callback()); await flush();
	expect(host.querySelector('.public-post-pager')).toBeNull();
	expect([...track.children].some(el => el.hasAttribute('inert'))).toBe(false);
	width = 455; resize.forEach(callback => callback()); await flush();
	expect(status()).toContain('人気の投稿2');
	expect(track.scrollLeft).toBe(track.clientWidth);
});

test('短い画面と動きを抑える設定では手動切り替えを維持する', async () => {
	height = 560;
	await mount();
	expect(required('.public-post-columns').getAttribute('data-scroll-linked')).toBe('false');
	required<HTMLButtonElement>('[data-post-next]').click(); await flush();
	expect(status()).toContain('人気の投稿2');
	height = 912; reduced = true; motion.forEach(callback => callback()); await flush();
	expect(required('.public-post-columns').getAttribute('data-scroll-linked')).toBe('false');
	required<HTMLButtonElement>('[data-post-next]').click(); await flush();
	expect(lastScroll?.behavior).toBe('auto');
	reduced = false; motion.forEach(callback => callback()); prefer.r.animation.value = false; await flush();
	expect(required('.public-post-columns').getAttribute('data-scroll-linked')).toBe('false');
});

test('読んでいる投稿のフォーカスや開いた注意書きを自動切り替えで隠さない', async () => {
	await mount();
	const link = required<HTMLAnchorElement>('.public-note-stream a');
	link.focus(); await scrollPage(365);
	expect(status()).toContain('最新の投稿1');
	link.blur(); required<HTMLDetailsElement>('.public-note-stream details').open = true;
	await scrollPage(260);
	expect(status()).toContain('最新の投稿1');
	required<HTMLDetailsElement>('.public-note-stream details').open = false;
	await scrollPage(155);
	expect(status()).toContain('人気の投稿2');
});

test('公開設定が後から許可されても計測とスクロール連携を開始する', async () => {
	allowed.value = false;
	await mount();
	expect(host.querySelector('.public-post-columns')).toBeNull();
	allowed.value = true; await flush();
	await scrollPage(260);
	expect(status()).toContain('ファイル付き3');
	allowed.value = false; await flush();
	expect(host.querySelector('.public-post-columns')).toBeNull();
});

test('追加の縦余白とsticky固定を禁止し、横スクロールバーを隠す（陽性対照つき）', () => {
	const css = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.previews.css'), 'utf8');

	function assertCompact(value: string) {
		parseCss(value).walkRules(rule => {
			if (!rule.selectors.some(selector => /\.public-post-(columns|stage)$/.test(selector))) return;
			rule.walkDecls(declaration => {
				expect(declaration.prop).not.toMatch(/^(height|min-height|block-size|min-block-size)$/);
				if (declaration.prop === 'position') expect(declaration.value).not.toBe('sticky');
			});
		});
	}

	expect(() => assertCompact(`${css}\n[data-hataskey-entrance] .public-post-columns {min-height:912px}`)).toThrow();
	expect(() => assertCompact(`${css}\n[data-hataskey-entrance] .public-post-stage {position:sticky}`)).toThrow();
	assertCompact(css);
	expect(css).toContain('scrollbar-width:none');
	expect(css).toContain('.public-post-grid::-webkit-scrollbar{display:none}');
});
