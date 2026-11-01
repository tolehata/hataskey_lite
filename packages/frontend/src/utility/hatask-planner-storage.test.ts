/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import {
	createHataskPlannerIntegrity,
	HATASK_PLANNER_SHADOW_KEY,
	hashNormalizedPlannerValue,
	migrateHataskPlannerStorage,
	normalizeHataskPlannerData,
	readHataskPlannerStorage,
	verifyHataskPlannerIntegrity,
} from './hatask-planner-storage.js';
import type { HataskPlannerCollectionWrite, HataskPlannerRawData, HataskPlannerStoragePort } from './hatask-planner-storage.js';

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function noSuchKey(): Error & { code: string } {
	return Object.assign(new Error('No such key'), { code: 'NO_SUCH_KEY' });
}

class MemoryPlannerPort implements HataskPlannerStoragePort {
	public readonly values = new Map<string, unknown>();
	public readonly revisions = new Map<string, number>();
	public readonly writes: Array<{ key: string; value: unknown; expectedRevision?: string | number | null }> = [];
	public readonly failedReads = new Map<string, Error>();
	public readonly batchCalls: HataskPlannerCollectionWrite[][] = [];
	public corruptShadowAfterWrite = false;
	public enrichShadowAfterWrite = false;

	public constructor(initial: Partial<Record<string, unknown>> = {}) {
		for (const [key, value] of Object.entries(initial)) {
			this.values.set(key, clone(value));
			this.revisions.set(key, 1);
		}
	}

	public async read({ key }: { scope: readonly string[]; key: string }): Promise<{ value: unknown; revision?: number }> {
		const failure = this.failedReads.get(key);
		if (failure != null) throw failure;
		if (!this.values.has(key)) throw noSuchKey();
		return { value: clone(this.values.get(key)), revision: this.revisions.get(key) };
	}

	public async write({ key, value, expectedRevision }: {
		scope: readonly string[];
		key: string;
		value: unknown;
		expectedRevision?: string | number | null;
	}): Promise<{ revision: number }> {
		const currentRevision = this.revisions.get(key) ?? null;
		if (expectedRevision !== undefined && expectedRevision !== currentRevision) throw new Error(`revision conflict: ${key}`);
		this.writes.push({ key, value: clone(value), expectedRevision });
		const stored = clone(value);
		if (key === HATASK_PLANNER_SHADOW_KEY && this.enrichShadowAfterWrite) {
			const snapshot = stored as {
				source: Record<string, { status: string; value?: unknown[]; rawRows?: unknown[]; rawHash?: string }>;
				sourceHash: string;
			};
			for (const [collection, source] of Object.entries(snapshot.source)) {
				if (source.status !== 'loaded') continue;
				source.rawRows = [{ id: `raw-${collection}`, updatedAt: '2026-08-29T00:00:00.000Z', value: clone(source.value) }];
				source.rawHash = collection === 'todos' ? 'a'.repeat(64) : collection === 'folders' ? 'b'.repeat(64) : 'c'.repeat(64);
			}
			snapshot.sourceHash = hashNormalizedPlannerValue(snapshot.source);
		}
		if (key === HATASK_PLANNER_SHADOW_KEY && this.corruptShadowAfterWrite) {
			const snapshot = stored as { source: { todos: { status: string; value?: unknown[] } } };
			if (snapshot.source.todos.status === 'loaded' && Array.isArray(snapshot.source.todos.value)) {
				snapshot.source.todos.value = snapshot.source.todos.value.slice(0, -1);
			}
		}
		this.values.set(key, stored);
		const revision = (this.revisions.get(key) ?? 0) + 1;
		this.revisions.set(key, revision);
		return { revision };
	}

	public async writeBatch({ scope, writes }: { scope: readonly string[]; writes: readonly HataskPlannerCollectionWrite[] }): Promise<void> {
		for (const write of writes) {
			const currentRevision = this.revisions.get(write.key) ?? null;
			if (write.expectedRevision !== undefined && write.expectedRevision !== currentRevision) throw new Error(`revision conflict: ${write.key}`);
		}
		this.batchCalls.push(writes.map(write => clone(write)));
		for (const write of writes) await this.write({ scope, ...write });
	}
}

const legacyData = {
	todos: [
		{
			id: 'todo-a',
			text: '既存の提出物',
			done: false,
			due: '2026-09-01',
			time: '18:00',
			folder: 'folder-a',
			comment: '消してはいけないメモ',
			createdAt: 1_725_000_000_000,
			futureTodoField: { color: 'violet' },
		},
		{
			id: 'todo-b',
			text: '完了済みの用事',
			done: true,
			doneAt: '2026-08-29T09:00:00.000Z',
			createdAt: 1_724_000_000_000,
		},
	],
	folders: [{ id: 'folder-a', name: '大学', emoji: '📚', color: '#64b5f6', futureFolderField: 7 }],
	events: [{
		id: 'local-event-a',
		title: '公開予定',
		emoji: '⭐',
		date: '2026-09-02',
		dateEnd: '2026-09-02',
		timeStart: '14:00',
		timeEnd: '15:00',
		color: '#e27d60',
		visibility: 'public',
		rsvp: true,
		notify: true,
		notifyTimings: ['15分前'],
		allDay: false,
		futureEventField: { audience: 'class' },
	}],
} satisfies HataskPlannerRawData;

