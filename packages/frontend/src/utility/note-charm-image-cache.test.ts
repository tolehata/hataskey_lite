/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => ({ values: new Map<IDBValidKey, unknown>(), unavailable: false, quota: false }));

// Only the browser storage boundary is replaced. Request/transaction promises use
// idb-keyval itself; real IndexedDB persistence is covered by the browser check.
vi.mock('idb-keyval', async importOriginal => ({
	...await importOriginal<typeof import('idb-keyval')>(),
	createStore: () => async (_mode: IDBTransactionMode, callback: (store: IDBObjectStore) => unknown) => {
		if (storage.unavailable) throw new Error('storage unavailable');
		const pending = new Map(storage.values);
		let timer: number | undefined;
		const transaction = { oncomplete: null, onerror: null, onabort: null, error: null } as unknown as IDBTransaction;

		function finish() {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				if (storage.quota) {
					Object.defineProperty(transaction, 'error', { value: new Error('quota exceeded') });
					transaction.onabort?.call(transaction, new Event('abort'));
				} else {
					storage.values = pending;
					transaction.oncomplete?.call(transaction, new Event('complete'));
				}
			}, 0);
		}

		function request(value: unknown) {
			const result = { result: value, onsuccess: null } as unknown as IDBRequest;
			queueMicrotask(() => { result.onsuccess?.call(result, new Event('success')); finish(); });
			return result;
		}

		const store = {
			transaction,
			get: (key: IDBValidKey) => request(pending.get(key)),
			put: (value: unknown, key: IDBValidKey) => { pending.set(key, value); return request(key); },
			delete: (key: IDBValidKey) => { pending.delete(key); return request(undefined); },
		} as unknown as IDBObjectStore;
		return callback(store);
	},
}));

const fetchMock = vi.fn<typeof fetch>();
const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();
const image = (size = 8) => new Blob([new Uint8Array(size)], { type: 'image/png' });
const response = (blob = image()) => ({ ok: true, headers: new Headers({ 'content-type': blob.type }), body: null, blob: async () => blob }) as Response;
const load = () => import('./note-charm-image-cache.js');

