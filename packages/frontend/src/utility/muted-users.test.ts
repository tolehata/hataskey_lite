/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	api: vi.fn(),
}));

vi.mock('@/utility/misskey-api.js', () => ({
	misskeyApi: mocks.api,
}));

vi.mock('@/i.js', () => ({
	$i: { id: 'me' },
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

const muting = (userId: string, options: { expiresAt?: string | null; moderator?: boolean; administrator?: boolean } = {}) => ({
	id: `mute-${userId}`,
	createdAt: new Date().toISOString(),
	expiresAt: options.expiresAt ?? null,
	muteeId: userId,
	mutee: {
		id: userId,
		roles: options.moderator || options.administrator
			? [{ isAdministrator: options.administrator === true, isModerator: options.moderator === true }]
			: [],
	},
});

describe('ミュート利用者の共有キャッシュ', () => {
	beforeEach(() => {
		vi.useRealTimers();
		vi.resetModules();
		mocks.api.mockReset();
	});

	test('モデレーターを含め、期限切れと管理者を除外し、期限到達時に表示世代を更新する', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-13T00:00:00Z'));
		mocks.api.mockResolvedValueOnce([
			muting('temporary', { expiresAt: '2026-08-13T00:00:02Z' }),
			muting('expired', { expiresAt: '2026-08-12T23:59:59Z' }),
			muting('moderator', { moderator: true }),
			muting('administrator', { administrator: true }),
			muting('administrator-moderator', { administrator: true, moderator: true }),
		]);
		const subject = await import('./muted-users.js');

		await subject.fetchMutedUsers();
		expect(subject.isMutedUser('temporary')).toBe(true);
		expect(subject.isMutedUser('expired')).toBe(false);
		expect(subject.isMutedUser('moderator')).toBe(true);
		expect(subject.isMutedUser('administrator')).toBe(false);
		expect(subject.isMutedUser('administrator-moderator')).toBe(false);
		const beforeExpiry = subject.mutedUsersRevision.value;

		await vi.advanceTimersByTimeAsync(2050);
		expect(subject.isMutedUser('temporary')).toBe(false);
		expect(subject.mutedUsersRevision.value).toBeGreaterThan(beforeExpiry);
		vi.useRealTimers();
	});

	test('無効化前の遅い応答が新しい一覧を上書きしない', async () => {
		const oldRequest = deferred<ReturnType<typeof muting>[]>();
		mocks.api
			.mockImplementationOnce(() => oldRequest.promise)
			.mockResolvedValueOnce([muting('new-user')]);
		const subject = await import('./muted-users.js');

		const oldFetch = subject.fetchMutedUsers();
		subject.invalidateMutedUsers();
		await subject.fetchMutedUsers(true);
		expect(subject.isMutedUser('new-user')).toBe(true);

		oldRequest.resolve([muting('old-user')]);
		await oldFetch;
		expect(subject.isMutedUser('new-user')).toBe(true);
		expect(subject.isMutedUser('old-user')).toBe(false);
	});

	test('一時失敗では直前の一覧を保持し、上限付き再試行で回復する', async () => {
		vi.useFakeTimers();
		mocks.api
			.mockResolvedValueOnce([muting('kept-user')])
			.mockRejectedValueOnce(new Error('network'))
			.mockResolvedValueOnce([muting('refreshed-user')]);
		const subject = await import('./muted-users.js');

		await subject.fetchMutedUsers();
		await subject.fetchMutedUsers(true);
		expect(subject.isMutedUser('kept-user')).toBe(true);

		await vi.advanceTimersByTimeAsync(1500);
		await vi.waitFor(() => expect(subject.isMutedUser('refreshed-user')).toBe(true));
		expect(subject.isMutedUser('kept-user')).toBe(false);
		expect(mocks.api).toHaveBeenCalledTimes(3);
		vi.useRealTimers();
	});

	test('mute操作成功を再読込なしで共有一覧へ反映する', async () => {
		mocks.api.mockResolvedValueOnce([muting('existing-user')]);
		const subject = await import('./muted-users.js');
		await subject.fetchMutedUsers();

		subject.updateMutedUserState('new-user', true);
		subject.updateMutedUserState('existing-user', false);

		expect(subject.isMutedUser('new-user')).toBe(true);
		expect(subject.isMutedUser('existing-user')).toBe(false);
	});

	test('モデレーターはmute直後と再取得後もリアクション非表示対象に含め、解除を反映する', async () => {
		mocks.api.mockResolvedValueOnce([]);
		const subject = await import('./muted-users.js');
		await subject.fetchMutedUsers();

		subject.updateMutedUserState('moderator', true, null, false);
		expect(subject.isMutedUser('moderator')).toBe(true);

		mocks.api.mockResolvedValueOnce([muting('moderator', { moderator: true })]);
		await subject.fetchMutedUsers(true);
		expect(subject.isMutedUser('moderator')).toBe(true);

		subject.updateMutedUserState('moderator', false);
		expect(subject.isMutedUser('moderator')).toBe(false);
	});

	test('管理者は直接の更新でもリアクション非表示対象に追加しない', async () => {
		mocks.api.mockResolvedValueOnce([]);
		const subject = await import('./muted-users.js');
		await subject.fetchMutedUsers();

		subject.updateMutedUserState('administrator', true, null, true);

		expect(subject.isMutedUser('administrator')).toBe(false);
	});

	test('非同期インポート後の複数時点で一覧を強制再取得する', async () => {
		vi.useFakeTimers();
		mocks.api.mockResolvedValue([]);
		const subject = await import('./muted-users.js');

		subject.refreshMutedUsers([100, 300]);
		expect(mocks.api).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(100);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(1));
		await vi.advanceTimersByTimeAsync(200);
		await vi.waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
		vi.useRealTimers();
	});
});
