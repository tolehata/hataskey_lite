/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskRecipeService } from '@/core/HataskRecipeService.js';
import { packedHataskCookingRecordSchema } from '../_schema.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'read:account',
	limit: { duration: 60 * 1000, max: 120 },
	res: { type: 'array', optional: false, nullable: false, items: packedHataskCookingRecordSchema },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		recipeId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
		query: { type: 'string', maxLength: 100, nullable: true, default: null },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskRecipeService) {
		super(meta, paramDef, async (ps, me) => await service.listCookingRecords(me, {
			recipeId: ps.recipeId ?? null,
			query: ps.query ?? null,
			limit: ps.limit ?? 30,
			offset: ps.offset ?? 0,
		}));
	}
}
