/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { moderationDateBounds, useHatadyModeration } from './hatady-moderation.js';
import type { ModerationApi, ModerationDetail, ModerationEntry, ModerationPage } from './hatady-moderation.js';

const fixtures = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: fixtures.notify }));

function entry(id: string, changes: Partial<ModerationEntry> = {}): ModerationEntry {
	return {
		key: `log:${id}`, targetType: 'log', targetId: id, category: 'record', activity: 'study',
		actor: { id: 'author', username: 'author', name: 'はる', host: null } as ModerationEntry['actor'],
		title: `記録 ${id}`, body: '全文', createdAt: '2026-09-16T12:00:00.000Z', visibility: 'private',
		emoji: null, parentKey: null, contentVersion: 'a'.repeat(32),
		review: { state: 'unreviewed', note: '保存済み', revision: 0, reviewer: null, reviewedAt: null, stale: false }, ...changes,
	};
}

function detail(item: ModerationEntry): ModerationDetail {
	return { item, fields: [{ label: '内容', value: item.body }], ancestors: [], related: [], relatedHasMore: false };
}

function page(items: ModerationEntry[], nextCursor: string | null = null): ModerationPage {
	return { items, nextCursor, total: items.length, counts: { unreviewed: items.length, flagged: 0, reviewed: 0 } };
}

function pending<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
	return { promise, resolve, reject };
}

const cleanups: Array<() => void> = [];

function setup(owner: string | null = 'staff') {
	const api = {
		list: vi.fn<ModerationApi['list']>().mockResolvedValue(page([entry('a'), entry('b')])),
		show: vi.fn<ModerationApi['show']>().mockImplementation(async target => detail(entry(target.targetId))),
		review: vi.fn<ModerationApi['review']>(),
	};
	const access = ref(owner), scope = effectScope();
	const model = scope.run(() => useHatadyModeration(access, api))!;
	cleanups.push(() => scope.stop());
	return { api, access, model, stop: () => scope.stop() };
}

async function settle() { await Promise.resolve(); await nextTick(); await Promise.resolve(); }

async function initial() { await vi.advanceTimersByTimeAsync(0); await settle(); }

beforeEach(() => { vi.useFakeTimers(); fixtures.notify.mockReset(); });
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.useRealTimers(); });

