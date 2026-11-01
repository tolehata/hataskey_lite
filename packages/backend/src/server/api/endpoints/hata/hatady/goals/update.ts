/*
 * 旗鯖fork(Hatady): 学習目標を更新する(本人のみ)。done で手動達成/取消も行う。
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
	limit: HATADY_RATE_LIMITS.write,
	errors: {
		noSuchGoal: { message: 'No such goal.', code: 'NO_SUCH_GOAL', id: '2a3f1d4e-8b6c-4a1e-9f22-0c9a7b5e1d30' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		goalId: { type: 'string', format: 'misskey:id' },
		title: { type: 'string', minLength: 1, maxLength: 256 },
		description: { type: 'string', nullable: true, maxLength: 2048 },
		termType: { type: 'string', enum: ['short', 'long'] },
		targetDate: { type: 'integer', nullable: true },
		metricType: { type: 'string', enum: ['minutes', 'logs', 'books', null], nullable: true },
		metricTarget: { type: 'integer', nullable: true, minimum: 0 },
		done: { type: 'boolean' },
	},
	required: ['goalId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const ok = await this.hatadyService.updateGoal(me.id, ps.goalId, {
				title: ps.title,
				description: ps.description,
				termType: ps.termType,
				targetDate: ps.targetDate,
				metricType: ps.metricType,
				metricTarget: ps.metricTarget,
				done: ps.done,
			});
			if (!ok) throw new ApiError(meta.errors.noSuchGoal);
		});
	}
}
