/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseCss } from 'postcss';
import { compileString } from 'sass';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import WelcomeActivity from './welcome.entrance.activity.vue';
import type { AtRule, Document, Root, Rule } from 'postcss';
import { instance as productionInstance } from '@/instance.js';

type MockMeta = {
	policies: { ltlAvailable: boolean };
	clientOptions: { showTimelineForVisitor: boolean; showActivitiesForVisitor?: boolean };
};
type Panel = 'active' | 'members';
type Direction = 'prev' | 'next';

const instance = productionInstance as unknown as MockMeta;
const mocks = vi.hoisted(() => ({
	api: vi.fn<(endpoint: string, params: Record<string, unknown>, token: string | null, signal: AbortSignal) => Promise<unknown>>(),
	scrollTo: vi.fn<(options?: ScrollToOptions | number, y?: number) => void>(),
}));

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/instance.js', async () => {
	const { reactive } = await import('vue');
	return { instance: reactive<MockMeta>({
		policies: { ltlAvailable: true },
		clientOptions: { showTimelineForVisitor: true, showActivitiesForVisitor: true },
	}) };
});

const observers: TestResizeObserver[] = [];
class TestResizeObserver implements ResizeObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
	constructor(private readonly callback: ResizeObserverCallback) { observers.push(this); }
	measure() { this.callback([], this); }
}

function statsFixture() { return { originalUsersCount: 42, usersCount: 9000 }; }

function activityFixture() {
	return { read: [700, 7, 6, 5, 4, 3, 2, 1], write: Array(8).fill(100), readWrite: Array(8).fill(90) };
}

function responseFor(endpoint: string): unknown {
	if (endpoint === 'stats') return statsFixture();
	assert.equal(endpoint, 'charts/active-users', 'this component must fetch only its two public statistics');
	return activityFixture();
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
	return { promise, resolve };
}

const cleanup = new Set<() => void>();

// Happy DOM has no actual layout or native scrolling. The viewport, track width
// and scrollLeft below are explicit fixtures, and scrollTo completes immediately.
// These tests exercise Vue state/events, not browser snap physics or visual QA.
function mount({ width = 400, trackWidth = 320, language = 'ja' }: { width?: number; trackWidth?: number; language?: 'ja' | 'en' } = {}) {
	let entranceWidth = width;
	let offset = 0;
	const container = window.document.createElement('div');
	container.setAttribute('data-hataskey-entrance', '');
	Object.defineProperty(container, 'clientWidth', { get: () => entranceWidth });
	window.document.body.append(container);
	const onResize = vi.fn();
	const app = createApp(defineComponent({ setup: () => () => h(WelcomeActivity, { language, onResize }) }));
	app.mount(container);
	const track = container.querySelector<HTMLElement>('[data-mobile]');
	assert.ok(track, 'the activity track must mount');
	Object.defineProperties(track, {
		clientWidth: { configurable: true, get: () => trackWidth },
		scrollLeft: { configurable: true, get: () => offset, set: (value: number) => { offset = value; } },
	});
	const observer = observers[observers.length - 1];
	assert.ok(observer, 'the component must register its resize observer');
	observer.measure();
	const unmount = () => {
		if (!cleanup.delete(unmount)) return;
		app.unmount();
		container.remove();
	};
	cleanup.add(unmount);
	return {
		container, track, observer, onResize, unmount,
		resize(nextWidth: number) { entranceWidth = nextWidth; observer.measure(); },
	};
}

async function flush() {
	await Promise.resolve();
	await nextTick();
	await Promise.resolve();
	await nextTick();
}

function arrowButton(container: HTMLElement, direction: Direction): HTMLButtonElement {
	const button = container.querySelector<HTMLButtonElement>(`[data-activity-${direction}]`);
	assert.ok(button, `${direction} navigation button must exist`);
	return button;
}

