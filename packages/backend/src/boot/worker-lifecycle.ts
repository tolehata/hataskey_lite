/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Worker } from 'node:cluster';

const WORKER_READY_TIMEOUT_MS = 60_000;
const WORKER_RETRY_DELAY_MS = 100;

export type WorkerLifecycleOptions = {
	fork: () => Worker;
	isShuttingDown: () => boolean;
	onFailure: (error: Error) => void;
	readyTimeoutMs?: number;
};

/** Keep a worker slot alive, including replacements that exit before becoming ready. */
export function spawnWorker(options: WorkerLifecycleOptions): Promise<void> {
	const reportFailure = (error: Error) => {
		if (!options.isShuttingDown()) options.onFailure(error);
	};
	return new Promise((resolve, reject) => {
		let state: 'starting' | 'ready' | 'failed' = 'starting';
		let detachWorkerListeners = () => {};
		let retry: ReturnType<typeof setTimeout> | undefined;
		const timeoutMs = options.readyTimeoutMs ?? WORKER_READY_TIMEOUT_MS;
		const timeout = setTimeout(() => fail(new Error(`Worker did not become ready within ${timeoutMs}ms.`)), timeoutMs);

		function fail(error: Error): void {
			if (state === 'failed') return;
			const wasReady = state === 'ready';
			state = 'failed';
			clearTimeout(timeout);
			if (retry) clearTimeout(retry);
			detachWorkerListeners();
			if (wasReady) reportFailure(error);
			else reject(error);
		}

		function forkWorker(): void {
			if (options.isShuttingDown()) {
				fail(new Error('Worker startup interrupted by shutdown.'));
				return;
			}

			let worker: Worker;
			try {
				worker = options.fork();
			} catch (error) {
				fail(error instanceof Error ? error : new Error(String(error)));
				return;
			}

			const onMessage = (message: unknown) => {
				if (message === 'listenFailed') {
					fail(new Error(`Worker [${worker.id}] failed to listen.`));
				} else if (message === 'ready' && state === 'starting') {
					state = 'ready';
					clearTimeout(timeout);
					resolve();
				}
			};
			const onExit = () => {
				detachWorkerListeners();
				if (options.isShuttingDown()) {
					if (state === 'starting') fail(new Error('Worker startup interrupted by shutdown.'));
					return;
				}
				if (state === 'failed') return;
				if (state === 'ready') {
					// Runtime replacements get the same readiness checks as the initial worker.
					void spawnWorker(options).catch(reportFailure);
				} else {
					// Preserve the original readiness promise and deadline across failed attempts.
					retry = setTimeout(() => {
						retry = undefined;
						if (state === 'starting') forkWorker();
					}, WORKER_RETRY_DELAY_MS);
				}
			};
			detachWorkerListeners = () => {
				worker.off('message', onMessage);
				worker.off('error', fail);
				worker.off('exit', onExit);
			};
			worker.on('message', onMessage);
			worker.on('error', fail);
			worker.once('exit', onExit);
		}

		forkWorker();
	});
}

/** Wait for actual worker exit so the primary does not disconnect workers mid-drain. */
export async function terminateWorkers(workers: readonly (Worker | undefined)[]): Promise<void> {
	const results = await Promise.allSettled(workers.map(worker => new Promise<void>((resolve, reject) => {
		if (!worker || worker.isDead()) {
			resolve();
			return;
		}

		const onExit = () => resolve();
		worker.once('exit', onExit);
		try {
			worker.process.kill('SIGTERM');
		} catch (error) {
			worker.off('exit', onExit);
			reject(error);
		}
	})));
	const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
	if (errors.length > 0) throw new AggregateError(errors, 'Failed to terminate workers.');
}
