/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { applyPrivateChannelNoteVisibility } from '@/misc/private-channel-note-visibility.js';
import { QueryService } from '@/core/QueryService.js';
import { FanoutTimelineEndpointService } from '@/core/FanoutTimelineEndpointService.js';
import { SearchService } from '@/core/SearchService.js';

vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/entities/NoteEntityService.js', () => ({ NoteEntityService: class {} }));

/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated queries/services do not connect to a database. */
function queryBuilder() {
	return new DataSource({ type: 'postgres' }).createQueryBuilder().select('note.id', 'id').from('note', 'note');
}

describe('private channel visibility SQL', () => {
	test('binds the viewer and the denied channels, and checks the full reply/renote graph before pagination', () => {
		const query = queryBuilder().orderBy('note.id', 'DESC').limit(2);
		const viewer = 'viewer\' OR TRUE --';
		applyPrivateChannelNoteVisibility(query, viewer, ['secret-channel']);
		const [sql, parameters] = query.getQueryAndParameters();
		expect(parameters).toEqual([['secret-channel'], viewer]);
		expect(sql).not.toContain(viewer);
		expect(sql).toContain('WITH RECURSIVE channel_note_tree');
		expect(sql).toContain('UNION\n');
		expect(sql).not.toContain('UNION ALL');
		expect(sql).toContain('child."id" IN (ancestor."replyId", ancestor."renoteId")');
		expect(sql).toContain('channel_note."channelId" = ANY(CAST($1 AS varchar[]))');
		// The author keeps their own notes, even after leaving the channel.
		expect(sql).toContain('channel_note."userId" IS DISTINCT FROM $2');
		// Membership was resolved once per request, never per graph node.
		expect(sql).not.toContain('channel_member');
		expect(sql).not.toContain('private_channel');
		expect(sql.indexOf('WITH RECURSIVE')).toBeLessThan(sql.indexOf('LIMIT 2'));
	});

	test('anonymous viewers get no ownership exception', () => {
		const query = queryBuilder();
		applyPrivateChannelNoteVisibility(query, null, ['a', 'b']);
		const [sql, parameters] = query.getQueryAndParameters();
		expect(parameters).toEqual([['a', 'b']]);
		expect(sql).toContain('channel_note."channelId" = ANY(CAST($1 AS varchar[]))');
		expect(sql).not.toContain('IS DISTINCT FROM');
	});

	test('a viewer who can read every private channel pays for no graph walk', () => {
		const query = queryBuilder();
		applyPrivateChannelNoteVisibility(query, 'member', []);
		const [sql, parameters] = query.getQueryAndParameters();
		expect(sql).not.toContain('WITH RECURSIVE');
		expect(parameters).toEqual([]);
	});

	test('uses the joined note alias even when the outer entity is a reaction', () => {
		const query = new DataSource({ type: 'postgres' }).createQueryBuilder()
			.select('reaction.id').from('note_reaction', 'reaction').innerJoin('note', 'note', 'note.id = reaction.noteId');
		applyPrivateChannelNoteVisibility(query, 'member', ['secret-channel']);
		expect(query.getQuery()).toContain('SELECT "note"."id", "note"."userId"');
		expect(query.getQuery()).not.toContain('"reaction"."channelId"');
	});

	test.each([false, true])('waits for the moderator decision and preserves its exception: %s', async moderator => {
		const query = queryBuilder();
		let resolveRole!: (value: boolean) => void;
		const roleService = { isModerator: vi.fn(() => new Promise<boolean>(resolve => { resolveRole = resolve; })) };
		const channelsRepository = { query: vi.fn(async () => [{ id: 'secret-channel' }]) };
		const service = Object.assign(Object.create(QueryService.prototype), { roleService, channelsRepository }) as QueryService;
		const pending = service.generateChannelVisibilityQuery(query, { id: 'viewer' });
		expect(query.getQuery()).not.toContain('WITH RECURSIVE');
		resolveRole(moderator);
		await pending;
		expect(query.getQuery().includes('WITH RECURSIVE')).toBe(!moderator);
		expect(roleService.isModerator).toHaveBeenCalledWith({ id: 'viewer' });
		expect(channelsRepository.query).toHaveBeenCalledTimes(moderator ? 0 : 1);
	});

	test.each([
		['a signed-in viewer excludes owned, moderated and joined channels', 'viewer'],
		['an anonymous viewer is denied every private channel', null],
	] as const)('%s when resolving denied channels', async (_label, viewer) => {
		const channelsRepository = { query: vi.fn(async () => [{ id: 'denied' }]) };
		const service = Object.assign(Object.create(QueryService.prototype), { channelsRepository }) as QueryService;
		expect(await service.getDeniedPrivateChannelIds(viewer)).toEqual(['denied']);
		const [sql, params] = channelsRepository.query.mock.calls[0] as unknown as [string, string[] | undefined];
		expect(sql).toContain('"isPrivate" = TRUE');
		if (viewer == null) {
			expect(sql).not.toContain('channel_member');
			expect(params).toBeUndefined();
		} else {
			expect(sql).toContain('c."userId" IS DISTINCT FROM $1');
			expect(sql).toContain('$1 = ANY(c."moderatorUserIds")');
			expect(sql).toContain('FROM "channel_member" m');
			expect(params).toEqual([viewer]);
		}
	});
});

