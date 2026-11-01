/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HumanStats } from './rewards-rules.js';

const fixture = vi.hoisted(() => ({ account: { id: 'me', token: 'token' }, request: vi.fn() }));
vi.mock('@/i.js', async () => { const { reactive } = await import('vue'); return { $i: reactive(fixture.account) }; });
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.request }));
let entries: Map<string, unknown>;
let human: HumanStats;
let failSet = false;
let failHuman = false;
beforeEach(() => {
	vi.resetModules();
	fixture.account.id = 'me'; fixture.account.token = 'token';
	entries = new Map(); failSet = false; failHuman = false;
	human = { wins: 0, losses: 0, draws: 0, streak: 0, wins9: 0, wins19: 0, distinctOpponents: 0 };
	fixture.request.mockReset().mockImplementation(async (endpoint: string, params: { key?: string; value?: unknown }) => {
		if (endpoint === 'hataigo/my-stats') { if (failHuman) throw new Error('offline'); return human; }
		if (endpoint === 'i/registry/get-all') return Object.fromEntries(entries);
		if (endpoint === 'i/registry/get') { if (!params.key || !entries.has(params.key)) throw Object.assign(new Error('Missing registry key'), { code: 'NO_SUCH_KEY' }); return entries.get(params.key); }
		if (endpoint === 'i/registry/set') { if (failSet) throw new Error('offline'); if (!params.key) throw new Error('key required'); entries.set(params.key, params.value); return; }
		throw new Error('unexpected endpoint');
	});
});

describe('per-account permanent cosmetic awards', () => {
	it('saves each award before notifying and retains it when records shrink', async () => {
		human = { ...human, wins: 11, wins9: 10, wins19: 1, distinctOpponents: 5 };
		const { useHataigoRewards } = await import('./rewards.js');
		const store = useHataigoRewards();
		await store.refresh();
		expect(store.pending.value).toEqual(['kaya', 'seiji', 'sakura', 'sumi']);
		for (const theme of store.pending.value) expect(entries.get(`rewardTheme:${theme}`)).toEqual({ version: 1, theme });
		human = { ...human, wins: 0, wins9: 0, wins19: 0, distinctOpponents: 0 };
		await store.refresh();
		expect(store.owned.value).toEqual(['fuji', 'kaya', 'seiji', 'sakura', 'sumi']);
	});

	it('permanently unlocks the first-win board from a saved AI victory by default', async () => {
		entries.set('aiRecord:ai-win', { version: 1, id: 'ai-win', size: 9, ownColor: 'black', winner: 'black', reason: 'score', endedAt: '2026-10-20T00:00:00.000Z' });
		const { useHataigoRewards } = await import('./rewards.js');
		const store = useHataigoRewards();
		await store.refresh();
		expect(store.owned.value).toEqual(['fuji', 'kaya']);
		expect(entries.get('rewardTheme:kaya')).toEqual({ version: 1, theme: 'kaya' });
	});

	it('leaves failed awards unowned and retries without replacing any ledger', async () => {
		human.wins = 1;
		entries.set('unrelated', { keep: true });
		failSet = true;
		const { useHataigoRewards } = await import('./rewards.js');
		const store = useHataigoRewards();
		expect(await store.refresh()).toBe(false);
		expect(store.owned.value).toEqual(['fuji']);
		expect(store.pending.value).toEqual([]);
		expect(store.error.value).not.toBeNull();
		failSet = false;
		await store.refresh();
		expect(store.owned.value).toContain('kaya');
		expect(entries.get('unrelated')).toEqual({ keep: true });
	});

	it('acknowledges queued awards one by one only after the acknowledgement is saved', async () => {
		human = { ...human, wins: 1, wins19: 1 };
		const { useHataigoRewards } = await import('./rewards.js');
		const store = useHataigoRewards();
		await store.refresh();
		failSet = true;
		expect(await store.acknowledge('kaya')).toBe(false);
		expect(store.pending.value).toEqual(['kaya', 'sumi']);
		failSet = false;
		expect(await store.acknowledge('kaya')).toBe(true);
		expect(store.pending.value).toEqual(['sumi']);
		await store.refresh();
		expect(store.pending.value).toEqual(['sumi']);
	});

	it('merges awards saved by another device and does not overwrite malformed markers', async () => {
		entries.set('rewardTheme:yoru', { version: 1, theme: 'yoru' });
		entries.set('rewardTheme:kaya', { version: 2, theme: 'kaya' });
		human.wins = 1;
		const { useHataigoRewards } = await import('./rewards.js');
		const store = useHataigoRewards();
		await store.refresh();
		expect(store.owned.value).toContain('yoru');
		expect(store.owned.value).not.toContain('kaya');
		expect(entries.get('rewardTheme:kaya')).toEqual({ version: 2, theme: 'kaya' });
	});

	it('keeps missing human data unavailable while independently loading valid AI stats', async () => {
		failHuman = true;
		const { useHataigoRewards } = await import('./rewards.js');
		const store = useHataigoRewards();
		await store.refresh();
		expect(store.human.value).toBeNull();
		expect(store.ai.value?.wins).toBe(0);
		expect(store.error.value).not.toBeNull();
	});

	it('hides previous-account private stats after the account changes', async () => {
		human.wins = 1;
		const { useHataigoRewards } = await import('./rewards.js');
		const { $i } = await import('@/i.js');
		const store = useHataigoRewards();
		await store.refresh();
		expect(store.human.value?.wins).toBe(1);
		if (!$i) throw new Error('Missing test account');
		$i.id = 'another';
		expect(store.human.value).toBeNull();
		expect(store.pending.value).toEqual([]);
		expect(await store.refresh()).toBe(false);
	});
});
