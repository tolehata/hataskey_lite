/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { PostScheduledNoteProcessorService } from '@/queue/processors/PostScheduledNoteProcessorService.js';

function setup(deliveryTargets: unknown, failure = false) {
	const draft = { id: 'draft', userId: 'owner', user: { id: 'owner' }, scheduledAt: new Date(), isActuallyScheduled: true,
		visibility: 'followers', visibleUserIds: ['recipient'], deliveryTargets, localOnly: false };
	const drafts = { findOne: vi.fn().mockResolvedValue(draft), remove: vi.fn() };
	const notes = { fetchAndCreate: failure ? vi.fn().mockRejectedValue(new Error('invalid audience')) : vi.fn().mockResolvedValue({ id: 'note' }) };
	const notifications = { createNotification: vi.fn() };
	const service = new PostScheduledNoteProcessorService(drafts as never, notes as never, notifications as never, { logger: { createSubLogger: () => ({}) } } as never);
	return { service, drafts, notes, notifications };
}

describe('scheduled audience preservation', () => {
	test.each([null, undefined, { mode: 'include', hosts: ['remote.example'] }, { mode: 'exclude', hosts: ['remote.example'] }])('passes saved targets unchanged: %j', async targets => {
		const current = setup(targets);
		await current.service.process({ data: { noteDraftId: 'draft' } } as never);
		expect(current.notes.fetchAndCreate).toHaveBeenCalledWith({ id: 'owner' }, expect.objectContaining({ deliveryTargets: targets, visibility: 'followers', visibleUserIds: ['recipient'], localOnly: false }));
		expect(current.drafts.remove).toHaveBeenCalledOnce();
		expect(current.notifications.createNotification).toHaveBeenCalledWith('owner', 'scheduledNotePosted', { noteId: 'note' });
	});
	test('retains the original draft and its delivery conditions if posting fails', async () => {
		const current = setup({ mode: 'exclude', hosts: ['remote.example'] }, true);
		await current.service.process({ data: { noteDraftId: 'draft' } } as never);
		expect(current.drafts.remove).not.toHaveBeenCalled();
		expect(current.notifications.createNotification).toHaveBeenCalledWith('owner', 'scheduledNotePostFailed', { noteDraftId: 'draft' });
	});
});
