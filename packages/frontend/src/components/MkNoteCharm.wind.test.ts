/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkNoteCharm from './MkNoteCharm.vue';
import { prefer } from '@/preferences.js';
import * as charmPhysics from '@/utility/note-charm-physics.js';

vi.mock('@@/js/config.js', () => ({ ui: 'default' }));

vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(true) } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _noteCharm: { lift: '持ち上げる', lower: '下ろす' } } } }));
vi.mock('@/utility/media-proxy.js', () => ({ getStaticImageUrl: (url: string) => `${url}?static` }));
vi.mock('@/utility/note-charm-image-cache.js', () => ({ acquireNoteCharmImage: async (url: string) => ({ url, release: () => {} }) }));
// Isolate wind scheduling from image-network deadlines, tested by artwork tests.
vi.mock('@/utility/note-charm-artwork.js', async importOriginal => {
	const original = await importOriginal<typeof import('@/utility/note-charm-artwork.js')>();
	return { ...original, loadCharmArtwork: async (_url: string, size: number, pattern: 'cutout') => original.createCharmArtwork(size, pattern) };
});

const cleanup: (() => void)[] = [];
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let focused = true;
let hidden = false;
let reduced: MediaQueryList;
const intersections = new Map<Element, IntersectionObserverCallback>();
// Sample a moving charm after the first gust starts, regardless of gust duration.
const firstGustActiveAt = 3000 + charmPhysics.CHARM_WIND_DURATION * 1000 * .65;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
	frames.clear();
	intersections.clear();
	frameId = 0;
	focused = true;
	hidden = false;
	prefer.r.animation.value = true;
	vi.spyOn(window.document, 'hasFocus').mockImplementation(() => focused);
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
	reduced = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
	vi.spyOn(window, 'matchMedia').mockImplementation(query => query.includes('reduced-motion') ? reduced : Object.assign(new EventTarget(), { matches: false }) as MediaQueryList);
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('IntersectionObserver', class {
		constructor(private callback: IntersectionObserverCallback) {}
		observe(element: Element) { intersections.set(element, this.callback); }
		disconnect() {}
	});
});

