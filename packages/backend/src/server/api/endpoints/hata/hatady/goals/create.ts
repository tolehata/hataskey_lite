/*
 * 旗鯖fork(Hatady): 学習目標を作成する。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { HatadyService } from '@/core/HatadyService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'write:account',
	limit: HATADY_RATE_LIMITS.write,
	res: { type: 'object', optional: false, nullable: false },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		title: { type: 'string', minLength: 1, maxLength: 256 },
		description: { type: 'string', nullable: true, maxLength: 2048 },
		termType: { type: 'string', enum: ['short', 'long'], default: 'short' },
		targetDate: { type: 'integer', nullable: true },
		metricType: { type: 'string', enum: ['minutes', 'logs', 'books', null], nullable: true },
		metricTarget: { type: 'integer', nullable: true, minimum: 0 },
	},
	required: ['title'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const goal = await this.hatadyService.createGoal(me.id, {
				title: ps.title,
				description: ps.description ?? null,
				termType: ps.termType,
				targetDate: ps.targetDate ?? null,
				metricType: ps.metricType ?? null,
				metricTarget: ps.metricTarget ?? null,
			});
			return { id: goal.id };
		});
	}
}
