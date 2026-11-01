/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkNoteCharm from './MkNoteCharm.vue';
import { createCharmArtwork, loadCharmArtwork } from '@/utility/note-charm-artwork.js';

vi.mock('@@/js/config.js', () => ({ ui: 'default' }));

vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _noteCharm: { lift: 'チャームを持ち上げる', lower: 'チャームを下ろす' } } } }));
vi.mock('@/utility/media-proxy.js', () => ({ getStaticImageUrl: (url: string) => `${url}?static` }));
vi.mock('@/utility/note-charm-image-cache.js', () => ({ acquireNoteCharmImage: async (url: string) => ({ url, release: () => {} }) }));
vi.mock('@/utility/note-charm-artwork.js', async importOriginal => {
	const original = await importOriginal<typeof import('@/utility/note-charm-artwork.js')>();
	return { ...original, loadCharmArtwork: vi.fn(async (_url: string, size: number, pattern: 'dots') => original.createCharmArtwork(size, pattern)) };
});

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); });
beforeEach(() => { vi.mocked(loadCharmArtwork).mockClear(); });

function mount(pattern: 'dots' | 'cutout' = 'dots') {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(MkNoteCharm, { charm: { url: '/charm.png', size: 60, pattern, color: '#1d8c42' }, motion: false, wind: false }) });
	app.mount(host);
	cleanup.push(() => { app.unmount(); host.remove(); });
	return [...window.document.querySelectorAll<HTMLElement>('[data-note-charm]')].at(-1)!;
}

describe('acrylic note charm attachment', () => {
	test('does not decode an offscreen character until its note becomes visible', async () => {
		const host = window.document.createElement('div');
		host.getBoundingClientRect = () => new DOMRect(100, window.innerHeight + 100, 400, 200);
		window.document.body.append(host);
		const app = createApp({ render: () => h(MkNoteCharm, { charm: { url: '/offscreen.png', size: 60, pattern: 'clear', color: '#1d8c42' }, motion: false }) });
		app.mount(host);
		cleanup.push(() => { app.unmount(); host.remove(); });
		await nextTick();
		expect(loadCharmArtwork).not.toHaveBeenCalled();
		host.getBoundingClientRect = () => new DOMRect(100, 100, 400, 200);
		window.dispatchEvent(new Event('resize'));
		await nextTick();
		expect(loadCharmArtwork).toHaveBeenCalledWith('/offscreen.png?static', 60, 'clear');
	});

	test('an older image completion cannot replace the current character outline', async () => {
		let resolveOld!: (value: ReturnType<typeof createCharmArtwork>) => void;
		vi.mocked(loadCharmArtwork).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
		const props = reactive({ charm: { url: '/old.png', size: 60, pattern: 'dots' as const, color: '#1d8c42' }, motion: false });
		const host = window.document.createElement('div');
		window.document.body.append(host);
		const app = createApp({ render: () => h(MkNoteCharm, props) });
		app.mount(host);
		cleanup.push(() => { app.unmount(); host.remove(); });
		await nextTick();
		props.charm = { ...props.charm, url: '/new.png' };
		await nextTick();
		await nextTick();
		resolveOld({ ...createCharmArtwork(60, 'dots'), height: 110 });
		await nextTick();
		const button = window.document.querySelector<HTMLButtonElement>('[data-note-charm] button')!;
		expect(button.querySelector('img')?.getAttribute('src')).toBe('/new.png?static');
		expect(button.style.height).toBe('76px');
	});

	test('threads the ball chain through a punched note hole and a separate plate hole', async () => {
		const charm = mount();
		await nextTick();
		const punch = charm.querySelector('[data-note-charm-punch-hole]');
		expect(punch).not.toBeNull();
		expect(punch?.getAttribute('cx')).toBe('-4');
		expect(punch?.getAttribute('rx')).toBe('1.8');
		expect(punch?.getAttribute('ry')).toBe('1.15');
		expect(charm.querySelectorAll('[data-note-charm-ball]')).toHaveLength(15);
		expect(charm.querySelector('[data-note-charm-plate-hole]')?.getAttribute('cy')).toBe('3.5');
		expect(charm.querySelector('button')?.getAttribute('aria-label')).toBe('チャームを持ち上げる');
	});

	test('every charm resolves its own punched plate and border-only pattern masks', async () => {
		const first = mount();
		const second = mount();
		await nextTick();
		const allIds = [...window.document.querySelectorAll('[data-note-charm] [id]')].map(element => element.id);
		expect(allIds.length).toBeGreaterThanOrEqual(6);
		expect(new Set(allIds).size).toBe(allIds.length);
		for (const charm of [first, second]) {
			const decoration = charm.querySelector('[data-note-charm-pattern]');
			const maskId = decoration?.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
			expect(maskId).toBeTruthy();
			const mask = window.document.getElementById(maskId!);
			expect(charm.contains(mask)).toBe(true);
			expect(mask?.querySelector('path[fill="black"][stroke="white"]')?.getAttribute('stroke-width')).toBe('5');
			expect(mask?.querySelector('circle[fill="black"]')?.getAttribute('r')).toBe('2.2');
		}
	});
});