describe('private channel results fill the requested page', () => {
	test('Redis reads past excluded candidates before deciding the page is empty', async () => {
		const reads: string[][] = [];
		const queryService = { generateChannelVisibilityQuery: vi.fn(async (query: any) => { query.channelFiltered = true; }) };
		const notesRepository = { createQueryBuilder: () => {
			const query: any = {
				channelFiltered: false, ids: [] as string[],
				where: (_sql: string, params: { noteIds: string[] }) => { query.ids = params.noteIds; return query; },
				getMany: async () => {
					expect(query.channelFiltered).toBe(true);
					reads.push(query.ids);
					return query.ids.filter((id: string) => !id.startsWith('secret')).map((id: string) => ({ id, userId: 'author', userHost: null, user: { isSuspended: false }, fileIds: [] }));
				},
			};
			query.innerJoinAndSelect = query.leftJoinAndSelect = () => query;
			return query;
		} };
		const service = Object.assign(Object.create(FanoutTimelineEndpointService.prototype), {
			notesRepository, queryService,
			meta: { ugcVisibilityForVisitor: 'all', blockedHosts: [] },
			fanoutTimelineService: { getMulti: async () => [['secret2', 'secret1', 'public2', 'public1']] },
			utilityService: { isBlockedHost: () => false },
		}) as FanoutTimelineEndpointService;
		const fallback = vi.fn(async () => []);
		const result = await service.getMiNotes({ untilId: null, sinceId: null, limit: 1, allowPartial: false, me: null, useDbFallback: true, redisTimelines: ['localTimeline'], excludePureRenotes: false, withCats: false, dbFallback: fallback });
		expect(result.map(note => note.id)).toEqual(['public2']);
		expect(reads).toEqual([['secret2', 'secret1'], ['public2', 'public1']]);
		expect(fallback).not.toHaveBeenCalled();
	});

	test('MeiliSearch continues after a batch consisting entirely of inaccessible hits', async () => {
		const hits = Array.from({ length: 100 }, (_, index) => ({ id: `secret${index}` }));
		const search = vi.fn().mockResolvedValueOnce({ hits }).mockResolvedValueOnce({ hits: [{ id: 'visible' }] });
		const query: any = { noteIds: [], channelFiltered: false };
		for (const method of ['innerJoinAndSelect', 'leftJoinAndSelect', 'where']) query[method] = () => query;
		query.setParameter = (_key: string, value: string[]) => { query.noteIds = value; return query; };
		query.getMany = async () => {
			expect(query.channelFiltered).toBe(true);
			return query.noteIds.includes('visible') ? [{ id: 'visible' }] : [];
		};
		const service = Object.assign(Object.create(SearchService.prototype), {
			meilisearch: {}, meilisearchNoteIndex: { search }, meta: { ugcVisibilityForVisitor: 'all' },
			notesRepository: { createQueryBuilder: () => query },
			queryService: {
				generateBlockedHostQueryForNote: vi.fn(), generateSuspendedUserQueryForNote: vi.fn(), generateVisibilityQuery: vi.fn(),
				generateChannelVisibilityQuery: async () => { query.channelFiltered = true; },
			},
		});
		const result = await service.searchNoteByMeiliSearch('query', null, {}, { limit: 1 });
		expect(result).toEqual([{ id: 'visible' }]);
		expect(search.mock.calls.map(call => call[1].offset)).toEqual([0, 100]);
	});
});
