/* SPDX-License-Identifier: AGPL-3.0-only */
import { EntityNotFoundError } from 'typeorm';
import { describe, expect, test, vi } from 'vitest';
import { NotificationEntityService } from '@/core/entities/NotificationEntityService.js';
import { PrivateChannelNoteVisibilityError } from '@/misc/private-channel-note-visibility-error.js';
import type { MiGroupedNotification, MiNotification } from '@/models/Notification.js';

function fixture() {
	const notes = [
		{ id: 'public', userId: 'public-author', text: 'public body' },
		{ id: 'secret', userId: 'private-author', text: 'private body' },
		{ id: 'ordinary-hidden', userId: 'public-author', text: null, isHidden: true },
	];
	const users = [{ id: 'public-author', host: null }, { id: 'private-author', host: null }];
	const noteEntity = {
		pack: vi.fn(async (id: string) => {
			if (id === 'secret') throw new PrivateChannelNoteVisibilityError();
			const note = notes.find(note => note.id === id);
			if (!note) throw new EntityNotFoundError('Note', id);
			return note;
		}),
		packMany: vi.fn(async (rows: typeof notes) => rows.filter(note => note.id !== 'secret')),
	};
	const userEntity = {
		pack: vi.fn(async (id: string) => users.find(user => user.id === id)),
		packMany: vi.fn(async () => users),
	};
	const notesRepository = { find: vi.fn(async () => notes) };
	const service = new NotificationEntityService(
		{ get: (name: string) => name === 'NoteEntityService' ? noteEntity : userEntity } as never,
		notesRepository as never, { find: async () => users } as never,
		{} as never, {} as never, {} as never, {} as never,
		{ userMutingsCache: { fetch: async () => new Set() }, userProfileCache: { fetch: async () => ({ mutedInstances: [] }) } } as never,
	);
	service.onModuleInit();
	const base = { id: 'notification', createdAt: new Date('2026-10-18').getTime() };
	const single = (noteId: string): MiNotification => ({ ...base, type: 'note', noteId, notifierId: 'public-author' });
	const grouped = (noteIds: string[]): MiGroupedNotification => ({ ...base, type: 'note:grouped', noteIds, notifierIds: users.map(user => user.id) });
	return { service, noteEntity, notesRepository, base, single, grouped };
}

describe('private channel notification exclusion', () => {
	test('single stream/push payloads await visibility and suppress inaccessible or deleted notes', async () => {
		const f = fixture();
		expect(await f.service.pack(f.single('secret'), 'viewer', { checkValidNotifier: false })).toBeNull();
		expect(await f.service.pack(f.single('deleted'), 'viewer', { checkValidNotifier: false })).toBeNull();
		expect(await f.service.pack(f.single('public'), 'viewer', { checkValidNotifier: false })).toMatchObject({ note: { id: 'public' } });
	});

	test('preserves other visibility placeholders and surfaces unrelated failures', async () => {
		const f = fixture();
		expect(await f.service.pack(f.single('ordinary-hidden'), 'viewer', { checkValidNotifier: false })).toMatchObject({ note: { isHidden: true } });
		f.noteEntity.pack.mockRejectedValueOnce(new Error('database unavailable'));
		await expect(f.service.pack(f.single('public'), 'viewer', { checkValidNotifier: false })).rejects.toThrow('database unavailable');
	});

	test('grouped note notifications remove private IDs and their author only', async () => {
		const f = fixture();
		expect(await f.service.pack(f.grouped(['secret', 'public']), 'viewer', { checkValidNotifier: false })).toMatchObject({ noteIds: ['public'], users: [{ id: 'public-author' }] });
		expect(await f.service.pack(f.grouped(['secret']), 'viewer', { checkValidNotifier: false })).toBeNull();
	});

	test('grouped bulk packing resolves all grouped note IDs and excludes empty groups', async () => {
		const f = fixture();
		const result = await f.service.packGroupedMany([f.grouped(['secret', 'public']), { ...f.grouped(['secret']), id: 'hidden-group' }], 'viewer');
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ noteIds: ['public'], users: [{ id: 'public-author' }] });
		expect(f.notesRepository.find).toHaveBeenCalled();
		expect(f.notesRepository.find.mock.calls[0][0].where.id.value).toContain('secret');
		expect(f.noteEntity.pack).not.toHaveBeenCalled();
	});

	test('regular bulk notifications exclude private notes without losing the public notification', async () => {
		const f = fixture();
		const result = await f.service.packMany([f.single('secret'), f.single('public')], 'viewer');
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ note: { id: 'public' } });
	});

	test('grouped reactions retain only visible targets', async () => {
		const f = fixture();
		const group = {
			...f.base, type: 'reaction:groupedByUser' as const, notifierId: 'public-author',
			reactions: ['secret', 'public'].map(noteId => ({ noteId, reaction: '👍', createdAt: f.base.createdAt })),
		};
		const result = await f.service.pack(group, 'viewer', { checkValidNotifier: false });
		expect(result).toMatchObject({ reactions: [{ note: { id: 'public' } }] });
		expect(await f.service.pack({ ...group, reactions: group.reactions.slice(0, 1) }, 'viewer', { checkValidNotifier: false })).toBeNull();
	});
});
