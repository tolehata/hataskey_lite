/*
 * 旗鯖fork: 招待された本人がプライベートチャンネルへの参加を拒否する。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChannelService } from '@/core/ChannelService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['channels'],
	requireCredential: true,
	kind: 'write:channels',
	errors: {
		noSuchInvitation: { message: 'No such pending invitation.', code: 'NO_SUCH_INVITATION', id: '68f6a181-0f78-472f-b882-144195714816' },
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
			const invitation = await this.channelService.rejectInvitation(ps.invitationId, me.id);
			if (invitation == null) throw new ApiError(meta.errors.noSuchInvitation);
		});
	}
}
