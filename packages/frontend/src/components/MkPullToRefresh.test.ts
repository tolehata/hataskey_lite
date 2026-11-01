/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
vi.mock('@/i18n.js', () => ({ i18n: { ts: { pullDownToRefresh: '引っ張って更新', releaseToRefresh: '離して更新', refreshing: '更新中' } } }));
vi.mock('@/utility/touch.js', async () => ({ isHorizontalSwipeSwiping: (await import('vue')).ref(false) }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
import MkPullToRefresh from './MkPullToRefresh.vue';
import { isHorizontalSwipeSwiping } from '@/utility/touch.js';
import { createNavbarPullRefresh, navbarPullRefreshKey } from '@/utility/navbar-pull-refresh.js';

const cleanups: Array<() => void> = [];

async function settle() { await nextTick(); await Promise.resolve(); await nextTick(); }

function touch(target: EventTarget, type: string, x: number, y: number) {
	const event = new Event(type, { bubbles: true });
	Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [{ screenX: x, screenY: y, identifier: 1 }] });
	target.dispatchEvent(event);
}

function mount(refresher = vi.fn().mockResolvedValue(undefined), context?: ReturnType<typeof createNavbarPullRefresh>) {
	const scroller = window.document.createElement('main');
	scroller.style.overflowY = 'auto';
	window.document.body.append(scroller);
	const onRefresh = vi.fn();
	const app = createApp({ render: () => h(MkPullToRefresh, { refresher, onRefresh }, () => h('p', '既存の一覧')) });
	if (context) app.provide(navbarPullRefreshKey, context);
	app.component('MkLoading', { template: '<span>更新中</span>' });
	app.mount(scroller);
	let active = true;
	const unmount = () => { if (active) app.unmount(); active = false; scroller.remove(); };
	cleanups.push(unmount);
	return { scroller, root: scroller.firstElementChild as HTMLElement, refresher, onRefresh, unmount };
}

beforeEach(() => { vi.useFakeTimers(); isHorizontalSwipeSwiping.value = false; });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

test('a navbar host receives pull feedback without mounting the legacy list indicator', async () => {
	const context = createNavbarPullRefresh(ref(true), ref(false));
	cleanups.push(context.dispose);
	const { root, refresher, onRefresh } = mount(undefined, context);
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 140);
	await settle();
	expect(context.state.value.phase).toBe('ready');
	expect(root.textContent).toBe('既存の一覧');
	touch(window, 'touchend', 0, 140);
	await vi.advanceTimersByTimeAsync(250);
	expect(refresher).toHaveBeenCalledOnce();
	expect(onRefresh).toHaveBeenCalledOnce();
	expect(context.active.value).toBe(false);
});

test('a disabled navbar context never starts the legacy touch or mouse pull', async () => {
	const context = createNavbarPullRefresh(ref(false), ref(false));
	cleanups.push(context.dispose);
	const { root, refresher, onRefresh } = mount(undefined, context);
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 240);
	root.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true }));
	window.dispatchEvent(new MouseEvent('mousemove', { screenY: 240 }));
	await settle();
	expect(root.textContent).toBe('既存の一覧');
	expect(context.state.value.phase).toBe('idle');
	touch(window, 'touchend', 0, 240);
	window.dispatchEvent(new MouseEvent('mouseup'));
	await vi.advanceTimersByTimeAsync(250);
	expect(refresher).not.toHaveBeenCalled();
	expect(onRefresh).not.toHaveBeenCalled();
});

test('a navbar context uses its refresher and waits for it before finishing', async () => {
	let finish!: () => void;
	const contextRefresher = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
	const context = createNavbarPullRefresh(ref(true), ref(false), { refresher: contextRefresher });
	cleanups.push(context.dispose);
	const { root, refresher, onRefresh } = mount(undefined, context);
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 140);
	touch(window, 'touchend', 0, 140);
	await vi.advanceTimersByTimeAsync(250);
	expect(contextRefresher).toHaveBeenCalledOnce();
	expect(refresher).not.toHaveBeenCalled();
	expect(onRefresh).toHaveBeenCalledOnce();
	expect(context.active.value).toBe(true);
	finish();
	await vi.advanceTimersByTimeAsync(1);
	expect(context.active.value).toBe(false);
});

