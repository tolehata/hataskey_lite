/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { ApInboxService } from '@/core/activitypub/ApInboxService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';

function fixture() {
	const note = { id: 'note', userId: 'author' };
	const pack = vi.fn().mockResolvedValue(note);
	const publish = vi.fn();
	const unlock = vi.fn();
	const service = Object.assign(Object.create(ApInboxService.prototype), {
		utilityService: { isFederationAllowedUri: () => true },
		relayService: { getAcceptedRelays: async () => [{ inbox: 'https://relay.invalid/inbox' }] },
		appLockService: { getApLock: async () => unlock },
		apNoteService: { fetchNote: async () => null, resolveNote: async () => note },
		noteEntityService: { isVisibleForMe: async () => true, pack },
		globalEventService: { publishNotesStream: publish },
	}) as ApInboxService;
	const run = () => service['announceNote'](
		{ id: 'relay-actor', inbox: 'https://relay.invalid/inbox', isSuspended: false } as never,
		{ id: 'https://relay.invalid/announce', type: 'Announce' } as never,
		{ id: 'https://remote.invalid/notes/1', type: 'Note' } as never,
	);
	return { note, pack, publish, unlock, run };
}

describe('relay note stream packing', () => {
	test('skips an anonymously inaccessible private reference and releases the lock', async () => {
		const f = fixture();
		f.pack.mockRejectedValue(new PrivateChannelNoteVisibilityError());
		await expect(f.run()).resolves.toBe('skip: private channel note');
		expect(f.publish).not.toHaveBeenCalled();
		expect(f.unlock).toHaveBeenCalledOnce();
	});

	test('publishes an allowed note', async () => {
		const f = fixture();
		await f.run();
		expect(f.publish).toHaveBeenCalledWith(f.note);
		expect(f.unlock).toHaveBeenCalledOnce();
	});

	test('preserves retries for other packing failures', async () => {
		const f = fixture();
		f.pack.mockRejectedValue(new Error('database unavailable'));
		await expect(f.run()).rejects.toThrow('database unavailable');
		expect(f.publish).not.toHaveBeenCalled();
		expect(f.unlock).toHaveBeenCalledOnce();
	});
});
