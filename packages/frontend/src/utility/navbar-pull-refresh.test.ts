/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ref } from 'vue';
vi.mock('@/utility/touch.js', async () => ({ isHorizontalSwipeSwiping: (await import('vue')).ref(false) }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
import { attachNavbarPullGesture, createNavbarPullRefresh } from './navbar-pull-refresh.js';
import { isHorizontalSwipeSwiping } from '@/utility/touch.js';
import { haptic } from '@/utility/haptic.js';

const cleanup: (() => void)[] = [];

function touch(target: EventTarget, type: string, x: number, y: number, count = 1) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'touches', { value: Array.from({ length: count }, () => ({ screenX: x, screenY: y })) });
	target.dispatchEvent(event);
	return event;
}

function setup(refresh = vi.fn().mockResolvedValue(undefined), motion = false, options: Parameters<typeof createNavbarPullRefresh>[2] = {}, direction: 'down' | 'up' = 'down') {
	const enabled = ref(true);
	const context = createNavbarPullRefresh(enabled, ref(motion), options);
	const root = window.document.createElement('main');
	window.document.body.append(root);
	const gesture = attachNavbarPullGesture(root, root, context, refresh, { direction });
	cleanup.push(() => { gesture.dispose(); context.dispose(); root.remove(); });
	return { root, context, enabled, gesture, refresh };
}

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); isHorizontalSwipeSwiping.value = false; });
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

test.each(['down', 'up'] as const)('fixes presentation at the start of a %s gesture and samples it again for the next gesture', async direction => {
	let destination: 'navbar' | 'dock' = 'navbar';
	const presentation = vi.fn(() => destination);
	const { root, context } = setup(undefined, false, { presentation }, direction);
	const endY = direction === 'down' ? 380 : 20;
	touch(root, 'touchstart', 0, 200);
	destination = 'dock';
	touch(window, 'touchmove', 0, endY);
	expect(presentation).toHaveBeenCalledExactlyOnceWith(direction);
	expect(context.state.value.presentation).toBe('navbar');
	touch(window, 'touchend', 0, endY, 0);
	expect(context.state.value.presentation).toBe('navbar');
	await vi.advanceTimersByTimeAsync(250);
	touch(root, 'touchstart', 0, 200);
	touch(window, 'touchmove', 0, endY);
	expect(presentation).toHaveBeenCalledTimes(2);
	expect(context.state.value.presentation).toBe('dock');
});

test.each(['success', 'error'] as const)('holds feedback at 56px during the request, then shows %s for 650ms before returning', async result => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const refresh = vi.fn(() => new Promise<void>((done, fail) => { resolve = done; reject = fail; }));
	const { root, context } = setup(refresh, false, { feedback: () => true });
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 180);
	touch(window, 'touchend', 0, 180, 0);
	await vi.advanceTimersByTimeAsync(250);
	expect(refresh).toHaveBeenCalledOnce();
	expect(context.pending.value).toBe(true);
	expect(context.state.value).toMatchObject({ phase: 'refreshing', height: 56 });
	await vi.advanceTimersByTimeAsync(800);
	expect(context.state.value).toMatchObject({ phase: 'refreshing', height: 56 });
	if (result === 'success') resolve();
	else reject(new Error('offline'));
	await vi.advanceTimersByTimeAsync(0);
	expect(context.pending.value).toBe(false);
	expect(context.state.value).toMatchObject({ phase: result, height: 56 });
	await vi.advanceTimersByTimeAsync(649);
	expect(context.state.value).toMatchObject({ phase: result, height: 56 });
	// Allow the first animation frame after the 650ms result timer.
	await vi.advanceTimersByTimeAsync(20);
	expect(context.state.value.phase).toBe('returning');
	expect(context.state.value.height).toBeGreaterThan(0);
	expect(context.state.value.height).toBeLessThan(56);
	await vi.advanceTimersByTimeAsync(200);
	expect(context.state.value).toMatchObject({ phase: 'idle', height: 0 });
});