describe('Hatady moderation controller', () => {
	test('staff access is required, and revocation cancels pending work and clears private data', async () => {
		const view = setup(null);
		await initial();
		expect(view.api.list).not.toHaveBeenCalled();
		view.access.value = 'staff';
		await initial();
		expect(view.model.detail.value?.item.key).toBe('log:a');
		view.model.note.value = '未保存の管理メモ';
		const response = pending<ModerationPage>();
		view.api.list.mockReturnValueOnce(response.promise);
		const request = view.model.load();
		const signal = view.api.list.mock.lastCall![1];
		view.access.value = null;
		expect(signal.aborted).toBe(true);
		response.resolve(page([entry('private')]));
		await request;
		expect(view.model.items.value).toEqual([]);
		expect(view.model.detail.value).toBeNull();
		expect(view.model.note.value).toBe('');
		expect(view.model.counts.value.unreviewed).toBe(0);
	});

	test.each(['resolve', 'reject'] as const)('a stale search %s cannot replace the next query during its debounce', async outcome => {
		const view = setup();
		const old = pending<ModerationPage>();
		view.api.list.mockReturnValueOnce(old.promise);
		await initial();
		view.model.filters.query = '新しい内容';
		if (outcome === 'resolve') old.resolve(page([entry('old')]));
		else old.reject(new Error('old failed'));
		await settle();
		expect(view.model.items.value).toEqual([]);
		expect(view.model.error.value).toBe('');
		expect(view.model.loading.value).toBe(true);
		await vi.advanceTimersByTimeAsync(299);
		expect(view.api.list).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(view.api.list.mock.lastCall![0].query).toBe('新しい内容');
		expect(view.model.items.value.map(item => item.key)).toEqual(['log:a', 'log:b']);
	});

	test('combined filters and stable cursor navigation are sent together; changing filters resets the cursor', async () => {
		const view = setup();
		view.api.list.mockResolvedValueOnce(page([entry('a')], 'next-page'));
		await initial();
		view.model.movePage(1);
		await settle();
		expect(view.api.list.mock.lastCall![0].cursor).toBe('next-page');
		view.model.movePage(-1);
		await settle();
		expect(view.api.list.mock.lastCall![0].cursor).toBeUndefined();
		Object.assign(view.model.filters, { category: 'reaction', status: 'flagged', activity: 'game', visibility: 'private', sort: 'asc', from: '2026-09-01', to: '2026-09-16', query: '検索' });
		await vi.advanceTimersByTimeAsync(300);
		expect(view.api.list.mock.lastCall![0]).toEqual({ limit: 30, cursor: undefined, category: 'reaction', status: 'flagged', activity: 'game', visibility: 'private', sort: 'asc', query: '検索', ...moderationDateBounds('2026-09-01', '2026-09-16') });
		expect(view.model.page.value).toBe(0);
	});

	test('invalid date order makes no request and the corrected range recovers', async () => {
		const view = setup();
		await initial();
		const before = view.api.list.mock.calls.length;
		view.model.filters.from = '2026-09-17';
		view.model.filters.to = '2026-09-16';
		await initial();
		expect(view.api.list).toHaveBeenCalledTimes(before);
		expect(view.model.dateError.value).toBe(true);
		expect(view.model.loading.value).toBe(false);
		view.model.filters.to = '2026-09-18';
		await initial();
		expect(view.api.list).toHaveBeenCalledTimes(before + 1);
	});

	test('a late detail cannot replace a new selection and note drafts survive selection and filter changes', async () => {
		const view = setup();
		await initial();
		view.model.note.value = 'A の書きかけ';
		const response = pending<ModerationDetail>();
		view.api.show.mockReturnValueOnce(response.promise);
		const old = view.model.select(entry('b'));
		await view.model.select(entry('a'));
		response.resolve(detail(entry('b')));
		await old;
		expect(view.model.detail.value?.item.key).toBe('log:a');
		expect(view.model.note.value).toBe('A の書きかけ');
		view.model.filters.category = 'comment';
		await initial();
		expect(view.model.note.value).toBe('A の書きかけ');
	});

	test('a review conflict reloads current content while preserving the exact note for a revision-checked retry', async () => {
		const view = setup();
		await initial();
		view.model.note.value = '自分の\n確認メモ';
		view.api.review.mockRejectedValueOnce({ code: 'REVIEW_CONFLICT' });
		const latest = entry('a', { contentVersion: 'b'.repeat(32), review: { ...entry('a').review, revision: 3, note: '別の担当者', stale: true } });
		view.api.show.mockResolvedValueOnce(detail(latest));
		await view.model.save('reviewed');
		expect(view.model.note.value).toBe('自分の\n確認メモ');
		expect(view.model.detail.value?.item.review.revision).toBe(3);
		expect(view.model.saveError.value).toContain('入力メモは残っています');
		view.api.review.mockResolvedValueOnce(detail({ ...latest, review: { ...latest.review, state: 'reviewed', revision: 4, note: '自分の\n確認メモ', stale: false } }));
		await view.model.save('reviewed');
		expect(view.api.review.mock.lastCall![0]).toMatchObject({ targetType: 'log', targetId: 'a', expectedRevision: 3, expectedContentVersion: 'b'.repeat(32), note: '自分の\n確認メモ', state: 'reviewed' });
		expect(view.model.saveError.value).toBe('');
		expect(fixtures.notify).toHaveBeenCalledOnce();
	});

	test('save failure keeps the input, duplicate saves are ignored, and success does not discard later editing', async () => {
		const view = setup();
		await initial();
		view.model.note.value = '最初のメモ';
		view.api.review.mockRejectedValueOnce(new Error('offline'));
		await view.model.save('flagged');
		expect(view.model.note.value).toBe('最初のメモ');
		expect(view.model.saveError.value).toContain('保存できません');
		const response = pending<ModerationDetail>();
		view.api.review.mockReturnValueOnce(response.promise);
		const saving = view.model.save('flagged');
		await view.model.save('reviewed');
		expect(view.api.review).toHaveBeenCalledTimes(2);
		view.model.note.value = '保存リクエスト後の追記';
		response.resolve(detail({ ...entry('a'), review: { ...entry('a').review, state: 'flagged', note: '最初のメモ', revision: 1 } }));
		await saving;
		expect(view.model.note.value).toBe('保存リクエスト後の追記');
	});

	test('oversized input is not saved and disposal suppresses late data and notices', async () => {
		const view = setup();
		await initial();
		view.model.note.value = 'あ'.repeat(1001);
		await view.model.save('reviewed');
		expect(view.api.review).not.toHaveBeenCalled();
		view.model.note.value = 'メモ';
		const response = pending<ModerationDetail>();
		view.api.review.mockReturnValueOnce(response.promise);
		const saving = view.model.save('reviewed');
		view.stop();
		response.resolve(detail(entry('late')));
		await saving;
		expect(view.model.detail.value?.item.key).toBe('log:a');
		expect(fixtures.notify).not.toHaveBeenCalled();
	});

	test('an in-flight show for the same target cannot overwrite a completed review', async () => {
		const view = setup();
		await initial();
		view.model.note.value = '保存するメモ';
		const review = pending<ModerationDetail>(), oldShow = pending<ModerationDetail>();
		view.api.review.mockReturnValueOnce(review.promise);
		const saving = view.model.save('reviewed');
		view.api.show.mockReturnValueOnce(oldShow.promise);
		const refreshing = view.model.select(entry('a'));
		const saved = entry('a', { review: { ...entry('a').review, state: 'reviewed', note: '保存するメモ', revision: 1 } });
		review.resolve(detail(saved));
		await saving;
		expect(view.api.show.mock.lastCall![1].aborted).toBe(true);
		oldShow.resolve(detail(entry('a')));
		await refreshing;
		expect(view.model.detail.value?.item.review).toMatchObject({ state: 'reviewed', revision: 1, note: '保存するメモ' });
	});

	test('an empty reload invalidates an earlier detail request', async () => {
		const view = setup();
		const oldShow = pending<ModerationDetail>();
		view.api.show.mockReturnValueOnce(oldShow.promise);
		await initial();
		view.api.list.mockResolvedValueOnce(page([]));
		await view.model.load();
		oldShow.resolve(detail(entry('a')));
		await settle();
		expect(view.model.items.value).toEqual([]);
		expect(view.model.detail.value).toBeNull();
		expect(view.model.detailLoading.value).toBe(false);
	});

	test('revocation and regrant to the same account cannot apply an old save or release the new save lock', async () => {
		const view = setup();
		await initial();
		const oldResponse = pending<ModerationDetail>(), newResponse = pending<ModerationDetail>();
		view.model.note.value = '以前の権限でのメモ';
		view.api.review.mockReturnValueOnce(oldResponse.promise);
		const oldSave = view.model.save('flagged');
		view.access.value = null;
		view.access.value = 'staff';
		await initial();
		view.model.note.value = '現在のメモ';
		view.api.review.mockReturnValueOnce(newResponse.promise);
		const newSave = view.model.save('reviewed');
		oldResponse.resolve(detail(entry('old')));
		await oldSave;
		expect(view.model.detail.value?.item.key).toBe('log:a');
		expect(view.model.note.value).toBe('現在のメモ');
		expect(view.model.saving.value).toBe(true);
		expect(fixtures.notify).not.toHaveBeenCalled();
		newResponse.resolve(detail({ ...entry('a'), review: { ...entry('a').review, note: '現在のメモ', state: 'reviewed' } }));
		await newSave;
		expect(view.model.saving.value).toBe(false);
		expect(fixtures.notify).toHaveBeenCalledOnce();
	});
});
