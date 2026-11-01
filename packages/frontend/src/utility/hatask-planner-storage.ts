/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Hatask の予定と ToDo の互換モデル、及び破壊しない保存形式移行。
 * UI や特定の API endpoint に依存させず、Registry / CAS endpoint のどちらも
 * 注入ポートで利用できるようにする。
 */

export const HATASK_PLANNER_SCOPE = ['client', 'hatask'] as const;
export const HATASK_PLANNER_SCHEMA_VERSION = 2;
export const HATASK_PLANNER_SHADOW_FORMAT = 'hatask-planner-shadow';
export const HATASK_PLANNER_SHADOW_VERSION = 1;
export const HATASK_PLANNER_SHADOW_KEY = 'plannerMigrationShadowV2';

export const HATASK_PLANNER_COLLECTION_KEYS = ['todos', 'folders', 'events'] as const;
export type HataskPlannerCollectionKey = typeof HATASK_PLANNER_COLLECTION_KEYS[number];
export type HataskTodoPriority = 'none' | 'low' | 'medium' | 'high';
export type HataskRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type HataskPlannerTimestamp = number | string;

type UnknownFields = Record<string, unknown>;

export type HataskRecurrence = UnknownFields & {
	frequency: HataskRecurrenceFrequency;
	interval: number;
	weekdays?: number[];
	until?: string;
	count?: number;
};

export type HataskTodoSubtask = UnknownFields & {
	id: string;
	text: string;
	done: boolean;
	createdAt?: HataskPlannerTimestamp;
};

/** 旧画面の全フィールド名を維持し、新機能は既定値つきで補う。 */
export type HataskPlannerTodo = UnknownFields & {
	id: string;
	text: string;
	done: boolean;
	due?: string;
	time?: string;
	folder?: string;
	comment?: string;
	createdAt?: HataskPlannerTimestamp;
	doneAt?: string;
	priority: HataskTodoPriority;
	subtasks: HataskTodoSubtask[];
	recurrence: HataskRecurrence;
	position: number;
	archivedAt: string | null;
};

export type HataskPlannerFolder = UnknownFields & {
	id: string;
	name: string;
	emoji?: string;
	color?: string;
	position: number;
	archivedAt: string | null;
};

export type HataskEventVisibility = 'private' | 'public' | 'specified';
export type HataskPublicSyncState = 'pending' | 'creating' | 'updating' | 'deleting' | 'deleting-local' | 'unlinked' | 'conflict' | 'sync-error';

export type HataskPlannerEvent = UnknownFields & {
	id: string;
	title: string;
	emoji?: string;
	date: string;
	dateEnd?: string;
	timeStart?: string;
	timeEnd?: string;
	timeLabel?: string;
	color?: string;
	visibility: HataskEventVisibility;
	visibleUserIds?: string[];
	rsvp: boolean;
	notify: boolean;
	notifyTimings: string[];
	allDay: boolean;
	recurrence: HataskRecurrence;
	archivedAt: string | null;
	createdAt?: HataskPlannerTimestamp;
	updatedAt?: HataskPlannerTimestamp;
	/** ローカル ID と共有予定のサーバー ID を混同しないための任意の対応情報。 */
	clientEventId?: string;
	serverEventId?: string;
	serverEventRevision?: string;
	publicSyncState?: HataskPublicSyncState;
	pendingVisibility?: HataskEventVisibility;
	importedServerEventId?: string;
	importedPublicSyncState?: string;
};

export type HataskPlannerTemplateKind = 'todo' | 'event' | 'members';

/**
 * Templates are an independent collection. They never share IDs or lifecycle
 * fields with the Todo/event from which they were created.
 */
export type HataskPlannerTemplate = UnknownFields & {
	id: string;
	kind: HataskPlannerTemplateKind;
	name: string;
	position: number;
	archivedAt: string | null;
	createdAt?: HataskPlannerTimestamp;
	updatedAt?: HataskPlannerTimestamp;
	payload: UnknownFields;
};

export type HataskPlannerData = {
	todos: HataskPlannerTodo[];
	folders: HataskPlannerFolder[];
	events: HataskPlannerEvent[];
};

export type HataskPlannerRawData = Record<HataskPlannerCollectionKey, unknown>;

export type HataskPlannerNormalizationIssue = {
	collection: HataskPlannerCollectionKey;
	path: string;
	code: 'collection-not-array' | 'item-not-object' | 'invalid-field' | 'invalid-id' | 'duplicate-id';
	message: string;
};

export type HataskPlannerNormalizationResult = {
	data: HataskPlannerData;
	issues: HataskPlannerNormalizationIssue[];
};

const PRIORITIES = new Set<HataskTodoPriority>(['none', 'low', 'medium', 'high']);
const RECURRENCE_FREQUENCIES = new Set<HataskRecurrenceFrequency>(['none', 'daily', 'weekly', 'monthly', 'yearly']);

