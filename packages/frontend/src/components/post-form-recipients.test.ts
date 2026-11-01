/* SPDX-License-Identifier: AGPL-3.0-only */

import { describe, expect, it, vi } from 'vitest';
import { createPostFormRecipients } from './post-form-recipients.js';
import type * as Misskey from 'cherrypick-js';

function user(id: string): Misskey.entities.UserDetailed {
	return { id, username: id, host: null } as Misskey.entities.UserDetailed;
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

describe('post form recipient hydration', () => {
	it('preserves the entire intended audience and blocks submission until it is loaded', async () => {
		const request = deferred<Misskey.entities.UserDetailed[]>();
		const fetchUsers = vi.fn(() => request.promise);
		const recipients = createPostFormRecipients(fetchUsers);
		const loading = recipients.load(['alice', 'bob', 'alice']);
		expect(recipients.ready.value).toBe(false);
		expect(recipients.loading.value).toBe(true);
		expect(recipients.userIds.value).toEqual(['alice', 'bob']);
		expect(fetchUsers).toHaveBeenCalledWith(['alice', 'bob']);
		request.resolve([user('bob'), user('alice')]);
		await loading;
		expect(recipients.ready.value).toBe(true);
		expect(recipients.users.value.map(u => u.id)).toEqual(['alice', 'bob']);
	});

	it('fails closed on network errors and lets the same audience be retried', async () => {
		const fetchUsers = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([user('alice')]);
		const recipients = createPostFormRecipients(fetchUsers);
		await recipients.load(['alice']);
		expect(recipients.failed.value).toBe(true);
		expect(recipients.ready.value).toBe(false);
		expect(recipients.userIds.value).toEqual(['alice']);
		await recipients.retry();
		expect(recipients.failed.value).toBe(false);
		expect(recipients.ready.value).toBe(true);
	});

	it('does not silently accept a successful but incomplete users/show response', async () => {
		const fetchUsers = vi.fn().mockResolvedValueOnce([user('alice')]).mockResolvedValueOnce([user('bob')]);
		const recipients = createPostFormRecipients(fetchUsers);
		await recipients.load(['alice', 'bob']);
		expect(recipients.failed.value).toBe(true);
		expect(recipients.userIds.value).toEqual(['alice', 'bob']);
		await recipients.retry();
		expect(fetchUsers).toHaveBeenLastCalledWith(['bob']);
		expect(recipients.ready.value).toBe(true);
	});

	it('lets the user explicitly discard unavailable IDs without silently narrowing the audience', async () => {
		const recipients = createPostFormRecipients(async () => [user('alice')]);
		await recipients.load(['alice', 'deleted']);
		expect(recipients.missingIds.value).toEqual(['deleted']);
		expect(recipients.userIds.value).toEqual(['alice', 'deleted']);
		expect(recipients.ready.value).toBe(false);
		recipients.remove('deleted');
		expect(recipients.ready.value).toBe(true);
		expect(recipients.userIds.value).toEqual(['alice']);
	});

	it('ignores an old response after a different draft replaces its audience', async () => {
		const oldRequest = deferred<Misskey.entities.UserDetailed[]>();
		const newRequest = deferred<Misskey.entities.UserDetailed[]>();
		const recipients = createPostFormRecipients(vi.fn().mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise));
		const oldLoad = recipients.load(['alice']);
		const newLoad = recipients.load(['bob']);
		oldRequest.resolve([user('alice')]);
		await oldLoad;
		expect(recipients.loading.value).toBe(true);
		expect(recipients.users.value).toEqual([]);
		newRequest.resolve([user('bob')]);
		await newLoad;
		expect(recipients.users.value.map(u => u.id)).toEqual(['bob']);
	});

	it('ignores an old failure after a newer audience has loaded', async () => {
		const oldRequest = deferred<Misskey.entities.UserDetailed[]>();
		const recipients = createPostFormRecipients(vi.fn().mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce([user('bob')]));
		const oldLoad = recipients.load(['alice']);
		await recipients.load(['bob']);
		oldRequest.reject(new Error('offline'));
		await oldLoad;
		expect(recipients.ready.value).toBe(true);
		expect(recipients.failed.value).toBe(false);
	});

	it('does not re-add a removed recipient and preserves recipients added during loading', async () => {
		const request = deferred<Misskey.entities.UserDetailed[]>();
		const recipients = createPostFormRecipients(() => request.promise);
		const loading = recipients.load(['alice', 'bob']);
		recipients.add(user('alice'));
		recipients.remove('alice');
		recipients.add(user('carol'));
		request.resolve([user('alice'), user('bob')]);
		await loading;
		expect(recipients.userIds.value).toEqual(['bob', 'carol']);
		expect(recipients.users.value.map(u => u.id)).toEqual(['bob', 'carol']);
	});

	it('invalidates pending requests when restored recipients are empty', async () => {
		const request = deferred<Misskey.entities.UserDetailed[]>();
		const recipients = createPostFormRecipients(() => request.promise);
		const loading = recipients.load(['alice']);
		await recipients.load([]);
		request.resolve([user('alice')]);
		await loading;
		expect(recipients.ready.value).toBe(true);
		expect(recipients.userIds.value).toEqual([]);
		expect(recipients.users.value).toEqual([]);
	});

	it('reuses known recipients without an unnecessary request', async () => {
		const fetchUsers = vi.fn();
		const recipients = createPostFormRecipients(fetchUsers);
		recipients.add(user('alice'));
		await recipients.load(['alice']);
		expect(recipients.ready.value).toBe(true);
		expect(fetchUsers).not.toHaveBeenCalled();
	});

	it('does not mutate recipient state after the form is disposed', async () => {
		const request = deferred<Misskey.entities.UserDetailed[]>();
		const recipients = createPostFormRecipients(() => request.promise);
		const loading = recipients.load(['alice']);
		recipients.dispose();
		request.resolve([user('alice')]);
		await loading;
		expect(recipients.users.value).toEqual([]);
	});

	it('invalidates a pending user selection when its draft changes or clears', async () => {
		const recipients = createPostFormRecipients(async () => []);
		const beforeLoad = recipients.selectionToken();
		await recipients.load([]);
		expect(recipients.isCurrentSelection(beforeLoad)).toBe(false);
		const beforeClear = recipients.selectionToken();
		recipients.invalidateSelection();
		expect(recipients.isCurrentSelection(beforeClear)).toBe(false);
	});
});
