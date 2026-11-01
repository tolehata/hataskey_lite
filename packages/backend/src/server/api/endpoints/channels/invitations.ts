/*
 * 旗鯖fork: プライベートチャンネルの招待状況一覧。管理者だけが取得できる。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelInvitationsRepository, ChannelsRepository } from '@/models/_.js';
import { ChannelService } from '@/core/ChannelService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	kind: 'read:channels',
	res: {
		type: 'array', optional: false, nullable: false,
		items: {
			type: 'object', optional: false, nullable: false,
			properties: {
				id: { type: 'string', format: 'misskey:id', optional: false, nullable: false },
				createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
				respondedAt: { type: 'string', format: 'date-time', optional: false, nullable: true },
				status: { type: 'string', enum: ['pending', 'rejected'], optional: false, nullable: false },
				user: { type: 'object', ref: 'UserLite', optional: false, nullable: false },
			},
			required: ['id', 'createdAt', 'respondedAt', 'status', 'user'],
		},
	},
	errors: {
		noSuchChannel: { message: 'No such channel.', code: 'NO_SUCH_CHANNEL', id: '57ed475e-3638-446a-aaee-4b9f9b71b32a' },
		accessDenied: { message: 'You cannot manage this channel.', code: 'ACCESS_DENIED', id: 'f24eb82d-2a4a-49bc-840d-cd2429653da5' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		@Inject(DI.channelInvitationsRepository)
		private channelInvitationsRepository: ChannelInvitationsRepository,

		private channelService: ChannelService,
		private userEntityService: UserEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
			if (channel == null) throw new ApiError(meta.errors.noSuchChannel);
			if (!await this.channelService.canManage(channel, me.id)) throw new ApiError(meta.errors.accessDenied);

			const invitations = await this.channelInvitationsRepository.find({
				where: { channelId: channel.id },
				order: { createdAt: 'DESC' },
				take: ps.limit,
			});
			const users = await this.userEntityService.packMany(invitations.map(invitation => invitation.userId), me);
			const userMap = new Map(users.map(user => [user.id, user]));
			return invitations.flatMap(invitation => {
				const user = userMap.get(invitation.userId);
				return user == null ? [] : [{
					id: invitation.id,
					createdAt: invitation.createdAt.toISOString(),
					respondedAt: invitation.respondedAt?.toISOString() ?? null,
					status: invitation.status,
					user,
				}];
			});
		});
	}
}
