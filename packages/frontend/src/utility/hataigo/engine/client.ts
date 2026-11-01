/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import EngineWorker from './worker?worker';
import type { SearchInput, SearchResult } from './mcts.js';
import type { EngineRequest, EngineResponse } from './worker.js';

export type { SearchInput, SearchResult, SearchCandidate } from './mcts.js';
export interface EngineWorkerPort {
	onmessage: ((event: { data: EngineResponse }) => void) | null;
	onerror: ((event: { message: string }) => void) | null;
	postMessage(request: EngineRequest): void;
	terminate(): void;
}
interface PendingSearch {
	requestId: number;
	resolve(result: SearchResult): void;
	reject(error: Error): void;
	onProgress?: (result: SearchResult) => void;
	cleanup(): void;
}

function aborted(): Error {
	const error = new Error('AI の探索を中止しました');
	error.name = 'AbortError';
	return error;
}

export function createEngineClient(options: { workerFactory?: () => EngineWorkerPort; watchdogGraceMs?: number } = {}) {
	const workerFactory = options.workerFactory ?? (() => new EngineWorker() as EngineWorkerPort);
	let worker: EngineWorkerPort | null = null;
	let pending: PendingSearch | null = null;
	let nextId = 0;
	let disposed = false;
	const resetWorker = () => { worker?.terminate(); worker = null; };
	const fail = (error: Error) => {
		const current = pending;
		pending = null;
		current?.cleanup();
		current?.reject(error);
	};
	const ensureWorker = (): EngineWorkerPort => {
		if (worker) return worker;
		worker = workerFactory();
		worker.onmessage = ({ data }) => {
			if (!pending || data.requestId !== pending.requestId) return;
			if (data.type === 'progress') { pending.onProgress?.(data.result); return; }
			if (data.type === 'error') { fail(new Error(data.message)); return; }
			const current = pending;
			pending = null;
			current.cleanup();
			current.resolve(data.result);
		};
		worker.onerror = event => { fail(new Error(event.message || 'AI が応答しません')); resetWorker(); };
		return worker;
	};
	const cancel = (): void => {
		if (!pending) return;
		try { worker?.postMessage({ type: 'cancel', requestId: pending.requestId }); } catch { resetWorker(); } finally { fail(aborted()); }
	};
	return {
		search(input: SearchInput, hooks: { signal?: AbortSignal; onProgress?: (result: SearchResult) => void } = {}): Promise<SearchResult> {
			if (disposed) return Promise.reject(new Error('AI engine has been disposed'));
			if (hooks.signal?.aborted) return Promise.reject(aborted());
			cancel();
			return new Promise((resolve, reject) => {
				const requestId = ++nextId;
				const onAbort = () => { if (pending?.requestId === requestId) cancel(); };
				const timeout = window.setTimeout(() => {
					if (pending?.requestId !== requestId) return;
					fail(new Error('AI が応答しません'));
					// Only an unresponsive/crashed worker is replaced. Normal cancellation is cooperative.
					resetWorker();
				}, Math.max(1, input.budget.maxMs) + (options.watchdogGraceMs ?? 1500));
				pending = { requestId, resolve, reject, onProgress: hooks.onProgress, cleanup: () => { window.clearTimeout(timeout); hooks.signal?.removeEventListener('abort', onAbort); } };
				hooks.signal?.addEventListener('abort', onAbort, { once: true });
				try { ensureWorker().postMessage({ type: 'search', requestId, input }); } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); resetWorker(); }
			});
		},
		cancel,
		dispose(): void { cancel(); disposed = true; resetWorker(); },
	};
}
