/* SPDX-License-Identifier: AGPL-3.0-only */
import type { EventEmitter } from 'node:events';
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';

// Keep Xev's real process-message behavior while exposing the two module instances.
const instances = vi.hoisted(() => [] as (EventEmitter & { dispose(): void })[]);
vi.mock('xev', async importOriginal => {
	const { default: Xev } = await importOriginal<typeof import('xev')>();
	return { default: class extends Xev {
		constructor() {
			super();
			instances.push(this);
		}
	} };
});

import { ServerStatsChannelService } from '@/server/api/stream/channels/server-stats.js';
import { QueueStatsChannelService } from '@/server/api/stream/channels/queue-stats.js';

type TestChannel = ReturnType<ServerStatsChannelService['create']> | ReturnType<QueueStatsChannelService['create']>;
const channels: TestChannel[] = [];

function create(kind: 'server' | 'queue', name: string = kind) {
	const sent: { type: string; body: unknown }[] = [];
	const connection = {
		sendMessageToWs: (_type: string, event: { type: string; body: unknown }) => sent.push({ type: event.type, body: event.body }),
	};
	const channel = kind === 'server'
		? new ServerStatsChannelService().create(name, connection as never)
		: new QueueStatsChannelService().create(name, connection as never);
	channels.push(channel);
	return { channel, sent };
}

function emitter(kind: 'server' | 'queue') {
	return instances[kind === 'server' ? 0 : 1];
}

function pending(kind: 'server' | 'queue') {
	const prefix = kind === 'server' ? 'serverStatsLog:' : 'queueStatsLog:';
	return emitter(kind).eventNames().filter(name => typeof name === 'string' && name.startsWith(prefix)) as string[];
}

afterEach(() => {
	for (const channel of channels.splice(0)) channel.dispose();
	vi.useRealTimers();
});

afterAll(() => {
	for (const ev of instances) ev.dispose();
});

