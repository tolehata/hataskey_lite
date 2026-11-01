/*
 * 旗鯖fork: 招待された本人がプライベートチャンネルへの参加を承認する。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChannelService } from '@/core/ChannelService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	kind: 'write:channels',
	res: {
		type: 'object', optional: false, nullable: false,
		properties: { channelId: { type: 'string', format: 'misskey:id', optional: false, nullable: false } },
		required: ['channelId'],
	},
	errors: {
		noSuchInvitation: { message: 'No such pending invitation.', code: 'NO_SUCH_INVITATION', id: 'd7f16c02-86ac-4f8d-950a-90d05216441c' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: { invitationId: { type: 'string', format: 'misskey:id' } },
	required: ['invitationId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private channelService: ChannelService) {
		super(meta, paramDef, async (ps, me) => {
			const invitation = await this.channelService.acceptInvitation(ps.invitationId, me.id);
			if (invitation == null) throw new ApiError(meta.errors.noSuchInvitation);
			return { channelId: invitation.channelId };
		});
	}
}
