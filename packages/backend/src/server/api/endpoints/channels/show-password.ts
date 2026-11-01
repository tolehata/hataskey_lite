/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { ChannelService } from '@/core/ChannelService.js';
import { ApiError } from '../../error.js';

// 旗鯖fork: プライベートチャンネルの「あいことば」をチャンネル管理者(オーナー/副管理者/サーバー
// モデレーター)のみが取得できる API。あいことばはサーバー側で暗号学的乱数による自動生成のため、
// frontend で表示・コピーするには別経路で取得する必要がある (channels/show は hasPassword だけ
// 返し本体は返さない設計のままにしている)。
export const meta = {
	tags: ['channels'],

	requireCredential: true,
	kind: 'read:channels',
	secure: true,

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'b0c0c0d1-0001-0001-0001-000000000001',
		},
		accessDenied: {
			message: 'You do not have permission to view this channel\'s password.',
			code: 'ACCESS_DENIED',
			id: 'b0c0c0d1-0001-0001-0001-000000000002',
		},
		notPrivate: {
			message: 'This channel is not private and has no password.',
			code: 'NOT_PRIVATE_CHANNEL',
			id: 'b0c0c0d1-0001-0001-0001-000000000003',
		},
	},

	res: {
		type: 'object',
		nullable: false, optional: false,
		properties: {
			password: { type: 'string', nullable: true },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private channelService: ChannelService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}
			if (!channel.isPrivate) {
				throw new ApiError(meta.errors.notPrivate);
			}
			if (!await this.channelService.canManage(channel, me.id)) {
				throw new ApiError(meta.errors.accessDenied);
			}
			return { password: channel.password ?? null };
		});
	}
}
