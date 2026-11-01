/* SPDX-License-Identifier: AGPL-3.0-only */

import { createHash, randomUUID } from 'node:crypto';
import { StatusError } from '@/misc/status-error.js';
import type * as Redis from 'ioredis';

// Redis owns the clock and the admission decision, including across cluster workers.
// Reserve the maximum transfer size before opening a temporary file. No waiting queue.
export const acquireResourceScript = `
local nowParts = redis.call('TIME')
local now = nowParts[1] * 1000 + math.floor(nowParts[2] / 1000)
local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now)
for _, id in ipairs(expired) do redis.call('HDEL', KEYS[2], id) end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
local used = 0
for _, bytes in ipairs(redis.call('HVALS', KEYS[2])) do used = used + tonumber(bytes) end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) or
   redis.call('ZCARD', KEYS[3]) >= tonumber(ARGV[4]) or
   used + tonumber(ARGV[5]) > tonumber(ARGV[6]) then return 0 end
local requests = redis.call('INCR', KEYS[4])
if requests == 1 then redis.call('PEXPIRE', KEYS[4], 60000) end
if requests > tonumber(ARGV[7]) then return 0 end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[2]), ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[5])
redis.call('ZADD', KEYS[3], now + tonumber(ARGV[2]), ARGV[1])
for i = 1, 3 do redis.call('PEXPIRE', KEYS[i], tonumber(ARGV[2]) * 2) end
return 1`;

const renewResourceScript = `
if not redis.call('ZSCORE', KEYS[1], ARGV[1]) then return 0 end
local t = redis.call('TIME')
local expires = t[1] * 1000 + math.floor(t[2] / 1000) + tonumber(ARGV[2])
redis.call('ZADD', KEYS[1], expires, ARGV[1])
redis.call('ZADD', KEYS[3], expires, ARGV[1])
for i = 1, 3 do redis.call('PEXPIRE', KEYS[i], tonumber(ARGV[2]) * 2) end
return 1`;

const releaseResourceScript = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
return 1`;

export type ResourceLease = { signal: AbortSignal; release: () => Promise<void> };
let pendingAdmissions = 0;

export async function acquireResourceLease(redis: Redis.Redis | undefined, options: {
	name: string;
	actor: string;
	concurrency: number;
	actorConcurrency: number;
	bytes: number;
	maxBytes: number;
	requestsPerMinute: number;
}): Promise<ResourceLease> {
	if (!redis) throw new StatusError('Resource admission unavailable', 503);
	if (![options.concurrency, options.actorConcurrency, options.requestsPerMinute].every(value => Number.isSafeInteger(value) && value > 0)
		|| ![options.bytes, options.maxBytes].every(value => Number.isSafeInteger(value) && value >= 0)) {
		throw new StatusError('Invalid resource budget', 503);
	}
	// This only bounds Redis waiters in one worker; execution limits below are shared.
	if (pendingAdmissions >= 64 || (redis.status !== undefined && redis.status !== 'ready')) {
		throw new StatusError('Resource admission unavailable', 503);
	}
	const actor = createHash('sha256').update(options.actor).digest('hex');
	const prefix = `resource-budget:{${options.name}}`;
	const keys = [`${prefix}:active`, `${prefix}:bytes`, `${prefix}:actor:${actor}`, `${prefix}:rate:${actor}`];
	const id = randomUUID();
	const ttl = 120_000;
	let admitted: unknown;
	pendingAdmissions++;
	let abandoned = false;
	let admissionTimer: NodeJS.Timeout | undefined;
	const admission = redis.eval(acquireResourceScript, keys.length, ...keys, id, ttl,
		options.concurrency, options.actorConcurrency, options.bytes, options.maxBytes, options.requestsPerMinute)
		.then(async result => {
			if (abandoned && Number(result) === 1) await redis.eval(releaseResourceScript, 3, ...keys.slice(0, 3), id);
			return result;
		}).finally(() => { pendingAdmissions--; });
	try {
		admitted = await Promise.race([admission, new Promise<never>((_resolve, reject) => {
			admissionTimer = setTimeout(() => reject(new Error('Redis admission deadline exceeded')), 2000);
			admissionTimer.unref();
		})]);
	} catch {
		abandoned = true;
		throw new StatusError('Resource admission unavailable', 503);
	} finally {
		if (admissionTimer) clearTimeout(admissionTimer);
	}
	if (Number(admitted) !== 1) throw new StatusError('Resource capacity exceeded. Please retry later.', 429);
	const controller = new AbortController();
	let released = false;
	let renewal: Promise<void> | undefined;
	const interval = setInterval(() => {
		if (released || renewal) return;
		renewal = (async () => {
			try {
				const renewed = await redis.eval(renewResourceScript, 3, ...keys.slice(0, 3), id, ttl);
				if (Number(renewed) !== 1) controller.abort(new StatusError('Resource lease expired', 503));
			} catch {
				controller.abort(new StatusError('Resource admission unavailable', 503));
			}
		})().finally(() => { renewal = undefined; });
	}, ttl / 4);
	interval.unref();
	return {
		signal: controller.signal,
		async release() {
			if (released) return;
			released = true;
			clearInterval(interval);
			await renewal;
			// Expiry handles Redis outages. Never mask the original request's error.
			await redis.eval(releaseResourceScript, 3, ...keys.slice(0, 3), id).catch(() => {});
		},
	};
}

export type ResourcePoolBudget = { name: string; concurrency: number; actorConcurrency: number; requestsPerMinute: number };

// The Redis script applies the limits passed by each caller, so every caller of
// one pool must take them from these constants. Byte caps are concurrency × the
// per-lease reservation, leaving concurrency as the binding limit.

/** Local multipart uploads and URL imports. Federation load never consumes this pool. */
export const LOCAL_DRIVE_UPLOAD_BUDGET = { name: 'drive-upload-local', concurrency: 8, actorConcurrency: 2, requestsPerMinute: 30 } as const satisfies ResourcePoolBudget;
/** Remote media and instance-actor imports, keyed by source server so one busy server cannot starve the others. */
export const REMOTE_DRIVE_INGEST_BUDGET = { name: 'drive-ingest-remote', concurrency: 8, actorConcurrency: 4, requestsPerMinute: 120 } as const satisfies ResourcePoolBudget;
/** One timeline view requests many avatars and emojis at once; keep a per-IP share without breaking images. */
export const MEDIA_PROCESSING_BUDGET = { name: 'media-processing', concurrency: 64, actorConcurrency: 32, requestsPerMinute: 2400 } as const satisfies ResourcePoolBudget;
export const MEDIA_DOWNLOAD_BUDGET = { name: 'media-download', concurrency: 16, actorConcurrency: 8, requestsPerMinute: 240 } as const satisfies ResourcePoolBudget;

export const MEDIA_MAX_BYTES = 32 * 1024 * 1024;
export const MEDIA_MAX_PIXELS = 32 * 1024 * 1024;
export const MEDIA_TIMEOUT_SECONDS = 10;