function isRecord(value: unknown): value is UnknownFields {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is HataskPlannerTimestamp {
	return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string';
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isIsoDateLike(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value);
}

function addIssue(
	issues: HataskPlannerNormalizationIssue[],
	collection: HataskPlannerCollectionKey,
	path: string,
	code: HataskPlannerNormalizationIssue['code'],
	message: string,
): void {
	issues.push({ collection, path, code, message });
}

function requiredString(
	raw: UnknownFields,
	key: string,
	collection: HataskPlannerCollectionKey,
	path: string,
	issues: HataskPlannerNormalizationIssue[],
): string | null {
	const value = raw[key];
	if (typeof value === 'string' && (key !== 'id' || value.trim().length > 0)) return value;
	addIssue(issues, collection, `${path}.${key}`, key === 'id' ? 'invalid-id' : 'invalid-field', `${key} must be a string`);
	return null;
}

function optionalString(
	output: UnknownFields,
	raw: UnknownFields,
	key: string,
	collection: HataskPlannerCollectionKey,
	path: string,
	issues: HataskPlannerNormalizationIssue[],
): void {
	if (raw[key] == null) {
		delete output[key];
		return;
	}
	if (typeof raw[key] === 'string') {
		output[key] = raw[key];
		return;
	}
	delete output[key];
	addIssue(issues, collection, `${path}.${key}`, 'invalid-field', `${key} must be a string`);
}

function optionalTimestamp(
	output: UnknownFields,
	raw: UnknownFields,
	key: string,
	collection: HataskPlannerCollectionKey,
	path: string,
	issues: HataskPlannerNormalizationIssue[],
): void {
	if (raw[key] == null) {
		delete output[key];
		return;
	}
	if (isTimestamp(raw[key])) {
		output[key] = raw[key];
		return;
	}
	delete output[key];
	addIssue(issues, collection, `${path}.${key}`, 'invalid-field', `${key} must be a finite number or string`);
}

function normalizeRecurrence(
	value: unknown,
	collection: HataskPlannerCollectionKey,
	path: string,
	issues: HataskPlannerNormalizationIssue[],
): HataskRecurrence {
	if (value == null) return { frequency: 'none', interval: 1 };
	if (!isRecord(value)) {
		addIssue(issues, collection, path, 'invalid-field', 'recurrence must be an object');
		return { frequency: 'none', interval: 1 };
	}

	const output: UnknownFields = { ...value };
	const frequency = RECURRENCE_FREQUENCIES.has(value.frequency as HataskRecurrenceFrequency)
		? value.frequency as HataskRecurrenceFrequency
		: 'none';
	if (value.frequency != null && frequency === 'none' && value.frequency !== 'none') {
		addIssue(issues, collection, `${path}.frequency`, 'invalid-field', 'unsupported recurrence frequency');
	}
	const interval = value.interval == null ? 1 : isPositiveInteger(value.interval) ? value.interval : 1;
	if (value.interval != null && !isPositiveInteger(value.interval)) {
		addIssue(issues, collection, `${path}.interval`, 'invalid-field', 'recurrence interval must be a positive integer');
	}
	output.frequency = frequency;
	output.interval = interval;

	if (value.weekdays == null) {
		delete output.weekdays;
	} else if (
		frequency === 'weekly' &&
		Array.isArray(value.weekdays) &&
		value.weekdays.every(day => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6) &&
		new Set(value.weekdays).size === value.weekdays.length
	) {
		output.weekdays = [...value.weekdays];
	} else {
		delete output.weekdays;
		addIssue(issues, collection, `${path}.weekdays`, 'invalid-field', 'weekdays must be unique values from 0 through 6 on a weekly recurrence');
	}

	if (value.until == null) {
		delete output.until;
	} else if (isIsoDateLike(value.until)) {
		output.until = value.until;
	} else {
		delete output.until;
		addIssue(issues, collection, `${path}.until`, 'invalid-field', 'recurrence until must be an ISO date or timestamp');
	}

	if (value.count == null) {
		delete output.count;
	} else if (isPositiveInteger(value.count)) {
		output.count = value.count;
	} else {
		delete output.count;
		addIssue(issues, collection, `${path}.count`, 'invalid-field', 'recurrence count must be a positive integer');
	}

	return output as HataskRecurrence;
}

function normalizeSubtasks(
	value: unknown,
	todoPath: string,
	issues: HataskPlannerNormalizationIssue[],
): HataskTodoSubtask[] {
	if (value == null) return [];
	if (!Array.isArray(value)) {
		addIssue(issues, 'todos', `${todoPath}.subtasks`, 'invalid-field', 'subtasks must be an array');
		return [];
	}

	const output: HataskTodoSubtask[] = [];
	const ids = new Set<string>();
	value.forEach((item, index) => {
		const path = `${todoPath}.subtasks[${index}]`;
		if (!isRecord(item)) {
			addIssue(issues, 'todos', path, 'item-not-object', 'subtask must be an object');
			return;
		}
		const id = requiredString(item, 'id', 'todos', path, issues);
		const text = requiredString(item, 'text', 'todos', path, issues);
		if (id == null || text == null) return;
		const subtask: UnknownFields = { ...item, id, text, done: item.done === true };
		if (item.done != null && typeof item.done !== 'boolean') {
			addIssue(issues, 'todos', `${path}.done`, 'invalid-field', 'done must be a boolean');
		}
		optionalTimestamp(subtask, item, 'createdAt', 'todos', path, issues);
		if (ids.has(id)) addIssue(issues, 'todos', `${path}.id`, 'duplicate-id', `duplicate subtask id: ${id}`);
		ids.add(id);
		output.push(subtask as HataskTodoSubtask);
	});
	return output;
}

function normalizeTodo(
	value: unknown,
	index: number,
	issues: HataskPlannerNormalizationIssue[],
): HataskPlannerTodo | null {
	const path = `todos[${index}]`;
	if (!isRecord(value)) {
		addIssue(issues, 'todos', path, 'item-not-object', 'todo must be an object');
		return null;
	}
	const id = requiredString(value, 'id', 'todos', path, issues);
	const text = requiredString(value, 'text', 'todos', path, issues);
	if (id == null || text == null) return null;

	const output: UnknownFields = {
		...value,
		id,
		text,
		done: value.done === true,
		priority: PRIORITIES.has(value.priority as HataskTodoPriority) ? value.priority : 'none',
		subtasks: normalizeSubtasks(value.subtasks, path, issues),
		recurrence: normalizeRecurrence(value.recurrence, 'todos', `${path}.recurrence`, issues),
		position: typeof value.position === 'number' && Number.isFinite(value.position) ? value.position : index,
		archivedAt: value.archivedAt == null ? null : typeof value.archivedAt === 'string' ? value.archivedAt : null,
	};
	if (value.done != null && typeof value.done !== 'boolean') addIssue(issues, 'todos', `${path}.done`, 'invalid-field', 'done must be a boolean');
	if (value.priority != null && !PRIORITIES.has(value.priority as HataskTodoPriority)) addIssue(issues, 'todos', `${path}.priority`, 'invalid-field', 'unsupported priority');
	if (value.position != null && (typeof value.position !== 'number' || !Number.isFinite(value.position))) addIssue(issues, 'todos', `${path}.position`, 'invalid-field', 'position must be a finite number');
	if (value.archivedAt != null && typeof value.archivedAt !== 'string') addIssue(issues, 'todos', `${path}.archivedAt`, 'invalid-field', 'archivedAt must be a string or null');
	for (const key of ['due', 'time', 'folder', 'comment', 'doneAt'] as const) optionalString(output, value, key, 'todos', path, issues);
	optionalTimestamp(output, value, 'createdAt', 'todos', path, issues);
	return output as HataskPlannerTodo;
}

function normalizeFolder(
	value: unknown,
	index: number,
	issues: HataskPlannerNormalizationIssue[],
): HataskPlannerFolder | null {
	const path = `folders[${index}]`;
	if (!isRecord(value)) {
		addIssue(issues, 'folders', path, 'item-not-object', 'folder must be an object');
		return null;
	}
	const id = requiredString(value, 'id', 'folders', path, issues);
	const name = requiredString(value, 'name', 'folders', path, issues);
	if (id == null || name == null) return null;
	const output: UnknownFields = {
		...value,
		id,
		name,
		position: typeof value.position === 'number' && Number.isFinite(value.position) ? value.position : index,
		archivedAt: value.archivedAt == null ? null : typeof value.archivedAt === 'string' ? value.archivedAt : null,
	};
	if (value.position != null && (typeof value.position !== 'number' || !Number.isFinite(value.position))) addIssue(issues, 'folders', `${path}.position`, 'invalid-field', 'position must be a finite number');
	if (value.archivedAt != null && typeof value.archivedAt !== 'string') addIssue(issues, 'folders', `${path}.archivedAt`, 'invalid-field', 'archivedAt must be a string or null');
	for (const key of ['emoji', 'color'] as const) optionalString(output, value, key, 'folders', path, issues);
	return output as HataskPlannerFolder;
}

function normalizeEvent(
	value: unknown,
	index: number,
	issues: HataskPlannerNormalizationIssue[],
): HataskPlannerEvent | null {
	const path = `events[${index}]`;
	if (!isRecord(value)) {
		addIssue(issues, 'events', path, 'item-not-object', 'event must be an object');
		return null;
	}
	const id = requiredString(value, 'id', 'events', path, issues);
	const title = requiredString(value, 'title', 'events', path, issues);
	const date = requiredString(value, 'date', 'events', path, issues);
	if (id == null || title == null || date == null) return null;
	const visibility: HataskEventVisibility = value.visibility === 'public' || value.visibility === 'specified' ? value.visibility : 'private';
	const output: UnknownFields = {
		...value,
		id,
		title,
		date,
		visibility,
		rsvp: value.rsvp === true,
		notify: value.notify === true,
		notifyTimings: Array.isArray(value.notifyTimings) && value.notifyTimings.every(item => typeof item === 'string') ? [...value.notifyTimings] : [],
		allDay: value.allDay === true,
		recurrence: normalizeRecurrence(value.recurrence, 'events', `${path}.recurrence`, issues),
		archivedAt: value.archivedAt == null ? null : typeof value.archivedAt === 'string' ? value.archivedAt : null,
	};
	if (value.visibility != null && !['private', 'public', 'specified'].includes(String(value.visibility))) addIssue(issues, 'events', `${path}.visibility`, 'invalid-field', 'unsupported visibility');
	if (value.visibleUserIds != null || visibility === 'specified') {
		if (!Array.isArray(value.visibleUserIds) || value.visibleUserIds.length > 100 || !value.visibleUserIds.every(memberId => typeof memberId === 'string' && memberId.length > 0)) {
			addIssue(issues, 'events', `${path}.visibleUserIds`, 'invalid-field', 'visibleUserIds must be a member ID array');
		} else {
			output.visibleUserIds = [...new Set(value.visibleUserIds)];
		}
	}
	for (const key of ['rsvp', 'notify', 'allDay'] as const) {
		if (value[key] != null && typeof value[key] !== 'boolean') addIssue(issues, 'events', `${path}.${key}`, 'invalid-field', `${key} must be a boolean`);
	}
	if (value.notifyTimings != null && (!Array.isArray(value.notifyTimings) || !value.notifyTimings.every(item => typeof item === 'string'))) {
		addIssue(issues, 'events', `${path}.notifyTimings`, 'invalid-field', 'notifyTimings must be a string array');
	}
	if (value.archivedAt != null && typeof value.archivedAt !== 'string') addIssue(issues, 'events', `${path}.archivedAt`, 'invalid-field', 'archivedAt must be a string or null');
	for (const key of ['emoji', 'dateEnd', 'timeStart', 'timeEnd', 'timeLabel', 'color', 'clientEventId', 'serverEventId', 'serverEventRevision', 'importedServerEventId', 'importedPublicSyncState'] as const) {
		optionalString(output, value, key, 'events', path, issues);
	}
	if (value.publicSyncState == null) {
		delete output.publicSyncState;
	} else if (['pending', 'creating', 'updating', 'deleting', 'deleting-local', 'unlinked', 'conflict', 'sync-error'].includes(String(value.publicSyncState))) {
		output.publicSyncState = value.publicSyncState;
	} else {
		delete output.publicSyncState;
		addIssue(issues, 'events', `${path}.publicSyncState`, 'invalid-field', 'unsupported public sync state');
	}
	if (value.pendingVisibility == null) {
		delete output.pendingVisibility;
	} else if (value.pendingVisibility === 'private' || value.pendingVisibility === 'public' || value.pendingVisibility === 'specified') {
		output.pendingVisibility = value.pendingVisibility;
	} else {
		delete output.pendingVisibility;
		addIssue(issues, 'events', `${path}.pendingVisibility`, 'invalid-field', 'pendingVisibility must be private or public');
	}
	for (const key of ['createdAt', 'updatedAt'] as const) optionalTimestamp(output, value, key, 'events', path, issues);
	return output as HataskPlannerEvent;
}

function normalizeCollection(
	collection: HataskPlannerCollectionKey,
	value: unknown,
): { items: HataskPlannerData[HataskPlannerCollectionKey]; issues: HataskPlannerNormalizationIssue[] } {
	const issues: HataskPlannerNormalizationIssue[] = [];
	if (!Array.isArray(value)) {
		addIssue(issues, collection, collection, 'collection-not-array', `${collection} must be an array`);
		return { items: [], issues };
	}
	const ids = new Set<string>();
	const items: Array<HataskPlannerTodo | HataskPlannerFolder | HataskPlannerEvent> = [];
	value.forEach((item, index) => {
		const normalized = collection === 'todos'
			? normalizeTodo(item, index, issues)
			: collection === 'folders'
				? normalizeFolder(item, index, issues)
				: normalizeEvent(item, index, issues);
		if (normalized == null) return;
		if (ids.has(normalized.id)) addIssue(issues, collection, `${collection}[${index}].id`, 'duplicate-id', `duplicate ${collection} id: ${normalized.id}`);
		ids.add(normalized.id);
		items.push(normalized);
	});
	return { items: items as HataskPlannerData[HataskPlannerCollectionKey], issues };
}

/**
 * 旧配列を正規化する。未知フィールドは各レコード・繰返し・サブタスク内で保持する。
 * issues が1件でもあれば移行実行側は書き込まない。
 */
export function normalizeHataskPlannerData(raw: HataskPlannerRawData): HataskPlannerNormalizationResult {
	const todos = normalizeCollection('todos', raw.todos);
	const folders = normalizeCollection('folders', raw.folders);
	const events = normalizeCollection('events', raw.events);
	return {
		data: {
			todos: todos.items as HataskPlannerTodo[],
			folders: folders.items as HataskPlannerFolder[],
			events: events.items as HataskPlannerEvent[],
		},
		issues: [...todos.issues, ...folders.issues, ...events.issues],
	};
}

function canonicalize(value: unknown, seen: Set<object>): unknown {
	if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'bigint') throw new TypeError('BigInt is not valid Registry JSON');
	if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') return undefined;
	if (typeof value !== 'object') return value;
	if (seen.has(value)) throw new TypeError('Circular Registry value');
	seen.add(value);
	try {
		if (Array.isArray(value)) return value.map(item => canonicalize(item, seen) ?? null);
		const output: UnknownFields = {};
		for (const key of Object.keys(value as UnknownFields).sort()) {
			const item = canonicalize((value as UnknownFields)[key], seen);
			if (item !== undefined) output[key] = item;
		}
		return output;
	} finally {
		seen.delete(value);
	}
}

