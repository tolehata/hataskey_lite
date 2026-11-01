/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createCharmArtwork, createCharmSilhouette, loadCharmArtwork } from './note-charm-artwork.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function alphaFixture(width: number, height: number, rectangles: number[][]) {
	const alpha = new Uint8Array(width * height);
	for (const [left, top, right, bottom] of rectangles) {
		for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) alpha[y * width + x] = 255;
	}
	return alpha;
}

function inspectedImageFixture(contentWidth: number, paddingAlpha: number) {
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
		return {
			drawImage() {},
			getImageData: () => {
				const data = new Uint8ClampedArray(this.width * this.height * 4);
				const inspecting = this.width === 384 && this.height === 384;
				const left = inspecting ? Math.floor((384 - contentWidth) / 2) : 30;
				const top = inspecting ? left : 30;
				const right = inspecting ? left + contentWidth : this.width - 30;
				const bottom = inspecting ? right : this.height - 10;
				for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
					data[(y * this.width + x) * 4 + 3] = x >= left && x < right && y >= top && y < bottom ? 255 : inspecting ? paddingAlpha : 0;
				}
				return { data };
			},
		} as unknown as CanvasRenderingContext2D;
	});
	vi.stubGlobal('Image', class {
		naturalWidth = 4096;
		naturalHeight = 4096;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		set src(_value: string) { queueMicrotask(() => this.onload?.()); }
	});
}

