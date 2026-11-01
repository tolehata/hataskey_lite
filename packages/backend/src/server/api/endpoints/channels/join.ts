/*
 * 旗鯖fork: プライベートチャンネルにあいことば(password)で入室する。
 */
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository } from '@/models/_.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelService } from '@/core/ChannelService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:channels',
	res: { type: 'object', optional: false, nullable: false, ref: 'Channel' },
	errors: {
		noSuchChannel: { message: 'No such channel.', code: 'NO_SUCH_CHANNEL', id: 'd3e2a3c4-9f22-4032-ba01-0c5e2b3c4d51' },
		notPrivate: { message: 'This channel is not private.', code: 'CHANNEL_NOT_PRIVATE', id: 'e4f3b4d5-a033-4143-cb12-1d6f3c4d5e62' },
		wrongPassword: { message: 'Wrong passphrase.', code: 'CHANNEL_WRONG_PASSWORD', id: 'f5a4c5e6-b144-4254-dc23-2e7a4d5e6f73' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// channelId は任意。指定が無ければ、あいことば(password)だけで該当プライベートチャンネルを探して入室する。
		channelId: { type: 'string', format: 'misskey:id' },
		password: { type: 'string', minLength: 1 },
	},
	required: ['password'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private channelEntityService: ChannelEntityService,
		private channelService: ChannelService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// channelId 指定あり: そのチャンネルにあいことばで入室。
			if (ps.channelId != null) {
				const channel = await this.channelsRepository.findOneBy({ id: ps.channelId });
				if (channel == null) throw new ApiError(meta.errors.noSuchChannel);
				if (!channel.isPrivate) throw new ApiError(meta.errors.notPrivate);

				const ok = await this.channelService.joinByPassword(channel, me.id, ps.password);
				if (!ok) throw new ApiError(meta.errors.wrongPassword);

				return await this.channelEntityService.pack(channel.id, me);
			}

			// channelId 指定なし: あいことばだけで該当チャンネルを探して入室。
			const channel = await this.channelService.findPrivateChannelByPassword(ps.password);
			if (channel == null) throw new ApiError(meta.errors.wrongPassword);

			await this.channelService.addMember(channel.id, me.id);
			return await this.channelEntityService.pack(channel.id, me);
		});
	}
}
