/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageEdgeTintReader, extractImageEdges, observeImageEdgeTint } from './hk3-image-edge-tint.js';

type RGB = [number, number, number];
const blue: RGB = [30, 110, 200];
const red: RGB = [210, 60, 40];
const green: RGB = [40, 160, 60];
const purple: RGB = [140, 60, 190];

function pixels(color: RGB = blue, alpha = 255) {
	const data = new Uint8ClampedArray(64 * 64 * 4);
	for (let i = 0; i < data.length; i += 4) data.set([...color, alpha], i);
	return data;
}

function fill(data: Uint8ClampedArray, x: number, y: number, color: RGB, alpha = 255) {
	data.set([...color, alpha], (y * 64 + x) * 4);
}

describe('edge palette', () => {
	it('keeps four distinct edges and ignores a differently colored center', () => {
		const data = pixels([255, 0, 255]);
		for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
			if (x < 5) fill(data, x, y, blue);
			else if (x >= 59) fill(data, x, y, red);
			else if (y < 5) fill(data, x, y, green);
			else if (y >= 59) fill(data, x, y, purple);
		}
		expect(extractImageEdges(data, 64, 64)).toEqual({ left: blue, right: red, top: green, bottom: purple });
	});
	it.each([{ color: [255, 255, 255] }, { color: [0, 0, 0] }, { color: [150, 150, 150] }] as { color: RGB }[])('ignores neutral/extreme edges $color even with a saturated center', ({ color }) => {
		const data = pixels(color);
		for (let y = 5; y < 59; y++) for (let x = 5; x < 59; x++) fill(data, x, y, blue);
		expect(extractImageEdges(data, 64, 64)).toEqual({ left: null, right: null, top: null, bottom: null });
	});
	it('ignores translucent RGB and sparse colored noise', () => {
		const data = pixels(blue, 223);
		fill(data, 0, 0, red);
		expect(Object.values(extractImageEdges(data, 64, 64))).toEqual([null, null, null, null]);
	});
	it('uses only other edges as fallback for a neutral edge', () => {
		const data = pixels([150, 150, 150]);
		for (let y = 0; y < 64; y++) for (let x = 0; x < 5; x++) fill(data, x, y, blue);
		expect(Object.values(extractImageEdges(data, 64, 64))).toEqual([blue, blue, blue, blue]);
	});
	it('rejects invalid pixel dimensions', () => {
		expect(() => extractImageEdges(pixels(), 63, 64)).toThrow('Invalid pixel buffer');
	});
});

let draw: ReturnType<typeof vi.fn>;
let readPixels: ReturnType<typeof vi.fn>;
let context: ReturnType<typeof vi.spyOn>;
const cleanups: (() => void)[] = [];
let intersections: ((entries: { isIntersecting: boolean; target?: Element }[]) => void)[];
let disconnect: ReturnType<typeof vi.fn>;
let resizes: { callback: () => void; observed: Set<Element>; disconnect: ReturnType<typeof vi.fn> }[];

function image(src = 'https://example.test/loaded.png') {
	const result = window.document.createElement('img');
	result.src = src;
	result.dataset.marker = 'attachment';
	Object.defineProperties(result, {
		complete: { configurable: true, value: true },
		naturalWidth: { configurable: true, value: 1200 },
		naturalHeight: { configurable: true, value: 800 },
		currentSrc: { configurable: true, get: () => result.src },
	});
	vi.spyOn(result, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 10, right: 210, bottom: 110, width: 200, height: 100 } as DOMRect);
	return result;
}

function attachment(src?: string) {
	const host = window.document.createElement('div');
	const media = window.document.createElement('div');
	media.dataset.isHidden = 'false';
	const img = image(src);
	media.append(img);
	host.append(media);
	window.document.body.append(host);
	cleanups.push(() => host.remove());
	return { host, media, img };
}

