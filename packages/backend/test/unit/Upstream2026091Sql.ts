/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { DataSource } from 'typeorm';
import { PollService } from '@/core/PollService.js';
import { loadConfig } from '@/config.js';

describe('Misskey 2026.9.1 SQL parameters', () => {
	test('a poll vote binds its index and note ID even when the ID contains SQL syntax', async () => {
		const noteId = `id' OR 1=1 --`;
		const queries: [string, unknown[]][] = [];
		const pollsRepository = {
			findOneBy: async () => ({ noteId, choices: ['yes'], multiple: false }),
			query: async (sql: string, parameters: unknown[]) => { queries.push([sql, parameters]); },
		};
		const pollVotesRepository = {
			findBy: async () => [],
			insert: async () => {},
		};
		const service = Reflect.construct(PollService, [
			{}, {}, pollsRepository, pollVotesRepository, {}, { gen: () => 'vote-id' }, {},
			{ publishNoteStream: () => {} }, {}, {}, {},
		]) as PollService;
		await service.vote({ id: 'user-id' } as Parameters<PollService['vote']>[0], {
			id: noteId,
			userId: 'user-id',
		} as Parameters<PollService['vote']>[1], 0);
		assert.deepEqual(queries, [[
			'UPDATE poll SET votes[$1] = votes[$1] + 1 WHERE "noteId" = $2',
			[1, noteId],
		]]);
	});

	const integrationTest = process.env.UPSTREAM_2026091_SQL_INTEGRATION === '1' ? test : test.skip;
	integrationTest('PostgreSQL applies a bound poll vote only to the matching note', async () => {
		const config = loadConfig();
		const db = new DataSource({
			type: 'postgres',
			host: config.db.host,
			port: config.db.port,
			username: config.db.user,
			password: config.db.pass,
			database: config.db.db,
			extra: config.db.extra,
		});
		await db.initialize();
		const runner = db.createQueryRunner();
		try {
			await runner.connect();
			await runner.query('CREATE TEMP TABLE poll ("noteId" text PRIMARY KEY, votes integer[] NOT NULL)');
			const noteId = `id' OR 1=1 --`;
			await runner.query('INSERT INTO poll ("noteId", votes) VALUES ($1, ARRAY[0, 0]), ($2, ARRAY[0, 0])', [noteId, 'other-id']);
			const pollsRepository = {
				findOneBy: async () => ({ noteId, choices: ['yes', 'no'], multiple: false }),
				query: (sql: string, parameters: unknown[]) => runner.query(sql, parameters),
			};
			const service = Reflect.construct(PollService, [
				{}, {}, pollsRepository, { findBy: async () => [], insert: async () => {} },
				{}, { gen: () => 'vote-id' }, {}, { publishNoteStream: () => {} }, {}, {}, {},
			]) as PollService;
			await service.vote({ id: 'user-id' } as Parameters<PollService['vote']>[0], {
				id: noteId,
				userId: 'user-id',
			} as Parameters<PollService['vote']>[1], 1);
			const rows = await runner.query('SELECT "noteId", votes FROM poll ORDER BY "noteId"');
			assert.deepEqual(rows, [
				{ noteId: noteId, votes: [0, 1] },
				{ noteId: 'other-id', votes: [0, 0] },
			]);
		} finally {
			await runner.release();
			await db.destroy();
		}
	});
});