describe('stats log channel request lifecycle', () => {
	test.each(['server', 'queue'] as const)('%s bounds unanswered requests and releases them on disconnect', kind => {
		const { channel } = create(kind);
		for (let i = 0; i < 40; i++) channel.onMessage('requestLog', { id: String(i), length: 1 });
		expect(pending(kind)).toHaveLength(8);
		channel.dispose();
		channel.dispose();
		expect(pending(kind)).toHaveLength(0);
		channel.onMessage('requestLog', { id: 'after-dispose', length: 1 });
		expect(pending(kind)).toHaveLength(0);
	});

	test('both channel types share a finite process budget', () => {
		for (let i = 0; i < 128; i++) {
			const { channel } = create(i % 2 === 0 ? 'server' : 'queue', String(i));
			for (let j = 0; j < 8; j++) channel.onMessage('requestLog', { id: String(j), length: 1 });
		}
		expect(pending('server').length + pending('queue').length).toBe(1024);
		create('server').channel.onMessage('requestLog', { id: 'extra', length: 1 });
		create('queue').channel.onMessage('requestLog', { id: 'extra', length: 1 });
		expect(pending('server').length + pending('queue').length).toBe(1024);
		channels[0].dispose();
		expect(pending('server').length + pending('queue').length).toBe(1016);
		channels[128].onMessage('requestLog', { id: 'after-release', length: 1 });
		expect(pending('server').length + pending('queue').length).toBe(1017);
	});

	test.each(['server', 'queue'] as const)('%s disconnect removes one pending listener and its timer', kind => {
		vi.useFakeTimers();
		const { channel } = create(kind);
		channel.onMessage('requestLog', { id: 'unanswered', length: 1 });
		expect(pending(kind)).toHaveLength(1);
		channel.dispose();
		channel.dispose();
		expect(pending(kind)).toHaveLength(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	test('unanswered requests expire and late replies do not reach a channel', () => {
		vi.useFakeTimers();
		const { channel, sent } = create('server');
		channel.onMessage('requestLog', { id: 'one', length: 2 });
		const response = pending('server')[0];
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(5000);
		expect(pending('server')).toHaveLength(0);
		expect(vi.getTimerCount()).toBe(0);
		emitter('server').emit(response, ['late']);
		expect(sent).toEqual([]);
		channel.onMessage('requestLog', { id: 'two', length: 2 });
		expect(pending('server')).toHaveLength(1);
		channel.dispose();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('real Xev delivery preserves stats and statsLog payloads with synchronous and later replies', async () => {
		const { channel, sent } = create('server');
		await channel.init({});
		emitter('server').emit('serverStats', { cpu: 1 });
		const request = vi.fn((body: { id: string; length: unknown }) => {
			expect(body.length).toBe('unchanged');
			emitter('server').emit(`serverStatsLog:${body.id}`, ['sync']);
		});
		emitter('server').on('requestServerStatsLog', request);
		try {
			channel.onMessage('requestLog', { id: 7, length: 'unchanged' });
			expect(sent).toEqual([{ type: 'stats', body: { cpu: 1 } }, { type: 'statsLog', body: ['sync'] }]);
			expect(pending('server')).toHaveLength(0);
			emitter('server').removeListener('requestServerStatsLog', request);
			channel.onMessage('requestLog', { id: 'a', length: 1 });
			channel.onMessage('requestLog', { id: 'b', length: 1 });
			const [first, second] = pending('server');
			expect(first).not.toBe(second);
			emitter('server').emit(second, ['second']);
			emitter('server').emit(first, ['first']);
			expect(sent.slice(2)).toEqual([{ type: 'statsLog', body: ['second'] }, { type: 'statsLog', body: ['first'] }]);
			expect(pending('server')).toHaveLength(0);
		} finally {
			emitter('server').removeListener('requestServerStatsLog', request);
		}
	});

	test.each(['server', 'queue'] as const)('%s isolates two channels with the same client ID', kind => {
		const first = create(kind, 'first');
		const second = create(kind, 'second');
		first.channel.onMessage('requestLog', { id: 'same', length: 1 });
		second.channel.onMessage('requestLog', { id: 'same', length: 1 });
		const [firstResponse, secondResponse] = pending(kind);
		expect(firstResponse).not.toBe(secondResponse);
		emitter(kind).emit(firstResponse, ['first']);
		expect(first.sent).toEqual([{ type: 'statsLog', body: ['first'] }]);
		expect(second.sent).toEqual([]);
		emitter(kind).emit(secondResponse, ['second']);
		expect(second.sent).toEqual([{ type: 'statsLog', body: ['second'] }]);
	});

	test.each(['server', 'queue'] as const)('%s forwards ordinary lengths and delivers each reply', kind => {
		const { channel, sent } = create(kind);
		const ev = emitter(kind);
		const requestEvent = kind === 'server' ? 'requestServerStatsLog' : 'requestQueueStatsLog';
		const responsePrefix = kind === 'server' ? 'serverStatsLog' : 'queueStatsLog';
		const observed: number[] = [];
		const respond = (body: { id: string; length: number }) => {
			observed.push(body.length);
			ev.emit(`${responsePrefix}:${body.id}`, [body.length]);
		};
		ev.on(requestEvent, respond);
		try {
			for (const length of [1, 50, 100, 200]) channel.onMessage('requestLog', { id: 'client', length });
			expect(observed).toEqual([1, 50, 100, 200]);
			expect(sent).toEqual(observed.map(length => ({ type: 'statsLog', body: [length] })));
			expect(pending(kind)).toHaveLength(0);
		} finally {
			ev.removeListener(requestEvent, respond);
		}
	});

	test('server accepts an omitted length without changing the request payload', () => {
		const { channel, sent } = create('server');
		const ev = emitter('server');
		const respond = vi.fn((body: { id: string; length?: unknown }) => {
			expect(body).toHaveProperty('length', undefined);
			ev.emit(`serverStatsLog:${body.id}`, []);
		});
		ev.on('requestServerStatsLog', respond);
		try {
			channel.onMessage('requestLog', { id: 'no-length' });
			expect(respond).toHaveBeenCalledTimes(1);
			expect(sent).toEqual([{ type: 'statsLog', body: [] }]);
		} finally {
			ev.removeListener('requestServerStatsLog', respond);
		}
	});

	test('malformed IDs never allocate listeners', () => {
		const server = create('server');
		const queue = create('queue');
		for (const id of [null, true, {}]) {
			server.channel.onMessage('requestLog', { id, length: 1 });
			queue.channel.onMessage('requestLog', { id, length: 1 });
		}
		server.channel.onMessage('requestLog', {});
		queue.channel.onMessage('requestLog', {});
		queue.channel.onMessage('requestLog', { id: 3, length: 1 });
		queue.channel.onMessage('requestLog', { id: '', length: 'bad' });
		expect(pending('server')).toHaveLength(0);
		expect(pending('queue')).toHaveLength(0);
		server.channel.onMessage('requestLog', { id: '', length: 1 });
		queue.channel.onMessage('requestLog', { id: '', length: 1 });
		expect(pending('server')).toHaveLength(1);
		expect(pending('queue')).toHaveLength(1);
	});

	test.each(['server', 'queue'] as const)('%s accepts long client IDs without retaining them in event names', kind => {
		const { channel, sent } = create(kind);
		const ev = emitter(kind);
		const requestEvent = kind === 'server' ? 'requestServerStatsLog' : 'requestQueueStatsLog';
		const responsePrefix = kind === 'server' ? 'serverStatsLog' : 'queueStatsLog';
		const clientId = 'x'.repeat(1024);
		const respond = vi.fn((body: { id: string; length: number }) => {
			expect(body.id).toHaveLength(36);
			expect(body.id).not.toBe(clientId);
			ev.emit(`${responsePrefix}:${body.id}`, ['log']);
		});
		ev.on(requestEvent, respond);
		try {
			channel.onMessage('requestLog', { id: clientId, length: 1 });
			expect(respond).toHaveBeenCalledTimes(1);
			expect(sent).toEqual([{ type: 'statsLog', body: ['log'] }]);
			expect(pending(kind)).toHaveLength(0);
		} finally {
			ev.removeListener(requestEvent, respond);
		}
		for (let i = 0; i < 40; i++) channel.onMessage('requestLog', { id: clientId, length: 1 });
		expect(pending(kind)).toHaveLength(8);
		for (const event of pending(kind)) expect(event).toHaveLength(responsePrefix.length + 1 + 36);
		channel.dispose();
		expect(pending(kind)).toHaveLength(0);
	});

	test('emit exceptions release the exact listener and shared budget', () => {
		const { channel } = create('server');
		const ev = emitter('server');
		const original = ev.emit;
		const spy = vi.spyOn(ev, 'emit').mockImplementation((event, ...args) => {
			if (event === 'requestServerStatsLog') throw new Error('emit failed');
			return original.call(ev, event, ...args);
		});
		try {
			expect(() => channel.onMessage('requestLog', { id: 'x', length: 1 })).toThrow('emit failed');
			expect(pending('server')).toHaveLength(0);
		} finally {
			spy.mockRestore();
		}
		channel.onMessage('requestLog', { id: 'next', length: 1 });
		expect(pending('server')).toHaveLength(1);
	});
});
