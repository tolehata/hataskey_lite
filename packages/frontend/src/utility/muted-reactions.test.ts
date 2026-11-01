/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	api: vi.fn(),
	ready: true,
	hasMuted: true,
	revision: { value: 1 },
	mutedIds: new Set(['muted-user']),
}));

vi.mock('@/utility/misskey-api.js', () => ({
	misskeyApi: mocks.api,
}));

vi.mock('@/utility/muted-users.js', () => ({
	hasMutedUsers: () => mocks.hasMuted,
	isMutedUser: (userId: string) => mocks.mutedIds.has(userId),
	isMutedUsersReady: () => mocks.ready,
	mutedUsersRevision: mocks.revision,
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const reaction = (userId: string, type: string) => ({
	id: `${userId}-${type}`,
	type,
	user: { id: userId },
});
const numberedReaction = (id: number, userId = `user-${id}`, type = ':wave:') => ({
	id: String(id).padStart(4, '0'),
	type,
	user: { id: userId },
});

describe('ミュートユーザーのリアクション表示キャッシュ', () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.api.mockReset();
		mocks.ready = true;
		mocks.hasMuted = true;
		mocks.revision.value = 1;
		mocks.mutedIds = new Set(['muted-user']);
	});

	test('ミュートした利用者の件数だけをリアクション別に集計する', async () => {
		mocks.mutedIds.add('muted-user-2');
		mocks.api.mockResolvedValueOnce([
			reaction('muted-user', ':wave:'),
			reaction('visible-user', ':wave:'),
			reaction('muted-user-2', ':star:'),
		]);
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 3);

		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 3)).toEqual({
			delta: { ':wave:': 1, ':star:': 1 },
			hidden: 2,
			truncated: false,
		}));
	});

	test('通信結果が逆順に届いても古い件数で最新キャッシュを上書きしない', async () => {
		const older = deferred<unknown[]>();
		const newer = deferred<unknown[]>();
		mocks.api
			.mockImplementationOnce(() => older.promise)
			.mockImplementationOnce(() => newer.promise);
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 1);
		subject.requestMutedReactions('note-1', 2);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));

		newer.resolve([reaction('muted-user', ':new:')]);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 2)?.delta).toEqual({ ':new:': 1 }));

		older.resolve([]);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 2)?.delta).toEqual({ ':new:': 1 }));
		expect(subject.getMutedReactions('note-1', 1)).toBeUndefined();
	});

	test('取得失敗は空の確定結果にして同じ鍵で再要求を繰り返さない', async () => {
		vi.useFakeTimers();
		mocks.api.mockRejectedValue(new Error('network'));
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 1);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
		expect(subject.getMutedReactions('note-1', 1)).toBeUndefined();

		await vi.advanceTimersByTimeAsync(1500);
		subject.requestMutedReactions('note-1', 1);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		expect(subject.getMutedReactions('note-1', 1)).toBeUndefined();

		await vi.advanceTimersByTimeAsync(5000);
		subject.requestMutedReactions('note-1', 1);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 1)).toEqual({
			delta: {},
			hidden: 0,
			truncated: false,
		}));
		expect(mocks.api).toHaveBeenCalledTimes(3);
		vi.useRealTimers();
	});

	test('ミュート対象が0人なら通信せず空の確定結果を返す', async () => {
		mocks.hasMuted = false;
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 4);

		expect(subject.getMutedReactions('note-1', 4)).toEqual({
			delta: {},
			hidden: 0,
			truncated: false,
		});
		expect(mocks.api).not.toHaveBeenCalled();
	});

	test('ミュート一覧の世代が変わると同じリアクション数でも再取得する', async () => {
		mocks.api.mockResolvedValue([]);
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 2);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 2)).toBeDefined());
		mocks.revision.value++;
		expect(subject.getMutedReactions('note-1', 2)).toBeUndefined();

		subject.requestMutedReactions('note-1', 2);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
	});

	test('総数が同じ値へ戻ってもstream更新世代で古いリアクターを再利用しない', async () => {
		mocks.api
			.mockResolvedValueOnce([reaction('muted-user', ':old:')])
			.mockResolvedValueOnce([reaction('muted-user', ':new:')]);
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 1);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 1)?.delta).toEqual({ ':old:': 1 }));

		subject.notifyMutedReactionSourceChanged('note-1');
		subject.requestMutedReactions('note-1', 1);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 1)?.delta).toEqual({ ':new:': 1 }));

		expect(mocks.api).toHaveBeenCalledTimes(2);
		expect(mocks.api).toHaveBeenNthCalledWith(2, 'notes/reactions', { noteId: 'note-1', limit: 100 });
	});

	test('polling集計は総数が同じでもリアクション種別の入れ替わりを検出する', async () => {
		const subject = await import('./muted-reactions.js');

		expect(subject.reactionCountsChanged({ ':old:': 1 }, { ':new:': 1 })).toBe(true);
		expect(subject.reactionCountsChanged({ ':same:': 2 }, { ':same:': 2 })).toBe(false);
	});

	test('pollingは同種同数の別actorも60秒ごとに再照合する', async () => {
		const subject = await import('./muted-reactions.js');

		expect(subject.shouldRevalidateMutedReactionActors('note-1', 100_000)).toBe(true);
		expect(subject.shouldRevalidateMutedReactionActors('note-1', 159_999)).toBe(false);
		expect(subject.shouldRevalidateMutedReactionActors('note-1', 160_000)).toBe(true);
	});

	test('別ノートの完了通知では失敗ノートの再試行待機を早送りしない', async () => {
		vi.useFakeTimers();
		mocks.api.mockImplementation((_endpoint, params) => params.noteId === 'failed-note'
			? Promise.reject(new Error('network'))
			: Promise.resolve([]));
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('failed-note', 1);
		subject.requestMutedReactions('successful-note', 1);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));

		// successful-noteの完了でglobal revisionが変わった想定で再評価しても待機中は通信しない。
		subject.requestMutedReactions('failed-note', 1);
		await vi.advanceTimersByTimeAsync(1499);
		subject.requestMutedReactions('failed-note', 1);
		expect(mocks.api).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(1);
		subject.requestMutedReactions('failed-note', 1);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(3));
		vi.useRealTimers();
	});

	test('100件超はuntilIdで総数まで取得し、全ページ完了前に公開しない', async () => {
		const second = deferred<unknown[]>();
		const firstPage = Array.from({ length: 100 }, (_, i) => numberedReaction(201 - i));
		mocks.mutedIds = new Set(['user-201', 'user-1']);
		mocks.api.mockResolvedValueOnce(firstPage).mockImplementationOnce(() => second.promise);
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 201);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		expect(mocks.api).toHaveBeenNthCalledWith(1, 'notes/reactions', { noteId: 'note-1', limit: 100 });
		expect(mocks.api).toHaveBeenNthCalledWith(2, 'notes/reactions', { noteId: 'note-1', limit: 100, untilId: '0102' });
		expect(subject.getMutedReactions('note-1', 201)).toBeUndefined();

		mocks.api.mockResolvedValueOnce([numberedReaction(1)]);
		second.resolve(Array.from({ length: 100 }, (_, i) => numberedReaction(101 - i)));
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(3));
		expect(mocks.api).toHaveBeenNthCalledWith(3, 'notes/reactions', { noteId: 'note-1', limit: 100, untilId: '0002' });
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 201)).toEqual({
			delta: { ':wave:': 2 }, hidden: 2, truncated: false,
		}));
	});

	test('snapshot総数より短いページでも実rowsを取りきれば差分を確定する', async () => {
		mocks.api.mockResolvedValueOnce([
			numberedReaction(3, 'muted-user'),
			numberedReaction(2, 'visible-user'),
		]);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 101);

		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 101)).toEqual({
			delta: { ':wave:': 1 }, hidden: 1, truncated: false,
		}));
		expect(mocks.api).toHaveBeenCalledTimes(1);
	});

	test('総数100件に達したら空ページを追加取得しない', async () => {
		const page = Array.from({ length: 100 }, (_, i) => numberedReaction(100 - i));
		mocks.mutedIds = new Set(['user-1']);
		mocks.api.mockResolvedValueOnce(page);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 100);

		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 100)?.hidden).toBe(1));
		expect(mocks.api).toHaveBeenCalledTimes(1);
	});

	test('100件の後の空ページは正常終端として確定する', async () => {
		const lastPage = deferred<unknown[]>();
		const page = Array.from({ length: 100 }, (_, i) => numberedReaction(100 - i));
		mocks.mutedIds = new Set(['user-100']);
		mocks.api.mockResolvedValueOnce(page).mockImplementationOnce(() => lastPage.promise);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 150);

		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		expect(mocks.api).toHaveBeenNthCalledWith(2, 'notes/reactions', { noteId: 'note-1', limit: 100, untilId: '0001' });
		expect(subject.getMutedReactions('note-1', 150)).toBeUndefined();
		lastPage.resolve([]);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 150)).toEqual({
			delta: { ':wave:': 1 }, hidden: 1, truncated: false,
		}));
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});

	test('重複したreactionとuserを二重に数えない', async () => {
		mocks.api.mockResolvedValueOnce([
			numberedReaction(3, 'muted-user'),
			numberedReaction(3, 'muted-user'),
			numberedReaction(2, 'muted-user'),
			numberedReaction(1, 'visible-user'),
		]);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 3);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 3)).toEqual({
			delta: { ':wave:': 1 }, hidden: 1, truncated: false,
		}));
	});

	test('重複ページでcursorが進まなければ追加通信や部分差分の確定をしない', async () => {
		const page = Array.from({ length: 100 }, (_, i) => numberedReaction(101 - i));
		mocks.api.mockResolvedValue(page);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 101);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		expect(subject.getMutedReactions('note-1', 101)).toBeUndefined();
		await Promise.resolve();
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});

	test('短い非空の重複ページは正常終端とみなさない', async () => {
		const page = Array.from({ length: 100 }, (_, i) => numberedReaction(101 - i));
		mocks.api.mockResolvedValueOnce(page).mockResolvedValueOnce([numberedReaction(2)]);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 101);

		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		expect(subject.getMutedReactions('note-1', 101)).toBeUndefined();
	});

	test('2ページ目の失敗時は部分差分を公開せず、次回は最初から再取得する', async () => {
		vi.useFakeTimers();
		const page = Array.from({ length: 100 }, (_, i) => numberedReaction(101 - i));
		mocks.mutedIds = new Set(['user-101', 'user-1']);
		mocks.api.mockResolvedValueOnce(page).mockRejectedValueOnce(new Error('network'))
			.mockResolvedValueOnce(page).mockResolvedValueOnce([numberedReaction(1)]);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 101);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		expect(subject.getMutedReactions('note-1', 101)).toBeUndefined();

		await vi.advanceTimersByTimeAsync(1500);
		subject.requestMutedReactions('note-1', 101);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 101)?.hidden).toBe(2));
		expect(mocks.api).toHaveBeenNthCalledWith(3, 'notes/reactions', { noteId: 'note-1', limit: 100 });
		vi.useRealTimers();
	});

	test('ページ待機中にnoteが変わったら旧取得を打ち切る', async () => {
		const second = deferred<unknown[]>();
		const page = Array.from({ length: 100 }, (_, i) => numberedReaction(101 - i));
		mocks.api.mockResolvedValueOnce(page).mockImplementationOnce(() => second.promise)
			.mockResolvedValueOnce([reaction('muted-user', ':new:')]);
		const subject = await import('./muted-reactions.js');
		subject.requestMutedReactions('note-1', 101);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		subject.notifyMutedReactionSourceChanged('note-1');
		subject.requestMutedReactions('note-1', 1);
		second.resolve([numberedReaction(1)]);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 1)?.delta).toEqual({ ':new:': 1 }));
		expect(mocks.api).toHaveBeenCalledTimes(3);
		expect(subject.getMutedReactions('note-1', 101)).toBeUndefined();
	});

	test('設定の無効化後は同じ鍵の新取得を旧取得のcleanupが解除しない', async () => {
		const oldSecond = deferred<unknown[]>();
		const newFirst = deferred<unknown[]>();
		const page = Array.from({ length: 100 }, (_, i) => numberedReaction(101 - i));
		mocks.api.mockResolvedValueOnce(page).mockImplementationOnce(() => oldSecond.promise)
			.mockImplementationOnce(() => newFirst.promise).mockResolvedValueOnce([numberedReaction(1)]);
		const subject = await import('./muted-reactions.js');

		subject.requestMutedReactions('note-1', 101);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		subject.invalidateMutedReactions();
		subject.requestMutedReactions('note-1', 101);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(3));
		oldSecond.resolve([numberedReaction(1)]);
		await oldSecond.promise;
		await Promise.resolve();
		await Promise.resolve();
		expect(subject.getMutedReactions('note-1', 101)).toBeUndefined();
		subject.requestMutedReactions('note-1', 101);
		expect(mocks.api).toHaveBeenCalledTimes(3);

		newFirst.resolve(page);
		await vi.waitFor(() => expect(subject.getMutedReactions('note-1', 101)?.hidden).toBe(0));
		expect(mocks.api).toHaveBeenCalledTimes(4);
	});
});
