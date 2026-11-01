/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 専用使い捨てRedisをPUNCH_TEST_REDIS_URLへ指定して実行する。本環境では未実行。
 * Example: PUNCH_TEST_REDIS_URL=redis://127.0.0.1:6380 node scripts/test-ltl-punch-redis.mjs
 * This script touches only its seven randomly namespaced keys. It never starts Redis.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Redis from 'ioredis';

const url = process.env.PUNCH_TEST_REDIS_URL;
assert.ok(url, 'PUNCH_TEST_REDIS_URL must point to a dedicated disposable Redis');
assert.ok(['redis:', 'rediss:'].includes(new URL(url).protocol), 'Expected a Redis URL');
const source = await readFile(new URL('../src/misc/ltl-punch-redis.ts', import.meta.url), 'utf8');
const matches = [...source.matchAll(/export const LTL_PUNCH_SCRIPT = `([^`]*)`;/g)];
assert.equal(matches.length, 1, 'Expected exactly one plain Lua template literal');
const script = matches[0][1];
assert.ok(!script.includes('${'), 'Lua template interpolation is unsupported by this test');
const prefix = `ltlPunchTest:${randomUUID()}:`;
const keys = ['state', 'presence', 'participants', 'awards', 'lastAttack', 'requests', 'daily'].map(key => prefix + key);
const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
const secondWorker = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
const now = async () => {
	const [seconds, microseconds] = await redis.time();
	return Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000);
};
const transition = async (operation, user = '', id = '', request = '', worker = redis) =>
	JSON.parse(await worker.eval(script, keys.length, ...keys, operation, '', user, id, request));
const state = async () => JSON.parse(await redis.get(keys[0]));
const setState = async patch => redis.set(keys[0], JSON.stringify({ ...await state(), ...patch }));
const ready = async () => {
	const time = await now();
	await setState({ fallAt: time - 1000, endsAt: time + 36000 });
};
const reset = async () => redis.del(...keys);
let checks = 0;
try {
	await redis.connect();
	await secondWorker.connect();
	await transition('sync', 'alice');
	await transition('sync', 'bob');
	const starts = await Promise.all([
		transition('start', 'alice', 'round-one'),
		transition('start', 'alice', 'round-two', '', secondWorker),
	]);
	assert.equal(starts.filter(result => result.started).length, 1);
	assert.equal(await redis.hget(keys[6], 'count'), '1');
	const initial = await state();
	assert.equal(initial.people, 2);
	assert.equal(initial.maxHp, 120);
	assert.equal(initial.fallAt - initial.startedAt, 3200);
	assert.equal(initial.endsAt - initial.fallAt, 36000);
	const [seconds] = await redis.time();
	assert.equal(await redis.hget(keys[6], 'day'), String(Math.floor(Number(seconds) / 86400)));
	checks++;

	await transition('attack', 'alice', initial.id, 'charging');
	assert.equal((await state()).hp, initial.hp);
	await ready();
	await Promise.all(Array.from({ length: 8 }, (_, index) => transition('attack', 'alice', initial.id, `race-${index}`, index % 2 ? secondWorker : redis)));
	assert.equal((await state()).hp, initial.hp - 8);
	const accepted = await redis.smembers(keys[5]);
	assert.equal(accepted.length, 1);
	await redis.hset(keys[4], 'alice', 0);
	await transition('attack', 'alice', initial.id, accepted[0].slice('alice:'.length));
	assert.equal((await state()).hp, initial.hp - 8);
	await transition('attack', 'bob', initial.id, 'bob-first');
	assert.equal((await state()).hp, initial.hp - 16);
	checks++;

	const ratio = (await state()).ratio;
	for (let index = 0; index < 10; index++) {
		await transition('sync', 'extra');
		assert.equal((await state()).hp, Math.max(1, Math.round(ratio * 140)));
		await redis.zrem(keys[1], 'extra');
		await transition('tick');
		assert.equal((await state()).hp, Math.max(1, Math.round(ratio * 120)));
	}
	assert.equal((await state()).ratio, ratio);
	checks++;

	const deadline = await now() - 1000;
	await setState({ endsAt: deadline });
	const expired = (await transition('tick')).state;
	assert.equal(expired.status, 'escaped');
	assert.equal(expired.finishedAt, deadline);
	const awards = await redis.hgetall(keys[3]);
	for (const user of ['alice', 'bob', 'extra']) {
		assert.deepEqual(JSON.parse(awards[`${initial.id}:${user}`]), { userId: user, type: 'ltlPunchDefeat' });
	}
	await transition('sync', 'late');
	assert.equal(await redis.hexists(keys[3], `${initial.id}:late`), 0);
	assert.equal((await transition('start', 'alice', 'cooldown')).started, false);
	assert.equal(await redis.hget(keys[6], 'count'), '1');
	checks++;

	await setState({ finishedAt: await now() - 61000 });
	assert.equal((await transition('start', 'alice', 'round-three')).started, true);
	assert.equal(await redis.hget(keys[6], 'count'), '2');
	await ready();
	await setState({ hp: 8, ratio: 8 / (await state()).maxHp });
	const won = (await transition('attack', 'alice', 'round-three', 'winning')).state;
	assert.equal(won.status, 'won');
	assert.equal(won.hp, 0);
	assert.ok(won.finishedAt >= won.fallAt);
	assert.equal(JSON.parse(await redis.hget(keys[3], 'round-three:alice')).type, 'ltlPunchVictory');
	const revision = won.revision;
	await transition('attack', 'alice', 'round-three', 'winning', secondWorker);
	assert.equal((await state()).revision, revision);
	await transition('sync', 'after-win');
	assert.equal(await redis.hexists(keys[3], 'round-three:after-win'), 0);
	await setState({ finishedAt: await now() - 61000 });
	assert.equal((await transition('start', 'alice', 'daily-blocked')).started, false);
	assert.equal(await redis.hget(keys[6], 'count'), '2');
	checks++;

	// Simulate a persisted prior-day counter, without exposing a production test clock.
	const currentDay = Math.floor(await now() / 86400000);
	await redis.hset(keys[6], 'day', currentDay - 1, 'count', 2);
	assert.equal((await transition('start', 'alice', 'next-day')).started, true);
	assert.equal(await redis.hget(keys[6], 'count'), '1');
	assert.equal(await redis.hget(keys[6], 'day'), String(Math.floor(await now() / 86400000)));
	checks++;
	console.log(`LTL punch Redis assertions passed: ${checks} groups`);
} finally {
	// Never flushDB or match/delete a wildcard. Only this invocation's exact key list is removed.
	try {
		if (redis.status === 'ready') await reset();
	} finally {
		redis.disconnect();
		secondWorker.disconnect();
	}
}