test('reset retains the pending request lock and permits another refresh only after resolution', async () => {
	let finish!: () => void;
	const refresh = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; })).mockResolvedValue(undefined);
	const { root, context } = setup(refresh);
	const pull = () => {
		touch(root, 'touchstart', 0, 0);
		touch(window, 'touchmove', 0, 180);
		touch(window, 'touchend', 0, 180, 0);
	};
	pull();
	await vi.advanceTimersByTimeAsync(250);
	expect(refresh).toHaveBeenCalledOnce();
	context.reset();
	expect(context.active.value).toBe(false);
	expect(context.pending.value).toBe(true);
	pull();
	await vi.advanceTimersByTimeAsync(250);
	expect(refresh).toHaveBeenCalledOnce();
	expect(context.state.value.phase).toBe('idle');
	finish();
	await vi.advanceTimersByTimeAsync(0);
	expect(context.pending.value).toBe(false);
	expect(context.state.value.phase).toBe('idle');
	pull();
	await vi.advanceTimersByTimeAsync(250);
	expect(refresh).toHaveBeenCalledTimes(2);
	expect(context.active.value).toBe(false);
});

test('replaces navigation gradually, refreshes once and restores while the request is pending', async () => {
	let finish!: () => void;
	const { root, context, refresh } = setup(vi.fn(() => new Promise<void>(resolve => { finish = resolve; })));
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 40);
	expect(context.state.value.phase).toBe('pulling');
	expect(Number(context.style.value['--navbar-pull-nav-opacity'])).toBeGreaterThan(0);
	touch(window, 'touchmove', 0, 180);
	expect(context.state.value.phase).toBe('ready');
	expect(context.state.value.height).toBeLessThan(110);
	expect(context.style.value['--navbar-pull-nav-opacity']).toBe('0');
	touch(window, 'touchend', 0, 180, 0);
	await vi.advanceTimersByTimeAsync(250);
	expect(refresh).toHaveBeenCalledOnce();
	expect(context.state.value.phase).toBe('refreshing');
	expect(context.state.value.height).toBe(0);
	expect(context.style.value['--navbar-pull-nav-opacity']).toBe('1');
	touch(root, 'touchstart', 0, 0);
	touch(window, 'touchmove', 0, 200);
	touch(window, 'touchend', 0, 200, 0);
	expect(refresh).toHaveBeenCalledOnce();
	finish();
	await vi.advanceTimersByTimeAsync(1);
	expect(context.active.value).toBe(false);
});

test.each(['short', 'horizontal', 'multi', 'cancel', 'scroll', 'tabSwipe', 'disabled'])('does not refresh after %s cancellation', async reason => {
	const { root, context, enabled, refresh } = setup();
	touch(root, 'touchstart', 0, 0);
	if (reason === 'scroll') root.scrollTop = 30;
	if (reason === 'tabSwipe') isHorizontalSwipeSwiping.value = true;
	if (reason === 'disabled') enabled.value = false;
	touch(window, 'touchmove', reason === 'horizontal' ? 250 : 0, reason === 'short' ? 60 : 180, reason === 'multi' ? 2 : 1);
	if (reason === 'cancel') touch(window, 'touchcancel', 0, 180, 0);
	touch(window, 'touchend', 0, 180, 0);
	await vi.advanceTimersByTimeAsync(1200);
	expect(refresh).not.toHaveBeenCalled();
	expect(context.active.value).toBe(false);
});

test('springs back without repeated bouncing and haptics only at the threshold crossing', async () => {
	const { root, context } = setup(undefined, true);
	touch(root, 'touchstart', 0, 0);
	for (const distance of [120, 140, 180, 200]) touch(window, 'touchmove', 0, distance);
	expect(haptic).toHaveBeenCalledOnce();
	touch(window, 'touchend', 0, 200, 0);
	let previous = context.state.value.height;
	for (let i = 0; i < 75; i++) {
		await vi.advanceTimersByTimeAsync(16);
		expect(context.state.value.height).toBeLessThanOrEqual(previous);
		previous = context.state.value.height;
	}
	expect(context.active.value).toBe(false);
});

