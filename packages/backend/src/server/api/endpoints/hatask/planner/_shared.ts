import { createHash } from 'node:crypto';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import type { EntityManager } from 'typeorm';

export const HATASK_PLANNER_SCOPE = ['client', 'hatask'] as const;
/** v2 migration integrity is intentionally limited to the three legacy collections. */
export const HATASK_PLANNER_CORE_COLLECTIONS = ['todos', 'folders', 'events'] as const;
export type HataskPlannerCoreCollection = typeof HATASK_PLANNER_CORE_COLLECTIONS[number];
/** New independent collections must not cause the verified legacy collections to be rewritten. */
export const HATASK_PLANNER_COLLECTIONS = [...HATASK_PLANNER_CORE_COLLECTIONS, 'templates'] as const;
export type HataskPlannerCollection = typeof HATASK_PLANNER_COLLECTIONS[number];

export const HATASK_PLANNER_SHADOW_KEY = 'plannerMigrationShadowV2';
export const HATASK_PLANNER_SHADOW_FORMAT = 'hatask-planner-shadow';
export const HATASK_PLANNER_SHADOW_VERSION = 1;
export const HATASK_PLANNER_TARGET_SCHEMA_VERSION = 2;
export const HATASK_PLANNER_VALUE_MAX_BYTES = 8 * 1024 * 1024;

export const HATASK_PLANNER_BACKUP_VERSION = 1;
export const HATASK_PLANNER_BACKUP_LIMIT = 5;

export type HataskPlannerCollectionState = {
	exists: boolean;
	updatedAt: string | null;
	value: Record<string, unknown>[];
	hash: string;
	rowCount: number;
	backupCount: number;
	latestBackupAt: string | null;
};

export type PlannerRawRegistryRow = {
	id: string;
	updatedAt: string;
	userId: string;
	domain: string | null;
	scope: string[];
	key: string;
	value: unknown;
};

export type PlannerBackupSnapshot = {
	version: 1;
	savedAt: string;
	sourceUpdatedAt: string;
	hash: string;
	value: Record<string, unknown>[];
	rawRows?: PlannerRawRegistryRow[];
	rawHash?: string;
};

export type PlannerBackupEnvelope = {
	version: 1;
	snapshots: PlannerBackupSnapshot[];
	legacyValue?: unknown;
};

export type PlannerMigrationShadowSource = Record<HataskPlannerCoreCollection,
	| { status: 'loaded'; value: Record<string, unknown>[]; rawRows: PlannerRawRegistryRow[]; rawHash: string }
	| { status: 'missing' }
>;

export type PlannerMigrationTargetIntegrity = {
	schemaVersion: number;
	collections: Record<HataskPlannerCoreCollection, {
		count: number;
		normalizedHash: string;
	}>;
	fullNormalizedHash: string;
};

export type PlannerMigrationShadow = {
	format: typeof HATASK_PLANNER_SHADOW_FORMAT;
	version: typeof HATASK_PLANNER_SHADOW_VERSION;
	targetSchemaVersion: typeof HATASK_PLANNER_TARGET_SCHEMA_VERSION;
	createdAt: string;
	source: PlannerMigrationShadowSource;
	sourceHash: string;
	targetIntegrity: PlannerMigrationTargetIntegrity;
};

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value != null && typeof value === 'object') {
		const object = value as Record<string, unknown>;
		return Object.fromEntries(Object.keys(object).sort().map(key => [key, canonicalize(object[key])]));
	}
	return value;
}

export function stablePlannerJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

export function hashPlannerValue(value: readonly Record<string, unknown>[]): string {
	return createHash('sha256').update(stablePlannerJson(value)).digest('hex');
}

export function plannerRawRows(rows: readonly MiRegistryItem[]): PlannerRawRegistryRow[] {
	return [...rows]
		.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.id.localeCompare(b.id))
		.map(row => ({
			id: row.id,
			updatedAt: row.updatedAt.toISOString(),
			userId: row.userId,
			domain: row.domain,
			scope: [...row.scope],
			key: row.key,
			value: row.value,
		}));
}

export function hashPlannerRawRows(rows: readonly PlannerRawRegistryRow[]): string {
	return createHash('sha256').update(stablePlannerJson(rows)).digest('hex');
}

