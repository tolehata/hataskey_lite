/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { HatadyTimelineChannel } from '@/server/api/stream/channels/hatady-timeline.js';

// This test exercises timeline sync only; re2 is loaded transitively but no regex behavior is used.
vi.mock('re2', () => ({ default: RegExp }));

function fixture(scope: 'mine' | 'recent' | 'following' = 'recent') {
	const subscriber = new EventEmitter();
	const sent: { type: string; body: Record<string, unknown> }[] = [];
	const logs = new Map<string, Record<string, unknown>>();
	const logRepository = { findOneBy: vi.fn(async ({ id }: { id: string }) => logs.get(id) ?? null) };
	const hatady = {
		canAppearInTimeline: vi.fn(async () => true),
		canViewLog: vi.fn(async (log: { visibility: string }) => log.visibility === 'public'),
		isFollowing: vi.fn(async () => true),
	};
	const activity = { packActivities: vi.fn(async (candidates: { id: string }[]) => candidates.map(candidate => ({ id: candidate.id }))) };
	const connection = {
		user: { id: 'viewer' }, subscriber,
		userIdsWhoMeMuting: new Set<string>(), userIdsWhoBlockingMe: new Set<string>(),
		sendMessageToWs: (_type: string, data: { type: string; body: Record<string, unknown> }) => sent.push({ type: data.type, body: data.body }),
	};
	const channel = new HatadyTimelineChannel(activity as never, hatady as never, { canViewSession: vi.fn() } as never, logRepository as never, { findOneBy: vi.fn(async () => null) } as never, { findOneBy: vi.fn(async () => null) } as never, 'channel', connection as never);
	channel.init({ scope });
	return { channel, logs, sent, logRepository, hatady, activity, subscriber, connection };
}

