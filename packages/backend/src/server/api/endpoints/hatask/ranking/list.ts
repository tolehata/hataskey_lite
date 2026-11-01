/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskRankingService } from '@/core/HataskRankingService.js';
import { HATASK_RANKING_METRICS, HATASK_RANKING_PERIODS } from '@/core/hatask-ranking.js';

const count = { type: 'integer', optional: false, nullable: false, minimum: 0 } as const;
const rank = { type: 'integer', optional: false, nullable: true, minimum: 1 } as const;
const delta = { type: 'integer', optional: false, nullable: true } as const;
const dateTime = { type: 'string', format: 'date-time', optional: false, nullable: false } as const;

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'read:account',
	limit: { duration: 60 * 1000, max: 60 },
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			period: { type: 'string', optional: false, nullable: false, enum: HATASK_RANKING_PERIODS },
			from: { type: 'string', optional: false, nullable: false },
			to: { type: 'string', optional: false, nullable: false },
			generatedAt: dateTime, nextUpdateAt: dateTime,
			previousGeneratedAt: { ...dateTime, nullable: true },
			participating: { type: 'boolean', optional: false, nullable: false },
			latestAchievement: {
				type: 'object', optional: false, nullable: true,
				properties: {
					name: { type: 'string', optional: false, nullable: false },
					unlockedAt: count,
				}, required: ['name', 'unlockedAt'],
			},
			boards: {
				type: 'array', optional: false, nullable: false,
				items: {
					type: 'object', optional: false, nullable: false,
					properties: {
						metric: { type: 'string', optional: false, nullable: false, enum: HATASK_RANKING_METRICS },
						total: count, totalPages: count, page: { ...count, minimum: 1 },
						self: {
							type: 'object', optional: false, nullable: false,
							properties: { value: count, rank, delta, eligible: { type: 'boolean', optional: false, nullable: false } },
							required: ['value', 'rank', 'delta', 'eligible'],
						},
						items: {
							type: 'array', optional: false, nullable: false,
							items: {
								type: 'object', optional: false, nullable: false,
								properties: { rank: { ...count, minimum: 1 }, value: count, delta, user: { type: 'object', optional: false, nullable: false, ref: 'UserLite' } },
								required: ['rank', 'value', 'delta', 'user'],
							},
						},
					}, required: ['metric', 'total', 'totalPages', 'page', 'self', 'items'],
				},
			},
		}, required: ['period', 'from', 'to', 'generatedAt', 'nextUpdateAt', 'previousGeneratedAt', 'participating', 'latestAchievement', 'boards'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		period: { type: 'string', enum: HATASK_RANKING_PERIODS, default: 'month' },
		metric: { type: 'string', enum: HATASK_RANKING_METRICS },
		page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
		limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
	}, required: [], additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private rankingService: HataskRankingService) {
		super(meta, paramDef, (ps, me) => this.rankingService.list(me, ps.period, ps.metric, ps.page, ps.limit));
	}
}
