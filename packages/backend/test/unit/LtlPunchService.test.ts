/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { describe, expect, test, vi } from 'vitest';
import { LtlPunchService } from '@/core/LtlPunchService.js';
import { hasLtlPunchTrigger, validLtlPunchId } from '@/misc/ltl-punch.js';
import { LtlPunchChannel } from '@/server/api/stream/channels/ltl-punch.js';

describe('LTL punch boundaries', () => {
	test('requires three identical fists and normalizes variation selectors and skin tones', () => {
		for (const text of ['🤛🤛🤛', 'text 👊🏽👊🏻👊🏿 text', '🤜️🤜️🤜️']) expect(hasLtlPunchTrigger(text)).toBe(true);
		for (const text of [null, '👊👊', '🤛👊🤜', '👊 👊 👊', '🤛a🤛🤛']) expect(hasLtlPunchTrigger(text)).toBe(false);
	});
	test('rejects malformed request IDs', () => {
		for (const id of ['', 'x'.repeat(81), {}, 'a:b', '\n']) expect(validLtlPunchId(id)).toBe(false);
		expect(validLtlPunchId('event-123_ABC')).toBe(true);
	});
	test('private, channel and remote notes never call Redis or consume a daily attempt', async () => {
		const redis = { eval: vi.fn().mockResolvedValue(JSON.stringify({ state: null, started: false, changed: false })) };
		const service = new LtlPunchService(redis as never, {} as never, {} as never);
		const note = { text: '👊👊👊', visibility: 'public', channelId: null, userHost: null, userId: 'local' };
		for (const override of [{ visibility: 'private' }, { channelId: 'channel' }, { userHost: 'remote' }, { text: '👊🤛🤜' }]) {
			expect(await service.onNoteCreated({ ...note, ...override } as never, { id: 'local', host: null })).toBe(false);
		}
		expect(redis.eval).not.toHaveBeenCalled();
		expect(await service.onNoteCreated(note as never, { id: 'local', host: null })).toBe(false);
		expect(redis.eval).toHaveBeenCalledOnce();
	});
	test('outbox retains failed awards and deletes only successful awards', async () => {
		const redis = {
			eval: vi.fn().mockResolvedValue('{"state":null,"changed":false,"started":false}'),
			hscan: vi.fn().mockResolvedValue(['0', ['event:bad', '{"userId":"bad","type":"ltlPunchDefeat"}', 'event:good', '{"userId":"good","type":"ltlPunchVictory"}']]),
			hdel: vi.fn(),
		};
		const create = vi.fn().mockRejectedValueOnce(new Error('DB unavailable')).mockResolvedValue(undefined);
		const service = new LtlPunchService(redis as never, { publishLtlPunchStream: vi.fn() } as never, { create } as never);
		await (service as unknown as { tick(): Promise<void> }).tick();
		expect(redis.hdel).toHaveBeenCalledExactlyOnceWith('ltlPunch:awards', 'event:good');
		await (service as unknown as { tick(): Promise<void> }).tick();
		expect(redis.hdel).toHaveBeenCalledWith('ltlPunch:awards', 'event:bad');
	});
	test('disposed asynchronous initialization leaves no subscriptions or presence', async () => {
		let resolve!: (value: { ltlAvailable: boolean }) => void;
		const role = { getUserPolicies: () => new Promise<{ ltlAvailable: boolean }>(done => { resolve = done; }) };
		const subscriber = { on: vi.fn(), off: vi.fn() };
		const punch = { sync: vi.fn() };
		const channel = new LtlPunchChannel(role as never, punch as never, 'id', { user: { id: 'local', host: null }, subscriber } as never);
		const init = channel.init({});
		channel.dispose();
		resolve({ ltlAvailable: true });
		expect(await init).toBe(false);
		expect(subscriber.on).not.toHaveBeenCalled();
		expect(punch.sync).not.toHaveBeenCalled();
	});
	test('compact outbox pages larger than COUNT progress beyond repeatedly failing first entries', async () => {
		const entries = Array.from({ length: 60 }, (_, index) => [`event:u${index}`, JSON.stringify({ userId: `u${index}`, type: 'ltlPunchVictory' })]).flat();
		const redis = {
			eval: vi.fn().mockResolvedValue('{"state":null,"changed":false,"started":false}'),
			hscan: vi.fn().mockResolvedValue(['0', entries]), hdel: vi.fn(),
		};
		const create = vi.fn().mockImplementation(async (userId: string) => {
			if (Number(userId.slice(1)) < 50) throw new Error('permanent failure');
		});
		const service = new LtlPunchService(redis as never, { publishLtlPunchStream: vi.fn() } as never, { create } as never);
		const tick = () => (service as unknown as { tick(): Promise<void> }).tick();
		await tick();
		expect(create).toHaveBeenCalledTimes(50);
		expect(redis.hdel).not.toHaveBeenCalled();
		await tick();
		expect(redis.hscan).toHaveBeenCalledOnce();
		expect(redis.hdel).toHaveBeenCalledTimes(10);
		expect(redis.hdel).toHaveBeenCalledWith('ltlPunch:awards', 'event:u59');
	});
	test('a late startup null snapshot cannot clear an active event', async () => {
		const state = { id: 'event', revision: 1, startedAt: 100, fallAt: 3300, endsAt: 39300, finishedAt: null, status: 'active', hp: 100, maxHp: 100, people: 1, serverNow: 100 };
		const connection = { user: { id: 'local', host: null }, subscriber: { on: vi.fn(), off: vi.fn() }, sendMessageToWs: vi.fn() };
		const channel = new LtlPunchChannel({ getUserPolicies: vi.fn().mockResolvedValue({ ltlAvailable: true }) } as never, { sync: vi.fn().mockResolvedValue(state) } as never, 'id', connection as never);
		await channel.init({});
		connection.sendMessageToWs.mockClear();
		const receive = channel as unknown as { onState(event: unknown): void };
		receive.onState({ type: 'state', body: null });
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		channel.dispose();
	});
	test('remote accounts and denied LTL policies cannot join', async () => {
		const role = { getUserPolicies: vi.fn().mockResolvedValue({ ltlAvailable: false }) };
		const punch = { sync: vi.fn() };
		for (const host of [null, 'remote']) {
			const channel = new LtlPunchChannel(role as never, punch as never, 'id', { user: { id: 'local', host } } as never);
			expect(await channel.init({})).toBe(false);
		}
		expect(punch.sync).not.toHaveBeenCalled();
	});
	test('malformed attacks do not clear state and sync traffic cannot block attacks', async () => {
		const role = { getUserPolicies: vi.fn().mockResolvedValue({ ltlAvailable: true }) };
		const punch = { sync: vi.fn().mockResolvedValue(null), attack: vi.fn().mockResolvedValue(null) };
		const connection = { user: { id: 'local', host: null }, subscriber: { on: vi.fn(), off: vi.fn() }, sendMessageToWs: vi.fn() };
		const channel = new LtlPunchChannel(role as never, punch as never, 'id', connection as never);
		await channel.init({});
		connection.sendMessageToWs.mockClear();
		channel.onMessage('attack', { eventId: [], requestId: 'request' });
		expect(punch.attack).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		channel.onMessage('sync', {});
		channel.onMessage('attack', { eventId: 'event', requestId: 'request' });
		expect(punch.attack).toHaveBeenCalledWith('local', 'event', 'request');
		channel.dispose();
	});
});
