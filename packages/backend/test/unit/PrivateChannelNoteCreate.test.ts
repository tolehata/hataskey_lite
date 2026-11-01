/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import type { MiNote } from '@/models/Note.js';

const user = { id: 'author', username: 'author', host: null, isBot: false, isCat: false };

describe('private channel note creation', () => {
	test('skips inaccessible mention recipients without aborting later notifications or webhooks', async () => {
		const packed = { id: 'note', text: 'private body' };
		const pack = vi.fn(async (_note: MiNote, recipient: { id: string }) => {
			if (recipient.id === 'outsider') throw new PrivateChannelNoteVisibilityError();
			return packed;
		});
		const publishMainStream = vi.fn();
		const enqueueUserWebhook = vi.fn();
		const push = vi.fn();
		const service = Object.assign(Object.create(NoteCreateService.prototype), {
			userEntityService: { isLocalUser: () => true },
			noteThreadMutingsRepository: { exists: async ({ where }: { where: { userId: string } }) => where.userId === 'muted' },
			noteEntityService: { pack }, globalEventService: { publishMainStream }, webhookService: { enqueueUserWebhook },
		}) as { createMentionedEvents: (users: { id: string }[], note: MiNote, notifications: { push: typeof push }) => Promise<void> };
		await service.createMentionedEvents([{ id: 'outsider' }, { id: 'member' }, { id: 'muted' }], { id: 'note', channelId: 'private' } as MiNote, { push });
		expect(pack).toHaveBeenCalledTimes(2);
		expect(publishMainStream).toHaveBeenCalledExactlyOnceWith('member', 'mention', packed);
		expect(enqueueUserWebhook).toHaveBeenCalledExactlyOnceWith('member', 'mention', { note: packed });
		expect(push).toHaveBeenCalledExactlyOnceWith('member', 'mention');
	});

	test.each([false, true])('checks quoted descendants before creation (allowed = %s)', async allowed => {
		const target = { id: 'quote', userId: 'author', text: 'quote', visibility: 'public', renoteId: 'private-child' } as MiNote;
		const created = { id: 'new-note' } as MiNote;
		const create = vi.fn(async () => created);
		const isChannelVisibleForMe = vi.fn(async () => allowed);
		const service = Object.assign(Object.create(NoteCreateService.prototype), {
			notesRepository: { findOne: async () => target },
			noteEntityService: { isChannelVisibleForMe },
		}) as NoteCreateService;
		Object.defineProperty(service, 'create', { value: create });
		const data = { renoteId: target.id, visibleUserIds: [], fileIds: [] } as unknown as Parameters<NoteCreateService['fetchAndCreate']>[1];
		const result = service.fetchAndCreate(user, data);
		if (allowed) {
			await expect(result).resolves.toBe(created);
			expect(create).toHaveBeenCalledOnce();
		} else {
			await expect(result).rejects.toMatchObject({ id: '53983c56-e163-45a6-942f-4ddc485d4290' });
			expect(create).not.toHaveBeenCalled();
		}
		expect(isChannelVisibleForMe).toHaveBeenCalledWith(target, user.id);
	});
});
