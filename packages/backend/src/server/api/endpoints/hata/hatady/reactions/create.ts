/*
 * 旗鯖fork: Hatady の学習ログ / コメントにリアクションする(hataskey 共通の絵文字ピッカー由来の文字列)。
 *   logId か commentId のどちらか一方を指定。1ユーザー1対象1リアクション(再指定で置き換え)。
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
		invalidTarget: {
			message: 'Specify exactly one of logId or commentId.',
			code: 'INVALID_TARGET',
			id: 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a',
		},
		noSuchTarget: {
			message: 'No such Hatady reaction target or access denied.',
			code: 'NO_SUCH_HATADY_REACTION_TARGET',
			id: '600f3d7d-132d-4a37-95ec-ae4616087cf4',
		},
		invalidReaction: {
			message: 'Reaction must contain a non-whitespace character.',
			code: 'INVALID_REACTION',
			id: '45cdbfb0-9dc0-4d77-9bfc-f4b7e47aeb20',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		logId: { type: 'string', format: 'misskey:id', nullable: true },
		commentId: { type: 'string', format: 'misskey:id', nullable: true },
		reaction: { type: 'string', minLength: 1, maxLength: 260, pattern: '\\S' },
	},
	required: ['reaction'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const hasLog = ps.logId != null;
			const hasComment = ps.commentId != null;
			if (hasLog === hasComment) throw new ApiError(meta.errors.invalidTarget); // 両方 or 両方無しはNG
			try {
				await this.hatadyService.react(me, { logId: ps.logId ?? null, commentId: ps.commentId ?? null }, ps.reaction);
			} catch (error) {
				if (error instanceof Error && error.message === 'no such target or access denied') throw new ApiError(meta.errors.noSuchTarget);
				if (error instanceof Error && error.message === 'empty reaction') throw new ApiError(meta.errors.invalidReaction);
				throw error;
			}
		});
	}
}
