/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { searchPosition } from './mcts.js';
import type { SearchInput, SearchResult } from './mcts.js';

export type EngineRequest = { type: 'search'; requestId: number; input: SearchInput } | { type: 'cancel'; requestId: number };
export type EngineResponse = { type: 'progress' | 'result'; requestId: number; result: SearchResult } | { type: 'error'; requestId: number; message: string };

const jobs = new Map<number, { cancelled: boolean }>();

function isCancelRequest(value: unknown): value is Extract<EngineRequest, { type: 'cancel' }> {
	return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'cancel';
}

function isSearchRequest(value: unknown): value is Extract<EngineRequest, { type: 'search' }> {
	return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'search';
}

self.addEventListener('message', (event: MessageEvent<EngineRequest>) => {
	const request: unknown = event.data;
	if (isCancelRequest(request)) {
		const job = jobs.get(request.requestId);
		if (job) job.cancelled = true;
		return;
	}
	if (!isSearchRequest(request)) return;
	for (const job of jobs.values()) job.cancelled = true;
	const job = { cancelled: false };
	jobs.set(request.requestId, job);
	const send = (response: EngineResponse) => self.postMessage(response);
	void searchPosition(request.input, {
		shouldStop: () => job.cancelled,
		yieldControl: () => new Promise(resolve => globalThis.setTimeout(resolve, 0)),
		onProgress: result => { if (!job.cancelled) send({ type: 'progress', requestId: request.requestId, result }); },
	}).then(result => {
		if (!job.cancelled) send({ type: 'result', requestId: request.requestId, result });
	}).catch((error: unknown) => {
		if (!job.cancelled) send({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : String(error) });
	}).finally(() => { jobs.delete(request.requestId); });
});
