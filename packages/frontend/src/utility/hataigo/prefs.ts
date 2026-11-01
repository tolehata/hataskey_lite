/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive, ref } from 'vue';
import type { Ref } from 'vue';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type HataigoPrefs = {
	theme: 'fuji' | 'kaya' | 'seiji' | 'sakura' | 'sumi' | 'yoru';
	stones: 'real' | 'flat' | 'avatar';
	labels: boolean;
	autoplayInterval: number;
	/** auto: two-step placement only on small touch boards. */
	placement: 'auto' | 'confirm' | 'direct';
	/** 「AIの読み」「形勢」カードの中身を出すか（見出しは常に出す） */
	showThought: boolean;
	showEstimate: boolean;
};

type HataigoAccount = { id: string; token: string };
type RegistryValue = Record<string, unknown>;
type HataigoPrefsState = {
	token: string;
	prefs: HataigoPrefs;
	loaded: Ref<boolean>;
	error: Ref<string | null>;
	generation: number;
	pendingSaves: number;
	loadPromise?: Promise<void>;
	saveQueue: Promise<void>;
};

const REG_SCOPE = ['client', 'hataigo'];
const REG_KEY = 'display';
const DEFAULT_PREFS: HataigoPrefs = {
	theme: 'fuji',
	stones: 'real',
	labels: true,
	autoplayInterval: 1000,
	placement: 'auto',
	showThought: true,
	showEstimate: true,
};

function isPlacement(value: unknown): value is HataigoPrefs['placement'] {
	return value === 'auto' || value === 'confirm' || value === 'direct';
}

const states = new Map<string, HataigoPrefsState>();

function currentAccount(): HataigoAccount {
	if (!$i) throw new Error('HataIgo preferences require a signed-in account');
	return { id: $i.id, token: $i.token };
}

function isCurrentAccount(account: HataigoAccount): boolean {
	return !!$i && $i.id === account.id && $i.token === account.token;
}

function stateFor(account: HataigoAccount): HataigoPrefsState {
	const existing = states.get(account.id);
	if (existing?.token === account.token) return existing;
	const state: HataigoPrefsState = {
		token: account.token,
		prefs: reactive({ ...DEFAULT_PREFS }),
		loaded: ref(false),
		error: ref(null),
		generation: 0,
		pendingSaves: 0,
		saveQueue: Promise.resolve(),
	};
	states.set(account.id, state);
	return state;
}

