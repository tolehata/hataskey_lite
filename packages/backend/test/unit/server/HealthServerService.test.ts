/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readyRef } from '@/boot/ready.js';
import { HealthServerService } from '@/server/HealthServerService.js';
import type { FastifyInstance } from 'fastify';

const redisNames = ['main', 'pub', 'sub', 'timelines', 'reactions', 'jobQueue'] as const;
let redis: Record<typeof redisNames[number], { status: string; ping: ReturnType<typeof vi.fn> }>;
let db: { query: ReturnType<typeof vi.fn> };
let meilisearch: { health: ReturnType<typeof vi.fn> };
let server: FastifyInstance;

async function startServer(withMeilisearch = false) {
	const service = new HealthServerService(
		redis.main as never,
		redis.pub as never,
		redis.sub as never,
		redis.timelines as never,
		redis.reactions as never,
		redis.jobQueue as never,
		db as never,
		withMeilisearch ? meilisearch as never : null,
	);
	server = Fastify();
	await server.register(service.createServer, { prefix: '/healthz' });
	await server.ready();
}

beforeEach(() => {
	readyRef.value = true;
	redis = Object.fromEntries(redisNames.map(name => [name, { status: 'ready', ping: vi.fn().mockResolvedValue('PONG') }])) as typeof redis;
	db = { query: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
	meilisearch = { health: vi.fn().mockResolvedValue({ status: 'available' }) };
});

afterEach(async () => {
	vi.useRealTimers();
	readyRef.value = false;
	await server.close();
});

describe('health readiness', () => {
	test.each([false, true])('checks every configured dependency (Meilisearch: %s)', async withMeilisearch => {
		await startServer(withMeilisearch);
		const response = await server.inject('/healthz');
		expect(response.statusCode).toBe(200);
		expect(response.headers['cache-control']).toBe('no-store');
		for (const client of Object.values(redis)) expect(client.ping).toHaveBeenCalledOnce();
		expect(db.query).toHaveBeenCalledWith('SELECT 1');
		expect(meilisearch.health).toHaveBeenCalledTimes(withMeilisearch ? 1 : 0);
	});

	test('returns unavailable before startup without probing dependencies', async () => {
		await startServer();
		readyRef.value = false;
		const response = await server.inject('/healthz');
		expect(response.statusCode).toBe(503);
		expect(response.headers['cache-control']).toBe('no-store');
		for (const client of Object.values(redis)) expect(client.ping).not.toHaveBeenCalled();
		expect(db.query).not.toHaveBeenCalled();
	});

	test.each(redisNames)('does not enqueue probes when %s Redis is offline', async name => {
		await startServer();
		redis[name].status = 'reconnecting';
		expect((await server.inject('/healthz')).statusCode).toBe(503);
		for (const client of Object.values(redis)) expect(client.ping).not.toHaveBeenCalled();
	});

	test.each(redisNames)('returns unavailable when %s Redis ping rejects', async name => {
		await startServer();
		redis[name].ping.mockRejectedValue(new Error('Connection lost'));
		expect((await server.inject('/healthz')).statusCode).toBe(503);
	});

	test.each(['database', 'meilisearch'])('returns unavailable when %s rejects', async name => {
		await startServer(true);
		(name === 'database' ? db.query : meilisearch.health).mockRejectedValue(new Error('Connection lost'));
		expect((await server.inject('/healthz')).statusCode).toBe(503);
	});

	test.each(['jobQueue', 'database', 'meilisearch'])('bounds an indefinitely pending %s probe', async name => {
		await startServer(true);
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const probe = name === 'jobQueue' ? redis.jobQueue.ping : name === 'database' ? db.query : meilisearch.health;
		probe.mockReturnValue(new Promise(() => {}));
		const pending = server.inject('/healthz').then(response => response);
		await vi.waitFor(() => expect(probe).toHaveBeenCalled());
		await vi.advanceTimersByTimeAsync(5000);
		const response = await pending;
		expect(response.statusCode).toBe(503);
		expect(response.headers['cache-control']).toBe('no-store');
		expect(vi.getTimerCount()).toBe(0);
	});

	test('shares a timed-out database probe until it settles, then checks again', async () => {
		await startServer();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		let finishQuery = () => {};
		db.query.mockImplementationOnce(() => new Promise<void>(resolve => { finishQuery = resolve; }));
		const first = server.inject('/healthz');
		await vi.waitFor(() => expect(db.query).toHaveBeenCalledOnce());
		await vi.advanceTimersByTimeAsync(5000);
		expect((await first).statusCode).toBe(503);
		const second = server.inject('/healthz');
		await vi.advanceTimersByTimeAsync(5000);
		expect((await second).statusCode).toBe(503);
		expect(db.query).toHaveBeenCalledOnce();
		finishQuery();
		await Promise.resolve();
		await Promise.resolve();
		expect((await server.inject('/healthz')).statusCode).toBe(200);
		expect(db.query).toHaveBeenCalledTimes(2);
	});

	test('clears its timeout after a healthy response', async () => {
		await startServer();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		expect((await server.inject('/healthz')).statusCode).toBe(200);
		expect(vi.getTimerCount()).toBe(0);
	});
});
