/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createStore, promisifyRequest } from 'idb-keyval';

const IMAGE_PREFIX = 'note-charm-image:v1:';
const INDEX_KEY = 'note-charm-images:v1:index';
const MAX_IMAGES = 64;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RETRY_AFTER = 30_000;
const REQUEST_TIMEOUT = 15_000;

// Use the default idb-keyval database so the existing sign-out clears these
// blobs too. idb-proxy's localStorage fallback cannot preserve binary data.
const useStore = createStore('keyval-store', 'keyval');

type StoredImage = { key: string; size: number; lastUsed: number };
type ImageResult = { url: string; size: number; retryAt?: number };
type MemoryImage = { pending: Promise<ImageResult>; result?: ImageResult; references: number };

export type NoteCharmImageLease = { url: string; release(): void };

const images = new Map<string, MemoryImage>();

function validBlob(value: unknown): value is Blob {
	return value instanceof Blob && value.size > 0 && value.size <= MAX_IMAGE_BYTES && /^image\/(?:png|jpeg|webp|gif|avif)$/i.test(value.type);
}

function readIndex(value: unknown): StoredImage[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is StoredImage => item != null &&
		typeof item.key === 'string' && item.key.startsWith(IMAGE_PREFIX) &&
		Number.isFinite(item.size) && item.size > 0 && item.size <= MAX_IMAGE_BYTES &&
		Number.isFinite(item.lastUsed));
}

async function touchStoredImage(store: IDBObjectStore, key: string, blob: Blob): Promise<void> {
	const index = readIndex(await promisifyRequest(store.get(INDEX_KEY))).filter(item => item.key !== key);
	index.push({ key, size: blob.size, lastUsed: Date.now() });
	index.sort((a, b) => a.lastUsed - b.lastUsed);
	let bytes = index.reduce((total, item) => total + item.size, 0);
	while (index.length > MAX_IMAGES || bytes > MAX_BYTES) {
		const oldest = index.shift();
		if (!oldest) break;
		bytes -= oldest.size;
		store.delete(oldest.key);
	}
	store.put(index, INDEX_KEY);
}

async function readStoredImage(key: string): Promise<Blob | null> {
	try {
		return await useStore('readwrite', store => Promise.all([
			promisifyRequest(store.transaction),
			(async () => {
				const blob: unknown = await promisifyRequest(store.get(key));
				if (!validBlob(blob)) return null;
				await touchStoredImage(store, key, blob);
				return blob;
			})(),
		]).then(([, blob]) => blob));
	} catch {
		return null;
	}
}

async function writeStoredImage(key: string, blob: Blob): Promise<void> {
	try {
		// Updating the index and evicting blobs in the same transaction also
		// serializes writes from separate tabs without a stale-index overwrite.
		await useStore('readwrite', store => Promise.all([
			promisifyRequest(store.transaction),
			(async () => {
				store.put(blob, key);
				await touchStoredImage(store, key, blob);
			})(),
		]));
	} catch {
		// Quota/private-mode failures must not prevent the in-memory image.
	}
}

async function fetchImage(url: string): Promise<Blob> {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
	try {
		const response = await window.fetch(url, { credentials: 'omit', mode: 'cors', signal: controller.signal });
		const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
		if (!response.ok || !/^image\/(?:png|jpeg|webp|gif|avif)$/.test(type)) throw new Error('Invalid charm image response');
		if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new Error('Charm image is too large');
		let blob: Blob;
		if (response.body) {
			const reader = response.body.getReader();
			const chunks: Uint8Array<ArrayBuffer>[] = [];
			let size = 0;
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					size += value.byteLength;
					if (size > MAX_IMAGE_BYTES) throw new Error('Charm image is too large');
					chunks.push(new Uint8Array(value));
				}
			} catch (error) {
				void reader.cancel().catch(() => {});
				throw error;
			} finally {
				reader.releaseLock();
			}
			blob = new Blob(chunks, { type });
		} else {
			blob = await response.blob();
		}
		if (!validBlob(blob)) throw new Error('Invalid charm image');
		return blob;
	} finally {
		window.clearTimeout(timeout);
		controller.abort();
	}
}

async function resolveImage(url: string): Promise<ImageResult> {
	try {
		const key = IMAGE_PREFIX + url;
		let blob = await readStoredImage(key);
		if (!blob) {
			blob = await fetchImage(url);
			await writeStoredImage(key, blob);
		}
		return { url: URL.createObjectURL(blob), size: blob.size };
	} catch {
		// A cross-origin image may be displayable by <img> even when CORS blocks
		// reading its bytes. Keep that existing display path as the fallback.
		return { url, size: 0, retryAt: Date.now() + RETRY_AFTER };
	}
}

function pruneMemory(): void {
	const inactive = [...images].flatMap(([key, entry]) => entry.references === 0 && entry.result ? [{ key, result: entry.result }] : []);
	let bytes = inactive.reduce((total, { result }) => total + result.size, 0);
	let count = inactive.length;
	for (const { key, result } of inactive) {
		if (count <= MAX_IMAGES && bytes <= MAX_BYTES) break;
		count--;
		bytes -= result.size;
		images.delete(key);
		if (!result.retryAt) URL.revokeObjectURL(result.url);
	}
}

/** Call after choosing the original/static variant; release once display and
 * any canvas inspection have both stopped using the returned URL. */
export async function acquireNoteCharmImage(url: string): Promise<NoteCharmImageLease> {
	if (/^(?:blob:|data:)/i.test(url)) return { url, release() {} };
	let key: string;
	try {
		const parsed = new URL(url, window.location.href);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { url, release() {} };
		key = parsed.href;
	} catch {
		return { url, release() {} };
	}
	let entry = images.get(key);
	if (entry?.result?.retryAt && entry.result.retryAt <= Date.now()) {
		images.delete(key);
		entry = undefined;
	}
	if (!entry) {
		entry = { pending: resolveImage(key), references: 0 };
		images.set(key, entry);
	}
	const current = entry;
	current.references++;
	// Map insertion order is the memory LRU. Active leases are never evicted.
	images.delete(key);
	images.set(key, current);
	const result = await current.pending;
	current.result = result;
	pruneMemory();
	let released = false;
	return {
		url: result.url,
		release() {
			if (released) return;
			released = true;
			current.references--;
			pruneMemory();
		},
	};
}