describe('Hatask planner model', () => {
	test('旧フィールドを維持して新機能の既定値を補い、未知フィールドを階層ごと保持する', () => {
		const raw: HataskPlannerRawData = {
			todos: [{
				id: 'todo-modern',
				text: '繰返し課題',
				done: false,
				priority: 'high',
				position: 12.5,
				archivedAt: null,
				futureTodoField: { pinnedBy: 'future-client' },
				subtasks: [{ id: 'sub-a', text: '資料を読む', done: true, createdAt: 123, futureSubtaskField: 'keep' }],
				recurrence: { frequency: 'weekly', interval: 2, weekdays: [1, 4], until: '2026-12-31', count: 8, futureRule: 'keep' },
			}],
			folders: [{ id: 'folder-modern', name: '継続', position: 3, archivedAt: null, futureFolderField: true }],
			events: [{
				id: 'client-event-a',
				title: '連携予定',
				date: '2026-09-03',
				visibility: 'public',
				rsvp: false,
				notify: false,
				notifyTimings: [],
				allDay: true,
				archivedAt: null,
				clientEventId: 'client-event-a',
				serverEventId: 'server-event-z',
				recurrence: { frequency: 'yearly', interval: 1, futureRule: 'keep' },
				futureEventField: ['keep'],
			}],
		};

		const normalized = normalizeHataskPlannerData(raw);

		expect(normalized.issues).toEqual([]);
		expect(normalized.data.todos[0]).toMatchObject({
			id: 'todo-modern', priority: 'high', position: 12.5, archivedAt: null,
			futureTodoField: { pinnedBy: 'future-client' },
		});
		expect(normalized.data.todos[0].subtasks[0]).toMatchObject({ futureSubtaskField: 'keep' });
		expect(normalized.data.todos[0].recurrence).toMatchObject({
			frequency: 'weekly', interval: 2, weekdays: [1, 4], until: '2026-12-31', count: 8, futureRule: 'keep',
		});
		expect(normalized.data.folders[0]).toMatchObject({ futureFolderField: true });
		expect(normalized.data.events[0]).toMatchObject({
			clientEventId: 'client-event-a', serverEventId: 'server-event-z', futureEventField: ['keep'],
		});
		expect(normalized.data.events[0].recurrence).toMatchObject({ frequency: 'yearly', interval: 1, futureRule: 'keep' });
	});

	test.each(['none', 'daily', 'weekly', 'monthly', 'yearly'] as const)('%s の繰返し形式を正規化できる', frequency => {
		const recurrence = frequency === 'weekly'
			? { frequency, interval: 1, weekdays: [0, 3, 6] }
			: { frequency, interval: 1 };
		const normalized = normalizeHataskPlannerData({
			todos: [{ id: `todo-${frequency}`, text: '予定', done: false, recurrence }],
			folders: [],
			events: [],
		});
		expect(normalized.issues).toEqual([]);
		expect(normalized.data.todos[0].recurrence).toMatchObject(recurrence);
	});
});

describe('Hatask planner integrity positive controls', () => {
	const normalized = normalizeHataskPlannerData(legacyData);
	const expected = createHataskPlannerIntegrity(normalized.data);

	test('1件欠落を件数・ID列・完全hashの全てで検出する', () => {
		const missingOne = clone(legacyData);
		missingOne.todos = missingOne.todos.slice(0, -1);

		const result = verifyHataskPlannerIntegrity(expected, missingOne);

		expect(result.ok).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ collection: 'todos', kind: 'count' }),
			expect.objectContaining({ collection: 'todos', kind: 'ids' }),
			expect.objectContaining({ collection: 'todos', kind: 'collection-hash' }),
			expect.objectContaining({ kind: 'full-hash' }),
		]));
	});

	test('同数への重複差し替えでも重複ID・ID列・完全hashで検出する', () => {
		const duplicated = clone(legacyData);
		duplicated.todos = [clone(duplicated.todos[0]), clone(duplicated.todos[0])];

		const result = verifyHataskPlannerIntegrity(expected, duplicated);

		expect(result.ok).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ collection: 'todos', kind: 'normalization' }),
			expect.objectContaining({ collection: 'todos', kind: 'duplicate-ids' }),
			expect.objectContaining({ collection: 'todos', kind: 'ids' }),
			expect.objectContaining({ kind: 'full-hash' }),
		]));
		expect(result.issues).not.toContainEqual(expect.objectContaining({ collection: 'todos', kind: 'count' }));
	});

	test('公開予定から非公開予定への1フィールド変異を完全hashで検出する', () => {
		const visibilityChanged = clone(legacyData);
		visibilityChanged.events[0].visibility = 'private';

		const result = verifyHataskPlannerIntegrity(expected, visibilityChanged);

		expect(result.ok).toBe(false);
		expect(result.issues).toEqual(expect.arrayContaining([
			expect.objectContaining({ collection: 'events', kind: 'collection-hash' }),
			expect.objectContaining({ kind: 'full-hash' }),
		]));
		expect(result.issues).not.toContainEqual(expect.objectContaining({ collection: 'events', kind: 'count' }));
		expect(result.issues).not.toContainEqual(expect.objectContaining({ collection: 'events', kind: 'ids' }));
	});
});

