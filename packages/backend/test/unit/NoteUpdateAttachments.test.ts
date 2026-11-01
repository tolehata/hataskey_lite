/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { NoteUpdateService } from '@/core/NoteUpdateService.js';
import type { MiNote } from '@/models/Note.js';
import NotesUpdateEndpoint from '@/server/api/endpoints/notes/update.js';

// 依存先の読み込みで使われるだけで、このテストでは正規表現処理を行わない。
vi.mock('re2', () => ({ default: RegExp }));

const services: NoteUpdateService[] = [];
afterEach(() => {
	for (const service of services.splice(0)) service.dispose();
});

describe('notes/update attachments', () => {
	function setup() {
		const getMany = vi.fn().mockResolvedValue([{ id: 'filea' }]);
		const query = {
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			setParameters: vi.fn().mockReturnThis(),
			getMany,
		};
		const createQueryBuilder = vi.fn().mockReturnValue(query);
		const update = vi.fn().mockImplementation(async (_user, data) => ({ id: 'notea', ...data }));
		const endpoint = new NotesUpdateEndpoint(
			{ createQueryBuilder } as never,
			{ getNote: vi.fn().mockResolvedValue({ id: 'notea', userId: 'usera' }) } as never,
			{ pack: vi.fn().mockImplementation(async note => note), isChannelVisibleForMe: vi.fn().mockResolvedValue(true) } as never,
			{ update } as never,
		);
		const exec = (files: unknown, field: 'fileIds' | 'mediaIds' = 'fileIds') => endpoint.exec({
			noteId: 'notea', text: 'edited', cw: null, [field]: files,
		}, { id: 'usera' } as never, null, null);
		return { exec, update, createQueryBuilder, getMany };
	}

	test.each(['fileIds', 'mediaIds'] as const)('%s: empty array clears attachments without querying an empty IN list', async field => {
		const { exec, update, createQueryBuilder } = setup();
		await expect(exec([], field)).resolves.toMatchObject({ updatedNote: { files: [] } });
		expect(createQueryBuilder).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'usera' }),
			expect.objectContaining({ files: [] }),
			expect.objectContaining({ id: 'notea' }),
			false,
		);
	});

	test('nonempty IDs are still resolved and invalid IDs are rejected', async () => {
		const { exec, update, createQueryBuilder, getMany } = setup();
		await expect(exec(['filea'])).resolves.toMatchObject({ updatedNote: { files: [{ id: 'filea' }] } });
		expect(createQueryBuilder).toHaveBeenCalledTimes(1);
		getMany.mockResolvedValueOnce([]);
		await expect(exec(['missing'])).rejects.toMatchObject({ code: 'NO_SUCH_FILE' });
		await expect(exec(['filea', 'filea'])).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(update).toHaveBeenCalledTimes(1);
	});

	test.each([false, true])('NoteUpdateService clears attachments and keeps an unchanged poll (hasPoll=%s)', async hasPoll => {
		const original = {
			id: 'notea', userId: 'usera', userHost: null,
			text: 'before', cw: null, visibility: 'public', localOnly: false,
			fileIds: ['filea'], attachedFileTypes: ['image/png'], emojis: [],
			hasPoll, hasEvent: false, updatedAtHistory: null,
			mentionedRemoteUsers: '[]',
		} as unknown as MiNote;
		let saved = { ...original };
		const notesRepository = {
			update: vi.fn().mockImplementation(async (_criteria: unknown, values: Partial<MiNote>) => {
				saved = { ...saved, ...values };
			}),
			findOneBy: vi.fn().mockImplementation(async () => saved),
		};
		const poll = { choices: ['one', 'two'], multiple: false, expiresAt: new Date(Date.now() - 1000) };
		const manager = {
			update: vi.fn().mockImplementation(async (_type: unknown, criteria: unknown, values: Partial<MiNote>) => notesRepository.update(criteria, values)),
			findOneBy: vi.fn().mockResolvedValue(poll),
			delete: vi.fn(),
			insert: vi.fn(),
		};
		const db = {
			getRepository: vi.fn().mockReturnValue({ findOneBy: vi.fn().mockResolvedValue(poll) }),
			transaction: async (run: (transactionManager: typeof manager) => Promise<void>) => run(manager),
		};
		const service = new NoteUpdateService(
			db as never, {} as never, notesRepository as never,
			{ isLocalUser: () => true } as never,
			{ publishNoteStream: vi.fn() } as never,
			{} as never, {} as never, {} as never,
			{ renderNote: vi.fn(), renderUpdate: vi.fn(), addContext: vi.fn() } as never,
			{ unindexNote: vi.fn(), indexNote: vi.fn() } as never,
			{ write: vi.fn() } as never,
			{ recordHistory: vi.fn() } as never,
			{ isCandidate: () => false, onNoteUpdatedInTransaction: vi.fn().mockResolvedValue(null) } as never,
		);
		services.push(service);
		const updated = await service.update(
			{ id: 'usera', username: 'alice', host: null, isBot: false },
			{ text: 'after', cw: null, files: [], poll: hasPoll ? { choices: poll.choices, multiple: poll.multiple, expiresAt: null } : null }, original, true,
		);
		expect(notesRepository.update).toHaveBeenCalledWith(
			{ id: 'notea' }, expect.objectContaining({ fileIds: [], attachedFileTypes: [] }),
		);
		expect(updated).toMatchObject({ fileIds: [], attachedFileTypes: [] });
		if (hasPoll) {
			expect(updated?.hasPoll).toBe(true);
			expect(manager.delete).not.toHaveBeenCalled();
			expect(manager.insert).not.toHaveBeenCalled();
		}
	});
});
