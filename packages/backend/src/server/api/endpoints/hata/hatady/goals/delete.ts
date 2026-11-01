/*
 * 旗鯖fork(Hatady): 学習目標を削除する(本人のみ)。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.destructive,
	errors: {
		noSuchGoal: { message: 'No such goal.', code: 'NO_SUCH_GOAL', id: 'b7c1e2a9-3d54-4f6b-8a20-1e9c0d7f4b62' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		goalId: { type: 'string', format: 'misskey:id' },
	},
	required: ['goalId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const ok = await this.hatadyService.deleteGoal(me.id, ps.goalId);
			if (!ok) throw new ApiError(meta.errors.noSuchGoal);
		});
	}
}