export function stablePlannerJson(value: unknown): string {
	const canonical = canonicalize(value, new Set());
	return canonical === undefined ? 'null' : JSON.stringify(canonical);
}

/** FNV-1a 64bit。比較時は必ず件数・ID列も別途照合する。 */
export function hashNormalizedPlannerValue(value: unknown): string {
	const bytes = new TextEncoder().encode(stablePlannerJson(value));
	let hash = 0xcbf29ce484222325n;
	for (const byte of bytes) {
		hash ^= BigInt(byte);
		hash = BigInt.asUintN(64, hash * 0x100000001b3n);
	}
	return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

export type HataskPlannerCollectionIntegrity = {
	count: number;
	ids: string[];
	duplicateIds: string[];
	normalizedHash: string;
};

export type HataskPlannerIntegrity = {
	schemaVersion: typeof HATASK_PLANNER_SCHEMA_VERSION;
	collections: Record<HataskPlannerCollectionKey, HataskPlannerCollectionIntegrity>;
	fullNormalizedHash: string;
};

function collectionIntegrity(items: Array<{ id: string }>): HataskPlannerCollectionIntegrity {
	const ids = items.map(item => item.id);
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) duplicates.add(id);
		seen.add(id);
	}
	return {
		count: items.length,
		ids,
		duplicateIds: [...duplicates].sort(),
		normalizedHash: hashNormalizedPlannerValue(items),
	};
}

