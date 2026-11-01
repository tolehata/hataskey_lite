/* SPDX-License-Identifier: AGPL-3.0-only */
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterEach, describe, expect, test } from 'vitest';
import { acquireResourceLease, type ResourceLease } from '@/misc/resource-budget.js';

// Opt-in only: the integration fixture must be an isolated, disposable Redis.
const socket = process.env.HATA_RESOURCE_BUDGET_REDIS_SOCKET;
const clients: Redis[] = [];
const leases: ResourceLease[] = [];
afterEach(async () => {
	await Promise.all(leases.splice(0).map(lease => lease.release()));
	await Promise.all(clients.splice(0).map(client => client.quit()));
});

async function fixture(overrides: Partial<Parameters<typeof acquireResourceLease>[1]> = {}) {
	const first = new Redis({ path: socket!, maxRetriesPerRequest: 0 });
	const second = new Redis({ path: socket!, maxRetriesPerRequest: 0 });
	clients.push(first, second);
	await Promise.all([first.ping(), second.ping()]);
	const options = {
		name: `security-test-${randomUUID()}`, actor: 'alice', concurrency: 2,
		actorConcurrency: 1, bytes: 16, maxBytes: 32, requestsPerMinute: 10, ...overrides,
	};
	const acquire = async (client = first, override: Partial<typeof options> = {}) => {
		const lease = await acquireResourceLease(client, { ...options, ...override });
		leases.push(lease);
		return lease;
	};
	return { first, second, options, acquire };
}

describe.skipIf(!socket)('resource budgets against isolated Redis', () => {
	test('independent workers share actor/global capacity and release only their own reservation', async () => {
		const f = await fixture();
		const alice = await f.acquire();
		await expect(f.acquire(f.second)).rejects.toMatchObject({ statusCode: 429 });
		const bob = await f.acquire(f.second, { actor: 'bob' });
		await expect(f.acquire(f.first, { actor: 'carol' })).rejects.toMatchObject({ statusCode: 429 });
		await alice.release();
		await alice.release();
		const carol = await f.acquire(f.second, { actor: 'carol' });
		await expect(f.acquire(f.first, { actor: 'dave' })).rejects.toMatchObject({ statusCode: 429 });
		await bob.release();
		await carol.release();
		await expect(f.acquire()).resolves.toBeDefined();
	});

	test('reserves aggregate bytes even when connection slots remain', async () => {
		const f = await fixture({ concurrency: 8, actorConcurrency: 8, maxBytes: 24 });
		const first = await f.acquire();
		await expect(f.acquire(f.second, { actor: 'bob' })).rejects.toMatchObject({ statusCode: 429 });
		await f.acquire(f.second, { actor: 'bob', bytes: 8 });
		await first.release();
		await expect(f.acquire(f.first, { actor: 'carol', bytes: 16 })).resolves.toBeDefined();
	});

	test('released work still counts toward the actor request-rate window', async () => {
		const f = await fixture({ requestsPerMinute: 1 });
		const first = await f.acquire();
		await first.release();
		await expect(f.acquire(f.second)).rejects.toMatchObject({ statusCode: 429 });
		await expect(f.acquire(f.second, { actor: 'bob' })).resolves.toBeDefined();
	});

	test('expired crashed-worker reservations release both slots and byte accounting', async () => {
		const f = await fixture({ concurrency: 1, maxBytes: 16 });
		await f.acquire();
		const key = `resource-budget:{${f.options.name}}:active`;
		const [id] = await f.first.zrange(key, 0, -1);
		await f.first.zadd(key, 0, id);
		await expect(f.acquire(f.second, { actor: 'bob' })).resolves.toBeDefined();
		expect(await f.first.hlen(`resource-budget:{${f.options.name}}:bytes`)).toBe(1);
	});

	test('simultaneous claims cannot exceed the global reservation budget', async () => {
		const f = await fixture({ concurrency: 2, actorConcurrency: 2 });
		const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) =>
			f.acquire(index % 2 ? f.first : f.second, { actor: `actor-${index}` })));
		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
		expect(results.filter(result => result.status === 'rejected')).toHaveLength(6);
		for (const result of results) {
			if (result.status === 'rejected') expect(result.reason).toMatchObject({ statusCode: 429 });
		}
	});
});
