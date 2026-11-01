/*
 * 旗鯖fork(1c): Hatady 内でユーザーをフォローする(hataskey 本体のフォローとは非連動)。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { ApiError } from '@/server/api/error.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.write,
	errors: {
		cannotFollowSelf: {
			message: 'You cannot follow yourself.',
			code: 'CANNOT_FOLLOW_SELF',
			id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
		},
		noSuchUser: {
			message: 'No such user or access denied.',
			code: 'NO_SUCH_USER',
			id: '063397ba-157f-4f1f-9968-83f0815dc1be',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			try {
				await this.hatadyService.follow(me, ps.userId);
			} catch (error) {
				if (error instanceof Error && error.message === 'cannot follow yourself') throw new ApiError(meta.errors.cannotFollowSelf);
				throw new ApiError(meta.errors.noSuchUser);
			}
		});
	}
}
