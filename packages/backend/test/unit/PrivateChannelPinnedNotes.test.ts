/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { UserEntityService } from '@/core/entities/UserEntityService.js';

function fixture(visibleIds: string[]) {
	const noteEntityService = { packMany: vi.fn(async () => visibleIds.map(id => ({ id }))) };
	const service = Object.assign(Object.create(UserEntityService.prototype), {
		isLocalUser: (user: { host: string | null }) => user.host == null,
		meta: {}, config: { host: 'local.test', url: 'https://local.test' }, noteEntityService,
		roleService: {
			isModerator: async () => false, getUserBadgeRoles: async () => [],
			getUserPolicies: async () => ({ canPublicNote: true }), getUserRoles: async () => [],
		},
		customEmojiService: { populateEmojis: async () => ({}) },
		avatarDecorationService: { packUserDecorations: () => [] },
		idService: { parse: () => ({ date: new Date('2026-10-18') }) },
	});
	const user = { id: 'author', username: 'author', host: null, emojis: [], notesCount: 2, requireSigninToViewContents: false };
	const pins = ['secret', 'public'].map(noteId => ({ noteId, note: { id: noteId } }));
	const options = {
		schema: 'UserDetailedNotMe', userProfile: { followingVisibility: 'public', followersVisibility: 'public' },
		pinNotes: new Map([['author', pins]]), userMemos: new Map(), userRelations: new Map(),
	};
	return { service, noteEntityService, user, options };
}

describe('profile pin visibility', () => {
	test.each([{ visibleIds: ['public'] }, { visibleIds: [] }])('IDs and note bodies contain the same visible pins: $visibleIds', async ({ visibleIds }) => {
		const f = fixture(visibleIds);
		const packed = await f.service.pack(f.user, { id: 'viewer' }, f.options);
		expect(packed.pinnedNoteIds).toEqual(visibleIds);
		expect(packed.pinnedNotes.map((note: { id: string }) => note.id)).toEqual(visibleIds);
		expect(f.noteEntityService.packMany).toHaveBeenCalledOnce();
	});

	test('authorized viewers keep both pin IDs and their order', async () => {
		const f = fixture(['secret', 'public']);
		const packed = await f.service.pack(f.user, { id: 'viewer' }, f.options);
		expect(packed.pinnedNoteIds).toEqual(['secret', 'public']);
		expect(f.noteEntityService.packMany).toHaveBeenCalledWith([{ id: 'secret' }, { id: 'public' }], { id: 'viewer' }, { detail: true });
	});
});
