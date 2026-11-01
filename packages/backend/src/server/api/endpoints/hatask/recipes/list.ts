/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HataskRecipeService } from '@/core/HataskRecipeService.js';
import { HATASK_RECIPE_CATEGORIES } from '@/models/HataskRecipe.js';
import { packedHataskRecipeSchema } from './_schema.js';

const count = { type: 'integer', optional: false, nullable: false } as const;

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'read:account',
	limit: { duration: 60 * 1000, max: 120 },
	res: {
		type: 'object', optional: false, nullable: false,
		properties: {
			items: { type: 'array', optional: false, nullable: false, items: packedHataskRecipeSchema },
			total: count,
			counts: {
				type: 'object', optional: false, nullable: false,
				properties: { all: count, main: count, side: count, soup: count, staple: count, dessert: count },
				required: ['all', 'main', 'side', 'soup', 'staple', 'dessert'],
			},
			tags: { type: 'array', optional: false, nullable: false, items: { type: 'string', optional: false, nullable: false } },
		},
		required: ['items', 'total', 'counts', 'tags'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		scope: { type: 'string', enum: ['mine', 'shared'], default: 'mine' },
		category: { type: 'string', enum: [...HATASK_RECIPE_CATEGORIES, null], nullable: true, default: null },
		tag: { type: 'string', maxLength: 32, nullable: true, default: null },
		query: { type: 'string', maxLength: 100, nullable: true, default: null },
		sort: { type: 'string', enum: ['cooked', 'recent', 'title'], default: 'cooked' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskRecipeService) {
		super(meta, paramDef, async (ps, me) => await service.list(me, {
			scope: ps.scope ?? 'mine',
			category: ps.category ?? null,
			tag: ps.tag ?? null,
			query: ps.query ?? null,
			sort: ps.sort ?? 'cooked',
			limit: ps.limit ?? 30,
			offset: ps.offset ?? 0,
		}));
	}
}