describe('acrylic charm artwork', () => {
	test('keeps the visible image inside the fallback plate and leaves space for its attachment hole', () => {
		const artwork = createCharmArtwork(60, 'clear');
		expect(artwork.kind).toBe('plate');
		expect(artwork.height).toBe(76);
		expect(artwork.image).toEqual({ x: 4, y: 10, width: 52, height: 62 });
		expect(artwork.outline.startsWith('M ')).toBe(true);
		expect(artwork.outline.endsWith(' Z')).toBe(true);
		expect(artwork.highlight).not.toBe('');
		expect(artwork.tab).not.toBe('');
	});

	test.each([NaN, Infinity, -50, 500])('contains an invalid or out of range size %s within the supported dimensions', size => {
		const artwork = createCharmArtwork(size, 'cutout');
		expect(artwork.kind).toBe('cutout');
		expect(artwork.image.width).toBeGreaterThanOrEqual(46);
		expect(artwork.image.width).toBeLessThanOrEqual(62);
		expect(JSON.stringify(artwork)).not.toMatch(/NaN|Infinity|null/);
	});

	test('traces the transparent character instead of retaining a full rectangular plate', () => {
		const alpha = alphaFixture(180, 240, [[60, 60, 120, 210]]);
		const shape = createCharmSilhouette(alpha, 180, 240, 60, 80);
		expect(shape).not.toBeNull();
		// A centered 20px wide body plus its 2.8px acrylic edge stays well inside 60px.
		const coordinates = shape!.outline.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
		const xs = coordinates.filter((_, index) => index % 2 === 0);
		expect(Math.min(...xs)).toBeGreaterThan(15);
		expect(Math.max(...xs)).toBeLessThan(45);
		expect(shape!.outline.match(/M /g)).toHaveLength(1);
		expect(shape!.tab).not.toBe('');
	});

	test('connects separate character details and the top attachment into one support plate', () => {
		const alpha = alphaFixture(180, 240, [[80, 60, 130, 210], [20, 120, 35, 145]]);
		const shape = createCharmSilhouette(alpha, 180, 240, 60, 80);
		expect(shape).not.toBeNull();
		expect(shape!.outline.match(/M /g)).toHaveLength(1);
		const coordinates = shape!.outline.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
		const xs = coordinates.filter((_, index) => index % 2 === 0);
		const ys = coordinates.filter((_, index) => index % 2 === 1);
		expect(Math.min(...xs)).toBeLessThan(7);
		expect(Math.max(...xs)).toBeGreaterThan(43);
		expect(Math.min(...ys)).toBeLessThan(2);
	});

	test('falls back for an empty or invalid alpha raster instead of emitting an invalid SVG', () => {
		expect(createCharmSilhouette(new Uint8Array(180 * 240), 180, 240, 60, 80)).toBeNull();
		expect(createCharmSilhouette(new Uint8Array(1), 180, 240, 60, 80)).toBeNull();
		expect(createCharmSilhouette(new Uint8Array(), 0, 0, 60, 80)).toBeNull();
	});

	test('bounds contour work for a noisy image with many isolated details', () => {
		const alpha = new Uint8Array(192 * 330);
		for (let y = 12; y < 320; y += 24) for (let x = 12; x < 185; x += 24) alpha[y * 192 + x] = 255;
		expect(createCharmSilhouette(alpha, 192, 330, 64, 110)).toBeNull();
	});

	test('retains image aspect ratio when the browser cannot expose canvas pixels', async () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		class PortraitImage {
			crossOrigin = '';
			decoding = '';
			naturalWidth = 600;
			naturalHeight = 1200;
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			set src(_value: string) { queueMicrotask(() => this.onload?.()); }
		}
		vi.stubGlobal('Image', PortraitImage);
		const artwork = await loadCharmArtwork('https://example.test/portrait.png', 60, 'clear');
		expect(artwork.kind).toBe('plate');
		expect(artwork.height).toBe(110);
		expect(artwork.image).toEqual({ x: 6, y: 10, width: 48, height: 96 });
	});

	test.each([
		[1, 0, 'clear'], [1, 15, 'clear'], [32, 0, 'clear'], [32, 15, 'clear'],
		[1, 0, 'cutout'], [1, 15, 'cutout'], [32, 0, 'cutout'], [32, 15, 'cutout'],
	] as const)('fits the whole image when %spx of content and alpha-%s padding would create an oversized %s filter surface', async (contentWidth, paddingAlpha, pattern) => {
		inspectedImageFixture(contentWidth, paddingAlpha);
		const artwork = await loadCharmArtwork(`https://example.test/padded-${contentWidth}-${paddingAlpha}-${pattern}.png`, 60, pattern);
		expect(artwork.image.width).toBeLessThanOrEqual(60);
		expect(artwork.image.height).toBeLessThanOrEqual(96);
		expect(artwork.image.width).toBe(artwork.image.height);
		expect(artwork.image.x).toBeGreaterThanOrEqual(0);
		expect(artwork.image.y).toBeGreaterThanOrEqual(0);
		expect(artwork.kind).toBe(pattern === 'cutout' ? 'cutout' : 'plate');
	});

	test.each(['clear', 'cutout'] as const)('keeps normal transparent-padding geometry and the %s outline', async pattern => {
		inspectedImageFixture(128, 0);
		const artwork = await loadCharmArtwork(`https://example.test/normal-padding-${pattern}.png`, 60, pattern);
		expect(artwork.image.width).toBeCloseTo(pattern === 'cutout' ? 174 : 162);
		expect(artwork.image.height).toBeCloseTo(artwork.image.width);
		expect(artwork.kind).toBe(pattern === 'cutout' ? 'cutout' : 'silhouette');
	});

	test('shares one image request among repeated timeline charms and pattern-only changes', async () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		let requests = 0;
		class SharedImage {
			crossOrigin = '';
			decoding = '';
			naturalWidth = 100;
			naturalHeight = 100;
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			set src(_value: string) { requests++; queueMicrotask(() => this.onload?.()); }
		}
		vi.stubGlobal('Image', SharedImage);
		const [first, second, third] = await Promise.all([
			loadCharmArtwork('https://example.test/shared.png', 60, 'clear'),
			loadCharmArtwork('https://example.test/shared.png', 60, 'dots'),
			loadCharmArtwork('https://example.test/shared.png', 64, 'check'),
		]);
		expect(requests).toBe(1);
		expect(first).toEqual(second);
		expect(third.image.width).toBeCloseTo(56);
	});

	test('does not reject or remove the character when a CORS image read is denied', async () => {
		class DeniedImage {
			crossOrigin = '';
			decoding = '';
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
		}
		vi.stubGlobal('Image', DeniedImage);
		await expect(loadCharmArtwork('https://example.test/no-cors.png', 60, 'clear')).resolves.toEqual(createCharmArtwork(60, 'clear'));
	});

	test('evicts old image data instead of retaining every character visited in a timeline', async () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
		let firstRequests = 0;
		class CachedImage {
			crossOrigin = '';
			decoding = '';
			naturalWidth = 100;
			naturalHeight = 100;
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			set src(value: string) {
				if (value === 'https://example.test/cache-first.png') firstRequests++;
				queueMicrotask(() => this.onload?.());
			}
		}
		vi.stubGlobal('Image', CachedImage);
		const first = await loadCharmArtwork('https://example.test/cache-first.png', 60, 'clear');
		for (let i = 0; i < 65; i++) await loadCharmArtwork(`https://example.test/cache-${i}.png`, 60, 'clear');
		expect(await loadCharmArtwork('https://example.test/cache-first.png', 60, 'clear')).toEqual(first);
		expect(firstRequests).toBe(2);
	});

	test('contains a failed image constructor without leaking a rejected cache promise', async () => {
		vi.stubGlobal('Image', class UnavailableImage { constructor() { throw new Error('Image unavailable'); } });
		await expect(loadCharmArtwork('https://example.test/unavailable.png', 60, 'clear')).resolves.toEqual(createCharmArtwork(60, 'clear'));
		await new Promise(resolve => window.setTimeout(resolve, 0));
	});
});
