/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { QueryService } from '@/core/QueryService.js';
import type { ChannelsRepository } from '@/models/_.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { DI } from '@/di-symbols.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

// 旗鯖fork: サーバー管理者/モデレーター向けの全チャンネル一覧。プライベートチャンネルを含む
// すべてのチャンネルを横断的に閲覧できる (通常の channels/search はプライベートを非メンバーには
// 秘匿するため、運営がモデレーション目的で全体を把握できる導線がなかった)。
export const meta = {
	tags: ['admin', 'channels'],

	requireCredential: true,
	requireModerator: true,
	kind: 'read:admin:channels',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Channel',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		query: { type: 'string', nullable: true },
		// 表示フィルタ: all=全部 / public=公開のみ / private=プライベートのみ / archived=アーカイブ済み
		filter: { type: 'string', enum: ['all', 'public', 'private', 'archived'], default: 'all' },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private channelEntityService: ChannelEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.channelsRepository.createQueryBuilder('channel'), ps.sinceId, ps.untilId);

			switch (ps.filter) {
				case 'public':
					query.andWhere('channel.isPrivate = FALSE').andWhere('channel.isArchived = FALSE');
					break;
				case 'private':
					query.andWhere('channel.isPrivate = TRUE');
					break;
				case 'archived':
					query.andWhere('channel.isArchived = TRUE');
					break;
				case 'all':
				default:
					// フィルタなし (アーカイブ含む全件)
					break;
			}

			if (ps.query != null && ps.query !== '') {
				query.andWhere(new Brackets(qb => {
					qb
						.where('channel.name ILIKE :q', { q: `%${sqlLikeEscape(ps.query!)}%` })
						.orWhere('channel.description ILIKE :q', { q: `%${sqlLikeEscape(ps.query!)}%` });
				}));
			}

			const channels = await query
				.limit(ps.limit)
				.getMany();

			return await this.channelEntityService.packMany(channels, me);
		});
	}
}