function assertActivePanel(container: HTMLElement, active: Panel): void {
	const panels = container.querySelectorAll<HTMLElement>('[data-activity-panel]');
	assert.ok(panels.length > 0, 'active-panel checks must inspect real panels');
	for (const panel of panels) {
		const selected = panel.dataset.activityPanel === active;
		expect(panel.dataset.activityVisible, panel.dataset.activityPanel).toBe(String(selected));
		expect(panel.inert, panel.dataset.activityPanel).toBe(!selected);
		expect(panel.getAttribute('aria-hidden'), panel.dataset.activityPanel).toBe(selected ? null : 'true');
	}
	const current = container.querySelector('[data-activity-current]');
	if (panels.length > 1) assert.ok(current, 'multiple panels need a current-panel label');
	if (current) expect(current.textContent.trim()).toBe({ active: 'アクティブ人数', members: 'サーバー人数' }[active]);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.api.mockReset().mockImplementation(endpoint => Promise.resolve(responseFor(endpoint)));
	observers.length = 0;
	instance.policies.ltlAvailable = true;
	instance.clientOptions.showTimelineForVisitor = true;
	instance.clientOptions.showActivitiesForVisitor = true;
	vi.stubGlobal('ResizeObserver', TestResizeObserver);
	vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
		matches: false, media: query, onchange: null,
		addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true),
	}));
	mocks.scrollTo.mockReset().mockImplementation(function (this: HTMLElement, options) {
		this.scrollLeft = typeof options === 'number' ? options : options?.left ?? 0;
	});
	vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(mocks.scrollTo);
});