beforeEach(() => {
	vi.useFakeTimers();
	draw = vi.fn();
	readPixels = vi.fn(() => ({ data: pixels() }));
	context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: draw, getImageData: readPixels } as unknown as CanvasRenderingContext2D);
	intersections = [];
	disconnect = vi.fn();
	resizes = [];
	vi.stubGlobal('ResizeObserver', class {
		entry = { callback: () => {}, observed: new Set<Element>(), disconnect: vi.fn() };
		constructor(callback: () => void) { this.entry.callback = callback; resizes.push(this.entry); }
		observe(target: Element) { this.entry.observed.add(target); }
		unobserve(target: Element) { this.entry.observed.delete(target); }
		disconnect() { this.entry.disconnect(); }
	});
	vi.stubGlobal('IntersectionObserver', class {
		images = new Set<Element>();
		constructor(callback: (entries: { isIntersecting: boolean; target: Element }[]) => void) {
			intersections.push(entries => callback(entries.flatMap(entry => entry.target ? [{ ...entry, target: entry.target }] : [...this.images].map(target => ({ ...entry, target })))));
		}
		observe(target: Element) { this.images.add(target); }
		unobserve(target: Element) { this.images.delete(target); }
		disconnect = disconnect;
	});
});
afterEach(() => {
	cleanups.reverse().splice(0).forEach(cleanup => cleanup());
	vi.runAllTimers();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function tick() {
	await vi.advanceTimersByTimeAsync(100);
}

function observe(host: HTMLElement) {
	const apply = vi.fn();
	const stop = observeImageEdgeTint(host, apply);
	cleanups.push(stop);
	return { apply, stop };
}

function geometryFixture(host: HTMLElement) {
	const article = window.document.createElement('article');
	host.parentElement?.insertBefore(article, host);
	article.append(host);
	vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 } as DOMRect);
	Object.defineProperties(article, { offsetWidth: { configurable: true, value: 400 }, offsetHeight: { configurable: true, value: 400 } });
	cleanups.push(() => article.remove());
	const apply = vi.fn();
	const applyGeometry = vi.fn();
	const stop = observeImageEdgeTint(host, apply, { geometry: { relativeTo: article, apply: applyGeometry } });
	cleanups.push(stop);
	return { article, apply, applyGeometry, stop };
}

describe('loaded image reader', () => {
	it('reads an existing image into 64px canvas once and releases its pixel allocation', () => {
		const read = createImageEdgeTintReader();
		const img = image();
		const decode = vi.spyOn(img, 'decode');
		const networkRequest = vi.spyOn(window, 'fetch');
		const palette = read(img);
		expect(read(img)).toBe(palette);
		expect(context).toHaveBeenCalledTimes(1);
		expect(draw).toHaveBeenCalledExactlyOnceWith(img, 0, 0, 64, 64);
		expect(readPixels).toHaveBeenCalledExactlyOnceWith(0, 0, 64, 64);
		expect((context.mock.instances[0] as HTMLCanvasElement).width).toBe(0);
		expect(decode).not.toHaveBeenCalled();
		expect(networkRequest).not.toHaveBeenCalled();
	});
	it('returns no tint for CORS errors and remembers failures without retrying', () => {
		readPixels.mockImplementation(() => { throw new DOMException('Tainted', 'SecurityError'); });
		const read = createImageEdgeTintReader();
		const img = image();
		expect(read(img)).toBeNull();
		expect(read(img)).toBeNull();
		expect(draw).toHaveBeenCalledTimes(1);
	});
	it('evicts the least recently used palette at the finite cache limit', () => {
		const read = createImageEdgeTintReader(2);
		const a = image('https://example.test/a'), b = image('https://example.test/b'), c = image('https://example.test/c');
		read(a); read(b); read(a); read(c); read(b);
		expect(draw).toHaveBeenCalledTimes(4);
	});
	it('skips incomplete, broken and stale-source images without allocating canvas', () => {
		const read = createImageEdgeTintReader();
		const img = image();
		Object.defineProperty(img, 'complete', { value: false });
		expect(read(img)).toBeNull();
		Object.defineProperties(img, { complete: { value: true }, naturalWidth: { value: 0 } });
		expect(read(img)).toBeNull();
		Object.defineProperties(img, { naturalWidth: { value: 1200 }, currentSrc: { value: 'https://example.test/old' } });
		expect(read(img)).toBeNull();
		expect(context).not.toHaveBeenCalled();
	});
});

