/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type {
	HataskPlannerCollectionKey,
	HataskPlannerRevision,
	HataskPlannerShadowSnapshot,
	HataskPlannerStoragePort,
} from '@/utility/hatask-planner-storage.js';
import {
	HATASK_PLANNER_COLLECTION_KEYS,
	HATASK_PLANNER_SHADOW_KEY,
} from '@/utility/hatask-planner-storage.js';

type ApiCaller = (endpoint: string, params: Record<string, unknown>) => Promise<unknown>;

type PlannerCollectionSnapshot = {
	exists: boolean;
	updatedAt: string | null;
	revision: string | null;
	value: unknown;
	hash?: string;
	rowCount?: number;
	backupCount?: number;
	latestBackupAt?: string | null;
};

export type HataskPlannerApiSnapshot = {
	version: number;
	collections: Record<HataskPlannerCollectionKey, PlannerCollectionSnapshot> & {
		templates?: PlannerCollectionSnapshot;
	};
};

export type HataskPlannerTemplateSnapshot = {
	exists: boolean;
	revision: string | null;
	value: unknown;
};

function isPlannerCollection(key: string): key is HataskPlannerCollectionKey {
	return (HATASK_PLANNER_COLLECTION_KEYS as readonly string[]).includes(key);
}

function missingKeyError(key: string): Error & { code: string } {
	return Object.assign(new Error(`No such Hatask planner key: ${key}`), { code: 'NO_SUCH_KEY' });
}

function conflictError(key: string): Error & { code: string } {
	return Object.assign(new Error(`Hatask planner revision conflict: ${key}`), { code: 'HATASK_PLANNER_CONFLICT' });
}

function asPlannerSnapshot(value: unknown): HataskPlannerApiSnapshot {
	if (value == null || typeof value !== 'object' || !('collections' in value)) throw new TypeError('Invalid Hatask planner snapshot');
	return value as HataskPlannerApiSnapshot;
}

/**
 * Adapter for the atomic planner endpoints. The migration utility stays API
 * agnostic; this layer coalesces its three parallel reads into one snapshot.
 */
export function createHataskPlannerApiStoragePort(api: ApiCaller, onFlowerRewards?: (rewards: Record<string, { granted: boolean; why?: string; left?: number }>) => void): HataskPlannerStoragePort & {
	refresh(): Promise<HataskPlannerApiSnapshot>;
	readTemplates(): Promise<HataskPlannerTemplateSnapshot>;
	writeTemplates(value: unknown, expectedRevision: HataskPlannerRevision): Promise<{ revision: string | null }>;
} {
	let snapshotPromise: Promise<HataskPlannerApiSnapshot> | null = null;
	const loadSnapshot = (): Promise<HataskPlannerApiSnapshot> => {
		snapshotPromise ??= api('hatask/planner/get', {}).then(asPlannerSnapshot);
		return snapshotPromise;
	};
	const invalidate = (): void => { snapshotPromise = null; };

	return {
		async read({ scope, key }) {
			if (scope.join('/') !== 'client/hatask') throw new TypeError('Unexpected Hatask planner scope');
			if (isPlannerCollection(key)) {
				const collection = (await loadSnapshot()).collections[key];
				if (!collection.exists) throw missingKeyError(key);
				return { value: collection.value, revision: collection.revision };
			}
			const detail = await api('i/registry/get-detail', { key, scope: [...scope] }) as { value: unknown; updatedAt: string };
			return { value: detail.value, revision: detail.updatedAt };
		},
		async write({ scope, key, value, expectedRevision }) {
			if (scope.join('/') !== 'client/hatask') throw new TypeError('Unexpected Hatask planner scope');
			if (isPlannerCollection(key)) {
				const result = await api('hatask/planner/commit', {
					collection: key,
					expectedRevision: expectedRevision ?? null,
					value,
				}) as { revision?: string; flowerRewards?: Record<string, { granted: boolean; why?: string; left?: number }> };
				invalidate();
				if (result.flowerRewards) onFlowerRewards?.(result.flowerRewards);
				return { revision: result.revision ?? null };
			}
			if (key === HATASK_PLANNER_SHADOW_KEY) {
				if (value == null || typeof value !== 'object' || !('targetIntegrity' in value)) {
					throw new TypeError('Invalid Hatask planner migration shadow request');
				}
				const shadow = value as HataskPlannerShadowSnapshot;
				const snapshot = await loadSnapshot();
				const result = await api('hatask/planner/create-shadow', {
					expectedRevisions: Object.fromEntries(HATASK_PLANNER_COLLECTION_KEYS.map(collection => [
						collection,
						snapshot.collections[collection].revision,
					])),
					targetIntegrity: shadow.targetIntegrity,
				}) as { revision?: string };
				return { revision: result.revision ?? null };
			}

			// Registry has no generic CAS. Refuse a known stale revision and verify
			// missing-before-create for any future non-planner key routed here.
			if (expectedRevision !== undefined) {
				let actual: HataskPlannerRevision = null;
				try {
					const detail = await api('i/registry/get-detail', { key, scope: [...scope] }) as { updatedAt: string };
					actual = detail.updatedAt;
				} catch (error) {
					if ((error as { code?: string } | null)?.code !== 'NO_SUCH_KEY') throw error;
				}
				if (actual !== expectedRevision) throw conflictError(key);
			}
			await api('i/registry/set', { key, value, scope: [...scope] });
			const detail = await api('i/registry/get-detail', { key, scope: [...scope] }) as { updatedAt: string };
			return { revision: detail.updatedAt };
		},
		async writeBatch({ scope, writes }) {
			if (scope.join('/') !== 'client/hatask') throw new TypeError('Unexpected Hatask planner scope');
			const result = await api('hatask/planner/commit-batch', {
				changes: writes.map(write => ({
					collection: write.key,
					expectedRevision: write.expectedRevision ?? null,
					value: write.value,
				})),
			}) as { collections?: { todos?: { flowerRewards?: Record<string, { granted: boolean; why?: string; left?: number }> } } };
			invalidate();
			if (result.collections?.todos?.flowerRewards) onFlowerRewards?.(result.collections.todos.flowerRewards);
		},
		isMissingError(error) {
			return (error as { code?: string } | null)?.code === 'NO_SUCH_KEY';
		},
		async refresh() {
			invalidate();
			return await loadSnapshot();
		},
		async readTemplates() {
			const collection = (await loadSnapshot()).collections.templates;
			if (collection == null || !collection.exists) return { exists: false, revision: null, value: [] };
			return { exists: true, revision: collection.revision, value: collection.value };
		},
		async writeTemplates(value, expectedRevision) {
			const result = await api('hatask/planner/commit', {
				collection: 'templates',
				expectedRevision,
				value,
			}) as { revision?: string };
			invalidate();
			return { revision: result.revision ?? null };
		},
	};
}
