/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import MkNavbarLoadingRing from './MkNavbarLoadingRing.vue';

vi.mock('@/i18n.js', () => ({ i18n: { ts: { loading: 'Loading' } } }));

const cleanups: (() => void)[] = [];
const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
let documentHidden = false;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
	documentHidden = false;
	observers.length = 0;
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => documentHidden);
	vi.stubGlobal('ResizeObserver', class {
		disconnect = vi.fn();
		observe = vi.fn();
		constructor(callback: ResizeObserverCallback) { observers.push({ callback, disconnect: this.disconnect }); }
	});
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function mount(motion = true) {
	const target = window.document.createElement('div');
	const host = window.document.createElement('div');
	target.style.borderRadius = '24px';
	let width = 340;
	let height = 48;
	Object.defineProperties(target, { clientWidth: { get: () => width }, clientHeight: { get: () => height } });
	window.document.body.append(target, host);
	const props = ref({ target: target as HTMLElement | null, active: true, motion });
	const visible: boolean[] = [];
	const app = createApp({ render: () => h(MkNavbarLoadingRing, { ...props.value, onVisibleChange: value => visible.push(value) }) });
	app.mount(host);
	let mounted = true;

	function unmount() { if (mounted) app.unmount(); mounted = false; }

	cleanups.push(() => { unmount(); target.remove(); host.remove(); });
	return {
		props, target, visible, unmount,
		ring: () => target.querySelector<SVGElement>('[data-navbar-loading-ring]')!,
		resize: (nextWidth: number, nextHeight: number) => { width = nextWidth; height = nextHeight; observers[0].callback([], {} as ResizeObserver); },
	};
}

async function advance(duration: number) {
	await vi.advanceTimersByTimeAsync(duration);
	await nextTick();
}

describe('integrated navbar loading ring', () => {
	it('never reveals requests shorter than 200ms', async () => {
		const scheduled = vi.spyOn(window, 'setTimeout');
		const cleared = vi.spyOn(window, 'clearTimeout');
		const view = mount();
		const revealTimers = scheduled.mock.calls.flatMap(([, duration], index) => duration === 200 ? [scheduled.mock.results[index].value] : []);
		expect(revealTimers).toHaveLength(1);
		await advance(199);
		view.props.value.active = false;
		await nextTick();
		expect(cleared).toHaveBeenCalledWith(revealTimers[0]);
		await advance(1000);
		expect(view.ring().dataset.active).toBe('false');
		expect(view.visible).toEqual([]);
		expect(scheduled.mock.calls.filter(([, duration]) => duration === 500 || duration === 250)).toHaveLength(0);
	});
	it('keeps consecutive pending requests visible while the aggregate remains active', async () => {
		const view = mount();
		await advance(200);
		expect(view.visible).toEqual([true]);
		await advance(6000);
		expect(view.ring().dataset.visible).toBe('true');
		expect(view.visible).toEqual([true]);
	});
	it('holds for 500ms after appearing and runs the animation through the 250ms fade', async () => {
		const view = mount();
		await advance(200);
		view.props.value.active = false;
		await nextTick();
		await advance(499);
		expect(view.ring().dataset.visible).toBe('true');
		await advance(1);
		expect(view.ring().dataset.visible).toBe('false');
		expect(view.ring().dataset.active).toBe('true');
		expect(view.visible).toEqual([true]);
		await advance(250);
		expect(view.ring().dataset.active).toBe('false');
		expect(view.visible).toEqual([true, false]);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('cancels an old fade when pending work resumes', async () => {
		const view = mount();
		await advance(200);
		view.props.value.active = false;
		await nextTick();
		await advance(600);
		expect(view.ring().dataset.visible).toBe('false');
		view.props.value.active = true;
		await nextTick();
		expect(view.ring().dataset.visible).toBe('true');
		await advance(500);
		expect(view.visible).toEqual([true]);
		expect(view.ring().dataset.active).toBe('true');
	});
	it('follows target resizing and uses explicit px endpoints for continuous stroke interpolation', async () => {
		const view = mount();
		expect(view.ring().getAttribute('viewBox')).toBe('0 0 340 48');
		const rectangles = view.ring().querySelectorAll('rect');
		expect(rectangles).toHaveLength(32);
		expect(rectangles[0].style.getPropertyValue('--phase')).toBe('27px');
		expect(rectangles[0].style.getPropertyValue('--phase-end')).toBe('-73px');
		expect(rectangles[0].getAttribute('pathLength')).toBe('100');
		view.resize(410, 96);
		await nextTick();
		expect(view.ring().getAttribute('viewBox')).toBe('0 0 410 96');
		expect(rectangles[0].getAttribute('height')).toBe('94');
		expect(rectangles[0].getAttribute('rx')).toBe('23');
	});
	it('pauses while hidden and resumes even when visibility changes before reveal', async () => {
		const view = mount();
		documentHidden = true;
		window.document.dispatchEvent(new Event('visibilitychange'));
		await advance(100);
		documentHidden = false;
		window.document.dispatchEvent(new Event('visibilitychange'));
		await advance(100);
		expect(view.ring().dataset.paused).toBe('false');
		documentHidden = true;
		window.document.dispatchEvent(new Event('visibilitychange'));
		await nextTick();
		expect(view.ring().dataset.paused).toBe('true');
	});
	it('uses a static frame and finishes without a fade in reduced motion', async () => {
		const view = mount(false);
		await advance(200);
		expect(view.ring().querySelectorAll('rect')).toHaveLength(1);
		expect(view.ring().querySelector('rect')?.style.getPropertyValue('--phase')).toBe('');
		view.props.value.active = false;
		await nextTick();
		await advance(499);
		expect(view.visible).toEqual([true]);
		await advance(1);
		expect(view.visible).toEqual([true, false]);
	});
	it('cleans timers, observers and the visibility listener on unmount', async () => {
		const removed = vi.spyOn(window.document, 'removeEventListener');
		const view = mount();
		await advance(200);
		view.props.value.active = false;
		await nextTick();
		view.unmount();
		expect(view.visible).toEqual([true, false]);
		expect(observers[0].disconnect).toHaveBeenCalledOnce();
		expect(removed.mock.calls.some(([name]) => name === 'visibilitychange')).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
		expect(view.target.querySelector('[data-navbar-loading-ring]')).toBeNull();
	});
});
