/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { spawnWorker, terminateWorkers } from '@/boot/worker-lifecycle.js';
import type { Worker } from 'node:cluster';

class FakeWorker extends EventEmitter {
	dead = false;
	process = { kill: vi.fn() };

	constructor(readonly id: number) {
		super();
	}

	isDead() {
		return this.dead;
	}

	exit() {
		this.dead = true;
		this.emit('exit', 1, null);
	}
}

function createHarness() {
	const workers: FakeWorker[] = [];
	const options = {
		fork: vi.fn(() => {
			const worker = new FakeWorker(workers.length + 1);
			workers.push(worker);
			return worker as unknown as Worker;
		}),
		isShuttingDown: vi.fn(() => false),
		onFailure: vi.fn(),
		readyTimeoutMs: 1000,
	};
	return { workers, options };
}

function expectDetached(worker: FakeWorker) {
	expect(worker.listenerCount('message')).toBe(0);
	expect(worker.listenerCount('error')).toBe(0);
	expect(worker.listenerCount('exit')).toBe(0);
}

describe('worker lifecycle', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	test('ignores unrelated messages and resolves only on ready', async () => {
		const { workers, options } = createHarness();
		const ready = vi.fn();
		const starting = spawnWorker(options).then(ready);
		workers[0].emit('message', 'online');
		await Promise.resolve();
		expect(ready).not.toHaveBeenCalled();
		workers[0].emit('message', 'ready');
		workers[0].emit('message', 'ready');
		await starting;
		expect(ready).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('the replacement ready message settles the original startup promise', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].exit();
		await vi.advanceTimersByTimeAsync(100);
		workers[1].exit();
		await vi.advanceTimersByTimeAsync(100);
		workers[2].emit('message', 'ready');
		await starting;
		expect(options.fork).toHaveBeenCalledTimes(3);
		expectDetached(workers[0]);
		expectDetached(workers[1]);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('repeated pre-ready exits cannot extend the startup deadline', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		const failed = expect(starting).rejects.toThrow('within 1000ms');
		await vi.advanceTimersByTimeAsync(800);
		workers[0].exit();
		await vi.advanceTimersByTimeAsync(100);
		expect(workers).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(100);
		await failed;
		expectDetached(workers[1]);
		workers[1].exit();
		expect(options.fork).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('runtime replacements retain readiness monitoring and recover from an early exit', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].emit('message', 'ready');
		await starting;
		workers[0].exit();
		workers[1].exit();
		await vi.advanceTimersByTimeAsync(100);
		workers[2].emit('message', 'ready');
		await vi.advanceTimersByTimeAsync(2000);
		expect(options.fork).toHaveBeenCalledTimes(3);
		expect(options.onFailure).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('delays repeated pre-ready forks to avoid a tight exit loop', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].exit();
		await vi.advanceTimersByTimeAsync(99);
		expect(options.fork).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		workers[1].exit();
		await vi.advanceTimersByTimeAsync(99);
		expect(options.fork).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		workers[2].emit('message', 'ready');
		await starting;
	});

	test('a stuck runtime replacement reports a fatal readiness failure', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].emit('message', 'ready');
		await starting;
		workers[0].exit();
		await vi.advanceTimersByTimeAsync(1000);
		expect(options.onFailure).toHaveBeenCalledOnce();
		expect(options.onFailure).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('within 1000ms') }));
		expectDetached(workers[1]);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('listenFailed rejects startup and prevents respawning the failed worker', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].emit('message', 'listenFailed');
		await expect(starting).rejects.toThrow('failed to listen');
		expectDetached(workers[0]);
		workers[0].exit();
		expect(options.fork).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('listenFailed on a replacement is also fatal', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].emit('message', 'ready');
		await starting;
		workers[0].exit();
		workers[1].emit('message', 'listenFailed');
		await Promise.resolve();
		expect(options.onFailure).toHaveBeenCalledWith(expect.objectContaining({ message: 'Worker [2] failed to listen.' }));
		expectDetached(workers[1]);
	});

	test('worker errors reject startup and clear readiness listeners', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].emit('error', new Error('fork failed'));
		await expect(starting).rejects.toThrow('fork failed');
		expectDetached(workers[0]);
		expect(vi.getTimerCount()).toBe(0);
	});

	test.each(['error', 'listenFailed'])('a late %s during shutdown does not report a fatal runtime failure', async event => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].emit('message', 'ready');
		await starting;
		options.isShuttingDown.mockReturnValue(true);
		if (event === 'error') workers[0].emit('error', new Error('disconnecting'));
		else workers[0].emit('message', 'listenFailed');
		expect(options.onFailure).not.toHaveBeenCalled();
		expectDetached(workers[0]);
	});

	test('shutdown during runtime replacement startup is not a fatal runtime failure', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].emit('message', 'ready');
		await starting;
		workers[0].exit();
		options.isShuttingDown.mockReturnValue(true);
		workers[1].exit();
		await Promise.resolve();
		expect(options.onFailure).not.toHaveBeenCalled();
		expect(options.fork).toHaveBeenCalledTimes(2);
		expectDetached(workers[1]);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('synchronous fork failures reject and clear the readiness timer', async () => {
		const { options } = createHarness();
		options.fork.mockImplementation(() => { throw new Error('cannot fork'); });
		await expect(spawnWorker(options)).rejects.toThrow('cannot fork');
		expect(vi.getTimerCount()).toBe(0);
	});

	test('shutdown prevents spawning a new worker', async () => {
		const { options } = createHarness();
		options.isShuttingDown.mockReturnValue(true);
		await expect(spawnWorker(options)).rejects.toThrow('interrupted by shutdown');
		expect(options.fork).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('shutdown during the retry delay prevents another fork', async () => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		workers[0].exit();
		options.isShuttingDown.mockReturnValue(true);
		const rejected = expect(starting).rejects.toThrow('interrupted by shutdown');
		await vi.advanceTimersByTimeAsync(100);
		await rejected;
		expect(options.fork).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	test.each([false, true])('shutdown prevents respawn when ready=%s', async wasReady => {
		const { workers, options } = createHarness();
		const starting = spawnWorker(options);
		if (wasReady) workers[0].emit('message', 'ready');
		options.isShuttingDown.mockReturnValue(true);
		workers[0].exit();
		if (wasReady) await starting;
		else await expect(starting).rejects.toThrow('interrupted by shutdown');
		expect(options.fork).toHaveBeenCalledOnce();
		expectDetached(workers[0]);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('worker termination', () => {
	test('signals all workers and waits for every exit, including disconnected workers', async () => {
		const first = new FakeWorker(1);
		const second = new FakeWorker(2);
		const stopped = vi.fn();
		const stopping = terminateWorkers([first, second] as unknown as Worker[]).then(stopped);
		expect(first.process.kill).toHaveBeenCalledWith('SIGTERM');
		expect(second.process.kill).toHaveBeenCalledWith('SIGTERM');
		first.emit('disconnect');
		second.exit();
		await Promise.resolve();
		expect(stopped).not.toHaveBeenCalled();
		first.exit();
		await stopping;
		expect(stopped).toHaveBeenCalledOnce();
		expectDetached(first);
		expectDetached(second);
	});

	test('attaches the exit listener before signalling', async () => {
		const worker = new FakeWorker(1);
		worker.process.kill.mockImplementation(() => worker.exit());
		await terminateWorkers([worker] as unknown as Worker[]);
		expectDetached(worker);
	});

	test('skips absent and already-dead workers', async () => {
		const worker = new FakeWorker(1);
		worker.dead = true;
		await terminateWorkers([undefined, worker] as unknown as Worker[]);
		await terminateWorkers([]);
		expect(worker.process.kill).not.toHaveBeenCalled();
		expectDetached(worker);
	});

	test('a signal error does not skip or stop waiting for other workers', async () => {
		const first = new FakeWorker(1);
		const second = new FakeWorker(2);
		first.process.kill.mockImplementation(() => { throw new Error('kill failed'); });
		const failed = vi.fn();
		const stopping = terminateWorkers([first, second] as unknown as Worker[]).catch(failed);
		await Promise.resolve();
		expect(failed).not.toHaveBeenCalled();
		expect(second.process.kill).toHaveBeenCalledWith('SIGTERM');
		second.exit();
		await stopping;
		expect(failed).toHaveBeenCalledWith(expect.any(AggregateError));
		expectDetached(first);
		expectDetached(second);
	});
});
