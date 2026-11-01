/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATASK_RECIPE_ERRORS, HataskRecipeService } from '@/core/HataskRecipeService.js';
import { packedHataskRecipeSchema, recipeInputProperties } from './_schema.js';
import { toRecipeInput } from './_input.js';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	limit: { duration: 60 * 1000, max: 30 },
	errors: { invalidRecipe: HATASK_RECIPE_ERRORS.invalidRecipe, invalidAudience: HATASK_RECIPE_ERRORS.invalidAudience, invalidFile: HATASK_RECIPE_ERRORS.invalidFile },
	res: packedHataskRecipeSchema,
} as const;

export const paramDef = {
	type: 'object',
	properties: recipeInputProperties,
	required: ['title'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(private service: HataskRecipeService) {
		super(meta, paramDef, async (ps, me) => await service.create(me, toRecipeInput(ps)));
	}
}
