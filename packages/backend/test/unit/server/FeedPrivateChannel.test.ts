/* SPDX-License-Identifier: AGPL-3.0-only */
import { expect, test, vi } from 'vitest';
import { FeedService } from '@/server/web/FeedService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';

test('RSS excludes public replies to private ancestors before generating feed items', async () => {
	const hidden = { id: 'hidden', userId: 'author', channelId: 'private', replyId: null, renoteId: null };
	const candidates = [
		{ ...hidden, channel: { isPrivate: true } },
		{ id: 'outer', userId: 'author', channelId: null, replyId: hidden.id, renoteId: null },
		{ id: 'public', userId: 'author', channelId: null, replyId: null, renoteId: null },
	].map(item => ({ ...item, fileIds: [], text: `body-${item.id}`, cw: null, mentionedRemoteUsers: '[]' }));
	const entity = Object.assign(Object.create(NoteEntityService.prototype), {
		notesRepository: { find: async () => [hidden] },
		channelsRepository: { findBy: async () => [{ id: 'private', isPrivate: true, userId: 'owner', moderatorUserIds: [] }] },
	}) as NoteEntityService;
	const filter = vi.spyOn(entity, 'filterChannelVisibleNotes');
	const service = Object.assign(Object.create(FeedService.prototype), {
		config: { url: 'https://local.test', host: 'local.test' },
		notesRepository: { find: async () => candidates },
		userProfilesRepository: { findOneByOrFail: async () => ({}) },
		userEntityService: { getIdenticonUrl: () => '/avatar.png' },
		idService: { parse: () => ({ date: new Date('2026-01-01') }) },
		mfmService: { toHtml: () => 'public body' },
		noteEntityService: entity,
	}) as FeedService;
	const feed = await service.packFeed({ id: 'author', username: 'author', notesCount: 3 } as never);
	expect(filter).toHaveBeenCalledWith(expect.any(Array), null);
	expect(feed.items.map(item => item.link)).toEqual(['https://local.test/notes/public']);
	expect(feed.json1()).not.toContain('/notes/hidden');
	expect(feed.json1()).not.toContain('/notes/outer');
});
