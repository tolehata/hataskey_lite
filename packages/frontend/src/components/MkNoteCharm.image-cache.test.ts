/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick, reactive, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkNoteCharm from './MkNoteCharm.vue';
import { acquireNoteCharmImage } from '@/utility/note-charm-image-cache.js';
import { createCharmArtwork, loadCharmArtwork } from '@/utility/note-charm-artwork.js';
import { prefer } from '@/preferences.js';

vi.mock('@@/js/config.js', () => ({ ui: 'default' }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(true) } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _noteCharm: { lift: '持ち上げる', lower: '下ろす' } } } }));
vi.mock('@/utility/media-proxy.js', () => ({ getStaticImageUrl: (url: string) => `${url}?static` }));
vi.mock('@/utility/note-charm-image-cache.js', () => ({ acquireNoteCharmImage: vi.fn() }));
vi.mock('@/utility/note-charm-artwork.js', async importOriginal => {
	const original = await importOriginal<typeof import('@/utility/note-charm-artwork.js')>();
	return { ...original, loadCharmArtwork: vi.fn(async (_url: string, size: number, pattern: 'clear') => original.createCharmArtwork(size, pattern)) };
});

const cleanup: (() => void)[] = [];

async function settle() { for (let i = 0; i < 6; i++) await nextTick(); }

beforeEach(() => {
	vi.mocked(acquireNoteCharmImage).mockReset().mockImplementation(async url => ({ url: `blob:${url}`, release: vi.fn() }));
	vi.mocked(loadCharmArtwork).mockClear();
	prefer.r.animation.value = true;
});
afterEach(async () => { cleanup.splice(0).forEach(fn => fn()); await settle(); });

function mount(url = '/one.png', offscreen = false, motion = false) {
	const props = reactive({ charm: { url, size: 60, pattern: 'clear' as const, color: '#123456' }, motion, wind: false });
	const shown = ref(true);
	const host = window.document.createElement('div');
	if (offscreen) host.getBoundingClientRect = () => new DOMRect(100, window.innerHeight + 100, 400, 200);
	window.document.body.append(host);
	const app = createApp({ render: () => shown.value ? h(MkNoteCharm, props) : null });
	app.mount(host);
	cleanup.push(() => { app.unmount(); host.remove(); });
	return { props, host, shown, image: () => window.document.querySelector<HTMLImageElement>('[data-note-charm] img') };
}

describe('note charm cached image lifecycle', () => {
	test('waits for local bytes before rendering and shares them with alpha analysis', async () => {
		let resolve!: (lease: Awaited<ReturnType<typeof acquireNoteCharmImage>>) => void;
		vi.mocked(acquireNoteCharmImage).mockImplementation(() => new Promise(done => { resolve = done; }));
		const charm = mount();
		await settle();
		expect(acquireNoteCharmImage).toHaveBeenCalledWith('/one.png?static');
		expect(charm.image()).toBeNull();
		expect(loadCharmArtwork).not.toHaveBeenCalled();
		resolve({ url: 'blob:local-image', release: vi.fn() });
		await settle();
		expect(charm.image()?.getAttribute('src')).toBe('blob:local-image');
		expect(loadCharmArtwork).toHaveBeenCalledWith('blob:local-image', 60, 'clear');
	});

	test('does not fetch images in offscreen notes', async () => {
		const charm = mount('/offscreen.png', true);
		await settle();
		expect(acquireNoteCharmImage).not.toHaveBeenCalled();
		expect(charm.image()).toBeNull();
		charm.host.getBoundingClientRect = () => new DOMRect(100, 100, 400, 200);
		window.dispatchEvent(new Event('resize'));
		await settle();
		expect(acquireNoteCharmImage).toHaveBeenCalledWith('/offscreen.png?static');
	});

	test('discards late downloads of a replaced image', async () => {
		let resolve!: (lease: Awaited<ReturnType<typeof acquireNoteCharmImage>>) => void;
		const release = vi.fn();
		vi.mocked(acquireNoteCharmImage).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		const charm = mount();
		await settle();
		charm.props.charm.url = '/two.png';
		await settle();
		resolve({ url: 'blob:old-image', release });
		await settle();
		expect(charm.image()?.getAttribute('src')).toBe('blob:/two.png?static');
		expect(release).toHaveBeenCalledOnce();
		expect(loadCharmArtwork).not.toHaveBeenCalledWith('blob:old-image', 60, 'clear');
	});

	test('holds a lease until alpha decoding finishes even after unmount', async () => {
		let resolve!: (artwork: ReturnType<typeof createCharmArtwork>) => void;
		const release = vi.fn();
		vi.mocked(acquireNoteCharmImage).mockResolvedValue({ url: 'blob:decoding', release });
		vi.mocked(loadCharmArtwork).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		const charm = mount();
		await settle();
		charm.shown.value = false;
		await settle();
		expect(charm.image()).toBeNull();
		expect(release).not.toHaveBeenCalled();
		resolve(createCharmArtwork(60, 'clear'));
		await settle();
		expect(release).toHaveBeenCalledOnce();
	});

	test('switches cached variants when animation is disabled', async () => {
		const charm = mount('/animated.webp', false, true);
		await settle();
		expect(charm.image()?.getAttribute('src')).toBe('blob:/animated.webp');
		prefer.r.animation.value = false;
		await settle();
		expect(acquireNoteCharmImage).toHaveBeenLastCalledWith('/animated.webp?static');
		expect(charm.image()?.getAttribute('src')).toBe('blob:/animated.webp?static');
	});

	test.each(['blob:preview', 'data:image/png;base64,AAAA'])('never sends a local URL through the static proxy: %s', async url => {
		mount(url);
		await settle();
		expect(acquireNoteCharmImage).toHaveBeenCalledWith(url);
	});
});
