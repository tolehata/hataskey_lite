/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { acquireResourceLease } from '@/misc/resource-budget.js';

const options = { name: 'test-budget', actor: 'user', concurrency: 2, actorConcurrency: 1, bytes: 16, maxBytes: 32, requestsPerMinute: 60 };
afterEach(() => vi.useRealTimers());

describe('shared resource admission lifecycle', () => {
	test('fails closed on unavailable Redis and denied admission', async () => {
		await expect(acquireResourceLease(undefined, options)).rejects.toMatchObject({ statusCode: 503 });
		await expect(acquireResourceLease({ eval: vi.fn().mockRejectedValue(new Error('offline')) } as never, options)).rejects.toMatchObject({ statusCode: 503 });
		await expect(acquireResourceLease({ eval: vi.fn().mockResolvedValue(0) } as never, options)).rejects.toMatchObject({ statusCode: 429 });
	});

	test('two workers submit the same resource/actor keys with distinct lease identities', async () => {
		const firstRedis = { eval: vi.fn().mockResolvedValue(1) };
		const secondRedis = { eval: vi.fn().mockResolvedValue(1) };
		const first = await acquireResourceLease(firstRedis as never, options);
		const second = await acquireResourceLease(secondRedis as never, options);
		expect(firstRedis.eval.mock.calls[0].slice(2, 6)).toEqual(secondRedis.eval.mock.calls[0].slice(2, 6));
		expect(firstRedis.eval.mock.calls[0][6]).not.toBe(secondRedis.eval.mock.calls[0][6]);
		await first.release();
		await first.release();
		await second.release();
		expect(firstRedis.eval).toHaveBeenCalledTimes(2);
		expect(secondRedis.eval).toHaveBeenCalledTimes(2);
	});

	test('loss of renewal aborts work and release remains explicit until work ends', async () => {
		vi.useFakeTimers();
		const redis = { eval: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValue(1) };
		const lease = await acquireResourceLease(redis as never, options);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(lease.signal.aborted).toBe(true);
		expect(redis.eval).toHaveBeenCalledTimes(2);
		await lease.release();
		expect(redis.eval).toHaveBeenCalledTimes(3);
	});

	test('a late Redis grant after the admission deadline is returned without starting work', async () => {
		vi.useFakeTimers();
		let grant!: (value: number) => void;
		const redis = { eval: vi.fn().mockImplementationOnce(() => new Promise(resolve => { grant = resolve; })).mockResolvedValue(1) };
		const result = acquireResourceLease(redis as never, options);
		const rejected = expect(result).rejects.toMatchObject({ statusCode: 503 });
		await vi.advanceTimersByTimeAsync(2000);
		await rejected;
		grant(1);
		await vi.advanceTimersByTimeAsync(0);
		expect(redis.eval).toHaveBeenCalledTimes(2);
	});
});
