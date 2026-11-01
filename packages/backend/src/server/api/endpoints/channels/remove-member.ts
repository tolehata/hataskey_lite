/*
 * 旗鯖fork: プライベートチャンネルからメンバーを外す。作成者・副管理者・モデレーターのみ。作成者は外せない。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository } from '@/models/_.js';
import { ChannelService } from '@/core/ChannelService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	kind: 'write:channels',
	errors: {
		noSuchChannel: { message: 'No such channel.', code: 'NO_SUCH_CHANNEL', id: 'ea091b2c-0699-47a9-cc89-7d2f92a4b5d8' },
		accessDenied: { message: 'You cannot manage this channel.', code: 'ACCESS_DENIED', id: 'fb1a2c3d-170a-48ba-dd9a-8e3a03b5c6e9' },
		cannotRemoveOwner: { message: 'Cannot remove the channel owner.', code: 'CANNOT_REMOVE_OWNER', id: '0c2b3d4e-281b-49cb-eeab-9f4b14c6d7fa' },
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

		private channelService: ChannelService,
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
			if (channel == null) throw new ApiError(meta.errors.noSuchChannel);
			if (!await this.channelService.canManage(channel, me.id)) throw new ApiError(meta.errors.accessDenied);
			if (ps.userId === channel.userId) throw new ApiError(meta.errors.cannotRemoveOwner);

			await this.channelService.removeMember(channel.id, ps.userId);

			// 旗鯖fork: 除外されたユーザーへ通知。何の説明もなく追加されたチャンネルから外されると
			// 不審に思われるため、誰がいつ外したかを明示する。
			if (channel.isPrivate && ps.userId !== me.id) {
				this.notificationService.createNotification(ps.userId, 'removedFromPrivateChannel', {
					customBody: `プライベートチャンネル「${channel.name}」のメンバーから外れました。`,
					customHeader: 'プライベートチャンネルから除外',
					customIcon: null,
					customLink: null,
				}, me.id);
			}
		});
	}
}