function visibleLog(id: string) {
	return { id, userId: 'owner', kind: 'study', visibility: 'public', isPublic: true, studiedAt: new Date(), reactionsCount: 0 };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

describe('Hatady timeline channel sync', () => {
	test('only packs currently visible records and removes requested missing or private IDs identically', async () => {
		const f = fixture();
		f.logs.set('visible', { id: 'visible', userId: 'owner', kind: 'study', visibility: 'public', isPublic: true, studiedAt: new Date(), reactionsCount: 0 });
		f.logs.set('private', { id: 'private', userId: 'owner', kind: 'study', visibility: 'private', isPublic: false, studiedAt: new Date(), reactionsCount: 0 });
		await f.channel.onMessage('sync', { ids: ['log:visible', 'log:private', 'log:missing'], seenThrough: 0, requestId: 1 });
		expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toEqual(['log:visible']);
		expect(f.sent.filter(event => event.type === 'removed').map(event => event.body)).toEqual([
			expect.objectContaining({ key: 'log:private', id: 'private' }),
			expect.objectContaining({ key: 'log:missing', id: 'missing' }),
		]);
		expect(f.activity.packActivities).toHaveBeenCalledTimes(1);
		f.channel.dispose();
		expect(f.subscriber.listenerCount('hatadyTimelineStream')).toBe(0);
	});

	test('rejects oversized and stale sync without repository access', async () => {
		const f = fixture();
		await f.channel.onMessage('sync', { ids: Array.from({ length: 501 }, (_, i) => `log:${i}`), seenThrough: 0, requestId: 1 });
		await f.channel.onMessage('sync', { ids: [], seenThrough: 1, requestId: 2 });
		expect(f.logRepository.findOneBy).not.toHaveBeenCalled();
		expect(f.sent).toEqual([]);
		f.channel.dispose();
	});

	test('an empty sync completes and a later sync starts a new worker', async () => {
		const f = fixture();
		await f.channel.onMessage('sync', { ids: [], seenThrough: 0, requestId: 1 });
		f.logs.set('later', visibleLog('later'));
		await f.channel.onMessage('sync', { ids: ['log:later'], seenThrough: 1, requestId: 2 });
		expect(f.sent.filter(event => event.type === 'synced').map(event => event.body.requestId)).toEqual([1, 2]);
		expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toEqual(['log:later']);
		f.channel.dispose();
	});

	test('an older sync cannot restore an ID after a newer sync has completed', async () => {
		const f = fixture();
		const old = deferred<Record<string, unknown> | null>();
		f.logRepository.findOneBy.mockImplementation(async ({ id }) => id === 'old' ? old.promise : f.logs.get(id) ?? null);
		f.logs.set('new', visibleLog('new'));
		const first = f.channel.onMessage('sync', { ids: ['log:old'], seenThrough: 0, requestId: 1 });
		await vi.waitFor(() => expect(f.logRepository.findOneBy).toHaveBeenCalledWith({ id: 'old' }));
		const second = f.channel.onMessage('sync', { ids: ['log:new'], seenThrough: 0, requestId: 2 });
		expect(second).toBe(first);
		expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1);
		old.resolve(visibleLog('old'));
		await Promise.all([first, second]);
		expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toEqual(['log:new']);
		expect(f.sent.filter(event => event.type === 'synced').map(event => event.body.requestId)).toEqual([2]);
		f.channel.dispose();
	});

	test('a deletion during a pending sync prevents packing the old row', async () => {
		const f = fixture();
		const old = deferred<Record<string, unknown> | null>();
		f.logRepository.findOneBy.mockImplementation(async () => old.promise);
		const sync = f.channel.onMessage('sync', { ids: ['log:gone'], seenThrough: 0, requestId: 1 });
		await vi.waitFor(() => expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1));
		f.subscriber.emit('hatadyTimelineStream', { type: 'changed', body: { source: 'log', id: 'gone' } });
		old.resolve(visibleLog('gone'));
		await sync;
		expect(f.activity.packActivities).not.toHaveBeenCalled();
		f.channel.dispose();
	});

	test('an unacknowledged ID remains watched until its deletion is sent', async () => {
		const f = fixture();
		f.logs.set('unacked', visibleLog('unacked'));
		await f.channel.onMessage('sync', { ids: ['log:unacked'], seenThrough: 0, requestId: 1 });
		await f.channel.onMessage('sync', { ids: [], seenThrough: 0, requestId: 2 });
		f.logs.delete('unacked');
		f.subscriber.emit('hatadyTimelineStream', { type: 'changed', body: { source: 'log', id: 'unacked' } });
		await vi.waitFor(() => expect(f.sent.filter(event => event.type === 'removed').map(event => event.body.key)).toContain('log:unacked'));
		f.channel.dispose();
	});

	test('dirty tracking is capped and only the affected viewer receives relationship refresh', async () => {
		const f = fixture();
		for (let i = 0; i < 501; i++) f.subscriber.emit('hatadyTimelineStream', { type: 'changed', body: { source: 'log', id: `id${i}` } });
		expect(f.sent.filter(event => event.type === 'resyncRequired')).toHaveLength(1);
		expect((f.channel as unknown as { dirty: Set<string> }).dirty.size).toBe(0);
		await f.channel.onMessage('sync', { ids: [], seenThrough: 0, requestId: 1 });
		f.subscriber.emit('hatadyTimelineStream', { type: 'refresh', body: { viewerId: 'another' } });
		expect(f.sent.filter(event => event.type === 'resyncRequired')).toHaveLength(1);
		f.subscriber.emit('hatadyTimelineStream', { type: 'refresh', body: { viewerId: 'viewer' } });
		expect(f.sent.filter(event => event.type === 'resyncRequired')).toHaveLength(2);
		f.channel.dispose();
	});

	test('dispose does not requeue or publish an in-flight sync', async () => {
		const f = fixture();
		const old = deferred<Record<string, unknown> | null>();
		f.logRepository.findOneBy.mockImplementation(async () => old.promise);
		const sync = f.channel.onMessage('sync', { ids: ['log:old'], seenThrough: 0, requestId: 1 });
		await vi.waitFor(() => expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1));
		const queued = f.channel.onMessage('sync', { ids: ['log:later'], seenThrough: 0, requestId: 2 });
		f.channel.dispose();
		old.resolve(visibleLog('old'));
		await Promise.all([sync, queued]);
		expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1);
		expect(f.sent).toEqual([]);
		expect((f.channel as unknown as { dirty: Set<string> }).dirty.size).toBe(0);
	});

	test('sync keeps a real change that arrived before its coalescing timer fired', async () => {
		const f = fixture();
		f.logs.set('fresh', visibleLog('fresh'));
		f.subscriber.emit('hatadyTimelineStream', { type: 'changed', body: { source: 'log', id: 'fresh' } });
		await f.channel.onMessage('sync', { ids: [], seenThrough: 0, requestId: 1 });
		await vi.waitFor(() => expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toContain('log:fresh'));
		f.channel.dispose();
	});

	test('sync keeps a live change whose reconciliation is already in flight', async () => {
		const f = fixture();
		const held = deferred<Record<string, unknown> | null>();
		f.logs.set('fresh', visibleLog('fresh'));
		f.logRepository.findOneBy.mockImplementationOnce(async () => held.promise);
		f.subscriber.emit('hatadyTimelineStream', { type: 'changed', body: { source: 'log', id: 'fresh' } });
		try {
			await vi.waitFor(() => expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1));
			await f.channel.onMessage('sync', { ids: [], seenThrough: 0, requestId: 1 });
			held.resolve(visibleLog('fresh'));
			await vi.waitFor(() => expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toContain('log:fresh'));
		} finally {
			held.resolve(visibleLog('fresh'));
			f.channel.dispose();
		}
	});

	test('a same-key sync flood keeps one lookup active and only reconciles the latest request', async () => {
		const f = fixture();
		const held = deferred<Record<string, unknown> | null>();
		let active = 0;
		let peakActive = 0;
		f.logRepository.findOneBy.mockImplementation(async () => {
			active++;
			peakActive = Math.max(peakActive, active);
			try {
				return await (active === 1 && f.logRepository.findOneBy.mock.calls.length === 1 ? held.promise : visibleLog('same'));
			} finally {
				active--;
			}
		});
		const requests = [f.channel.onMessage('sync', { ids: ['log:same'], seenThrough: 0, requestId: 1 })];
		await vi.waitFor(() => expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1));
		for (let requestId = 2; requestId <= 501; requestId++) requests.push(f.channel.onMessage('sync', { ids: ['log:same'], seenThrough: 0, requestId }));
		expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1);
		held.resolve(visibleLog('same'));
		await Promise.all(requests);
		expect(peakActive).toBe(1);
		expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(2);
		expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toEqual(['log:same']);
		expect(f.sent.filter(event => event.type === 'synced').map(event => event.body.requestId)).toEqual([501]);
		f.channel.dispose();
	});

	test('distinct overlapping IDs retain only the newest pending sync without forcing resync', async () => {
		const f = fixture();
		const held = deferred<Record<string, unknown> | null>();
		f.logRepository.findOneBy.mockImplementation(async ({ id }) => id === 'id0' ? held.promise : visibleLog(id));
		const requests = [f.channel.onMessage('sync', { ids: ['log:id0'], seenThrough: 0, requestId: 1 })];
		await vi.waitFor(() => expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1));
		for (let i = 1; i <= 500; i++) requests.push(f.channel.onMessage('sync', { ids: [`log:id${i}`], seenThrough: 0, requestId: i + 1 }));
		const state = f.channel as unknown as { watched: Set<string>; dirty: Set<string>; processing: Set<string>; inflight: Map<string, number>; generations: Map<string, number> };
		const known = new Set([...state.watched, ...state.dirty, ...state.processing, ...state.inflight.keys()]);
		expect(known.size).toBeLessThanOrEqual(500);
		expect(state.generations.size).toBeLessThanOrEqual(500);
		expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(1);
		expect(f.sent.filter(event => event.type === 'resyncRequired')).toHaveLength(0);
		held.resolve(null);
		await Promise.all(requests);
		expect(f.logRepository.findOneBy).toHaveBeenCalledTimes(2);
		expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toEqual(['log:id500']);
		expect(f.sent.filter(event => event.type === 'synced').map(event => event.body.requestId)).toEqual([501]);
		f.channel.dispose();
	});

	test('reconnected sync trusts the current policy when connection relation cache is stale', async () => {
		const f = fixture();
		f.logs.set('visible', visibleLog('visible'));
		f.connection.userIdsWhoMeMuting.add('owner');
		f.connection.userIdsWhoBlockingMe.add('owner');
		await f.channel.onMessage('sync', { ids: ['log:visible'], seenThrough: 0, requestId: 1 });
		expect(f.sent.filter(event => event.type === 'activity').map(event => event.body.key)).toEqual(['log:visible']);
		f.channel.dispose();
	});
});
