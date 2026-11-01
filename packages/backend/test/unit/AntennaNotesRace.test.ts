/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import AntennaNotesEndpoint from '@/server/api/endpoints/antennas/notes.js';

type AntennaRow = {
	id: string;
	userId: string;
	src: string;
	users: string[];
	isActive: boolean;
	lastUsedAt: Date;
};

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(done => { resolve = done; });
	return { promise, resolve };
}

function fixture(initialActive: boolean) {
	let row: AntennaRow | null = {
		id: 'antenna1', userId: 'owner1', src: 'all', users: [],
		isActive: initialActive, lastUsedAt: new Date(0),
	};
	const firstRead = deferred();
	let reads = 0;
	const findOneBy = vi.fn(async ({ id, userId }: { id: string; userId: string }) => {
		const snapshot = row?.id === id && row.userId === userId ? structuredClone(row) : null;
		if (++reads === 1) await firstRead.promise;
		return snapshot;
	});
	const update = vi.fn(async (where: string | { id: string; userId: string }, patch: Partial<AntennaRow>) => {
		const id = typeof where === 'string' ? where : where.id;
		const ownerMatches = typeof where === 'string' || row?.userId === where.userId;
		if (row?.id === id && ownerMatches) row = { ...row, ...structuredClone(patch) };
	});
	const publishInternalEvent = vi.fn();
	const get = vi.fn().mockResolvedValue([]);
	const query = {
		where: vi.fn(), innerJoinAndSelect: vi.fn(), leftJoinAndSelect: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), getMany: vi.fn().mockResolvedValue([]),
	};
	query.where.mockReturnValue(query);
	query.innerJoinAndSelect.mockReturnValue(query);
	query.leftJoinAndSelect.mockReturnValue(query);
	query.orderBy.mockReturnValue(query);
	query.limit.mockReturnValue(query);
	const createQueryBuilder = vi.fn().mockReturnValue(query);
	const generateVisibilityQuery = vi.fn();
	const generateChannelVisibilityQuery = vi.fn(async () => {});
	const generateBaseNoteFilteringQuery = vi.fn();
	const packMany = vi.fn(async (notes: { id: string }[]) => notes.map(note => note.id));
	const endpoint = new AntennaNotesEndpoint(
		{ createQueryBuilder } as never,
		{ findOneBy, update } as never,
		{ gen: vi.fn() } as never,
		{ packMany } as never,
		{ generateVisibilityQuery, generateChannelVisibilityQuery, generateBaseNoteFilteringQuery } as never,
		{ get } as never,
		{ publishInternalEvent } as never,
	);
	return {
		endpoint, firstRead, findOneBy, update, publishInternalEvent, get, query,
		generateVisibilityQuery, generateChannelVisibilityQuery, generateBaseNoteFilteringQuery, packMany,
		get row() { return row; },
		set row(value: AntennaRow | null) { row = value; },
		exec: (actor = 'owner1', params: Record<string, unknown> = {}) => endpoint.exec({ antennaId: 'antenna1', ...params }, { id: actor } as never, null, null),
	};
}

describe('antennas/notes activity update', () => {
	test.each([true, false])('keeps concurrent settings when initially active=%s', async initialActive => {
		const f = fixture(initialActive);
		const request = f.exec();
		f.row = { ...f.row!, src: 'users_blacklist', users: ['@alice'], isActive: true };
		f.firstRead.resolve();
		await expect(request).resolves.toEqual([]);
		expect(f.row).toMatchObject({ src: 'users_blacklist', users: ['@alice'], isActive: true });
		expect(f.update).toHaveBeenCalledOnce();
		expect(f.update).toHaveBeenCalledWith(
			{ id: 'antenna1', userId: 'owner1' },
			{ isActive: true, lastUsedAt: expect.any(Date) },
		);
		if (initialActive) {
			expect(f.findOneBy).toHaveBeenCalledOnce();
			expect(f.publishInternalEvent).not.toHaveBeenCalled();
		} else {
			expect(f.findOneBy).toHaveBeenCalledTimes(2);
			expect(f.publishInternalEvent).toHaveBeenCalledExactlyOnceWith('antennaUpdated', expect.objectContaining({
				src: 'users_blacklist', users: ['@alice'], isActive: true,
			}));
		}
	});

	test('does not publish when a concurrently deleted inactive antenna cannot be reread', async () => {
		const f = fixture(false);
		const request = f.exec();
		f.row = null;
		f.firstRead.resolve();
		await expect(request).resolves.toEqual([]);
		expect(f.update).toHaveBeenCalledWith({ id: 'antenna1', userId: 'owner1' }, { isActive: true, lastUsedAt: expect.any(Date) });
		expect(f.findOneBy).toHaveBeenCalledTimes(2);
		expect(f.publishInternalEvent).not.toHaveBeenCalled();
	});

	test('does not publish or query notes after the activity update fails', async () => {
		const f = fixture(false);
		const failure = new Error('database update failed');
		f.update.mockRejectedValueOnce(failure);
		const request = f.exec();
		f.firstRead.resolve();
		await expect(request).rejects.toBe(failure);
		expect(f.findOneBy).toHaveBeenCalledOnce();
		expect(f.publishInternalEvent).not.toHaveBeenCalled();
		expect(f.get).not.toHaveBeenCalled();
	});

	test('returns visible notes in order with the requested limit', async () => {
		const f = fixture(true);
		f.get.mockResolvedValue(['note1', 'note2', 'note3']);
		f.query.getMany.mockResolvedValue([{ id: 'note1' }, { id: 'note2' }]);
		const request = f.exec('owner1', { limit: 2 });
		f.firstRead.resolve();
		await expect(request).resolves.toEqual(['note2', 'note1']);
		// Every candidate is filtered before the limit, so hidden notes cannot shorten the page.
		expect(f.query.where).toHaveBeenCalledWith('note.id IN (:...noteIds)', { noteIds: ['note1', 'note2', 'note3'] });
		expect(f.query.orderBy).toHaveBeenCalledWith('note.id', 'DESC');
		expect(f.query.limit).toHaveBeenCalledWith(2);
		expect(f.generateChannelVisibilityQuery).toHaveBeenCalledWith(f.query, expect.objectContaining({ id: 'owner1' }));
		expect(f.generateVisibilityQuery).toHaveBeenCalledOnce();
		expect(f.generateBaseNoteFilteringQuery).toHaveBeenCalledOnce();
		expect(f.packMany).toHaveBeenCalledWith([{ id: 'note2' }, { id: 'note1' }], expect.objectContaining({ id: 'owner1' }));
	});

	test('cannot activate another user’s antenna or accept invalid IDs', async () => {
		const foreign = fixture(false);
		const denied = foreign.exec('other1');
		foreign.firstRead.resolve();
		await expect(denied).rejects.toMatchObject({ code: 'NO_SUCH_ANTENNA' });
		expect(foreign.update).not.toHaveBeenCalled();
		expect(foreign.publishInternalEvent).not.toHaveBeenCalled();
		const invalid = fixture(false);
		await expect(invalid.exec('owner1', { antennaId: 'bad-id' })).rejects.toMatchObject({ code: 'INVALID_PARAM' });
		expect(invalid.findOneBy).not.toHaveBeenCalled();
	});
});
