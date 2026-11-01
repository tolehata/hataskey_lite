/* SPDX-License-Identifier: AGPL-3.0-only */

export const IMAGE_EDGE_SIDES = ['left', 'right', 'top', 'bottom'] as const;
type Side = typeof IMAGE_EDGE_SIDES[number];
type Color = readonly [number, number, number];
export type ImageEdgeTint = Record<Side, Color | null>;
export type ImageEdgeTintGeometry = Readonly<{
	left: number; top: number; width: number; height: number;
	centerX: number; centerY: number;
	visibleEdges: Readonly<Record<Side, boolean>>;
}>;
export type ImageEdgeTintOptions = {
	geometry?: { relativeTo: HTMLElement; apply: (geometry: ImageEdgeTintGeometry | null) => void };
};

/** The outer 8% only; transparent, near-neutral and extreme lightness pixels do not tint. */
export function extractImageEdges(data: Uint8ClampedArray, width: number, height: number): ImageEdgeTint {
	if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) {
		throw new Error('Invalid pixel buffer');
	}
	const edgeX = Math.max(1, Math.round(width * 0.08));
	const edgeY = Math.max(1, Math.round(height * 0.08));
	const group = () => ({ total: 0, bins: Array.from({ length: 12 }, () => ({ count: 0, weight: 0, rgb: [0, 0, 0] })) });
	const groups = { left: group(), right: group(), top: group(), bottom: group(), all: group() };
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		const sides: (Side | 'all')[] = [];
		if (x < edgeX) sides.push('left');
		if (x >= width - edgeX) sides.push('right');
		if (y < edgeY) sides.push('top');
		if (y >= height - edgeY) sides.push('bottom');
		if (!sides.length) continue;
		sides.push('all');
		for (const side of sides) groups[side].total++;
		const offset = (y * width + x) * 4;
		if (data[offset + 3] < 224) continue;
		const rgb = [data[offset], data[offset + 1], data[offset + 2]];
		const hi = Math.max(...rgb), lo = Math.min(...rgb), delta = hi - lo;
		const saturation = hi ? delta / hi : 0;
		const brightness = (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
		if (saturation < 0.18 || brightness < 0.12 || brightness > 0.9) continue;
		let hue = hi === rgb[0] ? (rgb[1] - rgb[2]) / delta : hi === rgb[1] ? (rgb[2] - rgb[0]) / delta + 2 : (rgb[0] - rgb[1]) / delta + 4;
		hue = ((hue * 60) % 360 + 360) % 360;
		const index = Math.min(11, Math.floor(hue / 30));
		const weight = 0.5 + saturation * 0.5;
		for (const side of sides) {
			const bin = groups[side].bins[index];
			bin.count++;
			bin.weight += weight;
			for (let channel = 0; channel < 3; channel++) bin.rgb[channel] += rgb[channel] * weight;
		}
	}

	function dominant(value: ReturnType<typeof group>): Color | null {
		const bin = value.bins.reduce((best, candidate) => candidate.weight > best.weight ? candidate : best);
		if (bin.count < Math.max(2, value.total * 0.03)) return null;
		return bin.rgb.map(channel => Math.round(Math.min(255, Math.max(0, channel / bin.weight)))) as [number, number, number];
	}

	const fallback = dominant(groups.all);
	return { left: dominant(groups.left) ?? fallback, right: dominant(groups.right) ?? fallback, top: dominant(groups.top) ?? fallback, bottom: dominant(groups.bottom) ?? fallback };
}

/** Cache only palettes/failures, never pixels or image elements; no fetch or decode. */
export function createImageEdgeTintReader(cacheLimit = 128) {
	const cache = new Map<string, ImageEdgeTint | null>();
	const limit = Math.max(1, Math.min(128, cacheLimit));
	return (image: HTMLImageElement): ImageEdgeTint | null => {
		if (!image.complete || !image.naturalWidth || !image.naturalHeight || !image.currentSrc || image.currentSrc !== image.src) return null;
		const key = `${image.currentSrc}\n${image.naturalWidth}x${image.naturalHeight}`;
		if (cache.has(key)) {
			const cached = cache.get(key) ?? null;
			cache.delete(key);
			cache.set(key, cached);
			return cached;
		}
		let tint: ImageEdgeTint | null = null;
		const canvas = window.document.createElement('canvas');
		try {
			canvas.width = canvas.height = 64;
			const context = canvas.getContext('2d', { willReadFrequently: true });
			if (context) {
				context.drawImage(image, 0, 0, 64, 64);
				const edges = extractImageEdges(context.getImageData(0, 0, 64, 64).data, 64, 64);
				if (IMAGE_EDGE_SIDES.some(side => edges[side])) tint = edges;
			}
		} catch {
			// A tainted canvas (CORS) or unavailable canvas leaves the background untinted.
		} finally {
			canvas.width = canvas.height = 0;
		}
		cache.set(key, tint);
		const oldest = cache.keys().next().value;
		if (cache.size > limit && oldest !== undefined) cache.delete(oldest);
		return tint;
	};
}

