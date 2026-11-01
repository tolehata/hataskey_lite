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
		CREATE TABLE channel (id TEXT, name TEXT, description TEXT, isPrivate BOOLEAN, isArchived BOOLEAN, userId TEXT);
		CREATE TABLE channel_member (channelId TEXT, userId TEXT);
		INSERT INTO channel VALUES
			('q90', 'Tea private', 'secret', TRUE, FALSE, 'owner'),
			('q80', 'Private description', 'Tea secret', TRUE, FALSE, 'owner'),
			('q70', 'Tea public', NULL, FALSE, FALSE, 'owner'),
			('q60', 'Public description', 'Tea', FALSE, FALSE, 'owner'),
			('q50', 'Other public', '', FALSE, FALSE, 'owner'),
			('q40', 'Tea archived', '', FALSE, TRUE, 'owner');
		INSERT INTO channel_member VALUES
			('q90', 'member'), ('q80', 'member'), ('q90', 'owner'), ('q80', 'owner');
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

describe('channels/search private channel exclusion', () => {
	test.each([null, 'outsider', 'member', 'owner'])('名前・説明検索は閲覧者 %s に公開チャンネルだけを返す', async (id) => {
		const { endpoint, packMany } = fixture();
		const me = viewer(id);
		const result = await endpoint.exec({ query: 'tea', type: 'nameAndDescription' }, me, null, null);
		expect(result.map((channel: { id: string }) => channel.id)).toEqual(['q70', 'q60']);
		expect(packMany).toHaveBeenCalledWith([
			expect.objectContaining({ id: 'q70' }),
			expect.objectContaining({ id: 'q60' }),
		], me);
	});

	test('名前だけの検索でも参加中の非公開チャンネルを除外する', async () => {
		const { endpoint } = fixture();
		const result = await endpoint.exec({ query: 'tea', type: 'nameOnly' }, viewer('member'), null, null);
		expect(result.map((channel: { id: string }) => channel.id)).toEqual(['q70']);
	});

	test.each([null, 'outsider', 'member', 'owner'])('空欄検索でも閲覧者 %s に非公開とアーカイブ済みのチャンネルを返さない', async (id) => {
		const { endpoint } = fixture();
		const result = await endpoint.exec({ query: '' }, viewer(id), null, null);
		expect(result.map((channel: { id: string }) => channel.id)).toEqual(['q70', 'q60', 'q50']);
	});

	test('非公開チャンネルだけに一致する検索語では結果を返さない', async () => {
		const { endpoint } = fixture();
		expect(await endpoint.exec({ query: 'secret' }, viewer('member'), null, null)).toEqual([]);
	});

	test('件数制限と前後ページの取得に先立って非公開チャンネルを除外する', async () => {
		const { endpoint } = fixture();
		const search = async (pagination: Record<string, string | number>) => {
			const result = await endpoint.exec({ query: 'tea', limit: 1, ...pagination }, viewer('member'), null, null);
			return result.map((channel: { id: string }) => channel.id);
		};
		expect(await search({})).toEqual(['q70']);
		expect(await search({ untilId: 'q70' })).toEqual(['q60']);
		expect(await search({ sinceId: 'q60' })).toEqual(['q70']);
	});
});