afterEach(() => {
	for (const unmount of cleanup) unmount();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('ログイン前のサーバーアクティビティ取得と表示', () => {
	test('二つの公開APIへゲスト資格を明示し、ローカル人数と今日を除く7日集計を表示する', async () => {
		const item = mount();
		await flush();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(mocks.api).toHaveBeenCalledWith('stats', {}, null, expect.any(AbortSignal));
		expect(mocks.api).toHaveBeenCalledWith('charts/active-users', { span: 'day', limit: 8 }, null, expect.any(AbortSignal));
		expect(mocks.api.mock.calls[0][3]).toBe(mocks.api.mock.calls[1][3]);
		expect(item.container.querySelector('[data-activity-members]')?.textContent).toBe('42');
		expect(item.container.querySelector('[data-activity-average]')?.textContent).toBe('4');
		expect(item.container.querySelector('[data-activity-yesterday]')?.textContent).toBe('7');
		expect(item.container.textContent).toContain('今日を除く直近7日・UTC集計');
		// Distinct remote-inclusive/today/write values make wrong-field regressions observable.
		expect(item.container.textContent).not.toContain('9,000');
		expect(item.container.querySelector('[data-activity-yesterday]')?.textContent).not.toBe('700');
		expect(item.onResize).toHaveBeenCalled();
	});

	test('サーバーの投稿パネルは持たず、統計の2パネルだけを表示する', async () => {
		const item = mount({ width: 1200 });
		await flush();
		expect(Array.from(item.container.querySelectorAll('[data-activity-panel]'), panel => panel.getAttribute('data-activity-panel'))).toEqual(['active', 'members']);
		expect(item.container.querySelector('[data-activity-panel="notes"]')).toBeNull();
		expect(item.container.textContent).not.toContain('サーバーの投稿');
		expect(mocks.api.mock.calls.map(call => call[0]).sort()).toEqual(['charts/active-users', 'stats']);
	});

	test('英語では英語ラベルと小数1桁までの平均を表示する', async () => {
		mocks.api.mockImplementation(endpoint => Promise.resolve(endpoint === 'stats' ? { originalUsersCount: 12345 } : { read: [999, 8, 4, 3, 2, 1, 0, 0] }));
		const item = mount({ language: 'en' });
		await flush();
		expect(item.container.querySelector('[data-activity-members]')?.textContent).toBe('12,345');
		expect(item.container.querySelector('[data-activity-average]')?.textContent).toBe('2.6');
		expect(item.container.querySelector('[data-activity-yesterday]')?.textContent).toBe('8');
		expect(item.container.textContent).toContain('Last 7 complete days · UTC');
		expect(item.container.querySelector('[data-activity-current]')?.textContent.trim()).toBe('Active users');
		expect(arrowButton(item.container, 'prev').getAttribute('aria-label')).toBe('Previous panel');
		expect(arrowButton(item.container, 'next').getAttribute('aria-label')).toBe('Next panel');
		arrowButton(item.container, 'next').click();
		await flush();
		expect(item.container.querySelector('[data-activity-current]')?.textContent.trim()).toBe('Members');
	});

	test('統計の表示許可がfalseなら二つの統計APIを呼ばず、表示領域もナビゲーションも出さない', async () => {
		instance.clientOptions.showActivitiesForVisitor = false;
		const item = mount();
		await flush();
		expect(mocks.api).not.toHaveBeenCalled();
		expect(item.container.querySelector('[data-activity-panel]')).toBeNull();
		expect(item.container.querySelector<HTMLElement>('[data-welcome-activity]')?.style.display).toBe('none');
		expect(item.container.querySelector('[data-activity-prev]')).toBeNull();
		expect(item.container.querySelector('[data-activity-next]')).toBeNull();
	});

	test.each([[false, true], [true, false], [false, false]])('LTL=%s / 投稿表示=%s でも統計は表示許可だけに従う', async (ltl, showTimeline) => {
		instance.policies.ltlAvailable = ltl;
		instance.clientOptions.showTimelineForVisitor = showTimeline;
		const item = mount();
		await flush();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(item.container.querySelector('[data-activity-average]')?.textContent).toBe('4');
		expect(item.container.querySelector('[data-activity-members]')?.textContent).toBe('42');
		assertActivePanel(item.container, 'active');
	});

	test.each([
		['stats', 'malformed', 'members', 'active'],
		['stats', 'failure', 'members', 'active'],
		['charts/active-users', 'malformed', 'active', 'members'],
		['charts/active-users', 'failure', 'active', 'members'],
	] as const)('%sが%sでも0に補完せず、成功した側だけを維持する', async (endpoint, mode, missing, surviving) => {
		mocks.api.mockImplementation(requested => {
			if (requested !== endpoint) return Promise.resolve(responseFor(requested));
			return mode === 'failure' ? Promise.reject(new Error('unavailable')) : Promise.resolve({});
		});
		const item = mount();
		await flush();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(item.container.querySelector(`[data-activity-panel="${missing}"]`)).toBeNull();
		expect(item.container.querySelector(`[data-activity-panel="${surviving}"]`)).not.toBeNull();
		expect(item.container.querySelector(surviving === 'active' ? '[data-activity-average]' : '[data-activity-members]')?.textContent).toBe(surviving === 'active' ? '4' : '42');
		// A single remaining panel needs no pager.
		expect(item.container.querySelector('[data-activity-prev]')).toBeNull();
		assertActivePanel(item.container, surviving);
	});

	test('正常な0人は取得失敗と区別して表示する', async () => {
		mocks.api.mockImplementation(endpoint => Promise.resolve(endpoint === 'stats' ? { originalUsersCount: 0 } : { read: Array(8).fill(0) }));
		const item = mount();
		await flush();
		expect(item.container.querySelector('[data-activity-average]')?.textContent).toBe('0');
		expect(item.container.querySelector('[data-activity-yesterday]')?.textContent).toBe('0');
		expect(item.container.querySelector('[data-activity-members]')?.textContent).toBe('0');
	});
});

describe('ログイン前のモバイルパネル操作', () => {
	test('モバイルはアクティブ人数・サーバー人数の順でアクティブ人数を初期表示し、未選択パネルを操作と読み上げから除外する', async () => {
		const item = mount();
		await flush();
		expect(item.track.dataset.mobile).toBe('true');
		expect(Array.from(item.container.querySelectorAll('[data-activity-panel]'), panel => panel.getAttribute('data-activity-panel'))).toEqual(['active', 'members']);
		expect(item.container.querySelector('[data-panel-button]')).toBeNull();
		expect(item.track.scrollLeft).toBe(0);
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' });
		assertActivePanel(item.container, 'active');
		expect(arrowButton(item.container, 'prev').disabled).toBe(true);
		expect(arrowButton(item.container, 'next').disabled).toBe(false);
		mocks.scrollTo.mockClear();
		arrowButton(item.container, 'prev').click();
		await flush();
		expect(mocks.scrollTo).not.toHaveBeenCalled();
		assertActivePanel(item.container, 'active');
		arrowButton(item.container, 'next').click();
		await flush();
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 320, behavior: 'smooth' });
		expect(item.track.scrollLeft).toBe(320);
		assertActivePanel(item.container, 'members');
		expect(arrowButton(item.container, 'prev').disabled).toBe(false);
		expect(arrowButton(item.container, 'next').disabled).toBe(true);
		mocks.scrollTo.mockClear();
		arrowButton(item.container, 'next').click();
		await flush();
		expect(mocks.scrollTo).not.toHaveBeenCalled();
		assertActivePanel(item.container, 'members');
		arrowButton(item.container, 'prev').click();
		await flush();
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
		assertActivePanel(item.container, 'active');
	});

	test.each([
		['prev', 'ArrowRight'],
		['prev', 'End'],
		['next', 'ArrowRight'],
		['next', 'End'],
	] as const)('%sボタンで%sを押すとサーバー人数へ移動する', async (direction, key) => {
		const item = mount();
		await flush();
		const button = arrowButton(item.container, direction);
		const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
		button.dispatchEvent(event);
		await flush();
		expect(event.defaultPrevented).toBe(true);
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 320, behavior: 'smooth' });
		assertActivePanel(item.container, 'members');
	});

	test.each([
		['prev', 'ArrowLeft'],
		['prev', 'Home'],
		['next', 'ArrowLeft'],
		['next', 'Home'],
	] as const)('%sボタンで%sを押すとアクティブ人数へ戻り、有効なボタンのフォーカスを保つ', async (direction, key) => {
		const item = mount();
		await flush();
		arrowButton(item.container, 'next').click();
		await flush();
		assertActivePanel(item.container, 'members');
		const button = arrowButton(item.container, direction);
		button.focus();
		const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
		button.dispatchEvent(event);
		await flush();
		expect(event.defaultPrevented).toBe(true);
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
		if (!button.disabled) expect(window.document.activeElement).toBe(button);
		assertActivePanel(item.container, 'active');
	});

	test('日本語の矢印名と現在項目を読み上げ、位置のドットは装飾として扱う', async () => {
		const item = mount();
		await flush();
		expect(arrowButton(item.container, 'prev').getAttribute('aria-label')).toBe('前の項目');
		expect(arrowButton(item.container, 'next').getAttribute('aria-label')).toBe('次の項目');
		const current = item.container.querySelector('[data-activity-current]');
		assert.ok(current, 'current-panel label must exist');
		expect(current.getAttribute('role')).toBe('status');
		expect(current.getAttribute('aria-live')).toBe('polite');
		expect(current.getAttribute('aria-atomic')).toBe('true');
		const dots = item.container.querySelectorAll<HTMLElement>('[data-active]');
		expect(dots).toHaveLength(2);
		for (const dot of dots) expect(dot.closest('[aria-hidden="true"]')).not.toBeNull();
		expect(Array.from(dots, dot => dot.dataset.active)).toEqual(['true', 'false']);
		arrowButton(item.container, 'next').click();
		await flush();
		expect(Array.from(dots, dot => dot.dataset.active)).toEqual(['false', 'true']);
	});

	test('矢印を続けて操作しても途中のscrollイベントで目標パネルを巻き戻さず、直接スワイプで中断できる', async () => {
		const item = mount();
		await flush();
		// Keep smooth scrolling in flight; instant alignments still settle.
		mocks.scrollTo.mockImplementation(function (this: HTMLElement, options) {
			if (typeof options === 'number') this.scrollLeft = options;
			else if (options?.behavior !== 'smooth') this.scrollLeft = options?.left ?? 0;
		});
		arrowButton(item.container, 'next').click();
		await flush();
		item.track.scrollLeft = 100;
		item.track.dispatchEvent(new Event('scroll'));
		await flush();
		assertActivePanel(item.container, 'members');
		arrowButton(item.container, 'prev').click();
		await flush();
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
		item.track.scrollLeft = 220;
		item.track.dispatchEvent(new Event('scroll'));
		await flush();
		assertActivePanel(item.container, 'active');
		item.track.scrollLeft = 0;
		item.track.dispatchEvent(new Event('scroll'));
		await flush();
		assertActivePanel(item.container, 'active');
		item.track.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		item.track.scrollLeft = 320;
		item.track.dispatchEvent(new Event('scroll'));
		await flush();
		assertActivePanel(item.container, 'members');
	});

	test('端からのキーボード操作も循環せず、対象外のキーは妨げない', async () => {
		const item = mount();
		await flush();
		arrowButton(item.container, 'next').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
		await flush();
		assertActivePanel(item.container, 'active');
		expect(item.track.scrollLeft).toBe(0);
		arrowButton(item.container, 'next').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
		await flush();
		arrowButton(item.container, 'prev').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
		await flush();
		assertActivePanel(item.container, 'members');
		expect(item.track.scrollLeft).toBe(320);
		mocks.scrollTo.mockClear();
		const unrelated = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
		arrowButton(item.container, 'prev').dispatchEvent(unrelated);
		await flush();
		expect(unrelated.defaultPrevented).toBe(false);
		expect(mocks.scrollTo).not.toHaveBeenCalled();
	});

	test('scrollLeftを一枚の幅で丸め、範囲外のスクロールは先頭か末尾へ収める', async () => {
		const item = mount();
		await flush();
		for (const [left, panel] of [[-100, 'active'], [0, 'active'], [159, 'active'], [160, 'members'], [319, 'members'], [99999, 'members']] as const) {
			item.track.scrollLeft = left;
			item.track.dispatchEvent(new Event('scroll'));
			await flush();
			assertActivePanel(item.container, panel);
		}
	});

	test('動きを減らす設定ではクリックでも即時スクロールを使う', async () => {
		vi.mocked(window.matchMedia).mockImplementation(query => ({
			matches: query === '(prefers-reduced-motion: reduce)', media: query, onchange: null,
			addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true),
		}));
		const item = mount();
		await flush();
		arrowButton(item.container, 'next').click();
		await flush();
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 320, behavior: 'auto' });
		assertActivePanel(item.container, 'members');
	});

	test('PCでは全パネルを操作可能にし、モバイルから広げた場合もinertを外す', async () => {
		const item = mount();
		await flush();
		arrowButton(item.container, 'next').click();
		await flush();
		assertActivePanel(item.container, 'members');
		item.resize(1200);
		await flush();
		expect(item.track.dataset.mobile).toBe('false');
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' });
		const panels = item.container.querySelectorAll<HTMLElement>('[data-activity-panel]');
		expect(panels).toHaveLength(2);
		expect(Array.from(panels, panel => panel.dataset.activityPanel)).toEqual(['active', 'members']);
		for (const panel of panels) {
			expect(panel.dataset.activityVisible).toBe('true');
			expect(panel.inert).toBe(false);
			expect(panel.hasAttribute('aria-hidden')).toBe(false);
		}
		item.resize(400);
		await flush();
		assertActivePanel(item.container, 'members');
		expect(item.track.scrollLeft).toBe(320);
	});

	test('PCからモバイルへ狭めたときも未操作なら先頭のアクティブ人数を表示する', async () => {
		const item = mount({ width: 1200 });
		await flush();
		expect(item.track.dataset.mobile).toBe('false');
		expect(item.track.scrollLeft).toBe(0);
		item.resize(400);
		await flush();
		assertActivePanel(item.container, 'active');
		expect(item.track.scrollLeft).toBe(0);
	});

	test('サーバー人数が先に届いても、未操作なら後着のアクティブ人数を先頭に表示する', async () => {
		const stats = deferred<unknown>();
		const activity = deferred<unknown>();
		mocks.api.mockImplementation(endpoint => endpoint === 'stats' ? stats.promise : activity.promise);
		const item = mount();
		await flush();
		expect(item.container.querySelector('[data-activity-panel]')).toBeNull();
		stats.resolve(statsFixture());
		await flush();
		assertActivePanel(item.container, 'members');
		expect(item.track.scrollLeft).toBe(0);
		activity.resolve(activityFixture());
		await flush();
		assertActivePanel(item.container, 'active');
		expect(item.track.scrollLeft).toBe(0);
	});

	test('操作で選んだサーバー人数を、後着のアクティブ人数で勝手に切り替えない', async () => {
		const stats = deferred<unknown>();
		const activity = deferred<unknown>();
		mocks.api.mockImplementation(endpoint => endpoint === 'stats' ? stats.promise : activity.promise);
		const item = mount();
		await flush();
		stats.resolve(statsFixture());
		await flush();
		assertActivePanel(item.container, 'members');
		item.track.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		await flush();
		activity.resolve(activityFixture());
		await flush();
		// Without the interaction, the new first panel would take over.
		assertActivePanel(item.container, 'members');
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ left: 320, behavior: 'auto' });
		expect(item.track.scrollLeft).toBe(320);
	});
});

