/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { NoteUpdateService } from '@/core/NoteUpdateService.js';
import type { MiNote } from '@/models/Note.js';

const services: NoteUpdateService[] = [];

afterEach(() => {
	for (const service of services.splice(0)) service.dispose();
	vi.restoreAllMocks();
});

describe('宴の編集判定と保存の原子性', () => {
	test.each([false, true])('宴の保存エラー=%sの場合だけ本文保存と配送を取り消す', async (utageFails) => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
		const user = { id: 'user-a', username: 'alice', host: null, isBot: false };
		const original = {
			id: 'note-a', userId: user.id, userHost: null,
			text: '宴', cw: null, visibility: 'public', localOnly: false,
			fileIds: [], attachedFileTypes: [], emojis: [],
			hasPoll: false, hasEvent: false, updatedAtHistory: null,
			mentionedRemoteUsers: '[]',
		} as unknown as MiNote;
		let saved = { ...original };
		const notesRepository = {
			update: vi.fn().mockImplementation(async (_criteria, values: Partial<MiNote>) => {
				// TypeORMのUPDATEと同じく、未指定(undefined)のカラムは既存値を保持する。
				saved = { ...saved, ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) };
			}),
			findOneBy: vi.fn().mockImplementation(async () => saved),
		};
		const noteHistoryService = { recordHistory: vi.fn().mockResolvedValue(undefined) };
		const utageError = new Error('utage storage unavailable');
		const utageService = {
			isCandidate: () => true,
			lock: vi.fn().mockResolvedValue({ id: 'session' }),
			onNoteUpdatedInTransaction: utageFails ? vi.fn().mockRejectedValue(utageError) : vi.fn().mockResolvedValue({ id: 'session' }),
			afterCommit: vi.fn().mockResolvedValue(undefined),
		};
		const manager = { update: (_type: unknown, criteria: unknown, values: Partial<MiNote>) => notesRepository.update(criteria, values) };
		const db = { transaction: async (fn: (m: typeof manager) => Promise<void>) => {
			const backup = { ...saved };
			try { await fn(manager); } catch (error) { saved = backup; throw error; }
		} };
		const deliverManager = { deliverToFollowers: vi.fn().mockResolvedValue(undefined) };
		const relayService = { deliverToRelays: vi.fn().mockResolvedValue(undefined) };
		const apRendererService = {
			renderNote: vi.fn().mockResolvedValue({ type: 'Note', id: 'https://local.example/notes/note-a' }),
			renderUpdate: vi.fn().mockReturnValue({ type: 'Update', id: 'https://local.example/updates/note-a' }),
			addContext: vi.fn().mockImplementation(value => value),
		};
		const globalEventService = { publishNoteStream: vi.fn() };
		const sut = new NoteUpdateService(
			db as never,
			{} as never,
			notesRepository as never,
			{ isLocalUser: () => true } as never,
			globalEventService as never,
			{} as never,
			relayService as never,
			deliverManager as never,
			apRendererService as never,
			{ unindexNote: vi.fn(), indexNote: vi.fn() } as never,
			{ write: vi.fn() } as never,
			noteHistoryService as never,
			utageService as never,
		);
		services.push(sut);
		const text = ':kyattukya:$[fg.color=0000 宴]';

		if (utageFails) {
			await expect(sut.update(user, { text, cw: null }, original)).rejects.toThrow(utageError);
			expect(saved.text).toBe(original.text);
			expect(deliverManager.deliverToFollowers).not.toHaveBeenCalled();
			expect(utageService.afterCommit).not.toHaveBeenCalled();
			return;
		}
		const result = await sut.update(user, { text, cw: null }, original);
		await vi.waitFor(() => expect(relayService.deliverToRelays).toHaveBeenCalledTimes(1));

		expect(result?.text).toBe(text);
		expect(utageService.onNoteUpdatedInTransaction).toHaveBeenCalledWith(manager, original, expect.objectContaining({ text, cw: null }), { id: 'session' });
		expect(utageService.afterCommit).toHaveBeenCalledWith([{ id: 'session' }]);
		expect(noteHistoryService.recordHistory).toHaveBeenCalledTimes(1);
		expect(apRendererService.renderNote).toHaveBeenCalledWith(expect.objectContaining({ text, cw: null }), false);
		expect(deliverManager.deliverToFollowers).toHaveBeenCalledWith(user, apRendererService.renderUpdate.mock.results[0].value);
		expect(globalEventService.publishNoteStream).toHaveBeenCalledWith(
			expect.objectContaining({ id: original.id }), 'updated', expect.objectContaining({ text, cw: null }),
		);
	});
});