export function createHataskPlannerIntegrity(data: HataskPlannerData): HataskPlannerIntegrity {
	return {
		schemaVersion: HATASK_PLANNER_SCHEMA_VERSION,
		collections: {
			todos: collectionIntegrity(data.todos),
			folders: collectionIntegrity(data.folders),
			events: collectionIntegrity(data.events),
		},
		fullNormalizedHash: hashNormalizedPlannerValue(data),
	};
}

export type HataskPlannerVerificationIssue = {
	collection?: HataskPlannerCollectionKey;
	kind: 'normalization' | 'count' | 'ids' | 'duplicate-ids' | 'collection-hash' | 'full-hash';
	detail: string;
};

export type HataskPlannerVerificationResult = {
	ok: boolean;
	actual: HataskPlannerIntegrity;
	issues: HataskPlannerVerificationIssue[];
};

export function verifyHataskPlannerIntegrity(
	expected: HataskPlannerIntegrity,
	actualRaw: HataskPlannerRawData,
): HataskPlannerVerificationResult {
	const normalized = normalizeHataskPlannerData(actualRaw);
	const actual = createHataskPlannerIntegrity(normalized.data);
	const issues: HataskPlannerVerificationIssue[] = normalized.issues.map(issue => ({
		collection: issue.collection,
		kind: 'normalization',
		detail: `${issue.path}: ${issue.message}`,
	}));
	for (const key of HATASK_PLANNER_COLLECTION_KEYS) {
		const before = expected.collections[key];
		const after = actual.collections[key];
		if (before.count !== after.count) issues.push({ collection: key, kind: 'count', detail: `${before.count} != ${after.count}` });
		if (stablePlannerJson(before.ids) !== stablePlannerJson(after.ids)) issues.push({ collection: key, kind: 'ids', detail: 'ID sequence changed' });
		if (after.duplicateIds.length > 0) issues.push({ collection: key, kind: 'duplicate-ids', detail: after.duplicateIds.join(', ') });
		if (before.normalizedHash !== after.normalizedHash) issues.push({ collection: key, kind: 'collection-hash', detail: `${before.normalizedHash} != ${after.normalizedHash}` });
	}
	if (expected.fullNormalizedHash !== actual.fullNormalizedHash) {
		issues.push({ kind: 'full-hash', detail: `${expected.fullNormalizedHash} != ${actual.fullNormalizedHash}` });
	}
	return { ok: issues.length === 0, actual, issues };
}