describe('Hatask planner migration safety', () => {
	test('missing と読込失敗を区別し、1キーでも失敗したら全書込を止める', async () => {
		const port = new MemoryPlannerPort({ todos: legacyData.todos });
		port.failedReads.set('events', new Error('temporary network failure'));

		const reads = await readHataskPlannerStorage(port);
		expect(reads.collections.todos.status).toBe('loaded');
		expect(reads.collections.folders.status).toBe('missing');
		expect(reads.collections.events.status).toBe('failed');
		expect(reads.shadow.status).toBe('missing');

		const result = await migrateHataskPlannerStorage(port, { now: new Date('2026-08-30T00:00:00.000Z') });
		expect(result.status).toBe('blocked');
		expect(result.issues).toEqual([expect.objectContaining({ key: 'events', code: 'load-failed' })]);
		expect(result.writtenKeys).toEqual([]);
		expect(port.writes).toEqual([]);
	});

	test('影バックアップを先に再読込検証し、旧キーを残したまま一度だけ移行する', async () => {
		const port = new MemoryPlannerPort(legacyData);

		const first = await migrateHataskPlannerStorage(port, { now: new Date('2026-08-30T00:00:00.000Z') });

		expect(first.status).toBe('migrated');
		expect(first.writtenKeys).toEqual([HATASK_PLANNER_SHADOW_KEY, 'todos', 'folders', 'events']);
		expect(port.batchCalls).toHaveLength(1);
		expect(port.batchCalls[0].map(write => write.key)).toEqual(['todos', 'folders', 'events']);
		expect(port.values.has('todos')).toBe(true);
		expect(port.values.has('folders')).toBe(true);
		expect(port.values.has('events')).toBe(true);
		const snapshot = port.values.get(HATASK_PLANNER_SHADOW_KEY) as {
			createdAt: string;
			source: { todos: { status: string; value: Array<Record<string, unknown>> } };
		};
		expect(snapshot.createdAt).toBe('2026-08-30T00:00:00.000Z');
		expect(snapshot.source.todos.status).toBe('loaded');
		expect(snapshot.source.todos.value).toHaveLength(2);
		expect(snapshot.source.todos.value[0]).toMatchObject({
			id: 'todo-a',
			comment: '消してはいけないメモ',
			futureTodoField: { color: 'violet' },
		});
		expect(snapshot.source.todos.value[0]).not.toHaveProperty('priority');

		const migratedTodos = port.values.get('todos') as Array<Record<string, unknown>>;
		expect(migratedTodos[0]).toMatchObject({
			id: 'todo-a', priority: 'none', subtasks: [], position: 0, archivedAt: null,
			futureTodoField: { color: 'violet' },
		});
		const todoWrite = port.writes.find(write => write.key === 'todos');
		expect(todoWrite?.expectedRevision).toBe(1);

		const writeCount = port.writes.length;
		const second = await migrateHataskPlannerStorage(port, { now: new Date('2026-08-31T00:00:00.000Z') });
		expect(second.status).toBe('noop');
		expect(second.writtenKeys).toEqual([]);
		expect(port.writes).toHaveLength(writeCount);
		expect((port.values.get(HATASK_PLANNER_SHADOW_KEY) as { createdAt: string }).createdAt).toBe('2026-08-30T00:00:00.000Z');
	});

	test('影バックアップの再読込で1件欠落したら本体キーへ進まない', async () => {
		const port = new MemoryPlannerPort(legacyData);
		port.corruptShadowAfterWrite = true;

		const result = await migrateHataskPlannerStorage(port, { now: new Date('2026-08-30T00:00:00.000Z') });

		expect(result.status).toBe('failed');
		expect(result.stage).toBe('shadow-verify');
		expect(result.writtenKeys).toEqual([HATASK_PLANNER_SHADOW_KEY]);
		expect(port.writes.map(write => write.key)).toEqual([HATASK_PLANNER_SHADOW_KEY]);
		expect(port.values.get('todos')).toEqual(legacyData.todos);
	});

	test('serverがrawRowsを付加したshadowも論理原本とhashを再検証して受け入れる', async () => {
		const port = new MemoryPlannerPort(legacyData);
		port.enrichShadowAfterWrite = true;

		const result = await migrateHataskPlannerStorage(port, { now: new Date('2026-08-30T00:00:00.000Z') });

		expect(result.status).toBe('migrated');
		const shadow = port.values.get(HATASK_PLANNER_SHADOW_KEY) as {
			source: { todos: { rawRows?: unknown[]; rawHash?: string } };
		};
		expect(shadow.source.todos.rawRows).toHaveLength(1);
		expect(shadow.source.todos.rawHash).toBe('a'.repeat(64));
	});
});