const readImage = createImageEdgeTintReader();
const jobs = new Set<() => void>();
let timer: number | undefined;

// At most one 64px canvas per deferred turn, even when many notes enter the viewport.
function enqueue(job: () => void) {
	jobs.add(job);
	if (timer !== undefined) return;
	timer = window.setTimeout(() => {
		timer = undefined;
		const next = jobs.values().next().value;
		if (!next) return;
		jobs.delete(next);
		next();
		const following = jobs.values().next().value;
		if (following) enqueue(following);
	}, 32);
}

type Bounds = { left: number; top: number; right: number; bottom: number; width: number; height: number };

function paintedBounds(image: HTMLImageElement): Bounds {
	const element = image.getBoundingClientRect();
	const style = window.getComputedStyle(image);
	if (style.objectFit !== 'contain' || !image.naturalWidth || !image.naturalHeight || !element.width || !element.height) return element;
	const scale = Math.min(element.width / image.naturalWidth, element.height / image.naturalHeight);
	const width = image.naturalWidth * scale;
	const height = image.naturalHeight * scale;
	const left = element.left + (element.width - width) / 2;
	const top = element.top + (element.height - height) / 2;
	return { left, top, right: left + width, bottom: top + height, width, height };
}

function displayedBounds(image: HTMLImageElement, host: HTMLElement, checkViewport = true, clipBoundary?: HTMLElement): { painted: Bounds; visible: Bounds } | null {
	if (!host.isConnected || !host.contains(image) || !image.complete || !image.naturalWidth || !image.naturalHeight || !image.currentSrc || image.currentSrc !== image.src) return null;
	if (!image.closest('[data-is-hidden="false"]')) return null;
	const painted = paintedBounds(image);
	let left = checkViewport ? Math.max(0, painted.left) : painted.left;
	let right = checkViewport ? Math.min(window.innerWidth, painted.right) : painted.right;
	let top = checkViewport ? Math.max(0, painted.top) : painted.top;
	let bottom = checkViewport ? Math.min(window.innerHeight, painted.bottom) : painted.bottom;
	let insideClipBoundary = true;
	for (let element: HTMLElement | null = image; element; element = element.parentElement) {
		const style = window.getComputedStyle(element);
		if (element.hidden || element.inert || element.hasAttribute('inert') || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return null;
		if (element === image) continue;
		const clipX = /^(hidden|clip|auto|scroll)$/.test(style.overflowX || style.overflow);
		const clipY = /^(hidden|clip|auto|scroll)$/.test(style.overflowY || style.overflow);
		if ((checkViewport || insideClipBoundary) && (clipX || clipY)) {
			const clip = element.getBoundingClientRect();
			if (clipX) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
			if (clipY) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
		}
		if (element === (clipBoundary ?? host)) insideClipBoundary = false;
	}

	if (!(painted.width > 0 && painted.height > 0 && right > left && bottom > top)) return null;
	return { painted, visible: { left, top, right, bottom, width: right - left, height: bottom - top } };
}

function displayed(image: HTMLImageElement, host: HTMLElement, checkViewport = true, clipBoundary?: HTMLElement): boolean {
	return displayedBounds(image, host, checkViewport, clipBoundary) !== null;
}

function imageGeometry(image: HTMLImageElement, host: HTMLElement, reference: HTMLElement): ImageEdgeTintGeometry | null {
	const bounds = displayedBounds(image, host, false, reference);
	const referenceRect = reference.getBoundingClientRect();
	if (!bounds || !reference.isConnected || !referenceRect.width || !referenceRect.height || !reference.offsetWidth || !reference.offsetHeight) return null;
	const { painted, visible } = bounds;
	const scaleX = reference.offsetWidth / referenceRect.width;
	const scaleY = reference.offsetHeight / referenceRect.height;
	const visibleEdges = {
		left: visible.left <= painted.left + 0.25,
		right: visible.right >= painted.right - 0.25,
		top: visible.top <= painted.top + 0.25,
		bottom: visible.bottom >= painted.bottom - 0.25,
	};
	if (!Object.values(visibleEdges).some(Boolean)) return null;
	return {
		left: (painted.left - referenceRect.left) * scaleX,
		top: (painted.top - referenceRect.top) * scaleY,
		width: painted.width * scaleX,
		height: painted.height * scaleY,
		centerX: ((visible.left + visible.right) / 2 - referenceRect.left) * scaleX,
		centerY: ((visible.top + visible.bottom) / 2 - referenceRect.top) * scaleY,
		visibleEdges,
	};
}

/** Observe only the mounted attachment subtree. Placeholders/hidden sensitive images never qualify. */
export function observeImageEdgeTint(host: HTMLElement, apply: (tint: ImageEdgeTint | null) => void, options?: ImageEdgeTintOptions): () => void {
	let disposed = false;
	let selected: HTMLImageElement | null = null;
	let selectedSrc = '';
	let lastGeometry: ImageEdgeTintGeometry | null = null;
	const observed = new Set<HTMLImageElement>();
	const visible = new Set<Element>();
	let intersection: IntersectionObserver | null = null;
	const resize = options?.geometry && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
	if (resize) {
		for (let element: HTMLElement | null = host; element; element = element.parentElement) {
			resize.observe(element);
			if (element === options!.geometry!.relativeTo) break;
		}
	}

	function updateGeometry(image: HTMLImageElement | null) {
		const output = options?.geometry;
		if (!output) return;
		const geometry = image ? imageGeometry(image, host, output.relativeTo) : null;
		if (geometry === null && lastGeometry === null) return;
		const keys = ['left', 'top', 'width', 'height', 'centerX', 'centerY'] as const;
		if (geometry && lastGeometry && keys.every(key => Math.abs(geometry[key] - lastGeometry![key]) < 0.25) && IMAGE_EDGE_SIDES.every(side => geometry.visibleEdges[side] === lastGeometry!.visibleEdges[side])) return;
		lastGeometry = geometry;
		output.apply(geometry);
	}

	function candidate(): HTMLImageElement | null {
		for (const image of observed) {
			if ((!intersection || visible.has(image)) && displayed(image, host)) return image;
		}
		return null;
	}

	function run() {
		if (disposed) return;
		// One already displayed attachment, in attachment order; do not decode the rest.
		const image = candidate();
		if (!image) return;
		selected = image;
		selectedSrc = image.currentSrc;
		const tint = readImage(image);
		apply(tint);
		updateGeometry(tint ? image : null);
	}

	function schedule() {
		if (disposed) return;
		// Keep a safe palette while scrolled out; immediately clear it on hide/source changes.
		if (selected && (!displayed(selected, host, false, options?.geometry?.relativeTo) || selected.currentSrc !== selectedSrc)) {
			selected = null;
			apply(null);
			updateGeometry(null);
		}
		if (selected && (!intersection || visible.has(selected))) updateGeometry(selected);
		if (!intersection || visible.size) enqueue(run);
		else jobs.delete(run);
	}

	function syncImages() {
		const images = new Set(host.querySelectorAll<HTMLImageElement>('img[data-marker]'));
		for (const image of observed) {
			if (images.has(image)) continue;
			intersection?.unobserve(image);
			resize?.unobserve(image);
			observed.delete(image);
			visible.delete(image);
		}
		for (const image of images) {
			if (observed.has(image)) continue;
			observed.add(image);
			intersection?.observe(image);
			resize?.observe(image);
		}
	}

	intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
		if (disposed) return;
		for (const entry of entries) {
			if (!observed.has(entry.target as HTMLImageElement)) continue;
			if (entry.isIntersecting) visible.add(entry.target);
			else visible.delete(entry.target);
		}
		schedule();
	});
	const mutations = new MutationObserver(() => { syncImages(); schedule(); });
	mutations.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'style', 'class', 'data-is-hidden', 'data-marker', 'hidden', 'inert'] });
	// Visibility changes above the attachment (CW/thread/tab) need no subtree-wide observer.
	const ancestors = new MutationObserver(schedule);
	for (let element = host.parentElement; element; element = element.parentElement) {
		ancestors.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'hidden', 'inert', 'data-active', 'data-open', 'data-thread-open'] });
	}
	host.addEventListener('load', schedule, true);
	host.addEventListener('error', schedule, true);
	if (!intersection) window.addEventListener('scroll', schedule, true);
	window.addEventListener('resize', schedule);
	options?.geometry?.relativeTo.addEventListener('transitionend', schedule);
	syncImages();
	schedule();

	return () => {
		if (disposed) return;
		disposed = true;
		jobs.delete(run);
		mutations.disconnect();
		ancestors.disconnect();
		intersection?.disconnect();
		resize?.disconnect();
		observed.clear();
		visible.clear();
		host.removeEventListener('load', schedule, true);
		host.removeEventListener('error', schedule, true);
		if (!intersection) window.removeEventListener('scroll', schedule, true);
		window.removeEventListener('resize', schedule);
		options?.geometry?.relativeTo.removeEventListener('transitionend', schedule);
		apply(null);
		updateGeometry(null);
	};
}
