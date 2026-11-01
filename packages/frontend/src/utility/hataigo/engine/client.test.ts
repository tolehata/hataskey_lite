/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { createBoard } from '../rules/board.js';
import { createEngineClient } from './client.js';
import type { EngineWorkerPort } from './client.js';
import type { SearchInput, SearchResult } from './mcts.js';
import type { EngineRequest, EngineResponse } from './worker.js';

vi.mock('./worker?worker', () => ({ default: class {} }));

class FakeWorker implements EngineWorkerPort {
	onmessage: ((event: { data: EngineResponse }) => void) | null = null;
	onerror: ((event: { message: string }) => void) | null = null;
	postMessage = vi.fn<(request: EngineRequest) => void>();
	terminate = vi.fn();
}
const input: SearchInput = { board: createBoard(9), toPlay: 'black', komi: 6.5, budget: { maxPlayouts: 2, maxMs: 100 } };
const result: SearchResult = { move: null, candidates: [], playouts: 0, attempts: 0, elapsedMs: 1, ownership: { black: [], white: [], neutral: [], samples: 0 }, estimatedMargin: null, stopped: 'budget' };

afterEach(() => { vi.useRealTimers(); });

test('progress and results are matched by request ID, and stale responses cannot resolve a new search', async () => {
	const worker = new FakeWorker();
	const client = createEngineClient({ workerFactory: () => worker });
	const onProgress = vi.fn();
	const search = client.search(input, { onProgress });
	worker.onmessage?.({ data: { type: 'progress', requestId: 99, result } });
	expect(onProgress).not.toHaveBeenCalled();
	worker.onmessage?.({ data: { type: 'progress', requestId: 1, result } });
	expect(onProgress).toHaveBeenCalledWith(result);
	worker.onmessage?.({ data: { type: 'result', requestId: 1, result } });
	expect(await search).toBe(result);
	client.dispose();
});

test('AbortSignal cancellation is cooperative and rejects without terminating the worker', async () => {
	const worker = new FakeWorker();
	const client = createEngineClient({ workerFactory: () => worker });
	const controller = new AbortController();
	const search = client.search(input, { signal: controller.signal });
	const rejected = expect(search).rejects.toMatchObject({ name: 'AbortError' });
	controller.abort();
	await rejected;
	expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', requestId: 1 });
	expect(worker.terminate).not.toHaveBeenCalled();
	client.dispose();
});

test('starting another request rejects the old one and ignores its late response', async () => {
	const worker = new FakeWorker();
	const client = createEngineClient({ workerFactory: () => worker });
	const first = client.search(input);
	const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
	const second = client.search(input);
	await rejected;
	worker.onmessage?.({ data: { type: 'result', requestId: 1, result } });
	worker.onmessage?.({ data: { type: 'result', requestId: 2, result: { ...result, playouts: 3 } } });
	expect((await second).playouts).toBe(3);
	client.dispose();
});

test('watchdog replaces only an unresponsive worker and a subsequent search can succeed', async () => {
	vi.useFakeTimers();
	const oldWorker = new FakeWorker();
	const nextWorker = new FakeWorker();
	let created = 0;
	const client = createEngineClient({ workerFactory: () => ++created === 1 ? oldWorker : nextWorker, watchdogGraceMs: 10 });
	const search = client.search(input);
	const rejected = expect(search).rejects.toThrow('AI が応答しません');
	await vi.advanceTimersByTimeAsync(111);
	await rejected;
	expect(oldWorker.terminate).toHaveBeenCalledOnce();
	const retry = client.search(input);
	nextWorker.onmessage?.({ data: { type: 'result', requestId: 2, result } });
	expect(await retry).toBe(result);
	client.dispose();
});

test('worker errors reject promptly and dispose prevents future searches', async () => {
	const worker = new FakeWorker();
	const client = createEngineClient({ workerFactory: () => worker });
	const search = client.search(input);
	const rejected = expect(search).rejects.toThrow('worker crashed');
	worker.onerror?.({ message: 'worker crashed' });
	await rejected;
	expect(worker.terminate).toHaveBeenCalledOnce();
	client.dispose();
	await expect(client.search(input)).rejects.toThrow('disposed');
});