afterEach(() => {
	cleanup.splice(0).forEach(dispose => dispose());
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function mountCharm(parent = window.document.body) {
	const props = reactive({ charm: { url: '/charm.png', size: 60, pattern: 'cutout' as const, color: '#6ba5e3' }, motion: true, wind: true });
	let rect = new DOMRect(100, 100, 500, 200);
	const container = window.document.createElement('div');
	container.getBoundingClientRect = () => rect;
	parent.append(container);
	const app = createApp({ render: () => h(MkNoteCharm, props) });
	app.mount(container);
	const buttons = window.document.querySelectorAll<HTMLButtonElement>('[data-note-charm] button');
	const button = buttons[buttons.length - 1];
	const angle = () => Number(button.parentElement!.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1]);
	let mounted = true;
	const unmount = () => { if (mounted) { app.unmount(); container.remove(); mounted = false; } };
	cleanup.push(unmount);
	await nextTick();
	return { props, container, button, angle, unmount, move: (value: DOMRect) => { rect = value; } };
}

async function advance(milliseconds: number, sample: () => void = () => {}, frameMilliseconds = 16) {
	for (let elapsed = 0; elapsed < milliseconds; elapsed += frameMilliseconds) {
		vi.advanceTimersByTime(Math.min(frameMilliseconds, milliseconds - elapsed));
		for (const [id, callback] of [...frames]) { frames.delete(id); callback(performance.now()); }
		await nextTick();
		sample();
	}
}

describe('periodic note charm wind', () => {
	test.each(['pointerup', 'pointercancel', 'lostpointercapture', 'keyboard'])('%s lowers a held charm within 200ms without changing ambient motion', async ending => {
		const charm = await mountCharm();
		charm.props.wind = false;
		await nextTick();
		const y = () => Number(charm.button.parentElement!.style.transform.match(/translate\([^,]+, ([-\d.]+)px\)/)![1]);
		const restingY = y();
		const key = () => charm.button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
		const pointer = (type: string, clientY: number) => {
			const event = new Event(type, { bubbles: true, cancelable: true });
			Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch', clientX: 650, clientY });
			charm.button.dispatchEvent(event);
		};
		charm.button.setPointerCapture = () => {};
		charm.button.hasPointerCapture = () => true;
		charm.button.releasePointerCapture = () => {};
		if (ending === 'keyboard') key();
		else { pointer('pointerdown', 200); pointer('pointermove', 140); }
		await advance(16);
		expect(y()).toBeLessThan(restingY - 25);
		if (ending === 'keyboard') key(); else pointer(ending, 140);
		await advance(200);
		expect(charm.button.getAttribute('aria-pressed')).toBe('false');
		expect(Math.abs(y() - restingY)).toBeLessThan(1);
		await advance(2000);
		expect(frames.size).toBe(0);
	});

	test('a gust stops applying force after its duration even at 15 frames per second', async () => {
		const force = vi.spyOn(charmPhysics, 'charmWindForce');
		const charm = await mountCharm();
		let peak = 0;
		await advance(6000, () => { peak = Math.max(peak, Math.abs(charm.angle())); }, 1000 / 15);
		expect(peak).toBeGreaterThan(.5);
		const samples = force.mock.calls.length;
		expect(samples).toBeGreaterThan(1);
		await advance(500, () => {}, 1000 / 15);
		expect(force).toHaveBeenCalledTimes(samples);
		await advance(2000, () => {}, 1000 / 15);
		expect(charm.angle()).toBe(0);
		expect(frames.size).toBe(0);
	});

	test('a resting charm sways gently without scrolling, rests between gusts, and sways again', async () => {
		const charm = await mountCharm();
		await advance(2800);
		expect(charm.angle()).toBe(0);
		expect(frames.size).toBe(0);
		let peak = 0;
		await advance(4000, () => { peak = Math.max(peak, Math.abs(charm.angle())); });
		expect(peak).toBeGreaterThan(.5);
		expect(peak).toBeLessThan(8.1);
		await advance(5000);
		expect(charm.angle()).toBe(0);
		expect(frames.size).toBe(0);
		peak = 0;
		await advance(10000, () => { peak = Math.max(peak, Math.abs(charm.angle())); });
		expect(peak).toBeGreaterThan(.5);
	});

	test('wind off preserves current inertia, then sleeps, while scroll still moves the charm', async () => {
		const charm = await mountCharm();
		await advance(firstGustActiveAt);
		const angle = charm.angle();
		expect(Math.abs(angle)).toBeGreaterThan(.5);
		charm.props.wind = false;
		await nextTick();
		expect(charm.angle()).toBe(angle);
		expect(vi.getTimerCount()).toBe(0);
		await advance(20000);
		expect(charm.angle()).toBe(0);
		expect(frames.size).toBe(0);
		charm.container.scrollTop = 90;
		charm.container.dispatchEvent(new Event('scroll'));
		await advance(160);
		expect(charm.button.parentElement!.style.transform).not.toMatch(/NaN|Infinity/);
	});

	test.each(['motion', 'animation', 'reduced'] as const)('%s stops wind and releases its timer', async gate => {
		const charm = await mountCharm();
		await advance(firstGustActiveAt);
		expect(Math.abs(charm.angle())).toBeGreaterThan(.5);
		if (gate === 'motion') charm.props.motion = false;
		else if (gate === 'animation') prefer.r.animation.value = false;
		else { Object.assign(reduced, { matches: true }); reduced.dispatchEvent(new Event('change')); }
		await nextTick();
		await advance(20000);
		expect(charm.angle()).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		expect(frames.size).toBe(0);
	});

	test.each(['hidden', 'blur', 'offscreen', 'outside'] as const)('%s pauses wind without replaying an old gust on return', async gate => {
		const charm = await mountCharm();
		await advance(firstGustActiveAt);
		expect(Math.abs(charm.angle())).toBeGreaterThan(.5);
		if (gate === 'hidden') {
			hidden = true;
			window.document.dispatchEvent(new Event('visibilitychange'));
		} else if (gate === 'blur') {
			focused = false;
			window.dispatchEvent(new Event('blur'));
		} else if (gate === 'offscreen') {
			intersections.get(charm.container)!([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver);
		} else {
			charm.move(new DOMRect(window.innerWidth + 10, 100, 500, 200));
			window.dispatchEvent(new Event('resize'));
		}
		await advance(20000);
		expect(vi.getTimerCount()).toBe(0);
		expect(frames.size).toBe(0);
		if (gate === 'hidden') {
			hidden = false;
			window.document.dispatchEvent(new Event('visibilitychange'));
		} else if (gate === 'blur') {
			focused = true;
			window.dispatchEvent(new Event('focus'));
		} else if (gate === 'offscreen') {
			intersections.get(charm.container)!([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver);
		} else {
			charm.move(new DOMRect(100, 100, 500, 200));
			window.dispatchEvent(new Event('resize'));
		}
		await advance(1000);
		expect(charm.angle()).toBe(0);
		await advance(firstGustActiveAt - 1000);
		expect(Math.abs(charm.angle())).toBeGreaterThan(.5);
	});

	test('initially unfocused pages wait for focus before starting wind', async () => {
		focused = false;
		const charm = await mountCharm();
		await advance(20000);
		expect(charm.angle()).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		focused = true;
		window.dispatchEvent(new Event('focus'));
		await advance(firstGustActiveAt);
		expect(Math.abs(charm.angle())).toBeGreaterThan(.5);
	});

	test('multiple charms share scheduling and removing one keeps the other moving', async () => {
		const first = await mountCharm();
		const second = await mountCharm();
		expect(vi.getTimerCount()).toBe(1);
		await advance(firstGustActiveAt);
		expect(Math.abs(first.angle())).toBeGreaterThan(.5);
		expect(Math.abs(second.angle())).toBeGreaterThan(.5);
		expect(frames.size).toBe(1);
		first.unmount();
		expect(vi.getTimerCount()).toBe(1);
		second.unmount();
		expect(vi.getTimerCount()).toBe(0);
		expect(frames.size).toBe(0);
	});

	test('holding a charm suspends wind until it is lowered', async () => {
		const charm = await mountCharm();
		await advance(firstGustActiveAt);
		charm.button.click();
		await nextTick();
		const heldPose = charm.button.parentElement!.style.transform;
		await advance(20000);
		expect(charm.button.getAttribute('aria-pressed')).toBe('true');
		expect(charm.button.parentElement!.style.transform).toBe(heldPose);
		expect(vi.getTimerCount()).toBe(0);
		charm.button.click();
		await advance(firstGustActiveAt);
		expect(charm.button.getAttribute('aria-pressed')).toBe('false');
		expect(Math.abs(charm.angle())).toBeGreaterThan(.5);
	});

	test('a clipped region with no remaining height does not schedule wind', async () => {
		const outer = window.document.createElement('section');
		const inner = window.document.createElement('section');
		outer.style.overflowY = inner.style.overflowY = 'hidden';
		outer.getBoundingClientRect = () => new DOMRect(0, 400, 900, 100);
		inner.getBoundingClientRect = () => new DOMRect(0, 200, 900, 100);
		window.document.body.append(outer);
		outer.append(inner);
		cleanup.push(() => outer.remove());
		const charm = await mountCharm(inner);
		charm.move(new DOMRect(100, 248, 500, 200));
		window.dispatchEvent(new Event('resize'));
		await advance(20000);
		expect(charm.angle()).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		expect(charm.button.closest<HTMLElement>('[data-note-charm-layer]')?.style.visibility).toBe('hidden');
	});

	test('position updates do not postpone the first gust', async () => {
		const charm = await mountCharm();
		for (let elapsed = 0; elapsed < firstGustActiveAt; elapsed += 100) {
			// A scroll event with zero displacement only repositions the portal.
			charm.container.dispatchEvent(new Event('scroll'));
			await advance(Math.min(100, firstGustActiveAt - elapsed));
		}
		expect(Math.abs(charm.angle())).toBeGreaterThan(.5);
		expect(vi.getTimerCount()).toBe(1);
	});

	test('wind off still allows touch dragging and release inertia', async () => {
		const charm = await mountCharm();
		charm.props.wind = false;
		await nextTick();
		charm.button.setPointerCapture = () => {};
		charm.button.hasPointerCapture = () => true;
		charm.button.releasePointerCapture = () => {};
		const pointer = (type: string, y: number) => {
			const event = new Event(type, { bubbles: true, cancelable: true });
			Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, pointerType: 'touch', clientX: 650, clientY: y });
			charm.button.dispatchEvent(event);
		};
		const resting = charm.button.parentElement!.style.transform;
		pointer('pointerdown', 200);
		pointer('pointermove', 180);
		await nextTick();
		expect(charm.button.parentElement!.style.transform).not.toBe(resting);
		expect(charm.button.getAttribute('aria-pressed')).toBe('true');
		pointer('pointerup', 180);
		await advance(160);
		expect(charm.button.getAttribute('aria-pressed')).toBe('false');
		expect(charm.button.parentElement!.style.transform).not.toBe(resting);
		await advance(10000);
		expect(charm.button.parentElement!.style.transform).toBe(resting);
		expect(vi.getTimerCount()).toBe(0);
		expect(frames.size).toBe(0);
	});
});
