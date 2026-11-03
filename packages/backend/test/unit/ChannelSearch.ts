/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { DatabaseSync } from 'node:sqlite';
import { DataSource } from 'typeorm';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ChannelSearch from '@/server/api/endpoints/channels/search.js';
import { QueryService } from '@/core/QueryService.js';
import type { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import type { ChannelsRepository } from '@/models/_.js';
import type { MiChannel } from '@/models/Channel.js';
import type { MiLocalUser } from '@/models/User.js';

vi.mock('@/core/entities/ChannelEntityService.js', () => ({ ChannelEntityService: class {} }));

const databases: DatabaseSync[] = [];
afterEach(() => {
	for (const database of databases.splice(0)) database.close();
});

function fixture() {
	const database = new DatabaseSync(':memory:');
	databases.push(database);
	database.exec(`
		CREATE TABLE channel (id TEXT, name TEXT, description TEXT, isArchived BOOLEAN, userId TEXT);
		INSERT INTO channel VALUES
			('q70', 'Tea public', NULL, FALSE, 'owner'),
			('q60', 'Public description', 'Tea', FALSE, 'owner'),
			('q50', 'Other public', '', FALSE, 'owner'),
			('q40', 'Tea archived', '', TRUE, 'owner');
	`);
	const dataSource = new DataSource({ type: 'postgres' });
	const repository = {
		createQueryBuilder: () => {
			const query = dataSource.createQueryBuilder<MiChannel>().select('channel.*').from('channel', 'channel');
			vi.spyOn(query, 'getMany').mockImplementation(async () => {
				const [sql, parameters] = query.getQueryAndParameters();
				// Execute the real PostgreSQL query in memory; SQLite LIKE matches
				// ILIKE for these ASCII fixtures. No application database is used.
				const bindings = Object.fromEntries(parameters.map((value, index) => [`$${index + 1}`, value]));
				return database.prepare(sql.replace(/\bILIKE\b/g, 'LIKE')).all(bindings) as unknown as MiChannel[];
			});
			return query;
		},
	};
	const packMany = vi.fn(async (channels: MiChannel[]) => channels.map(channel => ({ id: channel.id, name: channel.name })));
	const endpoint = new ChannelSearch(
		repository as unknown as ChannelsRepository,
		{ packMany } as unknown as ChannelEntityService,
		{ makePaginationQuery: QueryService.prototype.makePaginationQuery } as QueryService,
	);
	return { endpoint, packMany };
}

const viewer = (id: string | null) => id == null ? null : { id } as MiLocalUser;

describe('channels/search', () => {
	test.each([null, 'outsider'])('名前・説明検索は閲覧者 %s に一致するチャンネルを返す', async (id) => {
		const { endpoint, packMany } = fixture();
		const me = viewer(id);
		const result = await endpoint.exec({ query: 'tea', type: 'nameAndDescription' }, me, null, null);
		expect(result.map((channel: { id: string }) => channel.id)).toEqual(['q70', 'q60']);
		expect(packMany).toHaveBeenCalledWith([
			expect.objectContaining({ id: 'q70' }),
			expect.objectContaining({ id: 'q60' }),
		], me);
	});

	test('名前だけの検索は説明に一致するチャンネルを返さない', async () => {
		const { endpoint } = fixture();
		const result = await endpoint.exec({ query: 'tea', type: 'nameOnly' }, viewer('outsider'), null, null);
		expect(result.map((channel: { id: string }) => channel.id)).toEqual(['q70']);
	});

	test('空欄検索はアーカイブ済みのチャンネルを返さない', async () => {
		const { endpoint } = fixture();
		const result = await endpoint.exec({ query: '' }, viewer(null), null, null);
		expect(result.map((channel: { id: string }) => channel.id)).toEqual(['q70', 'q60', 'q50']);
	});

	test('件数制限と前後ページの取得', async () => {
		const { endpoint } = fixture();
		const search = async (pagination: Record<string, string | number>) => {
			const result = await endpoint.exec({ query: 'tea', limit: 1, ...pagination }, viewer('outsider'), null, null);
			return result.map((channel: { id: string }) => channel.id);
		};
		expect(await search({})).toEqual(['q70']);
		expect(await search({ untilId: 'q70' })).toEqual(['q60']);
		expect(await search({ sinceId: 'q60' })).toEqual(['q70']);
	});
});
