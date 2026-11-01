/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import { aiText } from './i18n.js';
import type { Ref } from 'vue';
import type { BoardSize, Color } from './rules/board.js';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type AiRecord = { id: string; size: BoardSize; ownColor: Color; winner: Color | 'draw'; reason: 'score' | 'resign'; endedAt: string };
type Account = { id: string; token: string };
type StoreState = { token: string; records: Ref<AiRecord[]>; loaded: Ref<boolean>; error: Ref<string | null>; loadError: string | null; saveError: string | null; queue: Promise<void>; loadPromise?: Promise<boolean> };
const states = new Map<string, StoreState>();
const scope = ['client', 'hataigo'];
const prefix = 'aiRecord:';

function recordObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function current(account: Account): boolean {
	return !!$i && $i.id === account.id && $i.token === account.token;
}

function missing(error: unknown): boolean {
	return recordObject(error) && error.code === 'NO_SUCH_KEY';
}

export function normalizeAiRecord(value: unknown): AiRecord | null {
	if (!recordObject(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id)) return null;
	if (value.size !== 9 && value.size !== 13 && value.size !== 19) return null;
	if (value.ownColor !== 'black' && value.ownColor !== 'white') return null;
	if (value.winner !== 'black' && value.winner !== 'white' && value.winner !== 'draw') return null;
	if (value.reason !== 'score' && value.reason !== 'resign') return null;
	if (typeof value.endedAt !== 'string' || value.endedAt.length > 40 || !Number.isFinite(Date.parse(value.endedAt))) return null;
	if (value.reason === 'resign' && value.winner === 'draw') return null;
	return { id: value.id, size: value.size, ownColor: value.ownColor, winner: value.winner, reason: value.reason, endedAt: value.endedAt };
}

function storedRecord(value: unknown): AiRecord | null {
	return recordObject(value) && value.version === 1 ? normalizeAiRecord(value) : null;
}

function merge(state: StoreState, values: readonly AiRecord[]): void {
	const all = new Map(state.records.value.map(item => [item.id, item]));
	for (const item of values) all.set(item.id, item);
	state.records.value = [...all.values()].sort((a, b) => a.endedAt.localeCompare(b.endedAt) || a.id.localeCompare(b.id));
}

async function load(account: Account, state: StoreState): Promise<boolean> {
	try {
		if (!current(account)) throw new Error('HataIgo account changed.');
		const value: unknown = await misskeyApi('i/registry/get-all', { scope }, account.token);
		if (!recordObject(value)) throw new Error('Unsupported HataIgo game records.');
		const records: AiRecord[] = [];
		let invalid = 0;
		for (const [key, entry] of Object.entries(value)) {
			if (!key.startsWith(prefix)) continue;
			const record = storedRecord(entry);
			if (record === null || key !== `${prefix}${record.id}`) invalid++;
			else records.push(record);
		}
		if (!current(account)) return false;
		merge(state, records);
		state.loaded.value = true;
		state.loadError = invalid > 0 ? aiText.partialRecordsError : null;
		state.error.value = state.saveError ?? state.loadError;
		return invalid === 0;
	} catch {
		if (current(account)) { state.loaded.value = true; state.loadError = aiText.loadRecordsError; state.error.value = state.saveError ?? state.loadError; }
		return false;
	}
}

async function persist(account: Account, state: StoreState, input: AiRecord): Promise<boolean> {
	try {
		if (!current(account)) throw new Error('HataIgo account changed.');
		const record = normalizeAiRecord(input);
		if (record === null) throw new Error('Invalid AI record.');
		const key = `${prefix}${record.id}`;
		let existing: unknown;
		try { existing = await misskeyApi('i/registry/get', { scope, key }, account.token); } catch (error) { if (!missing(error)) throw error; }
		if (!current(account)) throw new Error('HataIgo account changed.');
		if (existing !== undefined) {
			const normalized = storedRecord(existing);
			if (normalized === null || JSON.stringify(normalized) !== JSON.stringify(record)) throw new Error('Conflicting AI record.');
		} else {
			await misskeyApi('i/registry/set', { scope, key, value: { version: 1, ...record } }, account.token);
		}
		if (!current(account)) return false;
		merge(state, [record]);
		state.saveError = null;
		state.error.value = state.loadError;
		state.loaded.value = true;
		return true;
	} catch {
		if (current(account)) { state.saveError = aiText.saveRecordsError; state.error.value = state.saveError; }
		return false;
	}
}

/** One immutable metadata key per private AI game avoids cross-device
 * read/modify/write loss. No board, comment, opponent identity, or public
 * sharing state is stored. History is never truncated to manufacture counts.
 */
export function useAiRecords(): { records: Ref<AiRecord[]>; loaded: Ref<boolean>; error: Ref<string | null>; load: () => Promise<boolean>; save: (record: AiRecord) => Promise<boolean> } {
	if (!$i) throw new Error('AI game records require a signed-in account.');
	const account = { id: $i.id, token: $i.token };
	let state = states.get(account.id);
	if (state?.token !== account.token) {
		state = { token: account.token, records: ref<AiRecord[]>([]), loaded: ref(false), error: ref(null), loadError: null, saveError: null, queue: Promise.resolve() };
		states.set(account.id, state);
	}
	const selected = state;
	const refresh = (): Promise<boolean> => {
		if (selected.loadPromise !== undefined) return selected.loadPromise;
		selected.loadPromise = load(account, selected).finally(() => { selected.loadPromise = undefined; });
		return selected.loadPromise;
	};
	if (!selected.loaded.value) void refresh();
	return {
		records: selected.records, loaded: selected.loaded, error: selected.error,
		load: refresh,
		save(record) {
			const snapshot = normalizeAiRecord(record);
			if (snapshot === null) { selected.saveError = aiText.invalidRecord; selected.error.value = selected.saveError; return Promise.resolve(false); }
			const result = selected.queue.then(() => persist(account, selected, snapshot));
			selected.queue = result.then(() => undefined, () => undefined);
			return result;
		},
	};
}