export type HataskPlannerRevision = string | number | null;

export type HataskPlannerCollectionWrite = {
	key: HataskPlannerCollectionKey;
	value: HataskPlannerData[HataskPlannerCollectionKey];
	expectedRevision?: HataskPlannerRevision;
};

/**
 * Registry と CAS API のどちらにも接続できる最小ポート。
 * remove を持たせず、移行処理から旧キーを削除できないようにする。
 */
export interface HataskPlannerStoragePort {
	read(request: { scope: readonly string[]; key: string }): Promise<{ value: unknown; revision?: HataskPlannerRevision }>;
	write(request: {
		scope: readonly string[];
		key: string;
		value: unknown;
		expectedRevision?: HataskPlannerRevision;
	}): Promise<{ revision?: HataskPlannerRevision } | void>;
	writeBatch?(request: {
		scope: readonly string[];
		writes: readonly HataskPlannerCollectionWrite[];
	}): Promise<void>;
	isMissingError?(error: unknown): boolean;
}

export type HataskPlannerReadResult =
	| { status: 'loaded'; value: unknown; revision?: HataskPlannerRevision }
	| { status: 'missing' }
	| { status: 'failed'; error: unknown };

export type HataskPlannerStorageReads = {
	collections: Record<HataskPlannerCollectionKey, HataskPlannerReadResult>;
	shadow: HataskPlannerReadResult;
};

