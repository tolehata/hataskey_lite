/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { MiAntenna } from '@/models/Antenna.js';
import { MiNote } from '@/models/Note.js';
import { AntennaService } from '@/core/AntennaService.js';
import { AntennaEntityService } from '@/core/entities/AntennaEntityService.js';
import CreateEndpoint from '@/server/api/endpoints/antennas/create.js';
import UpdateEndpoint from '@/server/api/endpoints/antennas/update.js';
import NotesEndpoint from '@/server/api/endpoints/antennas/notes.js';

function antenna(excludeOwnNotes = false) {
	return Object.assign(new MiAntenna(), {
		id: 'antenna1', userId: 'owner1', name: 'Antenna', src: 'all' as const,
		lastUsedAt: new Date(0), userListId: null, userGroupJoiningId: null,
		users: [], keywords: [['keyword']], excludeKeywords: [], caseSensitive: false,
		localOnly: false, excludeBots: false, withReplies: true, withFile: false,
		excludeNotesInSensitiveChannel: false, excludeOwnNotes, isActive: true,
	});
}

function note(userId: string, overrides: Partial<MiNote> = {}) {
	return new MiNote({
		id: 'note1', userId, text: 'keyword', cw: null, visibility: 'public' as const,
		replyId: null, renoteId: null, fileIds: [], ...overrides,
	});
}

describe('antenna own-note collection', () => {
	test.each([
		['own post', 'owner1', {}, true, false],
		['own reply', 'owner1', { replyId: 'otherNote' }, true, false],
		['own quote', 'owner1', { renoteId: 'otherNote', text: 'keyword quote' }, true, false],
		['own renote', 'owner1', { renoteId: 'otherNote' }, true, false],
		['other post', 'other1', {}, true, true],
		['other reply to owner', 'other1', { replyId: 'ownNote' }, true, true],
		['other quote of owner', 'other1', { renoteId: 'ownNote', text: 'keyword quote' }, true, true],
		['other renote of owner', 'other1', { renoteId: 'ownNote' }, true, true],
		['disabled own post', 'owner1', {}, false, true],
	] as const)('%s', async (_label, author, overrides, enabled, expected) => {
		const service = new AntennaService(
			{} as never, new EventEmitter() as never, {} as never, {} as never, {} as never,
			{} as never, {} as never, {} as never, {} as never,
		);
		await expect(service.checkHitAntenna(antenna(enabled), note(author, overrides), {
			id: author, username: author, host: null, isBot: false,
		})).resolves.toBe(expected);
	});
});

function apiFixture(enabled = false) {
	const row = antenna(enabled);
	const repository = {
		countBy: async () => 1,
		findOneBy: async (where: { id: string; userId?: string }) => where.id === row.id && (where.userId == null || where.userId === row.userId) ? { ...row } : null,
		findOneByOrFail: async (where: { id: string }) => {
			if (where.id !== row.id) throw new Error('Antenna not found');
			return { ...row };
		},
		insertOne: async (data: Partial<MiAntenna>) => Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, value]: [string, unknown]) => value !== undefined))),
		update: async (_id: string, patch: Partial<MiAntenna>) => { Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, value]: [string, unknown]) => value !== undefined))); },
	};
	const ids = { gen: () => row.id, parse: () => ({ date: new Date(0) }) };
	const packer = new AntennaEntityService(repository as never, {} as never, ids as never);
	const events = { publishInternalEvent: vi.fn() };
	const create = new CreateEndpoint(repository as never, {} as never, {} as never, packer,
		{ getUserPolicies: async () => ({ antennaLimit: 100 }) } as never, ids as never, events as never);
	const update = new UpdateEndpoint(repository as never, {} as never, {} as never, packer, events as never);
	return { row, repository, create, update, packer };
}

const createParams = {
	name: 'Antenna', src: 'all', keywords: [['keyword']], excludeKeywords: [], users: [],
	caseSensitive: false, withReplies: true, withFile: false,
};

describe('antenna own-note API settings', () => {
	test.each([undefined, false, true])('creates and packs the optional setting %s', async value => {
		const f = apiFixture();
		const params = { ...createParams, ...(value === undefined ? {} : { excludeOwnNotes: value }) };
		const response = await f.create.exec(params, { id: 'owner1' } as never, null, null);
		expect(response).toMatchObject({ excludeOwnNotes: value ?? false });
		expect(f.row.excludeOwnNotes).toBe(value ?? false);
	});

	test.each([false, true])('updates the setting to %s', async value => {
		const f = apiFixture(!value);
		const response = await f.update.exec({ antennaId: 'antenna1', excludeOwnNotes: value }, { id: 'owner1' } as never, null, null);
		expect(response).toMatchObject({ excludeOwnNotes: value });
		expect(f.row.excludeOwnNotes).toBe(value);
	});

	test('preserves an enabled setting when an older client only renames the antenna', async () => {
		const f = apiFixture(true);
		const response = await f.update.exec({ antennaId: 'antenna1', name: 'Renamed' }, { id: 'owner1' } as never, null, null);
		expect(response).toMatchObject({ name: 'Renamed', excludeOwnNotes: true });
	});

	test('cannot update another user’s antenna', async () => {
		const f = apiFixture(true);
		await expect(f.update.exec({ antennaId: 'antenna1', excludeOwnNotes: false }, { id: 'other1' } as never, null, null))
			.rejects.toMatchObject({ code: 'NO_SUCH_ANTENNA' });
		expect(f.row.excludeOwnNotes).toBe(true);
	});

	test.each(['true', null, 1])('rejects a non-boolean setting %s', async value => {
		const f = apiFixture();
		await expect(f.update.exec({ antennaId: 'antenna1', excludeOwnNotes: value }, { id: 'owner1' } as never, null, null))
			.rejects.toMatchObject({ code: 'INVALID_PARAM' });
	});
});

describe('previously collected antenna own notes', () => {
	test.each([false, true])('applies the owner exclusion before pagination when enabled=%s', async enabled => {
		const f = apiFixture(enabled);
		const query = new DataSource({ type: 'postgres' }).createQueryBuilder().select('note.id').from('note', 'note');
		vi.spyOn(query, 'innerJoinAndSelect').mockReturnValue(query);
		vi.spyOn(query, 'leftJoinAndSelect').mockReturnValue(query);
		vi.spyOn(query, 'getMany').mockResolvedValue([]);
		const endpoint = new NotesEndpoint(
			{ createQueryBuilder: () => query } as never, f.repository as never, {} as never,
			{ packMany: async (notes: unknown[]) => notes } as never,
			{ generateVisibilityQuery() {}, generateChannelVisibilityQuery: async () => {}, generateBaseNoteFilteringQuery() {} } as never,
			{ get: async () => ['cachedOwnNote', 'cachedOtherNote'] } as never, {} as never,
		);
		await endpoint.exec({ antennaId: 'antenna1', limit: 2 }, { id: 'owner1' } as never, null, null);
		const [sql, parameters] = query.getQueryAndParameters();
		expect(sql).toContain('LIMIT 2');
		if (enabled) {
			expect(sql).toMatch(/note\.userId\s*(?:!=|<>)\s*\$\d/);
			expect(parameters).toContain('owner1');
			expect(sql.indexOf('note.userId')).toBeLessThan(sql.indexOf('LIMIT 2'));
			expect(sql).not.toContain('renote.userId');
			expect(sql).not.toContain('reply.userId');
		} else {
			expect(parameters).not.toContain('owner1');
		}
	});
});