describe('サーバー情報の登場状態', () => {
	test('後着の統計と繰り返しの切り替えでも、選択パネルだけ登場させる', async () => {
		const stats = deferred<unknown>();
		const activity = deferred<unknown>();
		mocks.api.mockImplementation(endpoint => endpoint === 'stats' ? stats.promise : activity.promise);
		const item = mount();
		await flush();
		activity.resolve(activityFixture());
		await flush();
		assertActivePanel(item.container, 'active');
		stats.resolve(statsFixture());
		await flush();
		assertActivePanel(item.container, 'active');
		arrowButton(item.container, 'next').click();
		await flush();
		assertActivePanel(item.container, 'members');
		item.track.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		item.track.scrollLeft = 0;
		item.track.dispatchEvent(new Event('scroll'));
		await flush();
		assertActivePanel(item.container, 'active');
		arrowButton(item.container, 'next').click();
		await flush();
		assertActivePanel(item.container, 'members');
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});
});


// These contracts inspect compiled stylesheet declarations. They do not claim
// that Happy DOM renders CSS motion or measures native scroll-snap geometry.
const activitySource = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.activity.vue'), 'utf8');
const activitySfc = parseSfc(activitySource);
assert.deepEqual(activitySfc.errors, [], 'the activity component must parse');
assert.equal(activitySfc.descriptor.styles.length, 1, 'the component must expose its stylesheet');
const activityScss = activitySfc.descriptor.styles[0].content;

