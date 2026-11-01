/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkNoteCharm from './MkNoteCharm.vue';
import { useNoteCharmMobileDisplay } from '@/utility/note-charm-device.js';

vi.mock('@@/js/config.js', () => ({ ui: 'simple' }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(true) } } };
});
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _noteCharm: { lift: 'チャームを持ち上げる', lower: 'チャームを下ろす' } } } }));
vi.mock('@/utility/media-proxy.js', () => ({ getStaticImageUrl: (url: string) => `${url}?static` }));
vi.mock('@/utility/note-charm-image-cache.js', () => ({ acquireNoteCharmImage: async (url: string) => ({ url, release: () => {} }) }));
vi.mock('@/utility/note-charm-artwork.js', async importOriginal => {
	const artwork = await importOriginal<typeof import('@/utility/note-charm-artwork.js')>();
	// Visibility tests do not need image decoding or network access.
	return { ...artwork, loadCharmArtwork: async (_url: string, size: number, pattern: Parameters<typeof artwork.createCharmArtwork>[1]) => artwork.createCharmArtwork(size, pattern) };
});

const observers: ControlledIntersectionObserver[] = [];
const cleanup: (() => void)[] = [];

class ControlledIntersectionObserver {
	target?: Element;
	disconnected = false;
	private time = 0;

	constructor(private callback: IntersectionObserverCallback) { observers.push(this); }
	observe(target: Element) { this.target = target; }
	disconnect() { this.disconnected = true; }

	// Deliver explicitly to exercise queued notifications, including ones whose
	// observer was disconnected after the browser queued them.
	deliver(...states: boolean[]) {
		const rect = this.target!.getBoundingClientRect();
		const entries = states.map(isIntersecting => ({
			target: this.target!, time: this.time++, isIntersecting,
			intersectionRatio: Number(isIntersecting), boundingClientRect: rect,
			intersectionRect: rect, rootBounds: null,
		}));
		this.callback(entries, this as unknown as IntersectionObserver);
	}
}

function mountCharm(parentGate = false) {
	const container = window.document.createElement('div');
	container.getBoundingClientRect = () => new DOMRect(100, 120, 500, 300);
	window.document.body.append(container);
	const app = createApp({
		setup() {
			const mobileDisplay = useNoteCharmMobileDisplay();
			// MkNote also gates its child on the shell's mobile layout. Keep that
			// lifecycle distinct from MkNoteCharm recreating its own source/portal.
			return () => parentGate && mobileDisplay.value ? null : h(MkNoteCharm, {
				charm: { url: '/charm.png', size: 76, pattern: 'dots', color: '#6ba5e3' },
				motion: false,
				wind: false,
			});
		},
	});
	app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });
}

const layer = () => window.document.querySelector<HTMLElement>('[data-note-charm-layer]');

async function resize(width: number) {
	vi.stubGlobal('innerWidth', width);
	window.dispatchEvent(new Event('resize'));
	await nextTick();
	await nextTick();
}

async function ordinaryViewportEvents() {
	window.dispatchEvent(new Event('resize'));
	window.dispatchEvent(new Event('scroll'));
	window.dispatchEvent(new Event('focus'));
	window.document.dispatchEvent(new Event('visibilitychange'));
	await nextTick();
}

beforeEach(() => {
	observers.splice(0);
	vi.stubGlobal('innerWidth', 1250);
	vi.stubGlobal('innerHeight', 900);
	vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver);
	vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36');
});

afterEach(() => {
	cleanup.splice(0).forEach(fn => fn());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('note charm visibility after viewport changes', () => {
	test.each([
		{ states: [false, true], visibility: 'visible' },
		{ states: [true, false], visibility: 'hidden' },
	])('uses the latest intersection in $states and stays $visibility through viewport events', async ({ states, visibility }) => {
		mountCharm(true);
		const observer = observers[0];
		observer.deliver(true);
		await nextTick();
		expect(layer()!.style.visibility).toBe('visible');
		observer.deliver(...states);
		await nextTick();
		expect(layer()!.style.visibility).toBe(visibility);
		await ordinaryViewportEvents();
		expect(layer()!.style.visibility).toBe(visibility);
	});

	test.each([true, false])('an empty notification preserves intersection state %s', async intersecting => {
		mountCharm(true);
		const observer = observers[0];
		observer.deliver(intersecting);
		await nextTick();
		const visibility = intersecting ? 'visible' : 'hidden';
		expect(layer()!.style.visibility).toBe(visibility);
		observer.deliver();
		await nextTick();
		expect(layer()!.style.visibility).toBe(visibility);
	});

	test('a queued old notification cannot hide a source recreated across the simple UI breakpoint', async () => {
		mountCharm();
		const old = observers[0];
		old.deliver(true);
		await nextTick();
		expect(layer()!.style.visibility).toBe('visible');
		await resize(1000);
		expect(layer()).toBeNull();
		expect(old.disconnected).toBe(true);
		await resize(1250);
		expect(observers).toHaveLength(2);
		observers[1].deliver(true);
		await nextTick();
		expect(layer()!.style.visibility).toBe('visible');
		old.deliver(false);
		await ordinaryViewportEvents();
		expect(layer()!.style.visibility).toBe('visible');
		// The current observer must still be able to hide and restore the charm.
		observers[1].deliver(false);
		await nextTick();
		expect(layer()!.style.visibility).toBe('hidden');
		observers[1].deliver(true);
		await nextTick();
		expect(layer()!.style.visibility).toBe('visible');
	});

	test('a queued notification from an unmounted charm cannot hide its new instance', async () => {
		mountCharm(true);
		const old = observers[0];
		old.deliver(true);
		await nextTick();
		expect(layer()!.style.visibility).toBe('visible');
		await resize(1000);
		expect(layer()).toBeNull();
		expect(old.disconnected).toBe(true);
		await resize(1250);
		expect(observers).toHaveLength(2);
		observers[1].deliver(true);
		await nextTick();
		expect(layer()!.style.visibility).toBe('visible');
		old.deliver(false);
		await ordinaryViewportEvents();
		expect(layer()!.style.visibility).toBe('visible');
	});
});