function defaultMissingError(error: unknown): boolean {
	return error != null && typeof error === 'object' && 'code' in error && error.code === 'NO_SUCH_KEY';
}

async function readStorageKey(
	port: HataskPlannerStoragePort,
	scope: readonly string[],
	key: string,
): Promise<HataskPlannerReadResult> {
	try {
		const result = await port.read({ scope, key });
		return { status: 'loaded', value: result.value, revision: result.revision };
	} catch (error) {
		return (port.isMissingError ?? defaultMissingError)(error)
			? { status: 'missing' }
			: { status: 'failed', error };
	}
}

export async function readHataskPlannerStorage(
	port: HataskPlannerStoragePort,
	options: { scope?: readonly string[]; shadowKey?: string } = {},
): Promise<HataskPlannerStorageReads> {
	const scope = options.scope ?? HATASK_PLANNER_SCOPE;
	const shadowKey = options.shadowKey ?? HATASK_PLANNER_SHADOW_KEY;
	const [todos, folders, events, shadow] = await Promise.all([
		readStorageKey(port, scope, 'todos'),
		readStorageKey(port, scope, 'folders'),
		readStorageKey(port, scope, 'events'),
		readStorageKey(port, scope, shadowKey),
	]);
	return { collections: { todos, folders, events }, shadow };
}

export type HataskPlannerShadowSource = Record<HataskPlannerCollectionKey,
	| { status: 'loaded'; value: unknown; rawRows?: unknown[]; rawHash?: string }
	| { status: 'missing' }
>;

export type HataskPlannerShadowTargetIntegrity = {
	schemaVersion: typeof HATASK_PLANNER_SCHEMA_VERSION;
	collections: Record<HataskPlannerCollectionKey, {
		count: number;
		normalizedHash: string;
	}>;
	fullNormalizedHash: string;
};

export type HataskPlannerShadowSnapshot = {
	format: typeof HATASK_PLANNER_SHADOW_FORMAT;
	version: typeof HATASK_PLANNER_SHADOW_VERSION;
	targetSchemaVersion: typeof HATASK_PLANNER_SCHEMA_VERSION;
	createdAt: string;
	source: HataskPlannerShadowSource;
	sourceHash: string;
	targetIntegrity: HataskPlannerShadowTargetIntegrity;
};

export type HataskPlannerMigrationIssue = {
	key?: string;
	code: 'load-failed' | 'invalid-data' | 'invalid-shadow' | 'shadow-mismatch';
	detail: string;
};

export type HataskPlannerMigrationPlan = {
	status: 'blocked' | 'noop' | 'ready';
	issues: HataskPlannerMigrationIssue[];
	data?: HataskPlannerData;
	integrity?: HataskPlannerIntegrity;
	shadowWrite?: HataskPlannerShadowSnapshot;
	collectionWrites: HataskPlannerCollectionWrite[];
};

function rawDataFromReads(reads: HataskPlannerStorageReads): HataskPlannerRawData {
	return Object.fromEntries(HATASK_PLANNER_COLLECTION_KEYS.map(key => {
		const result = reads.collections[key];
		return [key, result.status === 'loaded' ? result.value : []];
	})) as HataskPlannerRawData;
}

function shadowSourceFromReads(reads: HataskPlannerStorageReads): HataskPlannerShadowSource {
	return Object.fromEntries(HATASK_PLANNER_COLLECTION_KEYS.map(key => {
		const result = reads.collections[key];
		return [key, result.status === 'loaded'
			? { status: 'loaded' as const, value: JSON.parse(stablePlannerJson(result.value)) as unknown }
			: { status: 'missing' as const }];
	})) as HataskPlannerShadowSource;
}

export function compactHataskPlannerIntegrity(integrity: HataskPlannerIntegrity): HataskPlannerShadowTargetIntegrity {
	return {
		schemaVersion: integrity.schemaVersion,
		collections: Object.fromEntries(HATASK_PLANNER_COLLECTION_KEYS.map(key => [key, {
			count: integrity.collections[key].count,
			normalizedHash: integrity.collections[key].normalizedHash,
		}])) as HataskPlannerShadowTargetIntegrity['collections'],
		fullNormalizedHash: integrity.fullNormalizedHash,
	};
}