test('a rejected request releases the navbar and a disposed request cannot restore stale state', async () => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const rejected = setup(vi.fn().mockRejectedValue(new Error('offline')));
	touch(rejected.root, 'touchstart', 0, 0); touch(window, 'touchmove', 0, 180); touch(window, 'touchend', 0, 180, 0);
	await vi.advanceTimersByTimeAsync(250);
	expect(rejected.context.active.value).toBe(false);
	const pending = setup();
	touch(pending.root, 'touchstart', 0, 0); touch(window, 'touchmove', 0, 180); touch(window, 'touchend', 0, 180, 0);
	pending.gesture.dispose();
	await vi.advanceTimersByTimeAsync(250);
	expect(pending.refresh).not.toHaveBeenCalled();
	expect(pending.context.active.value).toBe(false);
});

test('ignores form controls and ordinary mouse selection, while preserving middle-button pull', async () => {
	const { root, refresh } = setup();
	const button = window.document.createElement('button'); root.append(button);
	touch(button, 'touchstart', 0, 0); touch(window, 'touchmove', 0, 180); touch(window, 'touchend', 0, 180, 0);
	for (const mouseButton of [0, 1]) {
		root.dispatchEvent(new MouseEvent('mousedown', { button: mouseButton, screenY: 0, bubbles: true, cancelable: true }));
		window.dispatchEvent(new MouseEvent('mousemove', { screenY: 180 }));
		window.dispatchEvent(new MouseEvent('mouseup'));
		await vi.advanceTimersByTimeAsync(250);
		expect(refresh).toHaveBeenCalledTimes(mouseButton);
	}
});

test('the upward dock gesture shares ownership with the list and preserves ordinary taps', async () => {
	const { root, context, refresh } = setup();
	const dock = window.document.createElement('nav');
	const home = window.document.createElement('button');
	dock.append(home); root.append(dock);
	const tap = vi.fn(); home.addEventListener('click', tap);
	const claim = vi.fn();
	const gesture = attachNavbarPullGesture(dock, root, context, refresh, { direction: 'up', onClaim: claim });
	cleanup.push(gesture.dispose);
	root.scrollTop = 500;
	touch(home, 'touchstart', 20, 600); touch(window, 'touchend', 20, 600, 0);
	home.click(); expect(tap).toHaveBeenCalledOnce();
	touch(home, 'touchstart', 20, 600); touch(window, 'touchmove', 20, 430);
	expect(context.state.value.phase).toBe('ready'); expect(claim).toHaveBeenCalledOnce();
	// A second surface cannot steal this gesture or start a second request.
	root.scrollTop = 0;
	touch(root, 'touchstart', 20, 100);
	touch(window, 'touchend', 20, 430, 0);
	home.click(); expect(tap).toHaveBeenCalledOnce();
	await vi.advanceTimersByTimeAsync(250);
	expect(refresh).toHaveBeenCalledOnce(); expect(context.active.value).toBe(false);
});

test.each(['down', 'horizontal', 'short', 'cancel', 'multi', 'overlay', 'resize'])('cancels upward dock refresh on %s', async reason => {
	const { root, context, refresh } = setup();
	let allowed = true;
	const dock = window.document.createElement('nav'); root.append(dock);
	const gesture = attachNavbarPullGesture(dock, root, context, refresh, { direction: 'up', canStart: () => allowed });
	cleanup.push(gesture.dispose);
	root.scrollTop = 50;
	touch(dock, 'touchstart', 20, 600);
	if (reason === 'overlay') allowed = false;
	touch(window, 'touchmove', reason === 'horizontal' ? 260 : 20, reason === 'down' ? 760 : reason === 'short' ? 550 : 430, reason === 'multi' ? 2 : 1);
	if (reason === 'cancel') touch(window, 'touchcancel', 20, 430, 0);
	if (reason === 'resize') window.dispatchEvent(new Event('resize'));
	touch(window, 'touchend', 20, 430, 0);
	await vi.advanceTimersByTimeAsync(1200);
	expect(refresh).not.toHaveBeenCalled(); expect(context.active.value).toBe(false);
});