/** Frontend の stablePlannerJson + FNV-1a 64bit と同じ形式。 */
export function hashPlannerShadowSource(source: PlannerMigrationShadowSource): string {
	const bytes = Buffer.from(stablePlannerJson(source), 'utf8');
	let hash = 0xcbf29ce484222325n;
	for (const byte of bytes) {
		hash ^= BigInt(byte);
		hash = BigInt.asUintN(64, hash * 0x100000001b3n);
	}
	return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

export function isEquivalentPlannerMigrationShadow(value: unknown, expected: PlannerMigrationShadow): boolean {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
	const candidate = value as Partial<PlannerMigrationShadow>;
	if (
		candidate.format !== HATASK_PLANNER_SHADOW_FORMAT ||
		candidate.version !== HATASK_PLANNER_SHADOW_VERSION ||
		candidate.targetSchemaVersion !== HATASK_PLANNER_TARGET_SCHEMA_VERSION ||
		typeof candidate.createdAt !== 'string' ||
		candidate.source == null ||
		typeof candidate.source !== 'object' ||
		candidate.sourceHash !== hashPlannerShadowSource(candidate.source as PlannerMigrationShadowSource)
	) return false;
	for (const collection of HATASK_PLANNER_CORE_COLLECTIONS) {
		const entry = (candidate.source as Partial<PlannerMigrationShadowSource>)[collection];
		if (entry?.status === 'missing') continue;
		if (
			entry?.status !== 'loaded' ||
			!Array.isArray(entry.value) ||
			!Array.isArray(entry.rawRows) ||
			typeof entry.rawHash !== 'string' ||
			entry.rawHash !== hashPlannerRawRows(entry.rawRows)
		) return false;
	}
	return candidate.sourceHash === expected.sourceHash &&
		stablePlannerJson(candidate.targetIntegrity) === stablePlannerJson(expected.targetIntegrity);
}

function isPlannerItem(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function assertPlannerValue(value: unknown, collection?: HataskPlannerCollection): asserts value is Record<string, unknown>[] {
	if (!Array.isArray(value) || !value.every(isPlannerItem)) {
		throw new TypeError('Hatask planner data must be an array of objects.');
	}
	if (collection == null) return;
	const ids = new Set<string>();
	for (const [index, item] of value.entries()) {
		if (typeof item.id !== 'string' || item.id.trim().length === 0) {
			throw new TypeError(`${collection}[${index}].id must be a non-empty string.`);
		}
		if (ids.has(item.id)) throw new TypeError(`${collection} contains a duplicate id: ${item.id}`);
		ids.add(item.id);
		const requiredText = collection === 'todos'
			? 'text'
			: collection === 'folders' || collection === 'templates'
				? 'name'
				: 'title';
		if (typeof item[requiredText] !== 'string') {
			throw new TypeError(`${collection}[${index}].${requiredText} must be a string.`);
		}
		if (collection === 'events' && typeof item.date !== 'string') {
			throw new TypeError(`${collection}[${index}].date must be a string.`);
		}
		if (collection === 'templates' && item.kind !== 'todo' && item.kind !== 'event' && item.kind !== 'members') {
			throw new TypeError(`${collection}[${index}].kind must be todo, event or members.`);
		}
		if (collection === 'templates') {
			if (!isPlannerItem(item.payload)) {
				throw new TypeError(`${collection}[${index}].payload must be an object.`);
			}
			if (item.kind === 'members') {
				const members = item.payload.visibleUserIds;
				if (!Array.isArray(members) || members.length === 0 || members.length > 100 || !members.every(id => typeof id === 'string' && /^[a-zA-Z0-9]+$/.test(id))) {
					throw new TypeError('Member templates require 1 to 100 user IDs.');
				}
				continue;
			}
			const payloadTitle = item.kind === 'todo' ? item.payload.text : item.payload.title;
			if (typeof payloadTitle !== 'string') {
				throw new TypeError(`${collection}[${index}].payload.${item.kind === 'todo' ? 'text' : 'title'} must be a string.`);
			}
		}
	}
}

/**
 * A registry table created before the uniqueness constraint existed can contain
 * more than one row for the same key. Keep every identifiable item and let the
 * newest row win only for fields that occur in both rows.
 */
export function mergePlannerRows(rows: readonly MiRegistryItem[]): Record<string, unknown>[] {
	const ordered = [...rows].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.id.localeCompare(b.id));
	const identified = new Map<string, Record<string, unknown>>();
	const anonymous: Record<string, unknown>[] = [];

	for (const row of ordered) {
		assertPlannerValue(row.value);
		for (const item of row.value) {
			const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : null;
			if (id != null) {
				identified.set(id, { ...(identified.get(id) ?? {}), ...item });
			} else {
				// 壊れた旧行も get 時点では削らない。同一内容でも件数を保ち、
				// frontend のfail-closed検証へそのまま渡す。
				anonymous.push(item);
			}
		}
	}

	return [...identified.values(), ...anonymous];
}

export function plannerBackupKey(collection: HataskPlannerCollection): string {
	return `__planner_backup_v${HATASK_PLANNER_BACKUP_VERSION}_${collection}`;
}

export function readBackupEnvelope(value: unknown): PlannerBackupEnvelope {
	if (value != null && typeof value === 'object' && !Array.isArray(value)) {
		const candidate = value as {
			version?: unknown;
			snapshots?: unknown;
			legacyValue?: unknown;
		};
		if (candidate.version === HATASK_PLANNER_BACKUP_VERSION && Array.isArray(candidate.snapshots)) {
			return {
				version: HATASK_PLANNER_BACKUP_VERSION,
				snapshots: candidate.snapshots.filter(snapshot => (
					snapshot != null &&
					typeof snapshot === 'object' &&
					(snapshot as { version?: unknown }).version === HATASK_PLANNER_BACKUP_VERSION &&
					typeof (snapshot as { savedAt?: unknown }).savedAt === 'string' &&
					Array.isArray((snapshot as { value?: unknown }).value)
				)).slice(0, HATASK_PLANNER_BACKUP_LIMIT) as PlannerBackupSnapshot[],
				...(Object.hasOwn(candidate, 'legacyValue') ? { legacyValue: candidate.legacyValue } : {}),
			};
		}
	}

	return {
		version: HATASK_PLANNER_BACKUP_VERSION,
		snapshots: [],
		...(value === undefined ? {} : { legacyValue: value }),
	};
}

export function appendPlannerBackup(
	envelope: PlannerBackupEnvelope,
	value: Record<string, unknown>[],
	sourceUpdatedAt: string,
	savedAt: string,
	rawRows: readonly PlannerRawRegistryRow[],
): PlannerBackupEnvelope {
	const hash = hashPlannerValue(value);
	const rawHash = hashPlannerRawRows(rawRows);
	const snapshots = envelope.snapshots.filter(snapshot => (snapshot.rawHash ?? snapshot.hash) !== rawHash);
	snapshots.unshift({
		version: HATASK_PLANNER_BACKUP_VERSION,
		savedAt,
		sourceUpdatedAt,
		hash,
		value,
		rawRows: [...rawRows],
		rawHash,
	});

	return {
		...envelope,
		version: HATASK_PLANNER_BACKUP_VERSION,
		snapshots: snapshots.slice(0, HATASK_PLANNER_BACKUP_LIMIT),
	};
}

export function createPlannerMigrationShadowSource(rows: readonly MiRegistryItem[]): PlannerMigrationShadowSource {
	return Object.fromEntries(HATASK_PLANNER_CORE_COLLECTIONS.map(collection => {
		const collectionRows = rows.filter(row => row.key === collection);
		if (collectionRows.length === 0) return [collection, { status: 'missing' as const }];
		const value = mergePlannerRows(collectionRows);
		assertPlannerValue(value, collection);
		const rawRows = plannerRawRows(collectionRows);
		return [collection, {
			status: 'loaded' as const,
			value,
			rawRows,
			rawHash: hashPlannerRawRows(rawRows),
		}];
	})) as PlannerMigrationShadowSource;
}

export async function findPlannerRows(
	manager: EntityManager,
	userId: string,
	keys: readonly string[],
	lock = false,
): Promise<MiRegistryItem[]> {
	const query = manager.getRepository(MiRegistryItem).createQueryBuilder('item')
		.where('item.userId = :userId', { userId })
		.andWhere('item.domain IS NULL')
		.andWhere('item.scope = :scope', { scope: [...HATASK_PLANNER_SCOPE] })
		.andWhere('item.key IN (:...keys)', { keys: [...keys] })
		.orderBy('item.updatedAt', 'ASC');

	if (lock) query.setLock('pessimistic_write');
	return await query.getMany();
}

export function latestPlannerRow(rows: readonly MiRegistryItem[]): MiRegistryItem | null {
	return rows.reduce<MiRegistryItem | null>((latest, row) => (
		latest == null ||
		row.updatedAt > latest.updatedAt ||
		(row.updatedAt.getTime() === latest.updatedAt.getTime() && row.id.localeCompare(latest.id) > 0)
			? row
			: latest
	), null);
}