function isValidShadowSnapshot(value: unknown): value is HataskPlannerShadowSnapshot {
	if (!isRecord(value)) return false;
	if (
		value.format !== HATASK_PLANNER_SHADOW_FORMAT ||
		value.version !== HATASK_PLANNER_SHADOW_VERSION ||
		value.targetSchemaVersion !== HATASK_PLANNER_SCHEMA_VERSION ||
		typeof value.createdAt !== 'string' ||
		!isRecord(value.source) ||
		!isRecord(value.targetIntegrity) ||
		typeof value.sourceHash !== 'string'
	) return false;
	for (const key of HATASK_PLANNER_COLLECTION_KEYS) {
		const source = value.source[key];
		if (!isRecord(source) || (source.status !== 'loaded' && source.status !== 'missing')) return false;
		if (source.status === 'loaded') {
			if (!Array.isArray(source.value)) return false;
			const hasRawRows = Object.hasOwn(source, 'rawRows');
			const hasRawHash = Object.hasOwn(source, 'rawHash');
			if (hasRawRows !== hasRawHash) return false;
			if (hasRawRows && (!Array.isArray(source.rawRows) || typeof source.rawHash !== 'string' || !/^[0-9a-f]{64}$/.test(source.rawHash))) return false;
		}
		const target = isRecord(value.targetIntegrity.collections) ? value.targetIntegrity.collections[key] : null;
		if (!isRecord(target) || typeof target.count !== 'number' || !Number.isSafeInteger(target.count) || target.count < 0 || typeof target.normalizedHash !== 'string') return false;
		if (!/^fnv1a64:[0-9a-f]{16}$/.test(target.normalizedHash)) return false;
	}
	if (
		value.targetIntegrity.schemaVersion !== HATASK_PLANNER_SCHEMA_VERSION ||
		typeof value.targetIntegrity.fullNormalizedHash !== 'string' ||
		!/^fnv1a64:[0-9a-f]{16}$/.test(value.targetIntegrity.fullNormalizedHash)
	) return false;
	return hashNormalizedPlannerValue(value.source) === value.sourceHash;
}

function isCompatibleShadow(value: unknown, targetIntegrity: HataskPlannerIntegrity): value is HataskPlannerShadowSnapshot {
	return isValidShadowSnapshot(value) &&
		stablePlannerJson(value.targetIntegrity) === stablePlannerJson(compactHataskPlannerIntegrity(targetIntegrity));
}

function logicalShadowSourceMatches(expected: HataskPlannerShadowSource, actual: HataskPlannerShadowSource): boolean {
	return HATASK_PLANNER_COLLECTION_KEYS.every(key => {
		const before = expected[key];
		const after = actual[key];
		if (before.status !== after.status) return false;
		if (before.status === 'missing' || after.status === 'missing') return true;
		return stablePlannerJson(before.value) === stablePlannerJson(after.value);
	});
}

/** 読み込み結果だけから移行計画を作る純粋関数。 */
export function createHataskPlannerMigrationPlan(
	reads: HataskPlannerStorageReads,
	now = new Date(),
): HataskPlannerMigrationPlan {
	const issues: HataskPlannerMigrationIssue[] = [];
	for (const key of HATASK_PLANNER_COLLECTION_KEYS) {
		if (reads.collections[key].status === 'failed') issues.push({ key, code: 'load-failed', detail: `${key} could not be loaded` });
	}
	if (reads.shadow.status === 'failed') issues.push({ key: HATASK_PLANNER_SHADOW_KEY, code: 'load-failed', detail: 'shadow snapshot could not be loaded' });
	if (issues.length > 0) return { status: 'blocked', issues, collectionWrites: [] };

	const raw = rawDataFromReads(reads);
	const normalized = normalizeHataskPlannerData(raw);
	if (normalized.issues.length > 0) {
		return {
			status: 'blocked',
			issues: normalized.issues.map(issue => ({ key: issue.collection, code: 'invalid-data', detail: `${issue.path}: ${issue.message}` })),
			collectionWrites: [],
		};
	}
	const integrity = createHataskPlannerIntegrity(normalized.data);
	const collectionWrites = HATASK_PLANNER_COLLECTION_KEYS.flatMap(key => {
		const read = reads.collections[key];
		if (read.status !== 'loaded' || stablePlannerJson(read.value) === stablePlannerJson(normalized.data[key])) return [];
		return [{ key, value: normalized.data[key], expectedRevision: read.revision } satisfies HataskPlannerCollectionWrite];
	});

	if (collectionWrites.length === 0 && reads.shadow.status === 'loaded') {
		// 影は一度きりの移行原本。通常利用で現在値が変わった後にtargetとの一致を
		// 再要求すると正当な編集を止めるため、存在を移行済みマーカーとして扱う。
		if (!isValidShadowSnapshot(reads.shadow.value)) {
			return { status: 'blocked', issues: [{ key: HATASK_PLANNER_SHADOW_KEY, code: 'invalid-shadow', detail: 'shadow snapshot has an invalid shape or hash' }], collectionWrites: [] };
		}
		return { status: 'noop', issues: [], data: normalized.data, integrity, collectionWrites: [] };
	}

	if (reads.shadow.status === 'loaded') {
		if (!isRecord(reads.shadow.value)) {
			return { status: 'blocked', issues: [{ key: HATASK_PLANNER_SHADOW_KEY, code: 'invalid-shadow', detail: 'shadow snapshot has an invalid shape' }], collectionWrites: [] };
		}
		if (!isCompatibleShadow(reads.shadow.value, integrity)) {
			return { status: 'blocked', issues: [{ key: HATASK_PLANNER_SHADOW_KEY, code: 'shadow-mismatch', detail: 'existing shadow does not match the migration target' }], collectionWrites: [] };
		}
		return { status: 'ready', issues: [], data: normalized.data, integrity, collectionWrites };
	}

	const source = shadowSourceFromReads(reads);
	const shadowWrite: HataskPlannerShadowSnapshot = {
		format: HATASK_PLANNER_SHADOW_FORMAT,
		version: HATASK_PLANNER_SHADOW_VERSION,
		targetSchemaVersion: HATASK_PLANNER_SCHEMA_VERSION,
		createdAt: now.toISOString(),
		source,
		sourceHash: hashNormalizedPlannerValue(source),
		targetIntegrity: compactHataskPlannerIntegrity(integrity),
	};
	return { status: 'ready', issues: [], data: normalized.data, integrity, shadowWrite, collectionWrites };
}