function activityStyles(scss = activityScss): Root {
	return parseCss(compileString(scss, { style: 'expanded' }).css);
}

function hasContext(rule: Rule, name: string, params: string): boolean {
	for (let parent: AtRule | Document | Root | Rule | undefined = rule.parent; parent; parent = parent.parent) {
		if (parent.type === 'atrule' && (parent as AtRule).name === name && (parent as AtRule).params === params) return true;
	}
	return false;
}

function declaration(styles: Root, selector: string, property: string, context?: { name: string; params: string }): string | undefined {
	let value: string | undefined;
	styles.walkRules(rule => {
		if (!rule.selectors.includes(selector)) return;
		if (context ? !hasContext(rule, context.name, context.params) : rule.parent?.type !== 'root') return;
		rule.walkDecls(property, item => { value = item.value; });
	});
	return value;
}

function assertStationarySnapBoxes(styles: Root): void {
	let surfaceFrames = 0;
	styles.walkAtRules('keyframes', animation => {
		if (animation.params !== 'surfaceArrive') return;
		surfaceFrames++;
		const properties = new Set<string>();
		animation.walkDecls(item => { properties.add(item.prop); });
		assert.deepEqual([...properties], ['opacity'], 'the surface entrance may only change opacity');
	});
	assert.equal(surfaceFrames, 1, 'surface animation must be present');
	let panels = 0;
	styles.walkRules(rule => {
		if (!rule.selectors.some(selector => /^\.panel(?:(?:\[[^\]]+\])|(?::(?:focus-within|active)))*$/.test(selector))) return;
		panels++;
		rule.walkDecls(item => {
			assert.ok(!/^(?:transform|translate|rotate|scale|perspective)$/.test(item.prop), 'the scroll-snap panel itself must never move');
			if (item.prop === 'animation') assert.match(item.value, /^(?:none|surfaceArrive\s)/, 'only the surface fade belongs on a panel');
		});
	});
	assert.ok(panels > 0, 'snap-box checks must inspect panel rules');
}

