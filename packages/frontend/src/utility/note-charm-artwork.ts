/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import type { NoteCharm } from './note-charm-physics.js';

export type CharmArtwork = {
	height: number;
	image: { x: number; y: number; width: number; height: number };
	outline: string;
	highlight: string;
	tab: string;
	kind: 'plate' | 'silhouette' | 'cutout';
};

type Point = { x: number; y: number };
type Contour = { points: Point[]; area: number };
type Shape = Pick<CharmArtwork, 'outline' | 'highlight' | 'tab'>;
type Asset = {
	naturalWidth: number;
	naturalHeight: number;
	bounds: { x: number; y: number; width: number; height: number };
	shaped: boolean;
	canvas: HTMLCanvasElement | null;
};

const SCALE = 3;
const MAX_ASSET_EDGE = 384;
const ASSET_CACHE_LIMIT = 32;
const LAYOUT_CACHE_LIMIT = 64;
const MAX_CONTOUR_EDGES = 8000;
const MAX_CONTOURS = 24;
const MAX_BRIDGE_COMPARISONS = 120000;
const assetCache = new Map<string, Promise<Asset | null>>();
const layoutCache = new Map<string, Promise<CharmArtwork>>();
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const normalizeSize = (size: number) => clamp(Number.isFinite(size) ? size : 60, 48, 64);

// A bounded raster and a circular 2.8px expansion give the approved acrylic lip.
const dilationOffsets: Point[] = [];
for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
	if (x * x + y * y <= (2.8 * SCALE) ** 2) dilationOffsets.push({ x, y });
}

function remember<T>(cache: Map<string, T>, key: string, value: T, limit: number): T {
	cache.delete(key);
	cache.set(key, value);
	while (cache.size > limit) cache.delete(cache.keys().next().value!);
	return value;
}

function cached<T>(cache: Map<string, T>, key: string): T | undefined {
	const value = cache.get(key);
	if (value !== undefined) { cache.delete(key); cache.set(key, value); }
	return value;
}

function plate(size: number, pattern: NoteCharm['pattern'], asset?: Asset): CharmArtwork {
	const cutout = pattern === 'cutout';
	let height: number, image: CharmArtwork['image'];
	if (asset) {
		const margin = cutout ? 1 : asset.shaped ? 3 : 4;
		const artWidth = Math.min(size - margin * 2, 96 * asset.bounds.width / asset.bounds.height);
		const scale = artWidth / asset.bounds.width;
		height = Math.max(40, asset.bounds.height * scale + 14);
		image = {
			x: (size - artWidth) / 2 - asset.bounds.x * scale,
			y: 10 - asset.bounds.y * scale,
			width: asset.naturalWidth * scale,
			height: asset.naturalHeight * scale,
		};
	} else {
		height = size * 1.15 + 7;
		image = { x: cutout ? 1 : 4, y: cutout ? 8 : 10, width: size - (cutout ? 2 : 8), height: height - (cutout ? 10 : 14) };
	}
	const c = size / 2, bottom = height - 1, right = size - .7;
	return {
		height,
		image,
		outline: `M ${c - 4} 6 L ${c - 4} 3.7 Q ${c - 4} .7 ${c} .7 Q ${c + 4} .7 ${c + 4} 3.7 L ${c + 4} 6 L ${size - 5} 6 Q ${right} 6 ${right} 10.3 L ${right} ${bottom - 4.3} Q ${right} ${bottom} ${size - 5} ${bottom} L 5 ${bottom} Q .7 ${bottom} .7 ${bottom - 4.3} L .7 10.3 Q .7 6 5 6 Z`,
		highlight: 'M 2.1 22 L 2.1 11 Q 2.1 7.4 6 7.4 L 15 7.4',
		tab: `M ${c - 4} 11 L ${c - 4} 3.7 Q ${c - 4} .7 ${c} .7 Q ${c + 4} .7 ${c + 4} 3.7 L ${c + 4} 11 Z`,
		kind: cutout ? 'cutout' : 'plate',
	};
}