export type HataskPlannerMigrationResult = {
	status: 'blocked' | 'noop' | 'migrated' | 'failed';
	reads: HataskPlannerStorageReads;
	issues: HataskPlannerMigrationIssue[];
	writtenKeys: string[];
	integrity?: HataskPlannerIntegrity;
	stage?: 'shadow-write' | 'shadow-verify' | 'collection-write' | 'collection-verify' | 'final-verify';
	error?: unknown;
};

function verifiedShadowMatch(expected: HataskPlannerShadowSnapshot, targetIntegrity: HataskPlannerIntegrity, actual: unknown): boolean {
	return isCompatibleShadow(actual, targetIntegrity) && logicalShadowSourceMatches(expected.source, actual.source);
}

async function verifyCollectionWrite(
	port: HataskPlannerStoragePort,
	scope: readonly string[],
	write: HataskPlannerCollectionWrite,
): Promise<{ ok: boolean; error?: unknown }> {
	const readBack = await readStorageKey(port, scope, write.key);
	if (readBack.status !== 'loaded') return { ok: false, error: readBack.status === 'failed' ? readBack.error : undefined };
	const expectedRaw = { todos: [], folders: [], events: [], [write.key]: write.value } as HataskPlannerRawData;
	const actualRaw = { todos: [], folders: [], events: [], [write.key]: readBack.value } as HataskPlannerRawData;
	const expectedIntegrity = createHataskPlannerIntegrity(normalizeHataskPlannerData(expectedRaw).data);
	return { ok: verifyHataskPlannerIntegrity(expectedIntegrity, actualRaw).ok };
}

/**
 * 影スナップショットを先に保存・再読込検証し、その後にだけ正規化値を書く。
 * 読込失敗・不正値・重複 ID が1件でもあれば書込は0件。旧キーを削除しない。
 */
export async function migrateHataskPlannerStorage(
	port: HataskPlannerStoragePort,
	options: { scope?: readonly string[]; shadowKey?: string; now?: Date } = {},
): Promise<HataskPlannerMigrationResult> {
	const scope = options.scope ?? HATASK_PLANNER_SCOPE;
	const shadowKey = options.shadowKey ?? HATASK_PLANNER_SHADOW_KEY;
	const reads = await readHataskPlannerStorage(port, { scope, shadowKey });
	const plan = createHataskPlannerMigrationPlan(reads, options.now);
	if (plan.status === 'blocked' || plan.status === 'noop') {
		return { status: plan.status, reads, issues: plan.issues, writtenKeys: [], integrity: plan.integrity };
	}
	const targetIntegrity = plan.integrity;
	if (targetIntegrity == null) {
		return { status: 'failed', reads, issues: [], writtenKeys: [], stage: 'final-verify', error: new Error('migration plan has no integrity evidence') };
	}

	const writtenKeys: string[] = [];
	if (plan.shadowWrite != null) {
		try {
			await port.write({ scope, key: shadowKey, value: plan.shadowWrite, expectedRevision: null });
			writtenKeys.push(shadowKey);
		} catch (error) {
			return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'shadow-write', error };
		}
		const shadowRead = await readStorageKey(port, scope, shadowKey);
		if (shadowRead.status !== 'loaded' || !verifiedShadowMatch(plan.shadowWrite, targetIntegrity, shadowRead.value)) {
			return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'shadow-verify', error: shadowRead.status === 'failed' ? shadowRead.error : undefined };
		}
	}

	if (plan.collectionWrites.length > 0 && port.writeBatch != null) {
		try {
			await port.writeBatch({ scope, writes: plan.collectionWrites });
			writtenKeys.push(...plan.collectionWrites.map(write => write.key));
		} catch (error) {
			return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'collection-write', error };
		}
		for (const write of plan.collectionWrites) {
			const verification = await verifyCollectionWrite(port, scope, write);
			if (!verification.ok) return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'collection-verify', error: verification.error };
		}
	} else {
		for (const write of plan.collectionWrites) {
			try {
				await port.write({ scope, key: write.key, value: write.value, expectedRevision: write.expectedRevision });
				writtenKeys.push(write.key);
			} catch (error) {
				return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'collection-write', error };
			}
			const verification = await verifyCollectionWrite(port, scope, write);
			if (!verification.ok) return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'collection-verify', error: verification.error };
		}
	}

	const finalReads = await readHataskPlannerStorage(port, { scope, shadowKey });
	if (HATASK_PLANNER_COLLECTION_KEYS.some(key => finalReads.collections[key].status === 'failed')) {
		return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'final-verify' };
	}
	const finalVerification = verifyHataskPlannerIntegrity(targetIntegrity, rawDataFromReads(finalReads));
	if (!finalVerification.ok) {
		return { status: 'failed', reads, issues: [], writtenKeys, integrity: plan.integrity, stage: 'final-verify' };
	}
	return { status: 'migrated', reads, issues: [], writtenKeys, integrity: finalVerification.actual };
}
