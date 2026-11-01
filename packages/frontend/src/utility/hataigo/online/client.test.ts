/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOnlineClient } from './client.js';
import type { GameEvents } from './controller.js';
import type { OnlineAction } from './types.js';

const fixture = vi.hoisted(() => ({ account: { id: 'me', token: 'token' }, request: vi.fn(), send: vi.fn(), dispose: vi.fn(), state: 'connected', handlers: new Map<string, (value: unknown) => void>(), on: vi.fn(), off: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: fixture.account }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.request }));
vi.mock('@/stream.js', () => ({ useStream: () => ({ get state() { return fixture.state; }, on: fixture.on, off: fixture.off, useChannel: () => ({ on: (event: string, callback: (value: unknown) => void) => fixture.handlers.set(event, callback), off: (event: string) => fixture.handlers.delete(event), send: fixture.send, dispose: fixture.dispose }) }) }));

function events(): GameEvents { return { updated: vi.fn(), spectators: vi.fn(), reacted: vi.fn(), revoked: vi.fn(), connection: vi.fn() }; }

function deliver(event: string, payload: unknown): void { const callback = fixture.handlers.get(event); if (callback === undefined) throw new Error(`Missing ${event}`); callback(payload); }

beforeEach(() => { vi.useFakeTimers(); fixture.request.mockReset().mockResolvedValue({}); fixture.send.mockReset(); fixture.dispose.mockReset(); fixture.handlers.clear(); fixture.state = 'connected'; fixture.account.token = 'token'; fixture.on.mockClear(); fixture.off.mockClear(); });
afterEach(() => vi.useRealTimers());

describe('free match queue', () => {
	it('treats an empty 204 reply (misskeyApi resolves undefined) as waiting in the queue', async () => {
		fixture.request.mockResolvedValueOnce(undefined);
		const client = createOnlineClient();
		await expect(client.api.match({ size: 19, clockKind: 'byoyomi', allowSpectate: false, allowSpectatorChat: false, publicAfterEnd: false })).resolves.toBeNull();
	});
});

describe('online transport acknowledgement contract', () => {
	it('strips forged client color and waits for the matching stream acknowledgement', async () => {
		const client = createOnlineClient();
		const stop = client.watchGame('g', events());
		const action = { type: 'pass', color: 'white' } as OnlineAction;
		const pending = client.api.action('g', action, 7);
		expect(fixture.send).toHaveBeenCalledWith('action', expect.objectContaining({ action: { type: 'pass' }, expectedRevision: 7 }));
		const payload = fixture.send.mock.calls.at(0)?.[1] as { requestId: string };
		deliver('ack', { requestId: payload.requestId, ok: true });
		await pending;
		expect(fixture.request).not.toHaveBeenCalled();
		stop();
	});

	it('does not retry an uncertain stream action over HTTP', async () => {
		const client = createOnlineClient();
		const stop = client.watchGame('g', events());
		const pending = client.api.action('g', { type: 'pass' }, 3);
		const rejected = expect(pending).rejects.toThrow('NETWORK');
		await vi.advanceTimersByTimeAsync(8000);
		await rejected;
		expect(fixture.request).not.toHaveBeenCalled();
		stop();
	});

	it('uses the API only when there is no connected stream frame', async () => {
		const client = createOnlineClient();
		fixture.state = 'reconnecting';
		await client.api.action('g', { type: 'play', point: { x: 1, y: 2 } }, 4);
		expect(fixture.request).toHaveBeenCalledExactlyOnceWith('hataigo/action', { gameId: 'g', action: { type: 'play', point: { x: 1, y: 2 } }, expectedRevision: 4 }, 'token');
		expect(fixture.send).not.toHaveBeenCalled();
	});

	it('exposes only count and fixed reactions and removes listeners on disposal', async () => {
		const client = createOnlineClient();
		const listener = events();
		const stop = client.watchGame('g', listener);
		deliver('spectators', { count: 2, userIds: ['private'] });
		deliver('reacted', { reaction: 'arbitrary text' });
		deliver('reacted', { reaction: '👏', userId: 'private' });
		expect(listener.spectators).toHaveBeenCalledExactlyOnceWith(2);
		expect(listener.reacted).toHaveBeenCalledExactlyOnceWith('👏');
		stop();
		expect(fixture.handlers.size).toBe(0);
		expect(fixture.off).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('returns a stale revision acknowledgement without an HTTP retry', async () => {
		const client = createOnlineClient();
		const stop = client.watchGame('g', events());
		const pending = client.api.action('g', { type: 'pass' }, 3);
		const rejected = expect(pending).rejects.toThrow('HATAIGO_STALE_REVISION');
		const payload = fixture.send.mock.calls.at(0)?.[1] as { requestId: string };
		deliver('ack', { requestId: payload.requestId, ok: false, error: 'HATAIGO_STALE_REVISION' });
		await rejected;
		expect(fixture.request).not.toHaveBeenCalled();
		stop();
	});

	it('rejects a pending action and clears its timer when hidden or disposed', async () => {
		const client = createOnlineClient();
		const stop = client.watchGame('g', events());
		const pending = client.api.action('g', { type: 'pass' }, 3);
		const rejected = expect(pending).rejects.toThrow('CANCELLED');
		stop();
		await rejected;
		expect(vi.getTimerCount()).toBe(0);
		expect(fixture.request).not.toHaveBeenCalled();
	});

	it('rejects a request response after a token switch and sends no further commands', async () => {
		const client = createOnlineClient();
		let resolve: (value: unknown) => void = () => {};
		fixture.request.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
		const pending = client.api.show('g');
		const rejected = expect(pending).rejects.toThrow('HATAIGO_UNAVAILABLE');
		fixture.account.token = 'different';
		resolve({});
		await rejected;
		await expect(client.api.action('g', { type: 'pass' }, 1)).rejects.toThrow('HATAIGO_UNAVAILABLE');
		expect(fixture.request).toHaveBeenCalledTimes(1);
		expect(fixture.send).not.toHaveBeenCalled();
	});
});
