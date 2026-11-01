/*
 * 旗鯖fork: プライベートチャンネルのメンバー一覧。作成者・副管理者・モデレーターのみ取得できる。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository, ChannelMembersRepository } from '@/models/_.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ChannelService } from '@/core/ChannelService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	kind: 'read:channels',
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, ref: 'UserLite' } },
	errors: {
		noSuchChannel: { message: 'No such channel.', code: 'NO_SUCH_CHANNEL', id: 'a6b5d6f7-c255-4365-ee45-3f8b5e6f7184' },
		accessDenied: { message: 'You cannot manage this channel.', code: 'ACCESS_DENIED', id: 'b7c6e708-d366-4476-ff56-4a9c6f708295' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		@Inject(DI.channelMembersRepository)
		private channelMembersRepository: ChannelMembersRepository,

		private userEntityService: UserEntityService,
		private channelService: ChannelService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
			if (channel == null) throw new ApiError(meta.errors.noSuchChannel);
			if (!await this.channelService.canManage(channel, me.id)) throw new ApiError(meta.errors.accessDenied);

			const query = this.channelMembersRepository.createQueryBuilder('m')
				.where('m.channelId = :channelId', { channelId: channel.id });
			if (ps.sinceId) query.andWhere('m.id > :sinceId', { sinceId: ps.sinceId });
			if (ps.untilId) query.andWhere('m.id < :untilId', { untilId: ps.untilId });

			const members = await query.orderBy('m.id', 'DESC').limit(ps.limit).getMany();
			return await this.userEntityService.packMany(members.map(m => m.userId), me);
		});
	}
}