/** Immediate display geometry while the image is pending or cannot be inspected. */
export function createCharmArtwork(size: number, pattern: NoteCharm['pattern']): CharmArtwork {
	return plate(normalizeSize(size), pattern);
}

function traceOuter(mask: Uint8Array, width: number, height: number): Contour[] | null {
	const edges = new Map<number, Point[]>();
	const key = (x: number, y: number) => y * (width + 1) + x;
	let edgeCount = 0;
	const put = (x: number, y: number, nx: number, ny: number) => {
		const k = key(x, y), list = edges.get(k) ?? [];
		list.push({ x: nx, y: ny });
		edges.set(k, list);
		edgeCount++;
	};
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		if (!mask[y * width + x]) continue;
		if (!y || !mask[(y - 1) * width + x]) put(x, y, x + 1, y);
		if (x === width - 1 || !mask[y * width + x + 1]) put(x + 1, y, x + 1, y + 1);
		if (y === height - 1 || !mask[(y + 1) * width + x]) put(x + 1, y + 1, x, y + 1);
		if (!x || !mask[y * width + x - 1]) put(x, y + 1, x, y);
		if (edgeCount > MAX_CONTOUR_EDGES) return null;
	}
	const loops: Contour[] = [];
	while (edges.size) {
		const start = edges.keys().next().value!;
		let k = start, count = 0;
		const points = [{ x: k % (width + 1), y: Math.floor(k / (width + 1)) }];
		do {
			const choices = edges.get(k);
			if (!choices?.length) break;
			const next = choices.pop()!;
			if (!choices.length) edges.delete(k);
			k = key(next.x, next.y);
			points.push(next);
		} while (k !== start && ++count < MAX_CONTOUR_EDGES);
		if (k !== start || points.length < 4) continue;
		const area = points.slice(1).reduce((sum, p, i) => sum + points[i].x * p.y - p.x * points[i].y, 0) / 2;
		if (area > 0) loops.push({ points: points.slice(0, -1), area });
		if (loops.length > MAX_CONTOURS) return null;
	}
	return loops.sort((a, b) => b.area - a.area);
}

// Iterative Ramer-Douglas-Peucker preserves the mock's tolerance without deep recursion.
function simplifyLine(points: Point[], tolerance: number): Point[] {
	if (points.length < 3) return points;
	const retained = new Set([0, points.length - 1]);
	const pending = [[0, points.length - 1]];
	while (pending.length) {
		const [first, last] = pending.pop()!;
		const a = points[first], b = points[last], dx = b.x - a.x, dy = b.y - a.y;
		let maximum = 0, pivot = 0;
		for (let i = first + 1; i < last; i++) {
			const p = points[i], t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
			const distance = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
			if (distance > maximum) { maximum = distance; pivot = i; }
		}
		if (maximum <= tolerance) continue;
		retained.add(pivot);
		pending.push([first, pivot], [pivot, last]);
	}
	return [...retained].sort((a, b) => a - b).map(index => points[index]);
}