function assertInterruptibleMotion(styles: Root): void {
	const reduced = { name: 'media', params: '(prefers-reduced-motion: reduce)' };
	for (const selector of ['.panel[data-activity-visible=true]', '.panel[data-activity-visible=true] > *', '.panel[data-activity-visible=true] .heading > i']) {
		assert.equal(declaration(styles, selector, 'animation', reduced), 'none', `${selector} must honor reduced motion`);
	}
	for (const state of ['focus-within', 'active']) {
		for (const selector of [`.panel:${state}`, `.panel:${state} > *`, `.panel:${state} .heading > i`]) {
			assert.equal(declaration(styles, selector, 'animation'), 'none', `${selector} must immediately reveal an interacted control`);
		}
	}
}

describe('サーバー情報の登場CSS契約', () => {
	test('snap対象の箱はフェードだけに留め、内容とアイコンに方向と時間差を付ける', () => {
		const styles = activityStyles();
		assertStationarySnapBoxes(styles);
		expect(declaration(styles, '.panel[data-activity-visible=true] > *', 'animation')).toContain('contentArrive');
		expect(declaration(styles, '.panel[data-activity-visible=true] .heading > i', 'animation')).toContain('iconArrive');
		expect(declaration(styles, '.panel[data-activity-visible=true] > :nth-child(2)', 'animation-delay')).not.toBe(declaration(styles, '.panel[data-activity-visible=true] > :nth-child(3)', 'animation-delay'));
		expect(parseFloat(declaration(styles, '.panel', '--activity-x') ?? 'NaN')).toBeLessThan(0);
		expect(parseFloat(declaration(styles, '.panel[data-activity-panel=members]', '--activity-x') ?? 'NaN')).toBeGreaterThan(0);
		const mobile = { name: 'container', params: 'hataskey-entrance (max-width: 820px)' };
		expect(declaration(styles, '.panel[data-activity-panel]', '--activity-x', mobile)).toBe('0px');
		expect(declaration(styles, '.panel[data-activity-panel]', '--activity-delay', mobile)).toBe('0ms');
		expect(declaration(styles, '.panel', 'flex', mobile)).toBe('0 0 100%');
		expect(declaration(styles, '.panel', 'scroll-snap-align', mobile)).toBe('start');
	});

	test('focus・押下・動きを減らす設定では内容とアイコンまで演出を停止する', () => {
		assertInterruptibleMotion(activityStyles());
	});

	test('モバイルの前後ボタンは外枠と面を持たない', () => {
		const styles = activityStyles();
		const mobile = { name: 'container', params: 'hataskey-entrance (max-width: 820px)' };
		expect(declaration(styles, '.pageButton', 'border', mobile)).toBe('0');
		expect(declaration(styles, '.pageButton', 'background', mobile)).toBe('transparent');
		expect(declaration(styles, '.pageButton', 'box-shadow', mobile)).toBe('none');
	});

	test.each([
		['panelへのtransform混入', `${activityScss}\n.panel[data-activity-visible="true"] { transform: translateX(20px); }`],
		['surfaceキーフレームへのtransform混入', activityScss.replace('from { opacity: .35; }', 'from { opacity: .35; transform: translateY(20px); }')],
	])('陽性対照: %sを検出する', (_label, scss) => {
		expect(scss).not.toBe(activityScss);
		expect(() => assertStationarySnapBoxes(activityStyles(scss))).toThrow();
	});

	test('陽性対照: reduced-motion条件の脱落を検出する', () => {
		const altered = activityScss.replace('@media (prefers-reduced-motion: reduce)', '@media (prefers-reduced-motion: no-preference)');
		expect(altered).not.toBe(activityScss);
		expect(() => assertInterruptibleMotion(activityStyles(altered))).toThrow(/must honor reduced motion/);
	});
});

