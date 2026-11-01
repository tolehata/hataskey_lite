/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskGrowingFlower } from '@/utility/hatask-flower-growth.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type HataskFlowerSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type HataskDropCounts = { todo: number; hatady: number; login: number };
export type HataskFlowerSpecies = { id: string; season: HataskFlowerSeason; emoji: string; name: string; hanakotoba: string; rare: boolean };
export type HataskFlowerPerson = { id: string; name: string | null; username: string };
export type HataskZukanEntry = HataskFlowerSpecies & {
	speciesId: string; nickname: string; harvestedAt: string; memory: string[];
	rank: number | null; first: boolean; firstUser: HataskFlowerPerson | null;
};
export type HataskFlowerZukan = {
	catalog: HataskFlowerSpecies[]; entries: HataskZukanEntry[];
	archivedEntries?: Omit<HataskZukanEntry, 'rank' | 'first' | 'firstUser'>[];
	unlockedSeasons: HataskFlowerSeason[]; seedAvailable: HataskFlowerSeason[];
	seedClaimed: HataskFlowerSeason[]; rareSeeds: HataskFlowerSeason[];
};
export type HataskFlowerFestival = {
	id: string; season: HataskFlowerSeason; goal: number; total: number;
	startsAt: string; endsAt: string; bloomedAt: string | null;
	participated: boolean; recentParticipants: HataskFlowerPerson[]; seedReceived: boolean;
};
export type HataskDropReward = { granted: boolean; why?: string; left?: number };
export type HataskFlowerState = {
	drops: number; store: number; today: HataskDropCounts; caps: HataskDropCounts; resetAt: string;
	rules: { todoMinAgeMinutes: number; todoMinLength: number; hatadyGapSeconds: number; pourMinutes: number };
	flower: HataskGrowingFlower & { id: string; season: HataskFlowerSeason; memory: string[]; hanakotoba?: string; rank?: number | null };
	zukan: HataskFlowerZukan; festival: HataskFlowerFestival;
	reward?: HataskDropReward; todoRewards?: Record<string, HataskDropReward>;
};

export const HATASK_FLOWER_STATE_EVENT = 'hatask-flower:state';
let revision = 0;
let refresh: Promise<HataskFlowerState> | null = null;
let lastState: HataskFlowerState | null = null;
let pendingPour: { target: 'self' | 'festival'; requestId: string } | null = null;
let mutation: Promise<HataskFlowerState> | null = null;
let externalRefresh: Promise<HataskFlowerState> | null = null;
let externalRevision = 0;

// Keep the wire boundary local until generated API types are rebuilt.
const api = misskeyApi as unknown as (endpoint: string, params: Record<string, unknown>) => Promise<HataskFlowerState>;
const timezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

function publish(state: HataskFlowerState): HataskFlowerState {
	lastState = state;
	window.dispatchEvent(new CustomEvent(HATASK_FLOWER_STATE_EVENT, { detail: state }));
	return state;
}

export function getHataskFlowerState(): Promise<HataskFlowerState> {
	if (mutation) return mutation;
	if (refresh) return refresh;
	const version = revision;
	refresh = api('hatask/flowers/state', { timezone: timezone() }).then(state => {
		// A slower read must never roll back a successful pour or harvest.
		return version === revision ? publish(state) : lastState ?? state;
	}).finally(() => { refresh = null; });
	return refresh;
}

/** Refresh after a ToDo or Hatady write that changed the wallet outside this module. */
export function refreshHataskFlowerStateAfterUpdate(): Promise<HataskFlowerState> {
	externalRevision++;
	revision++;
	if (externalRefresh) return externalRefresh;
	externalRefresh = (async () => {
		for (;;) {
			// An earlier read or watering response cannot establish the post-write state.
			// Its failure must not prevent a new authoritative read.
			await Promise.allSettled([refresh, mutation]);
			const version = externalRevision;
			const stateVersion = revision;
			try {
				const state = await getHataskFlowerState();
				if (version === externalRevision && stateVersion === revision) return state;
			} catch (error) {
				if (version === externalRevision && stateVersion === revision) throw error;
			}
			// Another wallet update landed during this read. All callers share
			// one trailing read so their returned state includes that write too.
		}
	})().finally(() => { externalRefresh = null; });
	return externalRefresh;
}

function change(endpoint: string, params: Record<string, unknown>): Promise<HataskFlowerState> {
	if (mutation) return Promise.reject(new Error('An update is already in progress.'));
	revision++;
	mutation = api(endpoint, { ...params, timezone: timezone() }).then(publish).finally(() => { mutation = null; });
	return mutation;
}

export function pourHataskFlower(target: 'self' | 'festival', requestId?: string): Promise<HataskFlowerState> {
	if (mutation) return Promise.reject(new Error('An update is already in progress.'));
	// Retain the id after an uncertain network result; a retry cannot spend twice.
	if (!pendingPour) pendingPour = { target, requestId: requestId ?? crypto.randomUUID() };
	if (pendingPour.target !== target) return Promise.reject(new Error('Retry the previous watering action first.'));
	const request = pendingPour;
	return change('hatask/flowers/drops/pour', request).then(state => {
		pendingPour = null;
		return state;
	}).catch(error => {
		if (error && typeof error === 'object' && 'code' in error) pendingPour = null;
		throw error;
	});
}

export function harvestHataskFlower(flowerId: string, nickname: string): Promise<HataskFlowerState & { entry?: HataskZukanEntry }> {
	return change('hatask/flowers/harvest', { flowerId, nickname });
}

export function claimHataskFlowerSeed(season: HataskFlowerSeason): Promise<HataskFlowerState> {
	return change('hatask/flowers/zukan/claim-seed', { season });
}

export function renameHataskFlower(flowerId: string, nickname: string): Promise<HataskFlowerState> {
	return change('hatask/flowers/rename', { flowerId, nickname });
}

export function hataskDropRewardMessage(reward: HataskDropReward, rules?: HataskFlowerState['rules']): string {
	if (reward.granted) return 'しずくが1つたまりました';
	switch (reward.why) {
		case 'young': return `つくってから${rules?.todoMinAgeMinutes ?? 30}分後から対象${reward.left ? ` · あと${reward.left}分` : ''}`;
		case 'short': return '短すぎるToDoは対象外';
		case 'dup': return '同じ内容はきょう1回まで';
		case 'rewarded': return 'このToDoは受けとり済み';
		case 'cap': return 'きょう届く分は受けとり済み · 00:00にリセット';
		case 'gap': return `続けての記録は${Math.ceil((rules?.hatadyGapSeconds ?? 60) / 60)}分あけると対象`;
		case 'store':
		case 'full': return 'じょうろがいっぱいです';
		default: return 'このToDoはしずくの対象外です';
	}
}