/** Convert a 3x display alpha raster into one connected, smooth support plate. */
export function createCharmSilhouette(alpha: Uint8Array, width: number, rows: number, size: number, height: number): Shape | null {
	if (!Number.isInteger(width) || !Number.isInteger(rows) || width < 1 || rows < 1 || width > 192 || rows > 330 || alpha.length !== width * rows || !Number.isFinite(size) || !Number.isFinite(height)) return null;
	const mask = new Uint8Array(width * rows);
	for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) {
		if (alpha[y * width + x] < 20) continue;
		for (const offset of dilationOffsets) {
			const nx = x + offset.x, ny = y + offset.y;
			if (nx > 0 && nx < width - 1 && ny > 0 && ny < rows - 1) mask[ny * width + nx] = 1;
		}
	}
	const paintBridge = (a: Point, b: Point, radius: number) => {
		const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
		for (let step = 0; step <= steps; step++) {
			const cx = a.x + (b.x - a.x) * step / steps, cy = a.y + (b.y - a.y) * step / steps;
			for (let y = Math.floor(cy - radius); y <= cy + radius; y++) for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
				if (x > 0 && x < width - 1 && y > 1 && y < rows - 1 && (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) mask[y * width + x] = 1;
			}
		}
	};
	let loops = traceOuter(mask, width, rows);
	if (!loops?.length) return null;
	let comparisons = 0;
	for (const component of loops.slice(1)) {
		let distance = Infinity, pair: [Point, Point] | undefined;
		for (let i = 0; i < loops[0].points.length; i += 3) for (let j = 0; j < component.points.length; j += 3) {
			if (++comparisons > MAX_BRIDGE_COMPARISONS) return null;
			const a = loops[0].points[i], b = component.points[j], d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
			if (d < distance) { distance = d; pair = [a, b]; }
		}
		if (pair) paintBridge(pair[0], pair[1], SCALE * 1.6);
	}
	const tab = { x: size / 2 * SCALE, y: 3.5 * SCALE };
	let nearest = loops[0].points[0], distance = Infinity;
	for (const point of loops[0].points) {
		const d = (point.x - tab.x) ** 2 + (point.y - tab.y) ** 2;
		if (d < distance) { distance = d; nearest = point; }
	}
	paintBridge(tab, nearest, SCALE * 3.3);
	loops = traceOuter(mask, width, rows);
	if (!loops?.length || loops.length !== 1) return null;
	const points = loops[0].points, midway = Math.floor(points.length / 2);
	const polygon = [
		...simplifyLine(points.slice(0, midway + 1), SCALE * .3).slice(0, -1),
		...simplifyLine([...points.slice(midway), points[0]], SCALE * .3).slice(0, -1),
	].map(p => ({ x: p.x / SCALE, y: p.y / SCALE }));
	if (polygon.length < 4) return null;
	const middle = (a: Point, b: Point) => `${((a.x + b.x) / 2).toFixed(2)} ${((a.y + b.y) / 2).toFixed(2)}`;
	const outline = `M ${middle(polygon.at(-1)!, polygon[0])} ${polygon.map((p, i) => `Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${middle(p, polygon[(i + 1) % polygon.length])}`).join(' ')} Z`;
	const minimum = Math.min(...polygon.map(p => p.x));
	const start = polygon.reduce((best, p, i, list) => Math.hypot(p.x - minimum, p.y - height * .3) < Math.hypot(list[best].x - minimum, list[best].y - height * .3) ? i : best, 0);
	const portion: Point[] = [];
	let travel = 0;
	for (let n = 0; n < polygon.length && travel < 10; n++) {
		const p = polygon[(start + n) % polygon.length];
		if (portion.length) travel += Math.hypot(p.x - portion.at(-1)!.x, p.y - portion.at(-1)!.y);
		portion.push(p);
	}
	const c = size / 2, tx = nearest.x / SCALE, ty = nearest.y / SCALE;
	return {
		outline,
		highlight: portion.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
		tab: `M ${c - 3.3} 5.6 L ${c - 3.3} 3.7 Q ${c - 3.3} .7 ${c} .7 Q ${c + 3.3} .7 ${c + 3.3} 3.7 L ${c + 3.3} 5.6 L ${tx + 2.3} ${ty + 2} Q ${tx} ${ty + 4} ${tx - 2.3} ${ty + 2} Z`,
	};
}

function inspectAsset(image: HTMLImageElement): Asset | null {
	const naturalWidth = image.naturalWidth, naturalHeight = image.naturalHeight;
	if (!naturalWidth || !naturalHeight) return null;
	const asset: Asset = { naturalWidth, naturalHeight, bounds: { x: 0, y: 0, width: naturalWidth, height: naturalHeight }, shaped: false, canvas: null };
	try {
		const ratio = Math.min(1, MAX_ASSET_EDGE / Math.max(naturalWidth, naturalHeight));
		const canvas = window.document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(naturalWidth * ratio));
		canvas.height = Math.max(1, Math.round(naturalHeight * ratio));
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return asset;
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
		let left = canvas.width, top = canvas.height, right = -1, bottom = -1, transparent = 0;
		for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
			if (rgba[(y * canvas.width + x) * 4 + 3] < 16) transparent++;
			else { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
		}
		if (right < left || bottom < top) return null;
		asset.shaped = transparent / (canvas.width * canvas.height) > .08;
		if (asset.shaped) {
			asset.bounds = { x: left / canvas.width * naturalWidth, y: top / canvas.height * naturalHeight, width: (right - left + 1) / canvas.width * naturalWidth, height: (bottom - top + 1) / canvas.height * naturalHeight };
			// Keep only this <=384px raster, never the original full-resolution image.
			asset.canvas = canvas;
		}
	} catch { /* Pixels may be unavailable under CORS/CSP; retain natural aspect ratio. */ }
	return asset;
}