beforeEach(() => {
	vi.resetModules();
	storage.values.clear();
	storage.unavailable = false;
	storage.quota = false;
	fetchMock.mockReset().mockImplementation(async () => response());
	createObjectURL.mockReset().mockImplementation(() => `blob:charm-${createObjectURL.mock.calls.length}`);
	revokeObjectURL.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('URL', class extends URL {
		static createObjectURL = createObjectURL;
		static revokeObjectURL = revokeObjectURL;
	});
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('note charm image cache', () => {
	test('shares one fetch and one object URL for concurrent charms', async () => {
		const { acquireNoteCharmImage } = await load();
		const [first, second] = await Promise.all([
			acquireNoteCharmImage('https://example.test/shared.png'),
			acquireNoteCharmImage('https://example.test/shared.png'),
		]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('https://example.test/shared.png', expect.objectContaining({ credentials: 'omit' }));
		expect(first.url).toMatch(/^blob:/);
		expect(second.url).toBe(first.url);
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		first.release();
		first.release();
		expect(revokeObjectURL).not.toHaveBeenCalled();
		second.release();
	});

	test('uses the persisted blob after module reload without fetching again', async () => {
		const first = await (await load()).acquireNoteCharmImage('https://example.test/persist.png');
		first.release();
		vi.resetModules();
		const second = await (await load()).acquireNoteCharmImage('https://example.test/persist.png');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(second.url).toMatch(/^blob:/);
		expect(createObjectURL).toHaveBeenCalledTimes(2);
		second.release();
	});

	test('keeps changed URLs and static variants separate', async () => {
		const { acquireNoteCharmImage } = await load();
		for (const url of ['https://example.test/image.png?v=1', 'https://example.test/image.png?v=2', 'https://example.test/image.png?v=2&static=1']) {
			(await acquireNoteCharmImage(url)).release();
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	test.each(['blob:preview-image', 'data:image/png;base64,AA=='])('passes local image %s through untouched', async url => {
		const lease = await (await load()).acquireNoteCharmImage(url);
		expect(lease.url).toBe(url);
		lease.release();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(createObjectURL).not.toHaveBeenCalled();
		expect(storage.values.size).toBe(0);
	});

	test.each(['unavailable', 'quota'] as const)('keeps memory reuse when storage is %s', async failure => {
		storage[failure] = true;
		const { acquireNoteCharmImage } = await load();
		const first = await acquireNoteCharmImage('https://example.test/no-storage.png');
		first.release();
		const second = await acquireNoteCharmImage('https://example.test/no-storage.png');
		expect(second.url).toBe(first.url);
		expect(second.url).toMatch(/^blob:/);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		second.release();
	});

	test('falls back after fetch failure and retries only after a short cooldown', async () => {
		storage.unavailable = true;
		vi.useFakeTimers();
		fetchMock.mockRejectedValueOnce(new TypeError('CORS denied'));
		const { acquireNoteCharmImage } = await load();
		const url = 'https://example.test/cors.png';
		const first = await acquireNoteCharmImage(url);
		expect(first.url).toBe(url);
		first.release();
		(await acquireNoteCharmImage(url)).release();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(31_000);
		const retry = await acquireNoteCharmImage(url);
		expect(retry.url).toMatch(/^blob:/);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		retry.release();
	});

	test.each([
		new Blob(['not an image'], { type: 'text/html' }),
		image(5 * 1024 * 1024 + 1),
	])('does not cache an invalid or oversized image', async blob => {
		fetchMock.mockResolvedValue(response(blob));
		const lease = await (await load()).acquireNoteCharmImage('https://example.test/rejected.png');
		expect(lease.url).toBe('https://example.test/rejected.png');
		expect(createObjectURL).not.toHaveBeenCalled();
		expect([...storage.values.values()].some(value => value instanceof Blob)).toBe(false);
		lease.release();
	});

	test('rejects unsuccessful image responses without creating an object URL', async () => {
		fetchMock.mockResolvedValue({ ...response(), ok: false, status: 404 } as Response);
		const lease = await (await load()).acquireNoteCharmImage('https://example.test/missing.png');
		expect(lease.url).toBe('https://example.test/missing.png');
		expect(createObjectURL).not.toHaveBeenCalled();
		lease.release();
	});

	test('stops an oversized streamed response even without a content-length header', async () => {
		const cancel = vi.fn();
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(3 * 1024 * 1024));
				controller.enqueue(new Uint8Array(3 * 1024 * 1024));
			},
			cancel,
		});
		fetchMock.mockResolvedValue({ ...response(), body } as Response);
		const lease = await (await load()).acquireNoteCharmImage('https://example.test/stream.png');
		expect(lease.url).toBe('https://example.test/stream.png');
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(createObjectURL).not.toHaveBeenCalled();
		lease.release();
	});

	test('aborts a stalled request and preserves direct image fallback', async () => {
		storage.unavailable = true;
		vi.useFakeTimers();
		fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
			options?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')));
		}));
		const { acquireNoteCharmImage } = await load();
		const pending = acquireNoteCharmImage('https://example.test/timeout.png');
		await vi.advanceTimersByTimeAsync(15_001);
		const lease = await pending;
		expect(lease.url).toBe('https://example.test/timeout.png');
		expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
		lease.release();
	});

	test('refetches a corrupt persisted value instead of creating an invalid object URL', async () => {
		storage.values.set('note-charm-image:v1:https://example.test/corrupt.png', {});
		const lease = await (await load()).acquireNoteCharmImage('https://example.test/corrupt.png');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(lease.url).toMatch(/^blob:/);
		expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
		lease.release();
	});

	test('evicts inactive images at the count limit without revoking active leases', async () => {
		const { acquireNoteCharmImage } = await load();
		const active = await acquireNoteCharmImage('https://example.test/active.png');
		const oldest = await acquireNoteCharmImage('https://example.test/oldest.png');
		oldest.release();
		for (let i = 0; i < 65; i++) (await acquireNoteCharmImage(`https://example.test/entry-${i}.png`)).release();
		expect(revokeObjectURL).toHaveBeenCalledWith(oldest.url);
		expect(revokeObjectURL).not.toHaveBeenCalledWith(active.url);
		expect([...storage.values.values()].filter(value => value instanceof Blob)).toHaveLength(64);
		const shared = await acquireNoteCharmImage('https://example.test/active.png');
		expect(shared.url).toBe(active.url);
		shared.release();
		active.release();
	});

	test('evicts by byte budget and leaves unrelated stored values alone', async () => {
		storage.values.set('existing-account-data', { keep: true });
		fetchMock.mockImplementation(async () => response(image(5 * 1024 * 1024)));
		const { acquireNoteCharmImage } = await load();
		for (let i = 0; i < 7; i++) (await acquireNoteCharmImage(`https://example.test/large-${i}.png`)).release();
		expect([...storage.values.values()].filter(value => value instanceof Blob)).toHaveLength(6);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:charm-1');
		expect(storage.values.get('existing-account-data')).toEqual({ keep: true });
	});
});
