/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import NotesShow from '@/server/api/endpoints/notes/show.js';
import NotesState from '@/server/api/endpoints/notes/state.js';
import NotesClips from '@/server/api/endpoints/notes/clips.js';
import NotesUpdate from '@/server/api/endpoints/notes/update.js';
import ApShow from '@/server/api/endpoints/ap/show.js';
import { NoteReactionEntityService } from '@/core/entities/NoteReactionEntityService.js';
import { NoteFavoriteEntityService } from '@/core/entities/NoteFavoriteEntityService.js';
import { NoteDraftEntityService } from '@/core/entities/NoteDraftEntityService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';

const viewer = { id: 'viewer' } as never;
const note = { id: 'note1', userId: 'author', channelId: 'private', user: { requireSigninToViewContents: false }, userHost: null };

describe('private channel single note reads', () => {
	test('notes/show rejects an inaccessible channel or nested reference before packing', async () => {
		const pack = vi.fn();
		const endpoint = new NotesShow({} as never, { isChannelVisibleForMe: async () => false, pack } as never, { getNoteWithRelations: async () => note } as never);
		await expect(endpoint.exec({ noteId: note.id }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
		expect(pack).not.toHaveBeenCalled();
	});

	test('notes/show uses the common author/member/manager decision', async () => {
		const visible = vi.fn().mockResolvedValue(true);
		const pack = vi.fn().mockResolvedValue(note);
		const endpoint = new NotesShow({} as never, { isChannelVisibleForMe: visible, pack } as never, { getNoteWithRelations: async () => note } as never);
		await expect(endpoint.exec({ noteId: note.id }, { id: 'author' } as never, null, null)).resolves.toBe(note);
		expect(visible).toHaveBeenCalledWith(note, 'author');
	});

	test('notes/show maps revoked access during packing to NO_SUCH_NOTE', async () => {
		const endpoint = new NotesShow({} as never, { isChannelVisibleForMe: async () => true, pack: async () => { throw new PrivateChannelNoteVisibilityError(); } } as never, { getNoteWithRelations: async () => note } as never);
		await expect(endpoint.exec({ noteId: note.id }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
	});

	test.each([null, note])('notes/state treats missing and inaccessible notes identically: %s', async target => {
		const favorite = vi.fn();
		const endpoint = new NotesState({ findOneBy: async () => target } as never, {} as never, { findOne: favorite } as never, { isChannelVisibleForMe: async () => false } as never);
		await expect(endpoint.exec({ noteId: note.id }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
		expect(favorite).not.toHaveBeenCalled();
	});

	test('notes/clips does not reveal public clip membership for an inaccessible note', async () => {
		const findBy = vi.fn();
		const endpoint = new NotesClips({} as never, { findBy } as never, {} as never, { getNote: async () => note } as never, { isChannelVisibleForMe: async () => false } as never);
		await expect(endpoint.exec({ noteId: note.id }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
		expect(findBy).not.toHaveBeenCalled();
	});

	test('ap/show rejects a private local note without fetching remotely', async () => {
		const createResolver = vi.fn();
		const endpoint = new ApShow({ isFederationAllowedUri: () => true, extractDbHost: () => 'local.test', isSelfHost: () => true } as never, {} as never,
			{ pack: async () => { throw new PrivateChannelNoteVisibilityError(); } } as never,
			{ createResolver } as never, { getUserFromApId: async () => null, getNoteFromApId: async () => note } as never, {} as never, {} as never);
		await expect(endpoint.exec({ uri: 'https://local.test/notes/note1' }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_OBJECT' });
		expect(createResolver).not.toHaveBeenCalled();
	});

	test('notes/update rejects an own quote of an inaccessible private note before changing data', async () => {
		const ownQuote = { ...note, userId: 'viewer', channelId: null, renoteId: 'hidden' };
		const update = vi.fn();
		const pack = vi.fn();
		const endpoint = new NotesUpdate({} as never, { getNote: async () => ownQuote } as never,
			{ isChannelVisibleForMe: async () => false, pack } as never, { update } as never);
		await expect(endpoint.exec({ noteId: ownQuote.id, text: 'changed', cw: null }, viewer, null, null)).rejects.toMatchObject({ code: 'NO_SUCH_NOTE' });
		expect(update).not.toHaveBeenCalled();
		expect(pack).not.toHaveBeenCalled();
	});

	test('notes/update preserves the common author decision for an own private note after leaving', async () => {
		const ownNote = { ...note, userId: 'viewer' };
		const visible = vi.fn().mockResolvedValue(true);
		const update = vi.fn().mockResolvedValue(ownNote);
		const endpoint = new NotesUpdate({} as never, { getNote: async () => ownNote } as never,
			{ isChannelVisibleForMe: visible, pack: async () => ownNote } as never, { update } as never);
		await expect(endpoint.exec({ noteId: ownNote.id, text: 'changed', cw: null }, viewer, null, null)).resolves.toMatchObject({ updatedNote: ownNote });
		expect(visible).toHaveBeenCalledWith(ownNote, 'viewer');
		expect(update).toHaveBeenCalledOnce();
	});
});

describe('reaction history visibility', () => {
	function service(pack: (noteId: string) => Promise<unknown>) {
		return Object.assign(Object.create(NoteReactionEntityService.prototype), {
			userEntityService: { packMany: async () => [{ id: 'viewer' }] },
			noteEntityService: { pack },
			reactionService: { convertLegacyReaction: (reaction: string) => reaction },
			idService: { parse: () => ({ date: new Date('2026-01-01T00:00:00Z') }) },
		}) as NoteReactionEntityService;
	}

	const reactions = ['hidden', 'visible'].map(id => ({ id, userId: 'viewer', noteId: id, reaction: 'like' }));

	test('drops inaccessible notes while preserving visible reaction history rows', async () => {
		const result = await service(async id => { if (id === 'hidden') throw new PrivateChannelNoteVisibilityError(); return { id }; }).packManyWithNote(reactions as never, viewer);
		expect(result).toMatchObject([{ id: 'visible', note: { id: 'visible' } }]);
		expect(result).toHaveLength(1);
	});

	test('keeps unrelated packing errors visible to the caller', async () => {
		const error = new Error('database unavailable');
		await expect(service(async () => { throw error; }).packManyWithNote(reactions as never, viewer)).rejects.toBe(error);
	});
});

test('favorites omit inaccessible notes while preserving other saved entries', async () => {
	const service = new NoteFavoriteEntityService({} as never, { pack: async (id: string) => {
		if (id === 'hidden') throw new PrivateChannelNoteVisibilityError();
		return { id };
	} } as never, { parse: () => ({ date: new Date('2026-01-01') }) } as never);
	const favorites = ['hidden', 'visible'].map(id => ({ id, noteId: id, folderId: 'saved-folder' }));
	expect(await service.packMany(favorites, viewer)).toMatchObject([{ id: 'visible', folderId: 'saved-folder', note: { id: 'visible' } }]);
	expect(favorites).toHaveLength(2);
});

describe('drafts retain personal text when a referenced note becomes private', () => {
	test.each(['reply', 'renote'])('hides the unavailable %s without deleting its saved ID or draft body', async reference => {
		const draft = { id: 'draft', userId: 'viewer', text: 'my unfinished writing', fileIds: [], [`${reference}Id`]: 'hidden' };
		const snapshot = structuredClone(draft);
		const service = Object.assign(Object.create(NoteDraftEntityService.prototype), {
			idService: { parse: () => ({ date: new Date('2026-01-01') }) },
			userEntityService: { pack: async () => ({ id: 'viewer' }) },
			driveFileEntityService: { packManyByIds: async () => [] },
			noteEntityService: { pack: async () => { throw new PrivateChannelNoteVisibilityError(); } },
		}) as NoteDraftEntityService;
		const result = await service.pack(draft as never, viewer);
		expect(result).toMatchObject({ text: draft.text, [`${reference}Id`]: 'hidden', [reference]: null });
		expect(draft).toEqual(snapshot);
	});
});
