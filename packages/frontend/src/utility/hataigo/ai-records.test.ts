/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeAiRecord, useAiRecords } from './ai-records.js';
import type { AiRecord } from './ai-records.js';

type Account = { id: string; token: string };
type Params = { scope: string[]; key?: string; value?: unknown };
const fixture = vi.hoisted(() => ({ api: vi.fn(), account: { current: null as Account | null } }));
vi.mock('@/i.js', () => ({ get $i() { return fixture.account.current; } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixture.api(...args) }));

const data = new Map<string, Map<string, unknown>>();
let accountNumber = 0;
const record = (id = 'self-authored-game'): AiRecord => ({ id, size: 9, ownColor: 'black', winner: 'white', reason: 'resign', endedAt: '2026-10-20T00:00:00.000Z' });
const noKey = () => Object.assign(new Error('missing'), { code: 'NO_SUCH_KEY' });

async function api(endpoint: string, params: Params, token: string): Promise<unknown> {
	expect(params.scope).toEqual(['client', 'hataigo']);
	const storage = data.get(token) ?? new Map<string, unknown>();
	data.set(token, storage);
	if (endpoint === 'i/registry/get-all') return Object.fromEntries(storage);
	if (endpoint === 'i/registry/get') { if (!storage.has(params.key ?? '')) throw noKey(); return storage.get(params.key ?? ''); }
	if (endpoint === 'i/registry/set') { storage.set(params.key ?? '', params.value); return undefined; }
	throw new Error('Unexpected registry endpoint.');
}

beforeEach(() => {
	accountNumber++;
	fixture.account.current = { id: `record-owner-${accountNumber}`, token: `record-token-${accountNumber}` };
	data.clear();
	fixture.api.mockReset().mockImplementation(api);
});

describe('private immutable AI game records', () => {
	it('stores only metadata under one key per game and retains separate concurrent games', async () => {
		const store = useAiRecords();
		await store.load();
		expect(await Promise.all([store.save(record('first-game')), store.save(record('second-game'))])).toEqual([true, true]);
		expect(store.records.value.map(value => value.id)).toEqual(['first-game', 'second-game']);
		const token = fixture.account.current?.token ?? '';
		expect([...data.get(token)?.keys() ?? []]).toEqual(['aiRecord:first-game', 'aiRecord:second-game']);
		for (const value of data.get(token)?.values() ?? []) expect(Object.keys(value as object).sort()).toEqual(['endedAt', 'id', 'ownColor', 'reason', 'size', 'version', 'winner']);
	});

	it('deduplicates retries by id without another write', async () => {
		const store = useAiRecords();
		expect(await store.save(record())).toBe(true);
		expect(await store.save(record())).toBe(true);
		expect(store.records.value).toHaveLength(1);
		expect(fixture.api.mock.calls.filter(call => call[0] === 'i/registry/set')).toHaveLength(1);
	});

	it('refuses conflicting same-id content and preserves the existing value', async () => {
		const store = useAiRecords();
		await store.save(record());
		expect(await store.save({ ...record(), winner: 'black' })).toBe(false);
		expect(store.records.value[0].winner).toBe('white');
		expect(store.error.value).not.toBeNull();
		expect(fixture.api.mock.calls.filter(call => call[0] === 'i/registry/set')).toHaveLength(1);
	});

	it('can retry a failed save without losing another game or duplicating counts', async () => {
		const store = useAiRecords();
		await store.save(record('already-saved'));
		let fail = true;
		fixture.api.mockImplementation(async (endpoint: string, params: Params, token: string) => {
			if (endpoint === 'i/registry/set' && fail) { fail = false; throw new Error('offline'); }
			return api(endpoint, params, token);
		});
		expect(await store.save(record('retry-game'))).toBe(false);
		expect(store.records.value).toHaveLength(1);
		expect(await store.save(record('retry-game'))).toBe(true);
		expect(store.records.value).toHaveLength(2);
		expect(store.error.value).toBeNull();
	});

	it('filters exact prefixes, reports unknown/malformed versions and never overwrites them', async () => {
		const token = fixture.account.current?.token ?? '';
		data.set(token, new Map<string, unknown>([
			['display', { theme: 'fuji' }],
			['aiRecord:valid', { version: 1, ...record('valid') }],
			['aiRecord:unknown', { version: 2, privateFutureField: 5 }],
			['aiRecord:wrong-id', { version: 1, ...record('another-id') }],
		]));
		const store = useAiRecords();
		expect(await store.load()).toBe(false);
		expect(store.records.value.map(value => value.id)).toEqual(['valid']);
		expect(store.error.value).not.toBeNull();
		expect(await store.save(record('unknown'))).toBe(false);
		expect(data.get(token)?.get('aiRecord:unknown')).toEqual({ version: 2, privateFutureField: 5 });
	});

	it('does not truncate old metadata or replace an unrelated display key', async () => {
		const token = fixture.account.current?.token ?? '';
		const storage = new Map<string, unknown>([['display', { labels: false }]]);
		for (let i = 0; i < 520; i++) storage.set(`aiRecord:game-${i}`, { version: 1, ...record(`game-${i}`) });
		data.set(token, storage);
		const store = useAiRecords();
		await store.load();
		expect(store.records.value).toHaveLength(520);
		await store.save(record('new-game'));
		expect(store.records.value).toHaveLength(521);
		expect(storage.get('display')).toEqual({ labels: false });
	});

	it('does not save after an account change or expose another account history', async () => {
		const first = useAiRecords();
		await first.save(record('private-first'));
		fixture.account.current = { id: 'other-record-owner', token: 'other-record-token' };
		const second = useAiRecords();
		await second.load();
		expect(second.records.value).toEqual([]);
		expect(await first.save(record('late-first'))).toBe(false);
		expect(data.get('other-record-token')?.has('aiRecord:late-first')).toBe(false);
	});

	it('rejects invalid metadata before writing', async () => {
		expect(normalizeAiRecord({ ...record(), size: 10 })).toBeNull();
		expect(normalizeAiRecord({ ...record(), reason: 'score', winner: 'draw' })).not.toBeNull();
		expect(normalizeAiRecord({ ...record(), reason: 'resign', winner: 'draw' })).toBeNull();
		const store = useAiRecords();
		expect(await store.save({ ...record(), endedAt: 'invalid' })).toBe(false);
		expect(fixture.api.mock.calls.filter(call => call[0] === 'i/registry/set')).toHaveLength(0);
	});
});
