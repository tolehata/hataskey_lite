/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { deepEqual } from '@/utility/deep-equal.js';

type JsonValue = Parameters<typeof deepEqual>[0];
type JsonObject = { [key: string]: JsonValue };
type RecordValue = [scope: JsonObject, value: JsonValue, meta: JsonObject];

function isObject(value: JsonValue): value is JsonObject {
	return value != null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Map);
}

function hasIds(value: JsonValue): value is (JsonObject & { id: string })[] {
	return Array.isArray(value)
		&& value.every(item => isObject(item) && typeof item.id === 'string')
		&& new Set(value.map(item => (item as JsonObject).id)).size === value.length;
}

/** Preserve edits from another tab where this tab has left the value unchanged. */
function mergeValue(base: JsonValue, local: JsonValue, remote: JsonValue): JsonValue {
	if (deepEqual(local, base)) return remote;
	if (deepEqual(remote, base) || deepEqual(local, remote)) return local;
	if (isObject(base) && isObject(local) && isObject(remote)) {
		const result: JsonObject = {};
		for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
			const value = mergeValue(base[key], local[key], remote[key]);
			if (value !== undefined) result[key] = value;
		}
		return result;
	}
	if (hasIds(base) && hasIds(local) && hasIds(remote)) {
		const baseById = new Map(base.map(item => [item.id, item]));
		const localById = new Map(local.map(item => [item.id, item]));
		const remoteById = new Map(remote.map(item => [item.id, item]));
		// A local reorder wins; otherwise keep the other tab's order. Include its
		// added items as well, while mergeValue handles deletions and edited items.
		const order = deepEqual(base.map(item => item.id), local.map(item => item.id)) ? remote : local;
		const ids = new Set([...order.map(item => item.id), ...remoteById.keys(), ...localById.keys()]);
		return [...ids].map(id => mergeValue(baseById.get(id), localById.get(id), remoteById.get(id)))
			.filter(item => item !== undefined);
	}
	return local;
}

function sameScope(a: JsonObject, b: JsonObject): boolean {
	return (a.server ?? null) === (b.server ?? null)
		&& (a.account ?? null) === (b.account ?? null)
		&& (a.device ?? null) === (b.device ?? null);
}

// These records contain independently editable notification widgets/columns.
// Other preference values retain their existing replacement semantics.
const notificationLayoutKeys = new Set(['widgets', 'deck.profiles', 'simpleUi.deckProfilesV2']);

export function mergePreferenceRecords(
	key: string,
	base: RecordValue[],
	local: RecordValue[],
	remote: RecordValue[],
): RecordValue[] {
	const scopes = [...local.map(record => record[0])];
	for (const [scope] of remote) {
		if (!scopes.some(other => sameScope(scope, other))) scopes.push(scope);
	}
	const result: RecordValue[] = [];
	for (const scope of scopes) {
		const before = base.find(record => sameScope(record[0], scope));
		const current = local.find(record => sameScope(record[0], scope));
		const latest = remote.find(record => sameScope(record[0], scope));
		if (deepEqual(current, before)) {
			if (latest && current) {
				if (!deepEqual(current[1], latest[1])) current[1] = latest[1];
				if (!deepEqual(current[2], latest[2])) current[2] = latest[2];
				result.push(current);
			} else if (latest) {
				result.push(latest);
			}
		} else if (!current || !latest || !before) {
			if (current) result.push(current);
		} else {
			const value = notificationLayoutKeys.has(key)
				? mergeValue(before[1], current[1], latest[1])
				: deepEqual(current[1], before[1]) ? latest[1] : current[1];
			const meta = mergeValue(before[2], current[2], latest[2]) as JsonObject;
			// Keep record identity for callers waiting on a cloud operation.
			if (!deepEqual(current[1], value)) current[1] = value;
			if (!deepEqual(current[2], meta)) current[2] = meta;
			result.push(current);
		}
	}
	return result;
}