function getAsset(url: string): Promise<Asset | null> {
	const hit = cached(assetCache, url);
	if (hit) return hit;
	const promise = new Promise<Asset | null>(resolve => {
		if (typeof Image === 'undefined') { resolve(null); return; }
		const image = new Image();
		let finished = false;
		const finish = (asset: Asset | null) => {
			if (finished) return;
			finished = true;
			window.clearTimeout(timer);
			image.onload = image.onerror = null;
			resolve(asset);
		};
		const timer = window.setTimeout(() => finish(null), 15000);
		image.crossOrigin = 'anonymous';
		image.decoding = 'async';
		image.onload = () => finish(inspectAsset(image));
		image.onerror = () => finish(null);
		try { image.src = url; } catch { finish(null); }
	}).catch(() => null);
	remember(assetCache, url, promise, ASSET_CACHE_LIMIT);
	void promise.then(asset => { if (!asset && assetCache.get(url) === promise) assetCache.delete(url); });
	return promise;
}

function fromAsset(asset: Asset, size: number, pattern: NoteCharm['pattern']): CharmArtwork {
	const margin = pattern === 'cutout' ? 1 : asset.shaped ? 3 : 4;
	const scale = Math.min((size - margin * 2) / asset.bounds.width, 96 / asset.bounds.height);
	// The original <img> retains its transparent/low-alpha padding and shadows.
	// Do not expand its CSS/filter surface beyond the raster we inspect. Extreme
	// padding falls back to fitting the original image, preserving its animation.
	if (Math.max(asset.naturalWidth, asset.naturalHeight) * scale > MAX_ASSET_EDGE) {
		asset = {
			...asset,
			bounds: { x: 0, y: 0, width: asset.naturalWidth, height: asset.naturalHeight },
			shaped: false,
			canvas: null,
		};
	}
	const artwork = plate(size, pattern, asset);
	if (!asset.shaped || !asset.canvas) return artwork;
	try {
		const canvas = window.document.createElement('canvas');
		canvas.width = Math.ceil(size * SCALE);
		canvas.height = Math.ceil(artwork.height * SCALE);
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return artwork;
		const { x, y, width, height } = artwork.image;
		ctx.drawImage(asset.canvas, x * SCALE, y * SCALE, width * SCALE, height * SCALE);
		const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
		const alpha = new Uint8Array(canvas.width * canvas.height);
		for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
		const shape = createCharmSilhouette(alpha, canvas.width, canvas.height, size, artwork.height);
		if (shape) return { ...artwork, ...shape, kind: pattern === 'cutout' ? 'cutout' : 'silhouette' };
	} catch { /* A readable image can still exceed a browser's canvas limits. */ }
	return artwork;
}

/** Shared bounded preparation; failure always leaves a usable, unmodified <img>. */
export async function loadCharmArtwork(url: string, size: number, pattern: NoteCharm['pattern']): Promise<CharmArtwork> {
	const width = normalizeSize(size);
	if (!url) return createCharmArtwork(width, pattern);
	const key = JSON.stringify([url, width, pattern === 'cutout']);
	const hit = cached(layoutCache, key);
	if (hit) return hit;
	let failed = false;
	const promise = getAsset(url).then(asset => {
		if (!asset) { failed = true; return createCharmArtwork(width, pattern); }
		return fromAsset(asset, width, pattern);
	}).catch(() => { failed = true; return createCharmArtwork(width, pattern); });
	remember(layoutCache, key, promise, LAYOUT_CACHE_LIMIT);
	const result = await promise;
	if (failed && layoutCache.get(key) === promise) layoutCache.delete(key);
	return result;
}