test('keeps standard threshold feedback, awaits refresh and prevents duplicate touch fetches', async () => {
	let finish!: () => void;
	const { root, refresher, onRefresh } = mount(vi.fn(() => new Promise<void>(resolve => { finish = resolve; })));
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 199);
	await settle();
	expect(root.textContent).toContain('引っ張って更新');
	touch(window, 'touchmove', 0, 200);
	await settle();
	expect(root.textContent).toContain('離して更新');
	touch(window, 'touchend', 0, 200);
	await settle();
	expect(refresher).toHaveBeenCalledOnce();
	expect(onRefresh).toHaveBeenCalledOnce();
	expect(root.textContent).toContain('更新中');
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 240);
	touch(window, 'touchend', 0, 240);
	expect(refresher).toHaveBeenCalledOnce();
	finish();
	await settle();
	await vi.advanceTimersByTimeAsync(220);
	expect(root.textContent).toBe('既存の一覧');
});

test('preserves middle-button dragging and ignores ordinary mouse selection', async () => {
	const { root, refresher } = mount();
	for (const button of [0, 1]) {
		root.dispatchEvent(new MouseEvent('mousedown', { button, screenX: 5, screenY: 0, bubbles: true, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenX: 5, screenY: 200 }));
		window.dispatchEvent(new MouseEvent('mouseup'));
		await settle();
		expect(refresher).toHaveBeenCalledTimes(button);
	}
	await vi.advanceTimersByTimeAsync(220);
	expect(root.textContent).toBe('既存の一覧');
});

test.each(['horizontal', 'cancel', 'swiper', 'scrolled'])('cancels %s permanently for this gesture without a late release refreshing', async reason => {
	const { root, scroller, refresher } = mount();
	const remove = vi.spyOn(window, 'removeEventListener');
	touch(root, 'touchstart', 0, 0);
	if (reason === 'swiper') isHorizontalSwipeSwiping.value = true;
	if (reason === 'scrolled') scroller.scrollTop = 40;
	touch(window, 'touchmove', reason === 'horizontal' ? 280 : 0, 210);
	if (reason === 'cancel') touch(window, 'touchcancel', 0, 210);
	// A later vertical movement must not re-arm a rejected gesture.
	touch(window, 'touchmove', 0, 300);
	touch(window, 'touchend', 0, 300);
	await vi.advanceTimersByTimeAsync(450);
	expect(refresher).not.toHaveBeenCalled();
	expect(root.textContent).toBe('既存の一覧');
	for (const type of ['touchmove', 'touchend', 'touchcancel']) expect(remove).toHaveBeenCalledWith(type, expect.any(Function));
});

test.each(['touch', 'mouse', 'released'])('unmount removes %s listeners and pending release work', async gesture => {
	const { root, unmount, refresher } = mount();
	const remove = vi.spyOn(window, 'removeEventListener');
	if (gesture === 'mouse') {
		root.dispatchEvent(new MouseEvent('mousedown', { button: 1, screenY: 0, bubbles: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 250 }));
	} else {
		touch(root, 'touchstart', 0, 0);
		touch(window, 'touchmove', 0, 250);
		if (gesture === 'released') touch(window, 'touchend', 0, 250);
	}
	unmount();
	touch(window, 'touchend', 0, 250);
	window.dispatchEvent(new MouseEvent('mouseup'));
	await vi.advanceTimersByTimeAsync(450);
	expect(refresher).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
	for (const type of ['touchmove', 'touchend', 'touchcancel', 'mousemove', 'mouseup']) expect(remove).toHaveBeenCalledWith(type, expect.any(Function));
});