describe('attachment visibility and lifecycle', () => {
	it('reports the centered contain paint rect in article coordinates and updates on resize without another canvas read', async () => {
		const { host, img } = attachment('https://example.test/contain');
		img.style.objectFit = 'contain';
		vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 150, right: 500, bottom: 350, width: 400, height: 200 } as DOMRect);
		const { article, applyGeometry } = geometryFixture(host);
		vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 800, bottom: 800, width: 800, height: 800 } as DOMRect);
		intersections[0]([{ target: img, isIntersecting: true }]);
		await tick();
		expect(applyGeometry).toHaveBeenLastCalledWith({ left: 75, top: 75, width: 150, height: 100, centerX: 150, centerY: 125, visibleEdges: { left: true, right: true, top: true, bottom: true } });
		expect(resizes[0].observed.has(img)).toBe(true);
		vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 170, right: 500, bottom: 370, width: 400, height: 200 } as DOMRect);
		resizes[0].callback();
		await tick();
		expect(applyGeometry).toHaveBeenLastCalledWith(expect.objectContaining({ left: 75, top: 85 }));
		expect(draw).toHaveBeenCalledTimes(1);
	});
	it('hides only clipped image edges and clears the palette when an article viewport fully clips the image', async () => {
		const { host, img } = attachment('https://example.test/folded');
		const viewport = window.document.createElement('div');
		host.parentElement?.insertBefore(viewport, host);
		viewport.append(host);
		viewport.style.overflow = 'clip';
		vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 400, bottom: 80, width: 400, height: 80 } as DOMRect);
		const { article, apply, applyGeometry } = geometryFixture(viewport);
		// The media host remains under the viewport inside the article.
		intersections[0]([{ target: img, isIntersecting: true }]);
		await tick();
		expect(applyGeometry).toHaveBeenLastCalledWith(expect.objectContaining({ visibleEdges: { left: true, right: true, top: true, bottom: false } }));
		vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 20, right: 400, bottom: 90, width: 400, height: 70 } as DOMRect);
		resizes[0].callback();
		await tick();
		expect(applyGeometry).toHaveBeenLastCalledWith(expect.objectContaining({ centerY: 55, visibleEdges: { left: true, right: true, top: false, bottom: false } }));
		vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 120, right: 400, bottom: 160, width: 400, height: 40 } as DOMRect);
		resizes[0].callback();
		expect(apply).toHaveBeenLastCalledWith(null);
		expect(applyGeometry).toHaveBeenLastCalledWith(null);
		expect(resizes[0].observed.has(viewport)).toBe(true);
		expect(resizes[0].observed.has(article)).toBe(true);
	});
	it('retains a safe palette past an outer timeline scroller and removes geometry listeners on stop', async () => {
		const { host, img } = attachment('https://example.test/scroll');
		const { article, apply, applyGeometry, stop } = geometryFixture(host);
		const scroller = window.document.createElement('div');
		scroller.style.overflow = 'auto';
		window.document.body.append(scroller);
		scroller.append(article);
		cleanups.push(() => scroller.remove());
		vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 400, bottom: 300 } as DOMRect);
		intersections[0]([{ target: img, isIntersecting: true }]);
		await tick();
		const calls = apply.mock.calls.length;
		vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 300, right: 400, bottom: 600 } as DOMRect);
		intersections[0]([{ target: img, isIntersecting: false }]);
		resizes[0].callback();
		await tick();
		expect(apply).toHaveBeenCalledTimes(calls);
		stop();
		expect(applyGeometry).toHaveBeenLastCalledWith(null);
		expect(resizes[0].disconnect).toHaveBeenCalledTimes(1);
	});
	it('clears palette and geometry on sensitive hide or source replacement before another extraction', async () => {
		const { host, media, img } = attachment('https://example.test/private');
		const { apply, applyGeometry } = geometryFixture(host);
		intersections[0]([{ target: img, isIntersecting: true }]);
		await tick();
		media.dataset.isHidden = 'true';
		await Promise.resolve();
		expect(apply).toHaveBeenLastCalledWith(null);
		expect(applyGeometry).toHaveBeenLastCalledWith(null);
		media.dataset.isHidden = 'false';
		await tick();
		Object.defineProperty(img, 'currentSrc', { value: img.src });
		img.src = 'https://example.test/replaced';
		await Promise.resolve();
		expect(apply).toHaveBeenLastCalledWith(null);
		expect(applyGeometry).toHaveBeenLastCalledWith(null);
		expect(draw).toHaveBeenCalledTimes(1);
	});
	it('observes the image itself when a tall attachment host stays in view', async () => {
		const { host, img } = attachment('https://example.test/tall-note');
		const { apply } = observe(host);
		intersections[0]([{ target: img, isIntersecting: false }]);
		await tick();
		expect(context).not.toHaveBeenCalled();
		intersections[0]([{ target: img, isIntersecting: true }]);
		await tick();
		expect(draw).toHaveBeenCalledExactlyOnceWith(img, 0, 0, 64, 64);
		const calls = apply.mock.calls.length;
		intersections[0]([{ target: img, isIntersecting: false }]);
		await tick();
		expect(apply).toHaveBeenCalledTimes(calls);
		intersections[0]([{ target: img, isIntersecting: true }]);
		await tick();
		expect(draw).toHaveBeenCalledTimes(1);
	});
	it('rechecks an ancestor visibility change while the image stays intersecting', async () => {
		const { host } = attachment('https://example.test/ancestor-visibility');
		const tab = window.document.createElement('div');
		window.document.body.append(tab);
		tab.append(host);
		cleanups.push(() => tab.remove());
		tab.style.visibility = 'hidden';
		const { apply } = observe(host);
		intersections[0]([{ isIntersecting: true }]);
		await tick();
		expect(context).not.toHaveBeenCalled();
		tab.style.visibility = 'visible';
		await tick();
		expect(draw).toHaveBeenCalledTimes(1);
		tab.style.visibility = 'hidden';
		await tick();
		expect(apply).toHaveBeenLastCalledWith(null);
	});
	it('waits for intersection and reveal, including already loaded sensitive images', async () => {
		const { host, media } = attachment('https://example.test/sensitive');
		media.dataset.isHidden = 'true';
		const { apply } = observe(host);
		await tick();
		expect(context).not.toHaveBeenCalled();
		intersections[0]([{ isIntersecting: true }]);
		await tick();
		expect(context).not.toHaveBeenCalled();
		media.dataset.isHidden = 'false';
		await tick();
		expect(draw).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenLastCalledWith({ left: blue, right: blue, top: blue, bottom: blue });
		media.dataset.isHidden = 'true';
		await tick();
		expect(apply).toHaveBeenLastCalledWith(null);
	});
	it('waits for the decoded high-quality image to become displayed, without decoding it', async () => {
		const { host, img } = attachment('https://example.test/placeholder');
		const decode = vi.spyOn(img, 'decode');
		img.style.display = 'none';
		observe(host);
		intersections[0]([{ isIntersecting: true }]);
		await tick();
		expect(context).not.toHaveBeenCalled();
		img.style.display = '';
		await tick();
		expect(draw).toHaveBeenCalledTimes(1);
		expect(decode).not.toHaveBeenCalled();
	});
	it('skips hidden tabs, inert threads and images clipped by a scroll container', async () => {
		const { host, media } = attachment('https://example.test/clipped');
		observe(host);
		intersections[0]([{ isIntersecting: true }]);
		host.style.display = 'none';
		await tick();
		host.style.display = '';
		media.setAttribute('inert', '');
		media.className = 'changed';
		await tick();
		media.removeAttribute('inert');
		host.style.overflow = 'auto';
		vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 200, right: 210, bottom: 300 } as DOMRect);
		await tick();
		expect(context).not.toHaveBeenCalled();
	});
	it('cancels work on unmount and rechecks a source changed while queued', async () => {
		const { host, img } = attachment('https://example.test/stale');
		const { apply, stop } = observe(host);
		intersections[0]([{ isIntersecting: true }]);
		Object.defineProperty(img, 'currentSrc', { value: img.src });
		img.src = 'https://example.test/replacement';
		await tick();
		expect(context).not.toHaveBeenCalled();
		stop();
		intersections[0]([{ isIntersecting: true }]);
		img.dispatchEvent(new Event('load'));
		await tick();
		expect(context).not.toHaveBeenCalled();
		expect(apply).toHaveBeenLastCalledWith(null);
		expect(disconnect).toHaveBeenCalled();
	});
	it('processes only one displayed attachment and spaces work across notes', async () => {
		const a = attachment('https://example.test/batch-a');
		const extra = image('https://example.test/unnecessary');
		a.media.append(extra);
		const b = attachment('https://example.test/batch-b');
		observe(a.host); observe(b.host);
		intersections.forEach(callback => callback([{ isIntersecting: true }]));
		await vi.advanceTimersByTimeAsync(32);
		expect(draw).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(32);
		expect(draw).toHaveBeenCalledTimes(2);
		expect(draw.mock.calls.map(call => call[0])).toEqual([a.img, b.img]);
	});
});
