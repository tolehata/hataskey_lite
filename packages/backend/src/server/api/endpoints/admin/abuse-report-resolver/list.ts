/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable, Inject } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { QueryService } from '@/core/QueryService.js';
import type { AbuseReportResolversRepository } from '@/models/_.js';

export const meta = {
	requireCredential: true,
	kind: 'arr-list', // ここにkindプロパティを追加
	secure: true,
	requireAdmin: true,

	res: {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: {
					type: 'string', format: 'misskey:id', nullable: false, optional: false,
				},
				createdAt: {
					type: 'string', format: 'date-time', nullable: false, optional: false,
				},
				name: {
					type: 'string',
					nullable: false, optional: false,
				},
				targetUserPattern: {
					type: 'string',
					nullable: true, optional: false,
				},
				reporterPattern: {
					type: 'string',
					nullable: true, optional: false,
				},
				reportContentPattern: {
					type: 'string',
					nullable: true, optional: false,
				},
				expiresAt: {
					type: 'string',
					enum: ['1hour', '12hours', '1day', '1week', '1month', '3months', '6months', '1year', 'indefinitely'],
					nullable: false, optional: false,
				},
				expirationDate: {
					type: 'string', format: 'date-time', nullable: true, optional: false,
				},
				forward: {
					type: 'boolean',
					nullable: false, optional: false,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable() // eslint-disable-next-line import/no-default-export
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.abuseReportResolversRepository)
		private abuseReportResolversRepository: AbuseReportResolversRepository,

		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.abuseReportResolversRepository.createQueryBuilder('abuseReportResolvers'), ps.sinceId, ps.untilId)
				.andWhere(new Brackets(qb => {
					qb.where('abuseReportResolvers.expirationDate > :date', { date: new Date() });
					qb.orWhere('abuseReportResolvers.expirationDate IS NULL');
				}))
				.take(ps.limit);

			const resolvers = await query.getMany();
			return resolvers.map(resolver => ({
				id: resolver.id,
				createdAt: resolver.updatedAt.toISOString(),
				name: resolver.name,
				targetUserPattern: resolver.targetUserPattern,
				reporterPattern: resolver.reporterPattern,
				reportContentPattern: resolver.reportContentPattern,
				expiresAt: resolver.expiresAt as '1hour' | '12hours' | '1day' | '1week' | '1month' | '3months' | '6months' | '1year' | 'indefinitely',
				expirationDate: resolver.expirationDate?.toISOString() ?? null,
				forward: resolver.forward,
			}));
		});
	}
}
