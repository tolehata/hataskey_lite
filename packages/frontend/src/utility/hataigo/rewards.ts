/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, ref } from 'vue';
import { normalizeAiRecord } from './ai-records.js';
import { aiStats, eligibleThemes, parseHumanStats, rewardText, THEMES } from './rewards-rules.js';
import type { Ref } from 'vue';
import type { AiRecord } from './ai-records.js';
import type { AiStats, HumanStats, Theme } from './rewards-rules.js';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type { Theme, HumanStats, AiStats } from './rewards-rules.js';
type Account = { id: string; token: string };
type State = { token: string; owned: Ref<Theme[]>; pending: Ref<Theme[]>; human: Ref<HumanStats | null>; ai: Ref<AiStats | null>; loading: Ref<boolean>; error: Ref<string | null>; refreshError: string | null; refreshAgain: boolean; queue: Promise<void>; refresh?: Promise<boolean> };
const states = new Map<string, State>();
const scope = ['client', 'hataigo'];
const ownedPrefix = 'rewardTheme:';
const seenPrefix = 'rewardSeen:';
const request = misskeyApi as unknown as (endpoint: string, params: Record<string, unknown>, token: string) => Promise<unknown>;

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function current(account: Account): boolean { return !!$i && $i.id === account.id && $i.token === account.token; }

function shouldRefreshAgain(account: Account, state: State): boolean { return state.refreshAgain && current(account); }

function assertCurrent(account: Account): void { if (!current(account)) throw new Error('Account changed'); }

function marker(value: unknown, theme: Theme): boolean { return object(value) && value.version === 1 && value.theme === theme; }

async function saveMarker(account: Account, prefix: string, theme: Theme): Promise<void> {
	assertCurrent(account);
	let existing: unknown;
	try { existing = await request('i/registry/get', { scope, key: prefix + theme }, account.token); } catch (cause) { if (!object(cause) || cause.code !== 'NO_SUCH_KEY') throw cause; }
	assertCurrent(account);
	if (existing !== undefined) { if (!marker(existing, theme)) throw new Error('Unsupported reward record'); return; }
	await request('i/registry/set', { scope, key: prefix + theme, value: { version: 1, theme } }, account.token);
	assertCurrent(account);
}

async function refresh(account: Account, state: State): Promise<boolean> {
	if (!current(account)) return false;
	state.loading.value = true;
	state.error.value = null;
	state.refreshError = null;
	const results = await Promise.allSettled([request('hataigo/my-stats', {}, account.token), request('i/registry/get-all', { scope }, account.token)]);
	if (!current(account)) { state.loading.value = false; return false; }
	let failed = false;
	try { const human = results[0]; state.human.value = human.status === 'fulfilled' ? parseHumanStats(human.value) : null; if (state.human.value === null) failed = true; } catch { state.human.value = null; failed = true; }
	const registry = results[1];
	if (registry.status !== 'fulfilled' || !object(registry.value)) { state.ai.value = null; state.refreshError = rewardText.loadError; state.error.value = state.refreshError; state.loading.value = false; return false; }
	const entries = registry.value;
	const owned = new Set<Theme>(state.owned.value);
	const seen = new Set<Theme>();
	const aiRecords: AiRecord[] = [];
	let aiInvalid = false;
	let rewardInvalid = false;
	for (const [key, value] of Object.entries(entries)) {
		if (key.startsWith('aiRecord:')) { const record = object(value) && value.version === 1 ? normalizeAiRecord(value) : null; if (record === null || key !== `aiRecord:${record.id}`) aiInvalid = true; else aiRecords.push(record); }
		if (key.startsWith(ownedPrefix) || key.startsWith(seenPrefix)) {
			const prefix = key.startsWith(ownedPrefix) ? ownedPrefix : seenPrefix;
			const theme = THEMES.find(id => key === prefix + id);
			if (theme === undefined || !marker(value, theme)) rewardInvalid = true;
			else if (prefix === ownedPrefix) owned.add(theme);
			else seen.add(theme);
		}
	}
	state.ai.value = aiInvalid ? null : aiStats(aiRecords);
	failed ||= aiInvalid || rewardInvalid;
	state.owned.value = THEMES.filter(theme => owned.has(theme));
	let saveFailed = false;
	if (!rewardInvalid) {
		for (const theme of eligibleThemes(state.human.value, state.ai.value)) {
			if (owned.has(theme)) continue;
			try { await saveMarker(account, ownedPrefix, theme); owned.add(theme); } catch { if (!current(account)) { state.loading.value = false; return false; } saveFailed = true; }
		}
	}
	if (!current(account)) { state.loading.value = false; return false; }
	state.owned.value = THEMES.filter(theme => owned.has(theme));
	state.pending.value = state.owned.value.filter(theme => theme !== 'fuji' && !seen.has(theme));
	state.refreshError = saveFailed ? rewardText.saveError : failed ? rewardText.loadError : null;
	state.error.value = state.refreshError;
	state.loading.value = false;
	return !failed && !saveFailed;
}

/** Per-theme immutable markers preserve unlocks when records shrink and avoid
 * replacing a shared ledger across devices. No rewards are exposed before saving.
 */
export function useHataigoRewards() {
	if (!$i) throw new Error('HataIgo rewards require sign-in');
	const account: Account = { id: $i.id, token: $i.token };
	let state = states.get(account.id);
	if (state?.token !== account.token) { state = { token: account.token, owned: ref<Theme[]>(['fuji']), pending: ref<Theme[]>([]), human: ref(null), ai: ref(null), loading: ref(false), error: ref(null), refreshError: null, refreshAgain: false, queue: Promise.resolve() }; states.set(account.id, state); }
	const selected = state;
	const reload = (): Promise<boolean> => {
		if (selected.refresh !== undefined) { selected.refreshAgain = true; return selected.refresh; }
		const work = selected.queue.then(async () => {
			let result: boolean;
			do { selected.refreshAgain = false; result = await refresh(account, selected); } while (shouldRefreshAgain(account, selected));
			return result;
		});
		selected.refresh = work.finally(() => { selected.refresh = undefined; });
		selected.queue = selected.refresh.then(() => undefined, () => undefined);
		return selected.refresh;
	};
	const acknowledge = (theme: Theme): Promise<boolean> => {
		const work = selected.queue.then(async () => {
			if (!current(account) || !selected.owned.value.includes(theme)) return false;
			try { await saveMarker(account, seenPrefix, theme); selected.pending.value = selected.pending.value.filter(id => id !== theme); selected.error.value = selected.refreshError; return true; } catch { if (current(account)) selected.error.value = rewardText.seenError; return false; }
		});
		selected.queue = work.then(() => undefined, () => undefined);
		return work;
	};
	return {
		owned: computed(() => current(account) ? selected.owned.value : ['fuji'] as Theme[]), pending: computed(() => current(account) ? selected.pending.value : []),
		human: computed(() => current(account) ? selected.human.value : null), ai: computed(() => current(account) ? selected.ai.value : null),
		loading: computed(() => current(account) && selected.loading.value), error: computed(() => current(account) ? selected.error.value : rewardText.accountChanged),
		refresh: reload, acknowledge,
	};
}