function isRecord(value: unknown): value is RegistryValue {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTheme(value: unknown): value is HataigoPrefs['theme'] {
	return value === 'fuji' || value === 'kaya' || value === 'seiji' || value === 'sakura' || value === 'sumi' || value === 'yoru';
}

function isStoneStyle(value: unknown): value is HataigoPrefs['stones'] {
	return value === 'real' || value === 'flat' || value === 'avatar';
}

function normalizePrefs(value: unknown): HataigoPrefs {
	const record = isRecord(value) ? value : {};
	return {
		theme: isTheme(record.theme) ? record.theme : DEFAULT_PREFS.theme,
		stones: isStoneStyle(record.stones) ? record.stones : DEFAULT_PREFS.stones,
		labels: typeof record.labels === 'boolean' ? record.labels : DEFAULT_PREFS.labels,
		autoplayInterval: typeof record.autoplayInterval === 'number' && Number.isFinite(record.autoplayInterval) && record.autoplayInterval >= 500 && record.autoplayInterval <= 5000
			? record.autoplayInterval
			: DEFAULT_PREFS.autoplayInterval,
		placement: isPlacement(record.placement) ? record.placement : DEFAULT_PREFS.placement,
		showThought: typeof record.showThought === 'boolean' ? record.showThought : DEFAULT_PREFS.showThought,
		showEstimate: typeof record.showEstimate === 'boolean' ? record.showEstimate : DEFAULT_PREFS.showEstimate,
	};
}

function normalizePatch(patch: Partial<HataigoPrefs>): Partial<HataigoPrefs> {
	const result: Partial<HataigoPrefs> = {};
	if ('theme' in patch) result.theme = isTheme(patch.theme) ? patch.theme : DEFAULT_PREFS.theme;
	if ('stones' in patch) result.stones = isStoneStyle(patch.stones) ? patch.stones : DEFAULT_PREFS.stones;
	if ('labels' in patch) result.labels = typeof patch.labels === 'boolean' ? patch.labels : DEFAULT_PREFS.labels;
	if ('autoplayInterval' in patch) {
		const value: unknown = patch.autoplayInterval;
		result.autoplayInterval = typeof value === 'number' && Number.isFinite(value) && value >= 500 && value <= 5000
			? value
			: DEFAULT_PREFS.autoplayInterval;
	}
	if ('placement' in patch) result.placement = isPlacement(patch.placement) ? patch.placement : DEFAULT_PREFS.placement;
	if ('showThought' in patch) result.showThought = typeof patch.showThought === 'boolean' ? patch.showThought : DEFAULT_PREFS.showThought;
	if ('showEstimate' in patch) result.showEstimate = typeof patch.showEstimate === 'boolean' ? patch.showEstimate : DEFAULT_PREFS.showEstimate;
	return result;
}

function applyPrefs(target: HataigoPrefs, value: unknown): void {
	Object.assign(target, normalizePrefs(value));
}

function isMissingKey(error: unknown): boolean {
	return !!error && typeof error === 'object' && 'code' in error && error.code === 'NO_SUCH_KEY';
}

async function load(account: HataigoAccount, state: HataigoPrefsState): Promise<void> {
	const generation = state.generation;
	try {
		let value: unknown;
		try {
			value = await misskeyApi('i/registry/get', { scope: REG_SCOPE, key: REG_KEY }, account.token) as unknown;
		} catch (error) {
			if (!isMissingKey(error)) throw error;
			value = {};
		}
		if (!isRecord(value)) throw new TypeError('Unsupported HataIgo display settings value');
		if (isCurrentAccount(account) && generation === state.generation && state.pendingSaves === 0) {
			applyPrefs(state.prefs, value);
			state.error.value = null;
			state.loaded.value = true;
		}
	} catch (error) {
		if (isCurrentAccount(account) && generation === state.generation && state.pendingSaves === 0) {
			state.error.value = error instanceof Error ? error.message : String(error);
			state.loaded.value = true;
		}
	}
}

async function persist(account: HataigoAccount, state: HataigoPrefsState, patch: Partial<HataigoPrefs>, generation: number): Promise<boolean> {
	try {
		if (!isCurrentAccount(account)) throw new Error('HataIgo account changed before saving preferences');
		let current: unknown;
		try {
			current = await misskeyApi('i/registry/get', { scope: REG_SCOPE, key: REG_KEY }, account.token) as unknown;
		} catch (error) {
			if (!isMissingKey(error)) throw error;
			current = {};
		}
		if (!isRecord(current)) throw new TypeError('Unsupported HataIgo display settings value');
		if (!isCurrentAccount(account)) throw new Error('HataIgo account changed before saving preferences');
		const value = { ...current, ...patch };
		await misskeyApi('i/registry/set', { scope: REG_SCOPE, key: REG_KEY, value }, account.token);
		if (isCurrentAccount(account)) {
			applyPrefs(state.prefs, value);
			state.loaded.value = true;
			if (generation === state.generation) state.error.value = null;
		}
		return true;
	} catch (error) {
		if (isCurrentAccount(account) && generation === state.generation) {
			state.error.value = error instanceof Error ? error.message : String(error);
			state.loaded.value = true;
		}
		return false;
	}
}

export function useHataigoPrefs(): {
	prefs: HataigoPrefs;
	loaded: Ref<boolean>;
	error: Ref<string | null>;
	save: (patch: Partial<HataigoPrefs>) => Promise<boolean>;
} {
	const account = currentAccount();
	const state = stateFor(account);
	if (!state.loaded.value && !state.loadPromise) {
		state.loadPromise = load(account, state).finally(() => { state.loadPromise = undefined; });
	}

	return {
		prefs: state.prefs,
		loaded: state.loaded,
		error: state.error,
		save(patch) {
			if (!isCurrentAccount(account)) {
				state.error.value = 'HataIgo account changed before saving preferences';
				return Promise.resolve(false);
			}
			const normalizedPatch = normalizePatch(patch);
			const generation = ++state.generation;
			state.pendingSaves++;
			const operation = state.saveQueue.then(() => persist(account, state, normalizedPatch, generation));
			state.saveQueue = operation.then(() => undefined, () => undefined).finally(() => {
				state.pendingSaves--;
			});
			return operation;
		},
	};
}
