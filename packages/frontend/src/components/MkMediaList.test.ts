/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import type { entities } from 'cherrypick-js';
import MkMediaList from './MkMediaList.vue';

const mocks = vi.hoisted(() => ({
	popup: vi.fn(),
	prefer: { s: { mediaListWithOneImageAppearance: '1_1' as '16_9' | '1_1' | '2_3', imageNewTab: false } },
}));
vi.mock('@/preferences.js', () => ({ prefer: mocks.prefer }));
vi.mock('@/os.js', () => ({ popupAsyncWithDialog: mocks.popup }));
vi.mock('@/components/MkMediaBanner.vue', () => ({ default: { props: ['media'], template: '<div data-banner />' } }));
vi.mock('@/components/MkMediaAudio.vue', () => ({ default: { props: ['audio'], template: '<div data-audio />' } }));
vi.mock('@/components/MkMediaVideo.vue', () => ({ default: { props: ['video'], template: '<div data-video />' } }));
vi.mock('@/components/MkMediaImage.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: ['image', 'marker'],
		emits: ['mediaClick'],
		setup(props, { emit, expose }) {
			expose({ isRevealed: () => true });
			return () => render('button', { 'data-image': '', 'data-marker': props.marker, onClick: () => emit('mediaClick') });
		},
	}) };
});
vi.mock('@/components/MkLightbox.vue', () => ({ default: { render: () => null } }));

const cleanups: Array<() => void> = [];
const file = (id: string, type: string, width?: number, height?: number) => ({
	id, type, name: `${id}.png`, url: `/files/${id}`, thumbnailUrl: `/thumb/${id}`,
	properties: { width, height },
}) as entities.DriveFile;

async function mount(files: entities.DriveFile[], fitSingleImage?: boolean) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(MkMediaList, { mediaList: files, fitSingleImage }) });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await nextTick();
	const gallery = host.querySelector<HTMLElement>('[class*="medias"]');
	return { host, gallery };
}

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	mocks.popup.mockReset();
	mocks.prefer.s.mediaListWithOneImageAppearance = '1_1';
});

describe('MkMediaList single image fit', () => {
	it('keeps the default gallery preference unless opted in', async () => {
		const { gallery } = await mount([file('portrait', 'image/png', 400, 800)]);
		expect(gallery?.className).toContain('n11_1');
		expect(gallery?.className).not.toContain('fitSingleImage');
		expect(gallery?.style.aspectRatio).toBe('1 / 1');
		expect(gallery?.style.getPropertyValue('--media-ratio')).toBe('');
	});

	it.each([
		{ name: 'portrait', width: 400, height: 800, ratio: '0.5', preference: '16_9' },
		{ name: 'portrait', width: 400, height: 800, ratio: '0.5', preference: '1_1' },
		{ name: 'portrait', width: 400, height: 800, ratio: '0.5', preference: '2_3' },
		{ name: 'wide', width: 1200, height: 400, ratio: '3', preference: '1_1' },
	] as const)('fits a known-size $name image to its true ratio under $preference preference', async ({ name, width, height, ratio, preference }) => {
		mocks.prefer.s.mediaListWithOneImageAppearance = preference;
		const files = [file(name, 'image/png', width, height)];
		const before = JSON.stringify(files);
		const { gallery, host } = await mount(files, true);
		expect(gallery?.className).toContain('n1');
		expect(gallery?.className).toContain('fitSingleImage');
		expect(gallery?.className).not.toMatch(/n116_9|n11_1|n12_3/);
		expect(gallery?.style.getPropertyValue('--media-ratio')).toBe(ratio);
		expect(host.querySelectorAll('[data-image]')).toHaveLength(1);
		expect(JSON.stringify(files)).toBe(before);
	});

	it.each([
		['missing', undefined, undefined],
		['zero', 0, 800],
		['negative', 400, -1],
		['nonfinite', Infinity, 800],
		['overflow', Number.MAX_VALUE, Number.MIN_VALUE],
	] as const)('keeps the grid for %s dimensions', async (name, width, height) => {
		const { gallery } = await mount([file(name, 'image/png', width, height)], true);
		expect(gallery?.className).not.toContain('fitSingleImage');
		expect(gallery?.className).toContain('n11_1');
	});

	it.each([
		[file('audio', 'audio/mpeg', 400, 800)],
		[file('video', 'video/mp4', 400, 800)],
		[file('image', 'image/png', 400, 800), file('video', 'video/mp4', 800, 400)],
		[file('image', 'image/png', 400, 800), file('other', 'application/pdf', 800, 400)],
	])('keeps the grid for non-image or mixed attachments', async (...files) => {
		const { gallery } = await mount(files, true);
		expect(gallery?.className).not.toContain('fitSingleImage');
	});

	it('still opens the lightbox from a fitted image without changing the file', async () => {
		mocks.popup.mockResolvedValue({ dispose: vi.fn() });
		const files = [file('clicked', 'image/png', 400, 800)];
		const before = JSON.stringify(files);
		const { host } = await mount(files, true);
		host.querySelector<HTMLButtonElement>('[data-image]')!.click();
		await vi.waitFor(() => expect(mocks.popup).toHaveBeenCalledOnce());
		expect(mocks.popup.mock.calls[0][1]).toMatchObject({
			defaultIndex: 0,
			initiallyRevealedContentIds: ['clicked'],
			contents: [{ id: 'clicked', sourceElement: host.querySelector('[data-image]') }],
		});
		expect(JSON.stringify(files)).toBe(before);
	});
});
