/*
 * 旗鯖fork: プライベートチャンネルにメンバーを追加する。作成者・副管理者・モデレーターのみ。
 */
import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository, UsersRepository } from '@/models/_.js';
import { ChannelService } from '@/core/ChannelService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	kind: 'write:channels',
	errors: {
		noSuchChannel: { message: 'No such channel.', code: 'NO_SUCH_CHANNEL', id: 'c8d7f819-e477-4587-aa67-5b0d7081a3b6' },
		noSuchUser: { message: 'No such local user.', code: 'NO_SUCH_USER', id: 'b935dd68-50e9-42d2-b478-9a99d5ec06b2' },
		notPrivate: { message: 'This channel is not private.', code: 'NOT_PRIVATE_CHANNEL', id: '377163dc-ae73-4b7c-acb3-7e666d552c82' },
		accessDenied: { message: 'You cannot manage this channel.', code: 'ACCESS_DENIED', id: 'd9e80a1b-f588-4698-bb78-6c1e8192a4c7' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['channelId', 'userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private channelService: ChannelService,
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
			if (channel == null) throw new ApiError(meta.errors.noSuchChannel);
			if (!await this.channelService.canManage(channel, me.id)) throw new ApiError(meta.errors.accessDenied);
			if (!channel.isPrivate) throw new ApiError(meta.errors.notPrivate);
			const invitee = await this.usersRepository.findOneBy({ id: ps.userId, host: IsNull() });
			if (invitee == null) throw new ApiError(meta.errors.noSuchUser);
			if (await this.channelService.isMember(channel.id, ps.userId)) return;

			const { invitation, shouldNotify } = await this.channelService.inviteMember(channel.id, ps.userId, me.id);

			// 招待された本人が承認するまで channel_member には登録しない。
			if (shouldNotify && ps.userId !== me.id) {
				this.notificationService.createNotification(ps.userId, 'addedToPrivateChannel', {
					customBody: `プライベートチャンネル「${channel.name}」への参加招待が届きました。参加するか選んでください。`,
					customHeader: 'プライベートチャンネルへの招待',
					customIcon: null,
					customLink: '/my/notifications',
					channelInvitationId: invitation.id,
				}, me.id);
			}
		});
	}
}
