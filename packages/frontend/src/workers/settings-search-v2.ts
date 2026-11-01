/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SettingsCatalogDescriptorV2, SettingsCatalogV2, SettingsSearchResponseV2 } from '@/utility/settings-search-v2.js';
import { initIntlString } from '@/utility/intl-string.js';
import { searchSettingsV2 } from '@/utility/settings-search-v2.js';

type SerializedCatalog = {
	descriptors: SettingsCatalogDescriptorV2[];
	fallbackRoutes: string[];
	canonicalStableIdByLegacyStableId: Array<[string, string]>;
};

type WorkerRequest =
	| { type: 'initialize'; catalogRevision: number; catalog: SerializedCatalog }
	| { type: 'search'; catalogRevision: number; queryRevision: number; query: string };

type WorkerResponse =
	| { type: 'initialized'; catalogRevision: number }
	| { type: 'result'; catalogRevision: number; queryRevision: number; response: SettingsSearchResponseV2 }
	| { type: 'error'; catalogRevision: number; queryRevision?: number };

let catalog: SettingsCatalogV2 | null = null;
let currentCatalogRevision = -1;

function rebuildCatalog(serialized: SerializedCatalog): SettingsCatalogV2 {
	// Structured cloning removes Maps, so rebuild all runtime lookup structures in
	// the worker. Nested arrays are copied to keep the worker-owned catalog isolated.
	const descriptors = serialized.descriptors.map(descriptor => ({
		...descriptor,
		aliases: [...descriptor.aliases],
		legacyLabels: [...descriptor.legacyLabels],
		preferenceKeys: [...descriptor.preferenceKeys],
		...(descriptor.legacyMarkerAncestorIds ? { legacyMarkerAncestorIds: [...descriptor.legacyMarkerAncestorIds] } : {}),
		relatedIds: [...descriptor.relatedIds],
		related: descriptor.related.map(related => ({ ...related })),
	}));
	return {
		descriptors,
		items: descriptors,
		byStableId: new Map(descriptors.map(descriptor => [descriptor.stableId, descriptor])),
		byLegacyId: new Map(descriptors.flatMap(descriptor => descriptor.legacyId == null ? [] : [[descriptor.legacyId, descriptor] as const])),
		canonicalStableIdByLegacyStableId: new Map(serialized.canonicalStableIdByLegacyStableId),
		fallbackRoutes: [...serialized.fallbackRoutes],
	};
}

function respond(message: WorkerResponse): void {
	postMessage(message);
}

onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const message = event.data;
	if (message.type === 'initialize') {
		currentCatalogRevision = message.catalogRevision;
		try {
			await initIntlString(true);
			if (message.catalogRevision !== currentCatalogRevision) return;
			catalog = rebuildCatalog(message.catalog);
			respond({ type: 'initialized', catalogRevision: message.catalogRevision });
		} catch {
			if (message.catalogRevision === currentCatalogRevision) respond({ type: 'error', catalogRevision: message.catalogRevision });
		}
		return;
	}

	if (catalog == null || message.catalogRevision !== currentCatalogRevision) return;
	try {
		respond({
			type: 'result',
			catalogRevision: message.catalogRevision,
			queryRevision: message.queryRevision,
			response: searchSettingsV2(catalog, message.query),
		});
	} catch {
		respond({ type: 'error', catalogRevision: message.catalogRevision, queryRevision: message.queryRevision });
	}
};