describe('ログイン前アクティビティのライフサイクル', () => {
	test('公開許可が取り消されたら取得済み統計を消し、表示領域を隠す', async () => {
		const item = mount();
		await flush();
		expect(item.container.querySelector('[data-activity-members]')?.textContent).toBe('42');
		const signals = mocks.api.mock.calls.map(call => call[3]);
		instance.clientOptions.showActivitiesForVisitor = false;
		await flush();
		expect(signals.every(signal => signal.aborted)).toBe(true);
		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(item.container.querySelector('[data-activity-panel="active"]')).toBeNull();
		expect(item.container.querySelector('[data-activity-panel="members"]')).toBeNull();
		expect(item.container.querySelector<HTMLElement>('[data-welcome-activity]')?.style.display).toBe('none');
	});

	test('権限取消しで中断し、再許可後の新しい統計を古い応答で上書きしない', async () => {
		const oldStats = deferred<unknown>();
		const oldActivity = deferred<unknown>();
		mocks.api.mockImplementation(endpoint => endpoint === 'stats' ? oldStats.promise : oldActivity.promise);
		const item = mount();
		await flush();
		expect(mocks.api).toHaveBeenCalledTimes(2);
		const oldSignals = mocks.api.mock.calls.map(call => call[3]);
		expect(oldSignals.every(signal => !signal.aborted)).toBe(true);
		instance.clientOptions.showActivitiesForVisitor = false;
		await flush();
		expect(oldSignals.every(signal => signal.aborted)).toBe(true);
		expect(item.container.querySelector('[data-activity-average]')).toBeNull();
		mocks.api.mockImplementation(endpoint => Promise.resolve(endpoint === 'stats' ? { originalUsersCount: 101 } : { read: [900, 14, 12, 10, 8, 6, 4, 2] }));
		instance.clientOptions.showActivitiesForVisitor = true;
		await flush();
		expect(mocks.api).toHaveBeenCalledTimes(4);
		expect(mocks.api.mock.calls[2][3].aborted).toBe(false);
		expect(item.container.querySelector('[data-activity-members]')?.textContent).toBe('101');
		expect(item.container.querySelector('[data-activity-average]')?.textContent).toBe('8');
		// This mock deliberately resolves despite abort, exercising the stale-response guard.
		oldStats.resolve(statsFixture());
		oldActivity.resolve(activityFixture());
		await flush();
		expect(item.container.querySelector('[data-activity-members]')?.textContent).toBe('101');
		expect(item.container.querySelector('[data-activity-average]')?.textContent).toBe('8');
	});

	test('unmountで両リクエストを中断し、遅い応答を無視してResizeObserverも解除する', async () => {
		const stats = deferred<unknown>();
		const activity = deferred<unknown>();
		mocks.api.mockImplementation(endpoint => endpoint === 'stats' ? stats.promise : activity.promise);
		const item = mount();
		await flush();
		const signals = mocks.api.mock.calls.map(call => call[3]);
		expect(signals).toHaveLength(2);
		expect(signals.every(signal => !signal.aborted)).toBe(true);
		expect(item.observer.observe).toHaveBeenCalledWith(item.container.querySelector('[data-welcome-activity]'));
		expect(item.observer.observe).toHaveBeenCalledWith(item.container);
		item.onResize.mockClear();
		item.unmount();
		expect(signals.every(signal => signal.aborted)).toBe(true);
		expect(item.observer.disconnect).toHaveBeenCalledOnce();
		stats.resolve(statsFixture());
		activity.resolve(activityFixture());
		await flush();
		expect(item.onResize).not.toHaveBeenCalled();
		expect(item.container.querySelector('[data-activity-members]')).toBeNull();
		expect(item.container.querySelector('[data-activity-average]')).toBeNull();
	});
});
