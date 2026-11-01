/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATASK_RECIPE_ERRORS, HATASK_RECIPE_LIMITS, HataskRecipeService } from '@/core/HataskRecipeService.js';
import { HATASK_COOKING_MEAL_SLOTS } from '@/models/HataskCookingRecord.js';
import { cookingAudienceProperties, packedHataskCookingRecordSchema } from '../_schema.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: { duration: 60 * 1000, max: 30 },
	errors: {
		noSuchRecipe: HATASK_RECIPE_ERRORS.noSuchRecipe,
		invalidRecipe: HATASK_RECIPE_ERRORS.invalidRecipe,
		invalidAudience: HATASK_RECIPE_ERRORS.invalidAudience,
		invalidFile: HATASK_RECIPE_ERRORS.invalidFile,
		hatadyFailed: HATASK_RECIPE_ERRORS.hatadyFailed,
	},
	res: packedHataskCookingRecordSchema,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		recipeId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
		title: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.title },
		cookedAt: { type: 'integer', minimum: 0 },
		durationSeconds: { type: 'integer', minimum: 0, maximum: 86400, nullable: true, default: null },
		servings: { type: 'integer', minimum: 1, maximum: 50, default: 2 },
		mealSlot: { type: 'string', enum: [...HATASK_COOKING_MEAL_SLOTS, null], nullable: true, default: null },
		cost: { type: 'integer', minimum: 0, maximum: 10000000, nullable: true, default: null },
		memo: { type: 'string', maxLength: HATASK_RECIPE_LIMITS.memo, default: '' },
		fileId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
		recordToHatady: { type: 'boolean', default: true },
		...cookingAudienceProperties,
	},
	required: ['cookedAt'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskRecipeService) {
		super(meta, paramDef, async (ps, me) => await service.createCookingRecord(me, {
			recipeId: ps.recipeId ?? null,
			title: ps.title,
			cookedAt: new Date(ps.cookedAt),
			durationSeconds: ps.durationSeconds ?? null,
			servings: ps.servings ?? 2,
			mealSlot: ps.mealSlot ?? null,
			cost: ps.cost ?? null,
			memo: ps.memo ?? '',
			fileId: ps.fileId ?? null,
			visibility: ps.visibility ?? 'private',
			visibleUserIds: ps.visibleUserIds ?? [],
			recordToHatady: ps.recordToHatady ?? true,
		}));
	}
}
